-- Migration: Add negotiation support to cart_items
-- Adds negotiation_id, locked_price, is_negotiated columns
-- so that accepted negotiation offers can be added to the cart
-- with a price that won't change even if the product price updates.

-- Add columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cart_items' AND column_name = 'negotiation_id') THEN
    ALTER TABLE cart_items ADD COLUMN negotiation_id UUID REFERENCES price_negotiations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cart_items' AND column_name = 'locked_price') THEN
    ALTER TABLE cart_items ADD COLUMN locked_price NUMERIC(10, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cart_items' AND column_name = 'is_negotiated') THEN
    ALTER TABLE cart_items ADD COLUMN is_negotiated BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Index for quick lookup of negotiated items
CREATE INDEX IF NOT EXISTS idx_cart_items_negotiation_id ON cart_items(negotiation_id) WHERE negotiation_id IS NOT NULL;

-- Constraint: if is_negotiated is true, locked_price must be set
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_negotiated_has_locked_price') THEN
    ALTER TABLE cart_items ADD CONSTRAINT check_negotiated_has_locked_price
      CHECK (NOT is_negotiated OR locked_price IS NOT NULL);
  END IF;
END $$;

-- Constraint: if is_negotiated is true, negotiation_id should be set
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_negotiated_has_negotiation_id') THEN
    ALTER TABLE cart_items ADD CONSTRAINT check_negotiated_has_negotiation_id
      CHECK (NOT is_negotiated OR negotiation_id IS NOT NULL);
  END IF;
END $$;
