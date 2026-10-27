/**
 * Exact-edition official-source discovery for event start and end clock times,
 * applied the same way to every Find Shows event.
 *
 * Requirements:
 * 1. Discovers verified clock times from the official event site only.
 * 2. Prefers Schema.org Event JSON-LD with clock times in startDate / endDate.
 * 3. Falls back to official text: per-day schedules ("2 November, 2026: 10AM - 6:30PM")
 *    and labelled hours ("Opening hours: 09:30 - 18:00", "Open daily 10am - 5pm"), on the
 *    homepage and on linked visitor / hours / schedule / edition pages.
 * 4. NEVER uses Eventseye as a source for clock times.
 * 5. NEVER invents or infers times — UNAVAILABLE when nothing is verified.
 * 6. Exact edition: a per-day line must carry a day inside the edition; undated hours count
 *    only on a page that names a date of the edition (or, for a linked page that names no
 *    date at all, when the page linking to it does). Other years/editions are rejected.
 * 7. Day-1 rule: when hours differ by day, the first verified day of the edition is used.
 * 8. Network failures / an exhausted budget give FETCH_ERROR (retried later), never UNAVAILABLE.
 */
import type { EventTimingResult } from '@/types/find-shows';
import { containsClockTime, formatEventClockTime, isValidIanaTimeZone } from './event-time';
import {
  editionEvidence,
  extractDailySchedule,
  extractLabelledHours,
  htmlToText,
  namesMainEventOrDay,
  namesSideActivity,
  type EditionDates,
} from './event-timing-parse';

export type TimingDiscoveryInput = {
  name: string;
  startDate: string; // e.g. "2026-08-01"
  endDate: string; // e.g. "2026-08-02"
  city: string;
  website: string | null | undefined;
  extraWebsites?: (string | null | undefined)[];
};

export type TimingFetchResult = {
  ok: boolean;
  status: number;
  url: string;
  html?: string;
  error?: string;
};

export type TimingFetcher = (
  url: string,
  options?: { timeoutMs?: number; maxBytes?: number }
) => Promise<TimingFetchResult>;

export type TimingBudget = {
  /** Total wall-clock time for the whole discovery. */
  timeMs: number;
  /** Most pages fetched (homepages + linked pages). */
  maxPages: number;
  /** Per-request timeout (capped by the remaining total time). */
  requestTimeoutMs: number;
  /** Bytes read per page — official homepages often carry hours in a footer past 500 KB. */
  maxBytes: number;
};

/** Live page render: bounded so a slow site cannot hold the request for long. */
export const PAGE_TIMING_BUDGET: TimingBudget = { timeMs: 15_000, maxPages: 5, requestTimeoutMs: 10_000, maxBytes: 1_500_000 };
/** Catalog precompute (scripts/event-timings): more time and pages per edition. */
export const BATCH_TIMING_BUDGET: TimingBudget = { timeMs: 45_000, maxPages: 8, requestTimeoutMs: 20_000, maxBytes: 2_500_000 };

const DEFAULT_TIMEOUT_MS = PAGE_TIMING_BUDGET.requestTimeoutMs;
const MAX_BYTES = PAGE_TIMING_BUDGET.maxBytes;

export function isEventseyeDomain(url: string | null | undefined): boolean {
  if (!url) return false;
  return /(?:^|\/\/)(?:[a-z0-9_-]+\.)*eventseye\.com(?::\d+)?(?:[/?#]|$)/i.test(url.trim());
}

export function cleanUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (isEventseyeDomain(trimmed)) return null;
  return trimmed;
}

/**
 * A failure that says nothing about the page's content: network, timeout, overload, or the
 * site refusing us (401/403 bot protection) — as opposed to a page that does not exist (404/410).
 */
export function isTransientFetchFailure(result: TimingFetchResult): boolean {
  return (
    !result.ok &&
    (result.status === 0 || result.status === 401 || result.status === 403 || result.status === 408 || result.status === 429 || result.status >= 500)
  );
}

/**
 * Production fetcher: timeout and a streamed byte cap.
 *
 * The connection is released by aborting (never reader.cancel(), which can trip an internal
 * assertion in Node's fetch when the socket closes mid-body), and a hard deadline guards
 * every await so a broken socket cannot stall a caller.
 */
export async function defaultTimingFetcher(
  url: string,
  options?: { timeoutMs?: number; maxBytes?: number }
): Promise<TimingFetchResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let guard: ReturnType<typeof setTimeout> | undefined;
  const hardDeadline = new Promise<TimingFetchResult>((resolve) => {
    guard = setTimeout(() => resolve({ ok: false, status: 0, url, error: 'Timeout' }), timeoutMs + 2_000);
  });
  try {
    return await Promise.race([fetchWithCap(url, options), hardDeadline]);
  } finally {
    clearTimeout(guard);
  }
}

async function fetchWithCap(
  url: string,
  options?: { timeoutMs?: number; maxBytes?: number }
): Promise<TimingFetchResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options?.maxBytes ?? MAX_BYTES;

  if (isEventseyeDomain(url)) {
    return { ok: false, status: 400, url, error: 'Eventseye is not permitted as a source for event times.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/json',
        'Accept-Language': 'en;q=0.9,*;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    const finalUrl = response.url || url;
    if (isEventseyeDomain(finalUrl)) {
      return { ok: false, status: 400, url: finalUrl, error: 'Redirected to Eventseye.' };
    }
    if (!response.ok) {
      return { ok: false, status: response.status, url: finalUrl, error: `HTTP ${response.status}` };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      return { ok: true, status: response.status, url: finalUrl, html: text.slice(0, maxBytes) };
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      receivedBytes += value.length;
      if (receivedBytes >= maxBytes) break;
    }

    const totalBuffer = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      totalBuffer.set(chunk, offset);
      offset += chunk.length;
    }
    return { ok: true, status: response.status, url: finalUrl, html: new TextDecoder('utf-8').decode(totalBuffer) };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      url,
      error: err?.name === 'AbortError' ? 'Timeout' : err?.cause?.code || err?.message || 'Network error',
    };
  } finally {
    clearTimeout(timer);
    // Releases the socket for unread or partly read bodies; harmless after a full read.
    controller.abort();
  }
}

// --- Schema.org JSON-LD -----------------------------------------------------------

function isDateMatch(candidateDate: string | undefined, expectedStart: string, expectedEnd: string): boolean {
  if (!candidateDate) return false;
  const dateStr = candidateDate.trim().slice(0, 10); // YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return dateStr >= expectedStart && dateStr <= expectedEnd;
}

/**
 * Whether a JSON-LD date-time states a local clock time:
 * - date-only values and midnight / 23:59 (CMS date placeholders) are not times;
 * - a UTC value ("Z", "+00:00") is only an instant — it gives the venue's local clock time only
 *   with a stated IANA timeZone (formatEventClockTime then converts); otherwise it is not used.
 */
export function isLocalJsonLdClock(raw: string | null, timeZone: string | null): boolean {
  if (!raw || !containsClockTime(raw)) return false;
  const clock = raw.match(/[T\s](\d{2}):(\d{2})/);
  if (clock && ((clock[1] === '00' && clock[2] === '00') || (clock[1] === '23' && clock[2] === '59'))) return false;
  const isUtc = /(?:Z|[+-]00:?00)$/i.test(raw.trim());
  return !isUtc || isValidIanaTimeZone(timeZone);
}

/** Milliseconds in an ISO 8601 duration ("P2D", "PT8H30M", "P1DT2H"); null when it is not one. */
function isoDurationMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match || value.trim().toUpperCase() === 'P' || /T$/i.test(value.trim())) return null;
  const [, w, d, h, m, s] = match.map((part) => Number(part ?? 0));
  return ((((w * 7 + d) * 24 + h) * 60 + m) * 60 + s) * 1000;
}

/**
 * Identical opening and closing clock times ("2026-11-09 09:21" → "2026-11-13 09:21") are
 * page metadata — a publish or edit timestamp copied into both fields — not event hours.
 * Kept only when the same entry states a `duration` that matches start→end exactly
 * (e.g. a 48-hour event from 09:00 to 09:00), which is explicit evidence the times are real.
 */
export function hasPlaceholderClockPair(rawStart: string | null, rawEnd: string | null, duration: unknown): boolean {
  const clockOf = (raw: string | null) => raw?.match(/[T\s](\d{1,2}):(\d{2})/)?.slice(1, 3).join(':') ?? null;
  const start = clockOf(rawStart);
  if (!start || start !== clockOf(rawEnd)) return false;
  const stated = isoDurationMs(duration);
  if (stated === null || stated === 0) return true;
  const span = Date.parse(rawEnd!.replace(' ', 'T')) - Date.parse(rawStart!.replace(' ', 'T'));
  return !(Number.isFinite(span) && span === stated);
}

/**
 * Recursively searches JSON-LD structures for Schema.org Event objects.
 */
/** Event nodes, each marked whether it was reached as a subEvent of another event. */
function extractJsonLdEvents(parsed: any): { ev: any; sub: boolean }[] {
  const events: { ev: any; sub: boolean }[] = [];
  const eventType = /(?:^|[\s:/])(?:Event|BusinessEvent|ExhibitionEvent|Festival|SaleEvent)$/i;

  function walk(node: any, sub = false) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, sub);
      return;
    }
    const type = node['@type'];
    const isEventType =
      typeof type === 'string'
        ? eventType.test(type)
        : Array.isArray(type) && type.some((t) => typeof t === 'string' && eventType.test(t));
    if (isEventType) events.push({ ev: node, sub });
    if (node['@graph']) walk(node['@graph'], sub);
    if (node.subEvent) walk(node.subEvent, true);
    if (node.events) walk(node.events, sub);
  }

  walk(parsed);
  return events;
}

/**
 * Parses Schema.org Event JSON-LD from HTML content. Among the events of this
 * edition that carry clock times, the earliest-starting one (day 1) wins.
 */
export function extractSchemaOrgTiming(
  html: string,
  input: TimingDiscoveryInput,
  sourceUrl: string
): EventTimingResult | null {
  const jsonLdMatches = Array.from(
    html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  );
  const candidates: { rawStart: string | null; rawEnd: string | null; timeZone: string | null; okStart: boolean; okEnd: boolean }[] = [];

  for (const match of jsonLdMatches) {
    let parsed: any;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      continue;
    }

    for (const { ev, sub } of extractJsonLdEvents(parsed)) {
      const rawStart = typeof ev.startDate === 'string' ? ev.startDate.trim() : null;
      const rawEnd = typeof ev.endDate === 'string' ? ev.endDate.trim() : null;
      if (!rawStart && !rawEnd) continue;

      // Exact edition match: must align with the target event's dates
      const matchesEdition =
        isDateMatch(rawStart ?? undefined, input.startDate, input.endDate) ||
        isDateMatch(rawEnd ?? undefined, input.startDate, input.endDate);
      if (!matchesEdition) continue;

      // A sub-event for a side activity ("Welcome drinks reception", "Awards ceremony") is not the event's hours.
      // The top-level event is the event itself, even when it is a seminar or congress.
      if (sub && namesSideActivity(typeof ev.name === 'string' ? ev.name : null, input.name)) continue;
      // A named sub-event is a programme item (a session or talk) unless its name refers to the event or a day.
      if (sub && typeof ev.name === 'string' && ev.name.trim() && !namesMainEventOrDay(ev.name)) continue;

      let timeZone: string | null = null;
      if (typeof ev.timeZone === 'string') timeZone = ev.timeZone.trim();
      else if (typeof ev.location?.timeZone === 'string') timeZone = ev.location.timeZone.trim();

      // Clock time verification: date-only values ("2027-04-10") and date placeholders are not times
      const okStart = isLocalJsonLdClock(rawStart, timeZone);
      const okEnd = isLocalJsonLdClock(rawEnd, timeZone);
      if (!okStart && !okEnd) continue;
      // Same clock time at start and end: a metadata timestamp, not hours (neither time is used).
      if (hasPlaceholderClockPair(rawStart, rawEnd, ev.duration)) continue;
      candidates.push({ rawStart, rawEnd, timeZone, okStart, okEnd });
    }
  }

  if (!candidates.length) return null;
  // Day 1 first; on that day, an entry that opens and closes the same day (a per-day sub-event) first.
  const sameDay = (c: { rawStart: string | null; rawEnd: string | null }) =>
    Boolean(c.rawStart && c.rawEnd && c.rawStart.slice(0, 10) === c.rawEnd.slice(0, 10));
  candidates.sort(
    (a, b) =>
      (a.rawStart ?? a.rawEnd ?? '').slice(0, 10).localeCompare((b.rawStart ?? b.rawEnd ?? '').slice(0, 10)) ||
      Number(sameDay(b)) - Number(sameDay(a)) ||
      (a.rawStart ?? '').localeCompare(b.rawStart ?? '')
  );
  const { rawStart, rawEnd, timeZone, okStart, okEnd } = candidates[0];
  const hasStartTime = okStart;
  // Day-1 rule: on a multi-day entry the endDate time is the final day's closing, not day 1's — not used.
  const endIsOtherDay = Boolean(rawStart && rawEnd && rawStart.slice(0, 10) !== rawEnd.slice(0, 10));
  const hasEndTime = okEnd && !endIsOtherDay;
  if (!hasStartTime && !hasEndTime) return null;

  return {
    status: 'VERIFIED_TIME',
    startTime: hasStartTime ? rawStart : null,
    endTime: hasEndTime ? rawEnd : null,
    timeZone,
    formattedStartTime: hasStartTime ? formatEventClockTime(rawStart, timeZone) : null,
    formattedEndTime: hasEndTime ? formatEventClockTime(rawEnd, timeZone) : null,
    sourceUrl,
    evidence:
      `Schema.org Event JSON-LD (startDate: ${rawStart ?? 'n/a'}, endDate: ${rawEnd ?? 'n/a'})` +
      (endIsOtherDay && okEnd ? ' — endDate closes a later day, so no day-1 closing time' : ''),
    checkedAt: new Date().toISOString(),
  };
}

// --- Official text ------------------------------------------------------------------

/**
 * Parses official visitor / opening hours from page text, for this edition only.
 *
 * Per-day schedule lines are tried first (the first verified day of the edition is
 * used); then labelled hours, which need edition evidence: the page names a date of
 * the edition, or names no date and `inheritedEditionMatch` says the page linking to
 * it does.
 */
export function extractTextOpeningHours(
  html: string,
  sourceUrl: string,
  input: EditionDates,
  inheritedEditionMatch = false
): EventTimingResult | null {
  const text = htmlToText(html);
  const verified = (start: string, end: string, timeZone: string | null, evidence: string): EventTimingResult => ({
    status: 'VERIFIED_TIME',
    startTime: start,
    endTime: end,
    timeZone,
    formattedStartTime: formatEventClockTime(start, timeZone),
    formattedEndTime: formatEventClockTime(end, timeZone),
    sourceUrl,
    evidence,
    checkedAt: new Date().toISOString(),
  });

  const days = extractDailySchedule(text, input);
  if (days.length) {
    const first = days[0];
    const differs = days.some((day) => day.start !== first.start || day.end !== first.end);
    return verified(
      first.start,
      first.end,
      null,
      `Official schedule, day 1 (${first.date}): "${first.snippet}"` +
        (differs ? ` — hours differ on other days: ${days.slice(1).map((day) => `${day.date} ${day.start}-${day.end}`).join(', ')}` : '')
    );
  }

  const evidence = editionEvidence(text, input);
  if (evidence === 'conflict' || (evidence === 'none' && !inheritedEditionMatch)) return null;
  const hours = extractLabelledHours(text, input);
  if (!hours) return null;
  return verified(hours.start, hours.end, hours.zone, `Official Opening Hours: "${hours.snippet}"`);
}

/** decodeURIComponent that keeps the raw text for malformed escapes ("%E2%80", a bare "%") found on real sites. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Lowercase ASCII slug of a catalog city ("Abu Dhabi (UAE)" → "abu-dhabi"). */
function citySlug(city: string | null | undefined): string {
  return (city ?? '')
    .split(/[(,]/)[0]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Same-site links likely to carry visitor hours, best first: hours/visit/schedule pages,
 * then pages for this edition's city or year (multi-city / multi-edition sites).
 */
export function findOfficialHoursPageLinks(
  html: string,
  baseUrl: string,
  input?: Pick<TimingDiscoveryInput, 'city' | 'startDate'>,
  limit = 4
): string[] {
  let baseObj: URL;
  try {
    baseObj = new URL(baseUrl);
  } catch {
    return [];
  }
  const baseHost = baseObj.hostname.replace(/^www\./i, '');
  const hoursPattern =
    /(?:^|[/?&_-])(?:opening[-_]?hours|opening[-_]?times|visitor[-_]?info(?:rmation)?|visitors?|visiting|visit|visit-us|plan-your-visit|hours|schedule|timings?|practical[-_]?info(?:rmation)?|info[-_]?pratiques|horaires|oeffnungszeiten|offnungszeiten|orari|horarios?|openingstijden|tickets?)(?:[/?&_.-]|$)/i;
  const city = citySlug(input?.city);
  const year = input?.startDate?.slice(0, 4) ?? '';
  const ranked: { url: string; score: number }[] = [];

  for (const match of Array.from(html.matchAll(/<a\b[^>]*href=["']([^"'#\s>]+)["'][^>]*>/gi))) {
    let resolved: URL;
    try {
      resolved = new URL(match[1].trim(), baseUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(resolved.protocol)) continue;
    const host = resolved.hostname.replace(/^www\./i, '');
    // Same site or its subdomains only
    if (host !== baseHost && !host.endsWith(`.${baseHost}`)) continue;
    if (isEventseyeDomain(resolved.href)) continue;
    const path = safeDecode(resolved.pathname + resolved.search).toLowerCase();
    if (/\.(?:pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|mp4)$/i.test(resolved.pathname)) continue;

    const isHours = hoursPattern.test(path);
    const hasCity = Boolean(city && city.length > 2 && path.includes(city));
    const hasYear = Boolean(year && path.includes(year));
    if (!isHours && !hasCity) continue;
    const score = (isHours ? 4 : 0) + (hasCity ? 2 : 0) + (hasYear ? 1 : 0);
    resolved.hash = '';
    const url = resolved.toString();
    const existing = ranked.find((entry) => entry.url === url);
    if (existing) existing.score = Math.max(existing.score, score);
    else ranked.push({ url, score });
  }

  // Stable sort keeps page order among equal scores.
  return ranked
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.url);
}

// --- Orchestration ------------------------------------------------------------------

function emptyResult(status: 'UNAVAILABLE' | 'FETCH_ERROR', sourceUrl: string | null, evidence: string | null): EventTimingResult {
  return {
    status,
    startTime: null,
    endTime: null,
    timeZone: null,
    formattedStartTime: null,
    formattedEndTime: null,
    sourceUrl,
    evidence,
    checkedAt: new Date().toISOString(),
  };
}

const isComplete = (result: EventTimingResult | null) => Boolean(result?.formattedStartTime && result.formattedEndTime);

/**
 * JSON-LD first, then official text. A JSON-LD start without a day-1 closing time
 * (multi-day entry) is returned only when the page text has no complete day-1 range.
 */
function extractFromPage(html: string, input: TimingDiscoveryInput, url: string, inheritedEditionMatch: boolean) {
  const jsonLd = extractSchemaOrgTiming(html, input, url);
  if (isComplete(jsonLd)) return jsonLd;
  const text = extractTextOpeningHours(html, url, input, inheritedEditionMatch);
  return isComplete(text) ? text : jsonLd ?? text;
}

/**
 * Main discovery orchestrator for an event edition.
 */
export async function discoverEventTiming(
  input: TimingDiscoveryInput,
  fetcher: TimingFetcher = defaultTimingFetcher,
  budget: TimingBudget = PAGE_TIMING_BUDGET
): Promise<EventTimingResult> {
  const roots = Array.from(
    new Set([input.website, ...(input.extraWebsites ?? [])].map(cleanUrl).filter((u): u is string => Boolean(u)))
  );
  if (roots.length === 0) {
    return emptyResult('UNAVAILABLE', null, 'No official website listed for this event.');
  }

  const deadline = Date.now() + budget.timeMs;
  const visited = new Set<string>();
  const failures: string[] = [];
  const lastError = new Map<string, string>();
  let pagesFetched = 0;
  let budgetExhausted = false;

  const fetchPage = async (url: string) => {
    const remaining = deadline - Date.now();
    if (pagesFetched >= budget.maxPages) return null;
    if (remaining < 500) {
      // Out of time with pages left unchecked: unknown, not "none published".
      budgetExhausted = true;
      return null;
    }
    pagesFetched++;
    visited.add(url);
    const page = await fetcher(url, { timeoutMs: Math.min(budget.requestTimeoutMs, remaining), maxBytes: budget.maxBytes });
    if (page.url) visited.add(page.url);
    if (!page.ok || !page.html) {
      lastError.set(url, page.error ?? `HTTP ${page.status}`);
      if (isTransientFetchFailure(page)) failures.push(`${url}: ${page.error ?? `HTTP ${page.status}`}`);
      return null;
    }
    return page;
  };

  // A verified time missing its day-1 closing (multi-day JSON-LD): kept while looking for a complete one.
  let partial: EventTimingResult | null = null;
  const consider = (result: EventTimingResult | null) => {
    if (isComplete(result)) return result;
    partial ??= result;
    return null;
  };
  const rootErrors: string[] = [];

  for (const root of roots) {
    const mainPage = await fetchPage(root);
    if (!mainPage) {
      rootErrors.push(root);
      continue;
    }
    const pageUrl = mainPage.url || root;

    const found = consider(extractFromPage(mainPage.html!, input, pageUrl, false));
    if (found) return found;

    const mainEvidence = editionEvidence(htmlToText(mainPage.html!), input) === 'match';
    for (const subUrl of findOfficialHoursPageLinks(mainPage.html!, pageUrl, input)) {
      if (visited.has(subUrl)) continue;
      const subPage = await fetchPage(subUrl);
      if (!subPage) continue;
      const subFound = consider(extractFromPage(subPage.html!, input, subPage.url || subUrl, mainEvidence));
      if (subFound) return subFound;
    }
  }

  if (partial) return partial;

  // No official page could be read at all (blocked, gone, unreachable): unknown, not "none published".
  if (rootErrors.length === roots.length) {
    return emptyResult(
      'FETCH_ERROR',
      roots[0],
      `Official site could not be read: ${(failures.length ? failures : rootErrors.map((url) => `${url}: ${lastError.get(url) ?? 'no page'}`)).slice(0, 3).join('; ')}`
    );
  }

  // Something could not be read: the answer is unknown, not "none published" — retry later.
  if (failures.length || budgetExhausted) {
    return emptyResult(
      'FETCH_ERROR',
      roots[0],
      failures.length ? `Official site could not be read: ${failures.slice(0, 3).join('; ')}` : 'Discovery budget ran out before all official pages were checked.'
    );
  }
  return emptyResult('UNAVAILABLE', roots[0], 'No verified clock-time data published on official sources.');
}
