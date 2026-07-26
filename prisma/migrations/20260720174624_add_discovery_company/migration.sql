-- CreateTable
CREATE TABLE "DiscoveryCompany" (
    "rowCursor" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "domain" TEXT,
    "website" TEXT,
    "founded" TEXT,
    "employeeRange" TEXT,
    "headquarters" TEXT,
    "region" TEXT,
    "revenueRange" TEXT,
    "engagementScore" INTEGER DEFAULT 0,
    "trustSignals" TEXT,
    "tags" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "highlights" TEXT,
    "insights" TEXT,

    CONSTRAINT "DiscoveryCompany_pkey" PRIMARY KEY ("rowCursor")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryCompany_id_key" ON "DiscoveryCompany"("id");

-- CreateIndex
CREATE INDEX "idx_discovery_category" ON "DiscoveryCompany"("category");

-- CreateIndex
CREATE INDEX "idx_discovery_employee" ON "DiscoveryCompany"("employeeRange");

-- CreateIndex
CREATE INDEX "idx_discovery_region" ON "DiscoveryCompany"("region");

-- CreateIndex
CREATE INDEX "idx_discovery_filters" ON "DiscoveryCompany"("category", "employeeRange", "region");

-- CreateIndex
CREATE INDEX "idx_discovery_headquarters" ON "DiscoveryCompany"("headquarters");

-- CreateIndex
-- Case-insensitive prefix search (Postgres equivalent of the SQLite
-- COLLATE NOCASE name-prefix trick app/api/companies/route.ts relies on).
-- text_pattern_ops keeps `LIKE 'prefix%'` index-scannable under any locale.
CREATE INDEX "idx_discovery_name_lower_pattern" ON "DiscoveryCompany" (lower("name") text_pattern_ops);
