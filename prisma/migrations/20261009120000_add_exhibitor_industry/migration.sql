-- Sector the exhibitor actually works in, classified from the company's own
-- website copy. Kept on EventExhibitor rather than DiscoveryCompany so the
-- import bucket ("trade show events") stays intact for the Category filter.
ALTER TABLE "EventExhibitor"
  ADD COLUMN "industry" TEXT,
  ADD COLUMN "industryEvidence" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "industrySource" TEXT,
  ADD COLUMN "industryCheckedAt" TIMESTAMP(3);
