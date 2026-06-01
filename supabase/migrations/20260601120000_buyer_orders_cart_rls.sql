-- Buyer-scoped RLS for orders + carts (SELECT/INSERT/UPDATE own rows; no payment_status writes)

BEGIN;

-- ── ORDERS: buyer policies ──────────────────────────────────────────────────

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_buyer_select" ON public.orders;
CREATE POLICY "orders_buyer_select"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    buyer_id = auth.uid()
    AND public.current_user_role() = 'buyer'
  );

DROP POLICY IF EXISTS "orders_buyer_insert" ON public.orders;
CREATE POLICY "orders_buyer_insert"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    AND public.current_user_role() = 'buyer'
  );

DROP POLICY IF EXISTS "orders_buyer_update" ON public.orders;
CREATE POLICY "orders_buyer_update"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    buyer_id = auth.uid()
    AND public.current_user_role() = 'buyer'
  )
  WITH CHECK (
    buyer_id = auth.uid()
    AND public.current_user_role() = 'buyer'
  );

-- payment_status / first_payment_status / second_payment_status blocked by
-- trg_prevent_payment_status_client_write (migration 20260528000005)

-- ── CARTS: buyer owner ─────────────────────────────────────────────────────

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carts_owner" ON public.carts;
CREATE POLICY "carts_buyer_select"
  ON public.carts
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND public.current_user_role() = 'buyer'
  );

CREATE POLICY "carts_buyer_insert"
  ON public.carts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_role() = 'buyer'
  );

CREATE POLICY "carts_buyer_update"
  ON public.carts
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND public.current_user_role() = 'buyer'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_role() = 'buyer'
  );

DROP POLICY IF EXISTS "cart_items_owner" ON public.cart_items;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart_items_buyer_select"
  ON public.cart_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND c.user_id = auth.uid()
    )
    AND public.current_user_role() = 'buyer'
  );

CREATE POLICY "cart_items_buyer_insert"
  ON public.cart_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND c.user_id = auth.uid()
    )
    AND public.current_user_role() = 'buyer'
  );

CREATE POLICY "cart_items_buyer_update"
  ON public.cart_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND c.user_id = auth.uid()
    )
    AND public.current_user_role() = 'buyer'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND c.user_id = auth.uid()
    )
    AND public.current_user_role() = 'buyer'
  );

COMMIT;
