-- =============================================================================
-- Migration 037: Fix Open INSERT RLS Policies
-- Date: 2026-06-28
-- Purpose: Restrict INSERT on payments, deliveries, notifications, and
--          order_timeline to service_role only. Previously these tables had
--          `WITH CHECK (true)` policies that allowed ANY user (including anon)
--          to insert fake records.
--
-- Security issues fixed:
--   SEC-001: payments_system_insert       — allowed fake payment records
--   SEC-002: deliveries_system_insert     — allowed fake delivery records
--   SEC-003: notifications_system_insert   — allowed notification spam
--   SEC-004: order_timeline_system_insert  — allowed fake timeline entries
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. PAYMENTS — restrict INSERT to service_role only
-- =============================================================================
DROP POLICY IF EXISTS "payments_system_insert" ON payments;
CREATE POLICY "payments_service_insert" ON payments FOR INSERT TO service_role WITH CHECK (true);

-- =============================================================================
-- 2. DELIVERIES — restrict INSERT to service_role only
-- =============================================================================
DROP POLICY IF EXISTS "deliveries_system_insert" ON deliveries;
CREATE POLICY "deliveries_service_insert" ON deliveries FOR INSERT TO service_role WITH CHECK (true);

-- =============================================================================
-- 3. NOTIFICATIONS — restrict INSERT to service_role only
-- =============================================================================
DROP POLICY IF EXISTS "notifications_system_insert" ON notifications;
CREATE POLICY "notifications_service_insert" ON notifications FOR INSERT TO service_role WITH CHECK (true);

-- =============================================================================
-- 4. ORDER_TIMELINE — restrict INSERT to service_role only
-- =============================================================================
DROP POLICY IF EXISTS "order_timeline_system_insert" ON order_timeline;
CREATE POLICY "order_timeline_service_insert" ON order_timeline FOR INSERT TO service_role WITH CHECK (true);

-- =============================================================================
-- 5. COMMISSION_NOTIFICATIONS — restrict INSERT to service_role only
-- =============================================================================
DROP POLICY IF EXISTS "commission_notifications_system_insert" ON commission_notifications;
CREATE POLICY "commission_notifications_service_insert" ON commission_notifications FOR INSERT TO service_role WITH CHECK (true);

COMMIT;
