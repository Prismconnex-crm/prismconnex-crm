import { NextResponse } from 'next/server';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import { storedExhibitors } from '@/lib/find-shows/exhibitor-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Prismconnex-FindShows/1.0';
const MAX_BYTES = 2_000_000;

/**
 * Serves one exhibitor's logo from this origin, for directories whose logo
 * files refuse to load on other sites. Only the logo of a card in the event's
 * stored, verified directory is ever fetched — never a URL from the request —
 * and only an image is passed on.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const event = findShowEventsBySlug[params.get('slug') ?? ''];
  if (!event) return NextResponse.json({ error: 'Unknown event.' }, { status: 404 });

  const directory = await storedExhibitors(event);
  const card = directory?.exhibitors.find((item) => item.id === params.get('id'));
  if (!card?.logoUrl) return NextResponse.json({ error: 'No logo for this exhibitor.' }, { status: 404 });

  let upstream: Response;
  try {
    upstream = await fetch(card.logoUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return NextResponse.json({ error: 'The logo could not be reached.' }, { status: 502 });
  }
  const contentType = upstream.headers.get('content-type') ?? '';
  const length = Number(upstream.headers.get('content-length') ?? 0);
  if (!upstream.ok || !upstream.body || !contentType.startsWith('image/') || length > MAX_BYTES) {
    await upstream.body?.cancel().catch(() => undefined);
    return NextResponse.json({ error: 'The logo is not available.' }, { status: 502 });
  }
  const body = Buffer.from(await upstream.arrayBuffer());
  if (body.byteLength > MAX_BYTES) return NextResponse.json({ error: 'The logo is too large.' }, { status: 502 });

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800',
      'X-Content-Type-Options': 'nosniff',
      // An SVG logo must not run script when opened directly.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
