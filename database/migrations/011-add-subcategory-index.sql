-- Migration: Add subcategory index for better filtering performance
-- Date: 2026-04-10
-- Description: Add index on subcategory column and ensure it exists

-- Ensure subcategory column exists (it should already exist from base schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'subcategory'
  ) THEN
    ALTER TABLE products ADD COLUMN subcategory TEXT;
  END IF;
END $$;

-- Add index on subcategory for filtering
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory) WHERE subcategory IS NOT NULL;

-- Add composite index for category + subcategory filtering
CREATE INDEX IF NOT EXISTS idx_products_category_subcategory ON products(category, subcategory) WHERE subcategory IS NOT NULL;

-- Update the marketplace composite index to include subcategory
DROP INDEX IF EXISTS idx_products_marketplace;
CREATE INDEX idx_products_marketplace ON products(is_available, category, subcategory, created_at DESC);

-- Add comment for documentation
COMMENT ON COLUMN products.subcategory IS 'Free-text subcategory entered by vendor (e.g., "Tomatoes" under "Vegetables")';
