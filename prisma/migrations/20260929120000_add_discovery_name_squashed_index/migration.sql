-- Space-insensitive company name search.
--
-- The Companies search is a prefix range over lower(name). That finds
-- "Canva Education" from "canva edu", but never from "canvaeducation" — the
-- stored name has a space the query does not.
--
-- Indexing the name with its spaces removed gives the query planner a second
-- prefix range to probe, so a query typed without spaces still lands on an
-- index scan instead of a sequential scan over the table.
--
-- text_pattern_ops for the same reason as idx_discovery_name_lower_pattern:
-- it is what makes the ~>=~ / ~<~ pattern operators index-scannable under any
-- locale. The expression MUST match the one built in lib/companies/search.ts
-- (SQUASHED_NAME_EXPR) character for character, or the planner ignores it.
--
-- Additive: no column, row or existing index is touched, and the statement is
-- guarded so a re-run is a no-op.
CREATE INDEX IF NOT EXISTS "idx_discovery_name_squashed_pattern"
  ON "DiscoveryCompany" ((replace(lower("name"), ' ', '')) text_pattern_ops);
