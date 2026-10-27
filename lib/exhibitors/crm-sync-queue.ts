/**
 * The automatic half of the exhibitor sync: called by the exhibitor store whenever it stores a new verified
 * list (lib/find-shows/exhibitor-resolver.ts — both the public Exhibitors tab's on-demand search and
 * `npm run exhibitors:discover` go through it), for just the slugs of that edition — no catalog scan.
 *
 * Every call marks the slugs pending in the ledger first. Only with CRM_EXHIBITOR_SYNC=on are the rows then
 * written to the CRM (with retries); otherwise they stay pending for `npm run exhibitors:sync-crm --
 * --pending`. Off by default: the CRM database has no room budgeted for the full catalog's exhibitors yet.
 * Never throws — the public tab must not fail because the CRM could not be written.
 */
import type { ExhibitorRecord } from '@/lib/find-shows/exhibitor-resolver';
import { syncWithRetry, type ExhibitorSyncDb } from './crm-sync';
import { markPending, recordResult } from './crm-sync-ledger';

export function crmExhibitorSyncEnabled(env: Record<string, string | undefined> = process.env) {
  return env.CRM_EXHIBITOR_SYNC === 'on';
}

/** One sync per slug at a time: a second list stored while the first is syncing waits for it. */
const running = new Map<string, Promise<unknown>>();

export async function queueCrmExhibitorSync(
  record: ExhibitorRecord,
  {
    enabled = crmExhibitorSyncEnabled(),
    db,
    log = (line: Record<string, unknown>) => console.info('[crm-exhibitor-sync]', JSON.stringify(line)),
  }: { enabled?: boolean; db?: ExhibitorSyncDb; log?: (line: Record<string, unknown>) => void } = {}
) {
  const list = record.verified;
  if (list?.status !== 'VERIFIED_LIST') return [];
  const results = [];
  for (const slug of record.edition.slugs) {
    try {
      await markPending(slug, list.checkedAt);
      if (!enabled) {
        log({ slug, status: 'pending', reason: 'CRM_EXHIBITOR_SYNC is off' });
        continue;
      }
      const previous = running.get(slug) ?? Promise.resolve();
      const task = previous.then(async () => {
        const target = db ?? (await import('./crm-sync-db')).prismaExhibitorSyncDb;
        const result = await syncWithRetry(slug, record, target);
        await recordResult(result, list.checkedAt);
        log({ slug, status: result.status, inserted: result.inserted, updated: result.updated, unchanged: result.unchanged, attempts: result.attempts, reason: result.reason });
        return result;
      });
      running.set(slug, task);
      results.push(await task);
      if (running.get(slug) === task) running.delete(slug);
    } catch (error) {
      log({ slug, status: 'failed', reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}
