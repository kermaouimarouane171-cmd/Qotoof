-- ===============================================================
-- Qotoof Marketplace - Location Migration
-- Run this script directly in Supabase SQL Editor
-- ===============================================================

-- Add buyer shipping latitude to orders for map routing.
-- Add buyer shipping longitude to orders for map routing.
-- Add vendor latitude to orders for route snapshot at order time.
-- Add vendor longitude to orders for route snapshot at order time.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS shipping_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS vendor_latitude    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS vendor_longitude   DOUBLE PRECISION;

-- Add profile latitude for vendor/driver geolocation.
-- Add profile longitude for vendor/driver geolocation.
-- Add profile store_address for precise Moroccan street address.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS latitude      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS store_address TEXT;

-- Create index for fast buyer shipping coordinate lookups.
CREATE INDEX IF NOT EXISTS idx_orders_shipping_coords
  ON orders (shipping_latitude, shipping_longitude);

-- Create index for fast vendor/driver coordinate lookups.
CREATE INDEX IF NOT EXISTS idx_profiles_coords
  ON profiles (latitude, longitude);

-- Verify all expected columns were created correctly.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('orders', 'profiles')
  AND column_name IN (
    'shipping_latitude',
    'shipping_longitude',
    'vendor_latitude',
    'vendor_longitude',
    'latitude',
    'longitude',
    'store_address'
  )
ORDER BY table_name, column_name;
