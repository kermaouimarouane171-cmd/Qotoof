BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(10, 2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS referral_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{}'::jsonb;

UPDATE profiles
SET
  low_stock_threshold = COALESCE(low_stock_threshold, 10),
  min_order_amount = COALESCE(min_order_amount, 0),
  business_hours = COALESCE(business_hours, '{}'::jsonb)
WHERE low_stock_threshold IS NULL
   OR min_order_amount IS NULL
   OR business_hours IS NULL;

UPDATE profiles
SET referral_code = UPPER(SUBSTRING(MD5(id::text) FROM 1 FOR 8))
WHERE referral_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code_unique
  ON profiles(referral_code)
  WHERE referral_code IS NOT NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN,
  ADD COLUMN IF NOT EXISTS stock_alert_threshold NUMERIC(10, 2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS waitlist_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_stock_alert_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_restocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sold NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS search_document TSVECTOR;

UPDATE products
SET
  stock_quantity = COALESCE(stock_quantity, available_quantity, 0),
  is_active = COALESCE(is_active, is_available, TRUE),
  stock_alert_threshold = COALESCE(stock_alert_threshold, 10),
  waitlist_count = COALESCE(waitlist_count, 0),
  average_rating = COALESCE(average_rating, 0),
  reviews_count = COALESCE(reviews_count, 0),
  total_sold = COALESCE(total_sold, 0)
WHERE stock_quantity IS NULL
   OR is_active IS NULL
   OR stock_alert_threshold IS NULL
   OR waitlist_count IS NULL
   OR average_rating IS NULL
   OR reviews_count IS NULL
   OR total_sold IS NULL;

CREATE TABLE IF NOT EXISTS vendor_cancellation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  allow_cancellation BOOLEAN NOT NULL DEFAULT TRUE,
  free_cancellation_window_minutes INTEGER NOT NULL DEFAULT 120,
  cutoff_status TEXT NOT NULL DEFAULT 'vendor_accepted',
  cancellation_fee_type TEXT NOT NULL DEFAULT 'fixed' CHECK (cancellation_fee_type IN ('none', 'fixed', 'percentage')),
  cancellation_fee_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  refund_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100 CHECK (refund_percentage >= 0 AND refund_percentage <= 100),
  auto_approve_before_preparing BOOLEAN NOT NULL DEFAULT TRUE,
  policy_text_ar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_delivery_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  slot_label TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  cutoff_hours INTEGER NOT NULL DEFAULT 2,
  max_orders INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_vendor_delivery_slot UNIQUE (vendor_id, day_of_week, start_time, end_time),
  CONSTRAINT chk_vendor_delivery_slot_window CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS product_waitlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
  note TEXT,
  notify_in_app BOOLEAN NOT NULL DEFAULT TRUE,
  notify_sms BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'notified', 'fulfilled', 'cancelled')),
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS action_label TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE notifications
SET
  read_at = CASE
    WHEN COALESCE(is_read, FALSE) = TRUE AND read_at IS NULL THEN COALESCE(created_at, NOW())
    ELSE read_at
  END,
  is_read = CASE
    WHEN read_at IS NOT NULL THEN TRUE
    ELSE COALESCE(is_read, FALSE)
  END,
  category = COALESCE(category, 'general'),
  channel = COALESCE(channel, 'in_app'),
  priority = COALESCE(priority, 'normal')
WHERE read_at IS NULL
   OR is_read IS NULL
   OR category IS NULL
   OR channel IS NULL
   OR priority IS NULL;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  order_updates BOOLEAN NOT NULL DEFAULT TRUE,
  payment_updates BOOLEAN NOT NULL DEFAULT TRUE,
  promotional_updates BOOLEAN NOT NULL DEFAULT TRUE,
  review_updates BOOLEAN NOT NULL DEFAULT TRUE,
  loyalty_updates BOOLEAN NOT NULL DEFAULT TRUE,
  inventory_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  delivery_updates BOOLEAN NOT NULL DEFAULT TRUE,
  system_updates BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO notification_preferences (user_id)
SELECT id
FROM profiles
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vendor_reply TEXT,
  ADD COLUMN IF NOT EXISTS vendor_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE reviews
SET user_id = COALESCE(user_id, buyer_id)
WHERE user_id IS NULL;

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS minimum_quantity NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS applies_to TEXT NOT NULL DEFAULT 'order',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE coupons
SET
  expires_at = COALESCE(expires_at, valid_until),
  starts_at = COALESCE(starts_at, valid_from, created_at),
  applies_to = COALESCE(applies_to, 'order'),
  metadata = COALESCE(metadata, '{}'::jsonb)
WHERE expires_at IS NULL
   OR starts_at IS NULL
   OR applies_to IS NULL
   OR metadata IS NULL;

ALTER TABLE coupon_redemptions
  ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE coupon_redemptions AS redemptions
SET
  redeemed_at = COALESCE(redemptions.redeemed_at, redemptions.created_at, NOW()),
  vendor_id = COALESCE(redemptions.vendor_id, coupons.vendor_id),
  metadata = COALESCE(redemptions.metadata, '{}'::jsonb)
FROM coupons
WHERE coupons.id = redemptions.coupon_id
  AND (
    redemptions.redeemed_at IS NULL
    OR redemptions.vendor_id IS NULL
    OR redemptions.metadata IS NULL
  );

ALTER TABLE loyalty_points
  ADD COLUMN IF NOT EXISTS lifetime_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'Bronze',
  ADD COLUMN IF NOT EXISTS last_earned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_bonus_earned INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'loyalty_points'
      AND column_name = 'level'
  ) THEN
    EXECUTE $sql$
      UPDATE loyalty_points
      SET
        lifetime_points = COALESCE(lifetime_points, points, 0),
        tier = COALESCE(
          tier,
          CASE LOWER(COALESCE(level, 'bronze'))
            WHEN 'silver' THEN 'Silver'
            WHEN 'gold' THEN 'Gold'
            WHEN 'platinum' THEN 'Platinum'
            ELSE 'Bronze'
          END
        )
      WHERE lifetime_points IS NULL
         OR tier IS NULL
    $sql$;
  ELSE
    UPDATE loyalty_points
    SET
      lifetime_points = COALESCE(lifetime_points, points, 0),
      tier = COALESCE(
        tier,
        CASE
          WHEN COALESCE(points, 0) >= 5000 THEN 'Platinum'
          WHEN COALESCE(points, 0) >= 2000 THEN 'Gold'
          WHEN COALESCE(points, 0) >= 500 THEN 'Silver'
          ELSE 'Bronze'
        END
      )
    WHERE lifetime_points IS NULL
       OR tier IS NULL;
  END IF;
END $$;

ALTER TABLE loyalty_transactions
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS balance_after INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('points_discount', 'free_shipping', 'coupon')),
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  reward_value NUMERIC(12, 2),
  coupon_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 100,
  reward_status TEXT NOT NULL DEFAULT 'pending' CHECK (reward_status IN ('pending', 'earned', 'cancelled')),
  first_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  first_order_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referrer_id, referred_user_id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL DEFAULT 'MAD',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  shipping_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fees_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'paid', 'cancelled')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pdf_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bulk_discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_coupon_id UUID REFERENCES coupons(id),
  ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS requested_delivery_slot_id UUID,
  ADD COLUMN IF NOT EXISTS requested_delivery_slot_label TEXT,
  ADD COLUMN IF NOT EXISTS delivery_schedule_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS minimum_order_amount_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_order_shortfall NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS buyer_cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_policy_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS invoice_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_requested_delivery_slot_id_fkey'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_requested_delivery_slot_id_fkey
      FOREIGN KEY (requested_delivery_slot_id)
      REFERENCES vendor_delivery_slots(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_search_document
  ON products USING GIN (search_document);
CREATE INDEX IF NOT EXISTS idx_products_waitlist_active
  ON products(vendor_id, waitlist_enabled, stock_quantity);
CREATE INDEX IF NOT EXISTS idx_product_waitlists_product_status
  ON product_waitlists(product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_waitlists_user_status
  ON product_waitlists(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_cancellation_policies_vendor
  ON vendor_cancellation_policies(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_delivery_slots_vendor_day
  ON vendor_delivery_slots(vendor_id, day_of_week, is_active);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
  ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at
  ON notifications(user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category
  ON notifications(user_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_product_active
  ON reviews(product_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_vendor_flagged
  ON reviews(vendor_id, is_flagged, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique_order_product_buyer
  ON reviews(order_id, product_id, buyer_id)
  WHERE deleted_at IS NULL AND product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coupons_expires_at
  ON coupons(expires_at)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_vendor_redeemed_at
  ON coupon_redemptions(vendor_id, redeemed_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_order_id
  ON loyalty_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status
  ON referrals(referrer_id, reward_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor_issued_at
  ON invoices(vendor_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_buyer_issued_at
  ON invoices(buyer_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_analytics
  ON orders(vendor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_requested_delivery_date
  ON orders(vendor_id, requested_delivery_date, requested_delivery_slot_id);

CREATE OR REPLACE FUNCTION public.handle_missing_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sync_notification_read_state()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.read_at IS NOT NULL THEN
    NEW.is_read = TRUE;
  ELSIF COALESCE(NEW.is_read, FALSE) = TRUE THEN
    NEW.read_at = COALESCE(NEW.read_at, NOW());
  ELSE
    NEW.is_read = FALSE;
    NEW.read_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_product_search_document()
RETURNS TRIGGER AS $$
DECLARE
  vendor_name TEXT;
BEGIN
  SELECT COALESCE(store_name, CONCAT_WS(' ', first_name, last_name), '')
  INTO vendor_name
  FROM profiles
  WHERE id = NEW.vendor_id;

  NEW.search_document := to_tsvector(
    'simple',
    CONCAT_WS(
      ' ',
      COALESCE(NEW.name, ''),
      COALESCE(NEW.description, ''),
      COALESCE(NEW.category::text, ''),
      COALESCE(NEW.subcategory, ''),
      COALESCE(vendor_name, '')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.refresh_single_product_waitlist_count(p_product_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE products
  SET waitlist_count = COALESCE(
    (
      SELECT COUNT(*)
      FROM product_waitlists
      WHERE product_id = p_product_id
        AND status = 'active'
    ),
    0
  )
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.refresh_product_waitlist_count()
RETURNS TRIGGER AS $$
DECLARE
  target_product_id UUID;
BEGIN
  target_product_id := COALESCE(NEW.product_id, OLD.product_id);
  PERFORM public.refresh_single_product_waitlist_count(target_product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.refresh_single_product_review_stats(p_product_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE products
  SET
    average_rating = COALESCE(
      (
        SELECT ROUND(AVG(rating)::numeric, 2)
        FROM reviews
        WHERE product_id = p_product_id
          AND deleted_at IS NULL
      ),
      0
    ),
    reviews_count = COALESCE(
      (
        SELECT COUNT(*)
        FROM reviews
        WHERE product_id = p_product_id
          AND deleted_at IS NULL
      ),
      0
    )
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.refresh_product_review_stats()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.refresh_single_product_review_stats(COALESCE(NEW.product_id, OLD.product_id));

  IF TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    PERFORM public.refresh_single_product_review_stats(OLD.product_id);
    PERFORM public.refresh_single_product_review_stats(NEW.product_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_order_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(p_order_id::text, '-', '') FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.assign_invoice_number_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR BTRIM(NEW.invoice_number) = '' THEN
    NEW.invoice_number = public.generate_invoice_number(NEW.order_id);
  END IF;

  NEW.updated_at = NOW();
  NEW.issued_at = COALESCE(NEW.issued_at, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.create_user_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'system',
  p_category TEXT DEFAULT 'general',
  p_data JSONB DEFAULT '{}'::jsonb,
  p_channel TEXT DEFAULT 'in_app',
  p_priority TEXT DEFAULT 'normal',
  p_action_url TEXT DEFAULT NULL,
  p_action_label TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  preferences_row notification_preferences%ROWTYPE;
  should_deliver BOOLEAN := TRUE;
  inserted_id UUID;
BEGIN
  SELECT *
  INTO preferences_row
  FROM notification_preferences
  WHERE user_id = p_user_id;

  IF FOUND THEN
    should_deliver := COALESCE(preferences_row.in_app_enabled, TRUE);

    should_deliver := should_deliver AND CASE p_category
      WHEN 'order_update' THEN COALESCE(preferences_row.order_updates, TRUE)
      WHEN 'payment' THEN COALESCE(preferences_row.payment_updates, TRUE)
      WHEN 'promotion' THEN COALESCE(preferences_row.promotional_updates, TRUE)
      WHEN 'review' THEN COALESCE(preferences_row.review_updates, TRUE)
      WHEN 'loyalty' THEN COALESCE(preferences_row.loyalty_updates, TRUE)
      WHEN 'inventory' THEN COALESCE(preferences_row.inventory_alerts, TRUE)
      WHEN 'delivery' THEN COALESCE(preferences_row.delivery_updates, TRUE)
      ELSE COALESCE(preferences_row.system_updates, TRUE)
    END;
  END IF;

  IF NOT should_deliver THEN
    RETURN NULL;
  END IF;

  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    category,
    channel,
    priority,
    data,
    action_url,
    action_label,
    is_read,
    read_at
  )
  VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_category,
    p_channel,
    p_priority,
    COALESCE(p_data, '{}'::jsonb),
    p_action_url,
    p_action_label,
    FALSE,
    NULL
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notifications_sync_read_state ON notifications;
CREATE TRIGGER trg_notifications_sync_read_state
  BEFORE INSERT OR UPDATE OF is_read, read_at ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_notification_read_state();

DROP TRIGGER IF EXISTS trg_products_search_document ON products;
CREATE TRIGGER trg_products_search_document
  BEFORE INSERT OR UPDATE OF name, description, category, subcategory, vendor_id ON products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_search_document();

DROP TRIGGER IF EXISTS trg_product_waitlists_refresh_count ON product_waitlists;
CREATE TRIGGER trg_product_waitlists_refresh_count
  AFTER INSERT OR UPDATE OR DELETE ON product_waitlists
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_product_waitlist_count();

DROP TRIGGER IF EXISTS trg_reviews_refresh_product_stats ON reviews;
CREATE TRIGGER trg_reviews_refresh_product_stats
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_product_review_stats();

DROP TRIGGER IF EXISTS trg_vendor_cancellation_policies_updated_at ON vendor_cancellation_policies;
CREATE TRIGGER trg_vendor_cancellation_policies_updated_at
  BEFORE UPDATE ON vendor_cancellation_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_missing_features_updated_at();

DROP TRIGGER IF EXISTS trg_vendor_delivery_slots_updated_at ON vendor_delivery_slots;
CREATE TRIGGER trg_vendor_delivery_slots_updated_at
  BEFORE UPDATE ON vendor_delivery_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_missing_features_updated_at();

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_missing_features_updated_at();

DROP TRIGGER IF EXISTS trg_loyalty_rewards_updated_at ON loyalty_rewards;
CREATE TRIGGER trg_loyalty_rewards_updated_at
  BEFORE UPDATE ON loyalty_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_missing_features_updated_at();

DROP TRIGGER IF EXISTS trg_referrals_updated_at ON referrals;
CREATE TRIGGER trg_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_missing_features_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_defaults ON invoices;
CREATE TRIGGER trg_invoices_defaults
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_invoice_number_defaults();

UPDATE products AS product
SET search_document = to_tsvector(
  'simple',
  CONCAT_WS(
    ' ',
    COALESCE(product.name, ''),
    COALESCE(product.description, ''),
    COALESCE(product.category::text, ''),
    COALESCE(product.subcategory, ''),
    COALESCE(profile.store_name, CONCAT_WS(' ', profile.first_name, profile.last_name), '')
  )
)
FROM profiles AS profile
WHERE profile.id = product.vendor_id;

SELECT public.refresh_single_product_waitlist_count(id)
FROM products;

SELECT public.refresh_single_product_review_stats(id)
FROM products;

ALTER TABLE vendor_cancellation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_delivery_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_waitlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_cancellation_policies_public_read ON vendor_cancellation_policies;
CREATE POLICY vendor_cancellation_policies_public_read
  ON vendor_cancellation_policies FOR SELECT
  TO public
  USING (TRUE);

DROP POLICY IF EXISTS vendor_cancellation_policies_vendor_manage ON vendor_cancellation_policies;
CREATE POLICY vendor_cancellation_policies_vendor_manage
  ON vendor_cancellation_policies FOR ALL
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

DROP POLICY IF EXISTS vendor_delivery_slots_public_read ON vendor_delivery_slots;
CREATE POLICY vendor_delivery_slots_public_read
  ON vendor_delivery_slots FOR SELECT
  TO public
  USING (TRUE);

DROP POLICY IF EXISTS vendor_delivery_slots_vendor_manage ON vendor_delivery_slots;
CREATE POLICY vendor_delivery_slots_vendor_manage
  ON vendor_delivery_slots FOR ALL
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

DROP POLICY IF EXISTS product_waitlists_user_manage ON product_waitlists;
CREATE POLICY product_waitlists_user_manage
  ON product_waitlists FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS product_waitlists_vendor_view ON product_waitlists;
CREATE POLICY product_waitlists_vendor_view
  ON product_waitlists FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM products
      WHERE products.id = product_waitlists.product_id
        AND products.vendor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS product_waitlists_admin_view ON product_waitlists;
CREATE POLICY product_waitlists_admin_view
  ON product_waitlists FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS notification_preferences_user_manage ON notification_preferences;
CREATE POLICY notification_preferences_user_manage
  ON notification_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS referrals_participants_view ON referrals;
CREATE POLICY referrals_participants_view
  ON referrals FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid() OR referred_user_id = auth.uid());

DROP POLICY IF EXISTS referrals_referrer_insert ON referrals;
CREATE POLICY referrals_referrer_insert
  ON referrals FOR INSERT
  TO authenticated
  WITH CHECK (referrer_id = auth.uid());

DROP POLICY IF EXISTS referrals_participants_update ON referrals;
CREATE POLICY referrals_participants_update
  ON referrals FOR UPDATE
  TO authenticated
  USING (referrer_id = auth.uid() OR referred_user_id = auth.uid())
  WITH CHECK (referrer_id = auth.uid() OR referred_user_id = auth.uid());

DROP POLICY IF EXISTS loyalty_rewards_public_read ON loyalty_rewards;
CREATE POLICY loyalty_rewards_public_read
  ON loyalty_rewards FOR SELECT
  TO public
  USING (is_active = TRUE);

DROP POLICY IF EXISTS loyalty_rewards_admin_manage ON loyalty_rewards;
CREATE POLICY loyalty_rewards_admin_manage
  ON loyalty_rewards FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS invoices_order_parties_view ON invoices;
CREATE POLICY invoices_order_parties_view
  ON invoices FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid() OR vendor_id = auth.uid());

DROP POLICY IF EXISTS invoices_admin_view ON invoices;
CREATE POLICY invoices_admin_view
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS invoices_vendor_insert ON invoices;
CREATE POLICY invoices_vendor_insert
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (vendor_id = auth.uid());

DROP POLICY IF EXISTS invoices_vendor_update ON invoices;
CREATE POLICY invoices_vendor_update
  ON invoices FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

COMMIT;