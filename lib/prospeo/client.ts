/**
 * Minimal client for Prospeo's official REST API (https://prospeo.io/api-docs).
 *
 * Only Search Person is used. It returns people with their email/mobile
 * *status* but never the revealed values, and costs 1 credit per page that
 * returns at least one person (repeat pages within 30 days are free and come
 * back with `free: true`). Enrich Person — which spends 1 credit per email and
 * 10 per mobile — is deliberately not called anywhere.
 *
 * The fetcher and sleep are injectable so tests never touch the network.
 */

export const PROSPEO_BASE_URL = "https://api.prospeo.io";
/** Fixed by Prospeo. */
export const PROSPEO_PAGE_SIZE = 25;

export type ProspeoFetch = (url: string, init: RequestInit) => Promise<Response>;

export type ProspeoPerson = {
  person_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  linkedin_url?: string | null;
  current_job_title?: string | null;
  job_history?: Array<{ current?: boolean; seniority?: string | null; title?: string | null }> | null;
  location?: { country?: string | null; city?: string | null } | null;
  email?: { status?: string | null; revealed?: boolean; email?: string | null } | null;
  mobile?: {
    status?: string | null;
    revealed?: boolean;
    mobile?: string | null;
    mobile_international?: string | null;
  } | null;
};

export type ProspeoCompany = {
  company_id?: string;
  name?: string | null;
  website?: string | null;
  domain?: string | null;
  linkedin_url?: string | null;
  industry?: string | null;
  employee_count?: number | null;
};

export type ProspeoSearchResult = { person: ProspeoPerson; company?: ProspeoCompany | null };

export type ProspeoSearchPage = {
  results: ProspeoSearchResult[];
  free: boolean;
  pagination: { current_page: number; per_page: number; total_page: number; total_count: number };
};

/** A Prospeo `error_code` (e.g. INVALID_API_KEY, INSUFFICIENT_CREDITS) or a transport failure. */
export class ProspeoError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "ProspeoError";
  }
}

/** Codes worth retrying after a pause; everything else fails immediately. */
const RETRYABLE = new Set(["RATE_LIMITED", "SERVICE_TEMPORARILY_UNAVAILABLE", "INTERNAL_ERROR", "NETWORK_ERROR"]);

export type SearchOptions = {
  apiKey: string;
  fetchImpl?: ProspeoFetch;
  sleep?: (ms: number) => Promise<void>;
  /** Attempts per page, including the first. */
  maxAttempts?: number;
  /** Base backoff; doubles each retry. */
  backoffMs?: number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One Search Person page, with retries for rate limits and transient errors. NO_RESULTS → empty page. */
export async function searchPersonPage(
  filters: Record<string, unknown>,
  page: number,
  options: SearchOptions
): Promise<ProspeoSearchPage> {
  const fetchImpl = options.fetchImpl ?? (fetch as ProspeoFetch);
  const sleep = options.sleep ?? defaultSleep;
  const maxAttempts = options.maxAttempts ?? 4;
  const backoffMs = options.backoffMs ?? 1500;

  let lastError: ProspeoError | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(`${PROSPEO_BASE_URL}/search-person`, {
        method: "POST",
        headers: { "X-KEY": options.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ page, filters }),
      });
    } catch (cause) {
      lastError = new ProspeoError("NETWORK_ERROR", cause instanceof Error ? cause.message : "Network error");
      if (attempt < maxAttempts) await sleep(backoffMs * 2 ** (attempt - 1));
      continue;
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    if (response.status === 429) {
      lastError = new ProspeoError("RATE_LIMITED", "Prospeo rate limit exceeded", 429);
    } else if (body.error === true || !response.ok) {
      const code = typeof body.error_code === "string" ? body.error_code : `HTTP_${response.status}`;
      if (code === "NO_RESULTS") {
        return { results: [], free: true, pagination: { current_page: page, per_page: PROSPEO_PAGE_SIZE, total_page: 0, total_count: 0 } };
      }
      const detail = typeof body.filter_error === "string" ? `: ${body.filter_error}` : "";
      lastError = new ProspeoError(code, `Prospeo error ${code}${detail}`, response.status);
      if (!RETRYABLE.has(code)) throw lastError;
    } else {
      const pagination = (body.pagination ?? {}) as Partial<ProspeoSearchPage["pagination"]>;
      return {
        results: Array.isArray(body.results) ? (body.results as ProspeoSearchResult[]) : [],
        free: body.free === true,
        pagination: {
          current_page: pagination.current_page ?? page,
          per_page: pagination.per_page ?? PROSPEO_PAGE_SIZE,
          total_page: pagination.total_page ?? page,
          total_count: pagination.total_count ?? 0,
        },
      };
    }

    if (attempt < maxAttempts) await sleep(backoffMs * 2 ** (attempt - 1));
  }
  throw lastError ?? new ProspeoError("UNKNOWN", "Prospeo request failed");
}

export type SearchAllResult = {
  results: ProspeoSearchResult[];
  totalCount: number;
  totalPages: number;
  pagesFetched: number;
  /** Pages Prospeo charged for (non-free pages that returned people). */
  creditsUsed: number;
  /** True when maxPages stopped us before the last page. */
  truncated: boolean;
};

/**
 * Every page of a search, in order. Pages are fetched one after another with a
 * short pause (the lowest plan allows 1 search request per second).
 */
export async function searchAllPeople(
  filters: Record<string, unknown>,
  options: SearchOptions & { maxPages?: number; pauseMs?: number }
): Promise<SearchAllResult> {
  const sleep = options.sleep ?? defaultSleep;
  const maxPages = options.maxPages ?? 40;
  const pauseMs = options.pauseMs ?? 1100;

  const results: ProspeoSearchResult[] = [];
  let totalPages = 1;
  let totalCount = 0;
  let pagesFetched = 0;
  let creditsUsed = 0;

  for (let page = 1; page <= totalPages && page <= maxPages; page += 1) {
    if (page > 1) await sleep(pauseMs);
    const data = await searchPersonPage(filters, page, options);
    pagesFetched += 1;
    results.push(...data.results);
    if (data.results.length > 0 && !data.free) creditsUsed += 1;
    totalPages = data.pagination.total_page;
    totalCount = data.pagination.total_count;
    if (data.results.length === 0) break;
  }

  return { results, totalCount, totalPages, pagesFetched, creditsUsed, truncated: totalPages > maxPages };
}
