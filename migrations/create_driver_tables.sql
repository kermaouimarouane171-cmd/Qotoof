-- =============================================================================
-- DEPRECATED — Do NOT apply this file to any environment.
-- =============================================================================
-- This file was the original rogue driver schema. It used a standalone
-- `users` table and a separate `drivers` table instead of leveraging the
-- canonical `profiles` table (which references auth.users).
--
-- REPLACEMENT: database/migrations/20260519_fix_driver_schema.sql
--
-- Conflict summary:
--   • drivers.user_id         → REFERENCES users(id)   [WRONG: no `users` table]
--   • deliveries.customer_id  → REFERENCES users(id)   [WRONG: conflicts with canonical]
--   • driver_ratings           → REFERENCES drivers(id) [WRONG: rogue table]
--   • available_deliveries     → orphan table           [replaced by VIEW]
--
-- All tables below are kept for historical reference only.
-- The correct approach is: drivers ARE profiles with role = 'driver'.
-- =============================================================================

-- ⚠️  ORIGINAL CONTENT BELOW — HISTORICAL REFERENCE ONLY ⚠️

-- Create drivers table
-- DEPRECATED: use profiles WHERE role = 'driver' instead
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- WRONG FK: should be REFERENCES profiles(id) ON DELETE CASCADE
  -- user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  license_number VARCHAR(50) UNIQUE NOT NULL,
  vehicle_info TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_break', 'suspended')),
  rating DECIMAL(3,2) DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  completed_deliveries INTEGER DEFAULT 0,
  cancelled_deliveries INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (rating >= 0 AND rating <= 5)
);

-- DEPRECATED: deliveries is defined in 000-complete-fresh-setup.sql
-- The canonical deliveries.driver_id REFERENCES profiles(id)
-- This block is kept for reference; DO NOT apply it.
-- CREATE TABLE IF NOT EXISTS deliveries ( ... REFERENCES profiles(id) ... );

-- DEPRECATED: replaced by driver_reviews in canonical schema
-- driver_reviews.driver_id   REFERENCES profiles(id)
-- driver_reviews.reviewer_id REFERENCES profiles(id)
-- See: database/migrations/20260519_fix_driver_schema.sql

-- DEPRECATED: replaced by VIEW available_deliveries_view
-- Query: SELECT * FROM deliveries WHERE status = 'unassigned' AND driver_id IS NULL
-- See: database/migrations/20260519_fix_driver_schema.sql

-- DEPRECATED: driver_earnings now REFERENCES profiles(id), not drivers(id)
-- See canonical definition in: database/migrations/20260519_fix_driver_schema.sql
-- CREATE TABLE IF NOT EXISTS driver_earnings (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- FIXED
--   delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 0,
  commission_amount DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'held')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP
);

-- Create necessary indexes
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_driver_ratings_driver_id ON driver_ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_ratings_delivery_id ON driver_ratings(delivery_id);
CREATE INDEX IF NOT EXISTS idx_available_deliveries_status ON available_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver_id ON driver_earnings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_status ON driver_earnings(status);

-- Create triggers for updating drivers stats
CREATE OR REPLACE FUNCTION update_driver_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE drivers 
    SET total_deliveries = total_deliveries + 1,
        completed_deliveries = completed_deliveries + 1,
        total_earnings = total_earnings + NEW.amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.driver_id;
  END IF;
  
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE drivers 
    SET cancelled_deliveries = cancelled_deliveries + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.driver_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_driver_stats
AFTER UPDATE ON deliveries
FOR EACH ROW
EXECUTE FUNCTION update_driver_stats();

-- Create trigger for updating driver rating
CREATE OR REPLACE FUNCTION update_driver_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE drivers 
  SET rating = (
    SELECT AVG(rating) FROM driver_ratings WHERE driver_id = NEW.driver_id
  )
  WHERE id = NEW.driver_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_driver_rating
AFTER INSERT ON driver_ratings
FOR EACH ROW
EXECUTE FUNCTION update_driver_rating();
