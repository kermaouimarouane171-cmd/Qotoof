-- =============================================================================
-- Migration: Add missing deliveries columns + create driver stats/earnings RPCs
--
-- Problem: The deliveries table is missing 3 columns that the application code
--          (Earnings.jsx, Wallet.jsx, useDriverQueries.js) expects:
--          - delivery_price (NUMERIC) — used in earnings calculations
--          - payout_status (TEXT) — used in wallet to track pending vs paid
--          - completed_at (TIMESTAMPTZ) — used to filter completed deliveries
--
--          Additionally, two RPC functions called in useDriverQueries.js
--          (get_driver_stats, get_driver_earnings) don't exist in the database.
--
-- Note on status enum:
--   delivery_status enum has: unassigned, assigned, accepted, picked_up,
--   on_the_way, delivered, failed
--   Code also references 'completed' (Wallet.jsx:36) but this value does NOT
--   exist in the enum. RPCs use 'delivered' only (the actual enum value).
--
-- Security:
--   Both RPCs use SECURITY DEFINER with auth check (caller = driver_user_id
--   OR caller is admin) to prevent cross-user data access.
-- =============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Add missing columns to deliveries
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS delivery_price NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'paid', 'failed')),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Index for driver earnings queries (driver_id + status + completed_at)
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_status_completed
  ON public.deliveries(driver_id, status, completed_at DESC)
  WHERE status = 'delivered';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. get_driver_stats — aggregate stats for a driver
--    Called: rpc('get_driver_stats', { driver_user_id: UUID })
--    Returns: JSON with total/completed/pending deliveries + earnings breakdown
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_driver_stats(driver_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: authentication required';
  END IF;

  IF auth.uid() != driver_user_id AND caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: can only view own stats';
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_deliveries', COUNT(*),
      'completed_deliveries', COUNT(*) FILTER (WHERE status = 'delivered'),
      'pending_deliveries', COUNT(*) FILTER (
        WHERE status NOT IN ('delivered', 'failed')
      ),
      'total_earnings', COALESCE(
        SUM(delivery_price) FILTER (WHERE status = 'delivered'), 0
      ),
      'pending_earnings', COALESCE(
        SUM(delivery_price) FILTER (
          WHERE status = 'delivered'
            AND (payout_status IS NULL OR payout_status = 'pending')
        ), 0
      ),
      'paid_earnings', COALESCE(
        SUM(delivery_price) FILTER (
          WHERE status = 'delivered' AND payout_status = 'paid'
        ), 0
      ),
      'first_delivery_date', MIN(created_at),
      'last_delivery_date', MAX(created_at)
    )
    FROM public.deliveries
    WHERE driver_id = driver_user_id
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. get_driver_earnings — earnings breakdown by time period
--    Called: rpc('get_driver_earnings', { driver_user_id: UUID, time_period: TEXT })
--    time_period: 'week', 'month', 'year', 'all' (default: 'month')
--    Returns: JSON with period totals
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_driver_earnings(
  driver_user_id UUID,
  time_period TEXT DEFAULT 'month'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  period_start TIMESTAMPTZ;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: authentication required';
  END IF;

  IF auth.uid() != driver_user_id AND caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: can only view own earnings';
  END IF;

  period_start := CASE
    WHEN time_period = 'week'  THEN date_trunc('week', NOW())
    WHEN time_period = 'month' THEN date_trunc('month', NOW())
    WHEN time_period = 'year'  THEN date_trunc('year', NOW())
    ELSE '1970-01-01'::timestamptz
  END;

  RETURN (
    SELECT json_build_object(
      'period', time_period,
      'total_earnings', COALESCE(SUM(delivery_price), 0),
      'delivery_count', COUNT(*),
      'average_earnings', CASE WHEN COUNT(*) > 0
        THEN COALESCE(SUM(delivery_price), 0) / COUNT(*)
        ELSE 0 END,
      'pending_payout', COALESCE(SUM(delivery_price) FILTER (
        WHERE payout_status IS NULL OR payout_status = 'pending'
      ), 0),
      'paid_out', COALESCE(SUM(delivery_price) FILTER (
        WHERE payout_status = 'paid'
      ), 0)
    )
    FROM public.deliveries
    WHERE driver_id = driver_user_id
      AND status = 'delivered'
      AND (
        time_period = 'all' OR
        COALESCE(completed_at, delivered_at, created_at) >= period_start
      )
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_driver_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_earnings(UUID, TEXT) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ deliveries: added delivery_price, payout_status, completed_at columns';
  RAISE NOTICE '✅ get_driver_stats(UUID) RPC created with auth check';
  RAISE NOTICE '✅ get_driver_earnings(UUID, TEXT) RPC created with auth check';
END $$;
