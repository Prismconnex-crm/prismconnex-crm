/**
 * Catalog-wide event-timing enrichment: searches every event edition in the Find
 * Shows catalog for verified official start/end clock times and stores the
 * outcome in the edition store the event page reads
 * (lib/find-shows/event-timing-store.ts), so pages show the precomputed answer.
 * Same architecture as scripts/floor-plans/discover-catalog.ts.
 *
 *   npm run event-timings:discover                  # run (or resume) over every edition
 *   npm run event-timings:discover -- --upcoming    # only editions that have not ended yet
 *   npm run event-timings:discover -- --limit=500   # at most 500 editions this invocation
 *   npm run event-timings:discover -- --report      # only rebuild the report from stored results
 *
 * Options: --concurrency=12 (editions at once; never two on one site),
 * --site-gap-ms=1500 (pause between editions on the same site), --limit=N,
 * --upcoming, --slug=a,b (just these events, outside the run bookkeeping),
 * --refresh (also search editions that already have a verified time — a new
 * verified time replaces the old one, a failure never does), --new-run (start
 * a new run instead of resuming an unfinished one), --report,
 * --recheck-verified (re-judge every edition with a verified time under the current
 * rules: a search that reads the site and no longer verifies it replaces it; a fetch
 * failure keeps it — use after the parsing rules change).
 *
 * Runs and resume (state in <store>/../batch-run.json):
 * - A run re-checks every edition whose stored result is UNAVAILABLE or
 *   FETCH_ERROR (and searches never-checked ones); verified editions are kept.
 * - Each result is written as soon as it is known. If the command stops, the
 *   next invocation resumes the unfinished run: editions already attempted since
 *   the run started are skipped. After a run completes, the next one starts fresh.
 * - FETCH_ERROR editions get a second pass with a larger budget in the same run.
 * - When DNS stops resolving (network down) the run pauses instead of marking
 *   editions as failed.
 *
 * Output (reports/event-timings/): summary.json, summary.md, and a row per
 * catalog event in event-timings.csv / event-timings.jsonl, with an outcome of
 * VERIFIED_TIME | NO_TIME_PUBLISHED | NO_OFFICIAL_WEBSITE | FETCH_ERROR | NOT_CHECKED.
 * The report is also refreshed every 500 editions during a run.
 */
import { Resolver } from 'dns/promises';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { EventTimingStatus, FindShowEvent } from '@/types/find-shows';
import { findShowEvents } from '@/lib/find-shows/catalog';
import { siteKey } from '@/lib/find-shows/floor-plan';
import { BATCH_TIMING_BUDGET, cleanUrl, type TimingBudget } from '@/lib/find-shows/event-timing-discovery';
import { searchTimingEdition, timingEditionKey } from '@/lib/find-shows/event-timing-resolver';
import {
  readAllTimingRecords,
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
const CONCURRENCY = option('concurrency', 12);
const LIMIT = option('limit', Infinity);
const SITE_GAP_MS = option('site-gap-ms', 1_500);
const REFRESH = args.has('refresh');
const NEW_RUN = args.has('new-run');
const UPCOMING = args.has('upcoming');
const REPORT_ONLY = args.has('report');
const RECHECK_VERIFIED = args.has('recheck-verified');
const SLUGS = args.get('slug')?.split(',').filter(Boolean) ?? null;
const REPORT_DIR = path.join(process.cwd(), 'reports', 'event-timings');
const REPORT_EVERY = 500;

const STATUSES: EventTimingStatus[] = ['VERIFIED_TIME', 'UNAVAILABLE', 'FETCH_ERROR', 'VERIFIED_NO_TIME'];
const OUTCOMES = ['VERIFIED_TIME', 'NO_TIME_PUBLISHED', 'NO_OFFICIAL_WEBSITE', 'FETCH_ERROR', 'NOT_CHECKED'] as const;
type Outcome = (typeof OUTCOMES)[number];

// --- Editions -----------------------------------------------------------------

type Edition = { key: string; site: string; event: FindShowEvent; events: FindShowEvent[] };

/** The catalog grouped into editions: records listing the same show once. */
function catalogEditions(): Edition[] {
  const byKey = new Map<string, Edition>();
  for (const event of findShowEvents) {
    const key = timingEditionKey(event);
    const existing = byKey.get(key);
    if (existing) existing.events.push(event);
    else {
      const website = cleanUrl(event.website);
      byKey.set(key, { key, site: website ? siteKey(website) : `none:${key}`, event, events: [event] });
    }
  }
  return Array.from(byKey.values());
}

/** What the stored record means for the report — unavailable kinds kept apart from verified ones. */
function outcomeOf(record: StoredTimingRecord | null): Outcome {
  if (!record) return 'NOT_CHECKED';
  if (record.status === 'VERIFIED_TIME') return 'VERIFIED_TIME';
  if (record.status === 'FETCH_ERROR') return 'FETCH_ERROR';
  return record.sourceUrl ? 'NO_TIME_PUBLISHED' : 'NO_OFFICIAL_WEBSITE';
}

const lastAttemptOf = (record: StoredTimingRecord) => record.lastAttemptAt ?? record.checkedAt;

// --- Run state ------------------------------------------------------------------

type RunState = { startedAt: string; retryStartedAt: string | null; completedAt: string | null; scope: string };
const runStateFile = () => path.join(path.dirname(timingStoreDir()), 'batch-run.json');

async function readRunState(): Promise<RunState | null> {
  try {
    return JSON.parse(await readFile(runStateFile(), 'utf8')) as RunState;
  } catch {
    return null;
  }
}

async function writeRunState(state: RunState) {
  await mkdir(path.dirname(runStateFile()), { recursive: true });
  await writeFile(runStateFile(), JSON.stringify(state, null, 2));
}

// --- Connectivity (as in scripts/floor-plans) --------------------------------------

/** Whether this machine can resolve names at all: when it cannot, a failed fetch says nothing about the event. */
async function online() {
  const resolver = new Resolver({ timeout: 5_000, tries: 1 });
  for (const host of ['www.google.com', 'www.cloudflare.com', 'www.microsoft.com']) {
    try {
      await resolver.resolve4(host);
      return true;
    } catch {
      // Try the next host.
    }
  }
  return false;
}

let networkWait: Promise<void> | null = null;

/** Blocks every worker while DNS is down; one shared probe loop. */
function waitForNetwork(label: string) {
  networkWait ??= (async () => {
    if (await online()) return;
    const since = Date.now();
    console.log(`[${label}] network down (DNS not resolving) — pausing until it is back…`);
    while (!(await online())) await new Promise((resolve) => setTimeout(resolve, 15_000));
    console.log(`[${label}] network back after ${Math.round((Date.now() - since) / 1000)} s — resuming.`);
  })().finally(() => {
    networkWait = null;
  });
  return networkWait;
}

const DNS_FAILURE = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH/;

// --- The run ------------------------------------------------------------------

type Tally = Record<EventTimingStatus, number>;
const emptyTally = (): Tally => Object.fromEntries(STATUSES.map((status) => [status, 0])) as Tally;

async function runPass(
  label: string,
  editions: Edition[],
  budget: TimingBudget,
  onProgress?: (done: number) => void,
  options: { revalidate?: boolean } = {}
) {
  const tally = emptyTally();
  if (!editions.length) return { tally, stopped: false };
  const started = Date.now();
  const busySites = new Set<string>();
  const siteFreeAt = new Map<string, number>();
  const queue = [...editions];
  let done = 0;
  let stopping = false;
  const stop = () => {
    if (!stopping) console.log(`\n[${label}] stopping after the editions in progress… (re-run to resume)`);
    stopping = true;
  };
  process.once('SIGINT', stop);

  /** The next edition whose site is idle and rested (one edition per site at a time). */
  const next = () => {
    const now = Date.now();
    const index = queue.findIndex((edition) => !busySites.has(edition.site) && (siteFreeAt.get(edition.site) ?? 0) <= now);
    return index === -1 ? null : queue.splice(index, 1)[0];
  };

  let dnsStreak = 0;
  const worker = async () => {
    while (!stopping) {
      if (networkWait) await networkWait;
      const edition = next();
      if (!edition) {
        if (!queue.length) return;
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      busySites.add(edition.site);
      try {
        const record = await searchTimingEdition(edition.event, null, { budget, revalidate: options.revalidate });
        const status = record.lastAttemptStatus ?? record.status;
        // A DNS-type failure during an outage says nothing about the event: wait for the network, search it again.
        if (status === 'FETCH_ERROR' && DNS_FAILURE.test(record.evidence ?? '')) {
          dnsStreak++;
          if (dnsStreak >= 5 || !(await online())) {
            queue.unshift(edition);
            await waitForNetwork(label);
            dnsStreak = 0;
            continue;
          }
        } else {
          dnsStreak = 0;
        }
        tally[status]++;
        done++;
        const shown =
          status === 'VERIFIED_TIME'
            ? `${record.formattedStartTime ?? '—'} → ${record.formattedEndTime ?? '—'} (${record.sourceUrl})`
            : status === 'FETCH_ERROR' && record.status === 'VERIFIED_TIME'
              ? `fetch failed, kept verified ${record.formattedStartTime} → ${record.formattedEndTime}`
              : record.evidence ?? '';
        const rate = done / ((Date.now() - started) / 60_000);
        const eta = Math.round((queue.length + busySites.size - 1) / Math.max(rate, 0.01));
        console.log(
          `[${label}] ${done}/${editions.length} ${status.padEnd(14)} ${edition.event.slug.slice(0, 60)} — ${shown.slice(0, 110)}` +
            (done % 25 === 0 ? `\n[${label}] ${rate.toFixed(1)} editions/min, ~${eta} min left · ${STATUSES.map((s) => `${s} ${tally[s]}`).join(' · ')}` : '')
        );
        onProgress?.(done);
      } catch (error) {
        tally.FETCH_ERROR++;
        done++;
        console.log(`[${label}] ${done}/${editions.length} ERROR ${edition.event.slug}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        busySites.delete(edition.site);
        siteFreeAt.set(edition.site, Date.now() + SITE_GAP_MS);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.removeListener('SIGINT', stop);
  console.log(`[${label}] ${done} editions in ${((Date.now() - started) / 60_000).toFixed(1)} min · ${STATUSES.map((s) => `${s} ${tally[s]}`).join(' · ')}`);
  if (stopping) process.exitCode = 130;
  return { tally, stopped: stopping };
}

// --- Report -------------------------------------------------------------------

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const emptyOutcomes = () => Object.fromEntries(OUTCOMES.map((outcome) => [outcome, 0])) as Record<Outcome, number>;

async function writeReport(editions: Edition[], quiet = false) {
  const records = new Map((await readAllTimingRecords()).map((record) => [record.key, record]));
  const rows: Record<string, unknown>[] = [];
  const events = emptyOutcomes();
  const editionOutcomes = emptyOutcomes();
  const byRegion: Record<string, Record<Outcome, number> & { total: number }> = {};

  for (const edition of editions) {
    const record = records.get(edition.key) ?? null;
    const outcome = outcomeOf(record);
    editionOutcomes[outcome]++;
    for (const event of edition.events) {
      const region = (byRegion[event.region] ??= { ...emptyOutcomes(), total: 0 });
      region.total++;
      region[outcome]++;
      events[outcome]++;
      rows.push({
        slug: event.slug,
        event: event.name,
        dates: event.displayDate,
        startDate: event.startDate,
        endDate: event.endDate,
        city: event.city,
        country: event.country,
        region: event.region,
        officialUrl: event.website,
        outcome,
        startTime: record?.formattedStartTime ?? '',
        endTime: record?.formattedEndTime ?? '',
        rawStart: record?.startTime ?? '',
        rawEnd: record?.endTime ?? '',
        timeZone: record?.timeZone ?? '',
        sourceUrl: record?.sourceUrl ?? '',
        evidence: record?.evidence ?? '',
        lastAttemptStatus: record?.lastAttemptStatus ?? '',
        lastAttemptAt: record ? lastAttemptOf(record) : '',
        attempts: record?.attempts ?? 0,
        editionKey: edition.key,
      });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalEvents: findShowEvents.length,
    totalEditions: editions.length,
    events,
    editions: editionOutcomes,
    byRegion,
  };
  await mkdir(REPORT_DIR, { recursive: true });
  const columns = Object.keys(rows[0] ?? {});
  await writeFile(path.join(REPORT_DIR, 'event-timings.csv'), [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n'));
  await writeFile(path.join(REPORT_DIR, 'event-timings.jsonl'), rows.map((row) => JSON.stringify(row)).join('\n'));
  await writeFile(path.join(REPORT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  const lines = [
    `# Event-timing enrichment — ${summary.generatedAt}`,
    '',
    `Total events: ${summary.totalEvents} (${editions.length} editions)`,
    `Verified times: ${events.VERIFIED_TIME} events (${editionOutcomes.VERIFIED_TIME} editions)`,
    `No verified time published: ${events.NO_TIME_PUBLISHED} events (${editionOutcomes.NO_TIME_PUBLISHED} editions)`,
    `No official website: ${events.NO_OFFICIAL_WEBSITE} events (${editionOutcomes.NO_OFFICIAL_WEBSITE} editions)`,
    `Fetch errors (re-checked next run): ${events.FETCH_ERROR} events (${editionOutcomes.FETCH_ERROR} editions)`,
    `Not checked yet: ${events.NOT_CHECKED} events (${editionOutcomes.NOT_CHECKED} editions)`,
    '',
    '| Region | Events | Verified | No time published | No website | Fetch error | Not checked |',
    '|---|---|---|---|---|---|---|',
    ...Object.entries(byRegion).map(
      ([region, tally]) =>
        `| ${region} | ${tally.total} | ${tally.VERIFIED_TIME} | ${tally.NO_TIME_PUBLISHED} | ${tally.NO_OFFICIAL_WEBSITE} | ${tally.FETCH_ERROR} | ${tally.NOT_CHECKED} |`
    ),
  ];
  await writeFile(path.join(REPORT_DIR, 'summary.md'), lines.join('\n'));
  if (!quiet) console.log(`\n${lines.slice(2, 8).join('\n')}\nReport: ${path.relative(process.cwd(), REPORT_DIR)}`);
}

// --- Main ---------------------------------------------------------------------

async function main() {
  const allEditions = catalogEditions();
  let editions = allEditions;
  if (SLUGS) editions = editions.filter((edition) => edition.events.some((event) => SLUGS.includes(event.slug)));
  if (UPCOMING) {
    const today = new Date().toISOString().slice(0, 10);
    editions = editions.filter((edition) => edition.event.endDate >= today);
  }
  console.log(`Catalog: ${findShowEvents.length} events → ${allEditions.length} editions; in scope: ${editions.length}${SLUGS ? ' (selected slugs)' : ''}${UPCOMING ? ' (upcoming)' : ''}`);

  if (REPORT_ONLY) {
    await writeReport(allEditions);
    return;
  }

  if (RECHECK_VERIFIED) {
    const verified: Edition[] = [];
    for (const edition of editions) if ((await readTimingRecord(edition.key))?.status === 'VERIFIED_TIME') verified.push(edition);
    console.log(`Re-judging ${verified.length} editions with a verified time under the current rules.`);
    await runPass('recheck', verified, BATCH_TIMING_BUDGET, undefined, { revalidate: true });
    await writeReport(allEditions);
    return;
  }

  // --slug searches just those editions now, outside the run bookkeeping.
  if (SLUGS) {
    await runPass('slugs', editions, BATCH_TIMING_BUDGET);
    await writeReport(allEditions);
    return;
  }

  const scope = UPCOMING ? 'upcoming' : 'all';
  let state = await readRunState();
  if (!state || state.completedAt || NEW_RUN) {
    state = { startedAt: new Date().toISOString(), retryStartedAt: null, completedAt: null, scope };
    await writeRunState(state);
    console.log(`Starting a new run at ${state.startedAt}.`);
  } else {
    console.log(`Resuming the run started ${state.startedAt} (scope: ${state.scope}; --new-run starts over).`);
  }
  const runStart = state.startedAt;

  // Needs a search in this run: never checked, or not verified and not attempted since the run began.
  const todo: Edition[] = [];
  let verified = 0;
  let alreadyThisRun = 0;
  for (const edition of editions) {
    const record = await readTimingRecord(edition.key);
    if (!record) todo.push(edition);
    else if (lastAttemptOf(record) >= runStart) alreadyThisRun++;
    else if (record.status === 'VERIFIED_TIME' && !REFRESH) verified++;
    else todo.push(edition);
  }
  const selected = todo.slice(0, LIMIT);
  console.log(
    `${verified} editions already verified (kept), ${alreadyThisRun} already searched in this run; searching ${selected.length}` +
      `${selected.length < todo.length ? ` of ${todo.length} (--limit)` : ''}. Concurrency ${CONCURRENCY}, one edition per site at a time.`
  );

  let reporting = false;
  const checkpoint = (done: number) => {
    if (done % REPORT_EVERY !== 0 || reporting) return;
    reporting = true;
    writeReport(allEditions, true)
      .catch(() => undefined)
      .finally(() => {
        reporting = false;
      });
  };

  const pass1 = await runPass('pass 1', selected, BATCH_TIMING_BUDGET, checkpoint);
  if (pass1.stopped || selected.length < todo.length) {
    await writeReport(allEditions);
    console.log(pass1.stopped ? '\nRun interrupted — re-run the same command to resume.' : `\n${todo.length - selected.length} editions left in this run — re-run to continue.`);
    return;
  }

  // Second pass for editions whose official site could not be read, with a larger budget.
  state.retryStartedAt ??= new Date().toISOString();
  await writeRunState(state);
  const retry: Edition[] = [];
  for (const edition of editions) {
    const record = await readTimingRecord(edition.key);
    if (record && record.status === 'FETCH_ERROR' && lastAttemptOf(record) < state.retryStartedAt) retry.push(edition);
  }
  console.log(`\nRetrying ${retry.length} editions whose official site could not be read (larger budget).`);
  const pass2 = await runPass(
    'retry',
    retry,
    { ...BATCH_TIMING_BUDGET, timeMs: BATCH_TIMING_BUDGET.timeMs * 2, requestTimeoutMs: BATCH_TIMING_BUDGET.requestTimeoutMs * 2 },
    checkpoint
  );

  if (!pass2.stopped) {
    state.completedAt = new Date().toISOString();
    await writeRunState(state);
    console.log(`\nRun complete. The next invocation starts a new run that re-checks UNAVAILABLE / FETCH_ERROR editions.`);
  } else {
    console.log('\nRun interrupted during retries — re-run the same command to resume.');
  }
  await writeReport(allEditions);
}

// Node's built-in fetch (undici) can throw an internal assertion from a socket callback when a
// site closes a TLS connection mid-response. It escapes every promise; the request it belonged
// to times out on its own, so log it and keep the run going instead of exiting.
process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
  if (error?.code === 'ERR_ASSERTION' && /undici/.test(error.stack ?? '')) {
    console.log(`[warn] ignored an internal fetch (undici) assertion from a closed socket: ${error.message.split('\n')[0]}`);
    return;
  }
  console.error(error);
  process.exit(1);
});

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
