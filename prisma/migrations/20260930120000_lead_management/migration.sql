-- Lead management: contact fields, owner assignment, follow-up date and a
-- notes timeline on Lead.
--
-- Additive only: new nullable columns, one new table, new indexes and foreign
-- keys. No existing column, row or index is changed, and every statement is
-- guarded so a re-run is a no-op.
--
-- Status values (NEW | CONTACTED | QUALIFIED | NURTURING | CONVERTED | LOST)
-- are validated in models/lead.ts, deliberately NOT by a CHECK constraint, so
-- an older build sharing this database cannot be broken by a new value.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LeadNote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_workspaceId_status_idx" ON "Lead"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_workspaceId_ownerId_idx" ON "Lead"("workspaceId", "ownerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_workspaceId_createdAt_idx" ON "Lead"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeadNote_leadId_createdAt_idx" ON "LeadNote"("leadId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_ownerId_fkey') THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadNote_workspaceId_fkey') THEN
    ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadNote_leadId_fkey') THEN
    ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadNote_authorId_fkey') THEN
    ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Row Level Security: same deny-by-default stance as every other public table
-- (see 20260929120000_lock_down_public_tables). The app reaches LeadNote only
-- through Prisma as `postgres` (table owner, BYPASSRLS); enabling RLS with no
-- policy and revoking the Supabase API roles keeps it off /rest/v1. That
-- migration's default-privilege change already stops the auto-grant; the
-- revoke is repeated here so this file is safe on its own.
ALTER TABLE "LeadNote" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "LeadNote" FROM anon, authenticated;
  END IF;
END $$;
