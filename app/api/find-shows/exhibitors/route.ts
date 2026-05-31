import { NextRequest, NextResponse } from 'next/server';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import type { Exhibitor, ExhibitorCacheStore } from '@/types/exhibitors';
import fs from 'fs';
import path from 'path';

/* ------------------------------------------------------------------ */
/*  Cache helpers                                                      */
/* ------------------------------------------------------------------ */

const CACHE_PATH = path.join(process.cwd(), 'data', 'exhibitors-cache.json');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function readCache(): ExhibitorCacheStore {
  try {
    const raw = fs.readFileSync(CACHE_PATH, 'utf-8');
    return JSON.parse(raw) as ExhibitorCacheStore;
  } catch {
    return {};
  }
}

function writeCache(store: ExhibitorCacheStore) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

/* ------------------------------------------------------------------ */
/*  HTML helpers                                                       */
/* ------------------------------------------------------------------ */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, ' ');
}

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function clean(s: string) {
  return decodeEntities(stripTags(s)).replace(/\s+/g, ' ').trim();
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ------------------------------------------------------------------ */
/*  Scraping strategies                                                */
/* ------------------------------------------------------------------ */

/**
 * Strategy 1: Direct HTML scraping
 * Looks for common exhibitor list patterns in the page markup.
 * Works for sites that server-render their exhibitor lists.
 */
async function scrapeDirectHtml(url: string, eventSlug: string): Promise<Exhibitor[]> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];

    const html = await res.text();
    const exhibitors: Exhibitor[] = [];

    // Pattern: exhibitor cards with class patterns like "exhibitor-card", "exhibitor-item", etc.
    const cardPatterns = [
      // Generic exhibitor card pattern
      /<(?:div|li|article)[^>]*class="[^"]*(?:exhibitor|vendor|sponsor)[^"]*"[^>]*>([\s\S]*?)(?=<(?:div|li|article)[^>]*class="[^"]*(?:exhibitor|vendor|sponsor)|$)/gi,
      // Table row pattern
      /<tr[^>]*>([\s\S]*?)<\/tr>/gi,
    ];

    for (const pattern of cardPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null && exhibitors.length < 200) {
        const block = match[1] || match[0];

        // Extract name
        const nameMatch = block.match(/<(?:h[1-6]|a|strong|span)[^>]*class="[^"]*(?:name|title|company)[^"]*"[^>]*>([^<]+)/i)
          || block.match(/<a[^>]*>([^<]{2,80})<\/a>/i);
        if (!nameMatch) continue;

        const name = clean(nameMatch[1]);
        if (!name || name.length < 2 || name.length > 120) continue;

        // Extract logo URL
        const logoMatch = block.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
        let logoUrl: string | null = null;
        if (logoMatch) {
          logoUrl = logoMatch[1];
          if (logoUrl.startsWith('/')) {
            try {
              logoUrl = new URL(logoUrl, url).toString();
            } catch { /* keep relative */ }
          }
        }

        // Extract stand/booth
        const standMatch = block.match(/(?:stand|booth|hall)\s*[:.]?\s*([A-Z0-9][\w\-\/\.]{0,20})/i);
        const stand = standMatch ? standMatch[1].trim() : null;

        // Extract website link
        const linkMatch = block.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>/i);
        const website = linkMatch ? linkMatch[1] : null;

        const id = `${eventSlug}--${slugify(name)}`;
        if (!exhibitors.find(e => e.id === id)) {
          exhibitors.push({
            id,
            name,
            logoUrl,
            stand,
            website,
            description: null,
            profileUrl: null,
            country: null,
          });
        }
      }
      if (exhibitors.length > 0) break;
    }

    return exhibitors;
  } catch {
    return [];
  }
}

/**
 * Strategy 2: Try common JSON API endpoints
 * Many exhibition platforms expose REST endpoints.
 */
async function scrapeJsonApi(baseUrl: string, eventSlug: string): Promise<Exhibitor[]> {
  const apiPaths = [
    '/api/exhibitors',
    '/api/v1/exhibitors',
    '/exhibitors.json',
    '/api/exhibitor-list',
    '/_next/data/exhibitors.json',
  ];

  for (const apiPath of apiPaths) {
    try {
      const apiUrl = new URL(apiPath, baseUrl).toString();
      const res = await fetch(apiUrl, {
        headers: { 'user-agent': UA, accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) continue;

      const data = await res.json();
      const items = Array.isArray(data) ? data : (data?.exhibitors || data?.data || data?.results || []);
      if (!Array.isArray(items) || items.length === 0) continue;

      return items.slice(0, 200).map((item: any, idx: number) => ({
        id: `${eventSlug}--${slugify(item.name || item.company || `exhibitor-${idx}`)}`,
        name: item.name || item.company || item.title || `Exhibitor ${idx + 1}`,
        logoUrl: item.logo || item.logoUrl || item.image || item.thumbnail || null,
        stand: item.stand || item.booth || item.boothNumber || item.location || null,
        website: item.website || item.url || item.websiteUrl || null,
        description: item.description || item.bio || item.about || null,
        profileUrl: item.profileUrl || item.link || null,
        country: item.country || item.location?.country || null,
      }));
    } catch {
      continue;
    }
  }

  return [];
}

/**
 * Strategy 3: Try exhibitor list sub-pages
 * Many event websites have a dedicated /exhibitors or /exhibitor-list page.
 */
async function scrapeExhibitorSubpage(baseUrl: string, eventSlug: string): Promise<Exhibitor[]> {
  const subPaths = [
    '/exhibitors',
    '/exhibitor-list',
    '/exhibitors-2026',
    '/exhibitors-2025',
    '/our-exhibitors',
    '/who-exhibits',
  ];

  for (const subPath of subPaths) {
    try {
      const pageUrl = new URL(subPath, baseUrl).toString();
      const results = await scrapeDirectHtml(pageUrl, eventSlug);
      if (results.length > 0) return results;
    } catch {
      continue;
    }
  }

  return [];
}

/* ------------------------------------------------------------------ */
/*  Main orchestrator                                                  */
/* ------------------------------------------------------------------ */

async function fetchExhibitors(eventSlug: string): Promise<{
  exhibitors: Exhibitor[];
  source: 'scraped' | 'cached' | 'unavailable';
}> {
  // 1. Check cache
  const cache = readCache();
  const cached = cache[eventSlug];
  if (cached && Date.now() - new Date(cached.lastFetched).getTime() < CACHE_TTL_MS) {
    return { exhibitors: cached.exhibitors, source: 'cached' };
  }

  // 2. Look up event
  const event = findShowEventsBySlug[eventSlug];
  if (!event?.website) {
    return { exhibitors: [], source: 'unavailable' };
  }

  const baseUrl = event.website.startsWith('http')
    ? event.website
    : `https://${event.website}`;

  // 3. Try scraping strategies in order
  let exhibitors: Exhibitor[] = [];

  // Strategy 1: JSON APIs (fastest, most reliable)
  exhibitors = await scrapeJsonApi(baseUrl, eventSlug);

  // Strategy 2: Direct HTML of the main site
  if (exhibitors.length === 0) {
    exhibitors = await scrapeDirectHtml(baseUrl, eventSlug);
  }

  // Strategy 3: Common exhibitor sub-pages
  if (exhibitors.length === 0) {
    exhibitors = await scrapeExhibitorSubpage(baseUrl, eventSlug);
  }

  // 4. Cache and return
  if (exhibitors.length > 0) {
    cache[eventSlug] = {
      eventSlug,
      lastFetched: new Date().toISOString(),
      source: 'scraped',
      exhibitors,
    };
    writeCache(cache);
    return { exhibitors, source: 'scraped' };
  }

  return { exhibitors: [], source: 'unavailable' };
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventSlug } = body as { eventSlug?: string };

    if (!eventSlug || typeof eventSlug !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid eventSlug' },
        { status: 400 }
      );
    }

    const result = await fetchExhibitors(eventSlug);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[exhibitors-api]', err?.message || err);
    return NextResponse.json(
      { exhibitors: [], source: 'unavailable', error: err?.message },
      { status: 500 }
    );
  }
}
