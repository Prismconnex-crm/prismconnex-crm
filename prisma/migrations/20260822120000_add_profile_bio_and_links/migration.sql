-- Adds the last four Profile page fields to public.profiles.
--
-- Identical DDL to supabase/sql/005_profile_bio_and_links.sql, which carries
-- the full rationale. Kept as a pair so `prisma migrate deploy` and the
-- Dashboard SQL Editor cannot drift.
--
-- All four are nullable: the on_auth_user_created trigger writes only the
-- seven original columns and runs inside the signup transaction, so a NOT NULL
-- column without a default would abort every signup.
--
-- No index is created. All four are display-only -- nothing filters, sorts or
-- joins on them, and the Profile page reads one row by primary key.
--
-- RLS needs no change: the own-row policies from 001 filter rows, not columns.

ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "company" TEXT;
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "linkedin_url" TEXT;
