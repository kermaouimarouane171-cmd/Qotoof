BEGIN;

DROP POLICY IF EXISTS "Coupons viewable by everyone" ON coupons;
DROP POLICY IF EXISTS coupons_public_or_assigned_view ON coupons;
CREATE POLICY coupons_public_or_assigned_view
  ON coupons FOR SELECT
  USING (
    COALESCE(metadata->>'assigned_user_id', '') = ''
    OR COALESCE(metadata->>'assigned_user_id', '') = COALESCE(auth.uid()::text, '')
  );

DROP POLICY IF EXISTS coupons_assigned_user_manage ON coupons;
CREATE POLICY coupons_assigned_user_manage
  ON coupons FOR ALL
  TO authenticated
  USING (
    vendor_id IS NULL
    AND COALESCE(metadata->>'source', '') = 'loyalty_reward'
    AND COALESCE(metadata->>'assigned_user_id', '') = auth.uid()::text
  )
  WITH CHECK (
    vendor_id IS NULL
    AND COALESCE(metadata->>'source', '') = 'loyalty_reward'
    AND COALESCE(metadata->>'assigned_user_id', '') = auth.uid()::text
  );

DROP POLICY IF EXISTS loyalty_points_user_insert ON loyalty_points;
CREATE POLICY loyalty_points_user_insert
  ON loyalty_points FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS loyalty_transactions_user_insert ON loyalty_transactions;
CREATE POLICY loyalty_transactions_user_insert
  ON loyalty_transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS referrals_referred_user_insert ON referrals;
CREATE POLICY referrals_referred_user_insert
  ON referrals FOR INSERT
  TO authenticated
  WITH CHECK (
    referred_user_id = auth.uid()
    AND referrer_id IS NOT NULL
    AND referrer_id <> auth.uid()
  );

INSERT INTO loyalty_rewards (title, description, reward_type, points_cost, reward_value, is_active)
SELECT 'قسيمة خصم 25 درهم', 'حوّل 250 نقطة إلى كوبون خصم شخصي بقيمة 25 درهم.', 'coupon', 250, 25, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM loyalty_rewards WHERE title = 'قسيمة خصم 25 درهم'
);

INSERT INTO loyalty_rewards (title, description, reward_type, points_cost, reward_value, is_active)
SELECT 'قسيمة خصم 50 درهم', 'حوّل 450 نقطة إلى كوبون خصم شخصي بقيمة 50 درهم.', 'coupon', 450, 50, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM loyalty_rewards WHERE title = 'قسيمة خصم 50 درهم'
);

INSERT INTO loyalty_rewards (title, description, reward_type, points_cost, reward_value, is_active)
SELECT 'قسيمة خصم 80 درهم', 'حوّل 700 نقطة إلى كوبون خصم شخصي بقيمة 80 درهم.', 'coupon', 700, 80, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM loyalty_rewards WHERE title = 'قسيمة خصم 80 درهم'
);

COMMIT;