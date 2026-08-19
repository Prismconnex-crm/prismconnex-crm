-- =====================================================================
-- 003_avatars_storage.sql
--
-- Creates the `avatars` Storage bucket and its RLS policies, for the Profile
-- page's photo upload (lib/supabase/storage.ts).
--
-- Run in: Supabase Dashboard -> SQL Editor.
-- Idempotent: safe to re-run.
--
-- There is no Prisma counterpart: storage.objects lives in the `storage`
-- schema, which Prisma does not manage. This file is the only definition.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE BUCKET
--
-- public = true, so avatar URLs can be rendered by <img> without a signed
-- request. That is safe here and is the standard Supabase avatar pattern: the
-- object key is the user's uuid plus a random filename, so a URL is
-- unguessable, and an avatar is by nature shown to other people in the CRM.
-- Anything genuinely private must NOT go in this bucket.
--
-- The limits are enforced twice on purpose — here at the storage layer, and
-- again in lib/supabase/storage.ts before the upload is attempted. The server
-- check gives a readable error; this one is what actually cannot be bypassed.
--   5 MiB          — matches MAX_AVATAR_BYTES in lib/supabase/storage.ts
--   image/* only   — blocks svg-with-script and arbitrary file hosting
--
-- Keep BOTH values in step with lib/supabase/storage.ts. If the bucket is the
-- stricter of the two, the server check passes and Storage then rejects the
-- upload — the failure moves to where the error message is least useful.
-- 'image/jpg' is not a real IANA type but some browsers still send it for a
-- .jpg, so it is listed here as well as in ALLOWED_MIME.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------
-- 2. RLS ON storage.objects
--
-- RLS is already enabled on storage.objects by Supabase; only policies are
-- needed. Every policy below is scoped to this bucket AND to a path whose
-- FIRST SEGMENT is the caller's own user id:
--
--     avatars/<auth.uid()>/<random>.png
--
-- `storage.foldername(name)` splits the object key on '/', so
-- (storage.foldername(name))[1] is that first segment. Comparing it to
-- auth.uid() is what stops an authenticated user from writing into — or
-- deleting out of — somebody else's folder. Without the folder check, any
-- signed-in user could overwrite every avatar in the bucket.
--
-- auth.uid() returns uuid and the path segment is text, so the cast is
-- required; without it Postgres raises "operator does not exist: uuid = text"
-- and the policy fails closed (every upload 403s).
-- ---------------------------------------------------------------------

-- 2a. READ — anyone may read. The bucket is public, so this simply matches
-- what the CDN already serves; it keeps the API path consistent with it.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

-- 2b. UPLOAD — only into your own folder.
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2c. OVERWRITE — needed because the upload uses upsert so a re-upload
-- replaces rather than accumulating orphans. USING selects which rows may be
-- targeted; WITH CHECK constrains what they may become. Both, or a user could
-- move an object out of their own folder.
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2d. DELETE — "Remove photo", and the cleanup of the previous file after a
-- replacement. Unlike public.profiles, storage DOES get a delete policy: there
-- is no cascade here, so without it removed avatars would linger forever.
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- =====================================================================
-- 3. VERIFY
-- =====================================================================
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'avatars';
--
-- select policyname, cmd from pg_policies
--  where schemaname = 'storage' and tablename = 'objects'
--    and policyname like 'avatars%';
