-- ============================================================================
-- Migration: Ensure favorites table has correct constraints and RLS
-- The table already exists (from legacy migrations) with correct columns.
-- This migration ensures constraints and RLS policies are in place.
--
-- Used by: src/pages/buyer/Settings.jsx handleExportData() (line 174)
--   Selects: * from favorites where user_id = auth user
-- Also used by: favoritesStore.js, ProductCard.jsx, ProductDetail.jsx
-- ============================================================================

-- 1. Ensure unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_product_favorite'
  ) THEN
    ALTER TABLE public.favorites
      ADD CONSTRAINT unique_user_product_favorite UNIQUE (user_id, product_id);
  END IF;
END $$;

-- 2. Ensure check constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_favorite_target'
  ) THEN
    ALTER TABLE public.favorites
      ADD CONSTRAINT check_favorite_target CHECK (product_id IS NOT NULL OR vendor_id IS NOT NULL);
  END IF;
END $$;

-- 3. Create indexes if not already present
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product ON public.favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_favorites_vendor ON public.favorites(vendor_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created ON public.favorites(created_at);

-- 4. Ensure RLS is enabled
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (idempotent — drop and recreate)
DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorites;
CREATE POLICY "Users can view own favorites"
  ON public.favorites FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can add own favorites" ON public.favorites;
CREATE POLICY "Users can add own favorites"
  ON public.favorites FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove own favorites" ON public.favorites;
CREATE POLICY "Users can remove own favorites"
  ON public.favorites FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
