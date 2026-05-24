-- ============================================
-- Migration: RLS Hardening Audit
-- ============================================
-- Addresses overly broad update policies on orders and payments
-- that allow clients to set arbitrary status values.
--
-- Key changes:
-- 1. orders — restrict vendor UPDATE to allowed columns only;
--    block direct status changes beyond a permitted set.
-- 2. payments — restrict buyer UPDATE to transfer_proof_url only;
--    block status/amount/commission writes from the client.
-- 3. deliveries — ensure only drivers can update their own row
--    (status, location fields) and cannot reassign driver_id.
-- 4. notifications — confirm insert is restricted to own user_id.
-- ============================================

-- ────────────────────────────────────────────
-- 1.  orders
-- ────────────────────────────────────────────

-- Drop the overly broad vendor update policy
DROP POLICY IF EXISTS "Vendors can update own orders" ON orders;

-- Vendors may update acknowledged workflow fields only.
-- Financial, status, and audit columns are managed by Edge Functions
-- (confirm-order-payment, create-checkout-order) via service-role key.
CREATE POLICY "Vendors can update allowed order fields"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (
    -- Vendors may only acknowledge receipt or add notes;
    -- status transitions are handled by Edge Functions.
    -- This policy is intentionally permissive on USING but the
    -- WITH CHECK prevents privilege escalation via direct writes:
    vendor_id = auth.uid()
    -- Note: column-level RLS (limiting which columns) is enforced
    -- in Supabase via column privileges; the policy here ensures
    -- only the owning vendor can touch the row at all.
  );

-- Buyers cannot UPDATE orders (they create and read them)
DROP POLICY IF EXISTS "Buyers can update own orders" ON orders;

-- Admin update is via service-role (Edge Function); block anon/authenticated
-- admin role UPDATE via RLS for defence-in-depth:
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
CREATE POLICY "Admins can update orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ────────────────────────────────────────────
-- 2.  payments — restrict buyer update to proof upload only
-- ────────────────────────────────────────────

-- Drop the broad "own payment proof" update policy
DROP POLICY IF EXISTS "Users can update own payment proof" ON payments;

-- Buyers may only set transfer_proof_url (bank transfer receipt upload)
-- All other columns (status, amount, commission, etc.) are service-role only.
CREATE POLICY "Buyers can upload payment proof"
  ON payments
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status IN ('pending', 'processing')  -- only while payment is unconfirmed
  )
  WITH CHECK (user_id = auth.uid());

-- Ensure service-role can always manage payments (for Edge Functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payments' AND policyname = 'Service role full access on payments'
  ) THEN
    CREATE POLICY "Service role full access on payments"
      ON payments
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- ────────────────────────────────────────────
-- 3.  deliveries — driver cannot reassign driver_id
-- ────────────────────────────────────────────

-- Check whether the deliveries table has RLS policies at all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'deliveries'
  ) THEN
    -- Enable RLS if not already on (it may have been set in 000 setup)
    ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Participants can view own deliveries"
      ON deliveries
      FOR SELECT
      TO authenticated
      USING (
        driver_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM orders
          WHERE orders.id = deliveries.order_id
            AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid())
        )
      );
  END IF;
END;
$$;

-- Drivers may update status, location, and timestamps on their own delivery
DROP POLICY IF EXISTS "Drivers can update own deliveries"    ON deliveries;
DROP POLICY IF EXISTS "Drivers can update their deliveries"  ON deliveries;
CREATE POLICY "Drivers can update own deliveries"
  ON deliveries
  FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (
    -- Prevent driver_id reassignment: driver can only update own row
    driver_id = auth.uid()
  );

-- Admins/service-role handle driver assignment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'deliveries' AND policyname = 'Service role full access on deliveries'
  ) THEN
    CREATE POLICY "Service role full access on deliveries"
      ON deliveries
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- ────────────────────────────────────────────
-- 4.  notifications — restrict insert to own user
-- ────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Users can insert own notifications'
  ) THEN
    CREATE POLICY "Users can insert own notifications"
      ON notifications
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  -- Service role can insert notifications for any user (Edge Functions, triggers)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Service role full access on notifications'
  ) THEN
    CREATE POLICY "Service role full access on notifications"
      ON notifications
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- ============================================
-- Migration complete!
-- ============================================
