-- Migration: Add bio and operating_hours columns to profiles
-- File:      20260527200000_add_missing_profiles_columns.sql
-- Date:      2026-05-27
--
-- Problem:
--   Migrations 20260528000003 and 20260528000004 create the public_profiles
--   view which selects `bio` and `operating_hours` from profiles.
--   Neither column exists in the profiles table (they were planned but never
--   added via any supabase migration), causing:
--     ERROR: column "bio" does not exist
--
-- Fix:
--   Add the two missing columns with safe defaults (NULL — no back-fill needed).
--
--   bio             TEXT  — short vendor/driver biography displayed on their
--                           public profile page (VendorProfile.jsx)
--   operating_hours JSONB — weekly schedule object, e.g.
--                           {"monday": {"open":"09:00","close":"18:00"}, ...}
--                           selected by vendorsApi.getById and useAuthQueries

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio             TEXT,
  ADD COLUMN IF NOT EXISTS operating_hours JSONB;
