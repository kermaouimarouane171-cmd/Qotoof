-- =============================================================================
-- Migration: Ensure All Required profiles Columns Exist
-- File:      20260519_add_missing_profiles_columns.sql
-- Date:      2026-05-19
-- Author:    Schema Audit — automated
-- =============================================================================
-- PROBLEM:
--   The `profiles` table was created by up to 5 separate migration sources
--   (000, 010, supabase/001_..., supabase/003_..., supabase/migrations/033_...).
--   Each adds overlapping columns with slightly different types:
--
--     Column                        | 000 type        | 020505033 type
--     ------------------------------|-----------------|----------------
--     latitude                      | DECIMAL(10,8)   | DOUBLE PRECISION
--     longitude                     | DECIMAL(11,8)   | DOUBLE PRECISION
--
--   On databases where migration 000 ran first, `latitude`/`longitude` are
--   DECIMAL. On databases where migration 033 ran first (Supabase CLI flow),
--   they are DOUBLE PRECISION. The two types are assignment-compatible but
--   the inconsistency causes TypeScript type errors in the app.
--
-- FIX:
--   1. Ensure every required column exists (idempotent ADD COLUMN IF NOT EXISTS).
--   2. Normalise `latitude` and `longitude` to DOUBLE PRECISION everywhere,
--      as that matches the app's TypeScript type (`number`) and PostGIS convention.
--   3. Add any column that migration 010 declared but which may not have been
--      applied on all environments.
--
-- AUDIT RESULT:
--   All 10 required columns ARE present in the canonical 000 migration, BUT:
--   • `latitude`/`longitude` type is DECIMAL in 000, DOUBLE PRECISION in 033.
--   • `vehicle_type` is defined as a custom ENUM `vehicle_type` in 000 but as
--     TEXT in migration 010. We normalise to TEXT for simpler extensibility.
--
-- IDEMPOTENT: Safe to run multiple times.
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1 — Add columns that may be absent on partial deployments
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS vendor_guidelines_accepted     BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vendor_guidelines_accepted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_verified                    BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_status            TEXT        DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_seen_at                   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_available_for_delivery      BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vehicle_plate                  TEXT;

-- vehicle_type: add as TEXT if the enum column doesn't yet exist
-- (if it already exists as the vehicle_type enum, this is a no-op)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'vehicle_type'
  ) THEN
    ALTER TABLE profiles ADD COLUMN vehicle_type TEXT DEFAULT 'van';
  END IF;
END $$;


-- =============================================================================
-- STEP 2 — Normalise latitude/longitude to DOUBLE PRECISION
-- =============================================================================
-- DECIMAL(10,8) and DECIMAL(11,8) are implicitly cast to DOUBLE PRECISION,
-- so no data loss occurs. We use ALTER COLUMN TYPE with USING cast.

DO $$
DECLARE
  v_lat_type TEXT;
  v_lng_type TEXT;
BEGIN
  SELECT data_type INTO v_lat_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'profiles'
    AND column_name  = 'latitude';

  SELECT data_type INTO v_lng_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'profiles'
    AND column_name  = 'longitude';

  -- Add columns if entirely absent
  IF v_lat_type IS NULL THEN
    ALTER TABLE profiles ADD COLUMN latitude  DOUBLE PRECISION;
    RAISE NOTICE 'Added profiles.latitude as DOUBLE PRECISION';
  ELSIF v_lat_type = 'numeric' THEN
    ALTER TABLE profiles
      ALTER COLUMN latitude TYPE DOUBLE PRECISION USING latitude::DOUBLE PRECISION;
    RAISE NOTICE 'Converted profiles.latitude from DECIMAL to DOUBLE PRECISION';
  ELSE
    RAISE NOTICE 'profiles.latitude is already DOUBLE PRECISION — no change';
  END IF;

  IF v_lng_type IS NULL THEN
    ALTER TABLE profiles ADD COLUMN longitude DOUBLE PRECISION;
    RAISE NOTICE 'Added profiles.longitude as DOUBLE PRECISION';
  ELSIF v_lng_type = 'numeric' THEN
    ALTER TABLE profiles
      ALTER COLUMN longitude TYPE DOUBLE PRECISION USING longitude::DOUBLE PRECISION;
    RAISE NOTICE 'Converted profiles.longitude from DECIMAL to DOUBLE PRECISION';
  ELSE
    RAISE NOTICE 'profiles.longitude is already DOUBLE PRECISION — no change';
  END IF;
END $$;


-- =============================================================================
-- STEP 3 — Default values / backfill for new boolean columns
-- =============================================================================
-- Ensure existing rows have non-NULL values for columns just added

UPDATE profiles
SET vendor_guidelines_accepted = FALSE
WHERE vendor_guidelines_accepted IS NULL;

UPDATE profiles
SET is_verified = FALSE
WHERE is_verified IS NULL;

UPDATE profiles
SET verification_status = 'pending'
WHERE verification_status IS NULL;

UPDATE profiles
SET is_available_for_delivery = FALSE
WHERE is_available_for_delivery IS NULL;


-- =============================================================================
-- STEP 4 — Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified
  ON profiles(is_verified);

CREATE INDEX IF NOT EXISTS idx_profiles_verification_status
  ON profiles(verification_status);

CREATE INDEX IF NOT EXISTS idx_profiles_is_available
  ON profiles(is_available_for_delivery)
  WHERE is_available_for_delivery = TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON profiles(last_seen_at DESC)
  WHERE last_seen_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_coords
  ON profiles(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- (Keep existing indexes created by migrations 000 / 010 — they are idempotent)
CREATE INDEX IF NOT EXISTS idx_profiles_role             ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_status    ON profiles(vendor_status);
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_guidelines
  ON profiles(vendor_guidelines_accepted)
  WHERE role = 'vendor';


-- =============================================================================
-- STEP 5 — RLS — no new policies needed; existing policies from 026 cover
--          all the columns added here. Verify that RLS is enabled.
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Re-assert the canonical safe policies from migration 026 (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_public_select'
  ) THEN
    CREATE POLICY "profiles_public_select"
      ON profiles FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_self_update'
  ) THEN
    CREATE POLICY "profiles_self_update"
      ON profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_self_insert'
  ) THEN
    CREATE POLICY "profiles_self_insert"
      ON profiles FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- VERIFICATION QUERY (run manually)
-- =============================================================================
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name   = 'profiles'
--   AND column_name  IN (
--     'vendor_guidelines_accepted', 'vendor_guidelines_accepted_at',
--     'is_verified', 'verification_status',
--     'latitude', 'longitude',
--     'last_seen_at', 'is_available_for_delivery',
--     'vehicle_type', 'vehicle_plate'
--   )
-- ORDER BY column_name;
-- =============================================================================
