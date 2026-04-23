BEGIN;

-- ===============================================================
-- Qotoof Marketplace - Final Marketplace Migration
-- Covers: commissions, digital contracts, live driver tracking,
-- partnership requests, profile compatibility, and safety policies.
-- Safe to re-run.
-- ===============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'order_status'
  ) THEN
    BEGIN
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'payment_received';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ===============================================================
-- 0. Profile / order / delivery compatibility columns
-- ===============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS preferred_driver_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS preferred_vendor_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS has_preferred_vendor BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS has_own_driver BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS driver_search_done BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vendor_search_done BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS agreement_accepted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS agreement_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agreement_version VARCHAR,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partnership_status VARCHAR DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS partnership_notes TEXT,
  ADD COLUMN IF NOT EXISTS preferred_driver_linked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preferred_vendor_linked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS show_live_driver_map BOOLEAN DEFAULT TRUE;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_received_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS actual_sale_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS payment_received_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS preferred_driver_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS preferred_driver_status VARCHAR DEFAULT 'unassigned',
  ADD COLUMN IF NOT EXISTS preferred_driver_source VARCHAR,
  ADD COLUMN IF NOT EXISTS preferred_driver_assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS driver_preferences_snapshot JSONB DEFAULT '{}'::jsonb;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS preferred_driver_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS broadcast_status VARCHAR DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS broadcast_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS broadcast_ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_broadcast_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS route_snapshot JSONB DEFAULT '{}'::jsonb;

-- ===============================================================
-- 1. Commission system
-- ===============================================================
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

CREATE TABLE IF NOT EXISTS commission_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID REFERENCES profiles(id),
  monthly_sale_id UUID REFERENCES vendor_monthly_sales(id),
  type            VARCHAR NOT NULL,
  sent_at         TIMESTAMPTZ DEFAULT now(),
  read_at         TIMESTAMPTZ
);

-- ===============================================================
-- 2. Driver live tracking
-- ===============================================================
CREATE TABLE IF NOT EXISTS driver_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES orders(id),
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  accuracy    DOUBLE PRECISION,
  heading     DOUBLE PRECISION,
  speed       DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE driver_locations
  ADD COLUMN IF NOT EXISTS accuracy DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS heading DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS speed DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accuracy_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS speed_kmh DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS broadcast_status VARCHAR DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS last_broadcast_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS broadcast_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS driver_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed_kmh DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_broadcast_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type VARCHAR NOT NULL DEFAULT 'heartbeat',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy_meters DOUBLE PRECISION,
  speed_kmh DOUBLE PRECISION,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===============================================================
-- 3. Partnership requests
-- ===============================================================
CREATE TABLE IF NOT EXISTS partnership_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  requester_role VARCHAR NOT NULL,
  target_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_role    VARCHAR NOT NULL,
  status         VARCHAR DEFAULT 'pending',
  message        TEXT,
  responded_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ===============================================================
-- 4. Indexes
-- ===============================================================
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver
  ON driver_locations(driver_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_locations_order
  ON driver_locations(order_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_locations_delivery
  ON driver_locations(delivery_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_locations_vendor
  ON driver_locations(vendor_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_locations_status
  ON driver_locations(broadcast_status, last_broadcast_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_location_history_order
  ON driver_location_history(order_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_broadcast_events_driver
  ON driver_broadcast_events(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_broadcast_events_order
  ON driver_broadcast_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partnership_requester
  ON partnership_requests(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_partnership_target
  ON partnership_requests(target_id, status);
CREATE INDEX IF NOT EXISTS idx_vendor_monthly_vendor
  ON vendor_monthly_sales(vendor_id, year, month);
CREATE INDEX IF NOT EXISTS idx_vendor_monthly_status
  ON vendor_monthly_sales(status);
CREATE INDEX IF NOT EXISTS idx_confirmed_transactions
  ON confirmed_transactions(vendor_id, year, month);
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_driver_id
  ON profiles(preferred_driver_id);
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_vendor_id
  ON profiles(preferred_vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_preferred_driver_id
  ON orders(preferred_driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_received_at
  ON orders(payment_received_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partnership_requests_unique_pending
  ON partnership_requests(requester_id, target_id)
  WHERE status = 'pending';

-- ===============================================================
-- 5. Triggers / sync helpers
-- ===============================================================
CREATE OR REPLACE FUNCTION public.set_vendor_monthly_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vendor_monthly_sales_updated_at ON vendor_monthly_sales;
CREATE TRIGGER trg_vendor_monthly_sales_updated_at
BEFORE UPDATE ON vendor_monthly_sales
FOR EACH ROW EXECUTE FUNCTION public.set_vendor_monthly_sales_updated_at();

CREATE OR REPLACE FUNCTION public.touch_partnership_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_partnership_requests_updated_at ON partnership_requests;
CREATE TRIGGER trg_touch_partnership_requests_updated_at
BEFORE UPDATE ON partnership_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_partnership_requests_updated_at();

CREATE OR REPLACE FUNCTION public.sync_driver_location_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  NEW.last_active_at = COALESCE(NEW.last_active_at, now());
  NEW.accuracy_meters = COALESCE(NEW.accuracy_meters, NEW.accuracy);
  NEW.speed_kmh = COALESCE(NEW.speed_kmh, NEW.speed);

  IF COALESCE(NEW.broadcast_status, 'idle') = 'active' THEN
    NEW.broadcast_started_at = COALESCE(NEW.broadcast_started_at, now());
    NEW.last_broadcast_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_driver_location_timestamps ON driver_locations;
CREATE TRIGGER trg_sync_driver_location_timestamps
BEFORE INSERT OR UPDATE ON driver_locations
FOR EACH ROW EXECUTE FUNCTION public.sync_driver_location_timestamps();

CREATE OR REPLACE FUNCTION public.sync_delivery_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    SELECT
      o.vendor_id,
      o.buyer_id,
      COALESCE(NEW.preferred_driver_id, o.preferred_driver_id),
      COALESCE(NEW.driver_id, o.driver_id)
    INTO
      NEW.vendor_id,
      NEW.buyer_id,
      NEW.preferred_driver_id,
      NEW.driver_id
    FROM orders AS o
    WHERE o.id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_delivery_participants ON deliveries;
CREATE TRIGGER trg_sync_delivery_participants
BEFORE INSERT OR UPDATE OF order_id, driver_id, preferred_driver_id
ON deliveries
FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_participants();

-- ===============================================================
-- 6. RLS
-- ===============================================================
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_broadcast_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_monthly_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_owns_location ON driver_locations;
CREATE POLICY driver_owns_location
  ON driver_locations FOR ALL
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS order_parties_see_location ON driver_locations;
CREATE POLICY order_parties_see_location
  ON driver_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = driver_locations.order_id
      AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid() OR orders.driver_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS driver_owns_location_history ON driver_location_history;
CREATE POLICY driver_owns_location_history
  ON driver_location_history FOR ALL
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS order_parties_see_location_history ON driver_location_history;
CREATE POLICY order_parties_see_location_history
  ON driver_location_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = driver_location_history.order_id
      AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid() OR orders.driver_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS stakeholders_see_broadcast_events ON driver_broadcast_events;
CREATE POLICY stakeholders_see_broadcast_events
  ON driver_broadcast_events FOR SELECT
  USING (
    driver_id = auth.uid()
    OR vendor_id = auth.uid()
    OR buyer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = driver_broadcast_events.order_id
      AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid() OR orders.driver_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS driver_inserts_broadcast_events ON driver_broadcast_events;
CREATE POLICY driver_inserts_broadcast_events
  ON driver_broadcast_events FOR INSERT
  WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS own_partnership_requests ON partnership_requests;
CREATE POLICY own_partnership_requests
  ON partnership_requests FOR ALL
  USING (requester_id = auth.uid() OR target_id = auth.uid())
  WITH CHECK (requester_id = auth.uid() OR target_id = auth.uid());

DROP POLICY IF EXISTS vendor_own_sales ON vendor_monthly_sales;
CREATE POLICY vendor_own_sales
  ON vendor_monthly_sales FOR ALL
  USING (
    vendor_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    vendor_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS vendor_own_transactions ON confirmed_transactions;
CREATE POLICY vendor_own_transactions
  ON confirmed_transactions FOR ALL
  USING (
    vendor_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    vendor_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS vendor_own_contract ON vendor_contracts;
CREATE POLICY vendor_own_contract
  ON vendor_contracts FOR ALL
  USING (
    vendor_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    vendor_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS vendor_own_notifications ON commission_notifications;
CREATE POLICY vendor_own_notifications
  ON commission_notifications FOR ALL
  USING (
    vendor_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    vendor_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS hide_contact_until_order_confirmed ON profiles;
CREATE POLICY hide_contact_until_order_confirmed
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR NOT (role IN ('vendor', 'buyer'))
    OR EXISTS (
      SELECT 1 FROM orders
      WHERE status::text IN ('confirmed', 'preparing', 'shipped', 'delivered', 'payment_received')
      AND (
        (buyer_id = auth.uid() AND vendor_id = profiles.id)
        OR (vendor_id = auth.uid() AND buyer_id = profiles.id)
      )
    )
  );

-- ===============================================================
-- 7. Scheduled functions
-- ===============================================================
CREATE OR REPLACE FUNCTION close_month_commissions()
RETURNS void AS $$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM now());
  current_year  INTEGER := EXTRACT(YEAR FROM now());
  due           TIMESTAMPTZ := DATE_TRUNC('month', now())
                               + INTERVAL '1 month'
                               + INTERVAL '7 days';
BEGIN
  UPDATE vendor_monthly_sales
  SET
    status = 'pending',
    due_date = due,
    updated_at = now(),
    commission_due = ROUND((COALESCE(total_sales, 0) * COALESCE(commission_rate, 0.03))::numeric, 2)
  WHERE month = current_month
    AND year = current_year
    AND status = 'active'
    AND total_sales > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION freeze_overdue_vendors()
RETURNS void AS $$
BEGIN
  UPDATE vendor_monthly_sales
  SET status = 'overdue', updated_at = now()
  WHERE status = 'pending'
    AND due_date < now();

  UPDATE profiles
  SET is_active = false
  WHERE role = 'vendor'
    AND id IN (
      SELECT DISTINCT vendor_id
      FROM vendor_monthly_sales
      WHERE status = 'overdue'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION close_month_commissions() TO authenticated;
GRANT EXECUTE ON FUNCTION close_month_commissions() TO service_role;
GRANT EXECUTE ON FUNCTION freeze_overdue_vendors() TO authenticated;
GRANT EXECUTE ON FUNCTION freeze_overdue_vendors() TO service_role;

COMMIT;