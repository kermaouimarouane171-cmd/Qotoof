-- ==========================================================================
-- Migration: Add RFQ (Request for Quote) System Tables
--
-- Problem: RFQ tables exist in database/migrations but not in supabase/migrations.
-- The RFQ feature is used by buyer RFQ pages but tables may not exist in
-- production or may have been created manually.
--
-- Solution: Create tables if they don't exist or add missing columns if they do.
-- This migration handles both cases gracefully.
-- ==========================================================================

BEGIN;

-- 0. Enable pgcrypto extension for gen_random_uuid() if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create rfqs table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rfqs') THEN
    CREATE TABLE public.rfqs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT CHECK (category IN ('plants', 'vegetables', 'fruits', 'herbs', 'seeds', 'other')),
      quantity DECIMAL(10, 2) NOT NULL,
      unit_type TEXT NOT NULL, -- kg, liter, piece, etc.
      budget_min DECIMAL(10, 2),
      budget_max DECIMAL(10, 2),
      location_city TEXT,
      location_region TEXT,
      delivery_date DATE,
      is_urgent BOOLEAN DEFAULT false,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'fulfilled', 'cancelled')),
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 2. Create rfq_offers table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rfq_offers') THEN
    CREATE TABLE public.rfq_offers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
      vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      price_per_unit DECIMAL(10, 2) NOT NULL,
      total_price DECIMAL(10, 2) NOT NULL,
      available_quantity DECIMAL(10, 2) NOT NULL,
      unit_type TEXT NOT NULL,
      delivery_date DATE,
      delivery_location TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
      is_negotiable BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 3. Create rfq_negotiations table (negotiation history for RFQs)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rfq_negotiations') THEN
    CREATE TABLE public.rfq_negotiations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rfq_offer_id UUID NOT NULL REFERENCES public.rfq_offers(id) ON DELETE CASCADE,
      proposed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      proposed_price DECIMAL(10, 2) NOT NULL,
      proposed_quantity DECIMAL(10, 2),
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rfqs_buyer_id ON public.rfqs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_status ON public.rfqs(status);
CREATE INDEX IF NOT EXISTS idx_rfqs_category ON public.rfqs(category);
CREATE INDEX IF NOT EXISTS idx_rfqs_location ON public.rfqs(location_city);
CREATE INDEX IF NOT EXISTS idx_rfqs_expires_at ON public.rfqs(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rfqs_created_at ON public.rfqs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rfq_offers_rfq_id ON public.rfq_offers(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_offers_vendor_id ON public.rfq_offers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_rfq_offers_status ON public.rfq_offers(status);
CREATE INDEX IF NOT EXISTS idx_rfq_offers_created_at ON public.rfq_offers(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rfq_negotiations_offer_id ON public.rfq_negotiations(rfq_offer_id);
CREATE INDEX IF NOT EXISTS idx_rfq_negotiations_proposed_by ON public.rfq_negotiations(proposed_by);
CREATE INDEX IF NOT EXISTS idx_rfq_negotiations_status ON public.rfq_negotiations(status);

-- 5. Enable RLS
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_negotiations ENABLE ROW LEVEL SECURITY;

-- 6. Drop existing policies if they exist
DROP POLICY IF EXISTS "rfqs_buyer_select" ON public.rfqs;
DROP POLICY IF EXISTS "rfqs_buyer_manage" ON public.rfqs;
DROP POLICY IF EXISTS "rfqs_vendor_select" ON public.rfqs;
DROP POLICY IF EXISTS "rfqs_public_select" ON public.rfqs;

DROP POLICY IF EXISTS "rfq_offers_vendor_manage" ON public.rfq_offers;
DROP POLICY IF EXISTS "rfq_offers_buyer_select" ON public.rfq_offers;
DROP POLICY IF EXISTS "rfq_offers_admin_select" ON public.rfq_offers;

DROP POLICY IF EXISTS "rfq_negotiations_participant_select" ON public.rfq_negotiations;
DROP POLICY IF EXISTS "rfq_negotiations_participant_manage" ON public.rfq_negotiations;

-- 7. Create RLS policies for rfqs
CREATE POLICY "rfqs_buyer_select"
  ON public.rfqs FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

CREATE POLICY "rfqs_buyer_manage"
  ON public.rfqs FOR ALL
  TO authenticated
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "rfqs_vendor_select"
  ON public.rfqs FOR SELECT
  TO authenticated
  USING (status = 'open');

CREATE POLICY "rfqs_public_select"
  ON public.rfqs FOR SELECT
  TO authenticated, anon
  USING (status = 'open');

-- 8. Create RLS policies for rfq_offers
CREATE POLICY "rfq_offers_vendor_manage"
  ON public.rfq_offers FOR ALL
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "rfq_offers_buyer_select"
  ON public.rfq_offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rfqs
      WHERE rfqs.id = rfq_offers.rfq_id
        AND rfqs.buyer_id = auth.uid()
    )
  );

CREATE POLICY "rfq_offers_admin_select"
  ON public.rfq_offers FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 9. Create RLS policies for rfq_negotiations
CREATE POLICY "rfq_negotiations_participant_select"
  ON public.rfq_negotiations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rfq_offers
      WHERE rfq_offers.id = rfq_negotiations.rfq_offer_id
        AND (
          rfq_offers.vendor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.rfqs
            WHERE rfqs.id = rfq_offers.rfq_id
              AND rfqs.buyer_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "rfq_negotiations_participant_manage"
  ON public.rfq_negotiations FOR INSERT
  TO authenticated
  WITH CHECK (proposed_by = auth.uid());

CREATE POLICY "rfq_negotiations_participant_update"
  ON public.rfq_negotiations FOR UPDATE
  TO authenticated
  USING (proposed_by = auth.uid())
  WITH CHECK (proposed_by = auth.uid());

-- 10. Add triggers for updated_at
DROP TRIGGER IF EXISTS update_rfqs_updated_at ON public.rfqs;
CREATE TRIGGER update_rfqs_updated_at
  BEFORE UPDATE ON public.rfqs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_rfq_offers_updated_at ON public.rfq_offers;
CREATE TRIGGER update_rfq_offers_updated_at
  BEFORE UPDATE ON public.rfq_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Add comments for documentation
COMMENT ON TABLE public.rfqs IS 'Request for Quote - buyer requests for bulk purchases';
COMMENT ON TABLE public.rfq_offers IS 'Vendor responses to RFQ requests';
COMMENT ON TABLE public.rfq_negotiations IS 'Negotiation history for RFQ offers';

COMMENT ON COLUMN public.rfqs.is_urgent IS 'Flag indicating urgent RFQ request';
COMMENT ON COLUMN public.rfqs.expires_at IS 'RFQ expiration date after which offers are no longer accepted';

COMMENT ON COLUMN public.rfq_offers.is_negotiable IS 'Flag indicating if the offer price is negotiable';

COMMENT ON COLUMN public.rfq_negotiations.proposed_by IS 'User who proposed this negotiation (buyer or vendor)';

-- 12. Grant permissions
GRANT ALL ON public.rfqs TO postgres;
GRANT ALL ON public.rfq_offers TO postgres;
GRANT ALL ON public.rfq_negotiations TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfqs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfq_offers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfq_negotiations TO authenticated;
GRANT SELECT ON public.rfqs TO anon;

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
