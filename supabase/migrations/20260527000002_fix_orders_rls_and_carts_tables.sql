-- ==========================================================================
-- Migration: Enable RLS on orders + carts tables
-- ==========================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. ORDERS table – enable RLS and define isolation policies
-- --------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- SELECT
-- · Buyer sees their own orders
DROP POLICY IF EXISTS "orders_buyer_select" ON public.orders;
CREATE POLICY "orders_buyer_select"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

-- · Vendor sees orders that contain their products
--   (join through order_items)
DROP POLICY IF EXISTS "orders_vendor_select" ON public.orders;
CREATE POLICY "orders_vendor_select"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    vendor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = orders.id
        AND p.vendor_id = auth.uid()
    )
  );

-- · Driver sees orders assigned to them
DROP POLICY IF EXISTS "orders_driver_select" ON public.orders;
CREATE POLICY "orders_driver_select"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- · Admin sees everything
DROP POLICY IF EXISTS "orders_admin_select" ON public.orders;
CREATE POLICY "orders_admin_select"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- INSERT: only authenticated buyers can place orders
DROP POLICY IF EXISTS "orders_buyer_insert" ON public.orders;
CREATE POLICY "orders_buyer_insert"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    AND public.current_user_role() = 'buyer'
  );

-- Allow service_role to insert on behalf of user (Edge Function / checkout)
DROP POLICY IF EXISTS "orders_service_insert" ON public.orders;
CREATE POLICY "orders_service_insert"
  ON public.orders
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- UPDATE: vendors update fulfillment status, drivers update delivery status,
--         buyers can cancel within window, admin updates anything.
DROP POLICY IF EXISTS "orders_vendor_update" ON public.orders;
CREATE POLICY "orders_vendor_update"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    vendor_id = auth.uid()
    AND public.current_user_role() = 'vendor'
  )
  WITH CHECK (vendor_id = auth.uid());

DROP POLICY IF EXISTS "orders_driver_update" ON public.orders;
CREATE POLICY "orders_driver_update"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    driver_id = auth.uid()
    AND public.current_user_role() = 'driver'
  )
  WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS "orders_buyer_update" ON public.orders;
CREATE POLICY "orders_buyer_update"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    buyer_id = auth.uid()
    AND public.current_user_role() = 'buyer'
    -- Buyer can only cancel (allowed by application layer, enforced here by uid match)
  )
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "orders_admin_update" ON public.orders;
CREATE POLICY "orders_admin_update"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "orders_service_update" ON public.orders;
CREATE POLICY "orders_service_update"
  ON public.orders
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- DELETE: admin only (soft-delete preferred; hard-delete only via service_role)
DROP POLICY IF EXISTS "orders_admin_delete" ON public.orders;
CREATE POLICY "orders_admin_delete"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "orders_service_delete" ON public.orders;
CREATE POLICY "orders_service_delete"
  ON public.orders
  FOR DELETE
  TO service_role
  USING (true);

-- --------------------------------------------------------------------------
-- 2. ORDER_ITEMS table – enable RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
CREATE POLICY "order_items_select"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user can see the parent order
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.buyer_id  = auth.uid()
          OR o.vendor_id = auth.uid()
          OR o.driver_id = auth.uid()
          OR public.current_user_role() = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = order_items.product_id
              AND p.vendor_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "order_items_insert_service" ON public.order_items;
CREATE POLICY "order_items_insert_service"
  ON public.order_items
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "order_items_update_service" ON public.order_items;
CREATE POLICY "order_items_update_service"
  ON public.order_items
  FOR UPDATE
  TO service_role
  USING (true);

-- --------------------------------------------------------------------------
-- 3. PROFILES – prevent `role` column update via a column-level check.
--    The trigger in migration 20260527000001 blocks it, but as defence-in-
--    depth we also use a CHECK policy so the database itself rejects it even
--    if the trigger is bypassed.
-- --------------------------------------------------------------------------
-- (RLS already re-enabled in previous migration; policies already defined.)

-- --------------------------------------------------------------------------
-- 4. CARTS + CART_ITEMS tables – create if not exist, enable RLS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.carts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id      UUID        NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id   UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity     NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_snapshot NUMERIC(10, 2),          -- price at time of add (for display only; final price re-fetched at checkout)
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, product_id)
);

DO $$
DECLARE
  has_cart_id BOOLEAN;
  has_user_id BOOLEAN;
  has_price_snapshot BOOLEAN;
  has_added_at BOOLEAN;
  has_updated_at BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cart_items' AND column_name = 'cart_id'
  ) INTO has_cart_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cart_items' AND column_name = 'user_id'
  ) INTO has_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cart_items' AND column_name = 'price_snapshot'
  ) INTO has_price_snapshot;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cart_items' AND column_name = 'added_at'
  ) INTO has_added_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cart_items' AND column_name = 'updated_at'
  ) INTO has_updated_at;

  IF NOT has_cart_id THEN
    ALTER TABLE public.cart_items ADD COLUMN cart_id UUID;
  END IF;

  IF NOT has_price_snapshot THEN
    ALTER TABLE public.cart_items ADD COLUMN price_snapshot NUMERIC(10, 2);
  END IF;

  IF NOT has_added_at THEN
    ALTER TABLE public.cart_items ADD COLUMN added_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  IF NOT has_updated_at THEN
    ALTER TABLE public.cart_items ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  IF has_user_id THEN
    INSERT INTO public.carts (user_id)
    SELECT DISTINCT user_id
    FROM public.cart_items
    WHERE user_id IS NOT NULL
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.cart_items ci
    SET cart_id = c.id
    FROM public.carts c
    WHERE ci.cart_id IS NULL
      AND ci.user_id = c.user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cart_items WHERE cart_id IS NULL
  ) THEN
    RAISE EXCEPTION 'cart_items contains rows that cannot be mapped to carts.cart_id';
  END IF;

  ALTER TABLE public.cart_items
    ALTER COLUMN cart_id SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cart_items'::regclass
      AND conname = 'cart_items_cart_id_fkey'
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_cart_id_fkey
      FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_cart_product_unique
  ON public.cart_items (cart_id, product_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_carts_user_id
  ON public.carts (user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id
  ON public.cart_items (cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id
  ON public.cart_items (product_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_carts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_carts_updated_at ON public.carts;
CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_carts();

DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_carts();

-- Auto-create cart for new users
CREATE OR REPLACE FUNCTION public.create_cart_for_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.carts (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_create_cart_on_signup ON public.profiles;
CREATE TRIGGER trg_create_cart_on_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_cart_for_new_user();

-- Backfill: create carts for existing users who don't have one
INSERT INTO public.carts (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- RLS on carts
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carts_owner" ON public.carts;
CREATE POLICY "carts_owner"
  ON public.carts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "carts_service" ON public.carts;
CREATE POLICY "carts_service"
  ON public.carts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS on cart_items
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_items_owner" ON public.cart_items;
CREATE POLICY "cart_items_owner"
  ON public.cart_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cart_items_service" ON public.cart_items;
CREATE POLICY "cart_items_service"
  ON public.cart_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 5. Expire stale cart items (older than 30 days) – scheduled by pg_cron
--    Run: SELECT cron.schedule('cart-cleanup', '0 3 * * *', 'SELECT public.cleanup_stale_cart_items()');
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_stale_cart_items()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM public.cart_items
  WHERE added_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMIT;
