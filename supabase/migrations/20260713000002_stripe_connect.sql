-- ============================================
-- Stripe Connect Integration
-- Adds Stripe Connect account columns to profiles
-- and Stripe payment/transfer columns to orders
-- ============================================

-- 1. Add Stripe Connect columns to profiles (for vendors AND drivers)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_status TEXT DEFAULT 'not_connected'
    CHECK (stripe_connect_status IN ('not_connected', 'pending', 'restricted', 'enabled', 'rejected')),
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN DEFAULT FALSE;

-- 2. Add Stripe payment columns to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_vendor_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_driver_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;

-- 3. Add Stripe transfer columns to payments table (if it exists)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT;

-- 4. Create index for Stripe Connect account lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect_account
  ON profiles(stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

-- 5. Create index for Stripe session/payment intent lookups on orders
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session
  ON orders(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent
  ON orders(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- 6. Add updated_at trigger for stripe_connect columns
CREATE OR REPLACE FUNCTION update_stripe_connect_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update onboarded_at when transitioning to enabled/restricted
  IF NEW.stripe_connect_status IS DISTINCT FROM OLD.stripe_connect_status
     AND NEW.stripe_connect_status IN ('enabled', 'restricted')
     AND OLD.stripe_connect_status NOT IN ('enabled', 'restricted')
     AND NEW.stripe_connect_onboarded_at IS NULL THEN
    NEW.stripe_connect_onboarded_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_stripe_connect_updated ON profiles;
CREATE TRIGGER trigger_profiles_stripe_connect_updated
  BEFORE UPDATE OF stripe_connect_status, stripe_connect_details_submitted,
    stripe_connect_payouts_enabled, stripe_connect_charges_enabled
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_connect_timestamp();

-- 7. RLS policies for stripe_connect columns (users can read their own, admins can read all)
-- profiles already has RLS enabled, so these columns are covered by existing policies.
