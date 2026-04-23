-- ============================================
-- Add National ID (CIN) and Vehicle Photo to profiles table
-- ============================================
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add CIN columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS cin VARCHAR(8) UNIQUE,
ADD COLUMN IF NOT EXISTS cin_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cin_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cin_verified_by UUID REFERENCES profiles(id);

-- 2. Add vehicle photo column for drivers
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS vehicle_photo TEXT;

-- 3. Create index for faster CIN lookups
CREATE INDEX IF NOT EXISTS idx_profiles_cin ON profiles(cin) WHERE cin IS NOT NULL;

-- 4. Add check constraint for CIN format (2 letters + 6 digits)
ALTER TABLE profiles
ADD CONSTRAINT cin_format_check 
CHECK (cin IS NULL OR cin ~ '^[A-Z]{2}[0-9]{6}$');

-- 5. Create vehicle-photos storage bucket (run this in Supabase Dashboard > Storage)
-- Note: This is informational - you need to create the bucket manually
-- Bucket name: vehicle-photos
-- Public: true
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- 6. Add RLS policy for CIN (users can only see their own CIN)
DROP POLICY IF EXISTS "Users can view own CIN" ON profiles;
DROP POLICY IF EXISTS "Users can update own CIN" ON profiles;

CREATE POLICY "Users can view own CIN"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own CIN"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 7. Create function to mask CIN for display
CREATE OR REPLACE FUNCTION mask_cin(cin TEXT)
RETURNS TEXT AS $$
BEGIN
  IF cin IS NULL OR LENGTH(cin) < 8 THEN
    RETURN '********';
  END IF;
  RETURN SUBSTRING(cin, 1, 4) || '****';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create view for admin to see CIN verification status
CREATE OR REPLACE VIEW admin_cin_verification AS
SELECT 
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.role,
  p.cin,
  p.cin_verified,
  p.cin_verified_at,
  p.vehicle_photo,
  v.first_name AS verified_by_first_name,
  v.last_name AS verified_by_last_name,
  p.created_at
FROM profiles p
LEFT JOIN profiles v ON p.cin_verified_by = v.id
WHERE p.cin IS NOT NULL;

-- 9. Grant access to admin only
GRANT SELECT ON admin_cin_verification TO authenticated;

-- ============================================
-- STORAGE BUCKET SETUP (Manual):
-- ============================================
-- Go to Supabase Dashboard > Storage > Create Bucket
-- 
-- Bucket 1: vehicle-photos
-- - Public: YES
-- - File size limit: 5242880 bytes (5MB)
-- - Allowed MIME types: image/jpeg, image/png, image/webp
--
-- Bucket 2: product-images (if not exists)
-- - Public: YES
-- - File size limit: 10485760 bytes (10MB)
-- - Allowed MIME types: image/jpeg, image/png, image/webp
-- ============================================

-- ============================================
-- STORAGE POLICIES for vehicle-photos:
-- ============================================
-- Run these after creating the bucket:

-- Allow authenticated users to upload
CREATE POLICY "Users can upload vehicle photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow public read access
CREATE POLICY "Anyone can view vehicle photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'vehicle-photos');

-- Allow users to delete their own photos
CREATE POLICY "Users can delete own vehicle photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vehicle-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- NOTES:
-- ============================================
-- CIN Format: 2 letters + 6 digits (e.g., AB123456)
-- 
-- To verify a user's CIN (admin action):
-- UPDATE profiles 
-- SET cin_verified = TRUE, 
--     cin_verified_at = NOW(), 
--     cin_verified_by = '<admin_user_id>'
-- WHERE id = '<user_id>';
--
-- To reject a user's CIN:
-- UPDATE profiles 
-- SET cin_verified = FALSE,
--     cin_verified_at = NOW(),
--     cin_verified_by = '<admin_user_id>'
-- WHERE id = '<user_id>';
-- ============================================
