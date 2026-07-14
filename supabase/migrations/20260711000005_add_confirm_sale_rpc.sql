-- ============================================
-- RPC: confirm_sale_and_calculate_commission
-- (Phase 4A-4, P2-6: Make confirmSaleAndCalculate transactional)
--
-- Atomically inserts a confirmed_transaction and updates the
-- vendor_monthly_sales totals. If either step fails, the entire
-- operation rolls back.
--
-- Parameters:
--   p_order_id        UUID   — the order being confirmed
--   p_vendor_id       UUID   — the vendor who made the sale
--   p_buyer_id        UUID   — the buyer (nullable)
--   p_sale_amount     NUMERIC — the sale amount
--   p_commission_rate NUMERIC — the commission rate (e.g., 0.03 for 3%)
--   p_month           INT    — month (1-12)
--   p_year            INT    — year
--
-- Returns:
--   { success: boolean, monthly_sale_id: UUID, commission_amount: NUMERIC,
--     total_sales: NUMERIC, commission_due: NUMERIC,
--     already_recorded: boolean, existing_transaction_id: UUID }
-- ============================================

CREATE OR REPLACE FUNCTION confirm_sale_and_calculate_commission(
  p_order_id UUID,
  p_vendor_id UUID,
  p_sale_amount NUMERIC,
  p_month INT,
  p_year INT,
  p_buyer_id UUID DEFAULT NULL,
  p_commission_rate NUMERIC DEFAULT 0.03
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_tx RECORD;
  v_monthly_sale RECORD;
  v_commission_amount NUMERIC;
  v_updated_total_sales NUMERIC;
  v_updated_commission_due NUMERIC;
  v_result JSONB;
BEGIN
  -- 1. Check for existing transaction (idempotency)
  SELECT id, commission_amount, monthly_sale_id
    INTO v_existing_tx
    FROM confirmed_transactions
    WHERE order_id = p_order_id
    LIMIT 1;

  IF v_existing_tx.id IS NOT NULL THEN
    -- Return existing data without modifying anything
    SELECT * INTO v_monthly_sale
      FROM vendor_monthly_sales
      WHERE id = v_existing_tx.monthly_sale_id;

    SELECT jsonb_build_object(
      'success', true,
      'already_recorded', true,
      'existing_transaction_id', v_existing_tx.id,
      'commission_amount', COALESCE(v_existing_tx.commission_amount, 0),
      'monthly_sale_id', v_existing_tx.monthly_sale_id,
      'total_sales', COALESCE(v_monthly_sale.total_sales, 0),
      'commission_due', COALESCE(v_monthly_sale.commission_due, 0)
    ) INTO v_result;

    RETURN v_result;
  END IF;

  -- 2. Ensure monthly sale record exists
  SELECT * INTO v_monthly_sale
    FROM vendor_monthly_sales
    WHERE vendor_id = p_vendor_id AND month = p_month AND year = p_year;

  IF v_monthly_sale.id IS NULL THEN
    INSERT INTO vendor_monthly_sales (
      vendor_id, month, year, total_sales,
      commission_rate, commission_due, commission_paid, status
    ) VALUES (
      p_vendor_id, p_month, p_year, 0,
      p_commission_rate, 0, 0, 'active'
    )
    RETURNING * INTO v_monthly_sale;
  END IF;

  -- 3. Calculate commission
  v_commission_amount := ROUND(p_sale_amount * p_commission_rate, 2);

  -- 4. Insert confirmed transaction
  INSERT INTO confirmed_transactions (
    order_id, vendor_id, buyer_id, sale_amount,
    commission_amount, month, year, confirmed_at, monthly_sale_id
  ) VALUES (
    p_order_id, p_vendor_id, p_buyer_id, p_sale_amount,
    v_commission_amount, p_month, p_year, NOW(), v_monthly_sale.id
  );

  -- 5. Update monthly sale totals
  v_updated_total_sales := COALESCE(v_monthly_sale.total_sales, 0) + p_sale_amount;
  v_updated_commission_due := ROUND(v_updated_total_sales * p_commission_rate, 2);

  UPDATE vendor_monthly_sales
    SET total_sales = v_updated_total_sales,
        commission_due = v_updated_commission_due,
        status = 'active',
        updated_at = NOW()
    WHERE id = v_monthly_sale.id;

  -- 6. Return result
  SELECT jsonb_build_object(
    'success', true,
    'already_recorded', false,
    'monthly_sale_id', v_monthly_sale.id,
    'commission_amount', v_commission_amount,
    'total_sales', v_updated_total_sales,
    'commission_due', v_updated_commission_due
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION confirm_sale_and_calculate_commission TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Created confirm_sale_and_calculate_commission RPC (transactional)';
END $$;
