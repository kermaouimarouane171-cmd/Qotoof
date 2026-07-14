-- =============================================================================
-- Migration 032: Order & Delivery State Machine — QOTOOF
-- Date: 2026-06-21
-- Purpose: Enforce valid order_status and delivery_status transitions at the
--          database level via triggers. This is the canonical state machine.
--
-- Why triggers instead of CHECK constraints?
--   CHECK constraints cannot reference the OLD row, so they cannot validate
--   transitions. Triggers can compare OLD.status and NEW.status.
--
-- Design rules:
--   1. Terminal states are immutable.
--   2. Every transition must be in the allowed transition matrix.
--   3. Edge functions remain the primary mutation path; this is the safety net.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. ORDER STATE TRANSITION MATRIX
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_state_transitions (
  from_status order_status NOT NULL,
  to_status order_status NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

TRUNCATE order_state_transitions RESTART IDENTITY;

INSERT INTO order_state_transitions (from_status, to_status) VALUES
  -- Initial placement
  ('pending', 'confirmed'),
  ('pending', 'vendor_accepted'),
  ('pending', 'vendor_rejected'),
  ('pending', 'cancelled'),

  -- Buyer pre-payment confirmation
  ('confirmed', 'payment_received'),
  ('confirmed', 'cancelled'),
  ('confirmed', 'vendor_accepted'),
  ('confirmed', 'vendor_rejected'),

  -- After payment received
  ('payment_received', 'preparing'),
  ('payment_received', 'cancelled'),
  ('payment_received', 'refunded'),

  -- Vendor preparing
  ('preparing', 'awaiting_driver'),
  ('preparing', 'cancelled'),
  ('preparing', 'refunded'),

  -- Vendor accepted path
  ('vendor_accepted', 'payment_received'),
  ('vendor_accepted', 'preparing'),
  ('vendor_accepted', 'awaiting_driver'),
  ('vendor_accepted', 'cancelled'),
  ('vendor_accepted', 'refunded'),

  -- Awaiting driver
  ('awaiting_driver', 'driver_assigned'),
  ('awaiting_driver', 'cancelled'),
  ('awaiting_driver', 'refunded'),

  -- Driver assigned
  ('driver_assigned', 'driver_accepted'),
  ('driver_assigned', 'awaiting_driver'),
  ('driver_assigned', 'cancelled'),

  -- Driver accepted
  ('driver_accepted', 'driver_picked_up'),
  ('driver_accepted', 'cancelled'),

  -- Picked up
  ('driver_picked_up', 'on_the_way'),
  ('driver_picked_up', 'shipped'),
  ('driver_picked_up', 'cancelled'),

  -- On the way / shipped
  ('on_the_way', 'delivered'),
  ('on_the_way', 'cancelled'),
  ('shipped', 'on_the_way'),
  ('shipped', 'delivered'),
  ('shipped', 'cancelled'),

  -- Delivered
  ('delivered', 'refunded');

-- =============================================================================
-- 2. DELIVERY STATE TRANSITION MATRIX
-- =============================================================================
CREATE TABLE IF NOT EXISTS delivery_state_transitions (
  from_status delivery_status NOT NULL,
  to_status delivery_status NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

TRUNCATE delivery_state_transitions RESTART IDENTITY;

INSERT INTO delivery_state_transitions (from_status, to_status) VALUES
  ('unassigned', 'assigned'),
  ('assigned', 'accepted'),
  ('assigned', 'unassigned'),
  ('accepted', 'picked_up'),
  ('accepted', 'unassigned'),
  ('picked_up', 'on_the_way'),
  ('on_the_way', 'delivered'),
  ('on_the_way', 'failed'),
  ('delivered', 'failed'),
  ('failed', 'unassigned');

-- =============================================================================
-- 3. TRANSITION VALIDATION FUNCTIONS
-- =============================================================================
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  terminal_statuses order_status[] := ARRAY['delivered', 'cancelled', 'vendor_rejected', 'refunded'];
BEGIN
  -- Allow unchanged status
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Terminal states are immutable
  IF OLD.status = ANY(terminal_statuses) THEN
    RAISE EXCEPTION 'Order % is in terminal state % and cannot transition to %',
      NEW.id, OLD.status, NEW.status;
  END IF;

  -- Validate transition exists in matrix
  IF NOT EXISTS (
    SELECT 1 FROM order_state_transitions
    WHERE from_status = OLD.status AND to_status = NEW.status
  ) THEN
    RAISE EXCEPTION 'Invalid order status transition: % -> % for order %',
      OLD.status, NEW.status, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_delivery_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  terminal_statuses delivery_status[] := ARRAY['delivered'];
BEGIN
  -- Allow unchanged status
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Terminal states are immutable
  IF OLD.status = ANY(terminal_statuses) THEN
    RAISE EXCEPTION 'Delivery % is in terminal state % and cannot transition to %',
      NEW.id, OLD.status, NEW.status;
  END IF;

  -- Validate transition exists in matrix
  IF NOT EXISTS (
    SELECT 1 FROM delivery_state_transitions
    WHERE from_status = OLD.status AND to_status = NEW.status
  ) THEN
    RAISE EXCEPTION 'Invalid delivery status transition: % -> % for delivery %',
      OLD.status, NEW.status, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. TRIGGERS
-- =============================================================================
DROP TRIGGER IF EXISTS validate_order_status ON orders;
CREATE TRIGGER validate_order_status
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_status_transition();

DROP TRIGGER IF EXISTS validate_delivery_status ON deliveries;
CREATE TRIGGER validate_delivery_status
  BEFORE UPDATE OF status ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION validate_delivery_status_transition();

-- =============================================================================
-- 5. DOCUMENTATION VIEWS
-- =============================================================================
CREATE OR REPLACE VIEW order_status_flow AS
SELECT
  from_status,
  to_status,
  from_status || ' → ' || to_status AS transition
FROM order_state_transitions
ORDER BY from_status, to_status;

CREATE OR REPLACE VIEW delivery_status_flow AS
SELECT
  from_status,
  to_status,
  from_status || ' → ' || to_status AS transition
FROM delivery_state_transitions
ORDER BY from_status, to_status;

COMMENT ON TABLE order_state_transitions IS 'Canonical allowed transitions for orders.status';
COMMENT ON TABLE delivery_state_transitions IS 'Canonical allowed transitions for deliveries.status';
COMMENT ON FUNCTION validate_order_status_transition() IS 'Database-level safety net for order status transitions';
COMMENT ON FUNCTION validate_delivery_status_transition() IS 'Database-level safety net for delivery status transitions';

-- =============================================================================
-- 6. VERIFICATION
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_order_status'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: validate_order_status trigger not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_delivery_status'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: validate_delivery_status trigger not created';
  END IF;

  IF (SELECT COUNT(*) FROM order_state_transitions) < 20 THEN
    RAISE EXCEPTION 'CRITICAL: order transition matrix is incomplete';
  END IF;

  IF (SELECT COUNT(*) FROM delivery_state_transitions) < 8 THEN
    RAISE EXCEPTION 'CRITICAL: delivery transition matrix is incomplete';
  END IF;
END $$;

COMMIT;
