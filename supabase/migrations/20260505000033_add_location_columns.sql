-- Add location columns to orders and profiles tables
-- These are required for delivery routing and geolocation

-- Add buyer shipping coordinates to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS shipping_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS vendor_latitude    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS vendor_longitude   DOUBLE PRECISION;

-- Add vendor/driver geolocation to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS latitude      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS store_address TEXT;

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_shipping_coords
  ON orders (shipping_latitude, shipping_longitude);

CREATE INDEX IF NOT EXISTS idx_profiles_coords
  ON profiles (latitude, longitude);
