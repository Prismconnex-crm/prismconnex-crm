import { NextResponse } from 'next/server';
import { getFindShowAsset } from '@/lib/find-shows/eventseye';

export const runtime = 'nodejs';

function isValidSlugList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || !isValidSlugList(body.slugs)) {
    return NextResponse.json(
      { error: 'Expected a JSON body with a slugs array.' },
      { status: 400 }
    );
  }

  const uniqueSlugs = Array.from(new Set(body.slugs as string[])).slice(0, 24);
  const assets = await Promise.all(
    uniqueSlugs.map(async (slug) => ({
      slug,
      asset: await getFindShowAsset(slug),
    }))
  );

  return NextResponse.json(Object.fromEntries(assets.map((entry) => [entry.slug, entry.asset])), {
    headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=43200' },
  });
}
