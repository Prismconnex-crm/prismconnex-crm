-- =====================================================================
-- 005_profile_bio_and_links.sql
--
-- Adds the last four Profile page fields to public.profiles: the employer,
-- a free-text bio, and the two links the Professional Information card
-- renders as anchors.
--
-- Run in: Supabase Dashboard -> SQL Editor (or via psql on DIRECT_URL).
-- Idempotent: every statement is IF NOT EXISTS, so re-running is safe.
--
-- The identical DDL is committed as a Prisma migration at
--   prisma/migrations/20260822120000_add_profile_bio_and_links/
-- so `prisma migrate deploy` and this file cannot drift. If you run THIS file
-- first, mark the Prisma one as already applied instead of running it twice:
--   npx prisma migrate resolve --applied 20260822120000_add_profile_bio_and_links
--
-- WHY ALL FOUR ARE NULLABLE
-- Same rule as 002, and it is not a style preference: the
-- on_auth_user_created trigger inserts only the seven original columns, and it
-- runs INSIDE the signup transaction. A NOT NULL column without a default
-- would make that insert raise and ABORT EVERY SIGNUP.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. COLUMNS
-- ---------------------------------------------------------------------

-- The user's employer, as free text rather than a foreign key to the
-- workspace. A profile's company is not always the workspace that owns the
-- CRM seat -- contractors and agency users are the ordinary case, not the
-- edge one -- and the workspace name is already shown, read-only, by the
-- Account Information card. A FK here would make those two disagree.
alter table public.profiles add column if not exists company text;

-- Free-form "about me". text, not varchar(n): Postgres stores them
-- identically, and the 1000-character cap belongs in one place
-- (UpdateProfessionalInfoSchema) where it can return a readable message,
-- rather than as a constraint violation the API would surface as a 500.
alter table public.profiles add column if not exists bio text;

-- Both stored as absolute URLs including the scheme. The schema in
-- models/profile.ts prefixes https:// before the value ever reaches here, so
-- the column cannot hold a bare "example.com" -- which an <a href> would
-- resolve as a RELATIVE path, silently linking to /app/profile/example.com.
-- The same schema rejects any scheme other than http/https, which is what
-- stops a javascript: URL becoming stored XSS in the anchor the card renders.
alter table public.profiles add column if not exists website text;
alter table public.profiles add column if not exists linkedin_url text;


-- ---------------------------------------------------------------------
-- 2. INDEXES -- DELIBERATELY NONE
--
-- All four are display-only: nothing in this codebase filters, sorts, joins
-- or aggregates on them, and the Profile page reads exactly one row, by
-- primary key. An index would add write cost to every profile save and serve
-- no read. If a "find people by company" feature ever lands, that is the
-- commit that should add the index, together with the query that justifies it.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY -- NOTHING TO ADD
--
-- 001 enabled RLS and created the own-row policies; 002 explained why adding
-- columns needs no policy change. The same holds here: a policy filters ROWS,
-- so profiles_select_own / profiles_insert_own / profiles_update_own
-- (all `auth.uid() = id`) already cover every column added above. There is
-- still no DELETE policy, by design.
-- ---------------------------------------------------------------------


-- =====================================================================
-- 4. VERIFY
-- =====================================================================
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'profiles'
--    and column_name in ('company', 'bio', 'website', 'linkedin_url');
