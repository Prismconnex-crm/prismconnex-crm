-- People imported from an external provider (Prospeo first) per exhibitor.
-- Additive only: a new table, nothing existing is altered.
CREATE TABLE "ExhibitorContact" (
    "id" TEXT NOT NULL,
    "exhibitorId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "linkedinKey" TEXT,
    "fullName" TEXT NOT NULL,
    "personLinkedInUrl" TEXT,
    "companyName" TEXT,
    "companyLinkedInUrl" TEXT,
    "jobTitle" TEXT,
    "email" TEXT,
    "emailStatus" TEXT,
    "mobile" TEXT,
    "mobileStatus" TEXT,
    "country" TEXT,
    "city" TEXT,
    "seniority" TEXT,
    "industry" TEXT,
    "companySize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExhibitorContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExhibitorContact_exhibitorId_source_externalId_key" ON "ExhibitorContact"("exhibitorId", "source", "externalId");
CREATE INDEX "ExhibitorContact_exhibitorId_idx" ON "ExhibitorContact"("exhibitorId");
CREATE INDEX "ExhibitorContact_exhibitorId_linkedinKey_idx" ON "ExhibitorContact"("exhibitorId", "linkedinKey");
