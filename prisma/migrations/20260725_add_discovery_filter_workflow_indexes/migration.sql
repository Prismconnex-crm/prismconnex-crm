-- Indexes for the Companies-page progressive filter workflow
-- (Category -> Location/region -> Country -> Employee Headcount), where the
-- list is always ordered by "rowCursor" DESC with a LIMIT for cursor pagination.
--
-- 1) idx_discovery_cat_region_cursor: trailing "rowCursor" DESC makes the
--    Category(+Location) step a pre-sorted index range scan that stops at LIMIT,
--    instead of scanning millions of category rows and sorting them (the recent
--    high-rowCursor rows are region-skewed, so a region filter otherwise plows
--    through the whole tail).
--
-- 2) idx_discovery_cat_region_country_emp: the country lives as the last
--    comma-segment of `headquarters` ("City, Country"). Matching it by the
--    extracted-country expression (instead of a leading-wildcard `LIKE '%, X'`,
--    which can never use an index) lets the Country/Headcount steps hit this
--    index. All keys are low-cardinality, so B-tree deduplication keeps it small.
--
-- Drops three indexes made redundant by the above and by removing the LIKE:
--   idx_discovery_category (category-only handled by a PK backward scan),
--   idx_discovery_filters (category,employeeRange,region - superseded),
--   idx_discovery_headquarters (only served exact headquarters=, now unused).

-- DropIndex
DROP INDEX IF EXISTS "idx_discovery_category";
DROP INDEX IF EXISTS "idx_discovery_filters";
DROP INDEX IF EXISTS "idx_discovery_headquarters";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_discovery_cat_region_cursor" ON "DiscoveryCompany" ("category", "region", "rowCursor" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_discovery_cat_region_country_emp" ON "DiscoveryCompany" ("category", "region", (trim(split_part("headquarters", ',', -1))), "employeeRange");
