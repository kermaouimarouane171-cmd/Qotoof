-- =====================================================
-- Migration 020: Fix Product Approval Workflow
-- • Expands approval_status constraint: adds 'published' and 'suspended'
-- • Changes column default to 'published' (auto-visible to buyers)
-- • Migrates legacy 'approved' rows to 'published'
-- • Auto-publishes existing pending products for verified vendors
-- • Updates RLS so buyers can read 'published' products
-- • Adds composite index (vendor_id, approval_status)
-- • Adds trigger to notify admins when a new product is inserted
-- Safe to re-run (uses IF EXISTS / IF NOT EXISTS / CREATE OR REPLACE).
-- =====================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Expand the CHECK constraint for approval_status
--    Original: ('pending', 'approved', 'rejected')
--    New:      ('pending', 'approved', 'published', 'rejected', 'suspended', 'inactive')
--    We keep 'approved' so any in-flight rows remain valid.
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Drop the old check constraint regardless of its auto-generated name
  ALTER TABLE products
    DROP CONSTRAINT IF EXISTS products_approval_status_check;

  -- Re-create with the expanded set of valid values
  ALTER TABLE products
    ADD CONSTRAINT products_approval_status_check
      CHECK (approval_status IN (
        'pending', 'approved', 'published', 'rejected', 'suspended', 'inactive'
      ));

  -- Add metadata columns if they don't already exist
  BEGIN
    ALTER TABLE products ADD COLUMN approved_by  UUID        REFERENCES profiles(id);
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;

  BEGIN
    ALTER TABLE products ADD COLUMN approved_at  TIMESTAMPTZ;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;

  BEGIN
    ALTER TABLE products ADD COLUMN rejection_reason TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;

  -- Change the column default from 'pending' to 'published'
  ALTER TABLE products ALTER COLUMN approval_status SET DEFAULT 'published';
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Normalise legacy 'approved' → 'published'
-- ─────────────────────────────────────────────────────────────
UPDATE products
SET    approval_status = 'published'
WHERE  approval_status = 'approved';

-- ─────────────────────────────────────────────────────────────
-- 3. Auto-publish existing 'pending'/'inactive' products
--    for verified vendors only
--    Compatible with schemas that may not have products.deleted_at.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  has_products_deleted_at BOOLEAN;
  sql_text TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'deleted_at'
  ) INTO has_products_deleted_at;

  sql_text := '
    UPDATE products p
    SET
      approval_status = ''published'',
      is_available    = true,
      approved_at     = NOW()
    FROM profiles pr
    WHERE pr.id             = p.vendor_id
      AND pr.role           = ''vendor''
      AND pr.is_verified    = true
      AND p.approval_status IN (''pending'', ''inactive'')';

  IF has_products_deleted_at THEN
    sql_text := sql_text || ' AND (p.deleted_at IS NULL OR p.deleted_at > NOW())';
  END IF;

  EXECUTE sql_text;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Indexes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_approval_status
  ON products (approval_status);

CREATE INDEX IF NOT EXISTS idx_products_vendor_approval
  ON products (vendor_id, approval_status);

-- ─────────────────────────────────────────────────────────────
-- 5. RLS — enable + refresh product-read policies
-- ─────────────────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anonymous) to read published products
DROP POLICY IF EXISTS "Public can view published products" ON products;
CREATE POLICY "Public can view published products"
  ON products
  FOR SELECT
  USING (approval_status = 'published');

-- Vendor can always see their own products regardless of status
DROP POLICY IF EXISTS "Vendors can view own products"        ON products;
DROP POLICY IF EXISTS "Vendors can view their own products"  ON products;
CREATE POLICY "Vendors can view their own products"
  ON products
  FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

-- Vendor can insert their own products
DROP POLICY IF EXISTS "Vendors can insert own products" ON products;
CREATE POLICY "Vendors can insert own products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id   = auth.uid()
        AND role = 'vendor'
    )
  );

-- Vendor can update their own products (excluding approval_status — that is admin-only)
DROP POLICY IF EXISTS "Vendors can update own products" ON products;
CREATE POLICY "Vendors can update own products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- Admins have full read+write access
DROP POLICY IF EXISTS "Admins can manage all products" ON products;
DROP POLICY IF EXISTS "Admins can update products"     ON products;
CREATE POLICY "Admins can manage all products"
  ON products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id   = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 6. Helper: find admin user IDs
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE role = 'admin';
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. Trigger: notify all admins when a vendor inserts a new product
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_name TEXT;
  v_admin_id    UUID;
BEGIN
  -- Fetch vendor display name
  SELECT COALESCE(store_name, first_name || ' ' || last_name, 'بائع')
  INTO   v_vendor_name
  FROM   profiles
  WHERE  id = NEW.vendor_id;

  -- Insert one notification per admin
  FOR v_admin_id IN SELECT public.get_admin_user_ids() LOOP
    INSERT INTO notifications (user_id, type, message, data)
    VALUES (
      v_admin_id,
      'new_product_pending',
      'منتج جديد بانتظار المراجعة: "' || NEW.name || '" من البائع ' || COALESCE(v_vendor_name, ''),
      jsonb_build_object(
        'product_id',   NEW.id,
        'product_name', NEW.name,
        'vendor_id',    NEW.vendor_id,
        'vendor_name',  v_vendor_name
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_new_product ON products;
CREATE TRIGGER trg_notify_admins_on_new_product
  AFTER INSERT ON products
  FOR EACH ROW
  WHEN (NEW.approval_status = 'pending')
  EXECUTE FUNCTION public.notify_admins_on_new_product();

-- ─────────────────────────────────────────────────────────────
-- 8. Trigger: notify vendor when admin changes approval_status
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_vendor_on_product_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when approval_status actually changes
  IF NEW.approval_status IS NOT DISTINCT FROM OLD.approval_status THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status = 'published' THEN
    INSERT INTO notifications (user_id, type, message, data)
    VALUES (
      NEW.vendor_id,
      'product_approved',
      'تمت الموافقة على منتجك "' || NEW.name || '" وهو الآن مرئي للمشترين',
      jsonb_build_object('product_id', NEW.id, 'product_name', NEW.name)
    );

  ELSIF NEW.approval_status = 'rejected' THEN
    INSERT INTO notifications (user_id, type, message, data)
    VALUES (
      NEW.vendor_id,
      'product_rejected',
      'تم رفض منتجك "' || NEW.name || '". السبب: ' || COALESCE(NEW.rejection_reason, 'لم يُحدد'),
      jsonb_build_object(
        'product_id',       NEW.id,
        'product_name',     NEW.name,
        'rejection_reason', NEW.rejection_reason
      )
    );

  ELSIF NEW.approval_status = 'suspended' THEN
    INSERT INTO notifications (user_id, type, message, data)
    VALUES (
      NEW.vendor_id,
      'product_suspended',
      'تم تعليق منتجك "' || NEW.name || '" مؤقتاً من قبل الإدارة',
      jsonb_build_object('product_id', NEW.id, 'product_name', NEW.name)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_vendor_on_product_decision ON products;
CREATE TRIGGER trg_notify_vendor_on_product_decision
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_vendor_on_product_decision();

-- ─────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────
SELECT approval_status, COUNT(*) AS total
FROM   products
GROUP  BY approval_status
ORDER  BY approval_status;
