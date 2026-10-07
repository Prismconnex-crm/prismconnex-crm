import { NextResponse } from 'next/server';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import { getFindShowDetail } from '@/lib/find-shows/eventseye';
import { resolveTravelInfo } from '@/lib/find-shows/travel-resolver';

export const runtime = 'nodejs';
// Resolution is cached per venue inside the resolver; the route itself runs per request.
export const dynamic = 'force-dynamic';

/** How to Reach data for one event, resolved lazily when its tab is opened. */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  const event = findShowEventsBySlug[slug];
  if (!event) {
    return NextResponse.json({ error: 'Unknown event.' }, { status: 404 });
  }

  // The scraped street address helps pin venues the map does not know by name;
  // the tab still works without it.
  const fullVenueAddress = await getFindShowDetail(slug)
    .then((detail) => detail.fullVenueAddress)
    .catch(() => null);

  const info = await resolveTravelInfo({ ...event, fullVenueAddress });
  return NextResponse.json(info);
}
