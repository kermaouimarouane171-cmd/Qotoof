-- =============================================
-- Migration 035: update_payout_status_transactional RPC
-- Phase 8.6 — R-002 Transactional Payout Status Update
--
-- Makes payout status update + financial audit log atomic.
-- If audit insert fails, payout status update rolls back.
-- Notification remains best-effort (client-side, outside transaction).
-- =============================================

-- Set safe search_path for SECURITY DEFINER
SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION update_payout_status_transactional(
  p_payout_id UUID,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
  v_admin_role TEXT;
  v_previous_status TEXT;
  v_amount DECIMAL(10, 2);
  v_vendor_id UUID;
BEGIN
  -- 1. Verify current user is admin
  SELECT role INTO v_admin_role FROM profiles WHERE id = auth.uid();
  IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'not_authorized',
      'message', 'Only admins can update payout status'
    );
  END IF;

  -- 2. Lock the payout row for concurrent safety
  SELECT status, amount, vendor_id INTO v_payout
  FROM payouts WHERE id = p_payout_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'payout_not_found',
      'message', 'Payout not found'
    );
  END IF;

  v_previous_status := v_payout.status;
  v_amount := v_payout.amount;
  v_vendor_id := v_payout.vendor_id;

  -- 3. No-op if status hasn't changed
  IF v_previous_status = p_new_status THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'no_status_change',
      'message', 'Payout status is already ' || p_new_status
    );
  END IF;

  -- 4. Update payout status (within transaction)
  UPDATE payouts
  SET status = p_new_status, updated_at = NOW()
  WHERE id = p_payout_id;

  -- 5. Insert financial audit log (within same transaction)
  --    If this fails, the UPDATE above rolls back automatically.
  INSERT INTO financial_audit_log (
    entity_type,
    entity_id,
    action,
    previous_status,
    new_status,
    amount,
    performed_by,
    performed_by_role,
    details,
    reason
  ) VALUES (
    'payout',
    p_payout_id,
    'manual_adjustment',
    v_previous_status,
    p_new_status,
    v_amount,
    auth.uid(),
    v_admin_role,
    jsonb_build_object(
      'updated_by', auth.uid(),
      'new_status', p_new_status
    ) || COALESCE(p_details, '{}'::jsonb),
    p_reason
  );

  -- 6. Return structured success result
  RETURN jsonb_build_object(
    'success', true,
    'error_code', null,
    'message', 'Payout status updated successfully',
    'payout_id', p_payout_id,
    'previous_status', v_previous_status,
    'new_status', p_new_status,
    'audit_logged', true,
    'vendor_id', v_vendor_id,
    'amount', v_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (RLS + admin check inside RPC)
GRANT EXECUTE ON FUNCTION update_payout_status_transactional(UUID, TEXT, TEXT, JSONB) TO authenticated;

-- Revoke from anon (no anonymous access)
REVOKE EXECUTE ON FUNCTION update_payout_status_transactional(UUID, TEXT, TEXT, JSONB) FROM anon;
