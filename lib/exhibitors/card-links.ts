import { safeWebsiteUrl } from './website-viewer';
import type { Exhibitor } from '@/types/exhibitors';

/**
 * The links an exhibitor card and its details drawer show in the CRM Exhibitors tab — the same rules for every
 * event, taken only from the exhibitor's own EventExhibitor row. Nothing is guessed and nothing is borrowed
 * from another event: a row without a link gets no link, and no placeholder text stands in for it.
 */
type ExhibitorLinkFields = Pick<Exhibitor, 'website' | 'profileUrl' | 'directoryUrl'>;

/** The verified official website as a safe http(s) URL, or null — then the website area stays blank. */
export function exhibitorOfficialWebsite(ex: Pick<Exhibitor, 'website'>): string | null {
  return safeWebsiteUrl(ex.website);
}

export type ExhibitorCardAction = { href: string; label: 'View detail' | 'Open show directory' };

/**
 * The card's action pill: "View detail" opens the official website, else the exhibitor's own profile on the
 * event's directory; "Open show directory" opens the event's directory when that is the only link the row
 * has. Null — no pill — when the row has no safe link at all.
 */
export function exhibitorCardAction(ex: ExhibitorLinkFields): ExhibitorCardAction | null {
  const detail = safeWebsiteUrl(ex.website) ?? safeWebsiteUrl(ex.profileUrl);
  if (detail) return { href: detail, label: 'View detail' };
  const directory = safeWebsiteUrl(ex.directoryUrl);
  return directory ? { href: directory, label: 'Open show directory' } : null;
}
