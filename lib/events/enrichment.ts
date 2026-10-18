/**
 * Venue and organizer detail, read from an event's own website.
 *
 * Called only when someone opens an event page, and the result is cached in
 * EventEnrichment for a week. The catalog holds 11,635 events; fetching them
 * in bulk would be slow and discourteous, so nothing here runs on a schedule.
 *
 * Order of preference, best-structured first:
 *   1. JSON-LD (schema.org Event / Place / Organization) — explicitly published
 *      machine-readable data, so no guessing.
 *   2. Microdata/meta tags for the few fields they cover.
 *   3. Plain-text patterns for email and phone, which many sites only put in
 *      body copy.
 *
 * A field that cannot be found stays null. Nothing is inferred from the event
 * name or the city, because a plausible-looking wrong address is worse for a
 * user planning travel than an honest blank.
 */

const TIMEOUT_MS = 9_000;
const MAX_HTML = 300_000;
const USER_AGENT =
  process.env.FETCH_USER_AGENT ?? "PrismconnexCRM/1.0 (event detail enrichment)";

/** How long a cached row is served before a fetch is attempted again. */
export const ENRICHMENT_TTL_DAYS = 7;

export type EventEnrichmentFields = {
  venueName: string | null;
  venueAddress: string | null;
  venueCity: string | null;
  venueCountry: string | null;
  venuePostcode: string | null;
  venueWebsite: string | null;
  organizerName: string | null;
  organizerLegalName: string | null;
  organizerWebsite: string | null;
  organizerAddress: string | null;
  organizerEmail: string | null;
  organizerPhone: string | null;
  sourceUrl: string | null;
};

export const EMPTY_ENRICHMENT: EventEnrichmentFields = {
  venueName: null,
  venueAddress: null,
  venueCity: null,
  venueCountry: null,
  venuePostcode: null,
  venueWebsite: null,
  organizerName: null,
  organizerLegalName: null,
  organizerWebsite: null,
  organizerAddress: null,
  organizerEmail: null,
  organizerPhone: null,
  sourceUrl: null,
};

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = decodeEntities(value).replace(/\s+/g, " ").trim();
  // Guard against a whole page of body copy landing in an address field.
  return text && text.length <= 300 ? text : null;
}

/** schema.org fields are sometimes a bare string, sometimes an object. */
function textOf(value: unknown): string | null {
  if (typeof value === "string") return clean(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return clean(record.name ?? record["@id"] ?? record.url);
  }
  return null;
}

function flattenAddress(address: unknown): {
  full: string | null;
  city: string | null;
  country: string | null;
  postcode: string | null;
} {
  if (typeof address === "string") {
    return { full: clean(address), city: null, country: null, postcode: null };
  }
  if (!address || typeof address !== "object") {
    return { full: null, city: null, country: null, postcode: null };
  }
  const record = address as Record<string, unknown>;
  const parts = [
    record.streetAddress,
    record.addressLocality,
    record.addressRegion,
    record.postalCode,
    typeof record.addressCountry === "object"
      ? (record.addressCountry as Record<string, unknown>)?.name
      : record.addressCountry,
  ]
    .map((part) => clean(part))
    .filter(Boolean);

  return {
    full: parts.length ? parts.join(", ") : null,
    city: clean(record.addressLocality),
    country:
      typeof record.addressCountry === "object"
        ? clean((record.addressCountry as Record<string, unknown>)?.name)
        : clean(record.addressCountry),
    postcode: clean(record.postalCode),
  };
}

/** Every JSON-LD node on the page, with @graph and arrays flattened out. */
function jsonLdNodes(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  // exec in a loop rather than matchAll: this repo's ES5 target cannot iterate
  // the iterator matchAll returns.
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let block: RegExpExecArray | null;

  while ((block = pattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(block[1].trim());
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const node = queue.shift();
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        if (Array.isArray(record["@graph"])) queue.push(...(record["@graph"] as unknown[]));
        nodes.push(record);
        // Nested Place/Organization hang off an Event node.
        for (const key of ["location", "organizer", "performer", "address"]) {
          const nested = record[key];
          if (nested && typeof nested === "object") queue.push(nested);
        }
      }
    } catch {
      // A malformed block is skipped rather than failing the whole parse.
    }
  }
  return nodes;
}

function typeOf(node: Record<string, unknown>): string {
  const raw = node["@type"];
  if (typeof raw === "string") return raw.toLowerCase();
  if (Array.isArray(raw)) return raw.map(String).join(" ").toLowerCase();
  return "";
}

const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,20}\d)/;

/**
 * A candidate is only a phone number if it carries 9-15 actual digits.
 *
 * Without the digit count, PHONE_RE happily matched an agenda time range —
 * "4.30-4.40" was stored as an organizer's phone number, which is exactly the
 * kind of confident-looking wrong value this module is supposed to avoid.
 * Real numbers run 9 digits (national) to 15 (E.164 maximum).
 */
function looksLikePhone(candidate: string | null): boolean {
  if (!candidate) return false;
  const digits = candidate.replace(/\D/g, "").length;
  return digits >= 9 && digits <= 15;
}

function firstMatch(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  return match ? clean(match[1] ?? match[0]) : null;
}

/** Strip tags so email/phone patterns do not match inside markup. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

export function parseEnrichment(html: string, sourceUrl: string): EventEnrichmentFields {
  const result: EventEnrichmentFields = { ...EMPTY_ENRICHMENT, sourceUrl };
  const nodes = jsonLdNodes(html);

  for (const node of nodes) {
    const type = typeOf(node);

    if (type.includes("event")) {
      const location = node.location;
      if (location && typeof location === "object") {
        const place = location as Record<string, unknown>;
        result.venueName ??= textOf(place.name);
        result.venueWebsite ??= clean(place.url);
        const address = flattenAddress(place.address);
        result.venueAddress ??= address.full;
        result.venueCity ??= address.city;
        result.venueCountry ??= address.country;
        result.venuePostcode ??= address.postcode;
      }
      const organizer = node.organizer;
      if (organizer && typeof organizer === "object") {
        const org = organizer as Record<string, unknown>;
        result.organizerName ??= textOf(org.name);
        result.organizerLegalName ??= clean(org.legalName);
        result.organizerWebsite ??= clean(org.url);
        result.organizerEmail ??= clean(org.email);
        result.organizerPhone ??= clean(org.telephone);
        result.organizerAddress ??= flattenAddress(org.address).full;
      }
    }

    if (type.includes("place") || type.includes("eventvenue")) {
      result.venueName ??= textOf(node.name);
      result.venueWebsite ??= clean(node.url);
      const address = flattenAddress(node.address);
      result.venueAddress ??= address.full;
      result.venueCity ??= address.city;
      result.venueCountry ??= address.country;
      result.venuePostcode ??= address.postcode;
    }

    if (type.includes("organization") || type.includes("localbusiness")) {
      result.organizerName ??= textOf(node.name);
      result.organizerLegalName ??= clean(node.legalName);
      result.organizerWebsite ??= clean(node.url);
      result.organizerEmail ??= clean(node.email);
      result.organizerPhone ??= clean(node.telephone);
      result.organizerAddress ??= flattenAddress(node.address).full;
    }
  }

  // Meta tags fill a couple of gaps JSON-LD often leaves.
  result.organizerName ??= firstMatch(
    html,
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
  );

  // Contact details are frequently only in body copy.
  const text = visibleText(html);
  result.organizerEmail ??= firstMatch(text, EMAIL_RE);
  const phone = firstMatch(text, PHONE_RE);
  result.organizerPhone ??= looksLikePhone(phone) ? phone : null;

  return result;
}

/** Fetches one page, politely, and parses it. Never throws. */
export async function fetchEnrichment(
  url: string
): Promise<{ fields: EventEnrichmentFields; error: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    });
    if (!response.ok) return { fields: { ...EMPTY_ENRICHMENT }, error: `HTTP ${response.status}` };

    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) return { fields: { ...EMPTY_ENRICHMENT }, error: "not html" };

    const html = (await response.text()).slice(0, MAX_HTML);
    return { fields: parseEnrichment(html, response.url || url), error: null };
  } catch (cause) {
    const message =
      cause instanceof Error && cause.name === "AbortError"
        ? "timeout"
        : cause instanceof Error
          ? cause.message
          : "fetch failed";
    return { fields: { ...EMPTY_ENRICHMENT }, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** True when every field came back empty — worth recording as a miss. */
export function isEmpty(fields: EventEnrichmentFields): boolean {
  return (Object.keys(fields) as (keyof EventEnrichmentFields)[])
    .filter((key) => key !== "sourceUrl")
    .every((key) => !fields[key]);
}
