/**
 * Public Find Shows exhibitors → CRM EventExhibitor rows, for any event.
 *
 * Events themselves need no sync: the CRM reads the same catalog as Find Shows (data/find-shows-seed.json,
 * lib/find-shows/catalog.ts) and looks each event up by its slug, so a catalog event — new, updated or old —
 * is a CRM event in the same deploy. What the CRM keeps apart is the Exhibitors tab: it reads EventExhibitor,
 * while the public tab reads the per-edition directory store (lib/find-shows/exhibitor-resolver.ts). This
 * module brings one stored verified list into EventExhibitor for each catalog slug that lists the edition.
 *
 * Field ownership, per row (key: eventSlug + the exhibitor's official profile URL):
 *  - the directory owns companyName, nameKey and sourceDirectoryUrl — always taken from the latest list;
 *  - logoUrl, standNumber and description are filled or refreshed from the list, never blanked by it;
 *  - everything else is CRM-owned and never written here: websiteUrl, country, phone, LinkedIn, categories,
 *    named contacts (enrichment imports and users fill those);
 *  - nothing is deleted: an exhibitor that leaves the public list keeps its CRM row.
 * An event whose rows came from another source (BETT's own importer) is a conflict, logged for review and
 * left alone: the two sources key the same companies by different URLs, so merging would duplicate them.
 */
import type { ExhibitorRecord } from '@/lib/find-shows/exhibitor-resolver';
import { CrmImportRefused, crmRowsFromRecord, type CrmExhibitorRow } from '@/lib/find-shows/exhibitor-crm-import';

/** The source-owned columns of an existing EventExhibitor row, as planning compares them. */
export type ExistingExhibitorRow = {
  id: string;
  sourceDetailUrl: string;
  source: string;
  companyName: string;
  nameKey: string | null;
  logoUrl: string | null;
  sourceDirectoryUrl: string | null;
  standNumber: string | null;
  description: string | null;
};

export type ExhibitorRowUpdate = { id: string } & Pick<
  CrmExhibitorRow,
  'companyName' | 'nameKey' | 'logoUrl' | 'sourceDirectoryUrl' | 'standNumber' | 'description'
>;

export type SyncPlan = { inserts: CrmExhibitorRow[]; updates: ExhibitorRowUpdate[]; unchanged: number };

/** What the latest list makes of one existing row, by the ownership rules above. */
export function mergeExhibitorRow(existing: ExistingExhibitorRow, incoming: CrmExhibitorRow): ExhibitorRowUpdate {
  return {
    id: existing.id,
    companyName: incoming.companyName,
    nameKey: incoming.nameKey,
    sourceDirectoryUrl: incoming.sourceDirectoryUrl,
    logoUrl: incoming.logoUrl ?? existing.logoUrl,
    standNumber: incoming.standNumber ?? existing.standNumber,
    description: incoming.description ?? existing.description,
  };
}

const COMPARED = ['companyName', 'nameKey', 'sourceDirectoryUrl', 'logoUrl', 'standNumber', 'description'] as const;

/** New rows to insert, existing rows to update, and how many are already current. Writes nothing. */
export function planExhibitorSync(incoming: CrmExhibitorRow[], existing: ExistingExhibitorRow[]): SyncPlan {
  const byUrl = new Map(existing.map((row) => [row.sourceDetailUrl, row]));
  const plan: SyncPlan = { inserts: [], updates: [], unchanged: 0 };
  for (const row of incoming) {
    const current = byUrl.get(row.sourceDetailUrl);
    if (!current) {
      plan.inserts.push(row);
      continue;
    }
    const merged = mergeExhibitorRow(current, row);
    if (COMPARED.some((field) => merged[field] !== current[field])) plan.updates.push(merged);
    else plan.unchanged += 1;
  }
  return plan;
}

/** Where EventExhibitor is read and written: Prisma in the app and the CLI (lib/exhibitors/crm-sync-db.ts), a fake in tests. */
export type ExhibitorSyncDb = {
  existingRows(eventSlug: string): Promise<ExistingExhibitorRow[]>;
  /** Inserts and updates in one transaction; returns rows actually inserted (a concurrent run may have won). */
  apply(eventSlug: string, plan: SyncPlan): Promise<{ inserted: number; updated: number }>;
};

export type SyncStatus = 'created' | 'updated' | 'unchanged' | 'no-list' | 'conflict' | 'failed';

export type EventSyncResult = {
  slug: string;
  status: SyncStatus;
  /** Rows in the public list for this slug. */
  listed: number;
  before: number;
  inserted: number;
  updated: number;
  unchanged: number;
  dryRun: boolean;
  reason?: string;
};

/**
 * Brings one slug's stored list into EventExhibitor (or, with dryRun, only says what that would do).
 * `created`: the event had no CRM rows; `updated`: rows were added or refreshed; `unchanged`: already current;
 * `no-list`: nothing verified to sync; `conflict`: rows from another source, left for review.
 */
export async function syncEventExhibitors(
  slug: string,
  record: ExhibitorRecord | null,
  db: ExhibitorSyncDb,
  { dryRun = false }: { dryRun?: boolean } = {}
): Promise<EventSyncResult> {
  const result: EventSyncResult = { slug, status: 'no-list', listed: 0, before: 0, inserted: 0, updated: 0, unchanged: 0, dryRun };
  let rows: CrmExhibitorRow[];
  try {
    rows = crmRowsFromRecord(slug, record);
  } catch (error) {
    if (error instanceof CrmImportRefused) return { ...result, reason: error.message };
    throw error;
  }
  result.listed = rows.length;
  // A verified list whose cards all share one catalogue link has no per-exhibitor page to key a row by;
  // keying by anything less stable could duplicate rows on the next sync, so it is skipped and reported.
  if (!rows.length && record?.verified?.exhibitors.length) {
    return { ...result, reason: `The public list's ${record.verified.exhibitors.length} exhibitors have no page of their own (one shared catalogue link), so they cannot be keyed for the CRM.` };
  }

  const existing = await db.existingRows(slug);
  result.before = existing.length;
  const platform = rows[0]?.source;
  const others = Array.from(new Set(existing.map((row) => row.source).filter((source) => source !== platform)));
  if (others.length) {
    return { ...result, status: 'conflict', reason: `${existing.length} CRM rows already come from ${others.join(', ')}, not ${platform}; left for review.` };
  }

  const plan = planExhibitorSync(rows, existing);
  result.unchanged = plan.unchanged;
  if (dryRun) {
    result.inserted = plan.inserts.length;
    result.updated = plan.updates.length;
  } else if (plan.inserts.length || plan.updates.length) {
    const applied = await db.apply(slug, plan);
    result.inserted = applied.inserted;
    result.updated = applied.updated;
  }
  result.status = existing.length === 0 && result.inserted > 0 ? 'created' : result.inserted || result.updated ? 'updated' : 'unchanged';
  return result;
}

/** syncEventExhibitors with retries for temporary failures (network, timeouts, a busy pooler); never throws. */
export async function syncWithRetry(
  slug: string,
  record: ExhibitorRecord | null,
  db: ExhibitorSyncDb,
  { attempts = 3, delayMs = 1_000, dryRun = false, sleep = (ms: number) => new Promise((done) => setTimeout(done, ms)) } = {}
): Promise<EventSyncResult & { attempts: number }> {
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return { ...(await syncEventExhibitors(slug, record, db, { dryRun })), attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < attempts) await sleep(delayMs * 2 ** (attempt - 1));
    }
  }
  return { slug, status: 'failed', listed: 0, before: 0, inserted: 0, updated: 0, unchanged: 0, dryRun, reason: lastError, attempts };
}
