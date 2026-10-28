import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sanitiseHtml, sanitiseSketch, sanitiseTitle } from "@/lib/events/note-sanitise";
import { deriveTitle, toNoteDto } from "@/lib/events/notes";

export const dynamic = "force-dynamic";

/**
 * One note.
 *
 *   PUT    — update content, title and the saved flag.
 *   DELETE — remove it.
 *
 * Both scope the write by eventSlug as well as id, so a note id guessed from
 * another event cannot be edited or deleted through this event's URL.
 */

export async function PUT(
  request: Request,
  { params }: { params: { slug: string; noteId: string } }
) {
  try {
    const body = (await request.json()) as {
      html?: unknown;
      sketch?: unknown;
      title?: unknown;
      saved?: unknown;
    };

    const html = sanitiseHtml(body.html);
    const data: {
      html: string;
      title: string;
      sketch: string | null;
      saved?: boolean;
    } = {
      html,
      title: sanitiseTitle(body.title) || deriveTitle(html),
      sketch: sanitiseSketch(body.sketch),
    };
    // Autosave omits `saved` entirely so it cannot demote a note the user has
    // already saved; only an explicit true/false moves it.
    if (typeof body.saved === "boolean") data.saved = body.saved;

    const result = await prisma.eventNote.updateMany({
      where: { id: params.noteId, eventSlug: params.slug },
      data,
    });
    if (!result.count) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const note = await prisma.eventNote.findUnique({ where: { id: params.noteId } });
    return NextResponse.json(note ? toNoteDto(note) : { error: "Note not found" });
  } catch (error) {
    console.error("Failed to update event note:", error);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { slug: string; noteId: string } }
) {
  try {
    const result = await prisma.eventNote.deleteMany({
      where: { id: params.noteId, eventSlug: params.slug },
    });
    if (!result.count) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: params.noteId });
  } catch (error) {
    console.error("Failed to delete event note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
