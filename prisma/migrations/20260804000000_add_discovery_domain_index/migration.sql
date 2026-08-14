-- Domain lookup for sign-up company auto-detection.
--
-- /api/companies/by-domain resolves an email domain to a company with
-- `lower(domain) = $1`. "DiscoveryCompany" had no index on `domain` at all, so
-- that predicate was a sequential scan over every row — measured at 7.7 s
-- against the live dataset, which is far too slow for a field that fills in
-- while the user is still on the sign-up form.
--
-- Indexed on lower(domain) rather than domain because stored values vary in
-- case and the lookup is case-insensitive by definition; a plain btree on
-- `domain` could not serve the lowered predicate.
--
-- "rowCursor" is the SECOND column, and it is load-bearing. The query breaks
-- ties with `ORDER BY "rowCursor" ASC LIMIT 1` because the dataset contains
-- duplicate domains. With a lower(domain)-only index the planner preferred
-- walking the primary key in rowCursor order and filtering — which returns the
-- first row quickly for a low rowCursor but took 10 s for a high one. Carrying
-- "rowCursor" in the index makes the matching entries already sorted, so the
-- scan stops at the first one.
--
-- CompanyContact is the secondary source, matched on the domain part of
-- `email` and tie-broken on "createdAt". Same shape, same reasoning.
--
-- Plain CREATE INDEX (not CONCURRENTLY): Prisma runs migrations inside a
-- transaction, where CONCURRENTLY is not permitted. These tables are small
-- enough (~383k and ~1 rows) that the brief lock is a few seconds.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_discovery_domain_lower" ON "DiscoveryCompany" (lower("domain"), "rowCursor");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_company_contact_email_domain" ON "CompanyContact" (lower(split_part("email", '@', 2)), "createdAt");
