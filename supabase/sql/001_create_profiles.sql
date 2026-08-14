-- =====================================================================
-- 001_create_profiles.sql
--
-- Creates public.profiles as the user-profile table for Supabase Auth.
-- Passwords are NEVER stored here -- they stay in auth.users.encrypted_password.
--
-- Run in: Supabase Dashboard -> SQL Editor (or via psql on DIRECT_URL).
-- Idempotent: safe to re-run.
--
-- NOTE ON PRISMA: the profiles.id -> auth.users.id foreign key crosses into
-- the `auth` schema, which Prisma 5 cannot model without the multiSchema
-- preview feature. After running this, either:
--   (a) copy this file to prisma/migrations/<ts>_add_profiles/migration.sql
--       and run `prisma migrate resolve --applied <ts>_add_profiles`, or
--   (b) accept that `prisma migrate dev` will report drift on the FK.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLE
--
-- id is BOTH the primary key and the foreign key to auth.users. That means
-- a profile cannot exist without an auth user, there is no separate join
-- column to keep in sync, and ON DELETE CASCADE removes the profile
-- automatically when the auth user is deleted.
--
-- Nullability is deliberate:
--   first_name / last_name  NOT NULL -- the sign-up form requires them, and
--                                       the trigger below always supplies a
--                                       value, so they can never be null.
--   middle_name / phone     NULL     -- middle_name is optional in the form,
--                                       and phone must tolerate signup paths
--                                       that carry no phone (e.g. a future
--                                       OAuth provider). A NOT NULL here
--                                       would make the trigger raise and
--                                       ABORT THE ENTIRE SIGNUP.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  first_name  text        not null,
  middle_name text,
  last_name   text        not null,
  email       text        not null,
  phone       text,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'User profile data for Supabase Auth users. Credentials live in auth.users.';

-- Case-insensitive email uniqueness (Postgres text comparison is
-- case-sensitive, so a plain UNIQUE would let alice@x.com and Alice@x.com
-- both exist).
create unique index if not exists profiles_email_lower_key
  on public.profiles (lower(email));

-- Supports sign-in by phone number: the sign-in form accepts either an email
-- or an Indian mobile number, and the server resolves phone -> email before
-- calling Supabase's password grant.
create index if not exists profiles_phone_idx
  on public.profiles (phone)
  where phone is not null;


-- ---------------------------------------------------------------------
-- 2. AUTO-CREATE THE PROFILE ON SIGN UP
--
-- Fires on INSERT into auth.users, which happens at signup time -- before
-- email confirmation. So the profile exists immediately, regardless of
-- whether email confirmation is enabled.
--
-- SECURITY DEFINER: runs as the function owner (postgres) so it can write to
-- public.profiles on behalf of an unauthenticated signup request. This is
-- also why no INSERT policy is required for the normal signup path -- a
-- SECURITY DEFINER function bypasses RLS.
--
-- `set search_path = public` is a hardening requirement for SECURITY DEFINER
-- functions: without it, a caller-controlled search_path could shadow the
-- objects this function references.
--
-- Every value is coalesced and the insert is ON CONFLICT DO NOTHING because
-- this trigger runs inside the signup transaction: any exception raised here
-- would roll back the signup and break authentication entirely.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, middle_name, last_name, email, phone)
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
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- ---------------------------------------------------------------------
-- 3. KEEP profiles.email IN SYNC WITH auth.users.email
--
-- auth.users.email is mutable (a user can change it, and it is only written
-- on confirmation). Without this, profiles.email silently goes stale and the
-- unique index starts guarding a value nothing else agrees with.
-- ---------------------------------------------------------------------
create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = new.email where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_auth_user_email();


-- ---------------------------------------------------------------------
-- 4. TABLE-LEVEL GRANTS
--
-- RLS filters WHICH ROWS a role may touch; GRANTs decide whether the role
-- may touch the table at all. Both are required. DELETE is deliberately not
-- granted -- profiles are removed only by the ON DELETE CASCADE above.
-- ---------------------------------------------------------------------
grant select, insert, update on public.profiles to authenticated;


-- =====================================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================================

-- ---------------------------------------------------------------------
-- 5a. ENABLE RLS  (deny by default)
--
-- The moment RLS is enabled, every row is invisible and unwritable to the
-- `anon` and `authenticated` roles until a policy explicitly permits it.
-- Nothing is granted implicitly, and policies are OR-ed -- a row is allowed
-- if ANY policy permits it, so each policy below only ever widens access.
--
-- Two roles bypass RLS entirely and are unaffected by everything below:
--   * postgres     -- how this app already reads/writes via Prisma
--   * service_role -- the server-side key used for admin operations
-- So RLS here is protection for the day the browser talks to Supabase
-- directly with the anon key, not for the current server-side Prisma path.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;


-- ---------------------------------------------------------------------
-- 5b. SELECT POLICY -- "read only your own profile"
--
-- auth.uid() reads the `sub` claim from the caller's Supabase JWT. Comparing
-- it to the row's id means a signed-in user sees exactly one row: their own.
-- `anon` is excluded (TO authenticated), so unauthenticated callers get zero
-- rows rather than an error.
--
-- SELECT policies use USING only -- USING is the row filter for existing
-- rows; there is no new row to check.
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);


-- ---------------------------------------------------------------------
-- 5c. INSERT POLICY -- "you may only create a profile keyed to yourself"
--
-- The signup trigger (SECURITY DEFINER) already bypasses RLS, so this policy
-- is not needed for the normal flow. It exists for two cases:
--   1. a client-side "complete your profile" step using the anon key
--   2. a safety net if the trigger is ever dropped
--
-- INSERT policies use WITH CHECK only -- there is no pre-existing row to
-- filter, just a candidate row to validate. Requiring auth.uid() = id is
-- what stops an authenticated user from forging a profile row under someone
-- else's user id.
-- ---------------------------------------------------------------------
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);


-- ---------------------------------------------------------------------
-- 5d. UPDATE POLICY -- "edit your own profile, and it stays yours"
--
-- UPDATE is the one command that needs BOTH clauses, and they do different
-- jobs:
--   USING      -- which existing rows this user is allowed to update
--                 (without it, they could target anyone's row)
--   WITH CHECK -- what the row is allowed to look like afterwards
--                 (without it, they could update their own row and reassign
--                  id to another user, silently hijacking that profile)
--
-- Both are required. Omitting WITH CHECK is the classic Supabase RLS bug.
-- ---------------------------------------------------------------------
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ---------------------------------------------------------------------
-- 5e. NO DELETE POLICY (intentional)
--
-- With RLS enabled and no DELETE policy, deletes by anon/authenticated are
-- denied. Profiles disappear only via ON DELETE CASCADE when the underlying
-- auth.users row is removed, which keeps the two tables from diverging.
-- ---------------------------------------------------------------------


-- =====================================================================
-- 6. VERIFY
-- =====================================================================
-- select tablename, policyname, cmd, qual, with_check
--   from pg_policies where schemaname = 'public' and tablename = 'profiles';
--
-- select relrowsecurity from pg_class
--  where oid = 'public.profiles'::regclass;
