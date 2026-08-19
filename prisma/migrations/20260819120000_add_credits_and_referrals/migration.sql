-- =====================================================================
-- Credits + Referrals
--
-- Backs the Profile page's "Credit Usage" and "Refer a New User" cards and
-- the /app/billing page. No payment provider is connected, so these tables
-- are the only source of truth for a workspace's plan and balance.
--
-- Consumption is an append-only ledger (CreditUsageEntry) rather than a
-- counter decremented on WorkspaceCredit: a balance you can only read is
-- impossible to audit or correct, and a period reset here is a date change
-- instead of a destructive write.
--
-- The identical DDL is committed as supabase/sql/004_credits_and_referrals.sql
-- for the Dashboard SQL Editor. If you run that one first, mark this as
-- applied instead of running it twice:
--   npx prisma migrate resolve --applied 20260819120000_add_credits_and_referrals
--
-- Idempotent: every statement is IF NOT EXISTS, so re-running is safe.
-- =====================================================================

CREATE TABLE IF NOT EXISTS "WorkspaceCredit" (
    "workspaceId" TEXT NOT NULL,
    "plan"        TEXT NOT NULL DEFAULT 'STARTER',
    "allowance"   INTEGER NOT NULL DEFAULT 1000,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodEnd"   TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceCredit_pkey" PRIMARY KEY ("workspaceId")
);

CREATE TABLE IF NOT EXISTS "CreditUsageEntry" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId"      TEXT,
    "kind"        TEXT NOT NULL,
    "amount"      INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditUsageEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Referral" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "email"           TEXT NOT NULL,
    "token"           TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt"      TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- The ledger is read as "everything for this workspace in the current period",
-- which is exactly this composite.
CREATE INDEX IF NOT EXISTS "CreditUsageEntry_workspaceId_createdAt_idx"
    ON "CreditUsageEntry" ("workspaceId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Referral_token_key"
    ON "Referral" ("token");

-- One open invitation per address per workspace: re-inviting the same person
-- should update the existing row, not stack duplicates the UI has to dedupe.
CREATE UNIQUE INDEX IF NOT EXISTS "Referral_workspaceId_email_key"
    ON "Referral" ("workspaceId", "email");

CREATE INDEX IF NOT EXISTS "Referral_workspaceId_createdAt_idx"
    ON "Referral" ("workspaceId", "createdAt");

-- Foreign keys. Guarded because IF NOT EXISTS is not available for ADD
-- CONSTRAINT on PostgreSQL.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceCredit_workspaceId_fkey') THEN
        ALTER TABLE "WorkspaceCredit"
            ADD CONSTRAINT "WorkspaceCredit_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditUsageEntry_workspaceId_fkey') THEN
        ALTER TABLE "CreditUsageEntry"
            ADD CONSTRAINT "CreditUsageEntry_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Referral_workspaceId_fkey') THEN
        ALTER TABLE "Referral"
            ADD CONSTRAINT "Referral_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
