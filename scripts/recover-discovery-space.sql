-- Recovery for "project is exhausting multiple resources" on the Supabase
-- project backing DiscoveryCompany (~36.5M rows).
--
-- Run these blocks IN ORDER, in the Supabase dashboard SQL editor. Step 1 is
-- read-only: run it first and read the numbers before running anything else.
--
-- Why indexes come before deleting rows:
--   * DROP INDEX frees its disk immediately and takes an instant lock.
--   * DELETE frees NO disk at all — the dead rows stay in the table until a
--     VACUUM FULL rewrites it, which needs ~2x the table size in free space
--     and holds an ACCESS EXCLUSIVE lock for the whole rewrite. On a disk that
--     is already full, VACUUM FULL cannot even start.
-- So: reclaim from indexes first, delete rows only if still needed.


-- ---------------------------------------------------------------------------
-- STEP 1 — DIAGNOSIS (read-only, safe to run any time)
-- ---------------------------------------------------------------------------

-- 1a. Where the space actually is: table heap vs. each index.
SELECT
  'TABLE (heap)'                              AS object,
  pg_size_pretty(pg_table_size('"DiscoveryCompany"'))  AS size,
  NULL                                        AS definition
UNION ALL
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)),
  indexdef
FROM pg_indexes
WHERE tablename = 'DiscoveryCompany'
ORDER BY 1;

-- 1b. Which indexes are never used. idx_scan = 0 means no query has touched it
--     since the last stats reset — those are pure cost.
SELECT
  indexrelname                                   AS index_name,
  idx_scan                                       AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid))   AS size
FROM pg_stat_user_indexes
WHERE relname = 'DiscoveryCompany'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- 1c. Dead rows already waiting to be reclaimed (a high number here means a
--     plain VACUUM will recover reusable space with no rewrite).
SELECT n_live_tup AS live_rows, n_dead_tup AS dead_rows, last_autovacuum
FROM pg_stat_user_tables
WHERE relname = 'DiscoveryCompany';

-- 1d. Are there actually duplicates? "id" is UNIQUE, so duplicates can only be
--     the same company re-imported under different ids. Count them before
--     deciding to delete anything.
SELECT count(*) AS duplicate_groups, sum(copies - 1) AS deletable_rows
FROM (
  SELECT count(*) AS copies
  FROM "DiscoveryCompany"
  GROUP BY lower(trim("name")), lower(trim(coalesce("headquarters", '')))
  HAVING count(*) > 1
) g;


-- ---------------------------------------------------------------------------
-- STEP 2 — RECLAIM FROM INDEXES (fast, reversible, no data loss)
-- ---------------------------------------------------------------------------
-- The two GIN trigram indexes added by 20260909120000 are the most expensive
-- objects on this table: GIN over 36.5M text rows is typically larger than the
-- column it indexes. Drop them first and re-check 1a.
--
-- Dropping them makes keyword ILIKE search fall back to a sequential scan
-- (slow) — it does not break it. Rebuild later with CONCURRENTLY (see STEP 4)
-- once the instance has headroom.

DROP INDEX CONCURRENTLY IF EXISTS "idx_discovery_name_trgm";
DROP INDEX CONCURRENTLY IF EXISTS "idx_discovery_tags_trgm";

-- Redundant prefixes: a composite index already serves queries on its leading
-- column, so these three single-column indexes duplicate work the composites
-- do. Drop only the ones STEP 1b reported as unused.
--   idx_discovery_category  is the leading column of idx_discovery_filters
--                           and idx_discovery_cat_region_cursor
--   idx_discovery_employee  is covered by idx_discovery_filters
--   idx_discovery_region    is covered by idx_discovery_cat_region_cursor
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_discovery_category";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_discovery_employee";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_discovery_region";

-- Reclaim the freed pages without rewriting the table.
VACUUM (ANALYZE) "DiscoveryCompany";


-- ---------------------------------------------------------------------------
-- STEP 3 — DEDUPE (only if STEP 1d reported a meaningful deletable_rows)
-- ---------------------------------------------------------------------------
-- Deletes in batches so the instance is never pinned by one huge transaction,
-- and so it can be stopped at any point. Keeps the lowest rowCursor of each
-- duplicate group (the first import) and drops later copies.
--
-- Run this block repeatedly until it reports 0 rows deleted.

WITH dupes AS (
  SELECT "rowCursor"
  FROM (
    SELECT
      "rowCursor",
      row_number() OVER (
        PARTITION BY lower(trim("name")), lower(trim(coalesce("headquarters", '')))
        ORDER BY "rowCursor"
      ) AS copy_number
    FROM "DiscoveryCompany"
  ) ranked
  WHERE copy_number > 1
  LIMIT 50000
)
DELETE FROM "DiscoveryCompany" d
USING dupes
WHERE d."rowCursor" = dupes."rowCursor";

-- After the last batch, let autovacuum reuse the space:
VACUUM (ANALYZE) "DiscoveryCompany";

-- Only if disk must be returned to the filesystem AND free space is greater
-- than the current table size. This rewrites the whole table and locks it out
-- for the duration — do not run it during a resource crisis.
-- VACUUM FULL "DiscoveryCompany";


-- ---------------------------------------------------------------------------
-- STEP 4 — REBUILD keyword search later, off the critical path
-- ---------------------------------------------------------------------------
-- CONCURRENTLY keeps the table readable while the index builds. It is slower
-- and can fail leaving an INVALID index — if it does, DROP it and retry.
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_discovery_name_trgm"
--   ON "DiscoveryCompany" USING gin ("name" gin_trgm_ops);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_discovery_tags_trgm"
--   ON "DiscoveryCompany" USING gin ("tags" gin_trgm_ops);
