/**
 * Which events' exhibitor lists still need to reach the CRM: one small JSON entry per catalog slug under the
 * exhibitor store (<store>/crm-sync/<slug>.json, beside the records it tracks — the store's own readers only
 * list *.json.gz). Written whenever a verified list is stored and after every sync attempt, so a retry
 * (`npm run exhibitors:sync-crm -- --pending`) finds what is left without scanning the catalog or the store.
 *
 *  - pending: a verified list was stored and has not reached the CRM yet (sync off, or not yet attempted);
 *  - synced: the CRM rows match the list as of `listCheckedAt`;
 *  - conflict: rows from another source exist — needs a person to decide;
 *  - skipped: the list cannot be keyed for the CRM (e.g. one shared catalogue link); `lastError` says why,
 *    and only a newer list puts it back to pending;
 *  - failed: every retry failed; `lastError` says why.
 */
import { mkdir, readFile, readdir, rename, writeFile } from 'fs/promises';
import path from 'path';
import { exhibitorStoreDir } from '@/lib/find-shows/exhibitor-resolver';
import type { EventSyncResult } from './crm-sync';

export type LedgerStatus = 'pending' | 'synced' | 'conflict' | 'skipped' | 'failed';

export type LedgerEntry = {
  slug: string;
  status: LedgerStatus;
  /** checkedAt of the stored verified list this entry is about. */
  listCheckedAt: string;
  attempts: number;
  lastError: string | null;
  updatedAt: string;
  last?: Pick<EventSyncResult, 'status' | 'listed' | 'before' | 'inserted' | 'updated' | 'unchanged'>;
};

export function ledgerDir() {
  return path.join(exhibitorStoreDir(), 'crm-sync');
}

const fileFor = (slug: string) => path.join(ledgerDir(), `${slug.replace(/[^a-z0-9-]/gi, '_')}.json`);

export async function readLedgerEntry(slug: string): Promise<LedgerEntry | null> {
  try {
    const entry = JSON.parse(await readFile(fileFor(slug), 'utf8')) as LedgerEntry;
    return entry.slug === slug ? entry : null;
  } catch {
    return null;
  }
}

export async function writeLedgerEntry(entry: LedgerEntry) {
  const file = fileFor(entry.slug);
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(entry));
  await rename(temp, file);
}

/** A newer verified list was stored for this slug: it needs syncing, whatever happened before. */
export async function markPending(slug: string, listCheckedAt: string, now = new Date()) {
  const previous = await readLedgerEntry(slug);
  if (previous && previous.listCheckedAt === listCheckedAt && previous.status !== 'failed') return previous;
  const entry: LedgerEntry = { slug, status: 'pending', listCheckedAt, attempts: 0, lastError: null, updatedAt: now.toISOString() };
  await writeLedgerEntry(entry);
  return entry;
}

/** Records what a sync attempt did. A dry run records nothing. */
export async function recordResult(result: EventSyncResult & { attempts?: number }, listCheckedAt: string, now = new Date()) {
  if (result.dryRun) return null;
  const previous = await readLedgerEntry(result.slug);
  // A no-list result wrote nothing, so it must not read as synced: it would hide why the event has no rows.
  const status: LedgerStatus =
    result.status === 'failed' ? 'failed' : result.status === 'conflict' ? 'conflict' : result.status === 'no-list' ? 'skipped' : 'synced';
  const entry: LedgerEntry = {
    slug: result.slug,
    status,
    listCheckedAt,
    attempts: (previous?.listCheckedAt === listCheckedAt ? previous.attempts : 0) + (result.attempts ?? 1),
    lastError: status === 'synced' ? null : result.reason ?? null,
    updatedAt: now.toISOString(),
    last: {
      status: result.status,
      listed: result.listed,
      before: result.before,
      inserted: result.inserted,
      updated: result.updated,
      unchanged: result.unchanged,
    },
  };
  await writeLedgerEntry(entry);
  return entry;
}

/** Entries still needing work (pending or failed), or with a given status. */
export async function listLedger(statuses: LedgerStatus[] = ['pending', 'failed']): Promise<LedgerEntry[]> {
  let files: string[];
  try {
    files = (await readdir(ledgerDir())).filter((file) => file.endsWith('.json'));
  } catch {
    return [];
  }
  const entries = await Promise.all(
    files.map(async (file) => {
      try {
        return JSON.parse(await readFile(path.join(ledgerDir(), file), 'utf8')) as LedgerEntry;
      } catch {
        return null;
      }
    })
  );
  return entries.filter((entry): entry is LedgerEntry => Boolean(entry && statuses.includes(entry.status)));
}
