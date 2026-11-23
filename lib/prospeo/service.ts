/**
 * Prospeo pilot workflow for one exhibitor: preview (search + classify, no
 * writes) and import (re-run the same search, keep only the people the user
 * approved, write via the duplicate-safe plan).
 *
 * Re-running the search on import, rather than trusting rows posted back by the
 * browser, means what is stored is exactly what Prospeo returned; Prospeo does
 * not charge for repeating the same pages within 30 days.
 *
 * The database and network are injectable so tests use fakes.
 */
import { ProspeoError, searchAllPeople, type ProspeoFetch } from "@/lib/prospeo/client";
import { mapProspeoResult, type ProspeoContact } from "@/lib/prospeo/map";
import { prospeoTargetFor, resultBelongsTo, searchFiltersFor, type ProspeoTarget } from "@/lib/prospeo/pilot";
import { CONTACT_FIELDS, planImport, type ExistingContactRow } from "@/lib/prospeo/import-plan";

export const PROSPEO_SOURCE = "prospeo";

/** The slice of the Prisma client this module needs. */
export type ContactStore = {
  exhibitorContact: {
    findMany(args: { where: { exhibitorId: string; source?: string }; orderBy?: unknown }): Promise<Array<Record<string, unknown>>>;
    createMany(args: { data: Array<Record<string, unknown>>; skipDuplicates?: boolean }): Promise<{ count: number }>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
};

export type ProspeoDeps = {
  apiKey?: string;
  fetchImpl?: ProspeoFetch;
  sleep?: (ms: number) => Promise<void>;
  db?: ContactStore;
};

export class ProspeoNotConfiguredError extends Error {
  constructor() {
    super("Prospeo is not configured: set PROSPEO_API_KEY in the server environment.");
    this.name = "ProspeoNotConfiguredError";
  }
}

export class ProspeoNotEnabledError extends Error {
  constructor() {
    super("Prospeo is not enabled for this exhibitor (pilot: IRIS Education only).");
    this.name = "ProspeoNotEnabledError";
  }
}

async function defaultDb(): Promise<ContactStore> {
  const { prisma } = await import("@/lib/db/prisma");
  return prisma as unknown as ContactStore;
}

function requireTarget(exhibitorId: string): ProspeoTarget {
  const target = prospeoTargetFor(exhibitorId);
  if (!target) throw new ProspeoNotEnabledError();
  return target;
}

function requireKey(deps: ProspeoDeps): string {
  const key = deps.apiKey ?? process.env.PROSPEO_API_KEY;
  if (!key) throw new ProspeoNotConfiguredError();
  return key;
}

function toExisting(row: Record<string, unknown>): ExistingContactRow {
  const out: Record<string, unknown> = { id: row.id, externalId: row.externalId ?? null };
  for (const field of CONTACT_FIELDS) out[field] = row[field] ?? null;
  return out as ExistingContactRow;
}

type Fetched = {
  target: ProspeoTarget;
  matched: ProspeoContact[];
  otherCompany: Array<{ fullName: string; companyName: string | null; companyDomain: string | null }>;
  invalid: number;
  totalCount: number;
  pagesFetched: number;
  totalPages: number;
  creditsUsed: number;
  truncated: boolean;
};

async function fetchForTarget(exhibitorId: string, deps: ProspeoDeps): Promise<Fetched> {
  const target = requireTarget(exhibitorId);
  const apiKey = requireKey(deps);
  const search = await searchAllPeople(searchFiltersFor(target), { apiKey, fetchImpl: deps.fetchImpl, sleep: deps.sleep });

  const matched: ProspeoContact[] = [];
  const otherCompany: Fetched["otherCompany"] = [];
  let invalid = 0;
  for (const result of search.results) {
    const contact = mapProspeoResult(result);
    if (!contact) {
      invalid += 1;
      continue;
    }
    if (resultBelongsTo(result, target)) matched.push(contact);
    else otherCompany.push({ fullName: contact.fullName, companyName: contact.companyName, companyDomain: contact.companyDomain });
  }
  return {
    target,
    matched,
    otherCompany,
    invalid,
    totalCount: search.totalCount,
    pagesFetched: search.pagesFetched,
    totalPages: search.totalPages,
    creditsUsed: search.creditsUsed,
    truncated: search.truncated,
  };
}

export type PreviewContact = ProspeoContact & { importStatus: "new" | "update" | "unchanged" | "duplicate" };

export type PreviewResult = {
  exhibitor: { id: string; companyName: string; domain: string };
  totalCount: number;
  pagesFetched: number;
  totalPages: number;
  creditsUsed: number;
  truncated: boolean;
  contacts: PreviewContact[];
  otherCompany: Fetched["otherCompany"];
  invalid: number;
  counts: { new: number; update: number; unchanged: number; duplicate: number };
};

/** Search and classify; writes nothing. */
export async function previewProspeo(exhibitorId: string, deps: ProspeoDeps = {}): Promise<PreviewResult> {
  const fetched = await fetchForTarget(exhibitorId, deps);
  const db = deps.db ?? (await defaultDb());
  const existing = (await db.exhibitorContact.findMany({ where: { exhibitorId, source: PROSPEO_SOURCE } })).map(toExisting);
  const plan = planImport(existing, fetched.matched);

  const statusById = new Map<string, PreviewContact["importStatus"]>();
  for (const row of plan.create) statusById.set(row.externalId, "new");
  for (const row of plan.update) statusById.set(row.externalId, "update");
  for (const row of plan.unchanged) statusById.set(row.externalId, "unchanged");
  const seen = new Set<string>();
  const contacts: PreviewContact[] = fetched.matched.map((contact) => {
    const status = seen.has(contact.externalId) ? "duplicate" : statusById.get(contact.externalId) ?? "duplicate";
    seen.add(contact.externalId);
    return { ...contact, importStatus: status };
  });

  return {
    exhibitor: { id: exhibitorId, companyName: fetched.target.companyName, domain: fetched.target.domain },
    totalCount: fetched.totalCount,
    pagesFetched: fetched.pagesFetched,
    totalPages: fetched.totalPages,
    creditsUsed: fetched.creditsUsed,
    truncated: fetched.truncated,
    contacts,
    otherCompany: fetched.otherCompany,
    invalid: fetched.invalid,
    counts: {
      new: plan.create.length,
      update: plan.update.length,
      unchanged: plan.unchanged.length,
      duplicate: plan.duplicates.length,
    },
  };
}

export type ImportResult = {
  imported: number;
  updated: number;
  unchanged: number;
  duplicates: number;
  /** Approved ids that the fresh search did not return for this company. */
  skipped: number;
  creditsUsed: number;
};

/** Re-run the search, keep approved people of the target company, and write them. Safe to repeat. */
export async function importProspeo(
  exhibitorId: string,
  approvedPersonIds: string[],
  deps: ProspeoDeps = {}
): Promise<ImportResult> {
  const approved = new Set(approvedPersonIds);
  const fetched = await fetchForTarget(exhibitorId, deps);
  const chosen = fetched.matched.filter((contact) => approved.has(contact.externalId));
  const foundIds = new Set(chosen.map((contact) => contact.externalId));
  const skipped = Array.from(approved).filter((id) => !foundIds.has(id)).length;

  const db = deps.db ?? (await defaultDb());
  const existing = (await db.exhibitorContact.findMany({ where: { exhibitorId, source: PROSPEO_SOURCE } })).map(toExisting);
  const plan = planImport(existing, chosen);

  let imported = 0;
  if (plan.create.length > 0) {
    // skipDuplicates: if an earlier interrupted run already wrote a row, the
    // unique (exhibitorId, source, externalId) index makes this a no-op.
    const result = await db.exhibitorContact.createMany({
      data: plan.create.map((row) => ({ ...row, exhibitorId, source: PROSPEO_SOURCE })),
      skipDuplicates: true,
    });
    imported = result.count;
  }
  for (const row of plan.update) {
    await db.exhibitorContact.update({
      where: { id: row.id },
      data: { ...row.changes, ...(row.adoptExternalId ? { externalId: row.externalId } : {}) },
    });
  }

  return {
    imported,
    updated: plan.update.length,
    unchanged: plan.unchanged.length,
    duplicates: plan.duplicates.length + (plan.create.length - imported),
    skipped,
    creditsUsed: fetched.creditsUsed,
  };
}

export type StoredExhibitorContact = ExistingContactRow;

/** Imported Prospeo rows for an exhibitor; [] if none (or the table is not migrated yet). */
export async function listProspeoContacts(exhibitorId: string, db?: ContactStore): Promise<StoredExhibitorContact[]> {
  try {
    const store = db ?? (await defaultDb());
    const rows = await store.exhibitorContact.findMany({
      where: { exhibitorId, source: PROSPEO_SOURCE },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toExisting);
  } catch (error) {
    console.error("Could not load Prospeo contacts:", error);
    return [];
  }
}

export { ProspeoError };
