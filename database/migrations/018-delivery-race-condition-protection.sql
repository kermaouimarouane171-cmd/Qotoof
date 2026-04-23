-- ============================================
-- Delivery Race Condition Protection
-- Adds database-level guards to prevent
-- double-accept and invalid state transitions
-- ============================================

-- 1. Trigger to prevent double-accept of deliveries
CREATE OR REPLACE FUNCTION public.prevent_delivery_double_accept()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is changing to 'accepted', ensure it was 'assigned'
  IF NEW.status = 'accepted' AND OLD.status != 'assigned' THEN
    RAISE EXCEPTION 'Delivery can only be accepted if it is in assigned status. Current status: %', OLD.status
    USING ERRCODE = 'unique_violation';
  END IF;

  -- If status is changing to 'picked_up', ensure it was 'accepted'
  IF NEW.status = 'picked_up' AND OLD.status != 'accepted' THEN
    RAISE EXCEPTION 'Delivery can only be picked up if it has been accepted. Current status: %', OLD.status
    USING ERRCODE = 'check_violation';
  END IF;

  -- If status is changing to 'on_the_way', ensure it was 'picked_up'
  IF NEW.status = 'on_the_way' AND OLD.status != 'picked_up' THEN
    RAISE EXCEPTION 'Delivery can only be marked on_the_way if it has been picked up. Current status: %', OLD.status
    USING ERRCODE = 'check_violation';
  END IF;

  -- If status is changing to 'delivered', ensure it was 'on_the_way'
  IF NEW.status = 'delivered' AND OLD.status != 'on_the_way' THEN
    RAISE EXCEPTION 'Delivery can only be marked delivered if it is on_the_way. Current status: %', OLD.status
    USING ERRCODE = 'check_violation';
  END IF;

  -- If driver_id is being set, ensure it wasn't already set to a different driver
  IF NEW.driver_id IS NOT NULL AND OLD.driver_id IS NOT NULL AND NEW.driver_id != OLD.driver_id THEN
    RAISE EXCEPTION 'Delivery driver cannot be changed once assigned. Current driver: %', OLD.driver_id
    USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS delivery_state_transition ON deliveries;
CREATE TRIGGER delivery_state_transition
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_delivery_double_accept();

-- 2. Function to safely accept a delivery (atomic operation)
-- This can be called via RPC for guaranteed atomicity
CREATE OR REPLACE FUNCTION public.safe_accept_delivery(
  p_delivery_id UUID,
  p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_current_driver UUID;
  v_order_id UUID;
BEGIN
  -- Get current state with row lock
  SELECT status, driver_id, order_id
  INTO v_current_status, v_current_driver, v_order_id
  FROM deliveries
  WHERE id = p_delivery_id
  FOR UPDATE; -- Row-level lock

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery not found');
  END IF;

  -- Check if already accepted
  IF v_current_status != 'assigned' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery is not in assigned status. Current status: ' || v_current_status
    );
  END IF;

  -- Check if already assigned to a different driver
  IF v_current_driver IS NOT NULL AND v_current_driver != p_driver_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery already assigned to another driver'
    );
  END IF;

  -- Accept the delivery
  UPDATE deliveries
  SET
    status = 'accepted',
    accepted_at = NOW(),
    driver_id = p_driver_id
  WHERE id = p_delivery_id;

  -- Update order status
  UPDATE orders
  SET status = 'driver_accepted'
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'delivery_id', p_delivery_id,
    'order_id', v_order_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Index for faster status lookups during accept
CREATE INDEX IF NOT EXISTS idx_deliveries_status_id ON deliveries(status, id)
  WHERE status IN ('assigned', 'unassigned');

-- Notify success
DO $$
BEGIN
  RAISE NOTICE '✅ Delivery race condition protection enabled!';
  RAISE NOTICE '   - delivery_state_transition trigger created';
  RAISE NOTICE '   - safe_accept_delivery() RPC function created (uses SELECT FOR UPDATE)';
  RAISE NOTICE '   - Prevents: double-accept, invalid state transitions, driver swapping';
END $$;
