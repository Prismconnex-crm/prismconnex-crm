-- Indexes for the Companies "Find anything" panel.
--
-- The panel turns a question into City / Keyword / "top N" filters, none of
-- which any existing index served: each one was a sequential scan over the
-- whole DiscoveryCompany table (measured at 0.9-2.6 s per query).
--
-- Additive only: no column, row or existing index is touched, and every
-- statement is guarded so a re-run is a no-op.

-- Trigram matching for keyword search. Without it `ILIKE '%analytics%'` can
-- use no index at all.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- City filter. `headquarters` is stored as "City, [State,] Country", so the
-- city is the first comma-segment. The expression MUST match the one in
-- lib/companies/search.ts (CITY_EXPR) exactly or the planner ignores this.
-- Trailing category/rowCursor let "companies in Bengaluru", "hospitality in
-- Bengaluru" and their ordering all be served by the one index.
CREATE INDEX IF NOT EXISTS "idx_discovery_city_cat_cursor"
  ON "DiscoveryCompany" ((trim(split_part("headquarters", ',', 1))), "category", "rowCursor" DESC);

-- "top N companies in X" orders by engagementScore instead of rowCursor.
-- NULLS LAST is not decoration: DESC defaults to NULLS FIRST, and an index
-- whose null ordering differs from the query's cannot supply the ordering at
-- all -- the planner falls back to sorting every matching row.
CREATE INDEX IF NOT EXISTS "idx_discovery_cat_score"
  ON "DiscoveryCompany" ("category", "engagementScore" DESC NULLS LAST, "rowCursor" DESC);

-- Same ordering with no category ("top 100 companies"), which the composite
-- above cannot serve because category leads it.
CREATE INDEX IF NOT EXISTS "idx_discovery_score"
  ON "DiscoveryCompany" ("engagementScore" DESC NULLS LAST, "rowCursor" DESC);

-- Keyword search matches name and tags (deliberately not `description`, which
-- is long free text — see the comment in lib/companies/search.ts).
CREATE INDEX IF NOT EXISTS "idx_discovery_name_trgm"
  ON "DiscoveryCompany" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_discovery_tags_trgm"
  ON "DiscoveryCompany" USING gin ("tags" gin_trgm_ops);
