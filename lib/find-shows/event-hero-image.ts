/**
 * High-resolution hero photo for a Find Shows event page.
 *
 * Eventseye only publishes small thumbnails (venue photos are ~160x146 GIFs,
 * logos ~184x57), so stretching them across the ~1024px banner looks blurry.
 * The event's own photo comes from its official site's share image
 * (og:image / twitter:image), and is only used once its real pixel size —
 * measured from the file header, never trusted from meta tags — is large
 * enough to fill the banner. Anything smaller returns null and the page
 * falls back to a gradient rather than upscaling.
 *
 * Pure apart from the injectable fetcher, so tests run offline.
 */

/** Banner is max-w-5xl (1024 CSS px) wide; below this a photo visibly softens. */
export const MIN_HERO_WIDTH = 1200;
// Squarer images are textures or posters, and the 3.5:1 banner would crop most of them away.
const MIN_ASPECT = 1.25;
const MAX_ASPECT = 3.5;
const HTML_BYTE_LIMIT = 1_000_000;
const HEADER_BYTE_LIMIT = 64 * 1024;
// Organiser sites often redirect two or three times before the event page (AGHA: ~9s).
const REQUEST_TIMEOUT_MS = 12_000;

export type HeroImage = { url: string; width: number; height: number };

export type HeroFetcher = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal }
) => Promise<Response>;

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'accept-language': 'en;q=0.9',
};

function decodeAttribute(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .trim();
}

function parseAttributes(tag: string) {
  const attributes: Record<string, string> = {};
  for (const match of Array.from(tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g))) {
    attributes[match[1].toLowerCase()] = decodeAttribute(match[3] ?? match[4] ?? '');
  }
  return attributes;
}

/** Only public http(s) hosts — the URLs come from scraped catalog data. */
export function isFetchableUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return false;
  }
  if (host.includes(':')) return false; // literal IPv6 — never a share image host
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  return true;
}

/** Share-image URLs declared by a page, best first, resolved against the page URL. */
export function extractShareImageUrls(html: string, pageUrl: string): string[] {
  return extractShareImages(html, pageUrl).urls;
}

/** Share images plus the alt text the page declares for them (og:image:alt / twitter:image:alt). */
function extractShareImages(html: string, pageUrl: string) {
  const head = html.slice(0, 200_000);
  const ranked: Record<string, number> = {
    'og:image:secure_url': 0,
    'og:image': 1,
    'og:image:url': 1,
    'twitter:image': 2,
    'twitter:image:src': 2,
  };
  const found: { url: string; rank: number }[] = [];
  const altTexts: string[] = [];

  for (const match of Array.from(head.matchAll(/<meta\b[^>]*>/gi))) {
    const attributes = parseAttributes(match[0]);
    const key = (attributes.property ?? attributes.name ?? '').toLowerCase();
    if ((key === 'og:image:alt' || key === 'twitter:image:alt') && attributes.content) altTexts.push(attributes.content);
    if (!(key in ranked) || !attributes.content) continue;
    found.push({ url: attributes.content, rank: ranked[key] });
  }
  for (const match of Array.from(head.matchAll(/<link\b[^>]*>/gi))) {
    const attributes = parseAttributes(match[0]);
    const rel = (attributes.rel ?? '').toLowerCase();
    if (rel === 'image_src' && attributes.href) found.push({ url: attributes.href, rank: 3 });
    // The image the site preloads is the one it renders first — its hero.
    if (rel === 'preload' && (attributes.as ?? '').toLowerCase() === 'image') {
      const url = attributes.imagesrcset ? largestSrcsetCandidate(attributes.imagesrcset)?.url : attributes.href;
      if (url) found.push({ url, rank: 4 });
    }
  }

  const urls: string[] = [];
  for (const { url } of found.sort((a, b) => a.rank - b.rank)) {
    try {
      const resolved = new URL(url, pageUrl).toString();
      if (!urls.includes(resolved)) urls.push(resolved);
    } catch {
      continue;
    }
  }
  return { urls, text: altTexts.join(' ') };
}

const EVENT_SCHEMA_TYPE = /(?:^|[^a-z])(?:[a-z]*Event|ExhibitionEvent|Festival)$/i;

function schemaImageUrls(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(schemaImageUrls);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return schemaImageUrls(record.url ?? record.contentUrl ?? null);
  }
  return [];
}

/**
 * `image` of schema.org Event objects in the page's JSON-LD — the site's own
 * statement of which picture belongs to the event, so it ranks first.
 */
export function extractEventSchemaImages(html: string, pageUrl: string): string[] {
  return extractEventSchemas(html, pageUrl).flatMap((event) => event.images);
}

/** Each Event object on the page, with its name and images. */
function extractEventSchemas(html: string, pageUrl: string) {
  const events: { name: string; images: string[] }[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const types = ([] as unknown[]).concat(record['@type'] ?? []).map(String);
    if (types.some((type) => EVENT_SCHEMA_TYPE.test(type))) {
      const name = typeof record.name === 'string' ? record.name : '';
      events.push({ name, images: resolveUnique(schemaImageUrls(record.image), pageUrl) });
    }
    if (record['@graph']) visit(record['@graph']);
  };

  for (const match of Array.from(html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))) {
    try {
      visit(JSON.parse(match[1].trim()));
    } catch {
      continue;
    }
  }
  return events;
}

const LAZY_SOURCE_ATTRIBUTES = ['data-lazyload', 'data-lazy-src', 'data-src', 'data-original', 'data-bg', 'src'];
const SRCSET_ATTRIBUTES = ['data-lazy-srcset', 'data-srcset', 'srcset'];
const NON_PHOTO_CONTEXT = /logo|sponsor|partner|icon|avatar|badge|flag|award|qr|payment|placeholder|dummy|spacer|transparent/i;
const MAX_BODY_IMAGES = 8;

function largestSrcsetCandidate(srcset: string) {
  let best: { url: string; width: number } | null = null;
  for (const entry of srcset.split(/,\s+(?=\S)/)) {
    const [url, descriptor = ''] = entry.trim().split(/\s+/);
    const width = Number(descriptor.match(/^(\d+)w$/)?.[1] ?? 0);
    if (url && (!best || width > best.width)) best = { url, width };
  }
  return best;
}

/**
 * Large photos in the page body — slider and header images, including the
 * lazy-loading attributes sliders use instead of `src`. An image that declares
 * itself narrower than the banner, or is marked as a logo/sponsor/icon by its
 * name, alt, class or id, is skipped before any download.
 */
export function extractBodyHeroImages(html: string, pageUrl: string): string[] {
  return extractBodyImages(html, pageUrl).map((image) => image.url);
}

/** How far before an image its section heading may sit, and after it its caption. */
const HEADING_WINDOW = 1500;
const CAPTION_WINDOW = 1500;

/**
 * What the page says right around an image: its figure caption and the
 * nearest heading above it. Unlike the file name, this is the page's own
 * statement about the picture — the evidence the resolver accepts.
 */
function imageContext(body: string, index: number, tagLength: number) {
  const before = body.slice(Math.max(0, index - HEADING_WINDOW), index);
  const headings = Array.from(before.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi));
  const heading = headings.length ? stripTags(headings[headings.length - 1][1]) : '';
  const after = body.slice(index + tagLength, index + tagLength + CAPTION_WINDOW);
  const figureEnd = after.search(/<\/figure>/i);
  const caption = figureEnd >= 0 ? stripTags(after.slice(0, figureEnd).match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? '') : '';
  // Always "caption | heading", so a heading can never be read as a caption.
  return caption || heading ? `${caption} | ${heading}` : '';
}

function stripTags(html: string) {
  return decodeAttribute(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractBodyImages(html: string, pageUrl: string) {
  const body = html.slice(0, HTML_BYTE_LIMIT);
  const urls: string[] = [];
  const texts = new Map<string, string>();
  const contexts = new Map<string, string>();

  for (const match of Array.from(body.matchAll(/<img\b[^>]*>/gi))) {
    if (urls.length >= MAX_BODY_IMAGES) break;
    const attributes = parseAttributes(match[0]);
    const context = `${attributes.alt ?? ''} ${attributes.class ?? ''} ${attributes.id ?? ''} ${attributes.title ?? ''}`;
    if (NON_PHOTO_CONTEXT.test(context)) continue;

    let url: string | null = null;
    let declaredWidth = Number(attributes['data-eio-rwidth'] ?? attributes.width ?? 0) || 0;
    for (const name of SRCSET_ATTRIBUTES) {
      const candidate = attributes[name] ? largestSrcsetCandidate(attributes[name]) : null;
      if (candidate) {
        url = candidate.url;
        declaredWidth = candidate.width || declaredWidth;
        break;
      }
    }
    url ??= LAZY_SOURCE_ATTRIBUTES.map((name) => attributes[name]).find(
      (value) => value && !/^data:/i.test(value) && !NON_PHOTO_CONTEXT.test(value)
    ) ?? null;

    if (!url || (declaredWidth && declaredWidth < MIN_HERO_WIDTH)) continue;
    urls.push(url);
    texts.set(url, `${attributes.alt ?? ''} ${attributes.title ?? ''}`.trim());
    contexts.set(url, imageContext(body, match.index ?? 0, match[0].length));
  }

  // Section backgrounds — page builders (Divi, Elementor) set hero photos this
  // way, in <style> blocks as often as in style attributes. Textures that also
  // live there are caught by the theme-folder, format and shape checks.
  for (const match of Array.from(body.matchAll(/background(?:-image)?\s*:[^;{}]*?url\(\s*(?:&quot;|['"])?([^'")&]+)(?:&quot;|['"])?\s*\)/gi))) {
    if (urls.length >= MAX_BODY_IMAGES * 2) break;
    if (!NON_PHOTO_CONTEXT.test(match[1])) urls.push(match[1]);
  }

  return urls.flatMap((url) =>
    resolveUnique([url], pageUrl).map((resolved) => ({ url: resolved, text: texts.get(url) ?? '', context: contexts.get(url) ?? '' }))
  );
}

/**
 * Body images that are part of the site's design or embeds rather than its
 * content: theme/asset folders ship stock photography, and video thumbnails
 * are frames of some clip (often vertical, letterboxed).
 */
function isSiteAssetUrl(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    if (/(^|\.)(?:ytimg\.com|youtube\.com|vimeocdn\.com|vimeo\.com)$/i.test(url.hostname)) return true;
    return /\/(?:wp-content\/themes|themes?|templates?|assets|static|skins?)\//i.test(url.pathname);
  } catch {
    return true;
  }
}

/**
 * An image a page offers as its picture, with what the page says about it —
 * the evidence isEventSpecificImage weighs.
 */
export type ImageCandidate = {
  url: string;
  source: 'schema' | 'share' | 'body';
  /** Alt/title text, og:image:alt, or the schema Event's name. */
  text: string;
  /** Body images: the figure caption and the nearest heading above the image. */
  context?: string;
  /** How many Event objects the page describes (schema candidates only). */
  schemaEvents?: number;
};

/** Every image a page offers as its picture, most event-specific first. */
export function extractPageImageCandidates(html: string, pageUrl: string): ImageCandidate[] {
  const schemas = extractEventSchemas(html, pageUrl);
  const share = extractShareImages(html, pageUrl);
  const all: ImageCandidate[] = [
    ...schemas.flatMap((event) =>
      event.images.map((url) => ({ url, source: 'schema' as const, text: event.name, schemaEvents: schemas.length }))
    ),
    ...share.urls.map((url) => ({ url, source: 'share' as const, text: share.text })),
    ...extractBodyImages(html, pageUrl).map((image) => ({ ...image, source: 'body' as const })),
  ];
  const seen = new Set<string>();
  return all.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

export function extractPageImages(html: string, pageUrl: string): string[] {
  return extractPageImageCandidates(html, pageUrl).map((candidate) => candidate.url);
}

function resolveUnique(urls: string[], pageUrl: string) {
  const resolved: string[] = [];
  for (const url of urls) {
    try {
      const absolute = new URL(url.trim(), pageUrl).toString();
      if (/^https?:/i.test(absolute) && !resolved.includes(absolute)) resolved.push(absolute);
    } catch {
      continue;
    }
  }
  return resolved;
}

/**
 * WordPress serves share images as resized/edited derivatives of one upload
 * (`photo-700x467.jpg`, `photo-scaled-e1755235482167.jpg`). The original of
 * the same photo usually sits beside them, so try it before the derivative.
 */
export function originalImageCandidates(imageUrl: string): string[] {
  const candidates: string[] = [];
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    return [imageUrl];
  }

  if (url.pathname.includes('/wp-content/uploads/')) {
    const match = url.pathname.match(/^(.*?)((?:-e\d{10,})?(?:-\d{2,5}x\d{2,5})?)(\.(?:jpe?g|png|webp))$/i);
    if (match && match[2]) {
      const original = new URL(url.toString());
      original.pathname = `${match[1]}${match[3]}`;
      original.search = '';
      candidates.push(original.toString());
    }
  }

  candidates.push(imageUrl);
  return candidates;
}

export type ImageInfo = { format: 'jpeg' | 'png' | 'gif' | 'webp'; width: number; height: number };

/** Pixel size from a file's first bytes (JPEG, PNG, GIF, WebP). */
export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = bytes.length;

  if (length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { format: 'png', width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { format: 'gif', width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  if (length >= 30 && view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57454250) {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === 'VP8X') {
      const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { format: 'webp', width, height };
    }
    if (chunk === 'VP8 ') {
      return { format: 'webp', width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
    if (chunk === 'VP8L') {
      const bits = view.getUint32(21, true);
      return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  if (length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isStartOfFrame) {
        return { format: 'jpeg', height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      }
      offset += 2 + view.getUint16(offset + 2);
    }
  }
  return null;
}

/**
 * A banner photo, not a logo or icon: a raster photo format, wide enough to
 * fill the banner at 1x, and landscape-ish so object-cover doesn't crop it
 * to an unrecognisable strip.
 */
/**
 * Share cards that are just the event's logo on a plain background. CDNs
 * often re-encode them (a `.png` path served as JPEG/WebP), so the format
 * check alone doesn't catch them; the URL usually names them. Generic
 * `og-image` share cards are likewise text-on-white graphics, not photos.
 */
export function isLogoLikeUrl(imageUrl: string) {
  let path: string;
  try {
    path = decodeURIComponent(new URL(imageUrl).pathname);
  } catch {
    return false;
  }
  return (
    /(?:^|[^a-z])(?:logos?|icons?|fav|favicon|brand(?:ing)?|wordmark|placeholder|default|og-?image|social-?share|share-?image|sponsors?|partners?)(?:[^a-z]|$)/i.test(path) ||
    // Logo in Persian/Arabic, Russian, Chinese, Japanese, Korean, Turkish.
    /لوگو|لوجو|شعار|логотип|标志|標誌|ロゴ|로고|logosu/i.test(path)
  );
}

export function isUsableHeroImage(info: ImageInfo) {
  if (info.format !== 'jpeg' && info.format !== 'webp') return false;
  if (info.width < MIN_HERO_WIDTH || info.height <= 0) return false;
  const aspect = info.width / info.height;
  return aspect >= MIN_ASPECT && aspect <= MAX_ASPECT;
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Reads at most `limit` bytes of a body, then stops the download. */
async function readBody(response: Response, limit: number) {
  if (!response.body) return new Uint8Array(await response.arrayBuffer()).slice(0, limit);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < limit) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => undefined);
  const bytes = new Uint8Array(Math.min(total, limit));
  let offset = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, bytes.length - offset);
    bytes.set(part, offset);
    offset += part.length;
    if (offset >= bytes.length) break;
  }
  return bytes;
}

async function fetchHtml(url: string, fetcher: HeroFetcher) {
  if (!isFetchableUrl(url)) return null;
  try {
    return await withTimeout(async (signal) => {
      const response = await fetcher(url, { headers: { ...BROWSER_HEADERS, accept: 'text/html' }, signal });
      if (!response.ok || !/html/i.test(response.headers.get('content-type') ?? 'text/html')) return null;
      const finalUrl = response.url || url;
      return { url: finalUrl, html: new TextDecoder().decode(await readBody(response, HTML_BYTE_LIMIT)) };
    });
  } catch {
    return null;
  }
}

/**
 * The banner embeds the photo from another site, so the browser sends a
 * foreign Referer. Measuring with one too means a hotlink-protected image
 * (17 of the audit's broken banners) fails here instead of in the visitor's
 * browser.
 */
export const HERO_EMBED_REFERER = 'https://www.prismconnex.com/';

async function measureImage(url: string, fetcher: HeroFetcher) {
  if (!isFetchableUrl(url)) return null;
  try {
    return await withTimeout(async (signal) => {
      const response = await fetcher(url, {
        headers: {
          ...BROWSER_HEADERS,
          accept: 'image/avif,image/webp,image/*',
          range: `bytes=0-${HEADER_BYTE_LIMIT - 1}`,
          referer: HERO_EMBED_REFERER,
        },
        signal,
      });
      if (!response.ok) return null;
      const type = response.headers.get('content-type') ?? '';
      if (type && !/^image\//i.test(type)) return null;
      return readImageInfo(await readBody(response, HEADER_BYTE_LIMIT));
    });
  } catch {
    return null;
  }
}

function parseSiteUrl(website: string | null | undefined) {
  if (!website) return null;
  const raw = website.trim();
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return /(^|\.)eventseye\.com$/i.test(url.hostname) ? null : url;
  } catch {
    return null;
  }
}

function isHomePage(url: string) {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') === '';
  } catch {
    return false;
  }
}

/** The listed event page, also over https when listed as http (many sites dropped plain http). */
export function eventPageUrls(website: string | null | undefined): string[] {
  const url = parseSiteUrl(website);
  if (!url) return [];
  const pages = [url.toString()];
  if (url.protocol === 'http:') pages.push(`https://${url.host}${url.pathname}${url.search}`);
  return pages;
}

export function homePageUrls(website: string | null | undefined): string[] {
  const url = parseSiteUrl(website);
  if (!url) return [];
  const pages = [`${url.protocol}//${url.host}/`];
  if (url.protocol === 'http:') pages.push(`https://${url.host}/`);
  return pages;
}

/** The listed event page first, then the site's home page (often the only one with a share image). */
export function heroSourcePages(website: string | null | undefined): string[] {
  return Array.from(new Set([...eventPageUrls(website), ...homePageUrls(website)]));
}

/** One identity for a photo and its WordPress derivatives, so a resized site default still matches. */
function photoIdentity(imageUrl: string) {
  return originalImageCandidates(imageUrl)[0].replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();
}

async function firstPage(urls: string[], fetcher: HeroFetcher) {
  for (const url of urls) {
    const page = await fetchHtml(url, fetcher);
    if (page) return page;
  }
  return null;
}

/**
 * Skipped without a request: vector/animated/icon formats, gallery thumbnails
 * (small by name) and analytics pixels — they would only use up the budget.
 */
function isNeverAPhoto(imageUrl: string) {
  if (/\.(?:svg|gif|ico)(?:[?#]|$)/i.test(imageUrl)) return true;
  if (/(?:^|[-_./])thumb(?:nail)?s?(?:[-_./]|$)/i.test(imageUrl)) return true;
  try {
    return /(?:^|\.)(?:statcounter\.com|google-analytics\.com|googletagmanager\.com|doubleclick\.net|facebook\.com|facebook\.net|bing\.com|linkedin\.com|yandex\.ru|hotjar\.com)$/i.test(
      new URL(imageUrl).hostname
    );
  } catch {
    return true;
  }
}

/** Header reads per event — each is one small ranged request. */
const MAX_MEASURED_IMAGES = 12;

/**
 * What identifies one event in an image's file name or description: the
 * distinctive words of its name, and its recent edition years.
 */
export type EventProfile = {
  /** Name words few other shows use — "agha", "prowinter", "ipap" — never place names. */
  tokens: string[];
  /** This edition's year and the two before (photos of past editions). */
  years: number[];
  /**
   * The catalog edition's year. An image whose own text names only an earlier
   * year shows a previous edition, which may only appear with a year label —
   * that is the hand-verified registry's job, never the automatic resolver's.
   */
  editionYear?: number | null;
};

/** Words in trade-show names that say what kind of event it is, not which one. */
const GENERIC_NAME_WORDS = new Set(
  [
    'the and for with des del della der die das les los las und von van zur aux sur pour per con',
    'international internacional internazionale internationale world global national regional',
    'expo exhibition exhibitions exposition exposicion esposizione ausstellung messe fair fairs feria fiera foire salon salone',
    'show shows trade conference congress congreso summit forum festival week days event events edition annual',
    'industry industries products product technology technologies equipment machinery solutions services',
    'middle east west north south africa asia europe america americas',
  ]
    .join(' ')
    .split(' ')
);

function normalizeText(value: string) {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function nameWords(value: string) {
  return showIdentity(normalizeText(value))
    .split(' ')
    .filter((word) => word.length >= 3 && !/^\d+$/.test(word));
}

/**
 * @param commonWords name words used by too many shows (or naming places) to
 *   identify one — from buildHeroSiteIndex. Without it only the built-in
 *   generic list applies.
 */
export function buildEventProfile(
  event: { name: string; city?: string | null; country?: string | null; startDate?: string | null; dates?: string | null },
  commonWords: ReadonlySet<string> = new Set()
): EventProfile {
  const places = nameWords(`${event.city ?? ''} ${event.country ?? ''}`);
  const isPlace = (word: string) =>
    places.some((place) => place === word || (word.length >= 4 && (place.startsWith(word) || word.startsWith(place))));
  const tokens = Array.from(new Set(nameWords(event.name))).filter(
    (word) => !GENERIC_NAME_WORDS.has(word) && !commonWords.has(word) && !isPlace(word)
  );
  const year = Number(`${event.startDate ?? ''} ${event.dates ?? ''}`.match(/\b((?:19|20)\d{2})\b/)?.[1] ?? 0);
  return { tokens, years: year ? [year, year - 1, year - 2] : [], editionYear: year || null };
}

function mentionsWord(text: string, word: string) {
  if (word.length >= 5 || /[^a-z0-9]/.test(word)) return text.includes(word);
  return new RegExp(`(?:^|[^a-z0-9])${word}(?:[^a-z0-9]|$)`).test(text);
}

function imageFileStem(imageUrl: string) {
  try {
    return normalizeText(decodeURIComponent(new URL(imageUrl).pathname.split('/').pop() ?? '')).replace(/\.[a-z0-9]+$/, '');
  } catch {
    return '';
  }
}

/**
 * Whether an image's alt/title text is a statement about the picture rather
 * than a file name, URL or placeholder. CMSs often fill alt with the upload's
 * name ("VOLTA Basel 2025-465.jpg", "AGHA-MEL25-Turbo360-A9B05027"), which is
 * no more evidence than the file name itself.
 */
export function isMeaningfulImageText(text: string, imageUrl: string) {
  const value = normalizeText(text).trim();
  if (value.length < 4) return false;
  if (/https?:\/\/|www\.|\.(?:jpe?g|png|webp|avif|gif)\b/.test(value)) return false;
  if (!/\s/.test(value) && /[_-]/.test(value)) return false; // "agha-mel25-turbo360"
  if (!/\s/.test(value) && /\d{3,}/.test(value)) return false; // camera names: "dscf0237", "i55a9685"
  const squash = (s: string) => s.replace(/[\s_.,-]+/g, '');
  const stem = imageFileStem(imageUrl);
  if (stem && squash(value) === squash(stem)) return false;
  if (/^(?:image|photo|picture|img|foto|bild|banner|slide|slider|background|gallery image)\s*\d*$/.test(value)) return false;
  return true;
}

/**
 * Promotional and design graphics rather than photographs of the event:
 * posters, key visuals, share/social cards, banners, save-the-dates, ticket
 * and registration calls, app promos, QR codes. Named in the URL or in the
 * page's description of the image. The audit found these were most of what
 * the old file-name rule let through.
 */
const PROMO_URL =
  /(?:^|[^a-z])(?:poster|flyer|affiche|key-?visual|kv|social|rrss|redes-?sociales|og|share|sharing|opengraph|open-graph|twitter|facebook|linkedin|instagram|banner|baner|promo|advert|ad|ads|save-?the-?date|countdown|coming-?soon|ticket|tickets|qr|mockup|teaser|video|thumbnail|thumb|cover|header|slider|slide|hero-?banner|web-?banner|cta)(?:[^a-z]|$)/i;
const PROMO_TEXT =
  /\b(?:register|registration|tickets?|book (?:now|your)|save the date|coming soon|count ?down|early ?bird|call for (?:papers|speakers)|sponsor(?:s|ship)?|official (?:airline|partner|sponsor)|exhibit (?:at|with)|download|youtube|app store|google play|thank you|reserve|buy now|discount|% off|untitled|invites you)\b|приглашает/i;

export function isPromotionalImage(candidate: ImageCandidate) {
  let path = '';
  try {
    path = decodeURIComponent(new URL(candidate.url).pathname);
  } catch {
    return true;
  }
  return PROMO_URL.test(path) || PROMO_TEXT.test(`${candidate.text} ${candidate.context ?? ''}`);
}

function yearsIn(text: string) {
  return Array.from(new Set(Array.from(text.matchAll(/(?:^|\D)((?:19|20)\d{2})(?!\d)/g)).map((match) => Number(match[1]))));
}

/**
 * Whether the page itself ties this image to this event, and to the catalog
 * edition. Only a page body photo qualifies, and only on what the page says
 * about that photo — its meaningful alt text, its figure caption, or the
 * nearest heading above it — naming a distinctive word of the event.
 *
 * Not evidence, because the audit of 856 automatic picks showed each mostly
 * produced unrelated images: the file name (320 of 506 file-name matches were
 * unrelated), a year plus an "edition word" in the file name, the page's
 * schema.org Event image (113 of 118 unrelated) and its og/twitter share card
 * (144 of 156 unrelated, mostly promo cards and logos).
 *
 * Text naming only an earlier year marks a previous edition, which the
 * resolver never shows (it cannot label it); text naming only a later year
 * contradicts the catalog. Both fall back to the gradient.
 */
export function isEventSpecificImage(candidate: ImageCandidate, event: EventProfile | undefined) {
  if (candidate.source !== 'body') return false;
  if (!event || !event.tokens.length) return false;
  if (isPromotionalImage(candidate)) return false;

  // A heading names the page section, not the picture: a sponsorship card or an
  // abstract graphic under "Count Down Till MACTECH" is not a photo of it. The
  // heading only counts beside a meaningful description of the photo itself.
  const alt = isMeaningfulImageText(candidate.text, candidate.url) ? candidate.text : '';
  const [caption = '', heading = ''] = (candidate.context ?? '').split(' | ');
  const evidence = normalizeText(alt ? `${alt} | ${caption} | ${heading}` : caption);
  if (!event.tokens.some((word) => mentionsWord(evidence, word))) return false;

  // The image's own words outrank the section heading: "Hamburg PFF 2024" under a
  // "Propulsion & Future Fuels 2026" heading is a 2024 photo.
  const ownYears = yearsIn(normalizeText(`${alt} | ${caption}`));
  const years = ownYears.length ? ownYears : yearsIn(evidence);
  if (years.length && event.editionYear && !years.includes(event.editionYear)) return false;
  return true;
}

async function firstUsableImage(
  candidates: ImageCandidate[],
  event: EventProfile | undefined,
  fetcher: HeroFetcher,
  seen: Set<string>
) {
  let measured = 0;
  for (const candidate of candidates) {
    const imageUrl = candidate.url;
    if (isLogoLikeUrl(imageUrl) || isSiteAssetUrl(imageUrl) || isNeverAPhoto(imageUrl)) continue;
    if (!isEventSpecificImage(candidate, event)) continue;
    for (const url of originalImageCandidates(imageUrl)) {
      if (seen.has(url)) continue;
      if (measured >= MAX_MEASURED_IMAGES) return null;
      seen.add(url);
      measured += 1;
      const info = await measureImage(url, fetcher);
      if (info && isUsableHeroImage(info)) return { url, width: info.width, height: info.height };
    }
  }
  return null;
}

/**
 * Where an event's listed website sits among the catalog's other shows —
 * decides which share images can be trusted to belong to this event.
 */
export type HeroSiteContext = {
  /**
   * The host lists more than one distinct show (an organiser or venue site).
   * Its home page and site-wide default share image then belong to no single
   * event, so only an image declared by the event's own page may be used.
   * Otherwise e.g. AGHA's Sydney fair, whose page redirects to the home page,
   * would show the Melbourne photo.
   */
  sharedSite: boolean;
  /**
   * The listed page itself is listed by another show — a listings page such
   * as makerfaire.com/upcoming-faires (35 different faires). Nothing on it is
   * specific to one event.
   */
  sharedPage: boolean;
  /**
   * Pages other shows on this host list. Any image they declare too is a
   * site template rather than this event's photo.
   */
  siblingPages: string[];
};

export type ResolveHeroOptions = Partial<HeroSiteContext> & {
  fetcher?: HeroFetcher;
  /** Without a profile only a single-Event schema image can be accepted. */
  event?: EventProfile;
};

const MAX_SIBLING_PAGES = 2;

/**
 * The event's own photo from its official site, or null when no image can be
 * confidently tied to this event — the banner then keeps its gradient.
 */
export async function resolveEventHeroImage(
  website: string | null | undefined,
  options: ResolveHeroOptions = {}
): Promise<HeroImage | null> {
  return (await resolveEventHeroImageResult(website, options)).image;
}

export type HeroResolution = {
  image: HeroImage | null;
  /**
   * False when a page the decision depends on didn't load (slow, down or
   * blocked). A null image is then "couldn't check", not "has no photo", and
   * is worth retrying rather than remembering.
   */
  reachable: boolean;
};

export async function resolveEventHeroImageResult(
  website: string | null | undefined,
  { fetcher = fetch, sharedSite = false, sharedPage = false, siblingPages = [], event }: ResolveHeroOptions = {}
): Promise<HeroResolution> {
  const seen = new Set<string>();
  const found = (image: HeroImage | null): HeroResolution => ({ image, reachable: true });
  const unreachable: HeroResolution = { image: null, reachable: false };

  if (sharedPage) return found(null);

  if (!sharedSite) {
    const pages = heroSourcePages(website);
    let loaded = 0;
    for (const pageUrl of pages) {
      const page = await fetchHtml(pageUrl, fetcher);
      if (!page) continue;
      loaded += 1;
      const image = await firstUsableImage(extractPageImageCandidates(page.html, page.url), event, fetcher, seen);
      if (image) return found(image);
    }
    return pages.length && !loaded ? unreachable : found(null);
  }

  const eventPage = await firstPage(eventPageUrls(website), fetcher);
  if (!eventPage) return unreachable;
  // Listed as, or redirected to, the home page: nothing on it is specific to this event.
  if (isHomePage(eventPage.url)) return found(null);

  const eventImages = extractPageImageCandidates(eventPage.html, eventPage.url);
  if (!eventImages.length) return found(null);

  // Every check below fails closed: when a comparison page can't be loaded the
  // image can't be shown to be this event's, so the banner keeps its gradient.
  const homePage = await firstPage(homePageUrls(website), fetcher);
  if (!homePage) return unreachable;
  const templateImages = new Set(extractPageImages(homePage.html, homePage.url).map(photoIdentity));

  const siblings = siblingPages.slice(0, MAX_SIBLING_PAGES);
  let siblingsLoaded = 0;
  for (const siblingUrl of siblings) {
    const sibling = await firstPage(eventPageUrls(siblingUrl), fetcher);
    if (!sibling) continue;
    // Another show's link lands on this same page: it is a shared listing after all.
    if (pageKey(sibling.url) === pageKey(eventPage.url)) return found(null);
    siblingsLoaded += 1;
    for (const url of extractPageImages(sibling.html, sibling.url)) templateImages.add(photoIdentity(url));
  }
  if (siblings.length && !siblingsLoaded) return unreachable;

  return found(
    await firstUsableImage(
      eventImages.filter((candidate) => !templateImages.has(photoIdentity(candidate.url))),
      event,
      fetcher,
      seen
    )
  );
}

/** One show across its editions and duplicate catalog records ("BETT 2026" = "BETT 2027"). */
export function heroShowKey(name: string) {
  return showIdentity(normalizeText(name));
}

/**
 * Which shows each automatically found photo has been resolved for. One photo
 * claimed by two different shows is a shared organiser or co-located-show
 * image — the audit found a "Tech Show Frankfurt" photo on seven London and
 * Paris events — so it is the hero of none of them.
 */
export function createHeroImageClaims() {
  const showsByImage = new Map<string, Set<string>>();
  return {
    claim(imageUrl: string, showKey: string) {
      if (!showsByImage.has(imageUrl)) showsByImage.set(imageUrl, new Set());
      showsByImage.get(imageUrl)!.add(showKey);
    },
    isShared(imageUrl: string) {
      return (showsByImage.get(imageUrl)?.size ?? 0) > 1;
    },
  };
}

/** Host without www — the unit whose home page and default share image are shared. */
export function heroSiteKey(website: string | null | undefined) {
  return parseSiteUrl(website)?.hostname.toLowerCase().replace(/^www\./, '') ?? null;
}

/** One page regardless of protocol, www, trailing slash or case. */
function pageKey(url: string) {
  const parsed = parseSiteUrl(url);
  if (!parsed) return url;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  return `${host}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`.toLowerCase();
}

/** A show across its editions: years and ordinals dropped, so "BETT 2026" and "BETT 2027" are one show. */
function showIdentity(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\b\d+(?:st|nd|rd|th|e|er|eme|ème|º|ª)\b/g, ' ')
    // ASCII punctuation only — stripping all non-ASCII would collapse every
    // CJK/Cyrillic name on a site to "" and hide that it lists several shows.
    .replace(/[\s!-/:-@[-`{-~–—]+/g, ' ')
    .trim();
}

/** A name word used by more shows than this identifies none of them. */
const MAX_SHOWS_PER_DISTINCTIVE_WORD = 3;

export type HeroCatalogEvent = {
  name: string;
  website?: string | null;
  city?: string | null;
  country?: string | null;
  startDate?: string | null;
  dates?: string | null;
};

/**
 * Indexes the catalog once; the returned lookup gives an event's
 * HeroSiteContext and EventProfile.
 */
export function buildHeroSiteIndex(events: Iterable<HeroCatalogEvent>) {
  const showsBySite = new Map<string, Set<string>>();
  const showsByPage = new Map<string, Set<string>>();
  // Per site, the first listed page of each show — candidates for the template check.
  const pagesBySite = new Map<string, Map<string, string>>();
  const showsByWord = new Map<string, Set<string>>();
  const placeWords = new Set<string>();

  for (const event of Array.from(events)) {
    const show = showIdentity(event.name);
    for (const word of nameWords(event.name)) {
      if (!showsByWord.has(word)) showsByWord.set(word, new Set());
      showsByWord.get(word)!.add(show);
    }
    for (const word of nameWords(`${event.city ?? ''} ${event.country ?? ''}`)) placeWords.add(word);

    const site = heroSiteKey(event.website);
    if (!site || !event.website) continue;
    const page = pageKey(event.website);

    if (!showsBySite.has(site)) showsBySite.set(site, new Set());
    showsBySite.get(site)!.add(show);
    if (!showsByPage.has(page)) showsByPage.set(page, new Set());
    showsByPage.get(page)!.add(show);
    if (!pagesBySite.has(site)) pagesBySite.set(site, new Map());
    const pages = pagesBySite.get(site)!;
    if (!pages.has(show) && !isHomePage(parseSiteUrl(event.website)!.toString())) pages.set(show, event.website);
  }

  // Too common to identify one show, or the name of a place (a skyline named
  // after the host city is not a photo of the event).
  const commonWords = new Set(placeWords);
  for (const [word, shows] of Array.from(showsByWord)) {
    if (shows.size > MAX_SHOWS_PER_DISTINCTIVE_WORD) commonWords.add(word);
  }

  return (event: HeroCatalogEvent): HeroSiteContext & { event: EventProfile } => {
    const profile = buildEventProfile(event, commonWords);
    const site = heroSiteKey(event.website);
    if (!site || !event.website) return { sharedSite: false, sharedPage: false, siblingPages: [], event: profile };
    const show = showIdentity(event.name);
    const page = pageKey(event.website);
    const siblingPages = Array.from(pagesBySite.get(site) ?? [])
      .filter(([otherShow, otherPage]) => otherShow !== show && pageKey(otherPage) !== page)
      .map(([, otherPage]) => otherPage)
      .slice(0, MAX_SIBLING_PAGES);

    return {
      sharedSite: (showsBySite.get(site)?.size ?? 0) > 1,
      sharedPage: Array.from(showsByPage.get(page) ?? []).some((other) => other !== show),
      siblingPages,
      event: profile,
    };
  };
}
