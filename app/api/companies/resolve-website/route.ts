import { NextResponse } from "next/server";
import { promises as dns } from "dns";

export const dynamic = "force-dynamic";

// Resolves a company's real official website on demand:
// 1. use the stored domain if it actually resolves in DNS,
// 2. otherwise search the web (DuckDuckGo HTML) and pick the first
//    non-directory result whose domain plausibly matches the company name,
// 3. otherwise try DNS on name-derived candidate domains.
// Results (including "not found") are cached in memory so repeat views are instant.

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // found sites
const NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000; // "no site found"
const CACHE_MAX = 5000;

type CacheEntry = { website: string | null; expires: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();

// Directories/aggregators/socials that a "official website" search surfaces
// but are never the company's own site.
const BLOCKED_HOSTS = [
  "duckduckgo.com",
  "wikipedia.org",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "pinterest.com",
  "crunchbase.com",
  "zoominfo.com",
  "dnb.com",
  "bloomberg.com",
  "glassdoor.com",
  "indeed.com",
  "justdial.com",
  "indiamart.com",
  "tradeindia.com",
  "zaubacorp.com",
  "tofler.in",
  "thecompanycheck.com",
  "economictimes.com",
  "instafinancials.com",
  "falconebiz.com",
  "allindiaitr.com",
  "quickcompany.in",
  "amazon.com",
  "amazon.in",
  "google.com",
  "maps.google.com",
  "yelp.com",
  "tracxn.com",
  "apollo.io",
  "signalhire.com",
  "rocketreach.co",
];

const GENERIC_NAME_WORDS = new Set([
  "ltd",
  "limited",
  "pvt",
  "private",
  "inc",
  "llc",
  "llp",
  "corp",
  "corporation",
  "company",
  "group",
  "co",
  "the",
  "and",
  "of",
  "india",
  "global",
  "international",
  "worldwide",
  "solutions",
  "services",
  "enterprises",
  "industries",
  "technologies",
]);

function cleanName(name: string) {
  return name.replace(/\s+\d+$/, "").trim();
}

function nameTokens(name: string) {
  return cleanName(name)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !GENERIC_NAME_WORDS.has(t) && !/^\d+$/.test(t));
}

// Consonant skeleton so "natarajan" still matches the real "natrajan" domain.
function skeleton(value: string) {
  return value.replace(/[aeiou]/g, "");
}

function hostMatchesName(host: string, name: string) {
  const hostFlat = host.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hostSkeleton = skeleton(hostFlat);
  return nameTokens(name).some(
    (token) => hostFlat.includes(token) || hostSkeleton.includes(skeleton(token))
  );
}

function isBlockedHost(host: string) {
  const normalized = host.toLowerCase();
  return BLOCKED_HOSTS.some((blocked) => normalized === blocked || normalized.endsWith(`.${blocked}`));
}

async function dnsResolves(host: string) {
  try {
    await dns.lookup(host);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// Parse DuckDuckGo HTML results into result URLs (they arrive as /l/?uddg=<encoded> redirects).
function parseDuckDuckGoResults(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const linkPattern = /href="([^"]*(?:uddg=)[^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null && urls.length < 10) {
    const uddg = /[?&]uddg=([^&"]+)/.exec(match[1]);
    if (!uddg) continue;
    try {
      const decoded = decodeURIComponent(uddg[1]);
      if (!/^https?:\/\//i.test(decoded)) continue;
      const host = new URL(decoded).hostname;
      if (seen.has(host)) continue;
      seen.add(host);
      urls.push(decoded);
    } catch {
      // ignore malformed result URLs
    }
  }
  return urls;
}

async function searchOfficialSite(name: string): Promise<string | null> {
  const query = encodeURIComponent(`${cleanName(name)} official website`);
  let html: string;
  try {
    const response = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${query}`, 6000);
    if (!response.ok) return null;
    html = await response.text();
  } catch {
    return null;
  }

  for (const url of parseDuckDuckGoResults(html)) {
    const host = new URL(url).hostname;
    if (isBlockedHost(host)) continue;
    if (!hostMatchesName(host, name)) continue;
    if (!(await dnsResolves(host))) continue;
    return `https://${host}`;
  }
  return null;
}

// Last resort: guess domains straight from the name and keep any that exist in DNS.
async function guessDomains(name: string): Promise<string | null> {
  const slug = cleanName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (slug.length < 4 || slug.length > 40) return null;
  for (const tld of ["com", "in", "co.in"]) {
    const host = `${slug}.${tld}`;
    if (await dnsResolves(host)) return `https://${host}`;
  }
  return null;
}

// Generated seed domains (long digit runs) are never worth a DNS check as "stored" domains.
function looksGenerated(domain: string) {
  return /\d{4,}/.test(domain);
}

async function resolveWebsite(name: string, domain: string): Promise<string | null> {
  if (domain && !looksGenerated(domain) && (await dnsResolves(domain))) {
    return `https://${domain}`;
  }
  const searched = await searchOfficialSite(name);
  if (searched) return searched;
  return guessDomains(name);
}

function cacheGet(key: string) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.website;
}

function cacheSet(key: string, website: string | null) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, {
    website,
    expires: Date.now() + (website ? CACHE_TTL_MS : NEGATIVE_TTL_MS),
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") ?? "").trim();
  const domain = (searchParams.get("domain") ?? "").trim().toLowerCase();

  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Missing or invalid name" }, { status: 400 });
  }

  const key = cleanName(name).toLowerCase();
  const cached = cacheGet(key);
  if (cached !== undefined) {
    return NextResponse.json({ website: cached, cached: true });
  }

  let pending = inFlight.get(key);
  if (!pending) {
    pending = resolveWebsite(name, domain).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }

  try {
    const website = await pending;
    cacheSet(key, website);
    return NextResponse.json({ website, cached: false });
  } catch {
    return NextResponse.json({ website: null, cached: false });
  }
}
