import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  mergeExhibitorRow,
  planExhibitorSync,
  syncEventExhibitors,
  syncWithRetry,
  type ExhibitorSyncDb,
  type ExistingExhibitorRow,
} from '@/lib/exhibitors/crm-sync';
import { listLedger, markPending, readLedgerEntry, recordResult } from '@/lib/exhibitors/crm-sync-ledger';
import { crmExhibitorSyncEnabled, queueCrmExhibitorSync } from '@/lib/exhibitors/crm-sync-queue';
import { resolveExhibitors, type ExhibitorRecord } from '@/lib/find-shows/exhibitor-resolver';
import type { ExhibitorCard, ExhibitorDirectory } from '@/lib/find-shows/exhibitors';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';
import type { FindShowEvent } from '@/types/find-shows';

// A throwaway store (and so ledger, <store>/crm-sync): nothing here touches the real store or any database.
const store = mkdtempSync(path.join(tmpdir(), 'crm-sync-test-'));
process.env.FIND_SHOWS_EXHIBITOR_STORE = store;
afterAll(() => rmSync(store, { recursive: true, force: true }));
beforeEach(() => {
  process.env.FIND_SHOWS_EXHIBITOR_STORE = store;
  delete process.env.CRM_EXHIBITOR_SYNC;
});

const AAPEX = 'aapex-las-vegas-nv-2026-11-03';
const profile = (id: string) => `https://aapex2026.mapyourshow.com/8_0/exhibitor/exhibitor-details.cfm?exhid=${id}`;
const card = (id: string, name: string, extra: Partial<ExhibitorCard> = {}): ExhibitorCard => ({
  id,
  name,
  logoUrl: null,
  booths: [`V${id}`],
  description: null,
  profileUrl: profile(id),
  access: 'public',
  ...extra,
});

function record(slugs: string[], cards: ExhibitorCard[], checkedAt = '2026-10-09T12:00:00.000Z', platform = 'map-your-show'): ExhibitorRecord {
  const verified = {
    status: 'VERIFIED_LIST',
    source: { platform, platformLabel: 'Map Your Show', editionLabel: 'AAPEX 2026', directoryUrl: 'https://aapex2026.mapyourshow.com/', loginUrl: null, foundOn: 'https://www.aapexshow.com/' },
    exhibitors: cards,
    reason: '',
    checkedAt,
    rejected: [],
  } as unknown as ExhibitorDirectory;
  return {
    key: 'aapexshow.com|las vegas|2026-11-03',
    edition: { name: 'AAPEX', startDate: '2026-11-03', city: 'Las Vegas, NV', website: 'http://www.aapexshow.com', slugs },
    verified,
    lastAttempt: { ...verified, exhibitors: [] },
  };
}

type Row = ExistingExhibitorRow & { eventSlug: string; websiteUrl: string | null; country: string | null; email: string | null };

/** EventExhibitor in memory, with its (eventSlug, sourceDetailUrl) unique key and CRM-owned columns. */
function fakeDb(seed: Row[] = []) {
  const rows: Row[] = seed.map((row) => ({ ...row }));
  let ids = 0;
  let failures = 0;
  const db: ExhibitorSyncDb & { rows: Row[]; failNext(times: number): void; applies: number } = {
    rows,
    applies: 0,
    failNext(times) {
      failures = times;
    },
    async existingRows(slug) {
      return rows.filter((row) => row.eventSlug === slug).map((row) => ({ ...row }));
    },
    async apply(slug, plan) {
      if (failures > 0) {
        failures -= 1;
        throw new Error('Connection terminated unexpectedly');
      }
      db.applies += 1;
      let inserted = 0;
      for (const row of plan.inserts) {
        if (rows.some((existing) => existing.eventSlug === slug && existing.sourceDetailUrl === row.sourceDetailUrl)) continue; // ON CONFLICT DO NOTHING
        rows.push({ ...row, id: `row-${(ids += 1)}`, websiteUrl: null, country: null, email: null });
        inserted += 1;
      }
      for (const update of plan.updates) Object.assign(rows.find((row) => row.id === update.id)!, update);
      return { inserted, updated: plan.updates.length };
    },
  };
  return db;
}

const cards = [card('26731', '360insights', { description: 'Channel incentives.' }), card('24231', 'ABA USA LLC'), card('2001', 'Bosch')];

describe('CRM exhibitor sync: field ownership', () => {
  const existing: ExistingExhibitorRow = {
    id: 'r1',
    sourceDetailUrl: profile('1'),
    source: 'map-your-show',
    companyName: 'Old Name',
    nameKey: 'oldname',
    logoUrl: 'https://logo.example/1.png',
    sourceDirectoryUrl: 'https://old.example/',
    standNumber: 'V1',
    description: 'Kept description',
  };
  const incoming = { eventSlug: AAPEX, companyName: 'New Name', nameKey: 'newname', logoUrl: null, sourceDetailUrl: profile('1'), sourceDirectoryUrl: 'https://new.example/', standNumber: null, description: null, source: 'map-your-show' };

  it('takes name and directory from the list, and never blanks a logo, stand or description it no longer prints', () => {
    expect(mergeExhibitorRow(existing, incoming)).toEqual({
      id: 'r1',
      companyName: 'New Name',
      nameKey: 'newname',
      sourceDirectoryUrl: 'https://new.example/',
      logoUrl: 'https://logo.example/1.png',
      standNumber: 'V1',
      description: 'Kept description',
    });
  });

  it('plans inserts for new profiles, updates for changed rows, and leaves current rows alone', () => {
    const current = { ...existing, companyName: 'New Name', nameKey: 'newname', sourceDirectoryUrl: 'https://new.example/' };
    const fresh = { ...incoming, sourceDetailUrl: profile('2') };
    expect(planExhibitorSync([incoming, fresh], [current])).toEqual({ inserts: [fresh], updates: [], unchanged: 1 });
    expect(planExhibitorSync([incoming], [existing]).updates).toHaveLength(1);
  });
});

describe('CRM exhibitor sync: one event', () => {
  it('AAPEX with no CRM rows: creates one row per exhibitor; a second run changes nothing', async () => {
    const db = fakeDb();
    const first = await syncEventExhibitors(AAPEX, record([AAPEX], cards), db);
    expect(first).toMatchObject({ status: 'created', listed: 3, before: 0, inserted: 3, updated: 0 });
    const second = await syncEventExhibitors(AAPEX, record([AAPEX], cards), db);
    expect(second).toMatchObject({ status: 'unchanged', before: 3, inserted: 0, updated: 0, unchanged: 3 });
    expect(db.rows).toHaveLength(3);
    expect(db.applies).toBe(1);
    expect(new Set(db.rows.map((row) => row.sourceDetailUrl)).size).toBe(3);
  });

  it('an event already in the CRM: adds new exhibitors, refreshes changed ones, keeps CRM-owned fields', async () => {
    const db = fakeDb();
    await syncEventExhibitors(AAPEX, record([AAPEX], cards), db);
    Object.assign(db.rows[0], { websiteUrl: 'https://360insights.com', country: 'Canada', email: 'sales@360insights.com' });
    const changed = [card('26731', '360insights Inc.', { description: 'Channel incentives.' }), ...cards.slice(1), card('3003', 'Continental')];
    const result = await syncEventExhibitors(AAPEX, record([AAPEX], changed, '2026-10-10T00:00:00.000Z'), db);
    expect(result).toMatchObject({ status: 'updated', inserted: 1, updated: 1, unchanged: 2 });
    expect(db.rows).toHaveLength(4);
    expect(db.rows[0]).toMatchObject({ companyName: '360insights Inc.', websiteUrl: 'https://360insights.com', country: 'Canada', email: 'sales@360insights.com' });
  });

  it('never deletes: an exhibitor that leaves the public list keeps its CRM row', async () => {
    const db = fakeDb();
    await syncEventExhibitors(AAPEX, record([AAPEX], cards), db);
    await syncEventExhibitors(AAPEX, record([AAPEX], cards.slice(0, 1)), db);
    expect(db.rows).toHaveLength(3);
  });

  it('rows from another source (BETT): a conflict for review, nothing written', async () => {
    const bett = 'bett-show-london-2027-01-20';
    const db = fakeDb([
      { id: 'b1', eventSlug: bett, sourceDetailUrl: 'https://uk.bettshow.com/solution-providers/4matrix', source: 'bett-detail-sheet', companyName: '4Matrix', nameKey: '4matrix', logoUrl: null, sourceDirectoryUrl: null, standNumber: 'SD20', description: null, websiteUrl: 'https://4matrixcloud.com', country: 'United Kingdom', email: null },
    ]);
    const result = await syncEventExhibitors(bett, record([bett], [card('9', '4Matrix', { profileUrl: 'https://uk.bettshow.com/exhibitors/4matrix' })], undefined, 'organizer-directory'), db);
    expect(result.status).toBe('conflict');
    expect(result.reason).toMatch(/bett-detail-sheet/);
    expect(db.rows).toHaveLength(1);
    expect(db.applies).toBe(0);
  });

  it('ambiguous match — a stored list that names other catalog slugs — is refused, not guessed', async () => {
    const db = fakeDb();
    const result = await syncEventExhibitors(AAPEX, record(['aapex-las-vegas-nv-2025-11-04'], cards), db);
    expect(result).toMatchObject({ status: 'no-list' });
    expect(result.reason).toMatch(/belongs to/);
    expect(db.rows).toHaveLength(0);
  });

  it('nothing verified (no record, or an unverified one): no-list, nothing written', async () => {
    const db = fakeDb();
    expect((await syncEventExhibitors(AAPEX, null, db)).status).toBe('no-list');
    const unverified = { ...record([AAPEX], cards), verified: null };
    expect((await syncEventExhibitors(AAPEX, unverified, db)).status).toBe('no-list');
    expect(db.rows).toHaveLength(0);
  });

  it('one edition listed by two catalog slugs: each slug gets its own rows, no cross-linking', async () => {
    const db = fakeDb();
    const twin = 'aapex-las-vegas-nv-2026-11-03-14951';
    const shared = record([AAPEX, twin], cards);
    await syncEventExhibitors(AAPEX, shared, db);
    await syncEventExhibitors(twin, shared, db);
    expect(db.rows.filter((row) => row.eventSlug === AAPEX)).toHaveLength(3);
    expect(db.rows.filter((row) => row.eventSlug === twin)).toHaveLength(3);
  });

  it('a list whose exhibitors share one catalogue link (no page each) is skipped with the reason, not reported unchanged', async () => {
    const db = fakeDb();
    const shared = 'https://www.example-fair.com/catalogue';
    const list = record([AAPEX], ['1', '2', '3', '4'].map((id) => card(id, `Exhibitor ${id}`, { profileUrl: shared })));
    const result = await syncEventExhibitors(AAPEX, list, db);
    expect(result.status).toBe('no-list');
    expect(result.reason).toMatch(/no page of their own/);
    expect(db.rows).toHaveLength(0);
  });

  it('a dry run reports what would happen and writes nothing', async () => {
    const db = fakeDb();
    const result = await syncEventExhibitors(AAPEX, record([AAPEX], cards), db, { dryRun: true });
    expect(result).toMatchObject({ status: 'created', inserted: 3, dryRun: true });
    expect(db.rows).toHaveLength(0);
  });
});

describe('CRM exhibitor sync: failures and retries', () => {
  it('retries a temporary failure and then succeeds', async () => {
    const db = fakeDb();
    db.failNext(1);
    const result = await syncWithRetry(AAPEX, record([AAPEX], cards), db, { sleep: async () => {} });
    expect(result).toMatchObject({ status: 'created', inserted: 3, attempts: 2 });
  });

  it('gives up after the last attempt without throwing, and the ledger keeps it for the retry run', async () => {
    const db = fakeDb();
    db.failNext(5);
    const slug = 'retry-show-2026-11-01';
    const list = record([slug], cards, '2026-10-09T01:00:00.000Z');
    const failed = await syncWithRetry(slug, list, db, { attempts: 3, sleep: async () => {} });
    expect(failed).toMatchObject({ status: 'failed', attempts: 3, reason: 'Connection terminated unexpectedly' });
    await recordResult(failed, list.verified!.checkedAt);
    expect((await listLedger()).map((entry) => entry.slug)).toContain(slug);

    // The retry run (--pending) picks it up once the database is back.
    db.failNext(0);
    const retried = await syncWithRetry(slug, list, db, { sleep: async () => {} });
    await recordResult(retried, list.verified!.checkedAt);
    expect(retried.status).toBe('created');
    expect((await readLedgerEntry(slug))).toMatchObject({ status: 'synced', attempts: 4, lastError: null });
    expect((await listLedger()).map((entry) => entry.slug)).not.toContain(slug);
  });
});

describe('CRM exhibitor sync: automatic (future lists)', () => {
  it('is off unless CRM_EXHIBITOR_SYNC=on', () => {
    expect(crmExhibitorSyncEnabled({})).toBe(false);
    expect(crmExhibitorSyncEnabled({ CRM_EXHIBITOR_SYNC: 'on' })).toBe(true);
  });

  it('off: marks every slug of the edition pending and writes nothing', async () => {
    const db = fakeDb();
    const slugs = ['queue-off-a-2026-11-01', 'queue-off-b-2026-11-01'];
    await queueCrmExhibitorSync(record(slugs, cards, '2026-10-09T02:00:00.000Z'), { enabled: false, db, log: () => {} });
    expect(db.rows).toHaveLength(0);
    for (const slug of slugs) expect(await readLedgerEntry(slug)).toMatchObject({ status: 'pending', listCheckedAt: '2026-10-09T02:00:00.000Z' });
  });

  it('on: writes the rows and records the edition synced; storing the same list again adds nothing', async () => {
    const db = fakeDb();
    const slug = 'queue-on-2026-11-01';
    const list = record([slug], cards, '2026-10-09T03:00:00.000Z');
    const [first] = await queueCrmExhibitorSync(list, { enabled: true, db, log: () => {} });
    expect(first).toMatchObject({ status: 'created', inserted: 3 });
    expect(await readLedgerEntry(slug)).toMatchObject({ status: 'synced' });
    await queueCrmExhibitorSync(list, { enabled: true, db, log: () => {} });
    expect(db.rows).toHaveLength(3);
  });

  it('a list that cannot be keyed is recorded as skipped with its reason, not synced, until a newer list arrives', async () => {
    const slug = 'queue-skipped-2026-11-01';
    const shared = 'https://www.example-fair.com/catalogue';
    const list = record([slug], ['1', '2'].map((id) => card(id, `Exhibitor ${id}`, { profileUrl: shared })), '2026-10-09T05:00:00.000Z');
    const result = await syncEventExhibitors(slug, list, fakeDb());
    await recordResult(result, list.verified!.checkedAt);
    expect(await readLedgerEntry(slug)).toMatchObject({ status: 'skipped', lastError: expect.stringMatching(/no page of their own/) });
    expect(await markPending(slug, list.verified!.checkedAt)).toMatchObject({ status: 'skipped' });
    expect(await markPending(slug, '2026-10-10T05:00:00.000Z')).toMatchObject({ status: 'pending' });
  });

  it('a newer list puts a synced event back to pending', async () => {
    const slug = 'queue-newer-2026-11-01';
    await recordResult({ slug, status: 'created', listed: 3, before: 0, inserted: 3, updated: 0, unchanged: 0, dryRun: false }, '2026-10-09T04:00:00.000Z');
    await markPending(slug, '2026-10-10T04:00:00.000Z');
    expect(await readLedgerEntry(slug)).toMatchObject({ status: 'pending', listCheckedAt: '2026-10-10T04:00:00.000Z' });
  });

  it('the exhibitor store queues the CRM sync by itself when it stores a newly verified list', async () => {
    const event = {
      slug: 'hook-show-2026-10-09',
      name: 'HOOK SHOW',
      dates: '10/09/2026',
      city: 'London',
      country: 'United Kingdom',
      venue: 'Olympia',
      website: 'http://www.hookshow.example',
      startDate: '2026-10-09',
      endDate: '2026-10-11',
      seedAsset: { bannerUrl: null, logoUrl: null, eventseyeUrl: null },
    } as unknown as FindShowEvent;
    // The same official site as tests/integration/exhibitor-on-demand.test.ts.
    const names = ['Acme Robotics', 'Beta Controls', 'Gamma Tools', 'Delta Sensors', 'Epsilon Labs', 'Zeta Cables', 'Kappa Motors', 'Lambda Optics'];
    const pages: Record<string, string> = {
      [event.website]: '<a href="/exhibitor-list">Exhibitor list</a>',
      [`${event.website}/exhibitor-list`]: `<html><head><title>Exhibitor list</title></head><body><header><p>9-11 October 2026</p></header><main><ul>${names
        .map((name) => `<li><h3><a href="/exhibitors/${name.toLowerCase().replace(/\s+/g, '-')}">${name}</a></h3><p>Stand B${name.length}</p></li>`)
        .join('')}</ul></main></body></html>`,
    };
    const fetcher: Fetcher = async (url) =>
      ({ url, status: pages[url] ? 200 : 404, contentType: 'text/html', headers: {}, body: Buffer.from(pages[url] ?? ''), truncated: false }) as Fetched;

    const answer = await resolveExhibitors(event, { fetcher, retryDelayMs: 0 });
    expect(answer.status).toBe('VERIFIED_LIST');
    // The hook runs after the store write, without holding up the tab's answer.
    let entry = null;
    for (let i = 0; i < 50 && !entry; i += 1) {
      entry = await readLedgerEntry(event.slug);
      if (!entry) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(entry).toMatchObject({ slug: event.slug, status: 'pending' });
  });
});
