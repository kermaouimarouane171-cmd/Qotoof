-- ============================================
-- Fix reviews_public_select RLS policy
-- Ensure soft-deleted reviews are NOT publicly visible
-- ============================================

-- 1. Drop the existing overly-permissive policy
DROP POLICY IF EXISTS "reviews_public_select" ON reviews;

-- 2. Recreate with explicit deleted_at IS NULL filter
CREATE POLICY "reviews_public_select"
  ON reviews FOR SELECT
  USING (deleted_at IS NULL);

-- Notify success
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed reviews_public_select RLS policy';
  RAISE NOTICE '   - Soft-deleted reviews are now excluded from public SELECT';
END $$;
