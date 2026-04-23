BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status'
      AND e.enumlabel = 'payment_received'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'payment_received';
  END IF;
END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS has_own_driver BOOLEAN,
  ADD COLUMN IF NOT EXISTS driver_search_done BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_driver_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS preferred_driver_linked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_preferred_vendor BOOLEAN,
  ADD COLUMN IF NOT EXISTS vendor_search_done BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_vendor_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS preferred_vendor_linked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partnership_status TEXT DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS partnership_notes TEXT,
  ADD COLUMN IF NOT EXISTS show_live_driver_map BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS partnership_updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE profiles
SET driver_search_done = false
WHERE role = 'vendor'
  AND driver_search_done IS NULL;

UPDATE profiles
SET vendor_search_done = false
WHERE role = 'driver'
  AND vendor_search_done IS NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS preferred_driver_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS preferred_driver_status TEXT DEFAULT 'unassigned',
  ADD COLUMN IF NOT EXISTS preferred_driver_source TEXT,
  ADD COLUMN IF NOT EXISTS preferred_driver_assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_received_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS driver_preferences_snapshot JSONB DEFAULT '{}'::jsonb;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS preferred_driver_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS broadcast_status TEXT DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS broadcast_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS broadcast_ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_broadcast_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS route_snapshot JSONB DEFAULT '{}'::jsonb;

ALTER TABLE driver_locations
  ADD COLUMN IF NOT EXISTS delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS broadcast_status TEXT DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS last_broadcast_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS broadcast_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS partnership_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requester_role TEXT NOT NULL,
  target_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_partnership_roles CHECK (
    requester_role IN ('vendor', 'driver')
    AND target_role IN ('vendor', 'driver')
    AND requester_role <> target_role
  ),
  CONSTRAINT chk_partnership_status CHECK (
    status IN ('pending', 'accepted', 'rejected', 'cancelled')
  ),
  CONSTRAINT chk_partnership_direction CHECK (requester_id <> target_id)
);

CREATE TABLE IF NOT EXISTS driver_broadcast_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'heartbeat',
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  accuracy_meters INTEGER,
  speed_kmh NUMERIC(10, 2),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_driver_broadcast_event_type CHECK (
    event_type IN ('started', 'heartbeat', 'paused', 'stopped', 'completed')
  )
);

CREATE INDEX IF NOT EXISTS idx_profiles_preferred_driver_id ON profiles(preferred_driver_id);
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_vendor_id ON profiles(preferred_vendor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_partnership_status ON profiles(partnership_status);
CREATE INDEX IF NOT EXISTS idx_orders_preferred_driver_id ON orders(preferred_driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_preferred_driver_status ON orders(preferred_driver_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_received_at ON orders(payment_received_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_vendor_id ON deliveries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_buyer_id ON deliveries(buyer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_preferred_driver_id ON deliveries(preferred_driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_broadcast_status ON deliveries(broadcast_status);
CREATE INDEX IF NOT EXISTS idx_driver_locations_delivery_id ON driver_locations(delivery_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_order_id ON driver_locations(order_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_vendor_id ON driver_locations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_broadcast_status ON driver_locations(broadcast_status);
CREATE INDEX IF NOT EXISTS idx_partnership_requests_requester ON partnership_requests(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partnership_requests_target ON partnership_requests(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partnership_requests_status ON partnership_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_partnership_requests_unique_pending
  ON partnership_requests(requester_id, target_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_driver_broadcast_events_driver ON driver_broadcast_events(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_broadcast_events_delivery ON driver_broadcast_events(delivery_id, created_at DESC);

UPDATE deliveries AS d
SET
  vendor_id = o.vendor_id,
  buyer_id = o.buyer_id,
  preferred_driver_id = COALESCE(d.preferred_driver_id, o.preferred_driver_id)
FROM orders AS o
WHERE d.order_id = o.id
  AND (
    d.vendor_id IS NULL
    OR d.buyer_id IS NULL
    OR d.preferred_driver_id IS NULL
  );

UPDATE driver_locations AS dl
SET
  order_id = d.order_id,
  delivery_id = d.id,
  vendor_id = d.vendor_id,
  buyer_id = d.buyer_id
FROM deliveries AS d
WHERE dl.driver_id = d.driver_id
  AND d.status IN ('assigned', 'accepted', 'picked_up', 'on_the_way')
  AND (dl.delivery_id IS NULL OR dl.order_id IS NULL);

CREATE OR REPLACE FUNCTION public.sync_delivery_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_sync_delivery_participants ON deliveries;
CREATE TRIGGER trg_sync_delivery_participants
  BEFORE INSERT OR UPDATE OF order_id, driver_id, preferred_driver_id
  ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_delivery_participants();

CREATE OR REPLACE FUNCTION public.sync_driver_location_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_updated = NOW();
  NEW.last_active_at = COALESCE(NEW.last_active_at, NOW());

  IF COALESCE(NEW.broadcast_status, 'idle') = 'active' THEN
    NEW.broadcast_started_at = COALESCE(NEW.broadcast_started_at, NOW());
    NEW.last_broadcast_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_driver_location_timestamps ON driver_locations;
CREATE TRIGGER trg_sync_driver_location_timestamps
  BEFORE INSERT OR UPDATE ON driver_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_driver_location_timestamps();

CREATE OR REPLACE FUNCTION public.touch_partnership_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_partnership_requests_updated_at ON partnership_requests;
CREATE TRIGGER trg_touch_partnership_requests_updated_at
  BEFORE UPDATE ON partnership_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_partnership_requests_updated_at();

ALTER TABLE partnership_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_broadcast_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'partnership_requests'
      AND policyname = 'Users can view their partnership requests'
  ) THEN
    CREATE POLICY "Users can view their partnership requests"
      ON partnership_requests
      FOR SELECT
      USING (requester_id = auth.uid() OR target_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'partnership_requests'
      AND policyname = 'Users can create outgoing partnership requests'
  ) THEN
    CREATE POLICY "Users can create outgoing partnership requests"
      ON partnership_requests
      FOR INSERT
      WITH CHECK (requester_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'partnership_requests'
      AND policyname = 'Targets can respond to partnership requests'
  ) THEN
    CREATE POLICY "Targets can respond to partnership requests"
      ON partnership_requests
      FOR UPDATE
      USING (target_id = auth.uid() OR requester_id = auth.uid())
      WITH CHECK (target_id = auth.uid() OR requester_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'driver_broadcast_events'
      AND policyname = 'Drivers can insert own broadcast events'
  ) THEN
    CREATE POLICY "Drivers can insert own broadcast events"
      ON driver_broadcast_events
      FOR INSERT
      WITH CHECK (driver_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'driver_broadcast_events'
      AND policyname = 'Stakeholders can view broadcast events'
  ) THEN
    CREATE POLICY "Stakeholders can view broadcast events"
      ON driver_broadcast_events
      FOR SELECT
      USING (
        driver_id = auth.uid()
        OR vendor_id = auth.uid()
        OR buyer_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM orders AS o
          WHERE o.id = driver_broadcast_events.order_id
            AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid() OR o.driver_id = auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'driver_locations'
      AND policyname = 'Stakeholders can view live driver locations'
  ) THEN
    CREATE POLICY "Stakeholders can view live driver locations"
      ON driver_locations
      FOR SELECT
      USING (
        driver_id = auth.uid()
        OR vendor_id = auth.uid()
        OR buyer_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM orders AS o
          WHERE o.id = driver_locations.order_id
            AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid() OR o.driver_id = auth.uid())
        )
      );
  END IF;
END $$;

COMMIT;