-- Integrations: per-user OAuth connections (calendar: Google, Microsoft 365,
-- Outlook). Additive only — one new table, its indexes and foreign keys —
-- and every statement is guarded so a re-run is a no-op.
--
-- Tokens are stored AES-256-GCM encrypted by the app; the table never holds a
-- plaintext token or any client secret.

-- CreateTable
CREATE TABLE IF NOT EXISTS "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountEmail" TEXT,
    "scopes" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationConnection_workspaceId_userId_provider_key" ON "IntegrationConnection"("workspaceId", "userId", "provider");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntegrationConnection_workspaceId_category_idx" ON "IntegrationConnection"("workspaceId", "category");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Keep the Supabase Data API closed over this table, as
-- 20260929120000_lock_down_public_tables does for every other one: it holds
-- (encrypted) OAuth tokens and is only ever read through Prisma.
ALTER TABLE "IntegrationConnection" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE "IntegrationConnection" FROM anon, authenticated;
    END IF;
END $$;
