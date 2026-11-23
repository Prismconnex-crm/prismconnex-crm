/**
 * Decide what an import does, before touching the database. Pure, so the
 * duplicate rules are tested without a database.
 *
 * Matching an incoming person to an existing row: Prospeo person id first,
 * then normalised LinkedIn profile. A match is updated only with fields that
 * are non-empty in the incoming data and actually differ — an empty Prospeo
 * value never wipes a stored one. The same person appearing twice in one batch
 * is imported once.
 */
import type { ProspeoContact } from "@/lib/prospeo/map";

/** The stored fields an import may write. */
export const CONTACT_FIELDS = [
  "fullName",
  "personLinkedInUrl",
  "linkedinKey",
  "companyName",
  "companyLinkedInUrl",
  "jobTitle",
  "email",
  "emailStatus",
  "mobile",
  "mobileStatus",
  "country",
  "city",
  "seniority",
  "industry",
  "companySize",
] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];
export type StoredContactValues = { [K in ContactField]: K extends "companySize" ? number | null : string | null };

export type ExistingContactRow = StoredContactValues & { id: string; externalId: string | null };

export type ImportPlan = {
  create: Array<StoredContactValues & { externalId: string }>;
  update: Array<{
    id: string;
    externalId: string;
    fullName: string;
    changes: Partial<StoredContactValues>;
    /** Matched by LinkedIn on a row with no provider id yet: record the id too. */
    adoptExternalId: boolean;
  }>;
  /** Already imported and nothing new to add. */
  unchanged: Array<{ id: string; externalId: string; fullName: string }>;
  /** Same person repeated within this batch. */
  duplicates: Array<{ externalId: string; fullName: string }>;
};

const isEmpty = (value: unknown) => value === null || value === undefined || value === "";

export function storedValuesOf(contact: ProspeoContact): StoredContactValues {
  const values = {} as Record<ContactField, unknown>;
  for (const field of CONTACT_FIELDS) values[field] = contact[field];
  return values as StoredContactValues;
}

export function planImport(existing: ExistingContactRow[], incoming: ProspeoContact[]): ImportPlan {
  const plan: ImportPlan = { create: [], update: [], unchanged: [], duplicates: [] };
  const byExternalId = new Map(existing.filter((row) => row.externalId).map((row) => [row.externalId!, row]));
  const byLinkedin = new Map(existing.filter((row) => row.linkedinKey).map((row) => [row.linkedinKey!, row]));
  const seenIds = new Set<string>();
  const seenLinkedin = new Set<string>();

  for (const contact of incoming) {
    if (seenIds.has(contact.externalId) || (contact.linkedinKey && seenLinkedin.has(contact.linkedinKey))) {
      plan.duplicates.push({ externalId: contact.externalId, fullName: contact.fullName });
      continue;
    }
    seenIds.add(contact.externalId);
    if (contact.linkedinKey) seenLinkedin.add(contact.linkedinKey);

    const values = storedValuesOf(contact);
    const match =
      byExternalId.get(contact.externalId) ?? (contact.linkedinKey ? byLinkedin.get(contact.linkedinKey) : undefined);

    if (!match) {
      plan.create.push({ ...values, externalId: contact.externalId });
      continue;
    }

    const changes: Partial<StoredContactValues> = {};
    for (const field of CONTACT_FIELDS) {
      const next = values[field];
      if (!isEmpty(next) && next !== match[field]) (changes as Record<string, unknown>)[field] = next;
    }
    const adoptExternalId = match.externalId === null;
    if (Object.keys(changes).length > 0 || adoptExternalId) {
      plan.update.push({ id: match.id, externalId: contact.externalId, fullName: contact.fullName, changes, adoptExternalId });
    } else {
      plan.unchanged.push({ id: match.id, externalId: contact.externalId, fullName: contact.fullName });
    }
  }
  return plan;
}
