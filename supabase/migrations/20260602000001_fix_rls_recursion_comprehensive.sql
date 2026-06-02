-- Migration: Fix infinite recursion in RLS policies for profiles, products, orders, and related tables
-- Problem: several RLS policies were evaluating cross-table subqueries that
--          could trigger other policies on the same or related tables and
--          produce infinite recursion (42P17).
-- Fix:     centralize role checks and order-access checks in SECURITY DEFINER
--          helper functions with row_security=off, then recreate the relevant
--          product/order/profile/delivery policies safely.

BEGIN;

-- --------------------------------------------------------------------------
-- Core helper functions
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.current_user_is_order_buyer(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = p_order_id
      AND buyer_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_order_buyer(UUID) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.current_user_is_order_driver(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = p_order_id
      AND driver_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_order_driver(UUID) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.current_user_is_order_vendor(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id AND o.vendor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
      AND p.vendor_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_order_vendor(UUID) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.current_user_can_view_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT
    public.is_current_user_admin()
    OR public.current_user_is_order_buyer(p_order_id)
    OR public.current_user_is_order_driver(p_order_id)
    OR public.current_user_is_order_vendor(p_order_id);
$$;

GRANT EXECUTE ON FUNCTION public.current_user_can_view_order(UUID) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.current_user_shares_order_with_profile(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE (
      (o.buyer_id = auth.uid() AND (o.vendor_id = p_profile_id OR o.driver_id = p_profile_id))
      OR (o.vendor_id = auth.uid() AND (o.buyer_id = p_profile_id OR o.driver_id = p_profile_id))
      OR (o.driver_id = auth.uid() AND (o.buyer_id = p_profile_id OR o.vendor_id = p_profile_id))
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_shares_order_with_profile(UUID) TO authenticated, anon;

-- --------------------------------------------------------------------------
-- Products
-- --------------------------------------------------------------------------

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Public can view published products" ON public.products;
DROP POLICY IF EXISTS "Vendors can view own products" ON public.products;
DROP POLICY IF EXISTS "Vendors can view their own products" ON public.products;
DROP POLICY IF EXISTS "Vendors can manage own products" ON public.products;
DROP POLICY IF EXISTS "Vendors can insert own products" ON public.products;
DROP POLICY IF EXISTS "Vendors can update own products" ON public.products;
DROP POLICY IF EXISTS "Vendors can delete own products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage all products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;

CREATE POLICY "Public can view published products"
  ON public.products
  FOR SELECT
  USING (approval_status = 'published');

CREATE POLICY "Vendors can view their own products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

CREATE POLICY "Vendors can insert own products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'vendor'
        AND COALESCE(paypal_verified, FALSE) = TRUE
        AND NULLIF(TRIM(BOTH FROM paypal_email), '') IS NOT NULL
    )
  );

CREATE POLICY "Vendors can update own products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (
    vendor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'vendor'
        AND COALESCE(paypal_verified, FALSE) = TRUE
        AND NULLIF(TRIM(BOTH FROM paypal_email), '') IS NOT NULL
    )
  );

CREATE POLICY "Vendors can delete own products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (vendor_id = auth.uid());

CREATE POLICY "Admins can manage all products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (true);

-- --------------------------------------------------------------------------
-- Orders
-- --------------------------------------------------------------------------

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Vendors can update own orders" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_delete" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_select" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_update" ON public.orders;
DROP POLICY IF EXISTS "orders_buyer_insert" ON public.orders;
DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;
DROP POLICY IF EXISTS "orders_buyer_select" ON public.orders;
DROP POLICY IF EXISTS "orders_buyer_update" ON public.orders;
DROP POLICY IF EXISTS "orders_driver_select" ON public.orders;
DROP POLICY IF EXISTS "orders_driver_update" ON public.orders;
DROP POLICY IF EXISTS "orders_service_delete" ON public.orders;
DROP POLICY IF EXISTS "orders_service_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_service_update" ON public.orders;
DROP POLICY IF EXISTS "orders_vendor_select" ON public.orders;
DROP POLICY IF EXISTS "orders_vendor_update" ON public.orders;

CREATE POLICY "Admins can manage all orders"
  ON public.orders
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (true);

CREATE POLICY "Users can view own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    buyer_id = auth.uid()
    OR vendor_id = auth.uid()
    OR driver_id = auth.uid()
  );

CREATE POLICY "Vendors can view orders for their products"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    vendor_id = auth.uid()
    OR public.current_user_is_order_vendor(id)
  );

CREATE POLICY "Vendors can update own orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "Drivers can view assigned orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "Drivers can update assigned orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Buyers can create orders"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Service can delete orders"
  ON public.orders
  FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "Service can insert orders"
  ON public.orders
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service can update orders"
  ON public.orders
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- --------------------------------------------------------------------------
-- Order items
-- --------------------------------------------------------------------------

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_service" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update_service" ON public.order_items;

CREATE POLICY "Buyers can create order items"
  ON public.order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_items.order_id
        AND buyer_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own order items"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_order(order_items.order_id));

CREATE POLICY "Order items service access"
  ON public.order_items
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Order items service update"
  ON public.order_items
  FOR UPDATE
  TO service_role
  USING (true);

-- --------------------------------------------------------------------------
-- Deliveries
-- --------------------------------------------------------------------------

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers can update assigned deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "System can create deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Users can view own deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Vendors can assign drivers" ON public.deliveries;

CREATE POLICY "System can create deliveries"
  ON public.deliveries
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Drivers can update assigned deliveries"
  ON public.deliveries
  FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "Users can view own deliveries"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    driver_id = auth.uid()
    OR public.current_user_can_view_order(deliveries.order_id)
  );

CREATE POLICY "Vendors can assign drivers"
  ON public.deliveries
  FOR UPDATE
  TO authenticated
  USING (public.current_user_can_view_order(deliveries.order_id));

-- --------------------------------------------------------------------------
-- Profiles
-- --------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_order_participant" ON public.profiles;

CREATE POLICY "profiles_select_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());

CREATE POLICY "profiles_admin_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "profiles_select_order_participant"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.current_user_shares_order_with_profile(id));

COMMIT;
