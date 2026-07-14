-- ==========================================================================
-- Migration: Add missing privacy columns to profiles + fix user_settings
--
-- Problem:
--   PGRST204 errors from Settings.jsx:
--   1. "Could not find the 'setting_key' column of 'user_settings' in the
--      schema cache" — user_settings table not yet created in DB (migration
--      20260703000005 creates it but may not be applied yet).
--   2. "Could not find the 'data_sharing' column of 'profiles' in the
--      schema cache" — columns email_notifications, order_updates,
--      marketing_emails, data_sharing only exist in legacy
--      database/migrations/012-privacy-settings-and-deletion.sql, never
--      ported to supabase/migrations/.
--
-- Fix:
--   1. Add the four privacy preference columns to profiles (idempotent).
--   2. Ensure user_settings table exists (re-declare here as safety net
--      in case 20260703000005 hasn't been applied yet).
--   3. Reload PostgREST schema cache so new columns are immediately
--      visible to the REST API.
--
-- After applying this migration, run:
--   NOTIFY pgrst, 'reload schema';
-- (included at the end of this file)
-- ==========================================================================

BEGIN;

-- ============================================================================
-- 1. Privacy preference columns on profiles
-- ============================================================================
-- Used by: src/pages/buyer/Settings.jsx handleSavePrivacy() / loadPrivacyPrefs()
-- Sends: { email_notifications, order_updates, marketing_emails, data_sharing }
-- Missing from: all supabase/migrations/ files
-- Exists in: database/migrations/012-privacy-settings-and-deletion.sql

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS order_updates      BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS marketing_emails    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_sharing        BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 2. Ensure user_settings table exists (safety net)
-- ============================================================================
-- If migration 20260703000005 was already applied, these are no-ops.
-- If it wasn't, this ensures the table exists so setting_key works.

CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, setting_key)
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

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

-- ============================================================================
-- 3. Reload PostgREST schema cache
-- ============================================================================
-- PGRST204 "schema cache" errors persist until PostgREST reloads its cache.
-- This NOTIFY forces an immediate reload so new columns are visible without
-- waiting for the automatic refresh.

NOTIFY pgrst, 'reload schema';
