BEGIN;

-- =====================================================
-- Qotoof critical compatibility migration
-- Safe to rerun on existing environments.
-- =====================================================

-- =====================================
-- 1. Store and onboarding state
-- =====================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS store_paused BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS store_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS store_paused_reason TEXT,
  ADD COLUMN IF NOT EXISTS store_resume_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_active_products UUID[];

UPDATE profiles
SET
  store_paused = COALESCE(store_paused, FALSE),
  onboarding_completed = COALESCE(onboarding_completed, FALSE),
  onboarding_step = COALESCE(onboarding_step, 0),
  phone_verified = COALESCE(phone_verified, FALSE)
WHERE store_paused IS NULL
   OR onboarding_completed IS NULL
   OR onboarding_step IS NULL
   OR phone_verified IS NULL;

-- =====================================
-- 2. Phone OTP
-- =====================================
CREATE TABLE IF NOT EXISTS phone_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  purpose VARCHAR NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE phone_otp
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS otp_code TEXT,
  ADD COLUMN IF NOT EXISTS purpose VARCHAR,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE phone_otp
SET
  used = COALESCE(used, FALSE),
  attempts = COALESCE(attempts, 0),
  created_at = COALESCE(created_at, NOW())
WHERE used IS NULL
   OR attempts IS NULL
   OR created_at IS NULL;

-- =====================================
-- 3. Refund policy
-- =====================================
CREATE TABLE IF NOT EXISTS refund_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  allows_refund BOOLEAN DEFAULT FALSE,
  refund_window_hours INTEGER DEFAULT 0,
  refund_conditions TEXT,
  no_refund_reason TEXT DEFAULT 'المنتجات الزراعية الطازة لا يمكن إرجاعها بسبب طبيعتها القابلة للتلف',
  who_pays_return VARCHAR DEFAULT 'buyer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id)
);

ALTER TABLE refund_policies
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS allows_refund BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS refund_window_hours INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_conditions TEXT,
  ADD COLUMN IF NOT EXISTS no_refund_reason TEXT DEFAULT 'المنتجات الزراعية الطازة لا يمكن إرجاعها بسبب طبيعتها القابلة للتلف',
  ADD COLUMN IF NOT EXISTS who_pays_return VARCHAR DEFAULT 'buyer',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE refund_policies
SET
  allows_refund = COALESCE(allows_refund, FALSE),
  refund_window_hours = COALESCE(refund_window_hours, 0),
  no_refund_reason = COALESCE(no_refund_reason, 'المنتجات الزراعية الطازة لا يمكن إرجاعها بسبب طبيعتها القابلة للتلف'),
  who_pays_return = COALESCE(who_pays_return, 'buyer'),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE allows_refund IS NULL
   OR refund_window_hours IS NULL
   OR no_refund_reason IS NULL
   OR who_pays_return IS NULL
   OR created_at IS NULL
   OR updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_refund_policies_vendor_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT vendor_id
      FROM refund_policies
      WHERE vendor_id IS NOT NULL
      GROUP BY vendor_id
      HAVING COUNT(*) > 1
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX idx_refund_policies_vendor_unique ON refund_policies(vendor_id) WHERE vendor_id IS NOT NULL';
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_refund_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refund_policies_updated_at ON refund_policies;
CREATE TRIGGER trg_refund_policies_updated_at
BEFORE UPDATE ON refund_policies
FOR EACH ROW EXECUTE FUNCTION public.set_refund_policies_updated_at();

-- =====================================
-- 4. Customer support
-- =====================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  order_id UUID REFERENCES orders(id),
  category VARCHAR NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  attachments TEXT[],
  status VARCHAR DEFAULT 'open',
  priority VARCHAR DEFAULT 'normal',
  admin_response TEXT,
  responded_by UUID REFERENCES profiles(id),
  responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  rating INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id),
  ADD COLUMN IF NOT EXISTS category VARCHAR,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS attachments TEXT[],
  ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS priority VARCHAR DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS admin_response TEXT,
  ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rating INTEGER,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE support_tickets
SET
  status = COALESCE(status, 'open'),
  priority = COALESCE(priority, 'normal'),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE status IS NULL
   OR priority IS NULL
   OR created_at IS NULL
   OR updated_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
BEFORE UPDATE ON support_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_support_tickets_updated_at();

-- =====================================
-- 5. User activity and devices
-- =====================================
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action VARCHAR NOT NULL,
  ip_address TEXT,
  device_info TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_activity_log
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS action VARCHAR,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS device_info TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE user_activity_log
SET created_at = COALESCE(created_at, NOW())
WHERE created_at IS NULL;

CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  device_info TEXT,
  ip_address TEXT,
  location TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE active_sessions
  ADD COLUMN IF NOT EXISTS device_info TEXT,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE active_sessions
SET
  last_active = COALESCE(last_active, NOW()),
  created_at = COALESCE(created_at, NOW())
WHERE last_active IS NULL
   OR created_at IS NULL;

-- =====================================
-- 6. Indexes and RLS
-- =====================================
CREATE INDEX IF NOT EXISTS idx_phone_otp_user
  ON phone_otp(user_id, purpose, expires_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user
  ON support_tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_user_activity_user
  ON user_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user
  ON active_sessions(user_id);

ALTER TABLE phone_otp ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_phone_otp ON phone_otp;
CREATE POLICY own_phone_otp
  ON phone_otp FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS vendor_own_refund_policy ON refund_policies;
CREATE POLICY vendor_own_refund_policy
  ON refund_policies FOR ALL
  TO authenticated
  USING (
    vendor_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    vendor_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS public_refund_policy_read ON refund_policies;
CREATE POLICY public_refund_policy_read
  ON refund_policies FOR SELECT
  TO authenticated, anon
  USING (TRUE);

DROP POLICY IF EXISTS own_support_tickets ON support_tickets;
CREATE POLICY own_support_tickets
  ON support_tickets FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS own_activity_log ON user_activity_log;
CREATE POLICY own_activity_log
  ON user_activity_log FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS own_sessions ON active_sessions;
CREATE POLICY own_sessions
  ON active_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;