-- =====================================================
-- Migration: Add Product Approval Workflow
-- Adds approval_status column to products table
-- Creates notification trigger for approval/rejection decisions
-- =====================================================

-- 1. Add approval_status column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- 2. Add approval metadata columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Add index for approval status filtering
CREATE INDEX IF NOT EXISTS idx_products_approval_status ON products(approval_status);

-- 4. Set existing products to 'approved' (backwards compatibility)
UPDATE products SET approval_status = 'approved', approved_at = NOW()
WHERE approval_status = 'pending' AND is_available = true;

-- 5. Function to create notifications on product approval/rejection
CREATE OR REPLACE FUNCTION public.create_notification_on_product_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when approval_status changes
  IF NEW.approval_status != OLD.approval_status THEN
    -- Notify vendor when product is approved
    IF NEW.approval_status = 'approved' THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.vendor_id,
        'Product Approved ✅',
        'Your product "' || NEW.name || '" has been approved and is now visible to buyers',
        'product',
        jsonb_build_object('product_id', NEW.id, 'product_name', NEW.name)
      );

    -- Notify vendor when product is rejected
    ELSIF NEW.approval_status = 'rejected' THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.vendor_id,
        'Product Rejected ❌',
        'Your product "' || NEW.name || '" was rejected. Reason: ' || COALESCE(NEW.rejection_reason, 'Not specified'),
        'product',
        jsonb_build_object('product_id', NEW.id, 'product_name', NEW.name, 'rejection_reason', NEW.rejection_reason)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger on products table
DROP TRIGGER IF EXISTS notify_on_product_approval ON products;
CREATE TRIGGER notify_on_product_approval
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_on_product_approval();

-- 7. Update RLS policies to allow admins to update approval_status
-- (Admins should already have full access, but this ensures it)
DROP POLICY IF EXISTS "Admins can update products" ON products;
CREATE POLICY "Admins can update products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (true);
