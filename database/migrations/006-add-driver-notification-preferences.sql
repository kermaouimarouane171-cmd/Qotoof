-- =====================================================
-- ADD DRIVER NOTIFICATION PREFERENCES
-- Adds notification preference columns to profiles table
-- =====================================================

-- Add notification preference columns for drivers
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_new_deliveries BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_order_updates BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_customer_messages BOOLEAN DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN profiles.notify_new_deliveries IS 'Receive notifications when new delivery is assigned';
COMMENT ON COLUMN profiles.notify_order_updates IS 'Receive notifications when delivery status changes';
COMMENT ON COLUMN profiles.notify_customer_messages IS 'Receive notifications when customer sends a message';

-- Update existing drivers to have default values
UPDATE profiles 
SET 
  notify_new_deliveries = true,
  notify_order_updates = true,
  notify_customer_messages = true
WHERE role = 'driver';
