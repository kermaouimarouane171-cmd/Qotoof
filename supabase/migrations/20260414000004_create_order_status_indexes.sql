-- ============================================
-- Create indexes for order statuses
-- Must be after enum values are added
-- ============================================

CREATE INDEX IF NOT EXISTS idx_orders_status_awaiting_driver ON orders(status) WHERE status = 'awaiting_driver';
CREATE INDEX IF NOT EXISTS idx_orders_status_confirmed ON orders(status) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_orders_status_preparing ON orders(status) WHERE status = 'preparing';
CREATE INDEX IF NOT EXISTS idx_orders_status_driver_assigned ON orders(status) WHERE status = 'driver_assigned';
CREATE INDEX IF NOT EXISTS idx_orders_status_picked_up ON orders(status) WHERE status = 'picked_up';
CREATE INDEX IF NOT EXISTS idx_orders_status_on_the_way ON orders(status) WHERE status = 'on_the_way';
CREATE INDEX IF NOT EXISTS idx_orders_status_delivered ON orders(status) WHERE status = 'delivered';
CREATE INDEX IF NOT EXISTS idx_orders_status_cancelled ON orders(status) WHERE status = 'cancelled';
