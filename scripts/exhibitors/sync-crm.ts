/**
 * Reconciles stored public exhibitor lists with the CRM's EventExhibitor rows (lib/exhibitors/crm-sync.ts).
 *
 *   npm run exhibitors:sync-crm -- --slug=aapex-las-vegas-nv-2026-11-03[,<slug>…]   one or more events
 *   npm run exhibitors:sync-crm -- --slugs-file=<file>                          the slugs listed in a file, one per line
 *   npm run exhibitors:sync-crm -- --pending                                   what the ledger says is left
 *   npm run exhibitors:sync-crm -- --all                                        every stored verified list
 *     --write        actually write (without it: a dry run — reads the CRM, writes nothing, ledger untouched)
 *     --batch=25     events per batch (progress is printed after each)
 *     --insert-only  add missing exhibitors only; never update an existing row (reported as `kept`)
 *     --upcoming     only events starting today or later
 *
 * The reference events (lib/exhibitors/reference-events.ts: ALLES FÜR DEN GAST, BETT, AAPEX) are always
 * skipped, in every mode — their rows were imported and verified by hand and are never topped up from here.
 * Every event's outcome is listed in the summary's `results`, so a dry run is also the event-wise report.
 *
 * Reads only stored records — never searches or crawls. Safe to re-run: rows are keyed by (eventSlug,
 * profile URL), unchanged rows are not touched, nothing is deleted, and an event whose rows came from
 * another source is reported as a conflict and left alone. A summary is written to
 * reports/crm-exhibitor-sync/<mode>[-dry-run].json.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import { editionKey } from '@/lib/find-shows/floor-plan-resolver';
import { exhibitorStoreDir, readExhibitorRecord, type ExhibitorRecord } from '@/lib/find-shows/exhibitor-resolver';
import { syncWithRetry, type EventSyncResult, type SyncStatus } from '@/lib/exhibitors/crm-sync';
import { prismaExhibitorSyncDb } from '@/lib/exhibitors/crm-sync-db';
import { listLedger, recordResult } from '@/lib/exhibitors/crm-sync-ledger';
import { isReferenceExhibitorEvent } from '@/lib/exhibitors/reference-events';
import { prisma } from '@/lib/db/prisma';

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name: string) => process.argv.includes(`--${name}`);
const write = has('write');
const insertOnly = has('insert-only');
const batchSize = Math.max(1, Number(arg('batch') ?? 25) || 25);
const upcoming = has('upcoming');
/** Today as the catalog writes start dates (YYYY-MM-DD), for --upcoming. */
const today = new Date().toISOString().slice(0, 10);

type Job = { slug: string; record: ExhibitorRecord | null };

/** Every stored verified list, as one job per catalog slug it lists. */
async function allJobs(): Promise<Job[]> {
  const dir = exhibitorStoreDir();
  const files = (await readdir(dir)).filter((file) => file.endsWith('.json.gz'));
  const jobs: Job[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (index && index % 2000 === 0) console.log(`[sync-crm] reading store ${index}/${files.length}`);
    try {
      const record = JSON.parse(gunzipSync(await readFile(path.join(dir, file))).toString('utf8')) as ExhibitorRecord;
      if (record.verified?.status !== 'VERIFIED_LIST') continue;
      for (const slug of record.edition.slugs) if (findShowEventsBySlug[slug]) jobs.push({ slug, record });
    } catch {
      // An unreadable record is the store's concern; it has nothing to sync.
    }
  }
  return jobs;
}

/** One catalog slug per line ('#' starts a comment); every slug must be in the catalog, or nothing runs. */
async function slugsFromFile(file: string): Promise<string[]> {
  const slugs = (await readFile(path.resolve(file), 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean);
  const unknown = slugs.filter((slug) => !findShowEventsBySlug[slug]);
  if (unknown.length) throw new Error(`${unknown.length} slugs in ${file} are not catalog events: ${unknown.slice(0, 5).join(', ')}`);
  if (new Set(slugs).size !== slugs.length) throw new Error(`${file} lists a slug more than once.`);
  return slugs;
}

async function jobsFor(slugs: string[]): Promise<Job[]> {
  return Promise.all(
    slugs.map(async (slug) => {
      const event = findShowEventsBySlug[slug];
      return { slug, record: event ? await readExhibitorRecord(editionKey(event)) : null };
    })
  );
}

async function main() {
  const mode = arg('slug') ? 'slug' : arg('slugs-file') ? 'list' : has('pending') ? 'pending' : has('all') ? 'all' : null;
  if (!mode) throw new Error('Choose --slug=<slug>[,…], --slugs-file=<file>, --pending or --all (add --write to write).');
  const requested =
    mode === 'slug'
      ? await jobsFor(arg('slug')!.split(',').map((slug) => slug.trim()).filter(Boolean))
      : mode === 'list'
        ? await jobsFor(await slugsFromFile(arg('slugs-file')!))
      : mode === 'pending'
        ? await jobsFor((await listLedger()).map((entry) => entry.slug))
        : await allJobs();
  const inScope = upcoming ? requested.filter(({ slug }) => (findShowEventsBySlug[slug]?.startDate ?? '') >= today) : requested;
  const reference = inScope.filter(({ slug }) => isReferenceExhibitorEvent(slug)).map(({ slug }) => slug);
  const jobs = inScope.filter(({ slug }) => !isReferenceExhibitorEvent(slug));

  console.log(`[sync-crm] ${mode}${upcoming ? ` (upcoming from ${today})` : ''}: ${jobs.length} events, ${write ? 'WRITING' : 'dry run (no writes)'}${insertOnly ? ', insert-only' : ''}, batches of ${batchSize}`);
  if (reference.length) console.log(`[sync-crm] skipped reference events (never synced from here): ${reference.join(', ')}`);
  const counts: Record<SyncStatus, number> = { created: 0, updated: 0, unchanged: 0, 'no-list': 0, conflict: 0, failed: 0 };
  const rows = { listed: 0, inserted: 0, updated: 0, unchanged: 0, kept: 0 };
  const flagged: EventSyncResult[] = [];
  const results: EventSyncResult[] = [];

  for (let start = 0; start < jobs.length; start += batchSize) {
    for (const { slug, record } of jobs.slice(start, start + batchSize)) {
      const result = await syncWithRetry(slug, record, prismaExhibitorSyncDb, { dryRun: !write, insertOnly });
      if (record?.verified?.checkedAt) await recordResult(result, record.verified.checkedAt);
      results.push(result);
      counts[result.status] += 1;
      rows.listed += result.listed;
      rows.inserted += result.inserted;
      rows.updated += result.updated;
      rows.unchanged += result.unchanged;
      rows.kept += result.kept ?? 0;
      if (result.status === 'conflict' || result.status === 'failed' || result.status === 'no-list') flagged.push(result);
    }
    console.log(`[sync-crm] ${Math.min(start + batchSize, jobs.length)}/${jobs.length} ${JSON.stringify(counts)}`);
  }

  const summary = { mode, upcoming, write, insertOnly, at: new Date().toISOString(), events: jobs.length, skippedReference: reference, counts, rows, flagged, results };
  const dir = path.join(process.cwd(), 'reports', 'crm-exhibitor-sync');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${mode}${upcoming ? '-upcoming' : ''}${write ? '' : '-dry-run'}.json`);
  await writeFile(file, JSON.stringify(summary, null, 2));
  console.log(`[sync-crm] events ${JSON.stringify(counts)}`);
  console.log(`[sync-crm] rows ${JSON.stringify(rows)}${write ? '' : ' (would be — dry run)'}`);
  console.log(`[sync-crm] summary: ${path.relative(process.cwd(), file)}`);
}

main()
  .catch((error) => {
    console.error('[sync-crm]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
