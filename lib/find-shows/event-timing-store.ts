/**
 * File-backed and in-memory cache for Find Shows event start and end times per exact edition.
 * Stored under .next/cache/find-shows-event-timing/v2 (override with FIND_SHOWS_TIMING_STORE).
 *
 * Freshness (so a later-published schedule is picked up):
 * - VERIFIED_TIME never expires, and is never replaced by a failure or an UNAVAILABLE
 *   (only by a newer verified time — the batch script's --refresh).
 * - UNAVAILABLE is re-checked after FIND_SHOWS_TIMING_UNAVAILABLE_TTL_HOURS (default 7 days).
 * - FETCH_ERROR is re-checked after FIND_SHOWS_TIMING_ERROR_TTL_MINUTES (default 60).
 *
 * v1 records (which cached network failures as UNAVAILABLE forever) are not read.
 */
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import type { EventTimingResult } from '@/types/find-shows';

export const TIMING_STORE_VERSION = 'v2';

export function timingStoreDir() {
  return (
    process.env.FIND_SHOWS_TIMING_STORE ??
    path.join(process.cwd(), '.next', 'cache', 'find-shows-event-timing', TIMING_STORE_VERSION)
  );
}

export type StoredTimingRecord = EventTimingResult & {
  key: string;
  edition: {
    name: string;
    startDate: string;
    endDate: string;
    city: string;
    website: string;
  };
  /** Searches of this edition so far, and how many ended in FETCH_ERROR in a row. */
  attempts?: number;
  consecutiveErrors?: number;
  /** When a search last ran — differs from checkedAt when a failure kept an older verified time. */
  lastAttemptAt?: string;
  lastAttemptStatus?: EventTimingResult['status'];
};

const HOUR_MS = 60 * 60 * 1000;

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** How long a stored result is served before the edition is searched again (Infinity = never). */
export function timingRecordTtlMs(status: EventTimingResult['status']): number {
  switch (status) {
    case 'VERIFIED_TIME':
      return Infinity;
    case 'UNAVAILABLE':
    case 'VERIFIED_NO_TIME':
      return envNumber('FIND_SHOWS_TIMING_UNAVAILABLE_TTL_HOURS', 24 * 7) * HOUR_MS;
    case 'FETCH_ERROR':
    default:
      return envNumber('FIND_SHOWS_TIMING_ERROR_TTL_MINUTES', 60) * 60 * 1000;
  }
}

/** Whether a stored record can still be served without a new search. */
export function isTimingRecordFresh(record: StoredTimingRecord, now = Date.now()): boolean {
  if (record.status === 'VERIFIED_TIME') return true;
  const last = Date.parse(record.lastAttemptAt ?? record.checkedAt);
  if (!Number.isFinite(last)) return false;
  return now - last < timingRecordTtlMs(record.status);
}

/**
 * Combines a new search result with what is stored. A verified time is kept when the new
 * search fails or finds nothing (a site outage or a redesign must not erase it).
 *
 * `revalidate` (after the verification rules change): a search that read the official site
 * and no longer verifies the stored time replaces it; a fetch failure still never does.
 */
export function mergeTimingRecord(
  existing: StoredTimingRecord | null,
  fresh: EventTimingResult,
  key: string,
  edition: StoredTimingRecord['edition'],
  options: { revalidate?: boolean } = {}
): StoredTimingRecord {
  const attempts = (existing?.attempts ?? 0) + 1;
  const consecutiveErrors = fresh.status === 'FETCH_ERROR' ? (existing?.consecutiveErrors ?? 0) + 1 : 0;
  const tracking = { attempts, consecutiveErrors, lastAttemptAt: fresh.checkedAt, lastAttemptStatus: fresh.status };

  const keepVerified = options.revalidate ? fresh.status === 'FETCH_ERROR' : fresh.status !== 'VERIFIED_TIME';
  if (existing?.status === 'VERIFIED_TIME' && keepVerified) {
    return { ...existing, ...tracking };
  }
  return { ...fresh, key, edition, ...tracking };
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 24);
}

function filePath(key: string): string {
  return path.join(timingStoreDir(), `${hashKey(key)}.json`);
}

// In-memory hot cache
const memoryCache = new Map<string, StoredTimingRecord>();

export function getCachedTimingInMemory(key: string): StoredTimingRecord | null {
  return memoryCache.get(key) ?? null;
}

export function setCachedTimingInMemory(record: StoredTimingRecord): void {
  memoryCache.set(record.key, record);
}

export async function readTimingRecord(key: string): Promise<StoredTimingRecord | null> {
  const mem = memoryCache.get(key);
  // Only a verified time is final; anything else is re-read so a batch run
  // (scripts/event-timings) is picked up by a running server.
  if (mem?.status === 'VERIFIED_TIME') return mem;

  try {
    const raw = await readFile(filePath(key), 'utf8');
    const parsed = JSON.parse(raw) as StoredTimingRecord;
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return mem ?? null;
  }
}

export function readTimingRecordSync(key: string): StoredTimingRecord | null {
  const mem = memoryCache.get(key);
  if (mem) return mem;

  try {
    const p = filePath(key);
    if (!existsSync(p)) return null;
    const raw = readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw) as StoredTimingRecord;
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

/** Every stored record (for the catalog report). */
export async function readAllTimingRecords(): Promise<StoredTimingRecord[]> {
  let files: string[];
  try {
    files = (await readdir(timingStoreDir())).filter((file) => file.endsWith('.json'));
  } catch {
    return [];
  }
  const records: StoredTimingRecord[] = [];
  for (const file of files) {
    try {
      records.push(JSON.parse(await readFile(path.join(timingStoreDir(), file), 'utf8')) as StoredTimingRecord);
    } catch {
      // Skip a partially written file.
    }
  }
  return records;
}

/**
 * Atomic write: the batch script and a running server can write the same edition at once,
 * and two plain writeFile calls can interleave into an unreadable file. Write a temp file
 * and rename it over the target (retried briefly — Windows/OneDrive can hold the target).
 */
export async function writeTimingRecord(record: StoredTimingRecord): Promise<void> {
  memoryCache.set(record.key, record);

  const target = filePath(record.key);
  const temp = `${target}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    await mkdir(timingStoreDir(), { recursive: true });
    await writeFile(temp, JSON.stringify(record, null, 2), 'utf8');
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(temp, target);
        return;
      } catch (error) {
        if (attempt >= 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  } catch {
    // Non-fatal if disk cache cannot be written
    await unlink(temp).catch(() => undefined);
  }
}

export function writeTimingRecordSync(record: StoredTimingRecord): void {
  memoryCache.set(record.key, record);

  try {
    const dir = timingStoreDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const target = filePath(record.key);
    const temp = `${target}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    writeFileSync(temp, JSON.stringify(record, null, 2), 'utf8');
    renameSync(temp, target);
  } catch {
    // Non-fatal
  }
}

export function clearTimingMemoryCacheForTests(): void {
  memoryCache.clear();
}

/** Drops the in-process copy of read/written records (long batch runs keep memory flat). */
export function clearTimingMemoryCache(): void {
  memoryCache.clear();
}
