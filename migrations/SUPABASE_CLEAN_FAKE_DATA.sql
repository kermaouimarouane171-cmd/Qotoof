-- ============================================================
-- SUPABASE: Clean Fake / Seed Data from Production Database
-- Run this ONLY on the PRODUCTION database before go-live
-- All test accounts use @qotoof.com domain emails
-- Admin account (admin@qotoof.com) is PRESERVED
-- ============================================================

-- Step 0: Safety check — confirm you are on production
DO $$
BEGIN
  RAISE NOTICE 'Starting fake data cleanup. Make sure you have a backup first!';
END $$;

-- ============================================================
-- Step 1: Identify seed user IDs (store before deletion)
-- ============================================================
CREATE TEMP TABLE seed_user_ids AS
SELECT au.id
FROM auth.users au
WHERE au.email IN (
  'vendor1@qotoof.com',
  'vendor2@qotoof.com',
  'vendor3@qotoof.com',
  'vendor@qotoof.com',
  'buyer1@qotoof.com',
  'buyer2@qotoof.com',
  'buyer3@qotoof.com',
  'buyer@qotoof.com',
  'driver1@qotoof.com',
  'driver2@qotoof.com',
  'driver@qotoof.com',
  -- Test/demo accounts from seed scripts
  'test.vendor@qotoof.com',
  'test.buyer@qotoof.com',
  'test.driver@qotoof.com',
  'demo@qotoof.com'
  -- DO NOT include: admin@qotoof.com
);

-- Log count for verification
DO $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM seed_user_ids;
  RAISE NOTICE 'Found % seed user accounts to delete', cnt;
END $$;

-- ============================================================
-- Step 2: Delete order-related data for seed users
-- ============================================================

-- Delete order items for seed orders
DELETE FROM order_items
WHERE order_id IN (
  SELECT id FROM orders
  WHERE buyer_id IN (SELECT id FROM seed_user_ids)
     OR vendor_id IN (SELECT id FROM seed_user_ids)
     OR driver_id IN (SELECT id FROM seed_user_ids)
);

-- Delete order timeline entries
DELETE FROM order_timeline
WHERE order_id IN (
  SELECT id FROM orders
  WHERE buyer_id IN (SELECT id FROM seed_user_ids)
     OR vendor_id IN (SELECT id FROM seed_user_ids)
     OR driver_id IN (SELECT id FROM seed_user_ids)
);

-- Delete return requests
DELETE FROM return_requests
WHERE order_id IN (
  SELECT id FROM orders
  WHERE buyer_id IN (SELECT id FROM seed_user_ids)
     OR vendor_id IN (SELECT id FROM seed_user_ids)
);

-- Delete orders
DELETE FROM orders
WHERE buyer_id IN (SELECT id FROM seed_user_ids)
   OR vendor_id IN (SELECT id FROM seed_user_ids)
   OR driver_id IN (SELECT id FROM seed_user_ids);

-- ============================================================
-- Step 3: Delete product-related data for seed vendors
-- ============================================================

-- Delete product reviews
DELETE FROM reviews
WHERE product_id IN (
  SELECT id FROM products
  WHERE vendor_id IN (SELECT id FROM seed_user_ids)
);

-- Delete product images
DELETE FROM product_images
WHERE product_id IN (
  SELECT id FROM products
  WHERE vendor_id IN (SELECT id FROM seed_user_ids)
);

-- Delete products
DELETE FROM products
WHERE vendor_id IN (SELECT id FROM seed_user_ids);

-- ============================================================
-- Step 4: Delete commission records
-- ============================================================

DELETE FROM commissions
WHERE vendor_id IN (SELECT id FROM seed_user_ids);

DELETE FROM vendor_commission_summary
WHERE vendor_id IN (SELECT id FROM seed_user_ids);

-- ============================================================
-- Step 5: Delete notifications
-- ============================================================

DELETE FROM notifications
WHERE user_id IN (SELECT id FROM seed_user_ids);

-- ============================================================
-- Step 6: Delete messages / conversations
-- ============================================================

DELETE FROM messages
WHERE sender_id IN (SELECT id FROM seed_user_ids)
   OR receiver_id IN (SELECT id FROM seed_user_ids);

DELETE FROM conversations
WHERE vendor_id IN (SELECT id FROM seed_user_ids)
   OR buyer_id IN (SELECT id FROM seed_user_ids);

-- ============================================================
-- Step 7: Delete loyalty / referral data
-- ============================================================

DELETE FROM loyalty_points
WHERE user_id IN (SELECT id FROM seed_user_ids);

DELETE FROM referrals
WHERE referrer_id IN (SELECT id FROM seed_user_ids)
   OR referred_id IN (SELECT id FROM seed_user_ids);

-- ============================================================
-- Step 8: Delete driver location history
-- ============================================================

DELETE FROM driver_locations
WHERE driver_id IN (SELECT id FROM seed_user_ids);

-- ============================================================
-- Step 9: Delete profiles (must come before auth.users)
-- ============================================================

DELETE FROM profiles
WHERE id IN (SELECT id FROM seed_user_ids);

-- ============================================================
-- Step 10: Delete auth users (Supabase auth)
-- ============================================================
-- NOTE: Use Supabase Admin API or Dashboard for this step.
-- Direct SQL deletion from auth.users requires superuser privileges.
-- Run this in Supabase SQL editor with elevated permissions:

DO $$
DECLARE
  uid UUID;
BEGIN
  FOR uid IN SELECT id FROM seed_user_ids LOOP
    DELETE FROM auth.users WHERE id = uid;
    RAISE NOTICE 'Deleted auth user: %', uid;
  END LOOP;
END $$;

-- ============================================================
-- Step 11: Clean up temp table
-- ============================================================

DROP TABLE seed_user_ids;

-- ============================================================
-- Step 12: Verify cleanup
-- ============================================================

DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM auth.users
  WHERE email IN (
    'vendor1@qotoof.com', 'vendor2@qotoof.com', 'vendor3@qotoof.com',
    'buyer1@qotoof.com', 'buyer2@qotoof.com', 'buyer3@qotoof.com',
    'driver1@qotoof.com', 'driver2@qotoof.com'
  );

  IF remaining_count = 0 THEN
    RAISE NOTICE '✅ All seed accounts successfully removed.';
  ELSE
    RAISE WARNING '⚠️  % seed accounts still remain. Check for FK violations.', remaining_count;
  END IF;
END $$;

-- ============================================================
-- NOTE: After running this script:
-- 1. Verify admin@qotoof.com still exists
-- 2. Verify production vendor/buyer accounts are untouched
-- 3. Reset any sequences if needed
-- 4. Test app login with a real account
-- ============================================================
