/**
 * Catalog-wide exhibitor discovery: searches every edition in the Find Shows
 * catalog for its official exhibitor directory and stores the outcome in the
 * same edition store the Exhibitors tab reads (lib/find-shows/exhibitor-resolver.ts),
 * so opening the tab afterwards shows the precomputed answer.
 *
 *   npm run exhibitors:discover                  # everything not yet settled, then retries
 *   npm run exhibitors:discover -- --limit=500   # the first 500 unsettled editions
 *   npm run exhibitors:discover -- --report      # only rebuild the report from stored results
 *
 * Options: --concurrency=8 (editions at once; never two on one official site),
 * --limit=N, --slug=a,b (just these events), --refresh (search settled editions
 * again), --since=ISO (re-search results stored before this time; defaults to
 * the first run's start, so results from older adapter versions are refreshed
 * once), --max-attempts=3 (per edition, for temporary failures),
 * --site-gap-ms=2000 (pause between editions on one site), --host-gap-ms=400
 * and --host-concurrency=2 (per host, across all editions: shared platforms —
 * Algolia, Map Your Show, reg.iteca.kz … — are asked politely), --edition-timeout-ms=600000.
 *
 * - One search per edition: catalog records listing the same show on the same
 *   site section, city and dates share it (editionKey).
 * - A verified list is never replaced by a failed refresh (mergeAttempt).
 * - Temporary failures (network, download, rate limit, timeout) stay retryable
 *   and are retried in later passes, up to --max-attempts. A site behind a bot
 *   wall is retried once at most: it is not hammered.
 * - A host answering HTTP 429 cools down (doubling, up to 15 minutes); editions
 *   needing it meanwhile end RATE_LIMITED and are retried later, while the
 *   batch carries on with other sites.
 * - DNS down (network lost): every worker pauses until it is back.
 * - Resumable: each edition is stored as soon as it is searched; progress
 *   (attempt counts) is kept in reports/exhibitors/state.json. Ctrl+C stops
 *   after the editions in progress.
 * - Node's bundled undici can throw `assert(!this.paused)` from a TLS socket's
 *   'end' event — outside any fetch promise, so it would kill the run. That one
 *   assertion is logged and ignored (the request's own timeout ends it); any
 *   other uncaught error saves the progress state and exits. Batch GETs send
 *   `Connection: close`, which keeps sockets off the reuse path that trips it.
 *
 * Output (reports/exhibitors/): summary.json, summary.md, and a row per catalog
 * event in exhibitors.csv / exhibitors.jsonl.
 */
import { Resolver } from 'dns/promises';
import { mkdirSync, renameSync, writeFileSync } from 'fs';
import { mkdir, readdir, readFile, writeFile, rename } from 'fs/promises';
import path from 'path';
import { gunzipSync } from 'zlib';
import type { FindShowEvent } from '@/types/find-shows';
import { findShowEvents } from '@/lib/find-shows/catalog';
import { siteKey, websiteDomain } from '@/lib/find-shows/floor-plan';
import { httpFetcher, type Fetcher } from '@/lib/find-shows/floor-plan-discovery';
import { editionKey } from '@/lib/find-shows/floor-plan-resolver';
import { httpPoster, type Poster } from '@/lib/find-shows/exhibitor-adapters/http';
import { effectiveDirectory, exhibitorStoreDir, readExhibitorRecord, searchEditionExhibitors, type ExhibitorRecord } from '@/lib/find-shows/exhibitor-resolver';
import type { ExhibitorDirectory } from '@/lib/find-shows/exhibitors';

// --- Options ------------------------------------------------------------------

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [name, ...value] = arg.replace(/^--/, '').split('=');
    return [name, value.length ? value.join('=') : 'true'] as [string, string];
  })
);
const option = (name: string, fallback: number) => (args.has(name) ? Number(args.get(name)) : fallback);
const CONCURRENCY = option('concurrency', 8);
const LIMIT = option('limit', Infinity);
const MAX_ATTEMPTS = option('max-attempts', 3);
const SITE_GAP_MS = option('site-gap-ms', 2_000);
const HOST_GAP_MS = option('host-gap-ms', 400);
const HOST_CONCURRENCY = option('host-concurrency', 2);
const EDITION_TIMEOUT_MS = option('edition-timeout-ms', 600_000);
const REFRESH = args.has('refresh');
const REPORT_ONLY = args.has('report');
const SLUGS = args.get('slug')?.split(',').filter(Boolean) ?? null;
const REPORT_DIR = path.join(process.cwd(), 'reports', 'exhibitors');
const STATE_FILE = path.join(REPORT_DIR, 'state.json');

// --- Outcome categories ---------------------------------------------------------

/** The report's categories: the store's statuses, with partial lists and the kinds of unfinished search told apart. */
const CATEGORIES = [
  'VERIFIED_LIST',
  'PARTIAL',
  'LOGIN_REQUIRED_DIRECTORY',
  'VERIFIED_EMPTY_DIRECTORY',
  'OFFICIAL_DIRECTORY_LINK',
  'NO_VERIFIED_DIRECTORY',
  'DISCOVERY_INCOMPLETE',
  'NETWORK_ERROR',
  'DOWNLOAD_FAILED',
  'BLOCKED',
  'RATE_LIMITED',
] as const;
type Category = (typeof CATEGORIES)[number];
const RETRYABLE: Category[] = ['DISCOVERY_INCOMPLETE', 'NETWORK_ERROR', 'DOWNLOAD_FAILED', 'BLOCKED', 'RATE_LIMITED'];

function category(directory: ExhibitorDirectory): Category {
  if (directory.status === 'VERIFIED_LIST') {
    const partial = directory.partial || (directory.total ?? 0) > directory.exhibitors.length;
    return partial ? 'PARTIAL' : 'VERIFIED_LIST';
  }
  if (directory.status === 'DISCOVERY_INCOMPLETE') return directory.failure ?? 'DISCOVERY_INCOMPLETE';
  return directory.status;
}

// --- Editions -----------------------------------------------------------------

type Edition = { key: string; site: string; event: FindShowEvent; events: FindShowEvent[] };

/** The catalog grouped into editions: records listing the same show once. */
function catalogEditions(): Edition[] {
  const byKey = new Map<string, Edition>();
  for (const event of findShowEvents) {
    const key = editionKey(event);
    const existing = byKey.get(key);
    if (existing) existing.events.push(event);
    else {
      const domain = websiteDomain(event.website);
      byKey.set(key, { key, site: domain ? siteKey(domain) : `none:${key}`, event, events: [event] });
    }
  }
  return Array.from(byKey.values());
}

// --- Progress state (attempt counts) ------------------------------------------------

type EditionState = { attempts: number; blocked: number; lastFailure?: string; lastAttemptAt?: string };
type State = { startedAt: string; editions: Record<string, EditionState> };

async function loadState(): Promise<State> {
  try {
    return JSON.parse(await readFile(STATE_FILE, 'utf8')) as State;
  } catch {
    return { startedAt: new Date().toISOString(), editions: {} };
  }
}

/** The state being run, for the crash guard's last save. */
let liveState: State | null = null;

/** For the crash path, where nothing async runs any more. */
function saveStateSync(state: State) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const temp = `${STATE_FILE}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(state));
  renameSync(temp, STATE_FILE);
}

async function saveState(state: State) {
  await mkdir(REPORT_DIR, { recursive: true });
  const temp = `${STATE_FILE}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(state));
  await rename(temp, STATE_FILE);
}

/** Whether an edition still needs a search. */
function needsSearch(record: ExhibitorRecord | null, since: string, progress: EditionState | undefined) {
  if (!record || REFRESH) return true;
  // Results stored before this run series began came from older adapters: search those once more.
  if (record.lastAttempt.checkedAt < since) return true;
  const settled = category(effectiveDirectory(record));
  if (!RETRYABLE.includes(settled)) return false;
  // A temporary failure: retry, but not forever, and a site behind a bot wall only once more.
  if ((progress?.attempts ?? 0) >= MAX_ATTEMPTS) return false;
  if (settled === 'BLOCKED' && (progress?.blocked ?? 0) >= 2) return false;
  return true;
}

// --- Polite networking ------------------------------------------------------------

type HostState = { active: number; nextAt: number; coolUntil: number; strikes: number };
const hosts = new Map<string, HostState>();
const hostOf = (url: string) => {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return url;
  }
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A slot on a host: at most HOST_CONCURRENCY requests at once, HOST_GAP_MS apart. A host cooling down after a 429 is not waited for long. */
async function acquire(host: string) {
  const state = hosts.get(host) ?? { active: 0, nextAt: 0, coolUntil: 0, strikes: 0 };
  hosts.set(host, state);
  for (;;) {
    const now = Date.now();
    if (state.coolUntil > now + 20_000) throw new Error(`HTTP 429 from ${host} (rate limited; cooling down)`);
    if (state.active < HOST_CONCURRENCY && state.nextAt <= now && state.coolUntil <= now) {
      state.active++;
      state.nextAt = now + HOST_GAP_MS;
      return state;
    }
    await sleep(Math.max(100, Math.min(Math.max(state.nextAt, state.coolUntil) - now, 2_000)));
  }
}

function noteStatus(host: string, state: HostState, status: number) {
  if (status === 429) {
    state.strikes++;
    const pause = Math.min(60_000 * 2 ** (state.strikes - 1), 15 * 60_000);
    state.coolUntil = Date.now() + pause;
    console.log(`  · ${host} answered 429 — cooling down ${Math.round(pause / 1000)} s`);
  } else if (status < 400 && state.strikes) {
    state.strikes--;
  }
}

const politeFetcher: Fetcher = async (url, options) => {
  const host = hostOf(url);
  const state = await acquire(host);
  try {
    const response = await httpFetcher(url, { ...options, headers: { ...options.headers, Connection: 'close' } });
    noteStatus(host, state, response.status);
    return response;
  } finally {
    state.active--;
  }
};

const politePoster: Poster = async (url, form, options) => {
  const host = hostOf(url);
  const state = await acquire(host);
  try {
    const response = await httpPoster(url, form, options);
    noteStatus(host, state, response.status);
    return response;
  } finally {
    state.active--;
  }
};

// --- Connectivity ---------------------------------------------------------------

/** Whether this machine can resolve names at all (live DNS queries for always-up hosts). */
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
    while (!(await online())) await sleep(15_000);
    console.log(`[${label}] network back after ${Math.round((Date.now() - since) / 1000)} s — resuming.`);
  })().finally(() => {
    networkWait = null;
  });
  return networkWait;
}
const OUTAGE = /ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ENETDOWN/;

// --- The run ------------------------------------------------------------------

type Tally = Record<Category, number>;
const emptyTally = (): Tally => Object.fromEntries(CATEGORIES.map((item) => [item, 0])) as Tally;
const TIMED_OUT: unique symbol = Symbol('timed out');

async function runPass(label: string, editions: Edition[], state: State, concurrency: number) {
  const tally = emptyTally();
  if (!editions.length) return tally;
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
  process.once('SIGTERM', stop);

  const next = () => {
    const now = Date.now();
    const index = queue.findIndex((edition) => !busySites.has(edition.site) && (siteFreeAt.get(edition.site) ?? 0) <= now);
    return index === -1 ? null : queue.splice(index, 1)[0];
  };

  const worker = async () => {
    while (!stopping) {
      if (networkWait) await networkWait;
      const edition = next();
      if (!edition) {
        if (!queue.length) return;
        await sleep(250);
        continue;
      }
      busySites.add(edition.site);
      const progress = (state.editions[edition.key] ??= { attempts: 0, blocked: 0 });
      try {
        const slugs = edition.events.map((event) => event.slug);
        const searchPromise = searchEditionExhibitors(edition.event, slugs, { fetcher: politeFetcher, poster: politePoster, retryDelayMs: 3_000 });
        searchPromise.catch(() => undefined);
        let timer: NodeJS.Timeout | undefined;
        const outcome = await Promise.race([
          searchPromise,
          new Promise<typeof TIMED_OUT>((resolve) => {
            timer = setTimeout(() => resolve(TIMED_OUT), EDITION_TIMEOUT_MS);
          }),
        ]).finally(() => clearTimeout(timer));
        let result: Category;
        let reason: string;
        let count = 0;
        if (outcome === TIMED_OUT) {
          result = 'DISCOVERY_INCOMPLETE';
          reason = `the search took longer than ${EDITION_TIMEOUT_MS / 60_000} min`;
        } else {
          const attempt = outcome.lastAttempt;
          result = category(attempt.status === 'VERIFIED_LIST' && outcome.verified ? outcome.verified : attempt);
          reason = attempt.reason;
          count = outcome.verified && attempt.status === 'VERIFIED_LIST' ? outcome.verified.exhibitors.length : 0;
          // The network went down mid-search: that says nothing about the event. Wait, then search it again.
          if (result === 'NETWORK_ERROR' && OUTAGE.test(reason) && !(await online())) {
            queue.unshift(edition);
            await waitForNetwork(label);
            continue;
          }
        }
        progress.lastAttemptAt = new Date().toISOString();
        if (RETRYABLE.includes(result)) {
          progress.attempts++;
          progress.lastFailure = `${result}: ${reason}`.slice(0, 300);
          if (result === 'BLOCKED') progress.blocked++;
        } else {
          delete progress.lastFailure;
        }
        tally[result]++;
        done++;
        const rate = done / Math.max((Date.now() - started) / 60_000, 0.01);
        const eta = Math.round((queue.length + busySites.size - 1) / Math.max(rate, 0.01));
        console.log(
          `[${label}] ${done}/${editions.length} ${result.padEnd(24)} ${String(count).padStart(5)}  ${edition.event.slug.slice(0, 60)} — ${reason.slice(0, 100)}` +
            (done % 25 === 0 ? `\n[${label}] ${rate.toFixed(1)} editions/min, ~${eta} min left · ${CATEGORIES.filter((c) => tally[c]).map((c) => `${c} ${tally[c]}`).join(' · ')}` : '')
        );
        if (done % 5 === 0) await saveState(state);
      } catch (error) {
        progress.attempts++;
        progress.lastFailure = `ERROR: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300);
        tally.DISCOVERY_INCOMPLETE++;
        done++;
        console.log(`[${label}] ${done}/${editions.length} ERROR ${edition.event.slug}: ${progress.lastFailure}`);
      } finally {
        busySites.delete(edition.site);
        siteFreeAt.set(edition.site, Date.now() + SITE_GAP_MS);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
  await saveState(state);
  console.log(`[${label}] ${done} editions in ${((Date.now() - started) / 60_000).toFixed(1)} min · ${CATEGORIES.filter((c) => tally[c]).map((c) => `${c} ${tally[c]}`).join(' · ')}`);
  if (stopping) {
    process.exitCode = 130;
    throw new Error('stopped');
  }
  return tally;
}

// --- Report -------------------------------------------------------------------

async function readAllRecords(): Promise<ExhibitorRecord[]> {
  const dir = exhibitorStoreDir();
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((file) => file.endsWith('.json.gz'));
  } catch {
    return [];
  }
  const records: ExhibitorRecord[] = [];
  for (const file of files) {
    try {
      records.push(JSON.parse(gunzipSync(await readFile(path.join(dir, file))).toString('utf8')) as ExhibitorRecord);
    } catch {
      // A file being written right now; the next report includes it.
    }
  }
  return records;
}

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

async function writeReport(editions: Edition[], state: State) {
  const records = new Map((await readAllRecords()).map((record) => [record.key, record]));
  const rows: Record<string, unknown>[] = [];
  const editionTally = emptyTally();
  const eventTally = emptyTally();
  const platforms: Record<string, { editions: number; events: number; exhibitors: number }> = {};
  let editionsChecked = 0;
  let eventsChecked = 0;
  let exhibitors = 0;
  let eventsWithCards = 0;
  let needRetry = 0;
  for (const edition of editions) {
    const record = records.get(edition.key) ?? null;
    const answer = record ? effectiveDirectory(record) : null;
    const result: Category | 'NOT_CHECKED' = answer ? category(answer) : 'NOT_CHECKED';
    const count = answer?.status === 'VERIFIED_LIST' ? answer.exhibitors.length : 0;
    const progress = state.editions[edition.key];
    if (answer && result !== 'NOT_CHECKED') {
      editionsChecked++;
      editionTally[result]++;
      exhibitors += count;
      if (RETRYABLE.includes(result) && (progress?.attempts ?? 0) < MAX_ATTEMPTS) needRetry++;
      if (count && answer.source) {
        const platform = (platforms[answer.source.platform] ??= { editions: 0, events: 0, exhibitors: 0 });
        platform.editions++;
        platform.events += edition.events.length;
        platform.exhibitors += count;
      }
    }
    for (const event of edition.events) {
      if (answer && result !== 'NOT_CHECKED') {
        eventsChecked++;
        eventTally[result]++;
        if (count) eventsWithCards++;
      }
      rows.push({
        slug: event.slug,
        event: event.name,
        startDate: event.startDate,
        city: event.city,
        country: event.country,
        organizer: event.organizer,
        officialUrl: event.website,
        editionKey: edition.key,
        status: result,
        platform: answer?.source?.platform ?? '',
        editionLabel: answer?.source?.editionLabel ?? '',
        directoryUrl: answer?.source?.directoryUrl ?? '',
        exhibitors: count,
        statedTotal: answer?.total ?? '',
        partial: answer ? Boolean(answer.partial || (answer.total ?? 0) > count) : '',
        lastAttemptStatus: record ? category(record.lastAttempt) : '',
        lastAttemptAt: record?.lastAttempt.checkedAt ?? '',
        retryable: RETRYABLE.includes(result as Category),
        reason: answer?.reason ?? 'not searched yet',
        attempts: progress?.attempts ?? 0,
      });
    }
  }
  const summary = {
    generatedAt: new Date().toISOString(),
    totalEvents: findShowEvents.length,
    totalEditions: editions.length,
    editionsChecked,
    eventsChecked,
    editions: editionTally,
    events: eventTally,
    exhibitorsDiscovered: exhibitors,
    eventsWithExhibitorCards: eventsWithCards,
    editionsNeedingRetry: needRetry,
    platforms,
  };
  await mkdir(REPORT_DIR, { recursive: true });
  const columns = Object.keys(rows[0] ?? {});
  await writeFile(path.join(REPORT_DIR, 'exhibitors.csv'), [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n'));
  await writeFile(path.join(REPORT_DIR, 'exhibitors.jsonl'), rows.map((row) => JSON.stringify(row)).join('\n'));
  await writeFile(path.join(REPORT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  const lines = [
    `# Exhibitor discovery — ${summary.generatedAt}`,
    '',
    `Unique editions: ${editions.length} (checked ${editionsChecked}) · catalog events: ${summary.totalEvents} (covered ${eventsChecked})`,
    `Exhibitors discovered: ${exhibitors} · catalog events with exhibitor cards: ${eventsWithCards} · editions still to retry: ${needRetry}`,
    '',
    '| Status | Editions | Catalog events |',
    '|---|---|---|',
    ...CATEGORIES.map((item) => `| ${item} | ${editionTally[item]} | ${eventTally[item]} |`),
    '',
    '| Platform | Editions with cards | Catalog events | Exhibitors |',
    '|---|---|---|---|',
    ...Object.entries(platforms)
      .sort((a, b) => b[1].exhibitors - a[1].exhibitors)
      .map(([platform, item]) => `| ${platform} | ${item.editions} | ${item.events} | ${item.exhibitors} |`),
  ];
  await writeFile(path.join(REPORT_DIR, 'summary.md'), lines.join('\n'));
  console.log(lines.join('\n'));
}

// --- Main -----------------------------------------------------------------------

async function main() {
  const all = catalogEditions();
  const state = await loadState();
  liveState = state;
  await saveState(state);
  if (REPORT_ONLY) return writeReport(all, state);
  const since = args.get('since') ?? state.startedAt;
  const scope = SLUGS ? all.filter((edition) => edition.events.some((event) => SLUGS.includes(event.slug))) : all;
  console.log(`${all.length} editions (${findShowEvents.length} catalog events); re-searching results stored before ${since}.`);

  const pending = async () => {
    const out: Edition[] = [];
    for (const edition of scope) if (needsSearch(await readExhibitorRecord(edition.key), since, state.editions[edition.key])) out.push(edition);
    return out;
  };

  try {
    const first = (await pending()).slice(0, LIMIT);
    console.log(`Pass 1: ${first.length} editions to search.`);
    await runPass('pass 1', first, state, CONCURRENCY);
    // Temporary failures again, more gently, after a pause (rate limits and flaky sites recover).
    for (let pass = 2; pass <= MAX_ATTEMPTS + 1; pass++) {
      const retry = (await pending()).filter((edition) => (state.editions[edition.key]?.attempts ?? 0) > 0).slice(0, LIMIT);
      if (!retry.length) break;
      console.log(`Pass ${pass}: ${retry.length} temporary failures to retry, after a pause.`);
      await sleep(120_000);
      await runPass(`pass ${pass}`, retry, state, Math.max(2, Math.floor(CONCURRENCY / 2)));
    }
  } finally {
    await writeReport(all, state);
  }
}

// --- Crash guard ------------------------------------------------------------------

/** undici's `assert(!this.paused)` in Parser.finish, thrown from a socket 'end' event rather than any fetch. */
const isUndiciParserAssertion = (error: unknown) =>
  error instanceof Error && (error as { code?: string }).code === 'ERR_ASSERTION' && /undici/.test(error.stack ?? '');

let undiciAssertions = 0;
process.on('uncaughtException', (error) => {
  if (isUndiciParserAssertion(error)) {
    undiciAssertions++;
    console.log(`  · undici parser assertion on a closing socket (#${undiciAssertions}) — ignored; that request's timeout ends it`);
    return;
  }
  console.error(error);
  try {
    if (liveState) saveStateSync(liveState);
  } catch (saveError) {
    console.error('could not save the progress state:', saveError);
  }
  process.exit(1);
});

main()
  .catch((error) => {
    if ((error as Error).message !== 'stopped') console.error(error);
    process.exitCode = process.exitCode || 1;
  })
  // Searches abandoned after the edition timeout may still hold sockets open: the run is over, so end it.
  .finally(() => setTimeout(() => process.exit(), 1_000));
