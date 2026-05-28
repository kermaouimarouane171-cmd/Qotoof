-- ==========================================================================
-- Migration: Add missing performance-critical indexes
-- Indexes are created with IF NOT EXISTS so this is fully idempotent.
-- In production, replace CREATE INDEX with CREATE INDEX CONCURRENTLY
-- to avoid table locks.
-- ==========================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- orders – primary lookup patterns
-- --------------------------------------------------------------------------

-- Buyer lists their own orders (most common query)
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created
  ON public.orders (buyer_id, created_at DESC);

-- Vendor lists orders containing their products (vendor dashboard)
CREATE INDEX IF NOT EXISTS idx_orders_vendor_created
  ON public.orders (vendor_id, created_at DESC);

-- Driver lists assigned orders
CREATE INDEX IF NOT EXISTS idx_orders_driver_status
  ON public.orders (driver_id, status)
  WHERE driver_id IS NOT NULL;

-- Status filter (admin/vendor boards)
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders (status, created_at DESC);

-- --------------------------------------------------------------------------
-- order_items – heavy join target
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON public.order_items (product_id);

-- --------------------------------------------------------------------------
-- products – search & vendor management
-- --------------------------------------------------------------------------

-- Buyers browsing available products
CREATE INDEX IF NOT EXISTS idx_products_published_created
  ON public.products (approval_status, created_at DESC)
  WHERE approval_status = 'published';

-- Full-text search via pg_trgm (enable extension if not done yet)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (name gin_trgm_ops);

-- --------------------------------------------------------------------------
-- profiles – role-based access is checked on nearly every request
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles (role);

-- Verified vendors listing (store discovery)
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_verified
  ON public.profiles (role, is_verified)
  WHERE role = 'vendor' AND is_verified = true;

-- --------------------------------------------------------------------------
-- notifications – unread count badge (very frequent)
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE is_read = false;

-- All notifications for a user (notification inbox)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- --------------------------------------------------------------------------
-- carts / cart_items (created in previous migration)
-- --------------------------------------------------------------------------
-- Already added in migration 20260527000002; listed here as documentation.
-- idx_carts_user_id, idx_cart_items_cart_id, idx_cart_items_product_id

-- --------------------------------------------------------------------------
-- deliveries – driver tracking
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_status
  ON public.deliveries (driver_id, status)
  WHERE driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_order_id
  ON public.deliveries (order_id);

-- --------------------------------------------------------------------------
-- login_attempts – rate-limit lookups (if table exists)
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'login_attempts'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
               ON public.login_attempts (email, attempted_at)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time
               ON public.login_attempts (ip_address, attempted_at)';
  END IF;
END;
$$;

-- --------------------------------------------------------------------------
-- role_change_audit_log
-- --------------------------------------------------------------------------
-- Already created in migration 20260527000001.

COMMIT;
