-- ============================================
-- Add commission columns for all parties
-- ============================================
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add buyer commission columns to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS buyer_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS buyer_total NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS vendor_amount NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS driver_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS driver_amount NUMERIC(10, 2);

-- 2. Create commission tracking table
CREATE TABLE IF NOT EXISTS platform_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) NOT NULL,
  buyer_id UUID REFERENCES profiles(id),
  vendor_id UUID REFERENCES profiles(id),
  driver_id UUID REFERENCES profiles(id),
  subtotal NUMERIC(10, 2) NOT NULL,
  buyer_commission NUMERIC(10, 2) DEFAULT 0,
  buyer_commission_rate NUMERIC(5, 2) DEFAULT 2.00,
  vendor_commission NUMERIC(10, 2) DEFAULT 0,
  vendor_commission_rate NUMERIC(5, 2) DEFAULT 2.00,
  vendor_amount NUMERIC(10, 2),
  driver_commission NUMERIC(10, 2) DEFAULT 0,
  driver_commission_rate NUMERIC(5, 2) DEFAULT 2.00,
  driver_amount NUMERIC(10, 2),
  total_platform_revenue NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create index for commission queries
CREATE INDEX IF NOT EXISTS idx_commissions_order ON platform_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_buyer ON platform_commissions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_commissions_vendor ON platform_commissions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_commissions_driver ON platform_commissions(driver_id);

-- 4. Create function to calculate total platform revenue
CREATE OR REPLACE FUNCTION calculate_platform_revenue(
  buyer_comm NUMERIC,
  vendor_comm NUMERIC,
  driver_comm NUMERIC
) RETURNS NUMERIC AS $$
BEGIN
  RETURN COALESCE(buyer_comm, 0) + COALESCE(vendor_comm, 0) + COALESCE(driver_comm, 0);
END;
$$ LANGUAGE plpgsql;

-- 5. Create view for platform revenue summary
CREATE OR REPLACE VIEW platform_revenue_summary AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_orders,
  SUM(buyer_commission) as total_buyer_commissions,
  SUM(vendor_commission) as total_vendor_commissions,
  SUM(driver_commission) as total_driver_commissions,
  SUM(calculate_platform_revenue(buyer_commission, vendor_commission, driver_commission)) as total_platform_revenue
FROM platform_commissions
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- 6. Enable RLS
ALTER TABLE platform_commissions ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies
CREATE POLICY "Admins can view all commissions"
  ON platform_commissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view own commissions"
  ON platform_commissions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = buyer_id OR
    auth.uid() = vendor_id OR
    auth.uid() = driver_id
  );

-- ============================================
-- COMMISSION STRUCTURE (2% each):
-- ============================================
-- Buyer pays:    Subtotal + 2% (platform fee)
-- Vendor gets:   Subtotal - 2% (platform fee)
-- Driver gets:   Delivery Fee - 2% (platform fee)
--
-- Example for MAD 500 order:
-- Buyer pays:    MAD 510.00 (500 + 10)
-- Vendor gets:   MAD 490.00 (500 - 10)
-- Platform gets: MAD 20.00 (10 from buyer + 10 from vendor)
-- ============================================
