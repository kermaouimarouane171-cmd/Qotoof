-- ===============================================================
-- Qotoof Marketplace - Sync Vendor Contract Data
-- ===============================================================
-- This migration adds triggers to sync critical data from profiles
-- to vendor_contracts to avoid data duplication issues.
-- Safe to re-run.
-- ===============================================================

BEGIN;

-- ===============================================================
-- 1. Create function to sync profile data to vendor_contracts
-- ===============================================================

CREATE OR REPLACE FUNCTION public.sync_vendor_contract_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if the user is a vendor and has a contract
  IF NEW.role = 'vendor' THEN
    UPDATE vendor_contracts
    SET
      phone = NEW.phone,
      email = NEW.email,
      paypal_email = NEW.paypal_email
    WHERE vendor_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===============================================================
-- 2. Create trigger on profiles update
-- ===============================================================

DROP TRIGGER IF EXISTS trg_sync_vendor_contract_data ON profiles;

CREATE TRIGGER trg_sync_vendor_contract_data
  AFTER UPDATE OF phone, email, paypal_email ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_vendor_contract_data();

-- ===============================================================
-- 3. Sync existing data
-- ===============================================================

UPDATE vendor_contracts vc
SET
  phone = p.phone,
  email = p.email,
  paypal_email = p.paypal_email
FROM profiles p
WHERE vc.vendor_id = p.id
  AND p.role = 'vendor';

COMMIT;

-- ===============================================================
-- Verification query (commented out - run manually to verify)
-- ===============================================================

-- SELECT vc.id, vc.vendor_id, vc.phone, vc.email, vc.paypal_email,
--        p.phone as profile_phone, p.email as profile_email, p.paypal_email as profile_paypal_email
-- FROM vendor_contracts vc
-- JOIN profiles p ON vc.vendor_id = p.id
-- WHERE p.role = 'vendor'
-- LIMIT 10;
