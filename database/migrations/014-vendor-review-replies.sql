-- ============================================
-- Vendor Review Replies
-- Adds reply functionality to the reviews table
-- ============================================

-- 1. Add vendor reply columns to reviews
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS vendor_reply TEXT,
  ADD COLUMN IF NOT EXISTS vendor_reply_at TIMESTAMPTZ;

-- 2. Add product_id column (if missing) for product-level reviews
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE;

-- 3. Add user_id alias column (maps to buyer_id for consistency)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. Create index for product-level reviews
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);

-- 5. Create index for vendor reply tracking
CREATE INDEX IF NOT EXISTS idx_reviews_vendor_reply ON reviews(vendor_id, vendor_reply_at DESC)
  WHERE vendor_reply IS NOT NULL;

-- 6. Add CHECK constraint: vendor_reply can only be set by the review's vendor
-- (Enforced at application level via RLS)

-- 7. RLS Policy: Vendors can update their own reviews (add replies)
DROP POLICY IF EXISTS "Vendors can reply to reviews" ON reviews;
CREATE POLICY "Vendors can reply to reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- 8. RLS Policy: Admins can delete reviews
DROP POLICY IF EXISTS "Admins can delete reviews" ON reviews;
CREATE POLICY "Admins can delete reviews"
  ON reviews FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Notify success
DO $$
BEGIN
  RAISE NOTICE '✅ Vendor review replies enabled!';
  RAISE NOTICE '   - vendor_reply (TEXT)';
  RAISE NOTICE '   - vendor_reply_at (TIMESTAMPTZ)';
  RAISE NOTICE '   - product_id (UUID) added for product-level reviews';
  RAISE NOTICE '   - user_id (UUID) alias added for consistency';
END $$;
