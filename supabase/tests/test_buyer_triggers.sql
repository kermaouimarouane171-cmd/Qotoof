-- Test: handle_new_user trigger creates profile on auth.users INSERT
-- This is a SQL-based test that can be run with psql or supabase test

BEGIN;

-- Save current state
SAVEPOINT test_start;

-- 1. Insert a test user into auth.users
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test-trigger@greenmarket.test',
  jsonb_build_object(
    'role', 'buyer',
    'first_name', 'Test',
    'last_name', 'User',
    'phone', '+212600000000'
  )
);

-- 2. Verify profile was created by the trigger
DO $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001';

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'handle_new_user trigger failed: profile not created';
  END IF;

  IF v_profile.role != 'buyer' THEN
    RAISE EXCEPTION 'handle_new_user trigger failed: expected role=buyer, got %', v_profile.role;
  END IF;

  IF v_profile.first_name != 'Test' THEN
    RAISE EXCEPTION 'handle_new_user trigger failed: expected first_name=Test, got %', v_profile.first_name;
  END IF;

  IF v_profile.email != 'test-trigger@greenmarket.test' THEN
    RAISE EXCEPTION 'handle_new_user trigger failed: expected email=test-trigger@greenmarket.test, got %', v_profile.email;
  END IF;

  RAISE NOTICE 'handle_new_user trigger test PASSED';
END $$;

-- Cleanup
ROLLBACK TO SAVEPOINT test_start;

-- ──────────────────────────────────────────────────────────────────────────────

-- Test: notify_order_status_change trigger creates notifications on status UPDATE
BEGIN;

SAVEPOINT test_start;

-- 1. Insert test user and order
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'test-buyer@greenmarket.test',
  jsonb_build_object('role', 'buyer', 'first_name', 'Buyer')
);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'test-vendor@greenmarket.test',
  jsonb_build_object('role', 'vendor', 'first_name', 'Vendor')
);

-- 2. Create a test order
INSERT INTO orders (id, buyer_id, vendor_id, order_number, status, total)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  'TEST-ORD-001',
  'pending',
  100.00
);

-- 3. Update status to trigger notification
UPDATE orders SET status = 'vendor_accepted' WHERE id = '00000000-0000-0000-0000-000000000010';

-- 4. Verify notification was created for buyer
DO $$
DECLARE
  v_notif_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_notif_count
  FROM notifications
  WHERE user_id = '00000000-0000-0000-0000-000000000002'
    AND data->>'order_id' = '00000000-0000-0000-0000-000000000010';

  IF v_notif_count = 0 THEN
    RAISE EXCEPTION 'notify_order_status_change trigger failed: no buyer notification created';
  END IF;

  RAISE NOTICE 'notify_order_status_change trigger test PASSED: % notifications created', v_notif_count;
END $$;

-- Cleanup
ROLLBACK TO SAVEPOINT test_start;

ROLLBACK;
