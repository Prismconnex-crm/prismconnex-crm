import { NextResponse } from 'next/server';
import { buildCountryDebugReport } from '@/lib/find-shows/country-debug';

export const runtime = 'nodejs';

/**
 * Dev-only: how each Find Shows event got its country. Filter with
 * ?region=Americas&country=Unknown (also ?source=organizer, ?confidence=low).
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  return NextResponse.json(
    buildCountryDebugReport({
      region: params.get('region'),
      country: params.get('country'),
      source: params.get('source'),
      confidence: params.get('confidence'),
    })
  );
}
