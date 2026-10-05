/**
 * Form POSTs for exhibitor directories whose official list pages load their
 * cards that way (the dmg portal's pager). Kept here, beside the adapters,
 * rather than in the shared fetcher: it sends exactly what the official page's
 * own script sends — public form fields, no cookies or credentials — and is
 * injectable so tests run offline.
 */
export type Posted = { url: string; status: number; body: string };
/** `json`, when given, is sent as the JSON body instead of the form (directories whose pages POST JSON). */
export type Poster = (url: string, form: Record<string, string>, options?: { referer?: string; timeoutMs?: number; json?: unknown }) => Promise<Posted>;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Prismconnex-FindShows/1.0';
const MAX_BYTES = 8_000_000;

export const httpPoster: Poster = async (url, form, { referer, timeoutMs = 30_000, json } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs / 1000}s`)), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.5',
        'Content-Type': json === undefined ? 'application/x-www-form-urlencoded; charset=UTF-8' : 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(referer ? { Referer: referer } : {}),
      },
      body: json === undefined ? new URLSearchParams(form).toString() : JSON.stringify(json),
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await response.text();
    return { url: response.url || url, status: response.status, body: text.slice(0, MAX_BYTES) };
  } finally {
    clearTimeout(timer);
  }
};

/** One retry after a short pause for a POST that got no answer at all. */
export function retryingPoster(poster: Poster, delayMs = 1500): Poster {
  return async (url, form, options) => {
    try {
      return await poster(url, form, options);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return poster(url, form, options);
    }
  };
}
