-- =====================================================
-- DRIVER SYSTEM ENHANCEMENTS
-- Delivery Time, GPS Tracking, Product Handling, License & Insurance
-- =====================================================

-- =====================================================
-- 1. DELIVERY TIME ESTIMATION & COMPLIANCE
-- =====================================================

-- Add ETA columns to deliveries if not exist
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMPTZ;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS actual_delivery_time TIMESTAMPTZ;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT false;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS late_reason TEXT;

-- Add delivery time tracking to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMPTZ;

-- Function to calculate ETA based on distance and driver vehicle type
CREATE OR REPLACE FUNCTION public.calculate_eta(
  p_distance_km DECIMAL,
  p_vehicle_type TEXT DEFAULT 'car'
)
RETURNS INTERVAL AS $$
DECLARE
  avg_speed_kmh DECIMAL;
  prep_time_minutes INTEGER := 10; -- Vendor prep time
  loading_time_minutes INTEGER := 5; -- Loading time
  travel_time_minutes DECIMAL;
  total_minutes INTEGER;
BEGIN
  -- Average speeds by vehicle type in urban areas
  CASE p_vehicle_type
    WHEN 'motorcycle' THEN avg_speed_kmh := 30;
    WHEN 'car' THEN avg_speed_kmh := 25;
    WHEN 'van' THEN avg_speed_kmh := 20;
    WHEN 'truck' THEN avg_speed_kmh := 15;
    ELSE avg_speed_kmh := 25;
  END CASE;

  -- Calculate travel time
  travel_time_minutes := (p_distance_km / avg_speed_kmh) * 60;
  
  -- Total time = prep + loading + travel + buffer (20%)
  total_minutes := CEIL((prep_time_minutes + loading_time_minutes + travel_time_minutes) * 1.2);
  
  RETURN (total_minutes || ' minutes')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-set ETA when delivery is assigned
CREATE OR REPLACE FUNCTION public.set_delivery_eta()
RETURNS TRIGGER AS $$
DECLARE
  v_distance DECIMAL;
  v_vehicle_type TEXT;
  v_eta_interval INTERVAL;
  v_eta_timestamp TIMESTAMPTZ;
BEGIN
  -- Get distance and vehicle type
  SELECT 
    public.calculate_distance(
      d.pickup_latitude, d.pickup_longitude,
      d.delivery_latitude, d.delivery_longitude
    ),
    p.vehicle_type
  INTO v_distance, v_vehicle_type
  FROM deliveries d
  LEFT JOIN profiles p ON p.id = d.driver_id
  WHERE d.id = NEW.id;

  -- Calculate ETA
  IF v_distance IS NOT NULL AND v_vehicle_type IS NOT NULL THEN
    v_eta_interval := public.calculate_eta(v_distance, v_vehicle_type);
    v_eta_timestamp := NOW() + v_eta_interval;
    
    NEW.estimated_delivery_time := v_eta_timestamp;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_delivery_eta_trigger ON deliveries;
CREATE TRIGGER set_delivery_eta_trigger
  BEFORE INSERT OR UPDATE ON deliveries
  FOR EACH ROW
  WHEN (NEW.driver_id IS NOT NULL AND NEW.estimated_delivery_time IS NULL)
  EXECUTE FUNCTION public.set_delivery_eta();

-- Function to check if delivery is late
CREATE OR REPLACE FUNCTION public.check_late_deliveries()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if delivery is late
  IF NEW.status NOT IN ('delivered', 'failed') 
     AND NEW.estimated_delivery_time IS NOT NULL 
     AND NOW() > NEW.estimated_delivery_time THEN
    NEW.is_late := true;
    NEW.late_reason := 'Exceeded estimated delivery time';
  END IF;

  -- Record actual delivery time
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    NEW.actual_delivery_time := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_late_trigger ON deliveries;
CREATE TRIGGER check_late_trigger
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_late_deliveries();

-- =====================================================
-- 2. DRIVER LICENSE & INSURANCE VERIFICATION
-- =====================================================

-- Add verification fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS license_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS license_expiry_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS license_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS insurance_expiry_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS insurance_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';

-- Create verification documents table
CREATE TABLE IF NOT EXISTS driver_verification_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('driver_license', 'vehicle_insurance', 'vehicle_registration')),
  document_url TEXT NOT NULL,
  document_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_verification_driver ON driver_verification_documents(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_verification_status ON driver_verification_documents(status);
CREATE INDEX IF NOT EXISTS idx_driver_verification_type ON driver_verification_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_driver_verification_expiry ON driver_verification_documents(expiry_date);

-- RLS for verification documents
ALTER TABLE driver_verification_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own verification documents"
  ON driver_verification_documents FOR SELECT USING (driver_id = auth.uid());

CREATE POLICY "Drivers can upload verification documents"
  ON driver_verification_documents FOR INSERT WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Admins can view all verification documents"
  ON driver_verification_documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update verification documents"
  ON driver_verification_documents FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_driver_verification_updated_at ON driver_verification_documents;
CREATE TRIGGER update_driver_verification_updated_at 
  BEFORE UPDATE ON driver_verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if driver is verified
CREATE OR REPLACE FUNCTION public.is_driver_verified(p_driver_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_verified BOOLEAN;
BEGIN
  SELECT 
    p.license_verified 
    AND p.insurance_verified
    AND p.verification_status = 'verified'
    AND (p.license_expiry_date IS NULL OR p.license_expiry_date > CURRENT_DATE)
    AND (p.insurance_expiry_date IS NULL OR p.insurance_expiry_date > CURRENT_DATE)
  INTO v_verified
  FROM profiles p
  WHERE p.id = p_driver_id;

  RETURN COALESCE(v_verified, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to prevent unverified drivers from accepting deliveries
CREATE OR REPLACE FUNCTION public.check_driver_verification_before_accept()
RETURNS TRIGGER AS $$
DECLARE
  v_verified BOOLEAN;
BEGIN
  -- Only check when driver accepts a delivery
  IF NEW.status = 'accepted' AND OLD.status = 'assigned' THEN
    SELECT public.is_driver_verified(NEW.driver_id) INTO v_verified;
    
    IF NOT v_verified THEN
      RAISE EXCEPTION 'Driver verification incomplete. License and insurance verification required before accepting deliveries.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_verification_before_accept ON deliveries;
CREATE TRIGGER check_verification_before_accept
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_driver_verification_before_accept();

-- Function to check expired documents
CREATE OR REPLACE FUNCTION public.check_expired_documents()
RETURNS void AS $$
BEGIN
  -- Update drivers with expired license
  UPDATE profiles 
  SET 
    license_verified = false,
    verification_status = 'expired',
    is_available_for_delivery = false
  WHERE license_expiry_date IS NOT NULL 
    AND license_expiry_date <= CURRENT_DATE
    AND license_verified = true;

  -- Update drivers with expired insurance
  UPDATE profiles 
  SET 
    insurance_verified = false,
    verification_status = 'expired',
    is_available_for_delivery = false
  WHERE insurance_expiry_date IS NOT NULL 
    AND insurance_expiry_date <= CURRENT_DATE
    AND insurance_verified = true;

  -- Notify drivers about expiration
  INSERT INTO notifications (user_id, title, message, type)
  SELECT 
    id,
    'Verification Documents Expired',
    'Your driver license or insurance has expired. Please update your documents to continue accepting deliveries.',
    'warning'
  FROM profiles
  WHERE verification_status = 'expired'
    AND role = 'driver';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. STORAGE BUCKET FOR DRIVER DOCUMENTS
-- =====================================================

-- Create storage bucket for driver verification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for driver-documents bucket
DROP POLICY IF EXISTS "Drivers can upload documents" ON storage.objects;
CREATE POLICY "Drivers can upload documents"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Anyone can view driver documents" ON storage.objects;
CREATE POLICY "Anyone can view driver documents"
  ON storage.objects FOR SELECT USING (bucket_id = 'driver-documents');

DROP POLICY IF EXISTS "Admins can update driver documents" ON storage.objects;
CREATE POLICY "Admins can update driver documents"
  ON storage.objects FOR UPDATE USING (
    bucket_id = 'driver-documents'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete driver documents" ON storage.objects;
CREATE POLICY "Admins can delete driver documents"
  ON storage.objects FOR DELETE USING (
    bucket_id = 'driver-documents'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 3. PRODUCT CONDITION TRACKING
-- =====================================================

-- Add product condition fields to deliveries
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS pickup_condition TEXT CHECK (pickup_condition IN ('excellent', 'good', 'fair', 'damaged'));
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_condition TEXT CHECK (delivery_condition IN ('excellent', 'good', 'fair', 'damaged'));
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS pickup_photo_url TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS buyer_signature_url TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS buyer_name_received TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT false;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS temperature_sensitive BOOLEAN DEFAULT false;

-- Create delivery condition checklist
CREATE TABLE IF NOT EXISTS delivery_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  
  -- Pickup checklist
  packaging_intact BOOLEAN,
  quantity_verified BOOLEAN,
  no_visible_damage BOOLEAN,
  temperature_ok BOOLEAN,
  pickup_notes TEXT,
  
  -- Delivery checklist
  buyer_confirmed_receipt BOOLEAN,
  buyer_reported_issues BOOLEAN,
  delivery_issues TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_checklist_delivery ON delivery_checklist(delivery_id);

-- RLS for delivery checklist
ALTER TABLE delivery_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view checklist for their deliveries"
  ON delivery_checklist FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      WHERE d.id = delivery_checklist.delivery_id
      AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid() OR d.driver_id = auth.uid())
    )
  );

CREATE POLICY "Drivers can update checklist"
  ON delivery_checklist FOR ALL USING (
    EXISTS (
      SELECT 1 FROM deliveries
      WHERE deliveries.id = delivery_checklist.delivery_id
      AND deliveries.driver_id = auth.uid()
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_delivery_checklist_updated_at ON delivery_checklist;
CREATE TRIGGER update_delivery_checklist_updated_at 
  BEFORE UPDATE ON delivery_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 4. MANDATORY GPS TRACKING
-- =====================================================

-- Add tracking compliance fields
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS tracking_started_at TIMESTAMPTZ;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS tracking_ended_at TIMESTAMPTZ;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS tracking_compliance BOOLEAN DEFAULT true;

-- Function to enforce tracking
CREATE OR REPLACE FUNCTION public.enforce_tracking_compliance()
RETURNS TRIGGER AS $$
BEGIN
  -- Require tracking to be started before pickup
  IF NEW.status = 'picked_up' AND OLD.status = 'accepted' THEN
    IF NEW.tracking_started_at IS NULL THEN
      RAISE EXCEPTION 'GPS tracking must be started before pickup';
    END IF;
  END IF;

  -- Require photo proof for delivery
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    IF NEW.delivery_photo_url IS NULL THEN
      RAISE EXCEPTION 'Delivery photo is mandatory';
    END IF;
    
    NEW.actual_delivery_time := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_tracking_trigger ON deliveries;
CREATE TRIGGER enforce_tracking_trigger
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tracking_compliance();

-- =====================================================
-- 5. DELIVERY PERFORMANCE METRICS
-- =====================================================

-- Create delivery performance tracking
CREATE TABLE IF NOT EXISTS driver_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Metrics
  total_deliveries INTEGER DEFAULT 0,
  on_time_deliveries INTEGER DEFAULT 0,
  late_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,
  avg_delivery_time_minutes DECIMAL(5, 2),
  on_time_percentage DECIMAL(5, 2),
  
  -- Product handling
  damaged_items_count INTEGER DEFAULT 0,
  customer_complaints INTEGER DEFAULT 0,
  customer_compliments INTEGER DEFAULT 0,
  
  -- Tracking compliance
  tracking_compliance_rate DECIMAL(5, 2),
  photo_compliance_rate DECIMAL(5, 2),
  
  -- Period
  period_start DATE DEFAULT CURRENT_DATE,
  period_end DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_performance_driver ON driver_performance(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_performance_period ON driver_performance(period_start, period_end);

-- RLS
ALTER TABLE driver_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own performance"
  ON driver_performance FOR SELECT USING (driver_id = auth.uid());

CREATE POLICY "Admins can view all performance"
  ON driver_performance FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Function to update performance metrics
CREATE OR REPLACE FUNCTION public.update_driver_performance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update metrics when delivery completes
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- Update profile stats
    UPDATE profiles
    SET 
      total_deliveries = total_deliveries + 1,
      is_available_for_delivery = true
    WHERE id = NEW.driver_id;

    -- Update or insert performance record
    INSERT INTO driver_performance (
      driver_id,
      total_deliveries,
      on_time_deliveries,
      late_deliveries,
      avg_delivery_time_minutes
    )
    VALUES (
      NEW.driver_id,
      1,
      CASE WHEN NOT COALESCE(NEW.is_late, false) THEN 1 ELSE 0 END,
      CASE WHEN COALESCE(NEW.is_late, false) THEN 1 ELSE 0 END,
      EXTRACT(EPOCH FROM (NEW.actual_delivery_time - NEW.assigned_at)) / 60
    )
    ON CONFLICT (id) DO UPDATE SET
      total_deliveries = driver_performance.total_deliveries + 1,
      on_time_deliveries = driver_performance.on_time_deliveries + 
        CASE WHEN NOT COALESCE(NEW.is_late, false) THEN 1 ELSE 0 END,
      late_deliveries = driver_performance.late_deliveries + 
        CASE WHEN COALESCE(NEW.is_late, false) THEN 1 ELSE 0 END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_performance_trigger ON deliveries;
CREATE TRIGGER update_performance_trigger
  AFTER UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_driver_performance();

-- =====================================================
-- 6. DELIVERY PRICING BASED ON ACTUAL METRICS
-- =====================================================

-- Function to calculate actual delivery price
CREATE OR REPLACE FUNCTION public.calculate_actual_delivery_price(
  p_distance_km DECIMAL,
  p_vehicle_type TEXT DEFAULT 'car',
  p_is_late BOOLEAN DEFAULT false,
  p_is_fragile BOOLEAN DEFAULT false
)
RETURNS DECIMAL AS $$
DECLARE
  base_price DECIMAL := 15;
  per_km_rate DECIMAL;
  vehicle_multiplier DECIMAL := 1.0;
  fragile_surcharge DECIMAL := 0;
  late_penalty DECIMAL := 0;
  final_price DECIMAL;
BEGIN
  -- Distance-based rate
  IF p_distance_km <= 5 THEN
    per_km_rate := 3.0;
  ELSIF p_distance_km <= 20 THEN
    per_km_rate := 2.5;
  ELSIF p_distance_km <= 50 THEN
    per_km_rate := 2.0;
  ELSE
    per_km_rate := 1.5;
  END IF;

  -- Vehicle multiplier
  CASE p_vehicle_type
    WHEN 'motorcycle' THEN vehicle_multiplier := 0.8;
    WHEN 'car' THEN vehicle_multiplier := 1.0;
    WHEN 'van' THEN vehicle_multiplier := 1.5;
    WHEN 'truck' THEN vehicle_multiplier := 2.0;
  END CASE;

  -- Fragile items surcharge (+20%)
  IF p_is_fragile THEN
    fragile_surcharge := 5;
  END IF;

  -- Late delivery penalty (-10%)
  IF p_is_late THEN
    late_penalty := -0.10;
  END IF;

  final_price := (base_price + (p_distance_km * per_km_rate)) * vehicle_multiplier + fragile_surcharge;
  final_price := final_price * (1 + late_penalty);

  RETURN ROUND(final_price, 2);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. AUTOMATIC EXPIRY CHECK (Run daily via cron)
-- =====================================================

-- This should be run daily via Supabase cron extension
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('check-expired-docs', '0 9 * * *', 'SELECT check_expired_documents()');

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check all new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'deliveries' 
  AND column_name IN (
    'estimated_delivery_time', 'actual_delivery_time', 'is_late', 'late_reason',
    'pickup_condition', 'delivery_condition', 'pickup_photo_url', 'delivery_photo_url',
    'buyer_signature_url', 'special_instructions', 'is_fragile', 'temperature_sensitive',
    'tracking_started_at', 'tracking_ended_at', 'tracking_compliance'
  )
ORDER BY column_name;

-- Check verification tables
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('driver_verification_documents', 'delivery_checklist', 'driver_performance')
ORDER BY tablename;

-- Check functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'calculate_eta', 'is_driver_verified', 'calculate_actual_delivery_price',
    'check_expired_documents'
  )
ORDER BY routine_name;

-- =====================================================
-- END OF ENHANCEMENTS
-- =====================================================
