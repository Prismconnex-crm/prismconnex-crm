/**
 * Reads a JSON body from an API response without assuming it is JSON.
 *
 * The API routes always answer with JSON (jsonOk/jsonError), but the response
 * that reaches the browser is not always theirs. When an App Router route fails
 * to compile, or throws before the handler runs, Next serves the Pages Router
 * `_error` document instead — an HTML page carrying the status. `res.json()`
 * then rejects with "Unexpected token '<', "<!DOCTYPE "... is not valid JSON",
 * which replaces the real failure with a parse error and hides the status code
 * that would have explained it. The same substitution happens behind a proxy
 * or CDN that renders its own 502/504 page.
 *
 * Returning null instead lets callers fall back to their own message, so a
 * server-side fault surfaces as the form's normal error text rather than as a
 * crash. Mirrors the `.json().catch(...)` guard already used in the companies
 * section, in a form the auth flows can share.
 */
export async function readJsonResponse<T = unknown>(res: Response): Promise<T | null> {
    const text = await res.text();
    if (!text) return null;

    try {
        return JSON.parse(text) as T;
    } catch {
        // Logged, not surfaced: the body is an error document, and its markup
        // is noise in the UI but the one clue worth having in the console.
        console.error(
            `[api] expected JSON from ${res.url || "the API"} but received ` +
                `${res.headers.get("content-type") || "an unknown content type"} ` +
                `(HTTP ${res.status}). First 200 characters:`,
            text.slice(0, 200)
        );
        return null;
    }
}

/** The error envelope every route produces via jsonError(). */
export type ApiErrorBody = {
    error?: { message?: string; code?: string; details?: unknown };
};
