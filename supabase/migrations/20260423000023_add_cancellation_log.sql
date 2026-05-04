BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS buyer_cancellation_reason TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS public.cancellation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  requested_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cancellation_log_order_unique
  ON public.cancellation_log(order_id);

CREATE INDEX IF NOT EXISTS idx_cancellation_log_buyer
  ON public.cancellation_log(buyer_id, cancelled_at DESC);

CREATE INDEX IF NOT EXISTS idx_cancellation_log_vendor
  ON public.cancellation_log(vendor_id, cancelled_at DESC);

CREATE OR REPLACE FUNCTION public.set_cancellation_log_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancellation_log_updated_at ON public.cancellation_log;
CREATE TRIGGER trg_cancellation_log_updated_at
  BEFORE UPDATE ON public.cancellation_log
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cancellation_log_updated_at();

CREATE OR REPLACE FUNCTION public.sync_cancellation_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status IS NULL OR NEW.status::text <> 'cancelled') AND NEW.cancelled_at IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.cancellation_log (
    order_id,
    buyer_id,
    vendor_id,
    cancelled_by,
    cancellation_reason,
    requested_at,
    cancelled_at,
    metadata
  ) VALUES (
    NEW.id,
    NEW.buyer_id,
    NEW.vendor_id,
    NEW.cancelled_by,
    COALESCE(NEW.buyer_cancellation_reason, NEW.cancellation_reason),
    NEW.cancellation_requested_at,
    COALESCE(NEW.cancelled_at, NOW()),
    jsonb_build_object(
      'status', NEW.status,
      'payment_status', COALESCE(to_jsonb(NEW) ->> 'payment_status', 'pending'),
      'order_number', NEW.order_number
    )
  )
  ON CONFLICT (order_id) DO UPDATE
  SET
    buyer_id = EXCLUDED.buyer_id,
    vendor_id = EXCLUDED.vendor_id,
    cancelled_by = EXCLUDED.cancelled_by,
    cancellation_reason = EXCLUDED.cancellation_reason,
    requested_at = EXCLUDED.requested_at,
    cancelled_at = EXCLUDED.cancelled_at,
    metadata = public.cancellation_log.metadata || EXCLUDED.metadata,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cancellation_log ON public.orders;
CREATE TRIGGER trg_sync_cancellation_log
  AFTER INSERT OR UPDATE OF status, cancelled_at, cancelled_by, cancellation_reason, buyer_cancellation_reason, cancellation_requested_at
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cancellation_log();

INSERT INTO public.cancellation_log (
  order_id,
  buyer_id,
  vendor_id,
  cancelled_by,
  cancellation_reason,
  requested_at,
  cancelled_at,
  metadata
)
SELECT
  orders.id,
  orders.buyer_id,
  orders.vendor_id,
  orders.cancelled_by,
  COALESCE(orders.buyer_cancellation_reason, orders.cancellation_reason),
  orders.cancellation_requested_at,
  COALESCE(orders.cancelled_at, orders.updated_at, orders.created_at, NOW()),
  jsonb_build_object(
    'status', orders.status,
    'payment_status', COALESCE(to_jsonb(orders) ->> 'payment_status', 'pending'),
    'order_number', orders.order_number
  )
FROM public.orders
WHERE orders.status::text = 'cancelled'
  OR orders.cancelled_at IS NOT NULL
ON CONFLICT (order_id) DO NOTHING;

ALTER TABLE public.cancellation_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cancellation_log'
      AND policyname = 'Users can view related cancellation logs'
  ) THEN
    CREATE POLICY "Users can view related cancellation logs"
      ON public.cancellation_log
      FOR SELECT
      USING (
        buyer_id = auth.uid()
        OR vendor_id = auth.uid()
        OR cancelled_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

COMMIT;