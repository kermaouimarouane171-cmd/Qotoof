-- ============================================
-- Add 'awaiting_driver' to order_status enum
-- Must be in separate migration file (PostgreSQL transaction limitation)
-- ============================================

-- Add 'awaiting_driver' to order_status enum
DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE 'awaiting_driver';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
