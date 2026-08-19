-- Exhibitors imported from an event's public exhibitor directory.
-- Personal-contact columns are nullable by design: exhibitor directories rarely
-- publish named contacts, so they stay empty unless a source provides them.

-- CreateTable
CREATE TABLE "EventExhibitor" (
    "id" TEXT NOT NULL,
    "eventSlug" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "sourceDetailUrl" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "standNumber" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "companyLinkedInUrl" TEXT,
    "description" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "firstName" TEXT,
    "lastName" TEXT,
    "designation" TEXT,
    "email" TEXT,
    "personLinkedInUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'import',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventExhibitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventExhibitor_eventSlug_sourceDetailUrl_key" ON "EventExhibitor"("eventSlug", "sourceDetailUrl");

-- CreateIndex
CREATE INDEX "EventExhibitor_eventSlug_idx" ON "EventExhibitor"("eventSlug");

-- CreateIndex
CREATE INDEX "EventExhibitor_eventSlug_companyName_idx" ON "EventExhibitor"("eventSlug", "companyName");
