/**
 * Catalog-wide floor-plan discovery: searches every event edition in the Find
 * Shows catalog for its official floor plan and stores the outcome in the same
 * edition store the Floor Plan tab reads (lib/find-shows/floor-plan-store.ts),
 * so opening the tab afterwards shows the precomputed answer.
 *
 *   npm run floor-plans:discover                 # everything not yet settled, then retries
 *   npm run floor-plans:discover -- --limit=500  # the first 500 unsettled editions
 *   npm run floor-plans:discover -- --report     # only rebuild the report from stored results
 *
 * Options: --concurrency=16 (editions at once; never two on one site),
 * --limit=N, --slug=a,b (just these events), --refresh (search settled
 * editions again), --max-attempts=3 (per edition, for temporary failures),
 * --site-gap-ms=1500 (pause between editions on the same site), --report,
 * --recheck-plans (re-judge editions with a verified plan after the
 * verification rules change: a plan the new search does not confirm is dropped
 * and the edition takes the new status; =unconfirmed limits it to plans whose
 * latest search did not confirm them).
 *
 * - One search per edition: catalog records listing the same show on the
 *   same site section, city and dates share it.
 * - Resumable: every edition's result is written as soon as it is known; a
 *   re-run skips editions already settled (VERIFIED_PLAN / VERIFIED_NO_PLAN)
 *   and retries temporary failures up to --max-attempts.
 * - Temporary failures (NETWORK_ERROR, DOWNLOAD_FAILED, DISCOVERY_INCOMPLETE)
 *   are retried in a second pass with a larger budget; they never overwrite a
 *   verified plan or a verified "none published" (see the store).
 * - Web search is off unless BRAVE_SEARCH_API_KEY is set: keyless search
 *   engines block a batch of this size.
 *
 * Output (reports/floor-plans/): summary.json, summary.md, and a row per
 * catalog event in floor-plans.csv / floor-plans.jsonl — name, year, city,
 * venue, official URL, plan URL, source URL, status, evidence, failure reason.
 */
import { Resolver } from 'dns/promises';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { FindShowEvent } from '@/types/find-shows';
import { findShowEvents } from '@/lib/find-shows/catalog';
import { siteKey, websiteDomain } from '@/lib/find-shows/floor-plan';
import { braveSearch, type FloorPlanStatus } from '@/lib/find-shows/floor-plan-discovery';
import { editionKey, searchEdition, storedEdition } from '@/lib/find-shows/floor-plan-resolver';
import {
  effectiveResult,
  isTransient,
  mergeResult,
  readAllRecords,
  readRecord,
  writeRecord,
  type EditionRecord,
} from '@/lib/find-shows/floor-plan-store';

// --- Options ------------------------------------------------------------------

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [name, value] = arg.replace(/^--/, '').split('=');
    return [name, value ?? 'true'] as [string, string];
  })
);
const option = (name: string, fallback: number) => (args.has(name) ? Number(args.get(name)) : fallback);
const CONCURRENCY = option('concurrency', 16);
const LIMIT = option('limit', Infinity);
const MAX_ATTEMPTS = option('max-attempts', 3);
const SITE_GAP_MS = option('site-gap-ms', 1_500);
const REFRESH = args.has('refresh');
const REPORT_ONLY = args.has('report');
const RECHECK_PLANS = args.has('recheck-plans');
const SLUGS = args.get('slug')?.split(',').filter(Boolean) ?? null;
const REPORT_DIR = path.join(process.cwd(), 'reports', 'floor-plans');

const STATUSES: FloorPlanStatus[] = ['VERIFIED_PLAN', 'VERIFIED_NO_PLAN', 'DISCOVERY_INCOMPLETE', 'NETWORK_ERROR', 'DOWNLOAD_FAILED'];

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

const transientAttempts = (record: EditionRecord) => record.attempts.filter((attempt) => isTransient(attempt.status)).length;

/** Whether an edition still needs a search: never searched, or only temporary failures so far (up to the attempt cap). */
function needsSearch(record: EditionRecord | null) {
  if (!record || REFRESH) return true;
  if (record.verifiedPlan || effectiveResult(record).status === 'VERIFIED_NO_PLAN') return false;
  return transientAttempts(record) < MAX_ATTEMPTS;
}

// --- Connectivity ---------------------------------------------------------------

/**
 * Whether this machine can resolve names at all. Live DNS queries (not the OS
 * cache) for a few always-up hosts: when all fail, the network is down, and a
 * failed search says nothing about the event.
 */
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

type Tally = Record<FloorPlanStatus, number>;
const emptyTally = (): Tally => Object.fromEntries(STATUSES.map((status) => [status, 0])) as Tally;

async function runPass(
  label: string,
  editions: Edition[],
  budget: { timeMs: number; maxPages: number; maxCandidates: number },
  options: { revalidate?: boolean } = {}
) {
  if (!editions.length) return emptyTally();
  const tally = emptyTally();
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
  const search = process.env.BRAVE_SEARCH_API_KEY ? braveSearch(process.env.BRAVE_SEARCH_API_KEY) : null;

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
        const slugs = edition.events.map((event) => event.slug);
        let status: FloorPlanStatus;
        let reason: string;
        if (!websiteDomain(edition.event.website)) {
          // No official website to search: nothing can be verified either way.
          const now = new Date().toISOString();
          const record = mergeResult(await readRecord(edition.key), edition.key, storedEdition(edition.event, slugs), {
            status: 'DISCOVERY_INCOMPLETE',
            floorPlan: null,
            reason: 'no official website listed for this event',
            checkedAt: now,
            trace: {
              event: { name: edition.event.name, year: edition.event.startDate.slice(0, 4), dates: edition.event.startDate, city: edition.event.city, country: edition.event.country, venue: edition.event.venue, organizer: edition.event.organizer, website: edition.event.website, otherCitiesOnSite: [] },
              officialSites: [], relatedSites: [], queries: [], sources: [], candidates: [],
              outcome: 'DISCOVERY_INCOMPLETE', outcomeReason: 'no official website listed for this event', pagesFetched: 0, candidatesChecked: 0, ms: 0, checkedAt: now,
            },
          });
          await writeRecord(record);
          status = record.lastAttempt.status;
          reason = record.lastAttempt.reason;
        } else {
          const record = await searchEdition(edition.event, { slugs, discovery: { search, budget }, revalidate: options.revalidate });
          status = record.lastAttempt.status;
          reason = record.lastAttempt.reason;
          // A DNS-type failure during an outage says nothing about the event: wait for the network, search it again.
          if (status === 'NETWORK_ERROR' && DNS_FAILURE.test(reason)) {
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
        }
        tally[status]++;
        done++;
        const rate = done / ((Date.now() - started) / 60_000);
        const eta = Math.round((queue.length + busySites.size - 1) / Math.max(rate, 0.01));
        console.log(
          `[${label}] ${done}/${editions.length} ${status.padEnd(20)} ${edition.event.slug.slice(0, 60)} — ${reason.slice(0, 90)}` +
            (done % 25 === 0 ? `\n[${label}] ${rate.toFixed(1)} editions/min, ~${eta} min left · ${STATUSES.map((s) => `${s} ${tally[s]}`).join(' · ')}` : '')
        );
      } catch (error) {
        tally.DISCOVERY_INCOMPLETE++;
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
  return tally;
}

// --- Report -------------------------------------------------------------------

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

async function writeReport(editions: Edition[]) {
  const records = new Map((await readAllRecords()).map((record) => [record.key, record]));
  const rows: Record<string, unknown>[] = [];
  const events = emptyTally();
  const editionTally = emptyTally();
  let eventsChecked = 0;
  let editionsChecked = 0;
  const byRegion: Record<string, Partial<Tally> & { total: number }> = {};

  for (const edition of editions) {
    const record = records.get(edition.key) ?? null;
    const answer = record ? effectiveResult(record) : null;
    if (answer) {
      editionsChecked++;
      editionTally[answer.status]++;
    }
    for (const event of edition.events) {
      const region = (byRegion[event.region] ??= { total: 0 });
      region.total++;
      if (answer) {
        eventsChecked++;
        events[answer.status]++;
        region[answer.status] = (region[answer.status] ?? 0) + 1;
      }
      rows.push({
        slug: event.slug,
        event: event.name,
        year: event.startDate.slice(0, 4),
        dates: event.displayDate,
        city: event.city,
        country: event.country,
        region: event.region,
        category: event.primaryCategory,
        venue: event.venue,
        organizer: event.organizer,
        officialUrl: event.website,
        status: answer?.status ?? 'NOT_CHECKED',
        floorPlanUrl: answer?.floorPlan?.url ?? '',
        floorPlanKind: answer?.floorPlan?.kind ?? '',
        sourceUrl: answer?.floorPlan?.source.url ?? '',
        verification: answer?.floorPlan?.verification ?? '',
        evidence: answer?.floorPlan?.evidence.join('; ') ?? '',
        reason: answer?.reason ?? 'not searched yet',
        lastAttemptStatus: record?.lastAttempt.status ?? '',
        lastAttemptReason: record && record.lastAttempt !== answer ? record.lastAttempt.reason : '',
        attempts: record?.attempts.length ?? 0,
        checkedAt: answer?.checkedAt ?? '',
        pagesChecked: answer?.trace.pagesFetched ?? '',
        candidatesChecked: answer?.trace.candidatesChecked ?? '',
        editionKey: edition.key,
      });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalEvents: findShowEvents.length,
    eventsChecked,
    events,
    totalEditions: editions.length,
    editionsChecked,
    editions: editionTally,
    byRegion,
  };
  await mkdir(REPORT_DIR, { recursive: true });
  const columns = Object.keys(rows[0] ?? {});
  await writeFile(path.join(REPORT_DIR, 'floor-plans.csv'), [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n'));
  await writeFile(path.join(REPORT_DIR, 'floor-plans.jsonl'), rows.map((row) => JSON.stringify(row)).join('\n'));
  await writeFile(path.join(REPORT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  const lines = [
    `# Floor-plan discovery — ${summary.generatedAt}`,
    '',
    `Total events: ${summary.totalEvents}`,
    `Events checked: ${eventsChecked}`,
    `Verified floor plans: ${events.VERIFIED_PLAN}`,
    `Verified no-plan: ${events.VERIFIED_NO_PLAN}`,
    `Discovery incomplete: ${events.DISCOVERY_INCOMPLETE}`,
    `Network failures: ${events.NETWORK_ERROR}`,
    `Download failures: ${events.DOWNLOAD_FAILED}`,
    '',
    `Editions (catalog records of the same show merged): ${editions.length}, checked ${editionsChecked} — ${STATUSES.map((status) => `${status} ${editionTally[status]}`).join(', ')}`,
    '',
    '| Region | Events | Verified plan | Verified no-plan | Incomplete | Network | Download |',
    '|---|---|---|---|---|---|---|',
    ...Object.entries(byRegion).map(
      ([region, tally]) =>
        `| ${region} | ${tally.total} | ${tally.VERIFIED_PLAN ?? 0} | ${tally.VERIFIED_NO_PLAN ?? 0} | ${tally.DISCOVERY_INCOMPLETE ?? 0} | ${tally.NETWORK_ERROR ?? 0} | ${tally.DOWNLOAD_FAILED ?? 0} |`
    ),
  ];
  await writeFile(path.join(REPORT_DIR, 'summary.md'), lines.join('\n'));
  console.log(`\n${lines.slice(2, 9).join('\n')}\n${lines[10]}\nReport: ${path.relative(process.cwd(), REPORT_DIR)}`);
}

// --- Main ---------------------------------------------------------------------

async function main() {
  let editions = catalogEditions();
  if (SLUGS) editions = editions.filter((edition) => edition.events.some((event) => SLUGS.includes(event.slug)));
  console.log(`Catalog: ${findShowEvents.length} events → ${editions.length} editions${SLUGS ? ' (selected)' : ''}`);

  if (RECHECK_PLANS) {
    const plans: Edition[] = [];
    // --recheck-plans=unconfirmed: only plans whose latest search did not confirm them.
    const unconfirmedOnly = args.get('recheck-plans') === 'unconfirmed';
    for (const edition of editions) {
      const record = await readRecord(edition.key);
      if (record?.verifiedPlan && (!unconfirmedOnly || record.lastAttempt.status !== 'VERIFIED_PLAN')) plans.push(edition);
    }
    console.log(`Re-judging ${plans.length} editions with a verified plan.`);
    await runPass('recheck', plans, { timeMs: 55_000, maxPages: 60, maxCandidates: 30 }, { revalidate: true });
  } else if (!REPORT_ONLY) {
    const records = new Map<string, EditionRecord | null>();
    for (const edition of editions) records.set(edition.key, await readRecord(edition.key));
    const todo = editions.filter((edition) => needsSearch(records.get(edition.key) ?? null)).slice(0, LIMIT);
    console.log(`${editions.length - todo.length} editions already settled or out of attempts; searching ${todo.length}. Concurrency ${CONCURRENCY}, one edition per site at a time.`);
    await runPass('pass 1', todo, { timeMs: 55_000, maxPages: 60, maxCandidates: 30 });

    if (!process.exitCode) {
      // Temporary failures get one more try, with more time and pages.
      const retry: Edition[] = [];
      for (const edition of todo) {
        const record = await readRecord(edition.key);
        // Only failures a minute's wait and a larger budget can change: network, downloads, budget.
        // A blocking site or unverifiable evidence is retried on the next run instead.
        if (
          record &&
          isTransient(effectiveResult(record).status) &&
          transientAttempts(record) < MAX_ATTEMPTS &&
          /could not be (?:reached|downloaded)|timed out|budget ran out|HTTP 5\d\d|search failed/.test(record.lastAttempt.reason)
        ) {
          retry.push(edition);
        }
      }
      console.log(`\nRetrying ${retry.length} editions with temporary failures (larger budget).`);
      await runPass('retry', retry, { timeMs: 90_000, maxPages: 100, maxCandidates: 45 });
    }
  }
  await writeReport(catalogEditions());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
