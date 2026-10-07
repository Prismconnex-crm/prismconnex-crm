-- Per-event venue/organizer enrichment cache, and per-event notes.
--
-- Both are keyed by FindShowEvent.slug: the trade-show catalog is a JSON seed
-- with no numeric id, and the slug is what every event URL already carries.
--
-- Enrichment is written only when someone opens an event, never in bulk — the
-- catalog holds 11,635 events and mass-fetching their websites would be both
-- slow and rude. `fetchedAt` drives a 7-day re-fetch window.

CREATE TABLE IF NOT EXISTS "EventEnrichment" (
    "eventSlug"          TEXT NOT NULL,
    "venueName"          TEXT,
    "venueAddress"       TEXT,
    "venueCity"          TEXT,
    "venueCountry"       TEXT,
    "venuePostcode"      TEXT,
    "venueWebsite"       TEXT,
    "organizerName"      TEXT,
    "organizerLegalName" TEXT,
    "organizerWebsite"   TEXT,
    "organizerAddress"   TEXT,
    "organizerEmail"     TEXT,
    "organizerPhone"     TEXT,
    "sourceUrl"          TEXT,
    "fetchedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError"          TEXT,

    CONSTRAINT "EventEnrichment_pkey" PRIMARY KEY ("eventSlug")
);

CREATE INDEX IF NOT EXISTS "EventEnrichment_fetchedAt_idx" ON "EventEnrichment"("fetchedAt");

CREATE TABLE IF NOT EXISTS "EventNote" (
    "eventSlug" TEXT NOT NULL,
    "html"      TEXT NOT NULL DEFAULT '',
    "sketch"    TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventNote_pkey" PRIMARY KEY ("eventSlug")
);
