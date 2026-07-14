-- ==========================================================================
-- Migration: Add columns referenced by BEFORE UPDATE triggers on profiles
--
-- Problem:
--   Two BEFORE UPDATE triggers on public.profiles reference columns that
--   were never added via any supabase/migrations/ ALTER TABLE statement:
--
--   1. prevent_user_admin_field_self_write (migration 20260528000001)
--      references: is_verified, admin_notes, verification_status
--
--   2. prevent_sensitive_profile_self_update (migration 20260629000004)
--      references: is_approved, is_verified, approved_by, approved_at
--
--   These columns exist only in the legacy database/migrations/ directory
--   (000-complete-fresh-setup.sql, 008c-complete-setup.sql, etc.) but were
--   never ported to supabase/migrations/.
--
--   When ANY UPDATE (PATCH) is attempted on profiles, the triggers fire and
--   access NEW.is_verified, OLD.is_approved, etc. PostgreSQL throws error
--   42703 (undefined_column), which PostgREST returns as 400 Bad Request.
--   This blocks ALL profile updates — onboarding, settings, referral
--   attachment, avatar upload, etc.
--
-- Fix:
--   Add all six missing columns with ADD COLUMN IF NOT EXISTS (idempotent).
--   Defaults match the legacy schema in database/migrations/.
-- ==========================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified          BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_approved          BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_notes          TEXT,
  ADD COLUMN IF NOT EXISTS verification_status  TEXT        DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_by          UUID        REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at          TIMESTAMPTZ;

COMMIT;
