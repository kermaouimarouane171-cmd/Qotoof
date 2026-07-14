-- ===============================================================
-- Qotoof Marketplace - Add RLS Policies for vendor_contracts
-- ===============================================================
-- This migration adds Row Level Security policies for vendor_contracts
-- to ensure vendors can only view their own contracts.
-- Safe to re-run.
-- ===============================================================

BEGIN;

-- ===============================================================
-- 1. Enable RLS on vendor_contracts
-- ===============================================================

ALTER TABLE vendor_contracts ENABLE ROW LEVEL SECURITY;

-- ===============================================================
-- 2. Drop existing policies if they exist
-- ===============================================================

DROP POLICY IF EXISTS vendor_contracts_vendor_select ON vendor_contracts;
DROP POLICY IF EXISTS vendor_contracts_vendor_insert ON vendor_contracts;
DROP POLICY IF EXISTS vendor_contracts_admin_select ON vendor_contracts;
DROP POLICY IF EXISTS vendor_contracts_admin_insert ON vendor_contracts;

-- ===============================================================
-- 3. Vendor policies - vendors can only view their own contracts
-- ===============================================================

CREATE POLICY vendor_contracts_vendor_select
  ON vendor_contracts
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = vendor_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ===============================================================
-- 4. Vendor policies - vendors can only insert their own contracts
-- ===============================================================

CREATE POLICY vendor_contracts_vendor_insert
  ON vendor_contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = vendor_id
  );

-- ===============================================================
-- 5. Admin policies - admins can view all contracts
-- ===============================================================

CREATE POLICY vendor_contracts_admin_select
  ON vendor_contracts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ===============================================================
-- 6. Admin policies - admins can insert contracts on behalf of vendors
-- ===============================================================

CREATE POLICY vendor_contracts_admin_insert
  ON vendor_contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

COMMIT;

-- ===============================================================
-- Verification query (commented out - run manually to verify)
-- ===============================================================

-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'vendor_contracts'
-- ORDER BY policyname;
