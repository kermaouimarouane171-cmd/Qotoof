-- ============================================
-- Add vendor compliance columns to profiles
-- ============================================
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add vendor compliance columns
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS vendor_guidelines_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vendor_guidelines_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS vendor_compliance_score NUMERIC(5, 2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS vendor_warning_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vendor_suspension_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vendor_last_violation_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS vendor_fulfillment_rate NUMERIC(5, 2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS vendor_avg_response_hours NUMERIC(5, 2),
ADD COLUMN IF NOT EXISTS vendor_on_time_delivery_rate NUMERIC(5, 2) DEFAULT 100.00;

-- 2. Add product compliance columns
ALTER TABLE products
ADD COLUMN IF NOT EXISTS description_quality_score NUMERIC(5, 2),
ADD COLUMN IF NOT EXISTS last_stock_update_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stock_accuracy_rate NUMERIC(5, 2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS price_fairness_flag BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS compliance_notes TEXT;

-- 3. Add order fulfillment tracking
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS vendor_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS vendor_prepared_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS fulfillment_deadline_hours INTEGER DEFAULT 48,
ADD COLUMN IF NOT EXISTS fulfillment_met_deadline BOOLEAN,
ADD COLUMN IF NOT EXISTS vendor_cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS vendor_compliance_flag TEXT DEFAULT 'compliant';

-- Add missing enum values (handled by migration 003b)

-- 4. Create index for vendor compliance queries
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_guidelines ON profiles(vendor_guidelines_accepted) WHERE role = 'vendor';
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_deadline ON orders(created_at, fulfillment_deadline_hours);

-- 5. Create vendor compliance log table
CREATE TABLE IF NOT EXISTS vendor_compliance_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES profiles(id) NOT NULL,
  violation_type TEXT NOT NULL CHECK (violation_type IN ('inaccurate_description', 'overpricing', 'stock_mismatch', 'late_fulfillment', 'order_cancellation', 'legal_violation')),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'minor', 'major', 'critical')),
  description TEXT NOT NULL,
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  action_taken TEXT CHECK (action_taken IN ('warning', 'suspension_7d', 'suspension_30d', 'termination', 'fine')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES profiles(id)
);

-- 6. Create indexes for compliance log
CREATE INDEX IF NOT EXISTS idx_compliance_log_vendor ON vendor_compliance_log(vendor_id);
CREATE INDEX IF NOT EXISTS idx_compliance_log_type ON vendor_compliance_log(violation_type);
CREATE INDEX IF NOT EXISTS idx_compliance_log_severity ON vendor_compliance_log(severity);

-- 7. Enable RLS
ALTER TABLE vendor_compliance_log ENABLE ROW LEVEL SECURITY;

-- 8. RLS policies
CREATE POLICY "Vendors can view own compliance log"
  ON vendor_compliance_log FOR SELECT
  TO authenticated
  USING (auth.uid() = vendor_id);

CREATE POLICY "Admins can view all compliance logs"
  ON vendor_compliance_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert compliance logs"
  ON vendor_compliance_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- NOTES:
-- ============================================
-- Fulfillment deadline: 48 hours default
-- Compliance score: 100 = perfect, decreases with violations
-- Warning thresholds:
--   - 3 warnings = 7-day suspension
--   - 5 warnings = 30-day suspension
--   - 10 warnings = permanent termination
-- ============================================
