-- Migration: Fix public_vendor_profiles RLS + add products.deleted_at column
--
-- ROOT CAUSE (P0):
--   The public_vendor_profiles view was created with security_invoker = true,
--   meaning it inherits the caller's RLS context.  Since the blanket
--   "Public profiles are viewable by everyone" policy was dropped in
--   20260601000002, anon (and authenticated users without a matching RLS
--   policy) get ZERO rows from the view.
--
--   This breaks the entire marketplace public flow:
--     - productSearchService.fetchPublicVendors() → returns []
--     - searchProductsViaSupabase() → publicVendorIds empty → .in('vendor_id', []) → no products
--     - profilesService.fetchActiveVerifiedVendors() → returns []
--     - Marketplace, Home (featured), Stores pages → all empty
--
--   Meanwhile the sibling view public_profiles (created in 20260528000004)
--   uses security_invoker = false (SECURITY DEFINER) and works correctly
--   for anon users.
--
-- FIX:
--   1. Recreate public_vendor_profiles with security_invoker = false
--      (SECURITY DEFINER — runs as view owner = postgres, bypasses RLS).
--      The column list in the view definition IS the security boundary:
--      no email, phone, paypal_email, cin, stripe_customer_id, or other
--      sensitive columns are exposed.  This mirrors the proven pattern
--      already used by public_profiles.
--
--   2. Add deleted_at column to products table.  The codebase
--      (productRepository.ts) uses .is('deleted_at', null) in listProducts
--      and getProductById for soft-delete filtering, but the column does
--      not exist in the live database, causing 42703 errors.

-- ============================================================================
-- 1. Recreate public_vendor_profiles as SECURITY DEFINER view
-- ============================================================================

DROP VIEW IF EXISTS public.public_vendor_profiles;

CREATE VIEW public.public_vendor_profiles
  WITH (security_invoker = false)   -- SECURITY DEFINER: runs as view owner (postgres)
AS
SELECT
  id,
  role,
  first_name,
  last_name,
  store_name,
  store_description,
  store_type,
  bio,
  avatar_url,
  city,
  country,
  rating,
  is_verified,
  is_approved,
  operating_hours,
  active_products_count,
  delivery_option,
  has_own_driver,
  min_order_amount,
  min_delivery_distance_km,
  max_delivery_distance_km,
  is_available_for_delivery,
  vehicle_type,
  accepted_cargo_sizes,
  latitude,
  longitude,
  created_at
FROM public.profiles
WHERE role IN ('vendor', 'driver');

GRANT SELECT ON public.public_vendor_profiles TO authenticated, anon;

COMMENT ON VIEW public.public_vendor_profiles IS
  'SECURITY DEFINER view (runs as postgres). Safe public access for vendor '
  'and driver profiles only. Excluded columns: email, phone, paypal_email, '
  'paypal_verified, cin, cin_number, stripe_customer_id, admin_notes, '
  'trust_score, and all other sensitive columns.';

-- ============================================================================
-- 2. Add deleted_at column to products table
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'products'
      AND column_name  = 'deleted_at'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    RAISE NOTICE 'Added deleted_at column to products table';
  ELSE
    RAISE NOTICE 'deleted_at column already exists on products table';
  END IF;
END
$$;

-- Index for soft-delete filtering performance
CREATE INDEX IF NOT EXISTS idx_products_deleted_at
  ON public.products (deleted_at)
  WHERE deleted_at IS NULL;
