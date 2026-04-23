-- ===============================================================
-- Qotoof Marketplace - Commission System Migration (3%)
-- الهدف: إضافة نظام العمولات الشهرية + العقود الرقمية + سياسات الإخفاء
-- آمن لإعادة التشغيل (IF NOT EXISTS / DROP POLICY IF EXISTS)
-- ===============================================================

-- ---------------------------------------------------------------
-- 0) تجهيز أعمدة إضافية مطلوبة في profiles + orders
-- ---------------------------------------------------------------

-- إضافة أعمدة موافقة العقد في ملف البائع.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS agreement_accepted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS agreement_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- إضافة أعمدة توثيق استلام الدفع في الطلب.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_received_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS actual_sale_amount DECIMAL(12,2);

-- إضافة حالة payment_received في ENUM إذا كان نوع order_status موجوداً.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'order_status'
  ) THEN
    BEGIN
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'payment_received';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- 1) سجل المبيعات الشهرية لكل بائع
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendor_monthly_sales (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  month             INTEGER NOT NULL,
  year              INTEGER NOT NULL,
  total_sales       DECIMAL(12,2) DEFAULT 0,
  commission_rate   DECIMAL(5,4) DEFAULT 0.03,
  commission_due    DECIMAL(12,2) DEFAULT 0,
  commission_paid   DECIMAL(12,2) DEFAULT 0,
  status            VARCHAR DEFAULT 'active',
  due_date          TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  payment_method    VARCHAR,
  payment_reference TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vendor_id, month, year)
);

-- ---------------------------------------------------------------
-- 2) سجل كل معاملة مؤكدة داخل التطبيق
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS confirmed_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID REFERENCES orders(id),
  vendor_id         UUID REFERENCES profiles(id),
  buyer_id          UUID REFERENCES profiles(id),
  sale_amount       DECIMAL(12,2) NOT NULL,
  commission_amount DECIMAL(12,2),
  month             INTEGER NOT NULL,
  year              INTEGER NOT NULL,
  confirmed_at      TIMESTAMPTZ DEFAULT now(),
  monthly_sale_id   UUID REFERENCES vendor_monthly_sales(id)
);

-- ---------------------------------------------------------------
-- 3) وثيقة العقد الرقمي للبائع
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendor_contracts (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id                     UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  full_name                     TEXT NOT NULL,
  cin                           TEXT NOT NULL,
  phone                         TEXT NOT NULL,
  email                         TEXT NOT NULL,
  bank_name                     TEXT NOT NULL,
  bank_iban                     TEXT NOT NULL,
  bank_account_holder           TEXT NOT NULL,
  agreed_commission_rate        DECIMAL(5,4) DEFAULT 0.03,
  agreed_payment_deadline       INTEGER DEFAULT 7,
  agreed_account_freeze         BOOLEAN DEFAULT TRUE,
  agreed_debt_survives_deletion BOOLEAN DEFAULT TRUE,
  ip_address                    TEXT,
  device_fingerprint            TEXT,
  signed_at                     TIMESTAMPTZ DEFAULT now(),
  contract_version              VARCHAR DEFAULT 'v1.0',
  is_active                     BOOLEAN DEFAULT TRUE,
  created_at                    TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------
-- 4) سجل إشعارات العمولة
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commission_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID REFERENCES profiles(id),
  monthly_sale_id UUID REFERENCES vendor_monthly_sales(id),
  type            VARCHAR NOT NULL,
  sent_at         TIMESTAMPTZ DEFAULT now(),
  read_at         TIMESTAMPTZ
);

-- ---------------------------------------------------------------
-- 5) Indexes
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vendor_monthly_sales_vendor
  ON vendor_monthly_sales(vendor_id, year, month);

CREATE INDEX IF NOT EXISTS idx_vendor_monthly_sales_status
  ON vendor_monthly_sales(status);

CREATE INDEX IF NOT EXISTS idx_confirmed_transactions_vendor
  ON confirmed_transactions(vendor_id, year, month);

CREATE INDEX IF NOT EXISTS idx_vendor_contracts_vendor
  ON vendor_contracts(vendor_id);

CREATE INDEX IF NOT EXISTS idx_commission_notifications_vendor
  ON commission_notifications(vendor_id, sent_at DESC);

-- ---------------------------------------------------------------
-- 6) updated_at trigger for vendor_monthly_sales
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_vendor_monthly_sales_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_monthly_sales_updated_at ON vendor_monthly_sales;
CREATE TRIGGER trg_vendor_monthly_sales_updated_at
BEFORE UPDATE ON vendor_monthly_sales
FOR EACH ROW EXECUTE FUNCTION set_vendor_monthly_sales_updated_at();

-- ---------------------------------------------------------------
-- 7) RLS enable
-- ---------------------------------------------------------------
ALTER TABLE vendor_monthly_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_notifications ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------
-- 8) RLS policies
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS vendor_sees_own_sales ON vendor_monthly_sales;
CREATE POLICY vendor_sees_own_sales ON vendor_monthly_sales
  FOR ALL USING (vendor_id = auth.uid());

DROP POLICY IF EXISTS vendor_sees_own_transactions ON confirmed_transactions;
CREATE POLICY vendor_sees_own_transactions ON confirmed_transactions
  FOR ALL USING (vendor_id = auth.uid());

DROP POLICY IF EXISTS vendor_sees_own_contract ON vendor_contracts;
CREATE POLICY vendor_sees_own_contract ON vendor_contracts
  FOR ALL USING (vendor_id = auth.uid());

DROP POLICY IF EXISTS vendor_sees_own_commission_notifications ON commission_notifications;
CREATE POLICY vendor_sees_own_commission_notifications ON commission_notifications
  FOR ALL USING (vendor_id = auth.uid());

DROP POLICY IF EXISTS admin_sees_all_sales ON vendor_monthly_sales;
CREATE POLICY admin_sees_all_sales ON vendor_monthly_sales
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS admin_sees_all_transactions ON confirmed_transactions;
CREATE POLICY admin_sees_all_transactions ON confirmed_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS admin_sees_all_contracts ON vendor_contracts;
CREATE POLICY admin_sees_all_contracts ON vendor_contracts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS admin_sees_all_commission_notifications ON commission_notifications;
CREATE POLICY admin_sees_all_commission_notifications ON commission_notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ---------------------------------------------------------------
-- 9) المرحلة 4.1 - إخفاء بيانات تواصل البائع حتى تأكيد الطلب
-- ملاحظة: لتجنب تعارض السياسات السابقة، نضيف سياسة SELECT مخصصة.
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS hide_vendor_contact_until_order ON profiles;
CREATE POLICY hide_vendor_contact_until_order ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR role = 'admin'
    OR (
      role = 'vendor'
      AND EXISTS (
        SELECT 1 FROM orders
        WHERE (buyer_id = auth.uid() OR vendor_id = auth.uid())
          AND status IN ('confirmed', 'preparing', 'shipped', 'payment_received', 'delivered')
          AND (vendor_id = profiles.id OR buyer_id = profiles.id)
      )
    )
  );

-- ---------------------------------------------------------------
-- 10) Quick verification
-- ---------------------------------------------------------------
SELECT 'vendor_monthly_sales' AS table_name, COUNT(*) AS total FROM vendor_monthly_sales
UNION ALL
SELECT 'confirmed_transactions', COUNT(*) FROM confirmed_transactions
UNION ALL
SELECT 'vendor_contracts', COUNT(*) FROM vendor_contracts
UNION ALL
SELECT 'commission_notifications', COUNT(*) FROM commission_notifications;
