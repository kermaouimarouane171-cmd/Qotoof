-- ============================================
-- Add driver assignment and waiting period support
-- ============================================
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add driver_id and awaiting_driver status to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS driver_assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS driver_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS waiting_period_days INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS vendor_wait_response BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vendor_response_at TIMESTAMP WITH TIME ZONE;

-- 2. Add 'awaiting_driver' to order_status enum (must be in separate transaction)
-- This is handled by migration 002b

-- 3. Create index for driver lookups
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id) WHERE driver_id IS NOT NULL;

-- 4. Create driver availability log table
CREATE TABLE IF NOT EXISTS driver_availability_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES profiles(id) NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if table already exists
ALTER TABLE driver_availability_log
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 5. Create index for availability lookups
CREATE INDEX IF NOT EXISTS idx_driver_availability_driver ON driver_availability_log(driver_id, created_at DESC);

-- 6. Create vendor wait responses table
CREATE TABLE IF NOT EXISTS vendor_wait_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) NOT NULL,
  vendor_id UUID REFERENCES profiles(id) NOT NULL,
  buyer_id UUID REFERENCES profiles(id) NOT NULL,
  status TEXT CHECK (status IN ('accepted', 'rejected')) NOT NULL,
  waiting_period_days INTEGER NOT NULL,
  vendor_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create indexes for vendor wait responses
CREATE INDEX IF NOT EXISTS idx_vendor_wait_order ON vendor_wait_responses(order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_wait_vendor ON vendor_wait_responses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_wait_buyer ON vendor_wait_responses(buyer_id);

-- 8. Enable RLS on new tables
ALTER TABLE driver_availability_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_wait_responses ENABLE ROW LEVEL SECURITY;

-- 9. RLS policies for driver_availability_log
CREATE POLICY "Anyone can view driver availability"
  ON driver_availability_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Drivers can insert own availability"
  ON driver_availability_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = driver_id);

-- 10. RLS policies for vendor_wait_responses
CREATE POLICY "Users can view responses for their orders"
  ON vendor_wait_responses FOR SELECT
  TO authenticated
  USING (
    auth.uid() = vendor_id OR
    auth.uid() = buyer_id
  );

CREATE POLICY "Vendors can insert responses"
  ON vendor_wait_responses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update own responses"
  ON vendor_wait_responses FOR UPDATE
  TO authenticated
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);

-- ============================================
-- NOTES:
-- ============================================
-- Order statuses:
-- - pending: Order placed, waiting for vendor
-- - awaiting_driver: Order placed, no driver available
-- - confirmed: Vendor confirmed
-- - preparing: Vendor preparing order
-- - driver_assigned: Driver assigned to deliver
-- - picked_up: Driver picked up order
-- - on_the_way: Driver delivering
-- - delivered: Order delivered
-- - cancelled: Order cancelled
--
-- Waiting periods (based on typical Morocco delivery times):
-- - 1 day: Same city delivery
-- - 2 days: Nearby cities
-- - 3 days: Standard delivery (default)
-- - 5 days: Remote areas
-- - 7 days: Maximum wait time
-- ============================================
