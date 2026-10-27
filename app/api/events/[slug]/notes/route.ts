import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Per-event notes.
 *
 *   GET — the stored note, or an empty one when none exists yet.
 *   PUT — upsert { html, sketch }.
 *
 * The HTML comes from a contenteditable the user types into, so it is
 * sanitised here rather than trusted: this value is written back into the DOM
 * with dangerouslySetInnerHTML, and a pasted `<script>` or an `onerror=`
 * attribute would otherwise execute for anyone who later opens the event.
 * Sanitising on write means the stored value is already safe for every reader.
 */

const MAX_HTML = 100_000;
const MAX_SKETCH = 2_000_000; // a data-URL PNG from a small canvas

/** Tags the editor's toolbar can produce, and nothing else. */
const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "s", "p", "br", "div", "span",
  "ul", "ol", "li", "a", "h1", "h2", "h3", "blockquote", "code", "pre",
]);

function sanitiseHtml(input: string): string {
  let html = input.slice(0, MAX_HTML);

  // Whole elements that can execute or load, content included.
  html = html.replace(
    /<(script|style|iframe|object|embed|form|link|meta|svg|math)\b[\s\S]*?<\/\1\s*>/gi,
    ""
  );
  html = html.replace(/<(script|style|iframe|object|embed|form|link|meta|svg|math)\b[^>]*>/gi, "");

  html = html.replace(/<(\/?)([a-zA-Z0-9-]+)([^>]*)>/g, (match, closing, tag, attrs) => {
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

function sanitiseSketch(input: unknown): string | null {
  if (typeof input !== "string" || !input) return null;
  if (input.length > MAX_SKETCH) return null;
  // Only an inline PNG — never a remote URL that would phone home on render.
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(input) ? input : null;
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const note = await prisma.eventNote.findUnique({ where: { eventSlug: params.slug } });
    return NextResponse.json({
      html: note?.html ?? "",
      sketch: note?.sketch ?? null,
      updatedAt: note?.updatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Failed to load event note:", error);
    return NextResponse.json({ error: "Failed to load note" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { slug: string } }) {
  try {
    const body = (await request.json()) as { html?: unknown; sketch?: unknown };
    const html = sanitiseHtml(typeof body.html === "string" ? body.html : "");
    const sketch = sanitiseSketch(body.sketch);

    const note = await prisma.eventNote.upsert({
      where: { eventSlug: params.slug },
      create: { eventSlug: params.slug, html, sketch },
      update: { html, sketch },
    });

    return NextResponse.json({
      html: note.html,
      sketch: note.sketch,
      updatedAt: note.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to save event note:", error);
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
}
