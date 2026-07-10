-- Fix CIN column name mismatch
-- Problem: Code uses 'cin' but database has 'cin_number'
-- Solution: Add 'cin' as a generated column alias
-- Date: 2025-01-20
-- Priority: P0 (Critical)

-- Add cin as a generated column (read-only alias)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cin TEXT GENERATED ALWAYS AS (cin_number) STORED;

-- Add comment for documentation
COMMENT ON COLUMN profiles.cin IS 'Alias for cin_number - auto-generated, read-only';

-- Note: This is a read-only alias. All writes should go to cin_number.
-- The application code can read from either 'cin' or 'cin_number'.
