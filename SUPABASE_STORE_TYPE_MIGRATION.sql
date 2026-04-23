BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

UPDATE products
SET
  stock_quantity = COALESCE(stock_quantity, available_quantity, 0),
  is_active = CASE
    WHEN COALESCE(stock_quantity, available_quantity, 0) <= 0 THEN FALSE
    ELSE COALESCE(is_active, is_available, TRUE)
  END
WHERE stock_quantity IS NULL
   OR is_active IS NULL;

CREATE TABLE IF NOT EXISTS store_type_rules (
  store_type TEXT PRIMARY KEY,
  label_ar TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  min_products INTEGER NOT NULL,
  max_products INTEGER,
  allowed_delivery_options TEXT[] NOT NULL,
  default_delivery_option TEXT NOT NULL,
  sort_order SMALLINT NOT NULL,
  CONSTRAINT chk_store_type_rules_type CHECK (store_type IN ('small', 'medium', 'enterprise')),
  CONSTRAINT chk_store_type_rules_default_option CHECK (default_delivery_option IN ('self', 'find_driver', 'own_driver')),
  CONSTRAINT chk_store_type_rules_range CHECK (max_products IS NULL OR max_products >= min_products)
);

INSERT INTO store_type_rules (
  store_type,
  label_ar,
  description_ar,
  min_products,
  max_products,
  allowed_delivery_options,
  default_delivery_option,
  sort_order
) VALUES
  (
    'small',
    'متجر صغير',
    'متجر في مرحلة البداية ويعتمد على التوصيل الذاتي فقط.',
    0,
    10,
    ARRAY['self'],
    'self',
    1
  ),
  (
    'medium',
    'متجر متوسط',
    'متجر في مرحلة النمو ويمكنه الاختيار بين التوصيل الذاتي أو البحث عن سائق.',
    11,
    50,
    ARRAY['self', 'find_driver'],
    'self',
    2
  ),
  (
    'enterprise',
    'متجر مؤسسي',
    'متجر عالي النشاط يمكنه الاعتماد على البحث عن سائق أو على سائقه المرتبط.',
    51,
    NULL,
    ARRAY['find_driver', 'own_driver'],
    'find_driver',
    3
  )
ON CONFLICT (store_type) DO NOTHING;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS store_type TEXT,
  ADD COLUMN IF NOT EXISTS delivery_option TEXT,
  ADD COLUMN IF NOT EXISTS active_products_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS store_type_updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS delivery_option_updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS vendor_store_type TEXT,
  ADD COLUMN IF NOT EXISTS delivery_option TEXT;

CREATE TABLE IF NOT EXISTS store_type_evolution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  previous_store_type TEXT,
  current_store_type TEXT NOT NULL,
  previous_active_products_count INTEGER NOT NULL DEFAULT 0,
  current_active_products_count INTEGER NOT NULL DEFAULT 0,
  previous_delivery_option TEXT,
  current_delivery_option TEXT,
  message_ar TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  CONSTRAINT chk_store_type_evolution_previous_type CHECK (
    previous_store_type IS NULL OR previous_store_type IN ('small', 'medium', 'enterprise')
  ),
  CONSTRAINT chk_store_type_evolution_current_type CHECK (
    current_store_type IN ('small', 'medium', 'enterprise')
  ),
  CONSTRAINT chk_store_type_evolution_previous_option CHECK (
    previous_delivery_option IS NULL OR previous_delivery_option IN ('self', 'find_driver', 'own_driver')
  ),
  CONSTRAINT chk_store_type_evolution_current_option CHECK (
    current_delivery_option IS NULL OR current_delivery_option IN ('self', 'find_driver', 'own_driver')
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_profiles_store_type'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT chk_profiles_store_type
      CHECK (store_type IS NULL OR store_type IN ('small', 'medium', 'enterprise'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_profiles_delivery_option'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT chk_profiles_delivery_option
      CHECK (delivery_option IS NULL OR delivery_option IN ('self', 'find_driver', 'own_driver'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_orders_vendor_store_type'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT chk_orders_vendor_store_type
      CHECK (vendor_store_type IS NULL OR vendor_store_type IN ('small', 'medium', 'enterprise'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_orders_delivery_option'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT chk_orders_delivery_option
      CHECK (delivery_option IS NULL OR delivery_option IN ('self', 'find_driver', 'own_driver'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_store_type ON profiles(store_type);
CREATE INDEX IF NOT EXISTS idx_profiles_delivery_option ON profiles(delivery_option);
CREATE INDEX IF NOT EXISTS idx_profiles_active_products_count ON profiles(active_products_count DESC);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_store_type ON orders(vendor_store_type);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_option ON orders(delivery_option);
CREATE INDEX IF NOT EXISTS idx_products_vendor_active_stock
  ON products(vendor_id, stock_quantity)
  WHERE COALESCE(is_active, FALSE) = TRUE AND COALESCE(stock_quantity, 0) > 0;
CREATE INDEX IF NOT EXISTS idx_store_type_evolution_log_vendor
  ON store_type_evolution_log(vendor_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.to_arabic_digits(p_value INTEGER)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT translate(COALESCE(p_value, 0)::TEXT, '0123456789', '٠١٢٣٤٥٦٧٨٩');
$$;

CREATE OR REPLACE FUNCTION public.get_delivery_option_label_ar(p_delivery_option TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE p_delivery_option
    WHEN 'self' THEN 'التوصيل الذاتي'
    WHEN 'find_driver' THEN 'البحث عن سائق'
    WHEN 'own_driver' THEN 'السائق المرتبط'
    ELSE 'غير محدد'
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_store_type_label_ar(p_store_type TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT label_ar
      FROM store_type_rules
      WHERE store_type = p_store_type
      LIMIT 1
    ),
    'متجر غير محدد'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_store_type_from_product_count(p_count INTEGER)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT store_type
  FROM store_type_rules
  WHERE COALESCE(p_count, 0) >= min_products
    AND (max_products IS NULL OR COALESCE(p_count, 0) <= max_products)
  ORDER BY sort_order DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_default_delivery_option_for_store_type(p_store_type TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT default_delivery_option
      FROM store_type_rules
      WHERE store_type = p_store_type
      LIMIT 1
    ),
    'self'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_delivery_option_allowed(p_store_type TEXT, p_delivery_option TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM store_type_rules
    WHERE store_type = p_store_type
      AND p_delivery_option = ANY(allowed_delivery_options)
  );
$$;

CREATE OR REPLACE FUNCTION public.build_store_evolution_message_ar(
  p_previous_store_type TEXT,
  p_current_store_type TEXT,
  p_previous_active_products_count INTEGER,
  p_current_active_products_count INTEGER,
  p_previous_delivery_option TEXT,
  p_current_delivery_option TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  previous_label TEXT := public.get_store_type_label_ar(p_previous_store_type);
  current_label TEXT := public.get_store_type_label_ar(p_current_store_type);
  current_option_label TEXT := public.get_delivery_option_label_ar(p_current_delivery_option);
  base_message TEXT;
BEGIN
  IF p_previous_store_type IS NULL OR p_previous_store_type = '' THEN
    base_message := format(
      'تم ضبط متجرك على %s بعد احتساب %s منتج نشط.',
      current_label,
      public.to_arabic_digits(p_current_active_products_count)
    );
  ELSIF p_previous_store_type IS DISTINCT FROM p_current_store_type THEN
    base_message := format(
      'تم انتقال متجرك من %s إلى %s بعد وصوله إلى %s منتج نشط.',
      previous_label,
      current_label,
      public.to_arabic_digits(p_current_active_products_count)
    );
  ELSE
    base_message := format(
      'تم تحديث إعدادات متجرك بعد احتساب %s منتج نشط.',
      public.to_arabic_digits(p_current_active_products_count)
    );
  END IF;

  IF p_previous_delivery_option IS DISTINCT FROM p_current_delivery_option THEN
    RETURN base_message || format(' خيار التوصيل الحالي هو %s.', current_option_label);
  END IF;

  RETURN base_message;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_activity_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_stock NUMERIC(10, 2);
  resolved_active BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    resolved_stock := COALESCE(NEW.stock_quantity, NEW.available_quantity, 0);
    resolved_active := COALESCE(NEW.is_active, NEW.is_available, resolved_stock > 0);
  ELSE
    IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
      resolved_stock := COALESCE(NEW.stock_quantity, 0);
    ELSIF NEW.available_quantity IS DISTINCT FROM OLD.available_quantity THEN
      resolved_stock := COALESCE(NEW.available_quantity, 0);
    ELSE
      resolved_stock := COALESCE(NEW.stock_quantity, NEW.available_quantity, OLD.stock_quantity, OLD.available_quantity, 0);
    END IF;

    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      resolved_active := COALESCE(NEW.is_active, FALSE);
    ELSIF NEW.is_available IS DISTINCT FROM OLD.is_available THEN
      resolved_active := COALESCE(NEW.is_available, FALSE);
    ELSE
      resolved_active := COALESCE(NEW.is_active, NEW.is_available, OLD.is_active, OLD.is_available, resolved_stock > 0);
    END IF;
  END IF;

  IF COALESCE(resolved_stock, 0) <= 0 THEN
    resolved_active := FALSE;
  END IF;

  NEW.stock_quantity := GREATEST(COALESCE(resolved_stock, 0), 0);
  NEW.available_quantity := NEW.stock_quantity;
  NEW.is_active := COALESCE(resolved_active, FALSE);
  NEW.is_available := COALESCE(resolved_active, FALSE);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_activity_fields ON products;
CREATE TRIGGER trg_sync_product_activity_fields
  BEFORE INSERT OR UPDATE OF stock_quantity, available_quantity, is_active, is_available
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_activity_fields();

CREATE OR REPLACE FUNCTION public.apply_vendor_store_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_store_type TEXT;
BEGIN
  IF COALESCE(NEW.role, 'buyer') <> 'vendor' THEN
    RETURN NEW;
  END IF;

  NEW.store_type := COALESCE(NEW.store_type, 'small');
  NEW.active_products_count := COALESCE(NEW.active_products_count, 0);
  resolved_store_type := NEW.store_type;

  IF NEW.delivery_option IS NULL THEN
    NEW.delivery_option := public.get_default_delivery_option_for_store_type(resolved_store_type);
  END IF;

  IF NOT public.is_delivery_option_allowed(resolved_store_type, NEW.delivery_option) THEN
    RAISE EXCEPTION 'invalid delivery option "%" for store type "%"', NEW.delivery_option, resolved_store_type;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.store_type_updated_at := COALESCE(NEW.store_type_updated_at, NOW());
    NEW.delivery_option_updated_at := COALESCE(NEW.delivery_option_updated_at, NOW());
  ELSE
    NEW.store_type_updated_at := COALESCE(NEW.store_type_updated_at, OLD.store_type_updated_at, NOW());
    NEW.delivery_option_updated_at := COALESCE(NEW.delivery_option_updated_at, OLD.delivery_option_updated_at, NOW());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_vendor_store_defaults ON profiles;
CREATE TRIGGER trg_apply_vendor_store_defaults
  BEFORE INSERT OR UPDATE OF role, store_type, delivery_option, active_products_count
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_vendor_store_defaults();

CREATE OR REPLACE FUNCTION public.refresh_vendor_store_type(p_vendor_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vendor_record RECORD;
  computed_count INTEGER;
  resolved_store_type TEXT;
  resolved_delivery_option TEXT;
  default_delivery_option TEXT;
  should_log BOOLEAN := FALSE;
  event_message TEXT;
BEGIN
  SELECT id, role, store_type, delivery_option, active_products_count
  INTO vendor_record
  FROM profiles
  WHERE id = p_vendor_id
  FOR UPDATE;

  IF NOT FOUND OR vendor_record.role <> 'vendor' THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO computed_count
  FROM products
  WHERE vendor_id = p_vendor_id
    AND COALESCE(is_active, FALSE) = TRUE
    AND COALESCE(stock_quantity, 0) > 0;

  resolved_store_type := COALESCE(public.get_store_type_from_product_count(computed_count), 'small');
  default_delivery_option := public.get_default_delivery_option_for_store_type(resolved_store_type);
  resolved_delivery_option := COALESCE(vendor_record.delivery_option, default_delivery_option);

  IF NOT public.is_delivery_option_allowed(resolved_store_type, resolved_delivery_option) THEN
    resolved_delivery_option := default_delivery_option;
  END IF;

  should_log := (
    vendor_record.store_type IS NOT NULL
    AND vendor_record.store_type IS DISTINCT FROM resolved_store_type
  ) OR (
    vendor_record.delivery_option IS NOT NULL
    AND vendor_record.delivery_option IS DISTINCT FROM resolved_delivery_option
  );

  UPDATE profiles
  SET
    store_type = resolved_store_type,
    delivery_option = resolved_delivery_option,
    active_products_count = computed_count,
    store_type_updated_at = CASE
      WHEN vendor_record.store_type IS DISTINCT FROM resolved_store_type THEN NOW()
      ELSE COALESCE(profiles.store_type_updated_at, NOW())
    END,
    delivery_option_updated_at = CASE
      WHEN vendor_record.delivery_option IS DISTINCT FROM resolved_delivery_option THEN NOW()
      ELSE COALESCE(profiles.delivery_option_updated_at, NOW())
    END
  WHERE id = p_vendor_id;

  IF should_log THEN
    event_message := public.build_store_evolution_message_ar(
      vendor_record.store_type,
      resolved_store_type,
      COALESCE(vendor_record.active_products_count, 0),
      computed_count,
      vendor_record.delivery_option,
      resolved_delivery_option
    );

    INSERT INTO store_type_evolution_log (
      vendor_id,
      previous_store_type,
      current_store_type,
      previous_active_products_count,
      current_active_products_count,
      previous_delivery_option,
      current_delivery_option,
      message_ar
    ) VALUES (
      p_vendor_id,
      vendor_record.store_type,
      resolved_store_type,
      COALESCE(vendor_record.active_products_count, 0),
      computed_count,
      vendor_record.delivery_option,
      resolved_delivery_option,
      event_message
    );

    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      is_read,
      created_at
    ) VALUES (
      p_vendor_id,
      'store_evolution',
      'تطور نوع المتجر',
      event_message,
      jsonb_build_object(
        'previous_store_type', vendor_record.store_type,
        'current_store_type', resolved_store_type,
        'previous_delivery_option', vendor_record.delivery_option,
        'current_delivery_option', resolved_delivery_option,
        'previous_active_products_count', COALESCE(vendor_record.active_products_count, 0),
        'current_active_products_count', computed_count
      ),
      FALSE,
      NOW()
    );
  END IF;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_vendor_store_type(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_vendor_store_type(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_vendor_store_type(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_vendor_store_type_after_product_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.vendor_id IS NOT NULL THEN
      PERFORM public.refresh_vendor_store_type(OLD.vendor_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.vendor_id IS DISTINCT FROM OLD.vendor_id THEN
    IF OLD.vendor_id IS NOT NULL THEN
      PERFORM public.refresh_vendor_store_type(OLD.vendor_id);
    END IF;
    IF NEW.vendor_id IS NOT NULL THEN
      PERFORM public.refresh_vendor_store_type(NEW.vendor_id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.vendor_id IS NOT NULL THEN
    PERFORM public.refresh_vendor_store_type(NEW.vendor_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_vendor_store_type_after_product_change ON products;
CREATE TRIGGER trg_refresh_vendor_store_type_after_product_change
  AFTER INSERT OR UPDATE OF vendor_id, stock_quantity, available_quantity, is_active, is_available
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_vendor_store_type_after_product_change();

DROP TRIGGER IF EXISTS trg_refresh_vendor_store_type_after_product_delete ON products;
CREATE TRIGGER trg_refresh_vendor_store_type_after_product_delete
  AFTER DELETE
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_vendor_store_type_after_product_change();

ALTER TABLE store_type_evolution_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'store_type_evolution_log'
      AND policyname = 'Vendors can view own store type evolution log'
  ) THEN
    CREATE POLICY "Vendors can view own store type evolution log"
      ON store_type_evolution_log
      FOR SELECT
      USING (vendor_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'store_type_evolution_log'
      AND policyname = 'Vendors can acknowledge own store type evolution log'
  ) THEN
    CREATE POLICY "Vendors can acknowledge own store type evolution log"
      ON store_type_evolution_log
      FOR UPDATE
      USING (vendor_id = auth.uid())
      WITH CHECK (vendor_id = auth.uid());
  END IF;
END $$;

DO $$
DECLARE
  vendor_row RECORD;
BEGIN
  FOR vendor_row IN
    SELECT id
    FROM profiles
    WHERE role = 'vendor'
  LOOP
    PERFORM public.refresh_vendor_store_type(vendor_row.id);
  END LOOP;
END $$;

UPDATE orders AS o
SET
  vendor_store_type = COALESCE(o.vendor_store_type, p.store_type),
  delivery_option = COALESCE(o.delivery_option, p.delivery_option)
FROM profiles AS p
WHERE p.id = o.vendor_id
  AND (o.vendor_store_type IS NULL OR o.delivery_option IS NULL);

COMMIT;