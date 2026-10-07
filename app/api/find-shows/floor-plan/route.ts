import { NextResponse } from 'next/server';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import { getFindShowDetail } from '@/lib/find-shows/eventseye';
import { blocksFraming } from '@/lib/find-shows/floor-plan';
import { resolveFloorPlan } from '@/lib/find-shows/floor-plan-resolver';

export const runtime = 'nodejs';
// The lookup is cached per edition inside the resolver; the route runs per request.
export const dynamic = 'force-dynamic';
// A first search follows the official site's pages and documents: allow it time.
export const maxDuration = 90;

/** The discovery trace is shown in development, or anywhere with FIND_SHOWS_FLOOR_PLAN_DEBUG=1. */
const floorPlanDebugAllowed = () =>
  process.env.NODE_ENV !== 'production' || process.env.FIND_SHOWS_FLOOR_PLAN_DEBUG === '1';

const embeddable = new Map<string, boolean>();

/** Whether a page may be shown in a frame on this site (no X-Frame-Options / CSP frame-ancestors refusal). */
async function canEmbed(url: string) {
  const known = embeddable.get(url);
  if (known !== undefined) return known;
  let allowed = false;
  try {
    const response = await fetch(url, { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(6_000), headers: { 'User-Agent': 'Mozilla/5.0 Prismconnex-FindShows/1.0' } });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => (headers[key.toLowerCase()] = value));
    await response.body?.cancel().catch(() => undefined);
    allowed = response.ok && !blocksFraming(headers);
  } catch {
    allowed = false;
  }
  embeddable.set(url, allowed);
  return allowed;
}

/**
 * The event's floor plan, resolved when its tab is opened: `{ status, floorPlan }`
 * with status VERIFIED_PLAN | VERIFIED_NO_PLAN | DISCOVERY_INCOMPLETE |
 * NETWORK_ERROR | DOWNLOAD_FAILED (see floor-plan-discovery.ts). Answers
 * precomputed by the catalog batch (scripts/floor-plans) are served from the
 * edition store. With ?debug=1 (development) the discovery trace is included;
 * ?debug=1&fresh=1 searches again instead of using the stored answer.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get('slug') ?? '';
  const event = findShowEventsBySlug[slug];
  if (!event) {
    return NextResponse.json({ error: 'Unknown event.' }, { status: 404 });
  }
  const debug = params.get('debug') === '1' && floorPlanDebugAllowed();

  // The listing's contact website may be the site's current address; the search works without it.
  const contactWebsite = async () => [
    await Promise.race([
      getFindShowDetail(slug).then((detail) => detail.website).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
    ]),
  ];

  const result = await resolveFloorPlan(event, {
    fresh: debug && params.get('fresh') === '1',
    retry: params.get('retry') === '1',
    extraWebsites: contactWebsite,
  });
  let floorPlan = result.floorPlan;
  if (floorPlan && (floorPlan.kind === 'pdf' || floorPlan.kind === 'image')) {
    floorPlan = { ...floorPlan, viewUrl: `/api/find-shows/floor-plan/file?slug=${encodeURIComponent(slug)}` };
  } else if (floorPlan && floorPlan.embeddable === undefined) {
    // A plan page judged from the crawl has no framing answer yet: ask the site once.
    floorPlan = { ...floorPlan, embeddable: await canEmbed(floorPlan.url) };
  }

  return NextResponse.json({
    status: result.status,
    floorPlan,
    reason: result.reason,
    ...(debug ? { cached: result.cached, checkedAt: result.checkedAt, lastAttempt: result.lastAttempt, trace: result.trace } : {}),
  });
}
