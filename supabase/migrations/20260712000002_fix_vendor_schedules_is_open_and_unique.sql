-- Migration: Fix vendor_schedules schema — add is_open column + unique constraint
--
-- ROOT CAUSE:
--   The live database has vendor_schedules with `is_closed` (boolean, default false)
--   but the frontend code (Schedules.jsx) uses `is_open` (inverted boolean).
--   Additionally, the upsert call uses on_conflict=vendor_id,day_of_week but
--   no UNIQUE constraint exists on (vendor_id, day_of_week), causing a 400 error.
--
--   The legacy migration database/migrations/015-vendor-schedules.sql defined
--   `is_open` + UNIQUE(vendor_id, day_of_week), but it was never applied to the
--   live DB (it lives in the deprecated database/migrations folder, not
--   supabase/migrations).
--
-- FIX:
--   1. Add `is_open` column (BOOLEAN DEFAULT true), synced from existing
--      `is_closed` data (is_open = NOT is_closed).
--   2. Add UNIQUE constraint on (vendor_id, day_of_week) so the upsert
--      on_conflict=vendor_id,day_of_week works.

-- ============================================================================
-- 1. Add is_open column
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'vendor_schedules'
      AND column_name  = 'is_open'
  ) THEN
    ALTER TABLE public.vendor_schedules
      ADD COLUMN is_open BOOLEAN DEFAULT true;

    -- Sync from existing is_closed data (is_open = NOT is_closed)
    UPDATE public.vendor_schedules
      SET is_open = NOT COALESCE(is_closed, false);

    RAISE NOTICE 'Added is_open column to vendor_schedules and synced from is_closed';
  ELSE
    RAISE NOTICE 'is_open column already exists on vendor_schedules';
  END IF;
END
$$;

-- ============================================================================
-- 2. Add UNIQUE constraint on (vendor_id, day_of_week)
-- ============================================================================

-- Remove potential duplicates first (keep the most recent per vendor+day)
DELETE FROM public.vendor_schedules vs1
WHERE vs1.ctid NOT IN (
  SELECT MAX(vs2.ctid)
  FROM public.vendor_schedules vs2
  GROUP BY vs2.vendor_id, vs2.day_of_week
);

ALTER TABLE public.vendor_schedules
  DROP CONSTRAINT IF EXISTS uq_vendor_schedules_day;

ALTER TABLE public.vendor_schedules
  DROP CONSTRAINT IF EXISTS unique_vendor_day;

ALTER TABLE public.vendor_schedules
  ADD CONSTRAINT uq_vendor_schedules_day
  UNIQUE (vendor_id, day_of_week);
