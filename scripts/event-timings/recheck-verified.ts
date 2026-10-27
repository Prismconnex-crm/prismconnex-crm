/**
 * Memory-safe re-check of verified event timings under the current rules.
 *
 *   node --max-old-space-size=512 --expose-gc scripts/event-timings/recheck-run.mjs --batches=1
 *   node --max-old-space-size=512 --expose-gc scripts/event-timings/recheck-run.mjs            # up to 8 batches, then exits
 *   node --max-old-space-size=512 --expose-gc scripts/event-timings/recheck-run.mjs --retry-fetch-errors
 *
 * Run node directly (not through npm): on Windows, stopping npm can leave this process running.
 *
 * Options: --batch-size=25, --batches=8 (per invocation; re-run to continue), --concurrency=2
 * (never two editions on one site), --site-gap-ms=1500, --min-free-mb=1024 (system RAM),
 * --max-rss-mb=450 (this process), --since=<ISO> (with a new state file or --rescan: verdicts
 * reached since then count as done), --rescan (rebuild the pending list; with --since, a fresh re-check),
 * --match-evidence=<regex> (with --rescan: only verified records whose evidence matches).
 *
 * - Each edition is judged by searchTimingEdition(..., { revalidate: true }) with the catalog
 *   budget — the same rules as the catalog run. A verified time is removed only when the
 *   official site was read and no longer verifies it; any fetch failure keeps it.
 * - State (<store>/../recheck-run.json): `since` and the pending edition keys, built once by
 *   reading cache files one at a time. Each verdict is written as soon as it is known, so a
 *   stopped run resumes with the next invocation; an edition is done once it has a verdict
 *   other than FETCH_ERROR since `since`. FETCH_ERROR editions wait for --retry-fetch-errors.
 * - Between batches: the store's in-memory copy is dropped, GC runs (with --expose-gc), and the
 *   run pauses (up to 2 min) or stops cleanly when free RAM or this process's RSS is out of bounds.
 * - Every verdict is appended to reports/event-timings/recheck.csv (old vs new) for review.
 */
import os from 'os';
import { appendFile, mkdir, readFile, stat, writeFile } from 'fs/promises';
import path from 'path';
import type { FindShowEvent } from '@/types/find-shows';
import { findShowEvents } from '@/lib/find-shows/catalog';
import { siteKey } from '@/lib/find-shows/floor-plan';
import { BATCH_TIMING_BUDGET, cleanUrl } from '@/lib/find-shows/event-timing-discovery';
import { searchTimingEdition, timingEditionKey } from '@/lib/find-shows/event-timing-resolver';
import {
  clearTimingMemoryCache,
  readTimingRecord,
  timingStoreDir,
  type StoredTimingRecord,
} from '@/lib/find-shows/event-timing-store';

// --- Options ------------------------------------------------------------------

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [name, value] = arg.replace(/^--/, '').split('=');
    return [name, value ?? 'true'] as [string, string];
  })
);
const option = (name: string, fallback: number) => (args.has(name) ? Number(args.get(name)) : fallback);
const BATCH_SIZE = option('batch-size', 25);
const MAX_BATCHES = option('batches', 8);
const CONCURRENCY = option('concurrency', 2);
const SITE_GAP_MS = option('site-gap-ms', 1_500);
const MIN_FREE_MB = option('min-free-mb', 1024);
const MAX_RSS_MB = option('max-rss-mb', 450);
const RETRY_FETCH_ERRORS = args.has('retry-fetch-errors');
const RESCAN = args.has('rescan');
const SINCE_ARG = args.get('since') ?? null;
// --match-evidence=<regex>: with --rescan, only re-check verified records whose evidence matches (a targeted follow-up).
const MATCH_EVIDENCE = args.has('match-evidence') ? new RegExp(args.get('match-evidence')!) : null;
const RECHECK_CSV = path.join(process.cwd(), 'reports', 'event-timings', 'recheck.csv');

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
let peakRss = 0;
const sampleMemory = () => {
  const rss = process.memoryUsage().rss;
  if (rss > peakRss) peakRss = rss;
  return { rssMb: mb(rss), heapMb: mb(process.memoryUsage().heapUsed), freeMb: mb(os.freemem()) };
};

// --- State --------------------------------------------------------------------

type RecheckState = { since: string; pending: string[]; builtAt: string };
const stateFile = () => path.join(path.dirname(timingStoreDir()), 'recheck-run.json');

async function readState(): Promise<RecheckState | null> {
  try {
    return JSON.parse(await readFile(stateFile(), 'utf8')) as RecheckState;
  } catch {
    return null;
  }
}

const writeState = (state: RecheckState) => writeFile(stateFile(), JSON.stringify(state));

/** Catalog editions as key → representative event (same grouping as the catalog run). */
function editionEvents(): Map<string, FindShowEvent> {
  const byKey = new Map<string, FindShowEvent>();
  for (const event of findShowEvents) {
    const key = timingEditionKey(event);
    if (!byKey.has(key)) byKey.set(key, event);
  }
  return byKey;
}

const lastAttemptOf = (record: StoredTimingRecord) => record.lastAttemptAt ?? record.checkedAt;

/** Whether a stored record still needs this re-check. */
function needsRecheck(record: StoredTimingRecord | null, since: string): boolean {
  if (!record || record.status !== 'VERIFIED_TIME') return false;
  const judgedSince = lastAttemptOf(record) >= since;
  if (RETRY_FETCH_ERRORS) return judgedSince && record.lastAttemptStatus === 'FETCH_ERROR';
  return !judgedSince;
}

// --- Verdict log ----------------------------------------------------------------

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const CSV_COLUMNS = ['checkedAt', 'verdict', 'slug', 'event', 'startDate', 'endDate', 'oldStart', 'oldEnd', 'oldEvidence', 'newStatus', 'newStart', 'newEnd', 'newSource', 'newEvidence', 'editionKey'];

async function appendVerdict(row: Record<string, unknown>) {
  await mkdir(path.dirname(RECHECK_CSV), { recursive: true });
  const exists = await stat(RECHECK_CSV).then(() => true, () => false);
  const line = CSV_COLUMNS.map((column) => csvCell(row[column])).join(',');
  await appendFile(RECHECK_CSV, `${exists ? '' : `${CSV_COLUMNS.join(',')}\n`}${line}\n`);
}

// --- Batches ------------------------------------------------------------------

type Verdict = 'KEPT' | 'CHANGED' | 'REMOVED' | 'FETCH_ERROR_KEPT' | 'SKIPPED';

async function judge(key: string, event: FindShowEvent, since: string): Promise<Verdict> {
  const before = await readTimingRecord(key);
  if (!needsRecheck(before, since)) return 'SKIPPED';
  const after = await searchTimingEdition(event, null, { budget: BATCH_TIMING_BUDGET, revalidate: true });
  const verdict: Verdict =
    after.lastAttemptStatus === 'FETCH_ERROR'
      ? 'FETCH_ERROR_KEPT'
      : after.status !== 'VERIFIED_TIME'
        ? 'REMOVED'
        : after.formattedStartTime === before!.formattedStartTime && after.formattedEndTime === before!.formattedEndTime
          ? 'KEPT'
          : 'CHANGED';
  // The attempt's own evidence (a kept verified record still carries the old evidence).
  const attemptEvidence = verdict === 'FETCH_ERROR_KEPT' ? 'fetch failed — verified time kept' : after.evidence;
  await appendVerdict({
    checkedAt: after.lastAttemptAt,
    verdict,
    slug: event.slug,
    event: event.name,
    startDate: event.startDate,
    endDate: event.endDate,
    oldStart: before!.formattedStartTime,
    oldEnd: before!.formattedEndTime,
    oldEvidence: before!.evidence,
    newStatus: after.lastAttemptStatus,
    newStart: after.status === 'VERIFIED_TIME' ? after.formattedStartTime : '',
    newEnd: after.status === 'VERIFIED_TIME' ? after.formattedEndTime : '',
    newSource: after.sourceUrl,
    newEvidence: attemptEvidence,
    editionKey: key,
  });
  console.log(
    `  ${verdict.padEnd(16)} ${event.slug.slice(0, 55)} — ${before!.formattedStartTime ?? '—'}→${before!.formattedEndTime ?? '—'}` +
      (verdict === 'CHANGED' ? ` now ${after.formattedStartTime ?? '—'}→${after.formattedEndTime ?? '—'}` : '') +
      (verdict === 'REMOVED' ? ` (${(after.evidence ?? '').slice(0, 70)})` : '')
  );
  return verdict;
}

async function runBatch(keys: string[], events: Map<string, FindShowEvent>, since: string, tally: Record<Verdict, number>, stopping: () => boolean) {
  const queue = keys.map((key) => {
    const event = events.get(key)!;
    const website = cleanUrl(event.website);
    return { key, event, site: website ? siteKey(website) : `none:${key}` };
  });
  const busy = new Set<string>();
  const freeAt = new Map<string, number>();

  const worker = async () => {
    while (!stopping()) {
      const now = Date.now();
      const index = queue.findIndex((item) => !busy.has(item.site) && (freeAt.get(item.site) ?? 0) <= now);
      if (index === -1) {
        if (!queue.length) return;
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      const item = queue.splice(index, 1)[0];
      busy.add(item.site);
      try {
        tally[await judge(item.key, item.event, since)]++;
      } catch (error) {
        // Not judged: stays pending for the next invocation.
        console.log(`  ERROR            ${item.event.slug}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        busy.delete(item.site);
        freeAt.set(item.site, Date.now() + SITE_GAP_MS);
        sampleMemory();
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

/** Waits (up to 2 min) for memory to be back within bounds; false when it is not. */
async function memoryOk(): Promise<boolean> {
  for (let waited = 0; ; waited += 15_000) {
    const { rssMb, freeMb } = sampleMemory();
    if (freeMb >= MIN_FREE_MB && rssMb <= MAX_RSS_MB) return true;
    if (waited >= 120_000) {
      console.log(`Memory still out of bounds (free ${freeMb} MB < ${MIN_FREE_MB} or RSS ${rssMb} MB > ${MAX_RSS_MB}) — stopping cleanly; re-run later to resume.`);
      return false;
    }
    console.log(`Low memory (free ${freeMb} MB, RSS ${rssMb} MB) — pausing 15 s…`);
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
}

// --- Main ---------------------------------------------------------------------

async function main() {
  const startMem = sampleMemory();
  const events = editionEvents();
  let state = await readState();

  if (!state || RESCAN) {
    // An explicit --since starts a fresh re-check (e.g. after the rules change); otherwise keep the run's own.
    const since = SINCE_ARG ?? state?.since;
    if (!since || Number.isNaN(Date.parse(since))) throw new Error('First run needs --since=<ISO time> (when this re-check began).');
    // Read cache files one at a time; keep only the keys that need a re-check.
    const pending: string[] = [];
    let read = 0;
    for (const key of Array.from(events.keys())) {
      const record = await readTimingRecord(key);
      if (needsRecheck(record, since) && (!MATCH_EVIDENCE || MATCH_EVIDENCE.test(record?.evidence ?? ''))) pending.push(key);
      if (++read % 500 === 0) clearTimingMemoryCache();
    }
    clearTimingMemoryCache();
    state = { since: new Date(since).toISOString(), pending, builtAt: new Date().toISOString() };
    await writeState(state);
    console.log(`Built pending list: ${pending.length} editions need a re-check (verdicts since ${state.since} count as done).`);
  }

  // The retry pass works on its own list: verified editions whose re-check fetch failed.
  let pending = state.pending;
  if (RETRY_FETCH_ERRORS) {
    pending = [];
    for (const key of Array.from(events.keys())) if (needsRecheck(await readTimingRecord(key), state.since)) pending.push(key);
    clearTimingMemoryCache();
  }

  const batches = Math.ceil(pending.length / BATCH_SIZE);
  console.log(
    `Re-check${RETRY_FETCH_ERRORS ? ' (fetch-error retry)' : ''}: ${pending.length} editions pending → ${batches} batches of ${BATCH_SIZE}; ` +
      `this invocation runs up to ${MAX_BATCHES}. Concurrency ${CONCURRENCY}, one edition per site. ` +
      `Memory at start: RSS ${startMem.rssMb} MB, free RAM ${startMem.freeMb} MB.`
  );

  const tally: Record<Verdict, number> = { KEPT: 0, CHANGED: 0, REMOVED: 0, FETCH_ERROR_KEPT: 0, SKIPPED: 0 };
  let stopping = false;
  process.once('SIGINT', () => {
    console.log('\nStopping after the editions in progress… (re-run to resume)');
    stopping = true;
  });

  let batchesRun = 0;
  for (let offset = 0; offset < pending.length && batchesRun < MAX_BATCHES && !stopping; offset += BATCH_SIZE) {
    if (!(await memoryOk())) break;
    const batch = pending.slice(offset, offset + BATCH_SIZE);
    batchesRun++;
    const started = Date.now();
    console.log(`\nBatch ${batchesRun} (${batch.length} editions):`);
    await runBatch(batch, events, state.since, tally, () => stopping);
    clearTimingMemoryCache();
    (globalThis as { gc?: () => void }).gc?.();
    const mem = sampleMemory();
    console.log(`Batch ${batchesRun} done in ${((Date.now() - started) / 1000).toFixed(0)} s · RSS ${mem.rssMb} MB, heap ${mem.heapMb} MB, free RAM ${mem.freeMb} MB`);
  }

  // Drop finished editions from the pending list (anything judged since `since`, except fetch errors).
  if (!RETRY_FETCH_ERRORS) {
    const remaining: string[] = [];
    for (const key of state.pending) if (needsRecheck(await readTimingRecord(key), state.since)) remaining.push(key);
    clearTimingMemoryCache();
    state.pending = remaining;
    await writeState(state);
  }

  const end = sampleMemory();
  console.log(
    `\nSummary: processed ${tally.KEPT + tally.CHANGED + tally.REMOVED + tally.FETCH_ERROR_KEPT} · kept ${tally.KEPT} · changed ${tally.CHANGED} · ` +
      `removed ${tally.REMOVED} · fetch errors (kept) ${tally.FETCH_ERROR_KEPT} · skipped ${tally.SKIPPED}\n` +
      `Memory: peak RSS ${mb(peakRss)} MB, end RSS ${end.rssMb} MB, free RAM ${end.freeMb} MB\n` +
      `Pending after this invocation: ${RETRY_FETCH_ERRORS ? 'n/a (retry pass)' : `${state.pending.length} editions (${Math.ceil(state.pending.length / BATCH_SIZE)} batches)`}\n` +
      `Verdicts: ${path.relative(process.cwd(), RECHECK_CSV)}`
  );
}

// Node's built-in fetch (undici) can throw an internal assertion from a socket callback when a
// site closes a TLS connection mid-response; the request it belonged to times out on its own.
process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
  if (error?.code === 'ERR_ASSERTION' && /undici/.test(error.stack ?? '')) {
    console.log(`[warn] ignored an internal fetch (undici) assertion from a closed socket`);
    return;
  }
  console.error(error);
  process.exit(1);
});

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
