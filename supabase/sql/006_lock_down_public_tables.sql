-- =====================================================================
-- 006_lock_down_public_tables.sql
--
-- Closes the Supabase Data API (PostgREST, /rest/v1) over every CRM table.
--
-- Run in: Supabase Dashboard -> SQL Editor (or via psql on DIRECT_URL).
-- Idempotent: safe to re-run. Changes permissions only -- no row, column or
-- index is touched.
--
-- The identical DDL is committed as a Prisma migration at
--   prisma/migrations/20260929120000_lock_down_public_tables/
-- If you run THIS file first, mark that one as applied instead of running it
-- twice:
--   npx prisma migrate resolve --applied 20260929120000_lock_down_public_tables
--
-- WHY
-- Supabase exposes every table in `public` over /rest/v1 to the `anon` and
-- `authenticated` roles, and its default privileges grant both roles ALL on
-- any table `postgres` creates -- i.e. every table a Prisma migration makes.
-- Before this file, 24 of the 26 tables had RLS off, so anyone holding the
-- anon key could read AND write them directly: every lead, contact, and
-- CompanyContact email/phone, plus insert a Membership row granting
-- themselves ADMIN of any workspace.
--
-- WHY THIS CANNOT BREAK THE APP
-- The app never uses /rest/v1. It reads and writes through Prisma, connected
-- as `postgres`, which owns every table here and has BYPASSRLS (both checked
-- 2026-09-29 for DATABASE_URL and DIRECT_URL). Neither RLS nor the revokes
-- below apply to it. Supabase Auth (GoTrue) and Storage live in their own
-- schemas and are untouched.
--
-- WHAT IT DOES
--   1. Enables RLS on every public table. With no policy, `anon` and
--      `authenticated` see zero rows (deny by default).
--   2. Revokes every table and sequence privilege from `anon`, and from
--      `authenticated` on everything except `profiles`. `profiles` keeps the
--      select/insert/update grant and own-row policies from 001, so it
--      behaves exactly as designed.
--   3. Changes the default privileges so a table created by a future
--      migration is NOT auto-granted to either role.
--
-- If a browser-side Supabase client is ever added, grant it access table by
-- table, each with its own policy -- never by undoing this file.
-- =====================================================================

do $$
declare
  t record;
begin
  -- 1. RLS on, everywhere. Enabling it on `profiles` again is a no-op.
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;

  -- 2 and 3 name the Supabase API roles, which a plain Postgres (e.g. a
  -- Prisma shadow database) does not have.
  if exists (select 1 from pg_roles where rolname = 'anon')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then

    -- 2. Existing grants.
    for t in
      select tablename from pg_tables where schemaname = 'public'
    loop
      execute format('revoke all on table public.%I from anon', t.tablename);
      if t.tablename <> 'profiles' then
        execute format('revoke all on table public.%I from authenticated', t.tablename);
      end if;
    end loop;

    execute 'revoke all on all sequences in schema public from anon, authenticated';

    -- 3. Future tables and sequences created by postgres (every Prisma
    --    migration).
    execute 'alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated';
    execute 'alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated';
  end if;
end $$;


-- =====================================================================
-- VERIFY -- expect rls = true for every row, anon_select = false for every
-- row, and authd_select = true only for profiles.
-- =====================================================================
-- select c.relname, c.relrowsecurity as rls,
--        has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
--        has_table_privilege('authenticated', c.oid, 'SELECT') as authd_select
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relkind = 'r' order by 1;
