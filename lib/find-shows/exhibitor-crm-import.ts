/**
 * Turns an edition's stored public exhibitor directory (the one the Find Shows Exhibitors tab shows) into
 * EventExhibitor rows for the CRM event's Exhibitors tab, which reads only that table. Used by
 * lib/exhibitors/crm-sync.ts (the CRM exhibitor sync), one catalog slug at a time.
 *
 * The cards go through the same display steps as /api/find-shows/exhibitors, so the CRM shows exactly the
 * public list: cleaned names and descriptions, and the app's logo proxy for platforms that block hotlinking.
 * Only what the directory publishes is kept — name, logo, booths, description, official profile page.
 * Website, country and contacts stay null: a directory card does not carry them, and nothing is inferred.
 */
import type { ExhibitorRecord } from './exhibitor-resolver';
import { withCatalogueLinks, withCleanCards, withDisplayLogos } from './exhibitor-resolver';
import { exhibitorNameKey } from '../../scripts/lib/exhibitor-name-key.mjs';

export type CrmExhibitorRow = {
  eventSlug: string;
  companyName: string;
  nameKey: string | null;
  logoUrl: string | null;
  /** The exhibitor's official profile page: also the (eventSlug, sourceDetailUrl) upsert key. */
  sourceDetailUrl: string;
  sourceDirectoryUrl: string | null;
  standNumber: string | null;
  description: string | null;
  /** The directory platform, e.g. "map-your-show". */
  source: string;
};

export class CrmImportRefused extends Error {}

/**
 * The rows to import for one event, or a CrmImportRefused saying why there is nothing safe to import:
 * no stored record, a record for another edition, or no verified public list.
 */
export function crmRowsFromRecord(eventSlug: string, record: ExhibitorRecord | null): CrmExhibitorRow[] {
  if (!record) throw new CrmImportRefused(`No stored exhibitor directory for ${eventSlug}; open its Find Shows Exhibitors tab first.`);
  if (!record.edition.slugs.includes(eventSlug)) {
    throw new CrmImportRefused(`The stored directory belongs to ${record.edition.slugs.join(', ')}, not ${eventSlug}.`);
  }
  const verified = record.verified;
  if (!verified || verified.status !== 'VERIFIED_LIST' || !verified.source) {
    throw new CrmImportRefused(`${eventSlug} has no verified public exhibitor list (status ${verified?.status ?? record.lastAttempt.status}).`);
  }

  const directory = withDisplayLogos(withCleanCards(withCatalogueLinks(verified)), eventSlug);
  const source = directory.source!;
  const rows: CrmExhibitorRow[] = [];
  const seen = new Set<string>();
  for (const card of directory.exhibitors) {
    // A catalogue-search link is shared by many exhibitors, so it cannot key a row of its own.
    if (card.profileKind === 'catalogue-search') continue;
    if (seen.has(card.profileUrl)) continue;
    seen.add(card.profileUrl);
    rows.push({
      eventSlug,
      companyName: card.name,
      nameKey: exhibitorNameKey(card.name) || null,
      logoUrl: card.logoUrl,
      sourceDetailUrl: card.profileUrl,
      sourceDirectoryUrl: source.directoryUrl,
      standNumber: card.booths.length ? card.booths.join(', ') : null,
      description: card.description,
      source: source.platform,
    });
  }
  return rows;
}
