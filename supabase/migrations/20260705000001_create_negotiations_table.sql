-- ==========================================================================
-- Migration: Create price_negotiations table
--
-- Enables buyer ↔ vendor price negotiation on a specific product.
-- Max 3 rounds, 24-hour expiry per offer, auto-conversion to order on accept.
--
-- Uses existing shippingCalculator logic (distance + delivery fee) so
-- negotiation totals stay consistent with normal checkout.
-- ==========================================================================

BEGIN;

-- ── Enum for negotiation status ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE negotiation_status AS ENUM (
    'pending',     -- awaiting response from the other party
    'accepted',    -- offer accepted, ready to convert to order + pay
    'rejected',    -- offer rejected, negotiation closed
    'countered',   -- counter-offer made, awaiting response
    'expired',     -- 24h passed without response
    'converted'    -- accepted offer has been turned into a real order
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE negotiation_offer_by AS ENUM ('buyer', 'vendor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.price_negotiations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties & product
  product_id          UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Pricing
  original_price      NUMERIC(12,2) NOT NULL DEFAULT 0,   -- product's listed price
  proposed_price      NUMERIC(12,2) NOT NULL DEFAULT 0,   -- latest proposed price
  proposed_quantity   INTEGER       NOT NULL DEFAULT 1,

  -- Round tracking
  offer_by            negotiation_offer_by NOT NULL DEFAULT 'buyer',
  status              negotiation_status   NOT NULL DEFAULT 'pending',
  round_number        INTEGER              NOT NULL DEFAULT 1,
  max_rounds          INTEGER              NOT NULL DEFAULT 3,
  expires_at          TIMESTAMPTZ          NOT NULL DEFAULT (now() + interval '24 hours'),

  -- Delivery (auto-calculated via shippingCalculator)
  delivery_price      NUMERIC(12,2) DEFAULT 0,
  delivery_distance_km NUMERIC(8,2)  DEFAULT NULL,

  -- Optional notes
  buyer_note          TEXT DEFAULT NULL,
  vendor_note         TEXT DEFAULT NULL,

  -- Order conversion
  converted_order_id  UUID REFERENCES public.orders(id) ON DELETE SET NULL,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_negotiations_buyer   ON public.price_negotiations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_vendor  ON public.price_negotiations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_product ON public.price_negotiations(product_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_status  ON public.price_negotiations(status);
CREATE INDEX IF NOT EXISTS idx_negotiations_expires ON public.price_negotiations(expires_at);

-- ── Updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_negotiation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_negotiations_updated_at ON public.price_negotiations;
CREATE TRIGGER trg_negotiations_updated_at
  BEFORE UPDATE ON public.price_negotiations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_negotiation_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.price_negotiations ENABLE ROW LEVEL SECURITY;

-- Buyer can see only their own negotiations
DROP POLICY IF EXISTS negotiations_buyer_select ON public.price_negotiations;
CREATE POLICY negotiations_buyer_select
  ON public.price_negotiations
  FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

-- Vendor can see only negotiations targeting them
DROP POLICY IF EXISTS negotiations_vendor_select ON public.price_negotiations;
CREATE POLICY negotiations_vendor_select
  ON public.price_negotiations
  FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

-- Buyer can insert (create new negotiation)
DROP POLICY IF EXISTS negotiations_buyer_insert ON public.price_negotiations;
CREATE POLICY negotiations_buyer_insert
  ON public.price_negotiations
  FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

-- Buyer can update their own negotiations (counter, accept, etc.)
DROP POLICY IF EXISTS negotiations_buyer_update ON public.price_negotiations;
CREATE POLICY negotiations_buyer_update
  ON public.price_negotiations
  FOR UPDATE
  TO authenticated
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

-- Vendor can update negotiations targeting them (counter, accept, reject)
DROP POLICY IF EXISTS negotiations_vendor_update ON public.price_negotiations;
CREATE POLICY negotiations_vendor_update
  ON public.price_negotiations
  FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- ── Auto-expire function (callable from cron or on-load) ───────────────────
CREATE OR REPLACE FUNCTION public.expire_stale_negotiations()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.price_negotiations
    SET status = 'expired'
    WHERE status IN ('pending', 'countered')
      AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ── Grant execute on expire function ───────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.expire_stale_negotiations() TO authenticated;

-- ── Cron schedule (uses pg_cron if available) ──────────────────────────────
-- Runs every 15 minutes to auto-expire stale negotiations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'expire-negotiations',
      '*/15 * * * *',
      $$SELECT public.expire_stale_negotiations();$$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMIT;
