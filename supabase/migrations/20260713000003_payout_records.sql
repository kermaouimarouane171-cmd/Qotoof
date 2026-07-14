-- ============================================
-- Migration: Create payout_records table
-- Tracks pending payouts to vendor/driver bank accounts
-- in Morocco. These are processed via Stripe Global Payouts
-- or manual bank transfer after the buyer pays via Stripe Checkout.
-- ============================================

CREATE TABLE IF NOT EXISTS public.payout_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('vendor', 'driver')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'MAD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'stripe_global_payout', 'manual')),
  stripe_payment_intent_id TEXT,
  stripe_payout_id TEXT,
  stripe_transfer_id TEXT,
  failure_reason TEXT,
  processed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payout_records_order_id ON public.payout_records(order_id);
CREATE INDEX IF NOT EXISTS idx_payout_records_recipient_id ON public.payout_records(recipient_id);
CREATE INDEX IF NOT EXISTS idx_payout_records_status ON public.payout_records(status);
CREATE INDEX IF NOT EXISTS idx_payout_records_recipient_type ON public.payout_records(recipient_type);

-- Unique constraint: one payout per order per recipient_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_records_unique_order_recipient
  ON public.payout_records(order_id, recipient_type)
  WHERE order_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.payout_records ENABLE ROW LEVEL SECURITY;

-- Policy: users can see their own payout records
CREATE POLICY "payout_records_select_own" ON public.payout_records
  FOR SELECT USING (
    recipient_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid())
  );

-- Policy: only service role (Edge Functions) can insert/update
CREATE POLICY "payout_records_insert_service" ON public.payout_records
  FOR INSERT WITH CHECK (true);

CREATE POLICY "payout_records_update_service" ON public.payout_records
  FOR UPDATE USING (true);

-- Policy: admins can see all payouts
CREATE POLICY "payout_records_select_admin" ON public.payout_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_payout_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payout_records_updated_at ON public.payout_records;
CREATE TRIGGER trigger_payout_records_updated_at
  BEFORE UPDATE ON public.payout_records
  FOR EACH ROW EXECUTE FUNCTION public.update_payout_records_updated_at();
