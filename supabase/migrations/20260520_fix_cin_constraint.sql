-- Migration 002: Fix CIN format constraint to match actual Moroccan CIN format
-- Real CIN format: 1-2 uppercase letters followed by 5-6 digits (max 8 chars total,
-- fits existing VARCHAR(8) column). Examples: T12345, AB123456, A123456.
-- The original constraint required exactly 2 letters + 6 digits which was too strict.

-- 1. Drop the old over-restrictive constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS cin_format_check;

-- 2. Add the corrected constraint (no column resize needed — stays VARCHAR(8))
ALTER TABLE profiles
ADD CONSTRAINT cin_format_check
CHECK (cin IS NULL OR cin ~ '^[A-Z]{1,2}[0-9]{5,6}$');
