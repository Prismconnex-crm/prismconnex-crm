import { NextResponse } from 'next/server';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import { resolveExhibitors, withCatalogueLinks, withCleanCards, withDisplayLogos } from '@/lib/find-shows/exhibitor-resolver';

export const runtime = 'nodejs';
// The directory is cached per edition inside the resolver; the route runs per request.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * How long one request waits for a search. A search that takes longer keeps
 * running and stores its result; the answer is then `pending: true` and the
 * Exhibitors tab asks again, so no request outlives the platform's limit.
 */
const WAIT_MS = 25_000;

/**
 * The event edition's official exhibitor directory, resolved on demand when
 * the Exhibitors tab is opened: `{ status, source, exhibitors, reason, total,
 * cached, refreshing, pending }` with status VERIFIED_LIST |
 * LOGIN_REQUIRED_DIRECTORY | VERIFIED_EMPTY_DIRECTORY | NO_VERIFIED_DIRECTORY |
 * DISCOVERY_INCOMPLETE (see lib/find-shows/exhibitors.ts). `?retry=1` (the
 * tab's "Try again") searches again after an unfinished check; in development
 * `?fresh=1` searches again whatever is stored.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const event = findShowEventsBySlug[params.get('slug') ?? ''];
  if (!event) {
    return NextResponse.json({ error: 'Unknown event.' }, { status: 404 });
  }
  const refresh = process.env.NODE_ENV !== 'production' && params.get('fresh') === '1';
  const retry = params.get('retry') === '1';
  try {
    const resolved = await resolveExhibitors(event, { refresh, retry, waitMs: WAIT_MS });
    return NextResponse.json({ ...withDisplayLogos(withCleanCards(withCatalogueLinks(resolved)), event.slug), cached: resolved.cached, refreshing: resolved.refreshing ?? false, pending: resolved.pending ?? false });
  } catch (error) {
    console.error('[find-shows/exhibitors]', error);
    return NextResponse.json({ error: 'Exhibitor directory could not be loaded.' }, { status: 500 });
  }
}
