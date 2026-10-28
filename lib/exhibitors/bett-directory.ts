/**
 * Parsing for an exhibitor's official BETT directory profile.
 *
 * The directory is the best source for these records — the description is copy
 * the exhibitor wrote for this show, and the categories are the organiser's own
 * taxonomy. Both were nearly missed: the stored sourceDetailUrl points at
 * /solution-providers/exhibitors/<slug>, which 301s to the listing, and the
 * listing's own category block is empty for every exhibitor. Only
 * /exhibitors/<slug> carries the real thing.
 *
 * Kept separate from the fetching script so the parsing can be tested against
 * fixed markup without network access.
 */

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', trade: '™',
  reg: '®', copy: '©',
};

export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

/**
 * Markup to readable prose.
 *
 * Profile copy is largely bullet lists, and stripping tags without marking the
 * boundaries runs them together into one unreadable sentence — "...for all
 * major MIS Pupil photos visible within tools and reports View and compare
 * multiple data points..." came out of the first version. Closing block tags
 * become full stops so the list reads as sentences.
 */
export function htmlToText(html: string): string {
  return decodeEntities(
    String(html)
      .replace(/<\/(li|p|h[1-6]|div|tr)\s*>/gi, '. ')
      .replace(/<br\s*\/?>/gi, '. ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    // Collapse the punctuation those substitutions can double up.
    .replace(/\s*\.\s*(?=[.;:,])/g, '')
    .replace(/(\.\s*){2,}/g, '. ')
    .replace(/\s+([.;:,])/g, '$1')
    .trim()
    .replace(/^[.\s]+/, '');
}

/** Minimum length for profile copy to be worth storing over nothing. */
const MIN_DESCRIPTION = 40;

/** The exhibitor's own profile copy, as published in the directory. */
export function extractDirectoryDescription(html: string): string | null {
  const block = html.match(
    /m-exhibitor-entry__item__body__description["'][^>]*>([\s\S]*?)<\/div>/
  );
  if (!block) return null;
  const value = htmlToText(block[1]);
  return value.length >= MIN_DESCRIPTION ? value : null;
}

/**
 * The show's own category tags.
 *
 * A stray "No" shows up as a second item on many profiles — a form field
 * leaking into the list rather than a category, so bare yes/no values are
 * dropped.
 */
export function extractDirectoryCategories(html: string): string[] {
  const list = html.match(
    /m-exhibitor-entry__item__header__infos__categories["'][^>]*>([\s\S]*?)<\/ul>/
  );
  if (!list) return [];

  const items: string[] = [];
  // exec in a loop rather than matchAll: this repo's ES5 target cannot iterate
  // the iterator matchAll returns.
  const pattern = /<li[^>]*>([\s\S]*?)<\/li>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(list[1])) !== null) {
    // The <i> is a "|" separator glyph between tags, not content.
    const value = htmlToText(match[1].replace(/<i[^>]*>[\s\S]*?<\/i>/g, ' '));
    if (value && value.length > 2 && !/^(no|yes)$/i.test(value)) items.push(value);
  }
  return items;
}

/**
 * The live profile path for a stored sourceDetailUrl.
 *
 * Records hold /solution-providers/exhibitors/<slug>, which redirects to the
 * listing; the profile itself is at /exhibitors/<slug>.
 */
export function directoryProfileUrl(sourceDetailUrl: string | null): string | null {
  if (!sourceDetailUrl) return null;
  const parts = sourceDetailUrl.replace(/\/+$/, '').split('/');
  const slug = parts[parts.length - 1];
  return slug ? `https://uk.bettshow.com/exhibitors/${slug}` : null;
}
