-- Add latitude/longitude columns to products table
-- These are required for per-product location (optional field in vendor/Products.jsx)
-- Without these columns, Supabase returns 400 when inserting/updating products with location data

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Create index for spatial queries (optional, useful for nearby product search)
CREATE INDEX IF NOT EXISTS idx_products_coords
  ON products (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
