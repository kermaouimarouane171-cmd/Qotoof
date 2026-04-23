-- ============================================
-- FIX: Add missing vendor_guidelines_accepted column
-- ============================================
-- Run this in Supabase SQL Editor to fix the error:
-- "Could not find the 'vendor_guidelines_accepted' column of 'profiles'"

-- Add vendor_guidelines_accepted column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'vendor_guidelines_accepted'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN vendor_guidelines_accepted BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add vendor_guidelines_accepted_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'vendor_guidelines_accepted_at'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN vendor_guidelines_accepted_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add is_verified column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add verification_status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN verification_status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- Add latitude column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'latitude'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN latitude DOUBLE PRECISION;
  END IF;
END $$;

-- Add longitude column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'longitude'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN longitude DOUBLE PRECISION;
  END IF;
END $$;

-- Add last_seen_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN last_seen_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add is_available_for_delivery column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'is_available_for_delivery'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN is_available_for_delivery BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add vehicle_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'vehicle_type'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN vehicle_type TEXT DEFAULT 'van';
  END IF;
END $$;

-- Add vehicle_plate column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'vehicle_plate'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN vehicle_plate TEXT;
  END IF;
END $$;

-- Grant proper permissions
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_guidelines ON profiles(vendor_guidelines_accepted);
CREATE INDEX IF NOT EXISTS idx_profiles_verified ON profiles(is_verified);

-- Output success message
SELECT '✅ All missing columns added successfully!' AS status;
