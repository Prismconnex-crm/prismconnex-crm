/**
 * Server-side sanitising for note content.
 *
 * The HTML comes from a contenteditable the user types and pastes into, so it
 * is sanitised on write rather than trusted: the stored value is written back
 * into the DOM with dangerouslySetInnerHTML, and a pasted `<script>` or an
 * `onerror=` attribute would otherwise execute for anyone who later opens the
 * event. Sanitising on write means the stored value is already safe for every
 * reader, however it arrived.
 *
 * Shared by the collection and single-note routes so there is one definition of
 * what is allowed — two copies would drift, and the weaker one would win.
 */

export const MAX_HTML = 100_000;
/** A data-URL PNG from a small canvas. */
export const MAX_SKETCH = 2_000_000;
export const MAX_TITLE = 200;

/** Tags the editor's toolbar can produce, and nothing else. */
const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "s", "p", "br", "div", "span",
  "ul", "ol", "li", "a", "h1", "h2", "h3", "blockquote", "code", "pre",
]);

export function sanitiseHtml(input: unknown): string {
  let html = (typeof input === "string" ? input : "").slice(0, MAX_HTML);

  // Whole elements that can execute or load, content included.
  html = html.replace(
    /<(script|style|iframe|object|embed|form|link|meta|svg|math)\b[\s\S]*?<\/\1\s*>/gi,
    ""
  );
  html = html.replace(/<(script|style|iframe|object|embed|form|link|meta|svg|math)\b[^>]*>/gi, "");

  html = html.replace(/<(\/?)([a-zA-Z0-9-]+)([^>]*)>/g, (_match, closing, tag, attrs) => {
    const name = String(tag).toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    if (closing) return `</${name}>`;

    // Only href on an anchor survives, and only http/https/mailto.
    if (name === "a") {
      const href = String(attrs).match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
      const safe = /^(https?:|mailto:)/i.test(href.trim());
      return safe
        ? `<a href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">`
        : "<a>";
    }
    // Every other tag keeps no attributes at all, which removes on* handlers,
    // style, and javascript: URLs in one go.
    return `<${name}>`;
  });

  return html;
}

export function sanitiseSketch(input: unknown): string | null {
  if (typeof input !== "string" || !input) return null;
  if (input.length > MAX_SKETCH) return null;
  // Only an inline PNG — never a remote URL that would phone home on render.
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(input) ? input : null;
}

/** Titles are rendered as text, so markup is stripped rather than escaped. */
export function sanitiseTitle(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
}
