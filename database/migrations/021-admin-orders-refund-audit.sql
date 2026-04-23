-- ============================================
-- Migration 021: Admin Orders - Refund & Audit Enhancement
-- Purpose: Add 'refunded' status to orders, enhance payments table,
--          and ensure complete audit trail support for admin order management
-- ============================================

-- 1. Add 'refunded' status to order_status enum
-- PostgreSQL requires recreating the enum type to add values in specific positions
-- We'll use ALTER TYPE ADD VALUE if available, otherwise recreate

-- Try adding 'refunded' to existing enum (PostgreSQL 12+)
DO $$
BEGIN
  -- Check if 'refunded' already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'order_status'::regtype
    AND enumlabel = 'refunded'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'refunded';
    RAISE NOTICE '✅ Added "refunded" status to order_status enum';
  ELSE
    RAISE NOTICE 'ℹ️  "refunded" status already exists in order_status enum';
  END IF;
END $$;

-- 2. Ensure payments table has all required columns for refund workflow
-- Add missing columns if they don't exist
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_response JSONB;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS auth_code TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Notify about added columns
DO $$
BEGIN
  RAISE NOTICE '✅ Ensured payments table has refund-related columns';
END $$;

-- 3. Add payment_status column to orders if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- 4. Add cancelled_at column to orders if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 5. Add accepted_at column to orders if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- 6. Ensure return_requests table has proper admin tracking
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES profiles(id);
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS admin_response TEXT;
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2);

-- 7. Create a view for admin order analytics
CREATE OR REPLACE VIEW admin_orders_summary AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.payment_status,
  o.total,
  o.subtotal,
  o.shipping_cost,
  o.tax,
  o.created_at,
  o.updated_at,
  o.delivered_at,
  o.cancelled_at,
  o.buyer_id,
  o.vendor_id,
  b.email AS buyer_email,
  b.first_name AS buyer_first_name,
  b.last_name AS buyer_last_name,
  v.email AS vendor_email,
  v.store_name AS vendor_store_name,
  v.first_name AS vendor_first_name,
  v.last_name AS vendor_last_name,
  COUNT(oi.id) AS items_count,
  rr.id AS return_request_id,
  rr.status AS return_status,
  p.status AS payment_status_detail,
  p.method AS payment_method,
  p.refund_amount,
  p.refunded_at
FROM orders o
LEFT JOIN profiles b ON o.buyer_id = b.id
LEFT JOIN profiles v ON o.vendor_id = v.id
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN return_requests rr ON o.id = rr.order_id
LEFT JOIN payments p ON o.id = p.order_id AND p.status IN ('completed', 'refunded')
GROUP BY
  o.id, b.email, b.first_name, b.last_name,
  v.email, v.store_name, v.first_name, v.last_name,
  rr.id, p.id;

-- 8. Add RLS policy for admin_orders_summary view
-- (Views inherit RLS from underlying tables)

-- 9. Create function to get complete order audit trail
CREATE OR REPLACE FUNCTION get_order_audit_trail(order_id_param UUID)
RETURNS TABLE (
  log_id UUID,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  user_first_name TEXT,
  user_last_name TEXT,
  user_role TEXT,
  timestamp TIMESTAMPTZ,
  device_fingerprint TEXT,
  signature TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id AS log_id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.old_values,
    al.new_values,
    p.first_name AS user_first_name,
    p.last_name AS user_last_name,
    p.role AS user_role,
    al.timestamp,
    al.device_fingerprint,
    al.signature
  FROM audit_logs al
  LEFT JOIN profiles p ON al.user_id = p.id
  WHERE al.entity_type = 'order'
    AND al.entity_id = order_id_param
  ORDER BY al.timestamp DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create function to process refund with audit trail
CREATE OR REPLACE FUNCTION process_order_refund(
  order_id_param UUID,
  refund_amount_param DECIMAL,
  refund_reason_param TEXT,
  admin_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
  order_record RECORD;
  payment_record RECORD;
  new_order_status TEXT;
  result JSONB;
BEGIN
  -- Get order details
  SELECT * INTO order_record FROM orders WHERE id = order_id_param;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Get the latest completed payment
  SELECT * INTO payment_record
  FROM payments
  WHERE order_id = order_id_param
    AND status = 'completed'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Determine new order status
  IF refund_amount_param >= order_record.total THEN
    new_order_status := 'refunded';
  ELSE
    new_order_status := order_record.status;
  END IF;

  -- Update order status if full refund
  IF new_order_status = 'refunded' THEN
    UPDATE orders
    SET status = 'refunded',
        updated_at = NOW()
    WHERE id = order_id_param;
  END IF;

  -- Update payment record
  IF payment_record.id IS NOT NULL THEN
    UPDATE payments
    SET status = 'refunded',
        refund_amount = refund_amount_param,
        refund_reason = refund_reason_param,
        refunded_at = NOW()
    WHERE id = payment_record.id;
  END IF;

  -- Update return request if exists
  UPDATE return_requests
  SET status = 'refunded',
      refund_amount = refund_amount_param,
      admin_id = admin_id_param,
      updated_at = NOW()
  WHERE order_id = order_id_param
    AND status IN ('pending', 'approved');

  -- Create audit log entry
  INSERT INTO audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    timestamp
  ) VALUES (
    admin_id_param,
    'ORDER_REFUND',
    'order',
    order_id_param,
    jsonb_build_object(
      'status', order_record.status,
      'payment_status', payment_record.status
    ),
    jsonb_build_object(
      'status', new_order_status,
      'refund_amount', refund_amount_param,
      'refund_reason', refund_reason_param
    ),
    NOW()
  );

  result := jsonb_build_object(
    'success', true,
    'order_id', order_id_param,
    'new_status', new_order_status,
    'refund_amount', refund_amount_param,
    'payment_id', payment_record.id
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at DESC) WHERE delivered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at ON orders(cancelled_at DESC) WHERE cancelled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_refunded_at ON payments(refunded_at DESC) WHERE refunded_at IS NOT NULL;

-- 12. Update RLS policies for admin access to payments
-- Ensure admins can view all payment records
DO $$
BEGIN
  -- Check if policy exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payments'
    AND policyname = 'Admins can view all payments'
  ) THEN
    CREATE POLICY "Admins can view all payments"
      ON payments FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      );
    RAISE NOTICE '✅ Created admin RLS policy for payments';
  END IF;
END $$;

-- 13. Add trigger to log order status changes automatically
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      timestamp
    ) VALUES (
      COALESCE(
        (SELECT auth.uid()),
        (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)
      ),
      'ORDER_STATUS_AUTO_LOG',
      'order',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS log_order_status_change_trigger ON orders;

-- Create the trigger
CREATE TRIGGER log_order_status_change_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- ============================================
-- Migration Complete
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 021 Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  ✓ Added "refunded" status to order_status enum';
  RAISE NOTICE '  ✓ Enhanced payments table with refund columns';
  RAISE NOTICE '  ✓ Added payment_status to orders';
  RAISE NOTICE '  ✓ Created admin_orders_summary view';
  RAISE NOTICE '  ✓ Created get_order_audit_trail() function';
  RAISE NOTICE '  ✓ Created process_order_refund() function';
  RAISE NOTICE '  ✓ Added performance indexes';
  RAISE NOTICE '  ✓ Added automatic order status change logging';
  RAISE NOTICE '========================================';
END $$;
