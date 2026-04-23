-- ============================================
-- Return Requests Table
-- Creates the return_requests table with proper
-- constraints, indexes, and RLS policies
-- ============================================

-- 1. Create the return_requests table
CREATE TABLE IF NOT EXISTS return_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
  items JSONB,
  image_urls JSONB,
  refund_amount DECIMAL(10, 2),
  admin_response TEXT,
  admin_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate returns for the same order by the same user
  CONSTRAINT unique_order_return UNIQUE (order_id, user_id)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_return_requests_user_id ON return_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_buyer_id ON return_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_vendor_id ON return_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_created_at ON return_requests(created_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Buyers can view their own returns
DROP POLICY IF EXISTS "Buyers can view own returns" ON return_requests;
CREATE POLICY "Buyers can view own returns"
  ON return_requests FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

-- Vendors can view returns for their orders
DROP POLICY IF EXISTS "Vendors can view returns for their orders" ON return_requests;
CREATE POLICY "Vendors can view returns for their orders"
  ON return_requests FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

-- Admins can view all returns
DROP POLICY IF EXISTS "Admins can view all returns" ON return_requests;
CREATE POLICY "Admins can view all returns"
  ON return_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Buyers can create their own returns
DROP POLICY IF EXISTS "Buyers can create returns" ON return_requests;
CREATE POLICY "Buyers can create returns"
  ON return_requests FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

-- Vendors can update return status (approve/reject)
DROP POLICY IF EXISTS "Vendors can update return status" ON return_requests;
CREATE POLICY "Vendors can update return status"
  ON return_requests FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- Admins can update any return
DROP POLICY IF EXISTS "Admins can update any return" ON return_requests;
CREATE POLICY "Admins can update any return"
  ON return_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_return_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_return_updated_at ON return_requests;
CREATE TRIGGER set_return_updated_at
  BEFORE UPDATE ON return_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_return_updated_at();

-- 6. Add delivered_at column to orders if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 7. Add return_requested column to orders (for quick lookup)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_requested BOOLEAN DEFAULT false;

-- Notify success
DO $$
BEGIN
  RAISE NOTICE '✅ Return requests table created!';
  RAISE NOTICE '   - return_requests with UNIQUE(order_id, user_id) constraint';
  RAISE NOTICE '   - RLS policies for buyers, vendors, and admins';
  RAISE NOTICE '   - delivered_at column added to orders';
  RAISE NOTICE '   - return_requested flag added to orders';
END $$;
