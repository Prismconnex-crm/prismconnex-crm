-- =====================================================================
-- 006_profile_numeric_id.sql
--
-- Gives public.profiles a sequential numeric primary key (1, 2, 3, ...)
-- WITHOUT touching auth.users and without breaking authentication.
--
-- Run in: Supabase Dashboard -> SQL Editor (or via psql on DIRECT_URL).
-- Idempotent: safe to re-run. Every step is guarded, so a second run is a
-- no-op rather than an error.
--
-- ---------------------------------------------------------------------
-- WHY THE COLUMN COULD NOT SIMPLY BE RETYPED
--
-- Before this file, profiles.id was BOTH the primary key AND the foreign key
-- to auth.users(id) -- the standard Supabase profile pattern. It therefore
-- had to stay a uuid, because:
--
--   * auth.uid() returns uuid, and all three RLS policies compared it to id;
--   * handle_new_auth_user() inserts NEW.id from auth.users straight into it;
--   * sync_auth_user_email() updates the row WHERE id = NEW.id;
--   * every /api/profile route looks the row up by the session's auth uuid.
--
-- ALTER COLUMN id TYPE bigint would have severed the FK to auth.users and
-- broken all four. So the uuid is not removed -- it MOVES to its own column,
-- `user_id`, keeping the FK and its ON DELETE CASCADE, and a brand new
-- identity column takes over the `id` name and the primary key.
--
--     BEFORE                           AFTER
--     id      uuid PK -> auth.users     id      bigint PK IDENTITY (1,2,3...)
--                                       user_id uuid UNIQUE -> auth.users
--
-- auth.users itself is NOT modified by this file in any way.
--
-- ---------------------------------------------------------------------
-- NOTE ON PRISMA: the profiles.user_id -> auth.users.id foreign key still
-- crosses into the `auth` schema, which Prisma 5 cannot model without the
-- multiSchema preview feature -- exactly as before, just on a renamed column.
-- The Prisma-owned half of this change is mirrored in:
--     prisma/migrations/20260909120000_profile_numeric_id/migration.sql
-- After running this file, mark that migration applied:
--     npx prisma migrate resolve --applied 20260909120000_profile_numeric_id
-- =====================================================================

begin;


-- ---------------------------------------------------------------------
-- 0. BACKUP
--
-- A full copy of the table as it stands before the restructure. This script
-- never drops it -- remove it by hand once the migration is confirmed good:
--     drop table public.profiles_backup_20260909;
--
-- `if not exists` matters on a re-run: it must NOT overwrite the original
-- snapshot with the already-migrated shape.
-- ---------------------------------------------------------------------
create table if not exists public.profiles_backup_20260909 as
  select * from public.profiles;

comment on table public.profiles_backup_20260909 is
  'Pre-migration snapshot of public.profiles taken by 006_profile_numeric_id.sql. Safe to drop once verified.';


-- ---------------------------------------------------------------------
-- 1. DROP THE RLS POLICIES THAT REFERENCE `id`
--
-- They are recreated against `user_id` in section 5. Dropping them first is
-- what keeps the rename honest: Postgres rewrites policy expressions to
-- follow a renamed column, so leaving them in place would silently produce
-- policies comparing auth.uid() to a column that is about to become numeric.
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;


-- ---------------------------------------------------------------------
-- 2. id -> user_id
--
-- A column rename carries the foreign key with it: profiles_id_fkey keeps
-- pointing at auth.users(id) with ON DELETE CASCADE intact. The constraint is
-- renamed too, purely so its name still describes what it constrains.
--
-- Guarded on the column still being uuid, so a re-run skips this block rather
-- than trying to rename the new bigint id.
-- ---------------------------------------------------------------------
do $do$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'id' and data_type = 'uuid'
  ) then
    alter table public.profiles rename column id to user_id;
  end if;

  if exists (select 1 from pg_constraint where conname = 'profiles_id_fkey') then
    alter table public.profiles rename constraint profiles_id_fkey to profiles_user_id_fkey;
  end if;
end
$do$;


-- ---------------------------------------------------------------------
-- 3. DEMOTE THE OLD PRIMARY KEY TO A UNIQUE CONSTRAINT
--
-- Dropping profiles_pkey is safe here and only here: a query of pg_constraint
-- confirmed NO table anywhere in the database has a foreign key referencing
-- public.profiles. Nothing depends on this index.
--
-- The UNIQUE that replaces it is not cosmetic. It is what still guarantees
-- one profile per auth user, and it is the conflict target that
-- handle_new_auth_user needs for its ON CONFLICT (user_id) in section 6.
-- ---------------------------------------------------------------------
do $do$
begin
  -- Only drop the PK while it is still the one on user_id (the old shape).
  if exists (
    select 1
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.conname = 'profiles_pkey'
       and c.conrelid = 'public.profiles'::regclass
       and a.attname = 'user_id'
  ) then
    alter table public.profiles drop constraint profiles_pkey;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_user_id_key') then
    alter table public.profiles add constraint profiles_user_id_key unique (user_id);
  end if;
end
$do$;


-- ---------------------------------------------------------------------
-- 4. THE NEW NUMERIC id
--
-- Added as a plain bigint first and backfilled with row_number() ORDER BY
-- created_at, rather than declared IDENTITY straight away. That ordering is
-- the whole point: attaching an identity to a populated table numbers the
-- existing rows in PHYSICAL order, which after any past UPDATE is arbitrary.
-- Backfilling explicitly means profile #1 is genuinely the oldest profile.
--
-- user_id breaks the tie, so the numbering is deterministic even if two rows
-- share a created_at.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists id bigint;

update public.profiles p
   set id = s.seq
  from (
    select user_id, row_number() over (order by created_at, user_id) as seq
      from public.profiles
  ) s
 where p.user_id = s.user_id
   and p.id is null;

alter table public.profiles alter column id set not null;

do $do$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'profiles_pkey' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_pkey primary key (id);
  end if;

  -- attidentity: '' = not an identity column, 'd' = GENERATED BY DEFAULT.
  if exists (
    select 1 from pg_attribute
     where attrelid = 'public.profiles'::regclass
       and attname = 'id' and attidentity = ''
  ) then
    alter table public.profiles alter column id add generated by default as identity;
  end if;
end
$do$;

-- Advance the sequence past the backfilled rows.
--
-- CRITICAL. `ADD GENERATED ... AS IDENTITY` creates its sequence starting at
-- 1, which after a backfill of N rows would hand the next signup an id that
-- already exists. That unique violation would be raised INSIDE the signup
-- transaction by handle_new_auth_user(), rolling back the auth.users insert
-- and breaking sign-up entirely -- the exact failure 001's trigger comments
-- warn about. `true` as the third argument means "this value is used", so the
-- next value handed out is max(id) + 1.
--
-- Guarded for the empty-table case, where setval(..., 0, true) is invalid.
do $do$
declare
  max_id bigint;
begin
  select max(id) into max_id from public.profiles;
  if max_id is not null then
    perform setval(pg_get_serial_sequence('public.profiles', 'id'), max_id, true);
  end if;
end
$do$;

comment on column public.profiles.id is
  'Sequential profile number (1, 2, 3, ...). Generated by the database; never supplied by the client.';
comment on column public.profiles.user_id is
  'The Supabase Auth user (auth.users.id). This -- not id -- is what auth.uid() matches.';


-- ---------------------------------------------------------------------
-- 5. RECREATE ROW LEVEL SECURITY AGAINST user_id
--
-- Identical in meaning to the policies in 001, with `id` replaced by
-- `user_id`: the uuid moved column, so the comparison follows it. Comparing
-- auth.uid() to the new numeric id would not even type-check.
--
-- UPDATE still needs BOTH clauses, and for the same reason as in 001: USING
-- picks which rows may be targeted, WITH CHECK constrains what they may
-- become. Without WITH CHECK a user could reassign user_id to someone else's
-- uuid and hijack that profile.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Still no DELETE policy, and still deliberate: profiles go away only via the
-- ON DELETE CASCADE on user_id.

-- Grants are unchanged from 001 and re-asserted here so a fresh environment
-- that runs only this file is not left without them.
grant select, insert, update on public.profiles to authenticated;

-- The identity sequence must be usable by any role permitted to INSERT.
grant usage, select on sequence public.profiles_id_seq to authenticated;


-- ---------------------------------------------------------------------
-- 6. THE auth.users TRIGGERS
--
-- Both functions are replaced, not dropped: `create or replace` swaps the
-- body while the triggers on auth.users keep pointing at them, so there is no
-- window in which a signup lands with no profile trigger attached.
--
-- The insert no longer lists `id` at all. Omitting it is what makes the
-- identity default fire, which is the requirement that the application must
-- never generate the profile id itself.
--
-- Everything else is unchanged from 001, including the reasons: SECURITY
-- DEFINER so an unauthenticated signup can write the row, `set search_path`
-- to harden that, and total coalescing plus ON CONFLICT DO NOTHING because
-- any exception raised here would roll back the signup.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (user_id, first_name, middle_name, last_name, email, phone)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data ->> 'middle_name'), ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), ''),
    coalesce(new.email, ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), new.phone)
  )
  on conflict (user_id) do nothing;

  return new;
end;
$fn$;

create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = new.email where user_id = new.id;
  end if;

  return new;
end;
$fn$;

-- Re-assert the triggers themselves, so this file also bootstraps a fresh
-- environment. Identical to 001 -- only the function bodies above changed.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_auth_user_email();

commit;


-- =====================================================================
-- 7. VERIFY
--
-- All of these are run for you by:
--     node scripts/verify-profile-numeric-id.mjs
-- =====================================================================
-- -- id is a bigint identity, user_id is a uuid:
-- select column_name, data_type, is_identity, identity_generation
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'profiles'
--    and column_name in ('id', 'user_id');
--
-- -- the FK to auth.users survived the rename:
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.profiles'::regclass and contype = 'f';
--
-- -- the sequence is past the backfill:
-- select last_value, is_called from public.profiles_id_seq;
--
-- -- policies now compare against user_id:
-- select policyname, cmd, qual, with_check from pg_policies
--  where schemaname = 'public' and tablename = 'profiles';
