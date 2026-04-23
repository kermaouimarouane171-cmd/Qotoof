-- =====================================================
-- ADD VENDOR NOTIFICATION TRIGGERS
-- Creates database triggers to notify vendors when their
-- application is approved, rejected, or account is suspended
-- =====================================================

-- Function to create notifications when vendor status changes
CREATE OR REPLACE FUNCTION public.notify_vendor_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vendor_status != OLD.vendor_status OR NEW.is_suspended != OLD.is_suspended THEN
    -- Vendor approved
    IF NEW.vendor_status = 'approved' AND (OLD.vendor_status != 'approved' OR OLD.vendor_status IS NULL) THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.id,
        '✅ Vendor Application Approved',
        'Congratulations! Your vendor application has been approved. You can now list products and start selling on Qotoof.',
        'system',
        jsonb_build_object('source', 'admin', 'action', 'vendor_approved')
      );
    
    -- Vendor rejected
    ELSIF NEW.vendor_status = 'rejected' AND (OLD.vendor_status != 'rejected' OR OLD.vendor_status IS NULL) THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.id,
        '❌ Vendor Application Rejected',
        'Your vendor application has been rejected. Please contact support for more information.',
        'system',
        jsonb_build_object('source', 'admin', 'action', 'vendor_rejected')
      );
    
    -- Vendor suspended
    ELSIF NEW.is_suspended = true AND (OLD.is_suspended = false OR OLD.is_suspended IS NULL) THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.id,
        '⚠️ Vendor Account Suspended',
        CASE 
          WHEN NEW.suspension_reason IS NOT NULL THEN 
            'Your vendor account has been suspended. Reason: ' || NEW.suspension_reason || 
            CASE WHEN NEW.suspension_end IS NOT NULL THEN 
              '. Suspension end date: ' || TO_CHAR(NEW.suspension_end, 'YYYY-MM-DD')
            ELSE 
              ''
            END
          ELSE 
            'Your vendor account has been suspended. Please contact support for more information.'
        END,
        'system',
        jsonb_build_object('source', 'admin', 'action', 'vendor_suspended', 'reason', NEW.suspension_reason)
      );
    
    -- Vendor unsuspended
    ELSIF NEW.is_suspended = false AND OLD.is_suspended = true THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.id,
        '✅ Vendor Account Restored',
        'Your vendor account has been restored. You can now list products and resume selling on Qotoof.',
        'system',
        jsonb_build_object('source', 'admin', 'action', 'vendor_unsuspended')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on profiles table for vendor status changes
DROP TRIGGER IF EXISTS notify_vendor_status_change ON profiles;
CREATE TRIGGER notify_vendor_status_change
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.vendor_status IS DISTINCT FROM NEW.vendor_status OR OLD.is_suspended IS DISTINCT FROM NEW.is_suspended)
  EXECUTE FUNCTION public.notify_vendor_status_change();

-- Add index for faster vendor status queries
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_status_filter ON profiles(vendor_status, is_suspended) WHERE role = 'vendor';

-- Ensure all existing vendors have proper vendor_status
UPDATE profiles 
SET vendor_status = 'approved' 
WHERE role = 'vendor' 
  AND is_verified = true 
  AND (vendor_status IS NULL OR vendor_status = 'pending');

UPDATE profiles 
SET vendor_status = 'rejected' 
WHERE role = 'vendor' 
  AND is_verified = false 
  AND (vendor_status IS NULL OR vendor_status = 'pending')
  AND is_suspended = false;
