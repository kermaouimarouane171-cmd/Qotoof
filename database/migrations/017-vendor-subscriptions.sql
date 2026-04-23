-- ============================================
-- Vendor Subscriptions & Billing
-- Creates subscription tables, adds Stripe
-- integration columns, and grace period support
-- ============================================

-- 1. Add subscription columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'professional', 'enterprise')),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'grace_period')),
  ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS grace_period_ends TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS notify_low_stock BOOLEAN DEFAULT true;

-- 2. Create subscription_plans table (plan definitions)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY, -- 'free', 'basic', 'professional', 'enterprise'
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  price_monthly DECIMAL(10, 2) NOT NULL,
  price_yearly DECIMAL(10, 2) NOT NULL,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  max_products INTEGER, -- NULL = unlimited
  commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 2.0,
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO subscription_plans (id, name, name_ar, price_monthly, price_yearly, max_products, commission_rate, features) VALUES
  ('free', 'Free', 'مجاني', 0, 0, 10, 5.0, '["10 منتجات", "عمولة 5%", "دعم عبر البريد"]'::jsonb),
  ('basic', 'Basic', 'أساسي', 99, 990, 50, 3.0, '["50 منتج", "عمولة 3%", "دعم عبر البريد والهاتف", "تحليلات أساسية"]'::jsonb),
  ('professional', 'Professional', 'احترافي', 249, 2490, NULL, 2.0, '["منتجات غير محدودة", "عمولة 2%", "دعم أولوية 24/7", "تحليلات متقدمة", "رفع جماعي"]'::jsonb),
  ('enterprise', 'Enterprise', 'مؤسسات', 499, 4990, NULL, 1.0, '["كل مميزات الاحترافي", "عمولة 1%", "مدير حساب مخصص", "API كامل", "تكامل مخصص"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 3. Create subscription_history table (audit trail)
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_plan TEXT,
  new_plan TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('upgrade', 'downgrade', 'cancel', 'reactivate', 'expired', 'grace_period_start', 'grace_period_end')),
  amount DECIMAL(10, 2),
  stripe_event_id TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_vendor ON subscription_history(vendor_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created ON subscription_history(created_at DESC);

-- 4. Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  subscription_plan TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'MAD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);

-- 5. RLS Policies
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Vendors can view their own history
CREATE POLICY "Vendors can view own subscription history"
  ON subscription_history FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

CREATE POLICY "Vendors can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

-- System can insert (via webhook)
CREATE POLICY "System can insert subscription history"
  ON subscription_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins can view all
CREATE POLICY "Admins can view all subscription history"
  ON subscription_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. Function to check if vendor is within grace period
CREATE OR REPLACE FUNCTION public.is_vendor_in_grace_period(p_vendor_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
  v_grace_end TIMESTAMPTZ;
BEGIN
  SELECT subscription_status, grace_period_ends
  INTO v_status, v_grace_end
  FROM profiles WHERE id = p_vendor_id;

  -- If in grace period and hasn't expired yet
  IF v_status = 'grace_period' AND v_grace_end > NOW() THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to check if vendor can still sell (active or grace period)
CREATE OR REPLACE FUNCTION public.can_vendor_sell(p_vendor_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
  v_sub_end TIMESTAMPTZ;
  v_grace_end TIMESTAMPTZ;
BEGIN
  SELECT subscription_status, subscription_end, grace_period_ends
  INTO v_status, v_sub_end, v_grace_end
  FROM profiles WHERE id = p_vendor_id;

  -- Active subscription
  IF v_status = 'active' THEN
    RETURN true;
  END IF;

  -- Within grace period
  IF v_status = 'grace_period' AND v_grace_end > NOW() THEN
    RETURN true;
  END IF;

  -- Free plan always allowed
  IF v_status = 'active' AND (
    SELECT subscription_plan FROM profiles WHERE id = p_vendor_id
  ) = 'free' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to handle subscription expiration (sets grace period)
CREATE OR REPLACE FUNCTION public.handle_subscription_expiration()
RETURNS void AS $$
BEGIN
  -- Move expired subscriptions to grace period (7 days)
  UPDATE profiles
  SET
    subscription_status = 'grace_period',
    grace_period_ends = NOW() + INTERVAL '7 days'
  WHERE
    subscription_status = 'active'
    AND subscription_plan != 'free'
    AND subscription_end < NOW()
    AND (grace_period_ends IS NULL OR grace_period_ends < NOW());

  -- Move expired grace periods to canceled
  UPDATE profiles
  SET
    subscription_status = 'canceled',
    subscription_plan = 'free'
  WHERE
    subscription_status = 'grace_period'
    AND grace_period_ends < NOW();

  -- Log grace period starts
  INSERT INTO subscription_history (vendor_id, old_plan, new_plan, change_type, reason)
  SELECT
    id,
    subscription_plan,
    subscription_plan,
    'grace_period_start',
    'Subscription expired, entering 7-day grace period'
  FROM profiles
  WHERE subscription_status = 'grace_period'
    AND grace_period_ends > NOW() - INTERVAL '1 hour'
    AND NOT EXISTS (
      SELECT 1 FROM subscription_history
      WHERE vendor_id = profiles.id
        AND change_type = 'grace_period_start'
        AND created_at > NOW() - INTERVAL '1 hour'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify success
DO $$
BEGIN
  RAISE NOTICE '✅ Vendor subscriptions enabled!';
  RAISE NOTICE '   - subscription_plan, subscription_status columns added';
  RAISE NOTICE '   - stripe_customer_id, stripe_subscription_id columns added';
  RAISE NOTICE '   - grace_period_ends column added (7-day grace period)';
  RAISE NOTICE '   - subscription_plans table created with 4 plans';
  RAISE NOTICE '   - subscription_history table created';
  RAISE NOTICE '   - invoices table created';
  RAISE NOTICE '   - is_vendor_in_grace_period() function created';
  RAISE NOTICE '   - can_vendor_sell() function created';
  RAISE NOTICE '   - handle_subscription_expiration() function created';
END $$;
