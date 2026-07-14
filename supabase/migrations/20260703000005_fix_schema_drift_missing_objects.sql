-- ==========================================================================
-- Migration: Fix schema drift — create missing tables, views, and policies
--
-- Problem:
--   Several tables and views referenced by frontend code exist only in the
--   legacy database/migrations/ directory and were never ported to
--   supabase/migrations/. This causes 400/404 errors:
--
--   - public_vendor_profiles (VIEW) → 404, only in database/migrations/039
--   - user_settings (TABLE) → 400, only in database/migrations/030
--   - loyalty_transactions missing RLS SELECT policy → 400/empty results
--   - order_items → products FK missing → PostgREST can't resolve joins
--   - product_images → products FK missing → PostgREST can't resolve joins
--   - orders → profiles FKs might be missing → PostgREST can't resolve joins
--
--   Additionally, the public_vendor_profiles view references columns that
--   were only recently added (is_verified, is_approved, etc.) so it must be
--   created AFTER migration 20260703000004.
--
-- Fix:
--   1. Create user_settings table with RLS
--   2. Create public_vendor_profiles view
--   3. Ensure loyalty_transactions has RLS enabled + SELECT policy
--   4. Ensure FK constraints exist for PostgREST join resolution
--
-- All statements are idempotent (IF NOT EXISTS / DO blocks).
-- ==========================================================================

BEGIN;

-- ============================================================================
-- 1. user_settings TABLE
-- ============================================================================
-- Used by: src/pages/buyer/Settings.jsx (notification_settings)
-- Missing from: all supabase/migrations/ files
-- Exists in: database/migrations/030-unified-schema.sql

CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, setting_key)
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_settings_user_select ON public.user_settings;
CREATE POLICY user_settings_user_select
  ON public.user_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_settings_user_manage ON public.user_settings;
CREATE POLICY user_settings_user_manage
  ON public.user_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 2. public_vendor_profiles VIEW
-- ============================================================================
-- Used by: productSearchService.js, vendorsApi.js, productsApi.ts,
--          profilesService.ts, StoreDetail.jsx, Cart.jsx, About.jsx,
--          ProductDetail.jsx, favoritesStore.js
-- Missing from: all supabase/migrations/ files
-- Exists in: database/migrations/039-fix-anon-data-exposure-and-rls.sql

CREATE OR REPLACE VIEW public.public_vendor_profiles
  WITH (security_invoker = true)
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

-- ============================================================================
-- 3. loyalty_points TABLE (missing from all supabase migrations)
-- ============================================================================
-- Used by: src/modules/loyalty/api/loyalty.js getPointsBalance()
-- Table only created in database/migrations/030-unified-schema.sql (legacy)
-- Columns lifetime_points, tier, last_earned_at, referral_bonus_earned
-- are added by 20260422000017 but that migration ALTERs the table — if the
-- table doesn't exist, the ALTER fails silently.

CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns from 20260422000017 exist (in case that migration failed)
ALTER TABLE public.loyalty_points
  ADD COLUMN IF NOT EXISTS lifetime_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'Bronze',
  ADD COLUMN IF NOT EXISTS last_earned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_bonus_earned INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loyalty_points_user_select ON public.loyalty_points;
CREATE POLICY loyalty_points_user_select
  ON public.loyalty_points FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS loyalty_points_user_insert ON public.loyalty_points;
CREATE POLICY loyalty_points_user_insert
  ON public.loyalty_points FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS loyalty_points_user_update ON public.loyalty_points;
CREATE POLICY loyalty_points_user_update
  ON public.loyalty_points FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 4. loyalty_transactions TABLE + RLS + SELECT policy
-- ============================================================================
-- Used by: src/modules/loyalty/api/loyalty.js
-- Table may or may not exist (ALTER TABLE in 20260422000017 would fail if
-- table is missing). Create as safety net with IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  points_change INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns added by 20260422000017 exist (in case that migration failed)
ALTER TABLE public.loyalty_transactions
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS balance_after INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loyalty_transactions_user_select ON public.loyalty_transactions;
CREATE POLICY loyalty_transactions_user_select
  ON public.loyalty_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT policy already exists from migration 20260422000019, but ensure it
DROP POLICY IF EXISTS loyalty_transactions_user_insert ON public.loyalty_transactions;
CREATE POLICY loyalty_transactions_user_insert
  ON public.loyalty_transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 5. FK CONSTRAINTS for PostgREST join resolution
-- ============================================================================
-- PostgREST resolves nested resource embedding (e.g. order_items → products)
-- by inspecting FK constraints. If the FKs don't exist, joins return 400.
-- These FKs are defined in database/migrations/030-unified-schema.sql but
-- might not have been applied if only supabase migrations were run.

-- 4a. Ensure product_images table exists (never CREATEd or ALTERed in any
--     supabase migration — only referenced in a subquery in 20260519000028)
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4c. orders → profiles (buyer_id, vendor_id, driver_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_buyer_id_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_buyer_id_fkey
      FOREIGN KEY (buyer_id) REFERENCES public.profiles(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_vendor_id_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES public.profiles(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_driver_id_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_driver_id_fkey
      FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4d. order_items → orders, order_items → products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_order_id_fkey'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_product_id_fkey'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id);
  END IF;
END $$;

-- 4e. product_images → products (FK may already exist from CREATE TABLE above)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_images_product_id_fkey'
      AND conrelid = 'public.product_images'::regclass
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4f. deliveries → orders, deliveries → profiles (driver_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deliveries_order_id_fkey'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT deliveries_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deliveries_driver_id_fkey'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT deliveries_driver_id_fkey
      FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4g. products → profiles (vendor_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_vendor_id_fkey'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
