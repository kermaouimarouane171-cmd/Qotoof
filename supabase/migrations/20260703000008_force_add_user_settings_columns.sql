-- ==========================================================================
-- Migration: Force-add missing columns to existing user_settings table
--PGRST204
-- Problem:
--   : "Could not find the 'setting_key' column of 'user_settings'
--   in the schema cache"
--
--   Migrations 20260703000005 and 20260703000007 both use
--   CREATE TABLE IF NOT EXISTS — which is a NO-OP if the table already
--   exists (e.g. created by a partial legacy migration run with a
--   different schema). The table exists but is missing setting_key,
--   setting_value, and possibly other columns.
--
--   Since data_sharing on profiles was fixed by migration 07, we know
--   migration 07 was applied. Its CREATE TABLE IF NOT EXISTS was a no-op
--   because user_settings already existed without setting_key.
--
-- Fix:
--   Use ALTER TABLE ADD COLUMN IF NOT EXISTS (not CREATE TABLE) to
--   force-add missing columns to the existing table. Then reload
--   PostgREST schema cache.
-- ==========================================================================

BEGIN;

-- Ensure table exists (safety net, no-op if already present)
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, setting_key)
);

-- Force-add columns regardless of when/how table was created.
-- NOTE: setting_key is NOT NULL but the table may have existing rows
-- (from the old fixed-column schema: notifications_email, etc.).
-- Adding NOT NULL without a default to a table with rows fails in PG.
-- Solution: add as nullable → backfill → set NOT NULL.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS id            UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS setting_key   TEXT,
  ADD COLUMN IF NOT EXISTS setting_value JSONB,
  ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

-- Add PK on id only if the table doesn't have one yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE contype = 'p' AND conrelid = 'public.user_settings'::regclass
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Backfill setting_key for any existing rows that have NULL
UPDATE public.user_settings
  SET setting_key = 'legacy_settings'
  WHERE setting_key IS NULL;

-- Now safe to set NOT NULL
ALTER TABLE public.user_settings
  ALTER COLUMN setting_key SET NOT NULL;

-- Ensure UNIQUE constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_settings_user_id_setting_key_key'
      AND conrelid = 'public.user_settings'::regclass
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_user_id_setting_key_key
      UNIQUE (user_id, setting_key);
  END IF;
END $$;

-- Ensure RLS enabled
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Ensure policies
DROP POLICY IF EXISTS user_settings_user_select ON public.user_settings;
CREATE POLICY user_settings_user_select
  ON public.user_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_settings_user_manage ON public.user_settings;
CREATE POLICY user_settings_user_manage
  ON public.user_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
