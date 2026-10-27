/**
 * The CRM Exhibitors tab's in-app website viewer: "Visit website" opens the exhibitor's page in a sandboxed
 * frame inside Prismconnex (components/find-shows/official-page-view.tsx) instead of leaving the CRM.
 *
 * AAPEX only for now; every other event keeps its plain external link. The page shown is the same one the
 * link opened before — the exhibitor's official website, else its directory profile, else the event's
 * directory — and only plain http(s) addresses are ever shown or framed.
 */

/** Events whose CRM Exhibitors tab opens "Visit website" in the in-app viewer. */
export const IN_APP_WEBSITE_VIEWER_EVENTS: ReadonlySet<string> = new Set(['aapex-las-vegas-nv-2026-11-03']);

export function usesInAppWebsiteViewer(eventSlug: string) {
  return IN_APP_WEBSITE_VIEWER_EVENTS.has(eventSlug);
}

/**
 * The address as a safe http(s) URL, or null: other schemes (javascript:, data:, file:, blob:, …), addresses
 * with embedded credentials and anything unparsable are rejected.
 */
export function safeWebsiteUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password || !url.hostname) return null;
  return url.href;
}

/**
 * Sites verified to refuse framing whose refusal the server cannot read, because they answer servers with a
 * bot challenge instead of the page (so the check says "unknown" and the browser would show a dead frame).
 * Listing one makes the viewer explain at once, with "Open website externally", instead of framing it.
 *
 * Map Your Show (every AAPEX profile): checked 2026-10-09 — servers get HTTP 202 (bot challenge); in Chrome the
 * page is sent with `Content-Security-Policy: frame-ancestors 'self'` and the frame is blocked.
 */
const KNOWN_FRAME_REFUSALS: { hostSuffix: string; reason: string }[] = [
  {
    hostSuffix: 'mapyourshow.com',
    reason: 'The official site does not allow its pages to be shown inside other websites (Content-Security-Policy).',
  },
];

/** Why a verified site refuses to be framed, or null when nothing is known about it. */
export function knownFrameRefusal(url: string): string | null {
  const host = new URL(url).hostname.toLowerCase();
  return KNOWN_FRAME_REFUSALS.find(({ hostSuffix }) => host === hostSuffix || host.endsWith(`.${hostSuffix}`))?.reason ?? null;
}

/** The fields of an exhibitor that can hold its page, in the order "Visit website" has always used. */
export type ExhibitorLinks = {
  website?: string | null;
  profileUrl?: string | null;
  directoryUrl?: string | null;
};

/** The page "Visit website" shows: the first safe one of website → directory profile → event directory. */
export function exhibitorViewerUrl(links: ExhibitorLinks): string | null {
  return safeWebsiteUrl(links.website) ?? safeWebsiteUrl(links.profileUrl) ?? safeWebsiteUrl(links.directoryUrl);
}

/** Which exhibitor's page the viewer shows; null while closed. The tab's search, sort and scroll live elsewhere. */
export type WebsiteViewerState = { exhibitorId: string; name: string; url: string } | null;

/** Opening needs a safe address: an exhibitor without one leaves the viewer closed. */
export function openWebsiteViewer(exhibitor: ExhibitorLinks & { id: string; name: string }): WebsiteViewerState {
  const url = exhibitorViewerUrl(exhibitor);
  return url ? { exhibitorId: exhibitor.id, name: exhibitor.name, url } : null;
}

export const closedWebsiteViewer: WebsiteViewerState = null;
