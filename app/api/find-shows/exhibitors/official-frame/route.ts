import { NextResponse } from 'next/server';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import { storedExhibitors, withCatalogueLinks } from '@/lib/find-shows/exhibitor-resolver';
import { httpFetcher } from '@/lib/find-shows/floor-plan-discovery';
import { UNCHECKED, frameVerdict, type FrameVerdict } from '@/lib/find-shows/official-frame';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TTL_MS = 10 * 60 * 1000;
const verdicts = new Map<string, { at: number; verdict: FrameVerdict }>();

/**
 * Whether an official exhibitor page may be shown inside Prismconnex: GET ?slug=<event>&kind=profile&id=<card>
 * (a stored card's official profile) or kind=directory|login (the event's stored official directory or its
 * sign-in page). Only addresses already in the event's stored exhibitor record are checked — never a URL
 * from the request — and nothing is searched: the official page's own headers are read and respected.
 * Answers { url, frame: allowed | blocked | unknown, reason }.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const event = findShowEventsBySlug[params.get('slug') ?? ''];
  if (!event) return NextResponse.json({ error: 'Unknown event.' }, { status: 404 });
  const stored = await storedExhibitors(event);
  if (!stored?.source) return NextResponse.json({ error: 'No official exhibitor directory is stored for this event.' }, { status: 404 });

  const kind = params.get('kind') ?? 'profile';
  let url: string | null = null;
  if (kind === 'profile') {
    const id = params.get('id') ?? '';
    url = withCatalogueLinks(stored).exhibitors.find((card) => card.id === id)?.profileUrl ?? null;
  } else if (kind === 'directory') {
    url = stored.source.directoryUrl;
  } else if (kind === 'login') {
    url = stored.source.loginUrl ?? stored.source.directoryUrl;
  }
  if (!url) return NextResponse.json({ error: 'No such official page is stored for this event.' }, { status: 404 });

  const origin = new URL(request.url).origin;
  const cached = verdicts.get(`${origin} ${url}`);
  if (cached && Date.now() - cached.at < TTL_MS) return NextResponse.json({ url, ...cached.verdict });

  let verdict: FrameVerdict;
  try {
    const answer = await httpFetcher(url, { accept: 'text/html,*/*;q=0.5', timeoutMs: 12_000, maxBytes: 64_000 });
    verdict = frameVerdict({ ...answer, challenged: /challenge/.test(answer.headers['cf-mitigated'] ?? '') }, origin);
  } catch {
    // Not reachable from here (timeout, network): nothing confirms the page may be framed.
    verdict = { frame: 'unknown', reason: UNCHECKED.unreachable };
  }
  verdicts.set(`${origin} ${url}`, { at: Date.now(), verdict });
  return NextResponse.json({ url, ...verdict });
}
