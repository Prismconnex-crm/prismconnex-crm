-- One note per event becomes many.
--
-- eventSlug was the primary key, so the table could physically hold only one
-- note per event. This re-keys on a generated id and keeps eventSlug as an
-- indexed foreign-ish column.
--
-- Existing rows are preserved and marked saved: they were written through the
-- old editor's Save button, so treating them as uncommitted drafts would hide
-- work people had already kept.

ALTER TABLE "EventNote" ADD COLUMN "id" TEXT;
UPDATE "EventNote" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;
ALTER TABLE "EventNote" ALTER COLUMN "id" SET NOT NULL;

ALTER TABLE "EventNote" DROP CONSTRAINT "EventNote_pkey";
ALTER TABLE "EventNote" ADD CONSTRAINT "EventNote_pkey" PRIMARY KEY ("id");

ALTER TABLE "EventNote" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "EventNote" ADD COLUMN "saved" BOOLEAN NOT NULL DEFAULT false;
UPDATE "EventNote" SET "saved" = true;

CREATE INDEX "EventNote_eventSlug_updatedAt_idx" ON "EventNote"("eventSlug", "updatedAt");
