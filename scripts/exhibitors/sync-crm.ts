/**
 * Reconciles stored public exhibitor lists with the CRM's EventExhibitor rows (lib/exhibitors/crm-sync.ts).
 *
 *   npm run exhibitors:sync-crm -- --slug=aapex-las-vegas-nv-2026-11-03[,<slug>…]   one or more events
 *   npm run exhibitors:sync-crm -- --pending                                    what the ledger says is left
 *   npm run exhibitors:sync-crm -- --all                                        every stored verified list
 *     --write        actually write (without it: a dry run — reads the CRM, writes nothing, ledger untouched)
 *     --batch=25     events per batch (progress is printed after each)
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
import { prisma } from '@/lib/db/prisma';

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name: string) => process.argv.includes(`--${name}`);
const write = has('write');
const batchSize = Math.max(1, Number(arg('batch') ?? 25) || 25);

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

async function jobsFor(slugs: string[]): Promise<Job[]> {
  return Promise.all(
    slugs.map(async (slug) => {
      const event = findShowEventsBySlug[slug];
      return { slug, record: event ? await readExhibitorRecord(editionKey(event)) : null };
    })
  );
}

async function main() {
  const mode = arg('slug') ? 'slug' : has('pending') ? 'pending' : has('all') ? 'all' : null;
  if (!mode) throw new Error('Choose --slug=<slug>[,…], --pending or --all (add --write to write).');
  const jobs =
    mode === 'slug'
      ? await jobsFor(arg('slug')!.split(',').map((slug) => slug.trim()).filter(Boolean))
      : mode === 'pending'
        ? await jobsFor((await listLedger()).map((entry) => entry.slug))
        : await allJobs();

  console.log(`[sync-crm] ${mode}: ${jobs.length} events, ${write ? 'WRITING' : 'dry run (no writes)'}, batches of ${batchSize}`);
  const counts: Record<SyncStatus, number> = { created: 0, updated: 0, unchanged: 0, 'no-list': 0, conflict: 0, failed: 0 };
  const rows = { listed: 0, inserted: 0, updated: 0, unchanged: 0 };
  const flagged: EventSyncResult[] = [];

  for (let start = 0; start < jobs.length; start += batchSize) {
    for (const { slug, record } of jobs.slice(start, start + batchSize)) {
      const result = await syncWithRetry(slug, record, prismaExhibitorSyncDb, { dryRun: !write });
      if (record?.verified?.checkedAt) await recordResult(result, record.verified.checkedAt);
      counts[result.status] += 1;
      rows.listed += result.listed;
      rows.inserted += result.inserted;
      rows.updated += result.updated;
      rows.unchanged += result.unchanged;
      if (result.status === 'conflict' || result.status === 'failed' || result.status === 'no-list') flagged.push(result);
    }
    console.log(`[sync-crm] ${Math.min(start + batchSize, jobs.length)}/${jobs.length} ${JSON.stringify(counts)}`);
  }

  const summary = { mode, write, at: new Date().toISOString(), events: jobs.length, counts, rows, flagged };
  const dir = path.join(process.cwd(), 'reports', 'crm-exhibitor-sync');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${mode}${write ? '' : '-dry-run'}.json`);
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
