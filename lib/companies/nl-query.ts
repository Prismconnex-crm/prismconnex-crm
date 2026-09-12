import {
  COMPANY_CATEGORIES,
  COMPANY_COUNTRIES,
  COMPANY_EMPLOYEE_RANGES,
} from "@/lib/company-classification";

/**
 * Deterministic natural-language parsing for the Companies "Find anything"
 * panel.
 *
 * No model call: a question is turned into filters by dictionary and regex
 * alone, so the panel answers at database speed and keeps working with no
 * network and no ANTHROPIC_API_KEY. Everything here is pure — the API route
 * and the client both import it, and neither pulls in Prisma or React.
 */

export type CompanySort = "relevance" | "top" | "name";

/**
 * The complete search state of the Companies page. The left rail, the query
 * string of /api/companies and the assistant's parse all speak this one shape,
 * which is what keeps a removed chip and a rail click on exactly the same path.
 */
export type CompanyQueryState = {
  /** Company-name prefix search. */
  search: string | null;
  category: string | null;
  region: string | null;
  country: string | null;
  city: string | null;
  /**
   * A headcount band as `"lo-hi"` or `"lo+"`. Either one of
   * COMPANY_EMPLOYEE_RANGES (picked in the rail) or a free band the parser read
   * out of the question ("200-500"); both are expanded the same way in SQL.
   */
  employeeRange: string | null;
  keywords: string[];
  limit: number;
  sort: CompanySort;
};

/** Chip shape shared with components/search/filter-chips (kept structural so this module stays server-safe). */
export type CompanyQueryChip = { id: string; label: string; value: string };

export const COMPANY_LIMIT_OPTIONS = [25, 50, 100, 200, 500] as const;
export const DEFAULT_COMPANY_LIMIT = 25;
export const MAX_COMPANY_LIMIT = 500;

export function emptyCompanyQuery(): CompanyQueryState {
  return {
    search: null,
    category: null,
    region: null,
    country: null,
    city: null,
    employeeRange: null,
    keywords: [],
    limit: DEFAULT_COMPANY_LIMIT,
    sort: "relevance",
  };
}

// ── Dictionaries ────────────────────────────────────────────────────────────

const CATEGORY_ALIASES: Record<string, string> = {
  "information technology": "information technology & services",
  "it services": "information technology & services",
  it: "information technology & services",
  tech: "information technology & services",
  technology: "information technology & services",
  software: "computer software",
  saas: "computer software",
  fintech: "financial services",
  finance: "financial services",
  financial: "financial services",
  banking: "financial services",
  insurance: "financial services",
  healthcare: "hospital & health care",
  hospital: "hospital & health care",
  medical: "hospital & health care",
  pharma: "hospital & health care",
  health: "health, wellness & fitness",
  wellness: "health, wellness & fitness",
  fitness: "health, wellness & fitness",
  marketing: "marketing and advertising",
  advertising: "marketing and advertising",
  adtech: "marketing and advertising",
  "real estate": "real estate",
  property: "real estate",
  realty: "real estate",
  construction: "construction",
  infrastructure: "construction",
  retail: "retail",
  ecommerce: "retail",
  "e-commerce": "retail",
  automotive: "automotive",
  auto: "automotive",
  education: "education management",
  edtech: "education management",
  agriculture: "agriculture",
  agritech: "agriculture",
  farming: "agriculture",
  hospitality: "hospitality",
  hotels: "hospitality",
  hotel: "hospitality",
  travel: "hospitality",
  restaurants: "restaurants",
  restaurant: "restaurants",
  food: "restaurants",
  accounting: "accounting",
  audit: "accounting",
  consulting: "management consulting",
  consultancy: "management consulting",
  internet: "internet",
  web: "internet",
  design: "design",
  "trade show": "trade show events",
  "trade shows": "trade show events",
  events: "trade show events",
  "consumer services": "consumer services",
  electronics: "consumer electronics",
  "consumer electronics": "consumer electronics",
};

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "USA",
  "u.s.": "USA",
  "u.s.a.": "USA",
  us: "USA",
  "united states": "USA",
  "united states of america": "USA",
  america: "USA",
  american: "USA",
  uk: "UK",
  "united kingdom": "UK",
  britain: "UK",
  british: "UK",
  england: "UK",
  india: "India",
  indian: "India",
  germany: "Germany",
  german: "Germany",
  france: "France",
  french: "France",
  japan: "Japan",
  japanese: "Japan",
  china: "China",
  chinese: "China",
  canada: "Canada",
  canadian: "Canada",
  australia: "Australia",
  australian: "Australia",
  singapore: "Singapore",
  uae: "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
};

const REGION_ALIASES: Record<string, string> = {
  americas: "Americas",
  "north america": "Americas",
  "south america": "Americas",
  latam: "Americas",
  europe: "Europe",
  european: "Europe",
  emea: "Europe",
  asia: "Asia-Pacific",
  "asia-pacific": "Asia-Pacific",
  "asia pacific": "Asia-Pacific",
  apac: "Asia-Pacific",
  africa: "Africa & Middle East",
  "middle east": "Africa & Middle East",
  mena: "Africa & Middle East",
};

/**
 * Cities the discovery dataset actually holds in volume (every one with 300+
 * companies), plus the handful of global hubs its non-Indian rows sit in.
 * `headquarters` is stored as "City, [State,] Country", so the city is the
 * first comma-segment.
 */
export const COMPANY_CITIES = [
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Pune",
  "Ahmedabad",
  "Jaipur",
  "Gurugram",
  "Noida",
  "Lucknow",
  "Surat",
  "Chandigarh",
  "Kochi",
  "Coimbatore",
  "Indore",
  "Visakhapatnam",
  "Nagpur",
  "Vadodara",
  "Thiruvananthapuram",
  "Bhopal",
  "Bhubaneswar",
  "Patna",
  "Dehradun",
  "Mangalore",
  "Rajkot",
  "Ludhiana",
  "Ranchi",
  "Ghaziabad",
  "Kanpur",
  "Guwahati",
  "Madurai",
  "Mysuru",
  "Raipur",
  "Aurangabad",
  "Faridabad",
  "Varanasi",
  "Nashik",
  "Vijayawada",
  "Agra",
  "Amritsar",
  "Jodhpur",
  "Kolhapur",
  "Tiruchirappalli",
  "Salem",
  "Jalandhar",
  "Udaipur",
  "Hubli",
  "Siliguri",
  "New York",
  "San Francisco",
  "Chicago",
  "Boston",
  "Austin",
  "London",
  "Berlin",
  "Paris",
  "Singapore",
  "Tokyo",
  "Sydney",
  "Toronto",
  "Dubai",
] as const;

/** Former/colloquial names, so "Bangalore" and "Bombay" still land. */
const CITY_ALIASES: Record<string, string> = {
  bangalore: "Bengaluru",
  bombay: "Mumbai",
  calcutta: "Kolkata",
  madras: "Chennai",
  gurgaon: "Gurugram",
  "new delhi": "Delhi",
  ncr: "Delhi",
  trivandrum: "Thiruvananthapuram",
  mysore: "Mysuru",
  cochin: "Kochi",
  vizag: "Visakhapatnam",
  baroda: "Vadodara",
  trichy: "Tiruchirappalli",
  nyc: "New York",
  sf: "San Francisco",
};

// ── Matching helpers ────────────────────────────────────────────────────────

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWord(text: string, word: string) {
  return new RegExp(`(?:^|[^a-z0-9&])${escapeRegExp(word)}(?:$|[^a-z0-9&])`, "i").test(text);
}

/** Longest key first, so "united states" beats "us" and "asia pacific" beats "asia". */
function matchAlias(text: string, aliases: Record<string, string>): string | null {
  const keys = Object.keys(aliases).sort((left, right) => right.length - left.length);
  for (const key of keys) {
    if (hasWord(text, key)) return aliases[key];
  }
  return null;
}

function matchList(text: string, values: readonly string[]): string | null {
  const sorted = [...values].sort((left, right) => right.length - left.length);
  for (const value of sorted) {
    if (hasWord(text, value)) return value;
  }
  return null;
}

// ── Headcount ───────────────────────────────────────────────────────────────

export type HeadcountBand = { min: number; max: number };

/** Reads "51-200" / "1001+" into numbers. Returns null for anything else. */
export function parseBand(label: string): HeadcountBand | null {
  const open = label.match(/^\s*(\d+)\s*\+\s*$/);
  if (open) return { min: Number.parseInt(open[1], 10), max: Number.POSITIVE_INFINITY };
  const closed = label.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (closed) {
    const min = Number.parseInt(closed[1], 10);
    const max = Number.parseInt(closed[2], 10);
    return min <= max ? { min, max } : { min: max, max: min };
  }
  return null;
}

/**
 * Expands a requested band into the stored `employeeRange` labels it covers.
 *
 * Containment, not overlap: "200-500" must not drag in "51-200" (which is
 * mostly companies below 200). Only when nothing is fully contained — a band
 * narrower than the dataset's own buckets, e.g. "300-400" — does it fall back
 * to overlapping buckets so the question still returns something.
 */
export function expandEmployeeRange(label: string): string[] {
  const wanted = parseBand(label);
  if (!wanted) return [label];

  const stored: Array<{ value: string; band: HeadcountBand }> = [];
  for (const value of COMPANY_EMPLOYEE_RANGES) {
    const band = parseBand(value);
    if (band) stored.push({ value, band });
  }

  const contained = stored
    .filter((entry) => entry.band.min >= wanted.min && entry.band.max <= wanted.max)
    .map((entry) => entry.value);
  if (contained.length > 0) return contained;

  const overlapping = stored
    .filter((entry) => entry.band.min <= wanted.max && entry.band.max >= wanted.min)
    .map((entry) => entry.value);
  return overlapping.length > 0 ? overlapping : [label];
}

/** Picks the headcount band out of a question, as a `"lo-hi"` / `"lo+"` label. */
function parseHeadcount(text: string): string | null {
  // "between 200 and 500", "200-500 employees", "200 to 500 headcount"
  const explicit = text.match(
    /\b(?:between\s+)?(\d{1,6})\s*(?:-|–|—|to|and)\s*(\d{1,6})\s*\+?\s*(?:employees|staff|people|headcount|emp)?\b/
  );
  if (explicit) {
    const low = Number.parseInt(explicit[1], 10);
    const high = Number.parseInt(explicit[2], 10);
    // Bare "100 to 200" without a headcount word is only a size if the
    // question actually mentions headcount somewhere.
    if (explicit[0].match(/employees|staff|people|headcount|emp/) || /headcount|employees|size/.test(text)) {
      return `${Math.min(low, high)}-${Math.max(low, high)}`;
    }
  }

  // "1000+", "at least 1000", "over 1000 employees", "more than 1000 staff"
  const atLeast = text.match(
    /\b(?:(?:at\s+least|over|above|more\s+than|minimum(?:\s+of)?|from)\s+)?(\d{1,6})\s*(?:\+|or\s+more|and\s+above|plus)\s*(?:employees|staff|people|headcount)?\b/
  );
  if (atLeast && (atLeast[0].includes("+") || /or more|and above|plus/.test(atLeast[0]))) {
    return `${Number.parseInt(atLeast[1], 10)}+`;
  }
  const minPhrase = text.match(
    /\b(?:at\s+least|over|above|more\s+than|minimum(?:\s+of)?)\s+(\d{1,6})\s*(?:employees|staff|people|headcount)\b/
  );
  if (minPhrase) return `${Number.parseInt(minPhrase[1], 10)}+`;

  // "under 500 employees", "fewer than 500 staff", "up to 500 people"
  const maxPhrase = text.match(
    /\b(?:under|below|less\s+than|fewer\s+than|up\s+to|max(?:imum)?(?:\s+of)?)\s+(\d{1,6})\s*(?:employees|staff|people|headcount)\b/
  );
  if (maxPhrase) return `1-${Number.parseInt(maxPhrase[1], 10)}`;

  // Bare "with 250 employees" — the bucket that contains 250.
  const exact = text.match(/\b(\d{1,6})\s*(?:employees|staff|people|headcount)\b/);
  if (exact) {
    const n = Number.parseInt(exact[1], 10);
    const hit = COMPANY_EMPLOYEE_RANGES.find((value) => {
      const band = parseBand(value);
      return band ? n >= band.min && n <= band.max : false;
    });
    if (hit) return hit;
  }

  return null;
}

// ── Keywords ────────────────────────────────────────────────────────────────

const KEYWORD_STOPWORDS = new Set([
  "companies",
  "company",
  "firms",
  "leads",
  "results",
  "top",
  "best",
  "list",
  "show",
  "find",
  "give",
  "get",
  "in",
  "the",
  "with",
  "and",
]);

/** Collects capture group 1 of every match, without relying on matchAll. */
function collectMatches(raw: string, pattern: RegExp): string[] {
  const out: string[] = [];
  const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match = regex.exec(raw);
  while (match) {
    out.push(match[1]);
    // Zero-length matches would spin forever.
    if (match.index === regex.lastIndex) regex.lastIndex += 1;
    match = regex.exec(raw);
  }
  return out;
}

function parseKeywords(raw: string): string[] {
  const found: string[] = [];

  // Anything the user quoted is a keyword verbatim.
  for (const quoted of collectMatches(raw, /["'“”‘’]([^"'“”‘’]{2,40})["'“”‘’]/g)) {
    found.push(quoted.trim());
  }

  // "keyword analytics", "keywords: analytics, payments"
  for (const list of collectMatches(raw, /\bkeywords?\s*[:=]?\s*([^,.;]+(?:,\s*[^,.;]+)*)/gi)) {
    for (const part of list.split(",")) {
      const value = part.replace(/["'“”‘’]/g, "").trim();
      if (value.length >= 2 && !KEYWORD_STOPWORDS.has(value.toLowerCase())) found.push(value);
    }
  }

  const unique = new Map<string, string>();
  for (const value of found) {
    const key = value.toLowerCase();
    if (key && !unique.has(key)) unique.set(key, value);
  }
  return Array.from(unique.values()).slice(0, 4);
}

// ── Limit & sort ────────────────────────────────────────────────────────────

/** Reads the comma-separated `keywords` query param back into a list. */
export function splitKeywords(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Map<string, string>();
  for (const part of value.split(",")) {
    const keyword = part.trim();
    if (keyword.length < 2) continue;
    const key = keyword.toLowerCase();
    if (!seen.has(key)) seen.set(key, keyword);
  }
  return Array.from(seen.values()).slice(0, 4);
}

export function clampCompanyLimit(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_COMPANY_LIMIT;
  return Math.min(MAX_COMPANY_LIMIT, Math.max(1, Math.trunc(value)));
}

function parseLimit(text: string): number | null {
  // "100 top companies", "30 IT firms" — a few descriptive words may sit
  // between the number and the noun.
  const beforeNoun = text.match(
    /\b(\d{1,4})\s+(?:[a-z&,'-]+\s+){0,4}?(?:companies|company|leads|results|firms|businesses)\b/
  );
  if (beforeNoun) return clampCompanyLimit(Number.parseInt(beforeNoun[1], 10));

  // "list 100", "top 50", "show me 200"
  const afterVerb = text.match(/\b(?:top|first|list|show|give|find|get|fetch)(?:\s+me)?\s+(\d{1,4})\b/);
  if (afterVerb) return clampCompanyLimit(Number.parseInt(afterVerb[1], 10));

  return null;
}

function parseSort(text: string): CompanySort {
  if (/\b(?:alphabetical(?:ly)?|a-z|by\s+name)\b/.test(text)) return "name";
  if (/\b(?:top|best|leading|biggest|largest|highest[- ]rated|most\s+engaged)\b/.test(text)) return "top";
  return "relevance";
}

// ── Parse ───────────────────────────────────────────────────────────────────

/**
 * Reads a question into the page's search state. Never throws and never
 * returns nothing useful: with no dimension recognised, the whole sentence
 * becomes a company-name prefix search, which is what the box did before.
 */
export function parseCompanyQuery(raw: string): CompanyQueryState {
  const text = raw.toLowerCase();
  const state = emptyCompanyQuery();

  state.limit = parseLimit(text) ?? DEFAULT_COMPANY_LIMIT;
  state.sort = parseSort(text);
  state.employeeRange = parseHeadcount(text);
  state.keywords = parseKeywords(raw);

  // Full catalogue names win over aliases ("financial services" over "finance").
  state.category = matchList(text, COMPANY_CATEGORIES) ?? matchAlias(text, CATEGORY_ALIASES);

  state.region = matchAlias(text, REGION_ALIASES);

  // The rail's picker uses full country names; the dataset stores short forms.
  // Aliases resolve to the stored spelling, which lib/companies/search.ts maps
  // back out. An exact picker name is accepted too, for restored history.
  state.country = matchAlias(text, COUNTRY_ALIASES) ?? matchList(text, COMPANY_COUNTRIES);

  state.city = matchList(text, COMPANY_CITIES) ?? matchAlias(text, CITY_ALIASES);

  const matchedAnything =
    state.category || state.region || state.country || state.city || state.employeeRange || state.keywords.length > 0;

  if (!matchedAnything) {
    const trimmed = raw.trim();
    if (trimmed.length >= 2) state.search = trimmed;
  }

  return state;
}

// ── Chips & prose ───────────────────────────────────────────────────────────

export function formatCategoryLabel(category: string) {
  return category.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Rail/panel chips for the current state. Chip ids feed removeCompanyChip. */
export function buildCompanyFilterChips(state: CompanyQueryState): CompanyQueryChip[] {
  const chips: CompanyQueryChip[] = [];
  if (state.search) chips.push({ id: "search", label: "Name", value: state.search });
  if (state.category) chips.push({ id: "category", label: "Category", value: formatCategoryLabel(state.category) });
  if (state.region) chips.push({ id: "region", label: "Region", value: state.region });
  if (state.country) chips.push({ id: "country", label: "Country", value: state.country });
  if (state.city) chips.push({ id: "city", label: "City", value: state.city });
  if (state.employeeRange) chips.push({ id: "employeeRange", label: "Headcount", value: state.employeeRange });
  for (const keyword of state.keywords) {
    chips.push({ id: `keyword:${keyword}`, label: "Keyword", value: keyword });
  }
  if (state.sort !== "relevance") {
    chips.push({ id: "sort", label: "Sort", value: state.sort === "top" ? "Top rated" : "A–Z" });
  }
  return chips;
}

/** Drops one chip. Unknown ids are a no-op so a stale chip can't wipe the state. */
export function removeCompanyChip(state: CompanyQueryState, chipId: string): CompanyQueryState {
  if (chipId.startsWith("keyword:")) {
    const value = chipId.slice("keyword:".length);
    return { ...state, keywords: state.keywords.filter((keyword) => keyword !== value) };
  }
  switch (chipId) {
    case "search":
      return { ...state, search: null };
    case "category":
      return { ...state, category: null };
    case "region":
      return { ...state, region: null };
    case "country":
      return { ...state, country: null };
    case "city":
      return { ...state, city: null };
    case "employeeRange":
      return { ...state, employeeRange: null };
    case "sort":
      return { ...state, sort: "relevance" };
    default:
      return state;
  }
}

/**
 * Narrows the page state to the filter half of it, which is what
 * lib/companies/search.ts consumes. Structural on purpose — this module must
 * not import search.ts, which imports it.
 */
export function companyQueryToFilters(state: CompanyQueryState) {
  return {
    search: state.search,
    category: state.category,
    employeeRange: state.employeeRange,
    region: state.region,
    country: state.country,
    city: state.city,
    keywords: state.keywords,
    sort: state.sort,
  };
}

export function hasCompanyCriteria(state: CompanyQueryState) {
  return Boolean(
    state.search ||
      state.category ||
      state.region ||
      state.country ||
      state.city ||
      state.employeeRange ||
      state.keywords.length > 0
  );
}

/**
 * The one-line answer above the results.
 *
 * `total` is a bounded count (see countCompanies), so `capped` means "at least
 * this many" — never dress that up as an exact figure.
 */
export function describeCompanyQuery(input: {
  state: CompanyQueryState;
  total: number;
  capped: boolean;
  shown: number;
}): string {
  const { state, total, capped, shown } = input;
  const chips = buildCompanyFilterChips(state).filter((chip) => chip.id !== "sort");
  const applied =
    chips.length > 0
      ? `Applied filters: ${chips.map((chip) => `${chip.label} = ${chip.value}`).join(", ")}.`
      : "No filters recognised — searching the whole discovery dataset.";

  if (shown === 0) {
    return `${applied} No companies matched. Try dropping a filter.`;
  }

  const count = capped ? `${total.toLocaleString()}+` : total.toLocaleString();
  const noun = total === 1 && !capped ? "company" : "companies";
  const showing = shown < total || capped ? ` Showing the top ${shown}.` : "";
  return `${applied} Found ${count} ${noun}.${showing}`;
}
