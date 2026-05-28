-- Migration: Prevent client-side write of payment status columns on orders
--
-- Problem: The CMI payment gateway callback in paymentGateway.js performs a
-- client-side UPDATE to orders.payment_status = 'paid' after the CMI return
-- page is reached.  Because the orders_buyer_update RLS policy has no column
-- restriction, any buyer with a valid JWT can manually call:
--
--   supabase.from('orders').update({ payment_status: 'paid' }).eq('id', myOrderId)
--
-- and fraudulently mark an unpaid order as paid.
--
-- Fix:
--   1. Trigger function prevent_payment_status_client_write that blocks
--      UPDATE of payment_status / first_payment_status / second_payment_status
--      unless the caller is the postgres superuser or the service_role
--      (i.e., no regular authenticated user can touch these columns).
--   2. Move the CMI client-side update to a SECURITY DEFINER RPC
--      confirm_cmi_payment(p_transaction_id, p_order_id) that verifies the
--      transaction exists and was successfully recorded in the payments table
--      before updating the order status.
--
-- Note on the RPC approach: the existing CMI flow already writes a row to the
-- payments table (via the .update({ status, ... }).eq('transaction_id', oid)
-- call just before the orders.update call).  The RPC below uses that as the
-- proof of payment before promoting the order status.

-- ── 1. Trigger to block direct client payment-status writes ─────────────────

CREATE OR REPLACE FUNCTION public.prevent_payment_status_client_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow postgres / service_role (used by Edge Functions and server-side code)
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- Block any attempted write to the payment status columns
  IF (NEW.payment_status         IS DISTINCT FROM OLD.payment_status)
  OR (NEW.first_payment_status   IS DISTINCT FROM OLD.first_payment_status)
  OR (NEW.second_payment_status  IS DISTINCT FROM OLD.second_payment_status)
  THEN
    RAISE EXCEPTION
      'Direct update of payment status columns is not permitted from the client. '
      'Use the server-side confirm_cmi_payment() RPC instead.'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  RETURN NEW;
END;
$$;

-- Apply trigger to orders table (BEFORE UPDATE so the block takes effect before any write)
DROP TRIGGER IF EXISTS trg_prevent_payment_status_client_write ON public.orders;

CREATE TRIGGER trg_prevent_payment_status_client_write
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_payment_status_client_write();

-- ── 2. SECURITY DEFINER RPC to safely confirm CMI payment ───────────────────
--
-- Called by the frontend CMI callback handler INSTEAD of the direct orders.update.
-- Parameters:
--   p_transaction_id  — the CMI transaction OID / reference
--   p_order_id        — the order UUID to promote
--
-- Security checks performed inside:
--   • The calling user is authenticated (auth.uid() is not null)
--   • A payment row for p_transaction_id exists and has status = 'completed'
--   • The payment row's order_id matches p_order_id (prevents cross-order attacks)
--   • The order's buyer_id matches auth.uid() (the caller owns the order)
-- Only when ALL checks pass is payment_status updated (via postgres/DEFINER).

CREATE OR REPLACE FUNCTION public.confirm_cmi_payment(
  p_transaction_id TEXT,
  p_order_id       UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_order   RECORD;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Look up the completed payment record
  SELECT id, order_id, status, amount
  INTO   v_payment
  FROM   public.payments
  WHERE  transaction_id = p_transaction_id
    AND  status         = 'completed'
  LIMIT  1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No completed payment found for transaction %', p_transaction_id
      USING ERRCODE = '22023'; -- invalid_parameter_value
  END IF;

  -- Verify the payment is for the claimed order
  IF v_payment.order_id <> p_order_id THEN
    RAISE EXCEPTION 'Payment does not belong to the specified order'
      USING ERRCODE = '22023';
  END IF;

  -- Verify the caller owns the order
  SELECT id, buyer_id, payment_status
  INTO   v_order
  FROM   public.orders
  WHERE  id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = '22023';
  END IF;

  IF v_order.buyer_id <> auth.uid() THEN
    RAISE EXCEPTION 'You do not own this order' USING ERRCODE = '42501';
  END IF;

  -- All checks passed — update via DEFINER (bypasses the trigger check above)
  UPDATE public.orders
  SET    payment_status = 'paid',
         updated_at     = NOW()
  WHERE  id = p_order_id;

  RETURN json_build_object(
    'success', TRUE,
    'order_id', p_order_id
  );
END;
$$;

-- Grant execute only to authenticated users (not anon)
GRANT EXECUTE ON FUNCTION public.confirm_cmi_payment(TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.confirm_cmi_payment IS
  'Server-side confirmation of CMI gateway payment. '
  'Validates transaction, order ownership, and payment completeness before '
  'updating orders.payment_status. Replaces the previous client-side UPDATE.';
