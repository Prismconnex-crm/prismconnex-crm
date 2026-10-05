import { NextResponse } from 'next/server';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import { resolveFloorPlan, storedFloorPlan } from '@/lib/find-shows/floor-plan-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Prismconnex-FindShows/1.0';

/**
 * Serves an event's verified floor-plan PDF or image from this origin, so the
 * tab can show it inline: organizers' files are often plain http (blocked as
 * mixed content), sent as downloads, or refuse to be framed. Only the plan the
 * resolver verified for this event is ever fetched — never a URL from the
 * request.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  const event = findShowEventsBySlug[slug];
  if (!event) return NextResponse.json({ error: 'Unknown event.' }, { status: 404 });

  const discovery = (await storedFloorPlan(event)) ?? (await resolveFloorPlan(event));
  const plan = discovery.floorPlan;
  if (!plan || (plan.kind !== 'pdf' && plan.kind !== 'image')) {
    return NextResponse.json({ error: 'No floor plan file for this event.' }, { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(plan.url, {
      headers: { 'User-Agent': USER_AGENT, Accept: plan.kind === 'pdf' ? 'application/pdf,*/*' : 'image/*' },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return NextResponse.json({ error: 'The organizer’s file could not be reached.' }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `The organizer’s file returned HTTP ${upstream.status}.` }, { status: 502 });
  }

  const upstreamType = upstream.headers.get('content-type') ?? '';
  const contentType =
    plan.kind === 'pdf' ? 'application/pdf' : upstreamType.startsWith('image/') ? upstreamType : 'image/jpeg';
  const fileName = decodeURIComponent(new URL(plan.url).pathname.split('/').pop() || 'floor-plan').replace(/["\\\r\n]/g, '');
  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Disposition': `inline; filename="${fileName}"`,
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  const length = upstream.headers.get('content-length');
  if (length) headers.set('Content-Length', length);
  return new Response(upstream.body, { status: 200, headers });
}
