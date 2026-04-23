BEGIN;

-- ===============================================================
-- Qotoof Marketplace - Payment policy, trust score, and disputes
-- Safe to re-run.
-- ===============================================================

-- ══════════════════════════════
-- 1. Vendor payment policy
-- ══════════════════════════════
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_policy_full BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS payment_policy_split BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_policy_cod BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_policy_updated_at TIMESTAMPTZ;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS completed_orders_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_payments_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_eligible BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cod_restricted_until TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_vendor_payment_policy_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_vendor_payment_policy_check
      CHECK (
        role IS DISTINCT FROM 'vendor'
        OR payment_policy_full = TRUE
        OR payment_policy_split = TRUE
        OR payment_policy_cod = TRUE
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_vendor_payment_policy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_policy_full IS DISTINCT FROM OLD.payment_policy_full
     OR NEW.payment_policy_split IS DISTINCT FROM OLD.payment_policy_split
     OR NEW.payment_policy_cod IS DISTINCT FROM OLD.payment_policy_cod THEN
    NEW.payment_policy_updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_vendor_payment_policy_updated_at ON profiles;
CREATE TRIGGER trg_touch_vendor_payment_policy_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.touch_vendor_payment_policy_updated_at();

-- ══════════════════════════════
-- 2. Per-order payment ledger
-- ══════════════════════════════
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_type VARCHAR DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS first_payment_amount DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_payment_status VARCHAR DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS first_payment_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_payment_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS second_payment_amount DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS second_payment_status VARCHAR DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS second_payment_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS second_payment_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS second_payment_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_verified_by_vendor BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_disputed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_dispute_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_dispute_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_payment_type_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_payment_type_check
      CHECK (payment_type IN ('full', 'split', 'cod'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_first_payment_status_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_first_payment_status_check
      CHECK (first_payment_status IN ('pending', 'paid', 'verified'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_second_payment_status_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_second_payment_status_check
      CHECK (second_payment_status IN ('pending', 'paid', 'verified'));
  END IF;
END $$;

-- ══════════════════════════════
-- 3. Payment disputes
-- ══════════════════════════════
CREATE TABLE IF NOT EXISTS payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  vendor_id UUID REFERENCES profiles(id),
  buyer_id UUID REFERENCES profiles(id),
  dispute_type VARCHAR NOT NULL,
  description TEXT NOT NULL,
  evidence_urls TEXT[],
  status VARCHAR DEFAULT 'open',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution TEXT,
  buyer_data_released BOOLEAN DEFAULT FALSE,
  legal_action_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_disputes_status_check'
  ) THEN
    ALTER TABLE payment_disputes
      ADD CONSTRAINT payment_disputes_status_check
      CHECK (status IN ('open', 'under_review', 'resolved_vendor', 'resolved_buyer', 'closed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_disputes_type_check'
  ) THEN
    ALTER TABLE payment_disputes
      ADD CONSTRAINT payment_disputes_type_check
      CHECK (dispute_type IN ('not_paid', 'not_delivered', 'wrong_amount'));
  END IF;
END $$;

-- ══════════════════════════════
-- 4. Payment terms acceptance log
-- ══════════════════════════════
CREATE TABLE IF NOT EXISTS payment_terms_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  order_id UUID REFERENCES orders(id),
  payment_type VARCHAR NOT NULL,
  terms_version VARCHAR DEFAULT 'v1.0',
  accepted_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  warning_shown BOOLEAN DEFAULT TRUE
);

-- ══════════════════════════════
-- 5. Trust score function
-- ══════════════════════════════
CREATE OR REPLACE FUNCTION public.update_trust_score(
  p_user_id UUID,
  p_change INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET trust_score = GREATEST(0, LEAST(100, COALESCE(trust_score, 100) + p_change))
  WHERE id = p_user_id;

  UPDATE profiles
  SET cod_eligible = (
    COALESCE(completed_orders_count, 0) >= 3
    AND COALESCE(trust_score, 100) >= 70
    AND (cod_restricted_until IS NULL OR cod_restricted_until <= now())
  )
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════
-- 6. Indexes & RLS
-- ══════════════════════════════
CREATE INDEX IF NOT EXISTS idx_profiles_cod_eligibility
  ON profiles(cod_eligible, completed_orders_count, trust_score);
CREATE INDEX IF NOT EXISTS idx_profiles_cod_restricted_until
  ON profiles(cod_restricted_until);
CREATE INDEX IF NOT EXISTS idx_orders_payment_type
  ON orders(payment_type);
CREATE INDEX IF NOT EXISTS idx_orders_first_payment_status
  ON orders(first_payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_second_payment_status
  ON orders(second_payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_disputed
  ON orders(payment_disputed, payment_dispute_opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_order
  ON payment_disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_status
  ON payment_disputes(status);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_vendor
  ON payment_disputes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_buyer
  ON payment_disputes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_payment_terms_user
  ON payment_terms_acceptance(user_id, order_id);

ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_terms_acceptance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dispute_parties_access" ON payment_disputes;
CREATE POLICY "dispute_parties_access"
  ON payment_disputes FOR ALL
  USING (
    vendor_id = auth.uid()
    OR buyer_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    vendor_id = auth.uid()
    OR buyer_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "own_payment_terms" ON payment_terms_acceptance;
CREATE POLICY "own_payment_terms"
  ON payment_terms_acceptance FOR ALL
  USING (
    user_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

COMMIT;