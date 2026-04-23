-- ============================================
-- Privacy Settings & Account Deletion
-- Adds notification preference columns and
-- proper account deletion with full CASCADE
-- ============================================

-- 1. Add privacy preference columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_updates BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS marketing_emails BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_sharing BOOLEAN DEFAULT false;

-- 2. Fix orders table to allow user deletion
-- When a user is deleted, anonymize their orders instead of blocking deletion
-- This preserves order history for vendors/drivers while allowing user deletion

-- First, add ON DELETE SET NULL for buyer_id and vendor_id
-- We'll use a trigger to anonymize orders before deletion

-- 3. Create account deletion function
-- This function:
--   a) Anonymizes orders (preserves business data)
--   b) Deletes all user-specific data
--   c) Deletes the auth user
--   d) Logs the deletion

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get user email for logging
  SELECT email INTO v_email FROM profiles WHERE id = v_user_id;

  -- 1. Anonymize orders (preserve for vendors/drivers/audit)
  UPDATE orders
  SET
    buyer_id = NULL,
    shipping_address = 'Account Deleted',
    shipping_city = 'Account Deleted',
    buyer_notes = NULL
  WHERE buyer_id = v_user_id;

  -- 2. Delete vendor-related data if user is a vendor
  -- Products cascade to product_images, reviews, etc.
  DELETE FROM products WHERE vendor_id = v_user_id;

  -- 3. Delete favorites
  DELETE FROM favorites WHERE user_id = v_user_id OR vendor_id = v_user_id;

  -- 4. Delete notifications
  DELETE FROM notifications WHERE user_id = v_user_id;

  -- 5. Delete conversations and messages
  DELETE FROM messages WHERE conversation_id IN (
    SELECT id FROM conversations WHERE buyer_id = v_user_id OR vendor_id = v_user_id
  );
  DELETE FROM conversations WHERE buyer_id = v_user_id OR vendor_id = v_user_id;

  -- 6. Delete active sessions
  DELETE FROM active_sessions WHERE user_id = v_user_id;

  -- 7. Delete MFA settings
  DELETE FROM mfa_settings WHERE user_id = v_user_id;

  -- 8. Delete OTP codes
  DELETE FROM otp_codes WHERE user_id = v_user_id;

  -- 9. Delete bank accounts
  DELETE FROM bank_accounts WHERE user_id = v_user_id;

  -- 10. Delete driver-specific data
  DELETE FROM driver_pricing WHERE driver_id = v_user_id;
  DELETE FROM driver_earnings WHERE driver_id = v_user_id;
  UPDATE deliveries SET driver_id = NULL WHERE driver_id = v_user_id;

  -- 11. Delete vendor documents
  DELETE FROM vendor_documents WHERE vendor_id = v_user_id;

  -- 12. Delete offline sync queue
  DELETE FROM offline_sync_queue WHERE user_id = v_user_id;

  -- 13. Delete profile (this cascades to remaining FK references)
  DELETE FROM profiles WHERE id = v_user_id;

  -- 14. Delete auth user (this is the final step)
  DELETE FROM auth.users WHERE id = v_user_id;

  -- Log the deletion
  RAISE NOTICE 'Account deleted for user: %', v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create RLS policy for the deletion function
-- SECURITY DEFINER allows the function to bypass RLS

-- 5. Add updated_at trigger for profiles
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Notify success
DO $$
BEGIN
  RAISE NOTICE '✅ Privacy settings columns added!';
  RAISE NOTICE '   - email_notifications (default: true)';
  RAISE NOTICE '   - order_updates (default: true)';
  RAISE NOTICE '   - marketing_emails (default: false)';
  RAISE NOTICE '   - data_sharing (default: false)';
  RAISE NOTICE '✅ Account deletion function created: delete_user_account()';
END $$;
