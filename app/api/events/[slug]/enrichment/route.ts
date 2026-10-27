import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { findShowEvents } from "@/lib/find-shows/catalog";
import {
  ENRICHMENT_TTL_DAYS,
  EMPTY_ENRICHMENT,
  fetchEnrichment,
  isEmpty,
  type EventEnrichmentFields,
} from "@/lib/events/enrichment";

export const dynamic = "force-dynamic";

/**
 * Venue and organizer detail for one event.
 *
 * GET  — cached row if it is fresh, otherwise fetch once and store.
 * POST — force a re-fetch, for the UI's Refresh control.
 *
 * Only ever touches the one event being viewed. The catalog holds 11,635
 * events and nothing here walks them in bulk.
 *
 * A failed fetch is still written, with `lastError` and a current `fetchedAt`,
 * so a dead site is retried once a week rather than on every page view.
 */

const TTL_MS = ENRICHMENT_TTL_DAYS * 24 * 60 * 60 * 1000;

type Row = EventEnrichmentFields & {
  eventSlug: string;
  fetchedAt: Date;
  lastError: string | null;
};

function serialise(row: Row | null, stale: boolean) {
  if (!row) return { enrichment: null, fetchedAt: null, stale: true, error: null };
  const { eventSlug: _slug, fetchedAt, lastError, ...fields } = row;
  return {
    enrichment: fields,
    fetchedAt: fetchedAt.toISOString(),
    stale,
    error: lastError,
  };
}

async function enrich(slug: string) {
  const event = findShowEvents.find((candidate) => candidate.slug === slug);
  if (!event) return null;

  // The event's own site first; the source directory page is the fallback when
  // no website was published.
  const target = event.website || event.seedAsset.eventseyeUrl || null;
  if (!target) {
    const row = await prisma.eventEnrichment.upsert({
      where: { eventSlug: slug },
      create: { eventSlug: slug, ...EMPTY_ENRICHMENT, lastError: "no source url" },
      update: { ...EMPTY_ENRICHMENT, fetchedAt: new Date(), lastError: "no source url" },
    });
    return row as unknown as Row;
  }

  const { fields, error } = await fetchEnrichment(target);
  const lastError = error ?? (isEmpty(fields) ? "no structured data" : null);

  const row = await prisma.eventEnrichment.upsert({
    where: { eventSlug: slug },
    create: { eventSlug: slug, ...fields, lastError },
    update: { ...fields, fetchedAt: new Date(), lastError },
  });
  return row as unknown as Row;
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const slug = params.slug;
    const cached = (await prisma.eventEnrichment.findUnique({
      where: { eventSlug: slug },
    })) as unknown as Row | null;

    if (cached && Date.now() - cached.fetchedAt.getTime() < TTL_MS) {
      return NextResponse.json(serialise(cached, false));
    }

    const fresh = await enrich(slug);
    if (!fresh) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    return NextResponse.json(serialise(fresh, false));
  } catch (error) {
    console.error("Failed to enrich event:", error);
    return NextResponse.json({ error: "Failed to enrich event" }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const fresh = await enrich(params.slug);
    if (!fresh) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    return NextResponse.json(serialise(fresh, false));
  } catch (error) {
    console.error("Failed to refresh event enrichment:", error);
    return NextResponse.json({ error: "Failed to refresh enrichment" }, { status: 500 });
  }
}
