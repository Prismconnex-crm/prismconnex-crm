/**
 * Where a signed-out visitor lands after signing in from a public exhibitor's "View details": the CRM's own
 * event page, Exhibitors tab, with that exhibitor's details open — not the public Find Shows page.
 *
 *   /app/events/<event slug>?tab=Exhibitors&exhibitorUrl=<directory profile URL>&exhibitorName=<name>
 *
 * The public card and the CRM row are different records (the public list lives in the directory store, the
 * CRM in EventExhibitor), so the address carries what both share: the directory profile URL, which the CRM
 * sync stores as `sourceDetailUrl`, and the name as the fallback for rows imported from another source
 * (BETT). /api/exhibitors/resolve turns them into the CRM row after sign-in; the tab opens its details and
 * drops both parameters, so a reload or Back does not reopen them.
 *
 * Every value is checked on the way in and on the way out: a slug of catalog shape, an http(s) profile URL
 * and a bounded name. Anything else builds no address (the caller keeps its old return) and reads as nothing.
 */

export const CRM_EXHIBITOR_PARAMS = { url: 'exhibitorUrl', name: 'exhibitorName' } as const;

/** The CRM event page's tab name, as EventDetailView reads it from `?tab=`. */
export const CRM_EXHIBITORS_TAB = 'Exhibitors';

export type ReturnedExhibitor = { profileUrl: string | null; name: string | null };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 200;
const MAX_NAME = 200;
const MAX_URL = 1000;

export function isEventSlug(value: string | null | undefined): value is string {
  return !!value && value.length <= MAX_SLUG && SLUG.test(value);
}

function cleanUrl(value: string | null | undefined): string | null {
  if (!value || value.length > MAX_URL) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function cleanName(value: string | null | undefined): string | null {
  const name = value?.trim();
  return name && name.length <= MAX_NAME ? name : null;
}

/** The CRM address for this event's exhibitor, or null when the slug or the exhibitor does not check out. */
export function crmExhibitorDetailsPath(eventSlug: string, exhibitor: { profileUrl?: string | null; name?: string | null }): string | null {
  if (!isEventSlug(eventSlug)) return null;
  const profileUrl = cleanUrl(exhibitor.profileUrl);
  const name = cleanName(exhibitor.name);
  if (!profileUrl && !name) return null;
  const params = new URLSearchParams({ tab: CRM_EXHIBITORS_TAB });
  if (profileUrl) params.set(CRM_EXHIBITOR_PARAMS.url, profileUrl);
  if (name) params.set(CRM_EXHIBITOR_PARAMS.name, name);
  return `/app/events/${eventSlug}?${params.toString()}`;
}

/** The exhibitor an address asks the CRM tab to open, or null when it carries none (or nothing valid). */
export function readReturnedExhibitor(search: string): ReturnedExhibitor | null {
  const params = new URLSearchParams(search);
  const profileUrl = cleanUrl(params.get(CRM_EXHIBITOR_PARAMS.url));
  const name = cleanName(params.get(CRM_EXHIBITOR_PARAMS.name));
  return profileUrl || name ? { profileUrl, name } : null;
}

/** The same address without the exhibitor to open; every other parameter is kept. */
export function withoutReturnedExhibitor(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(CRM_EXHIBITOR_PARAMS.url);
  params.delete(CRM_EXHIBITOR_PARAMS.name);
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}
