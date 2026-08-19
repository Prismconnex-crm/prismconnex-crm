-- Adds a canonical name key so enrichment sources (e.g. the BETT 2027 detail
-- sheet) can be matched onto directory listings, plus the event's root directory
-- URL used as the link fallback when an exhibitor has no official website.
--
-- nameKey is intentionally NOT unique: a directory can list the same company
-- twice on different stands (Innovation First Trading SARL, NN82 and NN84).

ALTER TABLE "EventExhibitor" ADD COLUMN IF NOT EXISTS "nameKey" TEXT;
ALTER TABLE "EventExhibitor" ADD COLUMN IF NOT EXISTS "sourceDirectoryUrl" TEXT;

CREATE INDEX IF NOT EXISTS "EventExhibitor_eventSlug_nameKey_idx"
  ON "EventExhibitor"("eventSlug", "nameKey");
