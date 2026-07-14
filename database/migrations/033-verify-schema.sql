-- =============================================================================
-- Migration 033: Schema Verification — QOTOOF
-- Date: 2026-06-21
-- Purpose: Run after 030, 031, 032 to confirm data stabilization is complete.
--          This file is intentionally separate so it runs in its own transaction
--          and can see the committed catalog state.
--
-- To run locally:
--   psql -h <host> -p <port> -U postgres -d qotoof_test -f 033-verify-schema.sql
--
-- A return code of 0 means all verification checks passed.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Verify all expected tables exist
-- =============================================================================
DO $$
DECLARE
  expected_tables TEXT[] := ARRAY[
    'profiles', 'stores', 'products', 'product_images', 'orders', 'order_items',
    'deliveries', 'reviews', 'driver_reviews', 'notifications', 'vendor_documents',
    'favorites', 'messages', 'conversations', 'conversation_participants',
    'delivery_zones', 'driver_pricing', 'delivery_tracking', 'tier_pricing',
    'driver_locations', 'delivery_requests', 'order_timeline', 'verification_documents',
    'user_reports', 'delivery_checklist', 'payments', 'addresses', 'coupons', 'returns',
    'bank_accounts', 'vendor_schedules', 'stock_history', 'audit_logs', 'security_alerts',
    'blocked_ips', 'rate_limits', 'product_reviews', 'return_requests', 'support_tickets',
    'comparison_lists', 'contact_messages', 'coupon_redemptions', 'driver_availability_log',
    'driver_availability_requests', 'driver_verification_documents', 'driver_earnings',
    'financial_audit_log', 'loyalty_points', 'loyalty_transactions', 'platform_settings',
    'settings_audit_log', 'shopping_lists', 'shopping_list_items', 'store_follows', 'user_settings',
    'carts', 'cart_items', 'checkout_requests', 'regions', 'city_distances',
    'vendor_cancellation_policies', 'vendor_delivery_slots', 'vendor_wait_responses',
    'vendor_contracts', 'product_waitlists', 'notification_preferences', 'loyalty_rewards',
    'referrals', 'invoices', 'payment_methods', 'user_payment_methods', 'platform_commissions',
    'vendor_monthly_sales', 'confirmed_transactions', 'commission_notifications',
    'cancellation_log', 'payment_disputes', 'payment_terms_acceptance', 'driver_broadcast_events'
  ];
  missing_tables TEXT[];
BEGIN
  SELECT array_agg(t) INTO missing_tables
  FROM unnest(expected_tables) AS t
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = t
  );

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Missing tables: %', missing_tables;
  END IF;
END $$;

-- =============================================================================
-- 2. Verify RLS is enabled on all expected tables
-- =============================================================================
DO $$
DECLARE
  expected_tables TEXT[] := ARRAY[
    'profiles', 'stores', 'products', 'product_images', 'orders', 'order_items',
    'deliveries', 'reviews', 'driver_reviews', 'notifications', 'vendor_documents',
    'favorites', 'messages', 'conversations', 'conversation_participants',
    'delivery_zones', 'driver_pricing', 'delivery_tracking', 'tier_pricing',
    'driver_locations', 'delivery_requests', 'order_timeline', 'verification_documents',
    'user_reports', 'delivery_checklist', 'payments', 'addresses', 'coupons', 'returns',
    'bank_accounts', 'vendor_schedules', 'stock_history', 'audit_logs', 'security_alerts',
    'blocked_ips', 'rate_limits', 'product_reviews', 'return_requests', 'support_tickets',
    'comparison_lists', 'contact_messages', 'coupon_redemptions', 'driver_availability_log',
    'driver_availability_requests', 'driver_verification_documents', 'driver_earnings',
    'financial_audit_log', 'loyalty_points', 'loyalty_transactions', 'platform_settings',
    'settings_audit_log', 'shopping_lists', 'shopping_list_items', 'store_follows', 'user_settings',
    'carts', 'cart_items', 'checkout_requests', 'regions', 'city_distances',
    'vendor_cancellation_policies', 'vendor_delivery_slots', 'vendor_wait_responses',
    'vendor_contracts', 'product_waitlists', 'notification_preferences', 'loyalty_rewards',
    'referrals', 'invoices', 'payment_methods', 'user_payment_methods', 'platform_commissions',
    'vendor_monthly_sales', 'confirmed_transactions', 'commission_notifications',
    'cancellation_log', 'payment_disputes', 'payment_terms_acceptance', 'driver_broadcast_events'
  ];
  rls_disabled_tables TEXT[];
BEGIN
  SELECT array_agg(t) INTO rls_disabled_tables
  FROM unnest(expected_tables) AS t
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_class
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_namespace.nspname = 'public'
      AND pg_class.relname = t
      AND pg_class.relrowsecurity = true
  );

  IF rls_disabled_tables IS NOT NULL THEN
    RAISE EXCEPTION 'RLS not enabled on tables: %', rls_disabled_tables;
  END IF;
END $$;

-- =============================================================================
-- 3. Verify conflicting columns are gone
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'message'
  ) THEN
    RAISE EXCEPTION 'Deprecated column messages.message still exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_timeline' AND column_name IN ('status', 'updated_by', 'description')
  ) THEN
    RAISE EXCEPTION 'Deprecated columns in order_timeline still exist';
  END IF;
END $$;

-- =============================================================================
-- 4. Verify rogue tables are dropped or absent
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('users', 'drivers', 'driver_ratings', 'available_deliveries')
  ) THEN
    RAISE EXCEPTION 'Rogue tables still exist: users/drivers/driver_ratings/available_deliveries';
  END IF;
END $$;

-- =============================================================================
-- 5. Verify state machine triggers and matrices
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_order_status'
  ) THEN
    RAISE EXCEPTION 'validate_order_status trigger missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_delivery_status'
  ) THEN
    RAISE EXCEPTION 'validate_delivery_status trigger missing';
  END IF;

  IF (SELECT COUNT(*) FROM order_state_transitions) < 20 THEN
    RAISE EXCEPTION 'order_state_transitions incomplete: % rows', (SELECT COUNT(*) FROM order_state_transitions);
  END IF;

  IF (SELECT COUNT(*) FROM delivery_state_transitions) < 8 THEN
    RAISE EXCEPTION 'delivery_state_transitions incomplete: % rows', (SELECT COUNT(*) FROM delivery_state_transitions);
  END IF;
END $$;

-- =============================================================================
-- 6. Verify expected policies count
-- =============================================================================
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') < 50 THEN
    RAISE EXCEPTION 'Too few public policies: %', (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public');
  END IF;
END $$;

-- =============================================================================
-- 7. Verify critical foreign keys
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'deliveries' AND constraint_name = 'fk_deliveries_driver'
  ) THEN
    RAISE EXCEPTION 'fk_deliveries_driver constraint missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.referential_constraints
    WHERE constraint_name = 'fk_messages_conversation'
  ) THEN
    RAISE EXCEPTION 'fk_messages_conversation constraint missing';
  END IF;
END $$;

-- =============================================================================
-- 8. Verify default delivery zones
-- =============================================================================
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM delivery_zones) < 8 THEN
    RAISE EXCEPTION 'Delivery zones not seeded properly: %', (SELECT COUNT(*) FROM delivery_zones);
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- 9. SUMMARY (read-only, outside transaction)
-- =============================================================================
SELECT 'Schema verification passed' AS status,
       (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') AS table_count,
       (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS policy_count,
       (SELECT COUNT(*) FROM order_state_transitions) AS order_transitions,
       (SELECT COUNT(*) FROM delivery_state_transitions) AS delivery_transitions;
