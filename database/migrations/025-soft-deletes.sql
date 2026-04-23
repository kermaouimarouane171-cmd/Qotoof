-- ============================================
-- Soft Deletes Migration
-- Adds deleted_at column to critical tables
-- ============================================

-- Add deleted_at columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create views for active (non-deleted) records
CREATE OR REPLACE VIEW active_products AS
SELECT * FROM products WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_orders AS
SELECT * FROM orders WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_profiles AS
SELECT * FROM profiles WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_reviews AS
SELECT * FROM reviews WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_notifications AS
SELECT * FROM notifications WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_favorites AS
SELECT * FROM favorites WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_messages AS
SELECT * FROM messages WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_deliveries AS
SELECT * FROM deliveries WHERE deleted_at IS NULL;

-- Function to restore a soft-deleted record
CREATE OR REPLACE FUNCTION restore_record(
  table_name TEXT,
  record_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET deleted_at = NULL WHERE id = $1',
    table_name
  ) USING record_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to soft-delete a record
CREATE OR REPLACE FUNCTION soft_delete_record(
  table_name TEXT,
  record_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
    table_name
  ) USING record_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes for soft-deleted records
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_deleted_at ON reviews(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON notifications(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_favorites_deleted_at ON favorites(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_deleted_at ON deliveries(deleted_at) WHERE deleted_at IS NOT NULL;
