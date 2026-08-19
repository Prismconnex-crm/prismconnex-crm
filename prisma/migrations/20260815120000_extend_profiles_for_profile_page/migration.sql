-- =====================================================================
-- 002_extend_profiles.sql
--
-- Adds the columns the Profile page needs to public.profiles (created by
-- 001_create_profiles.sql). Passwords are STILL never stored here — they stay
-- in auth.users.encrypted_password and are changed only through Supabase Auth.
--
-- Run in: Supabase Dashboard -> SQL Editor (or via psql on DIRECT_URL).
-- Idempotent: every statement is IF NOT EXISTS / OR REPLACE, so re-running is
-- safe.
--
-- The identical DDL is committed as a Prisma migration at
--   prisma/migrations/20260815120000_extend_profiles_for_profile_page/
-- so `prisma migrate deploy` and this file cannot drift. If you run THIS file
-- first, mark the Prisma one as already applied instead of running it twice:
--   npx prisma migrate resolve --applied 20260815120000_extend_profiles_for_profile_page
--
-- WHY EVERY COLUMN IS NULLABLE OR DEFAULTED
-- The on_auth_user_created trigger from 001 inserts only the seven original
-- columns. A NOT NULL column without a default would make that insert raise,
-- and because the trigger runs inside the signup transaction it would ABORT
-- EVERY SIGNUP. Nothing below may ever become NOT NULL without a default.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. COLUMNS
-- ---------------------------------------------------------------------

-- Profile header ------------------------------------------------------
-- Public URL of the object in the `avatars` storage bucket (003). Null means
-- "render initials" — the app never ships a placeholder image.
alter table public.profiles add column if not exists avatar_url text;

-- Display handle. Uniqueness is enforced by the case-insensitive partial index
-- in section 2, not by a UNIQUE constraint, because every pre-existing row has
-- NULL here and a plain UNIQUE would still permit only one NULL in some
-- engines. Postgres allows many NULLs, but the lower() index is what actually
-- makes "Ada" and "ada" collide.
alter table public.profiles add column if not exists username text;

-- Personal information ------------------------------------------------
alter table public.profiles add column if not exists alternate_phone text;
alter table public.profiles add column if not exists date_of_birth   date;
alter table public.profiles add column if not exists address_line    text;
alter table public.profiles add column if not exists city            text;
alter table public.profiles add column if not exists state           text;
alter table public.profiles add column if not exists country         text;
alter table public.profiles add column if not exists postal_code     text;

-- Professional information --------------------------------------------
-- employee_id is free text, not an integer: real employee ids carry prefixes
-- ("PCX-0142") far more often than they are bare numbers.
alter table public.profiles add column if not exists employee_id       text;
alter table public.profiles add column if not exists department        text;
alter table public.profiles add column if not exists designation       text;
alter table public.profiles add column if not exists reporting_manager text;
alter table public.profiles add column if not exists team              text;
alter table public.profiles add column if not exists joining_date      date;

-- text[] rather than a skills join table: these are display-only chips, never
-- queried, filtered or aggregated across users. A join table would add two
-- more objects and an RLS policy each to maintain for no read this app makes.
alter table public.profiles add column if not exists skills text[] not null default '{}';

-- Account state -------------------------------------------------------
-- active | inactive | deleted. 'deleted' is a SOFT delete: the auth.users row
-- survives, because hard deletion requires the service_role key which this
-- project deliberately does not hold. See section 4.
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists last_login_at   timestamptz;
alter table public.profiles add column if not exists deactivated_at  timestamptz;
alter table public.profiles add column if not exists deleted_at      timestamptz;

-- Rejects a typo'd status at the database rather than letting it silently
-- become a state no code branch handles. NOT VALID would skip the check on
-- existing rows; there is no need here since the column was just created with
-- a valid default.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_account_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_account_status_check
      check (account_status in ('active', 'inactive', 'deleted'));
  end if;
end $$;

-- Preferences ---------------------------------------------------------
-- Defaults mirror public."WorkspaceSettings", so a user who never opens the
-- Preferences card behaves exactly like their workspace default.
alter table public.profiles add column if not exists language    text not null default 'en-US';
alter table public.profiles add column if not exists time_zone   text not null default 'Europe/Berlin';
alter table public.profiles add column if not exists date_format text not null default 'DD MMM YYYY';
alter table public.profiles add column if not exists currency    text not null default 'EUR';
alter table public.profiles add column if not exists theme       text not null default 'system';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_theme_check'
  ) then
    alter table public.profiles
      add constraint profiles_theme_check
      check (theme in ('light', 'dark', 'system'));
  end if;
end $$;

-- Notification settings -----------------------------------------------
-- Individual boolean columns rather than one jsonb blob: each is independently
-- togglable, the set is fixed and known, and booleans keep the check-constraint
-- and default story trivial. jsonb would need validation in application code.
alter table public.profiles add column if not exists notify_email        boolean not null default true;
alter table public.profiles add column if not exists notify_sms          boolean not null default false;
alter table public.profiles add column if not exists notify_push         boolean not null default true;
alter table public.profiles add column if not exists notify_new_lead     boolean not null default true;
alter table public.profiles add column if not exists notify_new_customer boolean not null default true;
alter table public.profiles add column if not exists notify_deal         boolean not null default true;
alter table public.profiles add column if not exists notify_task         boolean not null default true;
alter table public.profiles add column if not exists notify_system       boolean not null default true;

-- SMS defaults to false while the others default to true: it is the only
-- channel that can cost the operator money per message.

-- Bookkeeping ---------------------------------------------------------
alter table public.profiles add column if not exists updated_at timestamptz not null default now();


-- ---------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------

-- Case-insensitive username uniqueness, ignoring the rows that have none.
-- Partial (WHERE username IS NOT NULL) so the many existing NULL rows are not
-- indexed at all.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null;

-- The Account Actions card filters deactivated/deleted accounts out of
-- workspace-facing lists.
create index if not exists profiles_account_status_idx
  on public.profiles (account_status)
  where account_status <> 'active';


-- ---------------------------------------------------------------------
-- 3. KEEP updated_at HONEST
--
-- A DEFAULT only fires on INSERT. Without this trigger, updated_at would
-- record when the row was created and then never change again, which is worse
-- than not having the column: the Profile page prints it as "last updated".
-- ---------------------------------------------------------------------
create or replace function public.touch_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.touch_profiles_updated_at();


-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY — NOTHING TO ADD
--
-- 001 already enabled RLS and created own-row-only policies:
--   profiles_select_own  USING (auth.uid() = id)
--   profiles_insert_own  WITH CHECK (auth.uid() = id)
--   profiles_update_own  USING + WITH CHECK (auth.uid() = id)
--
-- Those are column-agnostic: a policy filters ROWS, so every column added
-- above is automatically covered by the same "only your own row" rule. There
-- is still no DELETE policy, which is exactly why account deletion in this app
-- is a soft delete (account_status = 'deleted') rather than a DELETE.
--
-- The app's own reads go through Prisma as `postgres`, which bypasses RLS
-- entirely — so RLS here is the backstop for direct anon-key browser access,
-- and authorization for the API routes is enforced separately by
-- getSessionPayload() scoping every query to the caller's own id.
-- ---------------------------------------------------------------------


-- =====================================================================
-- 5. VERIFY
-- =====================================================================
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'profiles'
--  order by ordinal_position;
