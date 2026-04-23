BEGIN;

-- ===============================================================
-- Qotoof Marketplace - Delivery legal documentation and anti-fraud
-- Safe to re-run.
-- ===============================================================

-- ══════════════════════════════
-- 1. Driver delivery preferences and payment policy
-- ══════════════════════════════
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS min_delivery_distance_km DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_delivery_distance_km DECIMAL(10,2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS accepted_cargo_sizes TEXT[] DEFAULT ARRAY['small', 'medium'],
  ADD COLUMN IF NOT EXISTS driver_delivery_payment_cash BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS driver_delivery_payment_transfer BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS driver_delivery_payment_notes TEXT,
  ADD COLUMN IF NOT EXISTS driver_delivery_preferences_updated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_driver_delivery_distance_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_driver_delivery_distance_check
      CHECK (
        min_delivery_distance_km >= 0
        AND max_delivery_distance_km >= min_delivery_distance_km
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_driver_cargo_sizes_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_driver_cargo_sizes_check
      CHECK (
        accepted_cargo_sizes <@ ARRAY['small', 'medium', 'large']::TEXT[]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_driver_delivery_payment_policy_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_driver_delivery_payment_policy_check
      CHECK (
        role IS DISTINCT FROM 'driver'
        OR driver_delivery_payment_cash = TRUE
        OR driver_delivery_payment_transfer = TRUE
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_driver_delivery_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.min_delivery_distance_km IS DISTINCT FROM OLD.min_delivery_distance_km
     OR NEW.max_delivery_distance_km IS DISTINCT FROM OLD.max_delivery_distance_km
     OR NEW.accepted_cargo_sizes IS DISTINCT FROM OLD.accepted_cargo_sizes
     OR NEW.driver_delivery_payment_cash IS DISTINCT FROM OLD.driver_delivery_payment_cash
     OR NEW.driver_delivery_payment_transfer IS DISTINCT FROM OLD.driver_delivery_payment_transfer
     OR NEW.driver_delivery_payment_notes IS DISTINCT FROM OLD.driver_delivery_payment_notes THEN
    NEW.driver_delivery_preferences_updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_driver_delivery_preferences_updated_at ON profiles;
CREATE TRIGGER trg_touch_driver_delivery_preferences_updated_at
BEFORE UPDATE OF
  min_delivery_distance_km,
  max_delivery_distance_km,
  accepted_cargo_sizes,
  driver_delivery_payment_cash,
  driver_delivery_payment_transfer,
  driver_delivery_payment_notes
ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.touch_driver_delivery_preferences_updated_at();

-- ══════════════════════════════
-- 2. Order and delivery legal / payment snapshots
-- ══════════════════════════════
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_distance_km DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS delivery_base_fee DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_distance_fee DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_time_multiplier DECIMAL(6,3) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS delivery_fee_breakdown JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cargo_size TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS driver_delivery_payment_method TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS driver_delivery_payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS driver_delivery_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS driver_delivery_payment_notes TEXT,
  ADD COLUMN IF NOT EXISTS legal_capture_required BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS legal_capture_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS product_tva_exempt BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS platform_commission_rate_snapshot DECIMAL(6,4) DEFAULT 0.03,
  ADD COLUMN IF NOT EXISTS vendor_product_total DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee_total DECIMAL(12,2) DEFAULT 0;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS cargo_size TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS delivery_distance_km DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS legal_pickup_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_dropoff_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS condition_summary JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_cargo_size_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_cargo_size_check
      CHECK (cargo_size IN ('small', 'medium', 'large'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_driver_delivery_payment_method_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_driver_delivery_payment_method_check
      CHECK (driver_delivery_payment_method IN ('cash', 'bank_transfer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_driver_delivery_payment_status_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_driver_delivery_payment_status_check
      CHECK (driver_delivery_payment_status IN ('pending', 'paid', 'verified', 'waived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'deliveries_cargo_size_check'
  ) THEN
    ALTER TABLE deliveries
      ADD CONSTRAINT deliveries_cargo_size_check
      CHECK (cargo_size IN ('small', 'medium', 'large'));
  END IF;
END $$;

-- ══════════════════════════════
-- 3. Product condition legal photos
-- ══════════════════════════════
CREATE TABLE IF NOT EXISTS product_condition_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  captured_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_role TEXT NOT NULL,
  capture_stage TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  gps_latitude DOUBLE PRECISION NOT NULL,
  gps_longitude DOUBLE PRECISION NOT NULL,
  captured_address TEXT,
  watermark_text TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_condition_photos_actor_role_check'
  ) THEN
    ALTER TABLE product_condition_photos
      ADD CONSTRAINT product_condition_photos_actor_role_check
      CHECK (actor_role IN ('vendor', 'driver', 'buyer', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_condition_photos_stage_check'
  ) THEN
    ALTER TABLE product_condition_photos
      ADD CONSTRAINT product_condition_photos_stage_check
      CHECK (capture_stage IN ('vendor_release', 'driver_loading', 'driver_dropoff', 'buyer_receipt'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_condition_photos_order
  ON product_condition_photos(order_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_condition_photos_delivery
  ON product_condition_photos(delivery_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_condition_photos_stage
  ON product_condition_photos(capture_stage, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_condition_photos_captured_by
  ON product_condition_photos(captured_by, captured_at DESC);

CREATE OR REPLACE FUNCTION public.sync_product_condition_status()
RETURNS TRIGGER AS $$
DECLARE
  v_stage_count INTEGER;
  v_pickup_ready BOOLEAN;
  v_dropoff_ready BOOLEAN;
BEGIN
  SELECT COUNT(DISTINCT capture_stage)
  INTO v_stage_count
  FROM product_condition_photos
  WHERE order_id = NEW.order_id;

  UPDATE orders
  SET legal_capture_completed = (v_stage_count >= 4)
  WHERE id = NEW.order_id;

  IF NEW.delivery_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM product_condition_photos
      WHERE delivery_id = NEW.delivery_id
        AND capture_stage IN ('vendor_release', 'driver_loading')
    ) INTO v_pickup_ready;

    SELECT EXISTS (
      SELECT 1
      FROM product_condition_photos
      WHERE delivery_id = NEW.delivery_id
        AND capture_stage IN ('driver_dropoff', 'buyer_receipt')
    ) INTO v_dropoff_ready;

    UPDATE deliveries
    SET legal_pickup_verified_at = CASE
          WHEN v_pickup_ready AND legal_pickup_verified_at IS NULL THEN now()
          ELSE legal_pickup_verified_at
        END,
        legal_dropoff_verified_at = CASE
          WHEN v_dropoff_ready AND legal_dropoff_verified_at IS NULL THEN now()
          ELSE legal_dropoff_verified_at
        END,
        condition_summary = jsonb_build_object(
          'pickup_ready', v_pickup_ready,
          'dropoff_ready', v_dropoff_ready,
          'latest_stage', NEW.capture_stage,
          'last_captured_at', NEW.captured_at
        )
    WHERE id = NEW.delivery_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_condition_status ON product_condition_photos;
CREATE TRIGGER trg_sync_product_condition_status
AFTER INSERT ON product_condition_photos
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_condition_status();

ALTER TABLE product_condition_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Order parties can view product condition photos" ON product_condition_photos;
CREATE POLICY "Order parties can view product condition photos"
  ON product_condition_photos FOR SELECT
  USING (
    captured_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM orders
      WHERE orders.id = product_condition_photos.order_id
        AND (
          orders.buyer_id = auth.uid()
          OR orders.vendor_id = auth.uid()
          OR orders.driver_id = auth.uid()
          OR orders.preferred_driver_id = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Order parties can insert product condition photos" ON product_condition_photos;
CREATE POLICY "Order parties can insert product condition photos"
  ON product_condition_photos FOR INSERT
  WITH CHECK (
    captured_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1
        FROM orders
        WHERE orders.id = product_condition_photos.order_id
          AND (
            orders.buyer_id = auth.uid()
            OR orders.vendor_id = auth.uid()
            OR orders.driver_id = auth.uid()
            OR orders.preferred_driver_id = auth.uid()
          )
      )
      OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can update product condition photos" ON product_condition_photos;
CREATE POLICY "Admins can update product condition photos"
  ON product_condition_photos FOR UPDATE
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

-- ══════════════════════════════
-- 4. Fraud reports
-- ══════════════════════════════
CREATE TABLE IF NOT EXISTS fraud_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reporter_role TEXT NOT NULL,
  reported_user_role TEXT,
  report_type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'high',
  evidence_paths TEXT[] DEFAULT ARRAY[]::TEXT[],
  admin_notes TEXT,
  legal_recommendation TEXT,
  awareness_notified_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fraud_reports_reporter_role_check'
  ) THEN
    ALTER TABLE fraud_reports
      ADD CONSTRAINT fraud_reports_reporter_role_check
      CHECK (reporter_role IN ('vendor', 'driver', 'buyer', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fraud_reports_reported_role_check'
  ) THEN
    ALTER TABLE fraud_reports
      ADD CONSTRAINT fraud_reports_reported_role_check
      CHECK (
        reported_user_role IS NULL
        OR reported_user_role IN ('vendor', 'driver', 'buyer', 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fraud_reports_report_type_check'
  ) THEN
    ALTER TABLE fraud_reports
      ADD CONSTRAINT fraud_reports_report_type_check
      CHECK (report_type IN ('missing_items', 'wrong_condition', 'fake_delivery', 'payment_fraud', 'identity_fraud', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fraud_reports_status_check'
  ) THEN
    ALTER TABLE fraud_reports
      ADD CONSTRAINT fraud_reports_status_check
      CHECK (status IN ('pending', 'reviewing', 'action_required', 'resolved', 'dismissed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fraud_reports_priority_check'
  ) THEN
    ALTER TABLE fraud_reports
      ADD CONSTRAINT fraud_reports_priority_check
      CHECK (priority IN ('medium', 'high', 'urgent'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fraud_reports_order
  ON fraud_reports(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_reports_delivery
  ON fraud_reports(delivery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_reports_status
  ON fraud_reports(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_reports_reporter
  ON fraud_reports(reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_reports_reported_user
  ON fraud_reports(reported_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_fraud_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_fraud_reports_updated_at ON fraud_reports;
CREATE TRIGGER trg_touch_fraud_reports_updated_at
BEFORE UPDATE ON fraud_reports
FOR EACH ROW
EXECUTE FUNCTION public.touch_fraud_reports_updated_at();

ALTER TABLE fraud_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reporter or admin can view fraud reports" ON fraud_reports;
CREATE POLICY "Reporter or admin can view fraud reports"
  ON fraud_reports FOR SELECT
  USING (
    reporter_id = auth.uid()
    OR reported_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Reporter can create fraud reports" ON fraud_reports;
CREATE POLICY "Reporter can create fraud reports"
  ON fraud_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update fraud reports" ON fraud_reports;
CREATE POLICY "Admins can update fraud reports"
  ON fraud_reports FOR UPDATE
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

-- ══════════════════════════════
-- 5. Storage buckets and policies
-- ══════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('product-conditions', 'product-conditions', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('fraud-evidence', 'fraud-evidence', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload product condition photos" ON storage.objects;
CREATE POLICY "Users can upload product condition photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-conditions'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Order parties can view product condition storage" ON storage.objects;
CREATE POLICY "Order parties can view product condition storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'product-conditions'
    AND (
      auth.uid()::TEXT = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1
        FROM orders
        WHERE orders.id::TEXT = (storage.foldername(name))[2]
          AND (
            orders.buyer_id = auth.uid()
            OR orders.vendor_id = auth.uid()
            OR orders.driver_id = auth.uid()
            OR orders.preferred_driver_id = auth.uid()
          )
      )
      OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Owners can update product condition storage" ON storage.objects;
CREATE POLICY "Owners can update product condition storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-conditions'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Owners can delete product condition storage" ON storage.objects;
CREATE POLICY "Owners can delete product condition storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-conditions'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can upload fraud evidence" ON storage.objects;
CREATE POLICY "Users can upload fraud evidence"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fraud-evidence'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Fraud parties can view fraud evidence" ON storage.objects;
CREATE POLICY "Fraud parties can view fraud evidence"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'fraud-evidence'
    AND (
      auth.uid()::TEXT = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1
        FROM fraud_reports
        WHERE fraud_reports.id::TEXT = (storage.foldername(name))[2]
          AND (
            fraud_reports.reporter_id = auth.uid()
            OR fraud_reports.reported_user_id = auth.uid()
          )
      )
      OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Owners can update fraud evidence" ON storage.objects;
CREATE POLICY "Owners can update fraud evidence"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'fraud-evidence'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Owners can delete fraud evidence" ON storage.objects;
CREATE POLICY "Owners can delete fraud evidence"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fraud-evidence'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- ══════════════════════════════
-- 6. Helpful indexes
-- ══════════════════════════════
CREATE INDEX IF NOT EXISTS idx_profiles_driver_delivery_preferences
  ON profiles(role, is_available_for_delivery, max_delivery_distance_km);
CREATE INDEX IF NOT EXISTS idx_orders_driver_delivery_payment_status
  ON orders(driver_delivery_payment_status, driver_delivery_payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_legal_capture_completed
  ON orders(legal_capture_completed, legal_capture_required);
CREATE INDEX IF NOT EXISTS idx_deliveries_legal_pickup_verified
  ON deliveries(legal_pickup_verified_at, legal_dropoff_verified_at);

COMMIT;