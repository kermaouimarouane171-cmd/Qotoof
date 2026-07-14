-- ===============================================================
-- Qotoof Marketplace - Add Missing Vendor Columns
-- ===============================================================
-- This migration adds all columns that are referenced in the code
-- but missing from the unified schema (030-unified-schema.sql).
-- These columns exist in supabase/migrations/ but not in database/migrations/.
-- Safe to re-run.
-- ===============================================================

BEGIN;

-- ===============================================================
-- 1. Add missing columns to profiles table
-- ===============================================================

-- Agreement columns (from 20260422000014_final_marketplace_features.sql)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS agreement_accepted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS agreement_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agreement_version VARCHAR;

-- Onboarding columns (from 20260422000022_supabase_critical_migration.sql)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Payment policy columns (from 20260422000015_payment_policy_and_disputes.sql)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_policy_full BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS payment_policy_split BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_policy_cod BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_policy_updated_at TIMESTAMPTZ;

-- PayPal columns (from 20260527120000_paypal_marketplace_enforcement.sql)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS paypal_email TEXT,
  ADD COLUMN IF NOT EXISTS paypal_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payout_method VARCHAR DEFAULT 'paypal';

-- Notification columns (from 20260708000003_add_missing_notification_columns.sql)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notify_order_updates BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_customer_messages BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_low_stock BOOLEAN DEFAULT TRUE;

-- Store pause columns (from 20260422000022_supabase_critical_migration.sql)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS store_paused BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS store_paused_reason TEXT;

-- Inventory columns (from 20260422000017_missing_features.sql)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(10, 2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(12, 2) DEFAULT 0;

-- ===============================================================
-- 2. Add missing columns to products table
-- ===============================================================

-- Approval status column (from 020-product-approval-workflow.sql)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'published'));

-- Add approved_at column if not exists
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Create index on approval_status
CREATE INDEX IF NOT EXISTS idx_products_approval_status ON products(approval_status);

-- ===============================================================
-- 3. Add missing columns to reviews table
-- ===============================================================

-- Vendor reply columns (from 014-vendor-review-replies.sql)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS vendor_reply TEXT,
  ADD COLUMN IF NOT EXISTS vendor_reply_at TIMESTAMPTZ;

-- Add product_id column if not exists (from 014-vendor-review-replies.sql)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- Create index on vendor_reply
CREATE INDEX IF NOT EXISTS idx_reviews_vendor_reply ON reviews(vendor_id, vendor_reply_at DESC)
  WHERE vendor_reply IS NOT NULL;

-- ===============================================================
-- 4. Add missing columns to orders table
-- ===============================================================

-- Payment status column (from 20260527120000_paypal_marketplace_enforcement.sql)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR DEFAULT 'pending'
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partial_refund'));

-- ===============================================================
-- 5. Add missing columns to vendor_contracts table
-- ===============================================================

-- Add paypal_email column to vendor_contracts (currently missing)
ALTER TABLE vendor_contracts
  ADD COLUMN IF NOT EXISTS paypal_email TEXT;

-- ===============================================================
-- 6. Update existing data with default values
-- ===============================================================

-- Set default values for existing profiles
UPDATE profiles
SET
  agreement_accepted = COALESCE(agreement_accepted, FALSE),
  onboarding_completed = COALESCE(onboarding_completed, FALSE),
  onboarding_step = COALESCE(onboarding_step, 0),
  payment_policy_full = COALESCE(payment_policy_full, TRUE),
  payment_policy_split = COALESCE(payment_policy_split, FALSE),
  payment_policy_cod = COALESCE(payment_policy_cod, FALSE),
  payout_method = COALESCE(payout_method, 'paypal'),
  notify_order_updates = COALESCE(notify_order_updates, TRUE),
  notify_customer_messages = COALESCE(notify_customer_messages, TRUE),
  notify_low_stock = COALESCE(notify_low_stock, TRUE),
  store_paused = COALESCE(store_paused, FALSE),
  low_stock_threshold = COALESCE(low_stock_threshold, 10),
  min_order_amount = COALESCE(min_order_amount, 0)
WHERE agreement_accepted IS NULL
   OR onboarding_completed IS NULL
   OR onboarding_step IS NULL
   OR payment_policy_full IS NULL
   OR payment_policy_split IS NULL
   OR payment_policy_cod IS NULL
   OR payout_method IS NULL
   OR notify_order_updates IS NULL
   OR notify_customer_messages IS NULL
   OR notify_low_stock IS NULL
   OR store_paused IS NULL
   OR low_stock_threshold IS NULL
   OR min_order_amount IS NULL;

-- Set default approval status for existing products
UPDATE products
SET approval_status = 'approved', approved_at = NOW()
WHERE approval_status = 'pending' AND is_available = true;

-- Set default payment status for existing orders
UPDATE orders
SET payment_status = 'paid'
WHERE payment_status IS NULL AND status IN ('completed', 'delivered');

COMMIT;

-- ===============================================================
-- Verification queries (commented out - run manually to verify)
-- ===============================================================

-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'profiles'
--   AND column_name IN ('agreement_accepted', 'onboarding_completed', 'approval_status', 'payment_policy_full', 'paypal_email', 'notify_order_updates', 'store_paused', 'low_stock_threshold', 'min_order_amount')
-- ORDER BY ordinal_position;

-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'products'
--   AND column_name IN ('approval_status', 'approved_at')
-- ORDER BY ordinal_position;

-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'reviews'
--   AND column_name IN ('vendor_reply', 'vendor_reply_at', 'product_id')
-- ORDER BY ordinal_position;

-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'orders'
--   AND column_name = 'payment_status'
-- ORDER BY ordinal_position;

-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'vendor_contracts'
--   AND column_name = 'paypal_email'
-- ORDER BY ordinal_position;
