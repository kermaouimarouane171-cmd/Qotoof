-- ==========================================================================
-- Migration: Add Payouts Table and Financial Audit Log
--
-- Problem: Payouts table exists in database/migrations but not in supabase/migrations.
-- The table is used by adminPayouts service but may not exist in production
-- or may have been created manually, causing deployment risks.
--
-- Solution: Add missing columns to existing table or create new table if it doesn't exist.
-- This migration handles both cases gracefully.
-- ==========================================================================

BEGIN;

-- 1. Create payouts table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payouts') THEN
    CREATE TABLE public.payouts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      amount DECIMAL(10, 2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'MAD',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected', 'failed')),
      
      -- Payout details
      payout_method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payout_method IN ('bank_transfer', 'manual', 'stripe', 'cmi')),
      bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
      reference_number TEXT,
      transaction_id TEXT,
      gateway_response JSONB,
      
      -- Two-step approval for large amounts
      requires_second_approval BOOLEAN DEFAULT false,
      first_approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      first_approved_at TIMESTAMPTZ,
      second_approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      second_approved_at TIMESTAMPTZ,
      
      -- Rejection details
      rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      rejection_reason TEXT,
      rejected_at TIMESTAMPTZ,
      
      -- Processing details
      processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      processed_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      failed_reason TEXT,
      
      -- Metadata
      period_start DATE,
      period_end DATE,
      orders_count INTEGER DEFAULT 0,
      orders_ids UUID[],
      notes TEXT,
      
      -- Timestamps
      created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 2. Add missing columns to payouts table if they don't exist
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS payout_method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payout_method IN ('bank_transfer', 'manual', 'stripe', 'cmi')),
  ADD COLUMN IF NOT EXISTS bank_account_id UUID,
  ADD COLUMN IF NOT EXISTS reference_number TEXT,
  ADD COLUMN IF NOT EXISTS transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_response JSONB,
  ADD COLUMN IF NOT EXISTS requires_second_approval BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_approved_by UUID,
  ADD COLUMN IF NOT EXISTS first_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS second_approved_by UUID,
  ADD COLUMN IF NOT EXISTS second_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_by UUID,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_reason TEXT,
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end DATE,
  ADD COLUMN IF NOT EXISTS orders_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orders_ids UUID[],
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Add foreign key constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payouts_bank_account_id_fkey'
  ) THEN
    ALTER TABLE public.payouts 
    ADD CONSTRAINT payouts_bank_account_id_fkey 
    FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payouts_first_approved_by_fkey'
  ) THEN
    ALTER TABLE public.payouts 
    ADD CONSTRAINT payouts_first_approved_by_fkey 
    FOREIGN KEY (first_approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payouts_second_approved_by_fkey'
  ) THEN
    ALTER TABLE public.payouts 
    ADD CONSTRAINT payouts_second_approved_by_fkey 
    FOREIGN KEY (second_approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payouts_rejected_by_fkey'
  ) THEN
    ALTER TABLE public.payouts 
    ADD CONSTRAINT payouts_rejected_by_fkey 
    FOREIGN KEY (rejected_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payouts_processed_by_fkey'
  ) THEN
    ALTER TABLE public.payouts 
    ADD CONSTRAINT payouts_processed_by_fkey 
    FOREIGN KEY (processed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payouts_created_by_fkey'
  ) THEN
    ALTER TABLE public.payouts 
    ADD CONSTRAINT payouts_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create financial_audit_log table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financial_audit_log') THEN
    CREATE TABLE public.financial_audit_log (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      entity_type TEXT NOT NULL CHECK (entity_type IN ('payout', 'refund', 'commission', 'adjustment')),
      entity_id UUID NOT NULL,
      action TEXT NOT NULL CHECK (action IN (
        'created',
        'first_approved',
        'second_approved',
        'approved',
        'rejected',
        'processing_started',
        'completed',
        'failed',
        'gateway_error',
        'manual_adjustment',
        'cancelled'
      )),
      previous_status TEXT,
      new_status TEXT,
      amount DECIMAL(10, 2),
      performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      performed_by_role TEXT,
      ip_address INET,
      user_agent TEXT,
      details JSONB,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payouts_vendor_id ON public.payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON public.payouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_period ON public.payouts(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payouts_bank_account ON public.payouts(bank_account_id) WHERE bank_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_audit_entity ON public.financial_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_performed_by ON public.financial_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_financial_audit_created_at ON public.financial_audit_log(created_at DESC);

-- 4. Enable RLS
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if they exist (from manual migrations)
DROP POLICY IF EXISTS "Vendors can view own payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins can view all payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins can create payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins can update payouts" ON public.payouts;

DROP POLICY IF EXISTS "Users can view own financial audit logs" ON public.financial_audit_log;
DROP POLICY IF EXISTS "Admins can view all financial audit logs" ON public.financial_audit_log;

-- 6. Create RLS policies for payouts
CREATE POLICY "Vendors can view own payouts"
  ON public.payouts FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

CREATE POLICY "Admins can view all payouts"
  ON public.payouts FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can create payouts"
  ON public.payouts FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update payouts"
  ON public.payouts FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 7. Create RLS policies for financial_audit_log
CREATE POLICY "Users can view own financial audit logs"
  ON public.financial_audit_log FOR SELECT
  TO authenticated
  USING (performed_by = auth.uid());

CREATE POLICY "Admins can view all financial audit logs"
  ON public.financial_audit_log FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Service can insert financial audit logs"
  ON public.financial_audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 8. Add trigger for updated_at
DROP TRIGGER IF EXISTS update_payouts_updated_at ON public.payouts;
CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Add comments for documentation
COMMENT ON TABLE public.payouts IS 'Vendor payout records for commission payments and withdrawals';
COMMENT ON TABLE public.financial_audit_log IS 'Audit trail for all financial transactions (payouts, refunds, commissions, adjustments)';

COMMENT ON COLUMN public.payouts.requires_second_approval IS 'Flag indicating if payout requires two-step approval for large amounts';
COMMENT ON COLUMN public.payouts.first_approved_by IS 'First approver for two-step approval process';
COMMENT ON COLUMN public.payouts.second_approved_by IS 'Second approver for two-step approval process';
COMMENT ON COLUMN public.payouts.orders_ids IS 'Array of order IDs included in this payout period';

COMMENT ON COLUMN public.financial_audit_log.entity_type IS 'Type of entity being audited: payout, refund, commission, or adjustment';
COMMENT ON COLUMN public.financial_audit_log.action IS 'Action performed on the entity';
COMMENT ON COLUMN public.financial_audit_log.details IS 'Additional context stored as JSONB';

-- 10. Grant permissions
GRANT ALL ON public.payouts TO postgres;
GRANT ALL ON public.financial_audit_log TO postgres;
GRANT SELECT, INSERT, UPDATE ON public.payouts TO authenticated;
GRANT SELECT ON public.financial_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.financial_audit_log TO service_role;

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
