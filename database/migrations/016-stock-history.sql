-- ============================================
-- Stock History & Inventory Management
-- Creates stock_history table for tracking
-- all inventory changes with who/when/how much
-- ============================================

-- 1. Create stock_history table
CREATE TABLE IF NOT EXISTS stock_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES profiles(id), -- NULL if system/auto change
  change_type TEXT NOT NULL CHECK (change_type IN (
    'manual_update',     -- Vendor manually changed quantity
    'order_placed',      -- Quantity reduced by order
    'order_cancelled',   -- Quantity restored by cancelled order
    'restock',           -- Vendor added stock
    'bulk_update',       -- Bulk update via inventory page
    'system_adjustment'  -- System adjustment
  )),
  old_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  new_quantity DECIMAL(10, 2) NOT NULL,
  quantity_delta DECIMAL(10, 2) NOT NULL, -- new - old (negative = reduction)
  reason TEXT,
  order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_vendor ON stock_history(vendor_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_changed_by ON stock_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_stock_history_created_at ON stock_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_history_change_type ON stock_history(change_type);
CREATE INDEX IF NOT EXISTS idx_stock_history_order ON stock_history(order_id);

-- 3. RLS Policies
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

-- Vendors can view their own stock history
DROP POLICY IF EXISTS "Vendors can view own stock history" ON stock_history;
CREATE POLICY "Vendors can view own stock history"
  ON stock_history FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

-- Admins can view all stock history
DROP POLICY IF EXISTS "Admins can view all stock history" ON stock_history;
CREATE POLICY "Admins can view all stock history"
  ON stock_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- System can insert stock history (via trigger)
DROP POLICY IF EXISTS "System can insert stock history" ON stock_history;
CREATE POLICY "System can insert stock history"
  ON stock_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Automatic trigger on products table
-- Logs every quantity change to stock_history
CREATE OR REPLACE FUNCTION public.log_stock_change()
RETURNS TRIGGER AS $$
DECLARE
  v_delta DECIMAL(10, 2);
BEGIN
  -- Only log if quantity changed
  IF OLD.available_quantity IS DISTINCT FROM NEW.available_quantity THEN
    v_delta := NEW.available_quantity - COALESCE(OLD.available_quantity, 0);

    INSERT INTO stock_history (
      product_id,
      vendor_id,
      change_type,
      old_quantity,
      new_quantity,
      quantity_delta,
      reason
    ) VALUES (
      NEW.id,
      NEW.vendor_id,
      'manual_update',
      COALESCE(OLD.available_quantity, 0),
      NEW.available_quantity,
      v_delta,
      'Product updated via vendor panel'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_product_stock_change ON products;
CREATE TRIGGER log_product_stock_change
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION public.log_stock_change();

-- 5. Function to get stock summary for a vendor
CREATE OR REPLACE FUNCTION public.get_vendor_stock_summary(p_vendor_id UUID)
RETURNS TABLE (
  total_products INTEGER,
  in_stock INTEGER,
  low_stock INTEGER,
  out_of_stock INTEGER,
  total_value DECIMAL(10, 2),
  recent_changes JSONB
) AS $$
DECLARE
  v_threshold INTEGER;
BEGIN
  -- Get vendor's threshold
  SELECT COALESCE(low_stock_threshold, 10) INTO v_threshold
  FROM profiles WHERE id = p_vendor_id;

  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE available_quantity > v_threshold)::INTEGER,
    COUNT(*) FILTER (WHERE available_quantity > 0 AND available_quantity <= v_threshold)::INTEGER,
    COUNT(*) FILTER (WHERE available_quantity = 0 OR is_available = false)::INTEGER,
    COALESCE(SUM(price_per_unit * available_quantity), 0),
    (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          sh.id,
          sh.product_id,
          p.name AS product_name,
          sh.change_type,
          sh.old_quantity,
          sh.new_quantity,
          sh.quantity_delta,
          sh.reason,
          sh.created_at,
          pr.first_name || ' ' || pr.last_name AS changed_by_name
        FROM stock_history sh
        JOIN products p ON p.id = sh.product_id
        LEFT JOIN profiles pr ON pr.id = sh.changed_by
        WHERE sh.vendor_id = p_vendor_id
        ORDER BY sh.created_at DESC
        LIMIT 10
      ) t
    ) AS recent_changes
  FROM products
  WHERE vendor_id = p_vendor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger to notify admins of critical stock changes
CREATE OR REPLACE FUNCTION public.notify_admin_stock_change()
RETURNS TRIGGER AS $$
DECLARE
  v_threshold INTEGER;
  v_product_name TEXT;
BEGIN
  -- Only trigger when stock drops to 0 or below threshold
  IF NEW.available_quantity = 0 OR (
    NEW.available_quantity > 0 AND
    NEW.available_quantity <= COALESCE(
      (SELECT low_stock_threshold FROM profiles WHERE id = NEW.vendor_id),
      10
    )
  ) THEN
    -- Get product name
    SELECT name INTO v_product_name FROM products WHERE id = NEW.id;

    -- Notify all admins
    INSERT INTO notifications (user_id, title, message, type, data)
    SELECT
      p.id AS user_id,
      '⚠️ تنبيه مخزون' AS title,
      format(
        'المنتج "%s" للبائع %s وصل إلى %s وحدة',
        v_product_name,
        (SELECT store_name || ' (' || first_name || ' ' || last_name || ')' FROM profiles WHERE id = NEW.vendor_id),
        NEW.available_quantity
      ) AS message,
      'system' AS type,
      jsonb_build_object(
        'product_id', NEW.id,
        'vendor_id', NEW.vendor_id,
        'quantity', NEW.available_quantity,
        'change_type', CASE WHEN NEW.available_quantity = 0 THEN 'out_of_stock' ELSE 'low_stock' END
      ) AS data
    FROM profiles p
    WHERE p.role = 'admin';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_admin_stock_change ON products;
CREATE TRIGGER notify_admin_stock_change
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (OLD.available_quantity IS DISTINCT FROM NEW.available_quantity)
  EXECUTE FUNCTION public.notify_admin_stock_change();

-- Notify success
DO $$
BEGIN
  RAISE NOTICE '✅ Stock history tracking enabled!';
  RAISE NOTICE '   - stock_history table created';
  RAISE NOTICE '   - Automatic trigger on products table';
  RAISE NOTICE '   - get_vendor_stock_summary() function created';
END $$;
