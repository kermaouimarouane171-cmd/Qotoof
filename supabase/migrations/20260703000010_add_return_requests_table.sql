-- ============================================================================
-- Migration: Add missing columns and policies to return_requests table
-- The table already exists (from legacy migrations) but is missing columns
-- that the application code expects.
--
-- Used by: src/pages/buyer/Orders.jsx handleReturnSubmit() (lines 396-405)
--   Inserts: order_id, buyer_id, user_id, vendor_id, reason, status
--
-- Existing columns: id, order_id, user_id, reason, status, notes,
--   created_at, updated_at
-- Missing columns: buyer_id, vendor_id, description, items, image_urls,
--   refund_amount, admin_response, admin_id
-- ============================================================================

-- 1. Add missing columns
ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB,
  ADD COLUMN IF NOT EXISTS image_urls JSONB,
  ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS admin_response TEXT,
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.profiles(id);

-- 2. Backfill buyer_id and vendor_id from orders table for existing rows
UPDATE public.return_requests rr
  SET buyer_id = o.buyer_id, vendor_id = o.vendor_id
  FROM public.orders o
  WHERE rr.order_id = o.id
    AND (rr.buyer_id IS NULL OR rr.vendor_id IS NULL);

-- 3. Make buyer_id and vendor_id NOT NULL after backfill
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.return_requests WHERE buyer_id IS NULL OR vendor_id IS NULL
  ) THEN
    ALTER TABLE public.return_requests
      ALTER COLUMN buyer_id SET NOT NULL,
      ALTER COLUMN vendor_id SET NOT NULL;
  END IF;
END $$;

-- 4. Add unique constraint to prevent duplicate returns (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_order_return'
  ) THEN
    ALTER TABLE public.return_requests
      ADD CONSTRAINT unique_order_return UNIQUE (order_id, user_id);
  END IF;
END $$;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_return_requests_buyer_id ON public.return_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_vendor_id ON public.return_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON public.return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON public.return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_created_at ON public.return_requests(created_at DESC);

-- 6. Update RLS policies — replace the single ALL policy with granular ones
DROP POLICY IF EXISTS "return_requests_policy" ON public.return_requests;
DROP POLICY IF EXISTS "Buyers can view own returns" ON public.return_requests;
DROP POLICY IF EXISTS "Vendors can view returns for their orders" ON public.return_requests;
DROP POLICY IF EXISTS "Admins can view all returns" ON public.return_requests;
DROP POLICY IF EXISTS "Buyers can create returns" ON public.return_requests;
DROP POLICY IF EXISTS "Vendors can update return status" ON public.return_requests;
DROP POLICY IF EXISTS "Admins can update any return" ON public.return_requests;

-- Buyers can view their own returns
CREATE POLICY "Buyers can view own returns"
  ON public.return_requests FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid() OR user_id = auth.uid());

-- Vendors can view returns for their orders
CREATE POLICY "Vendors can view returns for their orders"
  ON public.return_requests FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

-- Admins can view all returns
CREATE POLICY "Admins can view all returns"
  ON public.return_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Buyers can create their own returns
CREATE POLICY "Buyers can create returns"
  ON public.return_requests FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid() OR user_id = auth.uid());

-- Vendors can update return status (approve/reject)
CREATE POLICY "Vendors can update return status"
  ON public.return_requests FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- Admins can update any return
CREATE POLICY "Admins can update any return"
  ON public.return_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 7. Updated_at trigger (if not already present)
CREATE OR REPLACE FUNCTION public.handle_return_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_return_updated_at ON public.return_requests;
CREATE TRIGGER set_return_updated_at
  BEFORE UPDATE ON public.return_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_return_updated_at();
