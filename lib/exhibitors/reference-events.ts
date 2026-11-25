/**
 * The three events whose CRM exhibitors were imported and verified by hand before the catalog-wide sync —
 * ALLES FÜR DEN GAST (634 rows, 394 verified websites), BETT (316, its own importer) and AAPEX (2,181).
 *
 * The catalog-wide CRM sync (scripts/exhibitors/sync-crm.ts) never touches them: no top-up from a newer public
 * list, no refresh of a stand or logo. Their rows stay exactly as imported unless someone changes them on
 * purpose with that event's own tooling.
 */
export const REFERENCE_EXHIBITOR_EVENT_SLUGS: ReadonlySet<string> = new Set([
  'alles-fur-den-gast-salzburg-2026-11-07',
  'bett-show-london-2027-01-20',
  'aapex-las-vegas-nv-2026-11-03',
]);

export function isReferenceExhibitorEvent(slug: string) {
  return REFERENCE_EXHIBITOR_EVENT_SLUGS.has(slug);
}
