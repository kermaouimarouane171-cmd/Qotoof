-- =====================================================
-- FIXES FOR CRITICAL DATABASE ISSUES
-- GreenMarket - Buyer-Vendor-Driver Connection Fixes
-- =====================================================

-- =====================================================
-- FIX 1: Add 'awaiting_driver' to order_status enum
-- =====================================================
-- PostgreSQL doesn't support adding to enum directly, we need to recreate it

-- Create new enum with the additional value
CREATE TYPE order_status_new AS ENUM (
  'pending',
  'awaiting_driver',   -- NEW: Order accepted but needs driver
  'vendor_accepted',
  'vendor_rejected',
  'driver_assigned',
  'driver_accepted',
  'driver_picked_up',
  'on_the_way',
  'delivered',
  'cancelled'
);

-- Change the column to use text temporarily
ALTER TABLE orders ALTER COLUMN status TYPE TEXT;

-- Drop old enum
DROP TYPE order_status;

-- Create new enum
CREATE TYPE order_status AS ENUM (
  'pending',
  'awaiting_driver',
  'vendor_accepted',
  'vendor_rejected',
  'driver_assigned',
  'driver_accepted',
  'driver_picked_up',
  'on_the_way',
  'delivered',
  'cancelled'
);

-- Convert back to enum
ALTER TABLE orders ALTER COLUMN status TYPE order_status USING status::order_status;

-- Clean up
DROP TYPE IF EXISTS order_status_new;

-- =====================================================
-- FIX 2: Create payments table
-- =====================================================
CREATE TYPE payment_method AS ENUM ('cod', 'bank_transfer', 'card');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_number TEXT UNIQUE NOT NULL,
  method payment_method NOT NULL DEFAULT 'cod',
  status payment_status DEFAULT 'pending',
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'MAD',
  transaction_id TEXT,
  payment_gateway TEXT,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);

-- RLS for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment records"
  ON payments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
      AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid())
    )
  );

CREATE POLICY "System can create payments"
  ON payments FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update payments"
  ON payments FOR UPDATE USING (true);

-- Trigger for payment number
CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.payment_number := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(TO_CHAR(NEXTVAL('payment_seq'), 'FM99999'), 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS payment_seq START WITH 1;

DROP TRIGGER IF EXISTS set_payment_number ON payments;
CREATE TRIGGER set_payment_number
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION generate_payment_number();

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FIX 3: Create delivery_tracking table
-- =====================================================
CREATE TABLE IF NOT EXISTS delivery_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  
  -- Location tracking
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(5, 2), -- GPS accuracy in meters
  speed DECIMAL(5, 2),    -- Speed in km/h
  
  -- Metadata
  tracking_method TEXT DEFAULT 'gps', -- gps, manual
  battery_level INTEGER,  -- Driver's device battery %
  
  -- Timestamp
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_latitude CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT valid_longitude CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_delivery ON delivery_tracking(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_recorded ON delivery_tracking(recorded_at);

-- RLS for delivery_tracking
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tracking for their deliveries"
  ON delivery_tracking FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      WHERE d.id = delivery_tracking.delivery_id
      AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid() OR d.driver_id = auth.uid())
    )
  );

CREATE POLICY "Drivers can insert tracking data"
  ON delivery_tracking FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries
      WHERE deliveries.id = delivery_tracking.delivery_id
      AND deliveries.driver_id = auth.uid()
    )
  );

-- =====================================================
-- FIX 4: Fix find_nearby_drivers function (distance bug)
-- =====================================================
CREATE OR REPLACE FUNCTION public.find_nearby_drivers(
  p_search_latitude DECIMAL,
  p_search_longitude DECIMAL,
  p_radius_km DECIMAL DEFAULT 20
)
RETURNS TABLE (
  driver_id UUID,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  vehicle_type vehicle_type,
  distance DECIMAL,
  rating DECIMAL,
  total_deliveries INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.phone,
    p.vehicle_type,
    public.calculate_distance(p.latitude, p.longitude, p_search_latitude, p_search_longitude) as distance,
    p.driver_rating,
    p.total_deliveries
  FROM profiles p
  WHERE p.role = 'driver'
    AND p.is_available_for_delivery = true
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND public.calculate_distance(p.latitude, p.longitude, p_search_latitude, p_search_longitude) <= p_radius_km
  ORDER BY distance ASC, p.driver_rating DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIX 5: Create missing RPC functions
-- =====================================================

-- Calculate delivery price based on distance and vehicle type
CREATE OR REPLACE FUNCTION public.calculate_delivery_price(
  p_distance_km DECIMAL,
  p_vehicle_type TEXT DEFAULT 'car'
)
RETURNS DECIMAL AS $$
DECLARE
  base_price DECIMAL := 15; -- MAD base price
  per_km_rate DECIMAL;
  vehicle_multiplier DECIMAL := 1.0;
BEGIN
  -- Set per-km rate based on distance tiers
  IF p_distance_km <= 5 THEN
    per_km_rate := 3.0;
  ELSIF p_distance_km <= 20 THEN
    per_km_rate := 2.5;
  ELSIF p_distance_km <= 50 THEN
    per_km_rate := 2.0;
  ELSE
    per_km_rate := 1.5;
  END IF;

  -- Vehicle type multiplier
  CASE p_vehicle_type
    WHEN 'motorcycle' THEN vehicle_multiplier := 0.8;
    WHEN 'car' THEN vehicle_multiplier := 1.0;
    WHEN 'van' THEN vehicle_multiplier := 1.5;
    WHEN 'truck' THEN vehicle_multiplier := 2.0;
    ELSE vehicle_multiplier := 1.0;
  END CASE;

  RETURN ROUND((base_price + (p_distance_km * per_km_rate)) * vehicle_multiplier, 2);
END;
$$ LANGUAGE plpgsql;

-- Calculate distance in km (wrapper for calculate_distance)
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
  lat1 DECIMAL, lon1 DECIMAL,
  lat2 DECIMAL, lon2 DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN public.calculate_distance(lat1, lon1, lat2, lon2);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FIX 6: Create notification triggers
-- =====================================================

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification_for_user(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (p_user_id, p_title, p_message, p_type, p_data)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Notify vendor when order is placed
CREATE OR REPLACE FUNCTION public.notify_on_new_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    -- Notify vendor
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      NEW.vendor_id,
      'New Order Received',
      'Order #' || NEW.order_number || ' from ' || (SELECT first_name FROM profiles WHERE id = NEW.buyer_id),
      'order',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'buyer_id', NEW.buyer_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notify_vendor_on_new_order ON orders;
CREATE TRIGGER notify_vendor_on_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_order();

-- Trigger: Notify buyer when vendor accepts order
CREATE OR REPLACE FUNCTION public.notify_on_order_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'vendor_accepted' AND OLD.status = 'pending' THEN
    -- Notify buyer
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      NEW.buyer_id,
      'Order Accepted',
      'Your order #' || NEW.order_number || ' has been accepted by the vendor',
      'order',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notify_buyer_on_accept ON orders;
CREATE TRIGGER notify_buyer_on_accept
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_order_accept();

-- Trigger: Notify driver when assigned
CREATE OR REPLACE FUNCTION public.notify_driver_assigned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.driver_id IS NOT NULL AND OLD.driver_id IS NULL THEN
    -- Notify driver
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      NEW.driver_id,
      'New Delivery Assignment',
      'You have been assigned to delivery #' || NEW.delivery_number,
      'delivery',
      jsonb_build_object('delivery_id', NEW.id, 'delivery_number', NEW.delivery_number, 'order_id', NEW.order_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notify_driver_on_assign ON deliveries;
CREATE TRIGGER notify_driver_on_assign
  AFTER UPDATE ON deliveries
  FOR EACH ROW
  WHEN (NEW.driver_id IS NOT NULL AND OLD.driver_id IS NULL)
  EXECUTE FUNCTION public.notify_driver_assigned();

-- Trigger: Notify buyer when delivery is completed
CREATE OR REPLACE FUNCTION public.notify_on_delivery_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- Notify buyer
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      (SELECT buyer_id FROM orders WHERE id = NEW.order_id),
      'Order Delivered',
      'Your order has been delivered successfully',
      'delivery',
      jsonb_build_object('delivery_id', NEW.id, 'order_id', NEW.order_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notify_buyer_on_delivery_complete ON deliveries;
CREATE TRIGGER notify_buyer_on_delivery_complete
  AFTER UPDATE ON deliveries
  FOR EACH ROW
  WHEN (NEW.status = 'delivered' AND OLD.status != 'delivered')
  EXECUTE FUNCTION public.notify_on_delivery_complete();

-- =====================================================
-- FIX 7: Add driver_id to orders table (for backward compatibility)
-- =====================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES profiles(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_assigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver_id);

-- =====================================================
-- FIX 8: Add max concurrent deliveries limit to drivers
-- =====================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_concurrent_deliveries INTEGER DEFAULT 5;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_active_deliveries INTEGER DEFAULT 0;

-- Function to update current_active_deliveries
CREATE OR REPLACE FUNCTION public.update_driver_active_deliveries()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment when driver accepts
  IF NEW.status = 'accepted' AND OLD.status = 'assigned' THEN
    UPDATE profiles 
    SET current_active_deliveries = current_active_deliveries + 1
    WHERE id = NEW.driver_id;
  END IF;
  
  -- Decrement when delivery completes or fails
  IF (NEW.status = 'delivered' OR NEW.status = 'failed') 
     AND (OLD.status = 'accepted' OR OLD.status = 'picked_up' OR OLD.status = 'on_the_way') THEN
    UPDATE profiles 
    SET current_active_deliveries = GREATEST(0, current_active_deliveries - 1)
    WHERE id = NEW.driver_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_driver_active_count ON deliveries;
CREATE TRIGGER update_driver_active_count
  AFTER UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_driver_active_deliveries();

-- =====================================================
-- FIX 9: Add vehicle type constraint for delivery assignment
-- =====================================================
-- Add preferred vehicle types to products (fragile items need trucks/vans)
ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_vehicle_type vehicle_type;

-- =====================================================
-- FIX 10: Create function to find available drivers with workload check
-- =====================================================
CREATE OR REPLACE FUNCTION public.find_available_drivers_with_capacity(
  p_search_latitude DECIMAL,
  p_search_longitude DECIMAL,
  p_radius_km DECIMAL DEFAULT 20,
  p_vehicle_type vehicle_type DEFAULT NULL
)
RETURNS TABLE (
  driver_id UUID,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  vehicle_type vehicle_type,
  distance DECIMAL,
  rating DECIMAL,
  total_deliveries INTEGER,
  active_deliveries INTEGER,
  available_capacity INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.phone,
    p.vehicle_type,
    public.calculate_distance(p.latitude, p.longitude, p_search_latitude, p_search_longitude) as distance,
    p.driver_rating,
    p.total_deliveries,
    p.current_active_deliveries,
    (p.max_concurrent_deliveries - p.current_active_deliveries) as available_capacity
  FROM profiles p
  WHERE p.role = 'driver'
    AND p.is_available_for_delivery = true
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND p.current_active_deliveries < p.max_concurrent_deliveries
    AND (p_vehicle_type IS NULL OR p.vehicle_type = p_vehicle_type)
    AND public.calculate_distance(p.latitude, p.longitude, p_search_latitude, p_search_longitude) <= p_radius_km
  ORDER BY available_capacity DESC, distance ASC, p.driver_rating DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if all tables exist
SELECT 
  tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('payments', 'delivery_tracking')
ORDER BY tablename;

-- Check if awaiting_driver is in enum
SELECT enum_range(NULL::order_status);

-- Check if functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'find_nearby_drivers',
    'calculate_delivery_price',
    'calculate_distance_km',
    'find_available_drivers_with_capacity'
  )
ORDER BY routine_name;

-- =====================================================
-- END OF FIXES
-- =====================================================
