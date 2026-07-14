-- ==========================================================================
-- Migration: Add missing columns to profiles (schema drift fix)
--
-- Problem: Several columns referenced by frontend code, RLS policies, and
--          views were never added via ALTER TABLE in any supabase migration.
--          They exist only in the legacy database/migrations/ directory.
--          This causes:
--          - 400 errors on SELECT because RLS policy profiles_select_active_drivers
--            references is_available_for_delivery which may not exist → PostgreSQL
--            errors when evaluating the policy for every SELECT on profiles.
--          - 400 errors when frontend code explicitly selects non-existent columns
--            (mfa_enabled, last_seen_at) via useAuthQueries.js.
--
-- Affected columns and their references:
--   - is_available_for_delivery  BOOLEAN   — RLS policy profiles_select_active_drivers
--   - current_active_deliveries  INTEGER   — autoDispatch.js isDriverAvailable()
--   - max_concurrent_deliveries  INTEGER   — autoDispatch.js isDriverAvailable()
--   - mfa_enabled                BOOLEAN   — useAuthQueries.js, Security.jsx
--   - last_seen_at               TIMESTAMPTZ — useAuthQueries.js, admin dashboard
--   - address                    TEXT      — profile forms, checkout
--
-- Fix: Add all with ADD COLUMN IF NOT EXISTS (idempotent).
-- ==========================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_available_for_delivery  BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS current_active_deliveries  INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_concurrent_deliveries  INTEGER     DEFAULT 3,
  ADD COLUMN IF NOT EXISTS mfa_enabled                BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_seen_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS address                    TEXT;

COMMIT;
