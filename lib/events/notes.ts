/**
 * Pure helpers for event notes: titles, plain-text and Markdown export.
 *
 * Kept out of the component and the routes so the title shown in the Recent
 * list, the title stored on the row, and the heading in a downloaded file are
 * all produced by the same code — and so the export conversion can be tested
 * without a DOM.
 */

export const UNTITLED = "Untitled";

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…",
};

export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

/**
 * Note HTML as plain text, with block boundaries preserved as line breaks.
 *
 * Stripping tags without that gives one run-on line, which is useless in a .txt
 * file — the whole point of the export is that it reads like what was typed.
 */
export function htmlToPlainText(html: string): string {
  return decodeEntities(
    (html ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)\s*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    // Three or more blank lines is always accidental markup, never intent.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The characters that would otherwise turn note text into Markdown syntax. */
function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!>])/g, "\\$1");
}

/**
 * Note HTML as Markdown.
 *
 * Only the formatting the toolbar can actually produce is converted — bold,
 * italic, links, bullet and numbered lists, headings. Anything else degrades to
 * escaped plain text rather than being guessed at, so the file never claims
 * structure the note did not have.
 */
export function htmlToMarkdown(html: string): string {
  let out = (html ?? "").replace(/\r/g, "");

  // Ordered lists need their index, so they are numbered before the generic
  // <li> rule turns everything into a bullet.
  out = out.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner: string) => {
    let index = 0;
    return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, item: string) => {
      index += 1;
      return `\n${index}. ${item.trim()}`;
    });
  });

  out = out
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner: string) =>
      inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, item: string) => `\n- ${item.trim()}`)
    )
    .replace(/<(h1)[^>]*>([\s\S]*?)<\/h1>/gi, (_, __, text: string) => `\n# ${text.trim()}\n`)
    .replace(/<(h2)[^>]*>([\s\S]*?)<\/h2>/gi, (_, __, text: string) => `\n## ${text.trim()}\n`)
    .replace(/<(h3)[^>]*>([\s\S]*?)<\/h3>/gi, (_, __, text: string) => `\n### ${text.trim()}\n`)
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, text: string) => `\n> ${text.trim()}\n`)
    .replace(/<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_, href: string, text: string) => `[${text.trim()}](${href})`)
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, text: string) => `**${text.trim()}**`)
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, text: string) => `*${text.trim()}*`)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, text: string) => `\`${text.trim()}\``)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div)\s*>/gi, "\n\n");

  // Whatever markup is left carried no meaning the toolbar can produce.
  out = decodeEntities(out.replace(/<[^>]+>/g, ""));

  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The note's first non-empty line, for the Recent and Saved lists. */
export function deriveTitle(html: string): string {
  const firstLine = htmlToPlainText(html)
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return UNTITLED;
  // Leading "- " comes from the note opening with a bullet; it is list markup,
  // not part of the title.
  const cleaned = firstLine.replace(/^-\s+/, "").trim();
  if (!cleaned) return UNTITLED;
  return cleaned.length > 80 ? `${cleaned.slice(0, 79)}…` : cleaned;
}

/** True when the note holds nothing a reader would see. */
export function isBlank(html: string): boolean {
  return htmlToPlainText(html).length === 0;
}

export type NoteExportFormat = "txt" | "md";

/** prismconnex-event-<slug>-<yyyy-mm-dd>-note.<ext> */
export function buildNoteFilename(
  eventSlug: string,
  format: NoteExportFormat,
  when: Date = new Date()
): string {
  const date = [
    when.getFullYear(),
    String(when.getMonth() + 1).padStart(2, "0"),
    String(when.getDate()).padStart(2, "0"),
  ].join("-");
  // A slug reaches the filesystem here, so anything that could traverse a path
  // or break a download header is replaced rather than trusted.
  const safeSlug = (eventSlug || "event").replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "");
  return `prismconnex-event-${safeSlug}-${date}-note.${format}`;
}

/** The file body for a download, including a Markdown heading where it helps. */
export function buildNoteFile(
  html: string,
  format: NoteExportFormat
): string {
  if (format === "txt") return htmlToPlainText(html);

  const body = htmlToMarkdown(html);
  const title = deriveTitle(html);
  // A note whose first line already became a heading does not need another.
  if (title === UNTITLED || body.startsWith("#")) return body;
  return `# ${escapeMarkdown(title)}\n\n${body}`;
}

export type NoteDto = {
  id: string;
  title: string;
  html: string;
  sketch: string | null;
  saved: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * A stored note as the client sees it.
 *
 * Lives here rather than in the route because a Next.js route module may only
 * export its HTTP handlers — exporting a helper from one made the build fail
 * with "does not satisfy the constraint { [x: string]: never }".
 */
export function toNoteDto(note: {
  id: string;
  title: string;
  html: string;
  sketch: string | null;
  saved: boolean;
  createdAt: Date;
  updatedAt: Date;
}): NoteDto {
  return {
    id: note.id,
    // Rows written before the title column existed fall back to deriving it.
    title: note.title || deriveTitle(note.html),
    html: note.html,
    sketch: note.sketch,
    saved: note.saved,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}
