import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sanitiseHtml, sanitiseSketch, sanitiseTitle } from "@/lib/events/note-sanitise";
import { deriveTitle, toNoteDto } from "@/lib/events/notes";

export const dynamic = "force-dynamic";

/**
 * Notes for one event.
 *
 *   GET  — every note for the event, newest first.
 *   POST — create a note (an empty one for "+ New", or one carrying content).
 *
 * A single note is updated or removed through ./[noteId]. Content is sanitised
 * in lib/events/note-sanitise.ts, on write, because it is later rendered as
 * HTML.
 */

/** Enough notes per event that the list is never truncated in practice. */
const MAX_NOTES = 200;

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const notes = await prisma.eventNote.findMany({
      where: { eventSlug: params.slug },
      orderBy: { updatedAt: "desc" },
      take: MAX_NOTES,
    });
    return NextResponse.json({ notes: notes.map(toNoteDto) });
  } catch (error) {
    console.error("Failed to load event notes:", error);
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    // "+ New" sends no body at all, so an unparseable one means an empty note
    // rather than a failure.
    const body = (await request.json().catch(() => ({}))) as {
      html?: unknown;
      sketch?: unknown;
      title?: unknown;
      saved?: unknown;
    };

    const html = sanitiseHtml(body.html);
    const title = sanitiseTitle(body.title) || deriveTitle(html);

    const note = await prisma.eventNote.create({
      data: {
        eventSlug: params.slug,
        html,
        title,
        sketch: sanitiseSketch(body.sketch),
        saved: body.saved === true,
      },
    });

    return NextResponse.json(toNoteDto(note), { status: 201 });
  } catch (error) {
    console.error("Failed to create event note:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
