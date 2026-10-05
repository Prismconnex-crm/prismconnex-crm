import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { readExhibitorRecord, resolveExhibitors, writeExhibitorRecord, type ExhibitorRecord } from '@/lib/find-shows/exhibitor-resolver';
import { editionKey } from '@/lib/find-shows/floor-plan-resolver';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';
import type { FindShowEvent } from '@/types/find-shows';

// A throwaway store: these tests never touch the real exhibitor store (or any floor-plan data).
const store = mkdtempSync(path.join(tmpdir(), 'exhibitor-store-test-'));
process.env.FIND_SHOWS_EXHIBITOR_STORE = store;
afterAll(() => rmSync(store, { recursive: true, force: true }));

let serial = 0;
/** A fresh edition per test, so tests do not share stored records. */
function makeEvent(): FindShowEvent {
  serial += 1;
  return {
    slug: `test-show-${serial}`,
    name: `TEST SHOW ${serial}`,
    dates: '10/09/2026',
    city: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    region: 'Europe',
    venue: 'Olympia',
    organizer: 'Test Org',
    frequency: 'once a year',
    website: `http://www.testshow${serial}.example`,
    email: '',
    rawCategories: [],
    categories: [],
    primaryCategory: 'General',
    startDate: '2026-10-09',
    endDate: '2026-10-11',
    startMonth: '2026-10',
    endMonth: '2026-10',
    displayDate: '09 - 11 Oct 2026',
    searchText: '',
    seedAsset: { bannerUrl: null, logoUrl: null, eventseyeUrl: null },
    description: '',
    seedCity: 'London (UK)',
    monthYear: 'October 2026',
    duration: '3 days',
  } as unknown as FindShowEvent;
}

const names = ['Acme Robotics', 'Beta Controls', 'Gamma Tools', 'Delta Sensors', 'Epsilon Labs', 'Zeta Cables', 'Kappa Motors', 'Lambda Optics'];
const listHtml = (dates = '9-11 October 2026') => `<html><head><title>Exhibitor list</title></head><body><header><p>${dates}</p></header><main><ul>${names
  .map((name) => `<li><h3><a href="/exhibitors/${name.toLowerCase().replace(/\s+/g, '-')}">${name}</a></h3><p>Stand B${name.length}</p></li>`)
  .join('')}</ul></main></body></html>`;

type Answer = { status?: number; body: string } | Error;

/** An official site with an exhibitor list; `mode` makes it fail, or answer slowly. */
function site(event: FindShowEvent, mode: 'ok' | 'down' | 'slow' | 'none' = 'ok') {
  const calls: string[] = [];
  const home = event.website;
  const routes: Record<string, Answer> = {
    [home]: { body: mode === 'none' ? '<p>Welcome</p>' : '<a href="/exhibitor-list">Exhibitor list</a>' },
    [`${home}/exhibitor-list`]: { body: listHtml() },
  };
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    if (mode === 'down') throw new Error('fetch failed (ECONNRESET)');
    if (mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 300));
    const route = routes[url] ?? { status: 404, body: '' };
    if (route instanceof Error) throw route;
    const response: Fetched = { url, status: route.status ?? 200, contentType: 'text/html', headers: {}, body: Buffer.from(route.body), truncated: false };
    return response;
  };
  return Object.assign(fetcher, { calls });
}

beforeEach(() => {
  process.env.FIND_SHOWS_EXHIBITOR_STORE = store;
});

describe('Exhibitors tab: on-demand discovery', () => {
  it('searches the official site when nothing is stored, stores the verified list, and serves it from the store next time', async () => {
    const event = makeEvent();
    const fetcher = site(event);
    const first = await resolveExhibitors(event, { fetcher, retryDelayMs: 0 });
    expect(first).toMatchObject({ status: 'VERIFIED_LIST', cached: false });
    expect(first.exhibitors.map((card) => card.name)).toHaveLength(8);
    expect((await readExhibitorRecord(editionKey(event)))?.verified?.status).toBe('VERIFIED_LIST');

    const again = site(event);
    const second = await resolveExhibitors(event, { fetcher: again, retryDelayMs: 0 });
    expect(second).toMatchObject({ status: 'VERIFIED_LIST', cached: true });
    expect(again.calls).toEqual([]);
  });

  it('shows a stored list at once when due for refresh, and a failed refresh never replaces it', async () => {
    const event = makeEvent();
    await resolveExhibitors(event, { fetcher: site(event), retryDelayMs: 0 });
    // Age the stored record past its refresh time.
    const record = (await readExhibitorRecord(editionKey(event)))!;
    const old = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
    await writeExhibitorRecord({ ...record, lastAttempt: { ...record.lastAttempt, checkedAt: old } } as ExhibitorRecord);

    const down = site(event, 'down');
    const answer = await resolveExhibitors(event, { fetcher: down, retryDelayMs: 0 });
    expect(answer).toMatchObject({ status: 'VERIFIED_LIST', cached: true, refreshing: true });
    // Let the background refresh finish (and fail).
    await new Promise((resolve) => setTimeout(resolve, 50));
    const after = (await readExhibitorRecord(editionKey(event)))!;
    expect(after.lastAttempt.status).toBe('DISCOVERY_INCOMPLETE');
    expect(after.verified?.status).toBe('VERIFIED_LIST');
    expect((await resolveExhibitors(event, { fetcher: down, retryDelayMs: 0 })).status).toBe('VERIFIED_LIST');
  });

  it('reports a temporary failure as unfinished, and "Try again" really searches again', async () => {
    const event = makeEvent();
    const failed = await resolveExhibitors(event, { fetcher: site(event, 'down'), retryDelayMs: 0 });
    expect(failed.status).toBe('DISCOVERY_INCOMPLETE');

    // Without retry the unfinished check is served from the store for a while…
    const quiet = site(event);
    expect((await resolveExhibitors(event, { fetcher: quiet, retryDelayMs: 0 })).status).toBe('DISCOVERY_INCOMPLETE');
    expect(quiet.calls).toEqual([]);
    // …"Try again" searches now.
    const retried = await resolveExhibitors(event, { fetcher: site(event), retry: true, retryDelayMs: 0 });
    expect(retried.status).toBe('VERIFIED_LIST');
  });

  it('"Try again" never searches over a verified list', async () => {
    const event = makeEvent();
    await resolveExhibitors(event, { fetcher: site(event), retryDelayMs: 0 });
    const watch = site(event);
    expect((await resolveExhibitors(event, { fetcher: watch, retry: true, retryDelayMs: 0 })).status).toBe('VERIFIED_LIST');
    expect(watch.calls).toEqual([]);
  });

  it('answers "still checking" when a search outlasts the request, and the search finishes into the store', async () => {
    const event = makeEvent();
    const first = await resolveExhibitors(event, { fetcher: site(event, 'slow'), waitMs: 50, retryDelayMs: 0 });
    expect(first).toMatchObject({ status: 'DISCOVERY_INCOMPLETE', pending: true });
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const next = await resolveExhibitors(event, { fetcher: site(event), retryDelayMs: 0 });
    expect(next).toMatchObject({ status: 'VERIFIED_LIST', cached: true });
  });

  it('while a "Try again" search is still running, later requests follow it instead of replaying the old failure', async () => {
    const event = makeEvent();
    await resolveExhibitors(event, { fetcher: site(event, 'down'), retryDelayMs: 0 });
    const retry = await resolveExhibitors(event, { fetcher: site(event, 'slow'), retry: true, waitMs: 50, retryDelayMs: 0 });
    expect(retry).toMatchObject({ pending: true });
    // The tab's next poll (no retry flag) must not get the stored failure back.
    const poll = await resolveExhibitors(event, { fetcher: site(event), waitMs: 50, retryDelayMs: 0 });
    expect(poll.status === 'VERIFIED_LIST' || poll.pending === true).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    expect((await resolveExhibitors(event, { fetcher: site(event), retryDelayMs: 0 })).status).toBe('VERIFIED_LIST');
  });

  it('says so when the official site publishes no directory', async () => {
    const event = makeEvent();
    const answer = await resolveExhibitors(event, { fetcher: site(event, 'none'), retryDelayMs: 0 });
    expect(answer.status).toBe('NO_VERIFIED_DIRECTORY');
  });
});
