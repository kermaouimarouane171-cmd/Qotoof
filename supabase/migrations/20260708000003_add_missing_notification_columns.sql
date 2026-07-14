-- =====================================================
-- ADD MISSING NOTIFICATION COLUMNS TO PROFILES
-- Fixes PGRST204 error when saving Vendor/Driver Settings
-- =====================================================
-- Issue: notify_customer_messages, notify_low_stock, and other
-- notification columns were added in migration 006 for drivers only,
-- but are used by both vendors and drivers in the frontend code.
-- This migration adds them to the canonical schema for all roles.
-- =====================================================

-- Add notification preference columns for all roles (not just drivers)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_new_deliveries BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_order_updates BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_customer_messages BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_low_stock BOOLEAN DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN profiles.notify_new_deliveries IS 'Receive notifications when new delivery is assigned (driver)';
COMMENT ON COLUMN profiles.notify_order_updates IS 'Receive notifications when order/delivery status changes';
COMMENT ON COLUMN profiles.notify_customer_messages IS 'Receive notifications when customer sends a message';
COMMENT ON COLUMN profiles.notify_low_stock IS 'Receive notifications when product stock falls below threshold (vendor)';

-- Update existing records to have default values
-- This ensures all existing users have these columns set
UPDATE profiles 
SET 
  notify_new_deliveries = COALESCE(notify_new_deliveries, true),
  notify_order_updates = COALESCE(notify_order_updates, true),
  notify_customer_messages = COALESCE(notify_customer_messages, true),
  notify_low_stock = COALESCE(notify_low_stock, true)
WHERE 
  notify_new_deliveries IS NULL OR
  notify_order_updates IS NULL OR
  notify_customer_messages IS NULL OR
  notify_low_stock IS NULL;
