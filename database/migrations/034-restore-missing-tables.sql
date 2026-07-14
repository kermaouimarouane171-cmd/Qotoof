-- =====================================================
-- Migration 034: Restore Missing Tables
-- Phase 8.3 — Critical Production Blockers Triage
--
-- This migration addresses three production blockers:
--   PB-001: payouts table may have been dropped by migration 030
--   PB-002: fraud_reports table was never created
--   PB-003: refunds table was never created
--
-- All CREATE TABLE IF NOT EXISTS — safe for fresh and existing installs.
-- =====================================================

-- =============================================
-- PB-001: Ensure payouts table exists
-- (originally created in 021b, was dropped by 030 in line 1440)
-- =============================================
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MAD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected', 'failed')),

  payout_method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payout_method IN ('bank_transfer', 'manual', 'stripe', 'cmi')),
  bank_account_id UUID REFERENCES bank_accounts(id),
  reference_number TEXT,
  transaction_id TEXT,
  gateway_response JSONB,

  requires_second_approval BOOLEAN DEFAULT false,
  first_approved_by UUID REFERENCES profiles(id),
  first_approved_at TIMESTAMPTZ,
  second_approved_by UUID REFERENCES profiles(id),
  second_approved_at TIMESTAMPTZ,

  rejected_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  rejected_at TIMESTAMPTZ,

  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_reason TEXT,

  period_start DATE,
  period_end DATE,
  orders_count INTEGER DEFAULT 0,
  orders_ids UUID[],
  notes TEXT,

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Restore indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_payouts_vendor ON payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_requires_approval ON payouts(requires_second_approval) WHERE requires_second_approval = true;
CREATE INDEX IF NOT EXISTS idx_payouts_period ON payouts(period_start, period_end);

-- Restore RLS on payouts
ALTER TABLE IF EXISTS payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors can view own payouts" ON payouts;
CREATE POLICY "Vendors can view own payouts"
  ON payouts FOR SELECT TO authenticated
  USING (vendor_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all payouts" ON payouts;
CREATE POLICY "Admins can view all payouts"
  ON payouts FOR SELECT TO authenticated
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can create payouts" ON payouts;
CREATE POLICY "Admins can create payouts"
  ON payouts FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can update payouts" ON payouts;
CREATE POLICY "Admins can update payouts"
  ON payouts FOR UPDATE TO authenticated
  USING (public.is_current_user_admin());

-- Restore audit trigger (idempotent)
-- Uses log_financial_audit() RPC from 021b for correct CHECK constraint compliance
-- and SECURITY DEFINER context (handles performed_by via auth.uid())
CREATE OR REPLACE FUNCTION audit_payout_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status OR NEW.id IS DISTINCT FROM OLD.id THEN
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

COMMENT ON TABLE payouts IS 'Vendor payout requests with two-step approval';

-- =============================================
-- PB-002: Create fraud_reports table
-- (referenced by fraudReportService.js, types in database.ts)
-- =============================================
CREATE TABLE IF NOT EXISTS fraud_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reporter_role TEXT NOT NULL,
  reported_user_role TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN (
    'missing_items', 'wrong_condition', 'fake_delivery',
    'payment_fraud', 'identity_fraud', 'other'
  )),
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'high' CHECK (priority IN ('medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'reviewing', 'action_required', 'resolved', 'dismissed'
  )),
  legal_recommendation TEXT,
  evidence_paths TEXT[] DEFAULT '{}',
  awareness_notified_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_reports_reporter ON fraud_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_fraud_reports_reported_user ON fraud_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_reports_status ON fraud_reports(status);
CREATE INDEX IF NOT EXISTS idx_fraud_reports_order ON fraud_reports(order_id);
CREATE INDEX IF NOT EXISTS idx_fraud_reports_created_at ON fraud_reports(created_at DESC);

ALTER TABLE fraud_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fraud_reports_reporter_select" ON fraud_reports;
CREATE POLICY "fraud_reports_reporter_select"
  ON fraud_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR reported_user_id = auth.uid() OR public.is_current_user_admin());

DROP POLICY IF EXISTS "fraud_reports_authenticated_insert" ON fraud_reports;
CREATE POLICY "fraud_reports_authenticated_insert"
  ON fraud_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "fraud_reports_admin_update" ON fraud_reports;
CREATE POLICY "fraud_reports_admin_update"
  ON fraud_reports FOR UPDATE TO authenticated
  USING (public.is_current_user_admin());

COMMENT ON TABLE fraud_reports IS 'Fraud incident reports with admin review workflow';

-- =============================================
-- PB-003: Create refunds table
-- (referenced by paymentGateway.js recordRefund method)
-- =============================================
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  gateway_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at DESC);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refunds_admin_select" ON refunds;
CREATE POLICY "refunds_admin_select"
  ON refunds FOR SELECT TO authenticated
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "refunds_admin_insert" ON refunds;
CREATE POLICY "refunds_admin_insert"
  ON refunds FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "refunds_admin_update" ON refunds;
CREATE POLICY "refunds_admin_update"
  ON refunds FOR UPDATE TO authenticated
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "refunds_buyer_vendor_select" ON refunds;
CREATE POLICY "refunds_buyer_vendor_select"
  ON refunds FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = refunds.order_id
      AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid())
    )
  );

COMMENT ON TABLE refunds IS 'Refund records linked to payments for audit trail';

-- =============================================
-- Verification
-- =============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 034 Complete!';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  ✓ Ensured payouts table exists (PB-001)';
  RAISE NOTICE '  ✓ Created fraud_reports table (PB-002)';
  RAISE NOTICE '  ✓ Created refunds table (PB-003)';
  RAISE NOTICE '  ✓ RLS policies applied to all three tables';
END $$;
