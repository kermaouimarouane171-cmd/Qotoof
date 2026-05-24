-- ============================================
-- Fix Marketplace: Approve existing available products
-- Run this in Supabase SQL Editor to make products
-- visible in the Marketplace page.
-- ============================================

-- Step 1: Add approval_status column if it doesn't exist yet
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);

-- Step 2: Approve all existing available products
UPDATE products
SET
  approval_status = 'approved',
  approved_at = NOW()
WHERE is_available = true
  AND approval_status = 'pending';

-- Step 3: Create index for faster queries (safe to re-run)
CREATE INDEX IF NOT EXISTS idx_products_approval_status ON products(approval_status);

-- Verify: Check how many products are now approved
SELECT
  approval_status,
  COUNT(*) AS count
FROM products
GROUP BY approval_status;
