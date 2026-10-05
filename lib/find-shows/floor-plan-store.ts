/**
 * Floor-plan results per event edition, on disk: one gzipped JSON record per
 * edition under .next/cache/find-shows-floor-plans/v5 (override with
 * FIND_SHOWS_FLOOR_PLAN_STORE). The live Floor Plan tab and the catalog-wide
 * batch (scripts/floor-plans) read and write the same records.
 *
 * A record keeps what was established apart from the latest attempt:
 *
 *  - verifiedPlan: the last verified plan. Sticky — no later failure, and no
 *    later "none found" (a site that dropped a past edition's plan), replaces
 *    it; only a newer verified plan does.
 *  - verifiedNoPlan: the last verified "none published", kept separately. A
 *    later network failure or incomplete search does not undo it.
 *  - lastAttempt: the most recent search, whatever it found.
 *  - attempts: a short history of statuses and reasons.
 */
import { mkdir, readdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { gunzipSync, gzipSync } from 'zlib';
import type { FindShowFloorPlan } from './floor-plan';
import type { FloorPlanDiscovery, FloorPlanStatus, FloorPlanTrace } from './floor-plan-discovery';

export const STORE_VERSION = 'v5';

export function storeDir() {
  return process.env.FIND_SHOWS_FLOOR_PLAN_STORE ?? path.join(process.cwd(), '.next', 'cache', 'find-shows-floor-plans', STORE_VERSION);
}

export type StoredResult = {
  status: FloorPlanStatus;
  floorPlan: FindShowFloorPlan | null;
  reason: string;
  checkedAt: string;
  trace: FloorPlanTrace;
};

/** The edition a record is about, and the catalog records (slugs) that list it. */
export type StoredEdition = {
  name: string;
  startDate: string;
  city: string;
  country: string;
  venue: string;
  organizer: string;
  website: string;
  slugs: string[];
};

export type EditionRecord = {
  key: string;
  edition: StoredEdition;
  verifiedPlan: StoredResult | null;
  verifiedNoPlan: StoredResult | null;
  lastAttempt: StoredResult;
  attempts: { status: FloorPlanStatus; reason: string; checkedAt: string }[];
};

const MAX_ATTEMPTS_KEPT = 10;
const TRANSIENT: FloorPlanStatus[] = ['DISCOVERY_INCOMPLETE', 'NETWORK_ERROR', 'DOWNLOAD_FAILED'];
export const isTransient = (status: FloorPlanStatus) => TRANSIENT.includes(status);

/** A trace small enough to keep for every edition of the catalog. */
function compactTrace(trace: FloorPlanTrace): FloorPlanTrace {
  return {
    ...trace,
    sources: trace.sources.slice(0, 150),
    candidates: trace.candidates.slice(0, 100),
    queries: trace.queries.slice(0, 10),
  };
}

export function toStoredResult(discovery: FloorPlanDiscovery): StoredResult {
  return {
    status: discovery.status,
    floorPlan: discovery.floorPlan,
    reason: discovery.trace.outcomeReason,
    checkedAt: discovery.trace.checkedAt,
    trace: compactTrace(discovery.trace),
  };
}

/** The answer a record gives: its verified plan, else its verified "none", else its latest attempt. */
export function effectiveResult(record: EditionRecord): StoredResult {
  if (record.verifiedPlan) return record.verifiedPlan;
  if (record.lastAttempt.status === 'VERIFIED_NO_PLAN') return record.lastAttempt;
  if (record.verifiedNoPlan) return record.verifiedNoPlan;
  return record.lastAttempt;
}

/**
 * Folds a new search into a record without letting a failure erase what was
 * verified. `revalidate` is for re-judging under changed verification rules:
 * a plan verified by rules since found too lax is kept only if the new search
 * confirms it — otherwise the edition takes the new search's status (a
 * temporary failure stays temporary, never "none published").
 */
export function mergeResult(
  previous: EditionRecord | null,
  key: string,
  edition: StoredEdition,
  result: StoredResult,
  options: { revalidate?: boolean } = {}
): EditionRecord {
  const slugs = Array.from(new Set([...(previous?.edition.slugs ?? []), ...edition.slugs]));
  const settled = !isTransient(result.status);
  return {
    key,
    edition: { ...edition, slugs },
    verifiedPlan: result.status === 'VERIFIED_PLAN' ? result : options.revalidate ? null : previous?.verifiedPlan ?? null,
    verifiedNoPlan: result.status === 'VERIFIED_NO_PLAN' ? result : options.revalidate && settled ? null : previous?.verifiedNoPlan ?? null,
    lastAttempt: result,
    attempts: [{ status: result.status, reason: result.reason, checkedAt: result.checkedAt }, ...(previous?.attempts ?? [])].slice(0, MAX_ATTEMPTS_KEPT),
  };
}

const fileFor = (key: string) => path.join(storeDir(), `${createHash('sha1').update(key).digest('hex')}.json.gz`);

export async function readRecord(key: string): Promise<EditionRecord | null> {
  try {
    const record = JSON.parse(gunzipSync(await readFile(fileFor(key))).toString('utf8')) as EditionRecord;
    return record.key === key ? record : null;
  } catch {
    return null;
  }
}

/** Written to a temporary file and renamed, so an interrupted run never leaves a half-written record. */
export async function writeRecord(record: EditionRecord) {
  const file = fileFor(record.key);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, gzipSync(JSON.stringify(record)));
  await rename(temporary, file);
}

/** Every stored record (for reports). */
export async function readAllRecords(): Promise<EditionRecord[]> {
  let files: string[] = [];
  try {
    files = (await readdir(storeDir())).filter((file) => file.endsWith('.json.gz'));
  } catch {
    return [];
  }
  const records: EditionRecord[] = [];
  for (const file of files) {
    try {
      records.push(JSON.parse(gunzipSync(await readFile(path.join(storeDir(), file))).toString('utf8')) as EditionRecord);
    } catch {
      // A corrupt record is skipped; the next run searches that edition again.
    }
  }
  return records;
}
