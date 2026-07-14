-- ==========================================================================
-- Migration: Fix Coupons Schema to Match Code Expectations
--
-- Problem: Code expects columns that don't exist in the database schema.
-- The database has valid_from/valid_until but code uses starts_at/expires_at.
-- Code also expects: title, description, minimum_quantity, applies_to,
-- max_uses_per_user, metadata which are missing from the schema.
--
-- Solution: Add missing columns and rename existing columns with
-- backward compatibility to ensure existing data is preserved.
-- ==========================================================================

BEGIN;

-- 1. Add missing columns to coupons table
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS minimum_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applies_to TEXT DEFAULT 'order' CHECK (applies_to IN ('order', 'bulk')),
  ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Rename columns with backward compatibility
-- First, add new columns if they don't exist
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Copy data from old columns to new columns if new columns are null
UPDATE public.coupons
SET starts_at = valid_from
WHERE starts_at IS NULL AND valid_from IS NOT NULL;

UPDATE public.coupons
SET expires_at = valid_until
WHERE expires_at IS NULL AND valid_until IS NOT NULL;

-- Note: We keep valid_from and valid_until for backward compatibility
-- in case any legacy code still references them

-- 3. Add indexes for new columns to improve query performance
CREATE INDEX IF NOT EXISTS idx_coupons_applies_to ON public.coupons(applies_to) WHERE applies_to = 'bulk';
CREATE INDEX IF NOT EXISTS idx_coupons_minimum_quantity ON public.coupons(minimum_quantity) WHERE minimum_quantity > 0;

-- 4. Ensure RLS is enabled and policies are correct
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "coupons_public_select" ON public.coupons;
DROP POLICY IF EXISTS "coupons_vendor_manage" ON public.coupons;
DROP POLICY IF EXISTS "coupons_admin_manage" ON public.coupons;
DROP POLICY IF EXISTS "Coupons viewable by everyone" ON public.coupons;
DROP POLICY IF EXISTS "Vendors can manage own coupons" ON public.coupons;

-- Create new policies matching code expectations
CREATE POLICY "coupons_public_select"
  ON public.coupons FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

CREATE POLICY "coupons_vendor_manage"
  ON public.coupons FOR ALL
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "coupons_admin_manage"
  ON public.coupons FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. Add comment to document the schema change
COMMENT ON COLUMN public.coupons.valid_from IS 'Legacy column - use starts_at instead (kept for backward compatibility)';
COMMENT ON COLUMN public.coupons.valid_until IS 'Legacy column - use expires_at instead (kept for backward compatibility)';
COMMENT ON COLUMN public.coupons.starts_at IS 'Coupon start date/time - primary column for validity start';
COMMENT ON COLUMN public.coupons.expires_at IS 'Coupon expiration date/time - primary column for validity end';
COMMENT ON COLUMN public.coupons.title IS 'Human-readable coupon title displayed in UI';
COMMENT ON COLUMN public.coupons.description IS 'Detailed description of coupon terms and conditions';
COMMENT ON COLUMN public.coupons.minimum_quantity IS 'Minimum order quantity required for bulk discounts';
COMMENT ON COLUMN public.coupons.applies_to IS 'Coupon scope: "order" for regular discounts, "bulk" for volume-based discounts';
COMMENT ON COLUMN public.coupons.max_uses_per_user IS 'Maximum times a single user can redeem this coupon';
COMMENT ON COLUMN public.coupons.metadata IS 'Additional coupon data stored as JSONB for flexibility';

COMMIT;

-- Reload PostgREST schema cache to recognize new columns
NOTIFY pgrst, 'reload schema';
