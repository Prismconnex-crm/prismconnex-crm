import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FloorPlanStatus, FloorPlanTrace } from '../../lib/find-shows/floor-plan-discovery';
import {
  effectiveResult,
  mergeResult,
  readAllRecords,
  readRecord,
  writeRecord,
  type StoredEdition,
  type StoredResult,
} from '../../lib/find-shows/floor-plan-store';

const edition: StoredEdition = {
  name: 'Franchising Expo',
  startDate: '2026-08-01',
  city: 'Melbourne',
  country: 'Australia',
  venue: 'MCEC',
  organizer: 'Specialised Events',
  website: 'http://www.franchisingexpo.example',
  slugs: ['franchising-expo-melbourne-2026-08-01'],
};

const result = (status: FloorPlanStatus, checkedAt: string): StoredResult => ({
  status,
  floorPlan:
    status === 'VERIFIED_PLAN'
      ? { kind: 'pdf', url: 'https://cdn.example/fp.pdf', verification: 'plan-content', evidence: ['plan names 2026'], source: { label: 'x', url: 'https://x.example' } }
      : null,
  reason: status,
  checkedAt,
  trace: { candidates: [], sources: [], queries: [] } as unknown as FloorPlanTrace,
});

describe('the edition store', () => {
  const key = 'franchisingexpo.example|melbourne|2026-08-01';

  it('never lets a temporary failure or a later "none found" replace a verified plan', () => {
    let record = mergeResult(null, key, edition, result('VERIFIED_PLAN', '2026-07-01T00:00:00Z'));
    for (const status of ['NETWORK_ERROR', 'DOWNLOAD_FAILED', 'DISCOVERY_INCOMPLETE', 'VERIFIED_NO_PLAN'] as const) {
      record = mergeResult(record, key, edition, result(status, '2026-09-01T00:00:00Z'));
      expect(effectiveResult(record).status).toBe('VERIFIED_PLAN');
    }
    expect(record.lastAttempt.status).toBe('VERIFIED_NO_PLAN');
    expect(record.attempts.map((attempt) => attempt.status)).toEqual([
      'VERIFIED_NO_PLAN',
      'DISCOVERY_INCOMPLETE',
      'DOWNLOAD_FAILED',
      'NETWORK_ERROR',
      'VERIFIED_PLAN',
    ]);
  });

  it('keeps a verified "none published" through later failures, and lets a newly verified plan replace it', () => {
    let record = mergeResult(null, key, edition, result('VERIFIED_NO_PLAN', '2026-07-01T00:00:00Z'));
    record = mergeResult(record, key, edition, result('NETWORK_ERROR', '2026-07-02T00:00:00Z'));
    expect(effectiveResult(record).status).toBe('VERIFIED_NO_PLAN');
    record = mergeResult(record, key, edition, result('VERIFIED_PLAN', '2026-07-03T00:00:00Z'));
    expect(effectiveResult(record).status).toBe('VERIFIED_PLAN');
  });

  it('re-judging under new rules keeps a plan only if the new search confirms it, and never turns a failure into "none"', () => {
    let record = mergeResult(null, key, edition, result('VERIFIED_PLAN', '2026-07-01T00:00:00Z'));
    record = mergeResult(record, key, edition, result('VERIFIED_PLAN', '2026-07-02T00:00:00Z'), { revalidate: true });
    expect(effectiveResult(record).status).toBe('VERIFIED_PLAN');
    // Not re-confirmed (the site was down): the old verdict is void, the edition is unsettled — not "none published".
    record = mergeResult(record, key, edition, result('NETWORK_ERROR', '2026-07-03T00:00:00Z'), { revalidate: true });
    expect(effectiveResult(record).status).toBe('NETWORK_ERROR');
    expect(record.verifiedPlan).toBeNull();
    // An ordinary refresh after that cannot bring the voided plan back.
    record = mergeResult(record, key, edition, result('DOWNLOAD_FAILED', '2026-07-04T00:00:00Z'));
    expect(effectiveResult(record).status).toBe('DOWNLOAD_FAILED');
  });

  it('never reports a failure-only edition as "none published"', () => {
    const record = mergeResult(null, key, edition, result('DISCOVERY_INCOMPLETE', '2026-07-01T00:00:00Z'));
    expect(effectiveResult(record).status).toBe('DISCOVERY_INCOMPLETE');
  });

  describe('on disk', () => {
    let dir: string;
    beforeAll(() => {
      dir = mkdtempSync(path.join(tmpdir(), 'floor-plan-store-'));
      process.env.FIND_SHOWS_FLOOR_PLAN_STORE = dir;
    });
    afterAll(() => {
      delete process.env.FIND_SHOWS_FLOOR_PLAN_STORE;
      rmSync(dir, { recursive: true, force: true });
    });

    it('writes, reads back and lists records, merging the catalog records that share an edition', async () => {
      await writeRecord(mergeResult(null, key, edition, result('VERIFIED_PLAN', '2026-07-01T00:00:00Z')));
      const second = mergeResult(
        await readRecord(key),
        key,
        { ...edition, slugs: ['melbourne-franchising-expo-2026-08-01'] },
        result('NETWORK_ERROR', '2026-07-02T00:00:00Z')
      );
      await writeRecord(second);
      const stored = await readRecord(key);
      expect(stored?.edition.slugs).toEqual(['franchising-expo-melbourne-2026-08-01', 'melbourne-franchising-expo-2026-08-01']);
      expect(effectiveResult(stored!).status).toBe('VERIFIED_PLAN');
      expect(await readRecord('another|key|2026-01-01')).toBeNull();
      expect((await readAllRecords()).map((record) => record.key)).toEqual([key]);
    });
  });
});
