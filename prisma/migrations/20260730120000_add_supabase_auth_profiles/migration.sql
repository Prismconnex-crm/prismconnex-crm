-- Supabase Auth integration.
--
-- ⚠️ PARTIAL MIGRATION. The public.profiles table, its auto-create trigger on
-- auth.users, and its RLS policies are maintained in:
--     supabase/sql/001_create_profiles.sql
-- That file is kept separate (and is idempotent) because it touches the `auth`
-- schema and declares a cross-schema foreign key that Prisma 5 cannot model
-- without the multiSchema preview feature. Apply it FIRST when bootstrapping a
-- new environment, then run migrations.
--
-- This migration only covers the Prisma-owned part of the change.

-- Link the CRM/tenancy User record to its Supabase Auth user (auth.users.id).
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "supabaseUserId" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "User_supabaseUserId_key"
  ON "public"."User" ("supabaseUserId");
