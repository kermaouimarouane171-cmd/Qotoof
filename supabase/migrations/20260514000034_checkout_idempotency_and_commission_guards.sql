BEGIN;

CREATE TABLE IF NOT EXISTS public.checkout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  payload_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB,
  order_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (buyer_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_checkout_requests_status
  ON public.checkout_requests(status);

CREATE INDEX IF NOT EXISTS idx_checkout_requests_updated_at
  ON public.checkout_requests(updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_checkout_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.last_seen_at := NOW();

  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkout_requests_updated_at ON public.checkout_requests;
CREATE TRIGGER trg_checkout_requests_updated_at
  BEFORE UPDATE ON public.checkout_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_checkout_requests_updated_at();

CREATE OR REPLACE FUNCTION public.claim_checkout_request(
  p_buyer_id UUID,
  p_idempotency_key TEXT,
  p_request_hash TEXT DEFAULT NULL,
  p_payload_snapshot JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  request_id UUID,
  status TEXT,
  can_proceed BOOLEAN,
  cached_response JSONB,
  cached_order_ids UUID[],
  in_progress BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.checkout_requests%ROWTYPE;
  v_insert_count INTEGER := 0;
  v_normalized_key TEXT := BTRIM(COALESCE(p_idempotency_key, ''));
  v_normalized_hash TEXT := NULLIF(BTRIM(COALESCE(p_request_hash, '')), '');
  v_stale_cutoff TIMESTAMPTZ := NOW() - INTERVAL '10 minutes';
BEGIN
  IF p_buyer_id IS NULL OR v_normalized_key = '' THEN
    RAISE EXCEPTION 'checkout_request_identity_required';
  END IF;

  INSERT INTO public.checkout_requests (
    buyer_id,
    idempotency_key,
    request_hash,
    status,
    payload_snapshot,
    last_seen_at
  )
  VALUES (
    p_buyer_id,
    v_normalized_key,
    v_normalized_hash,
    'processing',
    COALESCE(p_payload_snapshot, '{}'::jsonb),
    NOW()
  )
  ON CONFLICT (buyer_id, idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_insert_count = ROW_COUNT;

  SELECT *
    INTO v_request
  FROM public.checkout_requests
  WHERE buyer_id = p_buyer_id
    AND idempotency_key = v_normalized_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'checkout_request_missing_after_claim';
  END IF;

  IF v_request.request_hash IS NOT NULL
     AND v_normalized_hash IS NOT NULL
     AND v_request.request_hash <> v_normalized_hash THEN
    RAISE EXCEPTION 'checkout_request_payload_mismatch';
  END IF;

  IF v_insert_count > 0 THEN
    RETURN QUERY
    SELECT
      v_request.id,
      v_request.status,
      TRUE,
      NULL::JSONB,
      COALESCE(v_request.order_ids, ARRAY[]::UUID[]),
      FALSE;
    RETURN;
  END IF;

  IF v_request.status = 'completed' THEN
    RETURN QUERY
    SELECT
      v_request.id,
      v_request.status,
      FALSE,
      v_request.response_payload,
      COALESCE(v_request.order_ids, ARRAY[]::UUID[]),
      FALSE;
    RETURN;
  END IF;

  IF v_request.status = 'processing'
     AND COALESCE(v_request.last_seen_at, v_request.updated_at, v_request.created_at) > v_stale_cutoff THEN
    RETURN QUERY
    SELECT
      v_request.id,
      v_request.status,
      FALSE,
      v_request.response_payload,
      COALESCE(v_request.order_ids, ARRAY[]::UUID[]),
      TRUE;
    RETURN;
  END IF;

  UPDATE public.checkout_requests
  SET status = 'processing',
      request_hash = COALESCE(v_normalized_hash, request_hash),
      payload_snapshot = COALESCE(p_payload_snapshot, payload_snapshot),
      response_payload = NULL,
      order_ids = ARRAY[]::UUID[],
      error_message = NULL,
      completed_at = NULL,
      last_seen_at = NOW()
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  RETURN QUERY
  SELECT
    v_request.id,
    v_request.status,
    TRUE,
    NULL::JSONB,
    COALESCE(v_request.order_ids, ARRAY[]::UUID[]),
    FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_checkout_request(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_checkout_request(UUID, TEXT, TEXT, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.record_confirmed_transaction(
  p_order_id UUID,
  p_vendor_id UUID,
  p_buyer_id UUID,
  p_sale_amount NUMERIC(12, 2),
  p_commission_rate NUMERIC(5, 4) DEFAULT 0.03,
  p_confirmed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  already_recorded BOOLEAN,
  commission_added NUMERIC(12, 2),
  total_this_month NUMERIC(12, 2),
  total_sales NUMERIC(12, 2),
  monthly_sale_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed_at TIMESTAMPTZ := COALESCE(p_confirmed_at, NOW());
  v_month INTEGER := EXTRACT(MONTH FROM v_confirmed_at)::INTEGER;
  v_year INTEGER := EXTRACT(YEAR FROM v_confirmed_at)::INTEGER;
  v_commission_rate NUMERIC(5, 4) := COALESCE(p_commission_rate, 0.03);
  v_monthly_sale public.vendor_monthly_sales%ROWTYPE;
  v_existing_transaction public.confirmed_transactions%ROWTYPE;
  v_commission_amount NUMERIC(12, 2);
  v_total_sales NUMERIC(12, 2);
  v_total_commission NUMERIC(12, 2);
  v_already_recorded BOOLEAN := FALSE;
BEGIN
  IF p_order_id IS NULL OR p_vendor_id IS NULL OR COALESCE(p_sale_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'confirmed_transaction_invalid_input';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::TEXT, 0));

  INSERT INTO public.vendor_monthly_sales (
    vendor_id,
    month,
    year,
    total_sales,
    commission_rate,
    commission_due,
    commission_paid,
    status
  )
  VALUES (
    p_vendor_id,
    v_month,
    v_year,
    0,
    v_commission_rate,
    0,
    0,
    'active'
  )
  ON CONFLICT (vendor_id, month, year)
  DO UPDATE SET commission_rate = EXCLUDED.commission_rate
  RETURNING * INTO v_monthly_sale;

  SELECT *
    INTO v_existing_transaction
  FROM public.confirmed_transactions
  WHERE order_id = p_order_id
  ORDER BY confirmed_at DESC NULLS LAST, id DESC
  LIMIT 1;

  IF FOUND THEN
    v_already_recorded := TRUE;
    v_commission_amount := COALESCE(v_existing_transaction.commission_amount, 0);
  ELSE
    v_commission_amount := ROUND(COALESCE(p_sale_amount, 0) * v_commission_rate, 2);

    INSERT INTO public.confirmed_transactions (
      order_id,
      vendor_id,
      buyer_id,
      sale_amount,
      commission_amount,
      month,
      year,
      confirmed_at,
      monthly_sale_id
    )
    VALUES (
      p_order_id,
      p_vendor_id,
      p_buyer_id,
      p_sale_amount,
      v_commission_amount,
      v_month,
      v_year,
      v_confirmed_at,
      v_monthly_sale.id
    )
    RETURNING * INTO v_existing_transaction;
  END IF;

  SELECT
    COALESCE(SUM(sale_amount), 0),
    COALESCE(SUM(commission_amount), 0)
  INTO v_total_sales, v_total_commission
  FROM public.confirmed_transactions
  WHERE monthly_sale_id = v_monthly_sale.id;

  UPDATE public.vendor_monthly_sales
  SET total_sales = ROUND(v_total_sales, 2),
      commission_due = ROUND(v_total_commission, 2),
      commission_rate = v_commission_rate,
      status = 'active'
  WHERE id = v_monthly_sale.id
  RETURNING * INTO v_monthly_sale;

  RETURN QUERY
  SELECT
    v_already_recorded,
    ROUND(v_commission_amount, 2),
    ROUND(COALESCE(v_monthly_sale.commission_due, 0), 2),
    ROUND(COALESCE(v_monthly_sale.total_sales, 0), 2),
    v_monthly_sale.id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_confirmed_transaction(UUID, UUID, UUID, NUMERIC, NUMERIC, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_confirmed_transaction(UUID, UUID, UUID, NUMERIC, NUMERIC, TIMESTAMPTZ) TO service_role;

COMMIT;