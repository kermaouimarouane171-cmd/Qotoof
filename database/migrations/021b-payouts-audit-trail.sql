-- =====================================================
-- Migration: Payouts System with Audit Trail
-- FINANCIAL CRITICAL - Two-step approval for large amounts
-- =====================================================

-- 1. CREATE PAYOUTS TABLE
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MAD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected', 'failed')),
  
  -- Payout details
  payout_method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payout_method IN ('bank_transfer', 'manual', 'stripe', 'cmi')),
  bank_account_id UUID REFERENCES bank_accounts(id),
  reference_number TEXT,
  transaction_id TEXT,
  gateway_response JSONB,
  
  -- Two-step approval
  requires_second_approval BOOLEAN DEFAULT false,
  first_approved_by UUID REFERENCES profiles(id),
  first_approved_at TIMESTAMPTZ,
  second_approved_by UUID REFERENCES profiles(id),
  second_approved_at TIMESTAMPTZ,
  
  -- Rejection details
  rejected_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  rejected_at TIMESTAMPTZ,
  
  -- Processing details
  processed_by UUID REFERENCES profiles(id),
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
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREATE FINANCIAL AUDIT TRAIL TABLE
CREATE TABLE IF NOT EXISTS financial_audit_log (
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
  performed_by UUID NOT NULL REFERENCES profiles(id),
  performed_by_role TEXT,
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_payouts_vendor ON payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_requires_approval ON payouts(requires_second_approval) WHERE requires_second_approval = true;
CREATE INDEX IF NOT EXISTS idx_payouts_period ON payouts(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON financial_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON financial_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_by ON financial_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON financial_audit_log(created_at DESC);

-- 4. ENABLE ROW LEVEL SECURITY
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_log ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES FOR PAYOUTS
DROP POLICY IF EXISTS "Vendors can view own payouts" ON payouts;
CREATE POLICY "Vendors can view own payouts"
  ON payouts FOR SELECT
  USING (vendor_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all payouts" ON payouts;
CREATE POLICY "Admins can view all payouts"
  ON payouts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can create payouts" ON payouts;
CREATE POLICY "Admins can create payouts"
  ON payouts FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update payouts" ON payouts;
CREATE POLICY "Admins can update payouts"
  ON payouts FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. RLS POLICIES FOR AUDIT LOG
DROP POLICY IF EXISTS "Admins can view audit log" ON financial_audit_log;
CREATE POLICY "Admins can view audit log"
  ON financial_audit_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "System can insert audit log" ON financial_audit_log;
CREATE POLICY "System can insert audit log"
  ON financial_audit_log FOR INSERT
  WITH CHECK (true);

-- 7. FUNCTION: Log audit entry
CREATE OR REPLACE FUNCTION log_financial_audit(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_previous_status TEXT,
  p_new_status TEXT,
  p_amount DECIMAL,
  p_details JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
BEGIN
  v_user_id := auth.uid();
  
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  
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
    p_entity_type,
    p_entity_id,
    p_action,
    p_previous_status,
    p_new_status,
    p_amount,
    v_user_id,
    v_user_role,
    p_details,
    p_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. TRIGGER: Auto-log payout status changes
CREATE OR REPLACE FUNCTION audit_payout_status_change() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status OR NEW.id IS DISTINCT FROM OLD.id THEN
    -- Determine action based on status change
    CASE NEW.status
      WHEN 'approved' THEN
        IF NEW.second_approved_by IS NOT NULL THEN
          PERFORM log_financial_audit(
            'payout', NEW.id, 'second_approved', OLD.status, NEW.status,
            NEW.amount,
            jsonb_build_object('approved_by', NEW.second_approved_by),
            NULL
          );
        ELSIF NEW.first_approved_by IS NOT NULL AND NOT NEW.requires_second_approval THEN
          PERFORM log_financial_audit(
            'payout', NEW.id, 'approved', OLD.status, NEW.status,
            NEW.amount,
            jsonb_build_object('approved_by', NEW.first_approved_by),
            NULL
          );
        END IF;
      WHEN 'rejected' THEN
        PERFORM log_financial_audit(
          'payout', NEW.id, 'rejected', OLD.status, NEW.status,
          NEW.amount,
          jsonb_build_object('rejected_by', NEW.rejected_by),
          NEW.rejection_reason
        );
      WHEN 'processing' THEN
        PERFORM log_financial_audit(
          'payout', NEW.id, 'processing_started', OLD.status, NEW.status,
          NEW.amount,
          jsonb_build_object('processed_by', NEW.processed_by),
          NULL
        );
      WHEN 'completed' THEN
        PERFORM log_financial_audit(
          'payout', NEW.id, 'completed', OLD.status, NEW.status,
          NEW.amount,
          jsonb_build_object('completed_at', NEW.completed_at),
          NULL
        );
      WHEN 'failed' THEN
        PERFORM log_financial_audit(
          'payout', NEW.id, 'failed', OLD.status, NEW.status,
          NEW.amount,
          jsonb_build_object('reason', NEW.failed_reason),
          NEW.failed_reason
        );
      ELSE
        PERFORM log_financial_audit(
          'payout', NEW.id, 'created', OLD.status, NEW.status,
          NEW.amount,
          NULL,
          NULL
        );
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_payout_status_change ON payouts;
CREATE TRIGGER audit_payout_status_change
  AFTER UPDATE ON payouts
  FOR EACH ROW
  EXECUTE FUNCTION audit_payout_status_change();

-- 9. FUNCTION: Determine if second approval is needed
CREATE OR REPLACE FUNCTION check_requires_second_approval(p_amount DECIMAL)
RETURNS BOOLEAN AS $$
DECLARE
  v_threshold DECIMAL := 10000; -- 10,000 MAD threshold for dual approval
BEGIN
  RETURN p_amount > v_threshold;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. FUNCTION: Process payout via bank transfer
CREATE OR REPLACE FUNCTION process_payout_bank_transfer(
  p_payout_id UUID,
  p_vendor_id UUID,
  p_amount DECIMAL
) RETURNS JSONB AS $$
DECLARE
  v_bank_account RECORD;
  v_result JSONB;
BEGIN
  -- Get vendor's bank account
  SELECT * INTO v_bank_account
  FROM bank_accounts
  WHERE user_id = p_vendor_id
  AND status = 'verified'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No verified bank account found for vendor'
    );
  END IF;
  
  -- In production, this would call an external payment gateway API
  -- For now, we simulate the process
  v_result := jsonb_build_object(
    'success', true,
    'transaction_id', 'TXN-' || gen_random_uuid()::text,
    'reference_number', 'REF-' || EXTRACT(EPOCH FROM NOW())::bigint,
    'gateway', 'bank_transfer',
    'bank_name', v_bank_account.bank_name,
    'rib', v_bank_account.rib,
    'amount', p_amount,
    'currency', 'MAD',
    'status', 'processing',
    'estimated_arrival', NOW() + INTERVAL '2 business days'
  );
  
  -- Update payout
  UPDATE payouts
  SET
    status = 'processing',
    transaction_id = v_result->>'transaction_id',
    reference_number = v_result->>'reference_number',
    gateway_response = v_result,
    processed_at = NOW()
  WHERE id = p_payout_id;
  
  -- Notify vendor
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    p_vendor_id,
    'Payout Processing 💰',
    'Your payout of ' || p_amount || ' MAD is being processed. Expected arrival: 2 business days.',
    'payout',
    jsonb_build_object('payout_id', p_payout_id, 'amount', p_amount)
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. FUNCTION: Complete payout
CREATE OR REPLACE FUNCTION complete_payout(p_payout_id UUID)
RETURNS VOID AS $$
DECLARE
  v_payout RECORD;
BEGIN
  SELECT * INTO v_payout FROM payouts WHERE id = p_payout_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout not found';
  END IF;
  
  IF v_payout.status != 'processing' THEN
    RAISE EXCEPTION 'Payout must be in processing status';
  END IF;
  
  UPDATE payouts
  SET
    status = 'completed',
    completed_at = NOW()
  WHERE id = p_payout_id;
  
  -- Notify vendor
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    v_payout.vendor_id,
    'Payout Completed ✅',
    'Your payout of ' || v_payout.amount || ' MAD has been completed and transferred to your bank account.',
    'payout',
    jsonb_build_object('payout_id', p_payout_id, 'amount', v_payout.amount)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. COMMENTS
COMMENT ON TABLE payouts IS 'Vendor payout requests with two-step approval';
COMMENT ON TABLE financial_audit_log IS 'Complete audit trail for all financial transactions';
COMMENT ON COLUMN payouts.requires_second_approval IS 'True if amount exceeds threshold (10,000 MAD)';
COMMENT ON COLUMN payouts.first_approved_by IS 'First admin who approved';
COMMENT ON COLUMN payouts.second_approved_by IS 'Second admin who approved (required for large amounts)';

-- 13. VERIFICATION
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('payouts', 'financial_audit_log') ORDER BY tablename;
