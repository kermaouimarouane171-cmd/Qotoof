-- ============================================
-- Migration 018: RFQ (Request for Quote) System
-- Enables B2B buyers to post procurement needs
-- and vendors to respond with competitive offers.
-- Part of Qotoof Phase 2 product roadmap.
-- ============================================

-- -----------------------------------------------
-- 1. rfqs table — buyer posts a procurement need
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS rfqs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL CHECK (category IN ('vegetables', 'fruits', 'plants', 'herbs', 'seeds')),
  quantity        NUMERIC(12, 2) NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'kg',
  budget_max      NUMERIC(12, 2),          -- optional max budget in MAD
  city            TEXT,
  deadline        DATE,                    -- last date for offers
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'closed', 'expired', 'cancelled')),
  winning_offer_id UUID,                   -- set when buyer accepts an offer
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfqs_buyer     ON rfqs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_status    ON rfqs(status);
CREATE INDEX IF NOT EXISTS idx_rfqs_category  ON rfqs(category);
CREATE INDEX IF NOT EXISTS idx_rfqs_created   ON rfqs(created_at DESC);

-- -----------------------------------------------
-- 2. rfq_offers table — vendor submits a price offer
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS rfq_offers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id          UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  price_per_unit  NUMERIC(12, 2) NOT NULL,
  total_price     NUMERIC(12, 2) GENERATED ALWAYS AS (
                    price_per_unit * (SELECT quantity FROM rfqs WHERE id = rfq_id)
                  ) STORED,
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rfq_id, vendor_id)               -- one offer per vendor per RFQ
);

CREATE INDEX IF NOT EXISTS idx_rfq_offers_rfq    ON rfq_offers(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_offers_vendor ON rfq_offers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_rfq_offers_status ON rfq_offers(status);

-- -----------------------------------------------
-- 3. Auto-expire rfqs past deadline (trigger helper)
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION expire_past_deadline_rfqs()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE rfqs
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'open'
    AND deadline IS NOT NULL
    AND deadline < CURRENT_DATE;
END;
$$;

-- updated_at auto-refresh
CREATE OR REPLACE FUNCTION set_rfq_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rfq_updated_at ON rfqs;
CREATE TRIGGER trg_rfq_updated_at
  BEFORE UPDATE ON rfqs
  FOR EACH ROW EXECUTE FUNCTION set_rfq_updated_at();

-- -----------------------------------------------
-- 4. RLS policies
-- -----------------------------------------------
ALTER TABLE rfqs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_offers ENABLE ROW LEVEL SECURITY;

-- Buyers: full control over own RFQs
CREATE POLICY "Buyers can manage own rfqs"
  ON rfqs FOR ALL
  TO authenticated
  USING  (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

-- Anyone authenticated can read open RFQs (vendor browsing)
CREATE POLICY "Authenticated users can view open rfqs"
  ON rfqs FOR SELECT
  TO authenticated
  USING (status = 'open' OR buyer_id = auth.uid());

-- Vendors: can submit and manage own offers
CREATE POLICY "Vendors can manage own offers"
  ON rfq_offers FOR ALL
  TO authenticated
  USING  (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- Buyers: can read all offers on their RFQs
CREATE POLICY "Buyers can view offers on own rfqs"
  ON rfq_offers FOR SELECT
  TO authenticated
  USING (
    rfq_id IN (SELECT id FROM rfqs WHERE buyer_id = auth.uid())
  );

-- Vendors: can read all offers on the same RFQ (to see competition level)
CREATE POLICY "Vendors can view offer count on open rfqs"
  ON rfq_offers FOR SELECT
  TO authenticated
  USING (
    rfq_id IN (SELECT id FROM rfqs WHERE status = 'open')
  );

-- -----------------------------------------------
-- 5. Verification notice
-- -----------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '=== Migration 018: RFQ System ===';
  RAISE NOTICE '   - rfqs table created';
  RAISE NOTICE '   - rfq_offers table created';
  RAISE NOTICE '   - RLS policies applied';
  RAISE NOTICE '   - Auto-expire function registered';
END;
$$;
