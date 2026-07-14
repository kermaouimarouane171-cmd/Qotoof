-- =====================================================
-- FORCE ADD MISSING NOTIFICATION COLUMNS TO PROFILES
-- =====================================================
-- Background: Migration 20260708000003 was recorded in
-- supabase_migrations.schema_migrations as executed, but the
-- four notification columns were never actually added to the
-- live profiles table. This is the same schema-drift pattern
-- seen multiple times this week (columns registered but not
-- applied). This migration re-adds them unconditionally and
-- verifies they exist before recording success.
--
-- Affected columns:
--   notify_new_deliveries   (driver: new delivery assignment)
--   notify_order_updates    (all: order/delivery status changes)
--   notify_customer_messages (all: customer sends a message)
--   notify_low_stock        (vendor: stock below threshold)
--
-- Without these columns, Vendor/Driver Settings SAVE fails
-- with PGRST204 "Could not find the column ... in the schema cache".
-- =====================================================

-- Step 1: Add columns using DO block to avoid errors if partially present
DO $$
BEGIN
  -- notify_new_deliveries
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'notify_new_deliveries'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN notify_new_deliveries BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added column: notify_new_deliveries';
  ELSE
    RAISE NOTICE 'Column already exists: notify_new_deliveries';
  END IF;

  -- notify_order_updates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'notify_order_updates'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN notify_order_updates BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added column: notify_order_updates';
  ELSE
    RAISE NOTICE 'Column already exists: notify_order_updates';
  END IF;

  -- notify_customer_messages
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'notify_customer_messages'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN notify_customer_messages BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added column: notify_customer_messages';
  ELSE
    RAISE NOTICE 'Column already exists: notify_customer_messages';
  END IF;

  -- notify_low_stock
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'notify_low_stock'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN notify_low_stock BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added column: notify_low_stock';
  ELSE
    RAISE NOTICE 'Column already exists: notify_low_stock';
  END IF;
END $$;

-- Step 2: Add comments for documentation
COMMENT ON COLUMN public.profiles.notify_new_deliveries IS 'Receive notifications when new delivery is assigned (driver)';
COMMENT ON COLUMN public.profiles.notify_order_updates IS 'Receive notifications when order/delivery status changes';
COMMENT ON COLUMN public.profiles.notify_customer_messages IS 'Receive notifications when customer sends a message';
COMMENT ON COLUMN public.profiles.notify_low_stock IS 'Receive notifications when product stock falls below threshold (vendor)';

-- Step 3: Set default values for existing rows (NULL → true)
UPDATE public.profiles
SET
  notify_new_deliveries   = COALESCE(notify_new_deliveries, true),
  notify_order_updates    = COALESCE(notify_order_updates, true),
  notify_customer_messages = COALESCE(notify_customer_messages, true),
  notify_low_stock        = COALESCE(notify_low_stock, true)
WHERE
  notify_new_deliveries IS NULL
  OR notify_order_updates IS NULL
  OR notify_customer_messages IS NULL
  OR notify_low_stock IS NULL;

-- Step 4: Verification — this will raise an exception if any column is missing
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM (VALUES
    ('notify_new_deliveries'),
    ('notify_order_updates'),
    ('notify_customer_messages'),
    ('notify_low_stock')
  ) AS v(col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = v.col
  );

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % notification columns are still missing from profiles table', missing_count;
  END IF;

  RAISE NOTICE 'VERIFICATION PASSED: All 4 notification columns exist on profiles table';
END $$;
