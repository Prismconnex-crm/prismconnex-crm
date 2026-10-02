/**
 * Shared facts about the BETT exhibitor import.
 *
 * The tag is written into DiscoveryCompany.tags by
 * scripts/import-bett-exhibitors-to-companies.mjs and is what marks a company
 * row as "this is also a trade-show exhibitor". Keeping it in one place means
 * the import, the revert and the UI cannot drift apart on the spelling.
 */

export const BETT_IMPORT_TAG = "BETT SHOW 2027 Exhibitor";

/** True when a company row came from the BETT exhibitor import. */
export function isBettExhibitorCompany(tags: string[] | string | null | undefined): boolean {
  if (!tags) return false;
  const list = Array.isArray(tags) ? tags : tags.split(",");
  return list.some((tag) => tag.trim().toLowerCase() === BETT_IMPORT_TAG.toLowerCase());
}

/** Bare host — the shape DiscoveryCompany.domain is stored in. */
export function bareDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  const bare = url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase();
  return bare || null;
}

/** Company suffixes a show directory appends but the dataset usually omits. */
const NAME_SUFFIXES =
  /\b(ltd|limited|llc|inc|incorporated|corp|corporation|plc|gmbh|bv|nv|ab|as|sa|srl|spa|pty|pte|co|company|group|holdings|international)\b/g;

/**
 * Lower-case, accent-stripped, punctuation- and suffix-free, so "ClassVR Ltd."
 * and "ClassVR" compare equal. Used only to match an exhibitor to a company —
 * never for display.
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(NAME_SUFFIXES, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}
