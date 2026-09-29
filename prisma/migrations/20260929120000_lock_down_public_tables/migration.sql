-- Identical to supabase/sql/006_lock_down_public_tables.sql -- see that file
-- for the full rationale. Permissions only: no row, column or index changes.
-- Idempotent, and a no-op for the grant steps on a plain Postgres (e.g. the
-- Prisma shadow database) that has no anon/authenticated roles.

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
