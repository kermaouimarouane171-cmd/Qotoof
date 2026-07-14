-- ============================================
-- Update Subscription Plans: New Pricing + Free Trial
-- Creates subscription infrastructure from scratch (tables, columns, functions)
-- Replaces Stripe-only checkout with PayPal-friendly schema
-- Adds trial_ends_at column for 14-day Pro trial
-- ============================================

-- 1. Add subscription columns to profiles (they don't exist yet)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_period_ends TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;

-- 2. Add CHECK constraint on subscription_plan
DO $$
BEGIN
  BEGIN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_plan_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  ALTER TABLE profiles
    ADD CONSTRAINT profiles_subscription_plan_check
    CHECK (subscription_plan IN ('free', 'basic', 'pro', 'professional', 'enterprise'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Migrate existing 'professional' values to 'pro' (backward compatibility)
UPDATE profiles
SET subscription_plan = 'pro'
WHERE subscription_plan = 'professional';

-- 4. Create subscription_plans table (does not exist yet)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10, 2) NOT NULL DEFAULT 0,
  max_products INTEGER,
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.0,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  paypal_plan_id_monthly TEXT,
  paypal_plan_id_yearly TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enable RLS on subscription_plans
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- 5a. RLS policy: anyone can read active plans
DO $$
BEGIN
  DROP POLICY IF EXISTS "subscription_plans_public_read" ON subscription_plans;
  CREATE POLICY "subscription_plans_public_read"
    ON subscription_plans FOR SELECT
    TO anon, authenticated
    USING (is_active = true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Insert/Update plans with new pricing & features
-- 6a. Free plan
INSERT INTO subscription_plans (id, name, name_ar, price_monthly, price_yearly, max_products, commission_rate, features, is_active)
VALUES (
  'free',
  'Free',
  'مجاني',
  0,
  0,
  15,
  5.0,
  '[
    "15 منتجات",
    "عمولة 5%",
    "دعم عبر البريد",
    "ظهور عادي في البحث"
  ]'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_products = EXCLUDED.max_products,
  commission_rate = EXCLUDED.commission_rate,
  features = EXCLUDED.features,
  name = EXCLUDED.name,
  name_ar = EXCLUDED.name_ar,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 6b. Basic plan
INSERT INTO subscription_plans (id, name, name_ar, price_monthly, price_yearly, max_products, commission_rate, features, is_active)
VALUES (
  'basic',
  'Basic',
  'أساسي',
  149,
  1490,
  75,
  3.0,
  '[
    "75 منتج",
    "عمولة 3%",
    "دعم عبر البريد والهاتف",
    "تحليلات أساسية",
    "شارة موثّق في البحث",
    "كوبونات وتخفيضات"
  ]'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_products = EXCLUDED.max_products,
  commission_rate = EXCLUDED.commission_rate,
  features = EXCLUDED.features,
  name = EXCLUDED.name,
  name_ar = EXCLUDED.name_ar,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 6c. Pro plan (replaces 'professional')
INSERT INTO subscription_plans (id, name, name_ar, price_monthly, price_yearly, max_products, commission_rate, features, is_active)
VALUES (
  'pro',
  'Pro',
  'احترافي',
  299,
  2990,
  NULL,
  2.0,
  '[
    "منتجات غير محدودة",
    "عمولة 2%",
    "دعم أولوية 24/7",
    "تحليلات متقدمة",
    "رفع جماعي (Excel)",
    "سائق مفضل",
    "تنبيهات المخزون",
    "شارة موثّق + أولوية في البحث",
    "كوبونات وتخفيضات"
  ]'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_products = EXCLUDED.max_products,
  commission_rate = EXCLUDED.commission_rate,
  features = EXCLUDED.features,
  name = EXCLUDED.name,
  name_ar = EXCLUDED.name_ar,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 6d. Enterprise plan
INSERT INTO subscription_plans (id, name, name_ar, price_monthly, price_yearly, max_products, commission_rate, features, is_active)
VALUES (
  'enterprise',
  'Enterprise',
  'مؤسسات',
  599,
  5990,
  NULL,
  1.0,
  '[
    "كل مميزات الاحترافي",
    "عمولة 1%",
    "مدير حساب مخصص",
    "API كامل",
    "تكامل مخصص",
    "صفحة متجر مخصصة",
    "أعلى أولوية في البحث"
  ]'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_products = EXCLUDED.max_products,
  commission_rate = EXCLUDED.commission_rate,
  features = EXCLUDED.features,
  name = EXCLUDED.name,
  name_ar = EXCLUDED.name_ar,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 6e. Deactivate old 'professional' plan if it exists
UPDATE subscription_plans
SET is_active = false, updated_at = NOW()
WHERE id = 'professional' AND id != 'pro';

-- 7. Create subscription_history table (does not exist yet)
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_plan TEXT,
  new_plan TEXT,
  change_type TEXT NOT NULL,
  amount NUMERIC(10, 2),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7a. Enable RLS on subscription_history
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- 7b. RLS policy: vendors can read their own history
DO $$
BEGIN
  DROP POLICY IF EXISTS "subscription_history_vendor_read" ON subscription_history;
  CREATE POLICY "subscription_history_vendor_read"
    ON subscription_history FOR SELECT
    TO authenticated
    USING (vendor_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 7c. RLS policy: service role can insert (for functions)
DO $$
BEGIN
  DROP POLICY IF EXISTS "subscription_history_service_insert" ON subscription_history;
  CREATE POLICY "subscription_history_service_insert"
    ON subscription_history FOR INSERT
    TO service_role
    WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 7d. Index for faster queries
CREATE INDEX IF NOT EXISTS idx_subscription_history_vendor_id
  ON subscription_history (vendor_id, created_at DESC);

-- 8. Create function to start free trial (14 days of Pro)
CREATE OR REPLACE FUNCTION public.start_vendor_trial(p_vendor_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    subscription_plan = 'pro',
    subscription_status = 'active',
    subscription_start = NOW(),
    subscription_end = NOW() + INTERVAL '14 days',
    trial_ends_at = NOW() + INTERVAL '14 days'
  WHERE id = p_vendor_id
    AND (subscription_plan = 'free' OR subscription_plan IS NULL)
    AND (trial_ends_at IS NULL OR trial_ends_at < NOW());

  -- Log trial start in history
  INSERT INTO subscription_history (vendor_id, old_plan, new_plan, change_type, reason)
  SELECT
    p_vendor_id,
    COALESCE(subscription_plan, 'free'),
    'pro',
    'upgrade',
    '14-day Pro trial started'
  FROM profiles
  WHERE id = p_vendor_id
    AND trial_ends_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Update handle_subscription_expiration to handle trial expiry
CREATE OR REPLACE FUNCTION public.handle_subscription_expiration()
RETURNS void AS $$
BEGIN
  -- Handle trial expiration: downgrade to free when trial ends
  UPDATE profiles
  SET
    subscription_plan = 'free',
    subscription_status = 'active'
  WHERE
    trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW()
    AND subscription_plan = 'pro'
    AND (subscription_end IS NULL OR subscription_end < NOW())
    AND subscription_status = 'active';

  -- Log trial expirations
  INSERT INTO subscription_history (vendor_id, old_plan, new_plan, change_type, reason)
  SELECT
    id,
    'pro',
    'free',
    'expired',
    '14-day Pro trial ended, downgraded to free'
  FROM profiles
  WHERE
    trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW()
    AND subscription_plan = 'free'
    AND NOT EXISTS (
      SELECT 1 FROM subscription_history
      WHERE vendor_id = profiles.id
        AND change_type = 'expired'
        AND reason LIKE '%trial%'
        AND created_at > NOW() - INTERVAL '1 hour'
    );

  -- Move expired paid subscriptions to grace period (7 days)
  UPDATE profiles
  SET
    subscription_status = 'grace_period',
    grace_period_ends = NOW() + INTERVAL '7 days'
  WHERE
    subscription_status = 'active'
    AND subscription_plan NOT IN ('free')
    AND subscription_end < NOW()
    AND (trial_ends_at IS NULL OR trial_ends_at < NOW())
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

-- 10. Create function to check if vendor is on trial
CREATE OR REPLACE FUNCTION public.is_vendor_on_trial(p_vendor_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_trial_ends TIMESTAMPTZ;
  v_plan TEXT;
BEGIN
  SELECT trial_ends_at, subscription_plan
  INTO v_trial_ends, v_plan
  FROM profiles WHERE id = p_vendor_id;

  RETURN v_trial_ends IS NOT NULL
    AND v_trial_ends > NOW()
    AND v_plan != 'free';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create function to check if vendor has a paid plan (for feature gating)
CREATE OR REPLACE FUNCTION public.is_vendor_paid(p_vendor_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan TEXT;
  v_status TEXT;
  v_trial_ends TIMESTAMPTZ;
  v_grace_ends TIMESTAMPTZ;
BEGIN
  SELECT subscription_plan, subscription_status, trial_ends_at, grace_period_ends
  INTO v_plan, v_status, v_trial_ends, v_grace_ends
  FROM profiles WHERE id = p_vendor_id;

  -- Free plan is never paid
  IF v_plan = 'free' OR v_plan IS NULL THEN
    RETURN false;
  END IF;

  -- Active subscription
  IF v_status = 'active' THEN
    RETURN true;
  END IF;

  -- Active trial (Pro trial)
  IF v_trial_ends IS NOT NULL AND v_trial_ends > NOW() THEN
    RETURN true;
  END IF;

  -- Within grace period (still has paid features)
  IF v_status = 'grace_period' AND v_grace_ends > NOW() THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Create function to check if vendor can use a specific feature
CREATE OR REPLACE FUNCTION public.vendor_has_feature(p_vendor_id UUID, p_required_tier TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan TEXT;
  v_status TEXT;
  v_trial_ends TIMESTAMPTZ;
  v_grace_ends TIMESTAMPTZ;
  v_tier_order INT;
  v_required_order INT;
BEGIN
  SELECT subscription_plan, subscription_status, trial_ends_at, grace_period_ends
  INTO v_plan, v_status, v_trial_ends, v_grace_ends
  FROM profiles WHERE id = p_vendor_id;

  -- Map plan to tier order
  v_tier_order := CASE v_plan
    WHEN 'free' THEN 0
    WHEN 'basic' THEN 1
    WHEN 'pro' THEN 2
    WHEN 'professional' THEN 2
    WHEN 'enterprise' THEN 3
    ELSE 0
  END;

  v_required_order := CASE p_required_tier
    WHEN 'free' THEN 0
    WHEN 'basic' THEN 1
    WHEN 'pro' THEN 2
    WHEN 'enterprise' THEN 3
    ELSE 0
  END;

  -- Check if subscription is active (including trial and grace period)
  IF v_status != 'active'
    AND NOT (v_trial_ends IS NOT NULL AND v_trial_ends > NOW())
    AND NOT (v_status = 'grace_period' AND v_grace_ends > NOW())
  THEN
    -- Inactive subscription: only free tier features
    RETURN v_required_order = 0;
  END IF;

  RETURN v_tier_order >= v_required_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Grant execute on new functions
GRANT EXECUTE ON FUNCTION public.start_vendor_trial(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_subscription_expiration() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_vendor_on_trial(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vendor_paid(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_has_feature(UUID, TEXT) TO authenticated;

-- 13b. Recreate public_vendor_profiles view to include subscription + is_paid_vendor flag
--     Preserves ALL existing columns and adds new ones
CREATE OR REPLACE VIEW public_vendor_profiles AS
SELECT
  p.id,
  p.role,
  p.first_name,
  p.last_name,
  p.store_name,
  p.store_description,
  p.store_type,
  p.bio,
  p.avatar_url,
  p.city,
  p.country,
  p.rating,
  p.is_verified,
  p.is_approved,
  p.operating_hours,
  p.active_products_count,
  p.delivery_option,
  p.has_own_driver,
  p.min_order_amount,
  p.min_delivery_distance_km,
  p.max_delivery_distance_km,
  p.is_available_for_delivery,
  p.vehicle_type,
  p.accepted_cargo_sizes,
  p.latitude,
  p.longitude,
  p.created_at,
  -- New subscription columns
  p.subscription_plan,
  p.subscription_status,
  p.trial_ends_at,
  -- A vendor is "paid" if they have an active paid plan OR active trial OR in grace period
  (
    p.subscription_plan IS NOT NULL
    AND p.subscription_plan != 'free'
    AND (
      p.subscription_status = 'active'
      OR (p.trial_ends_at IS NOT NULL AND p.trial_ends_at > NOW())
      OR (p.subscription_status = 'grace_period' AND p.grace_period_ends IS NOT NULL AND p.grace_period_ends > NOW())
    )
  ) AS is_paid_vendor
FROM profiles p
WHERE p.role = ANY (ARRAY['vendor'::user_role, 'driver'::user_role]);

-- Ensure the view is accessible
GRANT SELECT ON public_vendor_profiles TO authenticated;
GRANT SELECT ON public_vendor_profiles TO anon;

-- 14. Notify success
DO $$
BEGIN
  RAISE NOTICE 'Subscription plans updated with new pricing!';
  RAISE NOTICE '   - New plans: free (15 products, 5%%), basic (149 MAD, 75 products, 3%%), pro (299 MAD, unlimited, 2%%), enterprise (599 MAD, unlimited, 1%%)';
  RAISE NOTICE '   - trial_ends_at column added (14-day Pro trial)';
  RAISE NOTICE '   - paypal_subscription_id column added';
  RAISE NOTICE '   - subscription_plans table created with paypal_plan_id columns';
  RAISE NOTICE '   - subscription_history table created';
  RAISE NOTICE '   - start_vendor_trial() function created';
  RAISE NOTICE '   - is_vendor_on_trial() function created';
  RAISE NOTICE '   - is_vendor_paid() function created';
  RAISE NOTICE '   - vendor_has_feature() function created (feature gating)';
  RAISE NOTICE '   - handle_subscription_expiration() updated to handle trial expiry';
  RAISE NOTICE '   - public_vendor_profiles view updated with is_paid_vendor flag';
END $$;
