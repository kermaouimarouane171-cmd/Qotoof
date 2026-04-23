-- ============================================
-- STORAGE BUCKETS SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('return-images', 'return-images', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('profile-photos', 'profile-photos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('store-logos', 'store-logos', true, 1048576, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('chat-attachments', 'chat-attachments', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PRODUCT IMAGES POLICIES
-- ============================================

-- Public read access
CREATE POLICY "Product images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
);

-- Users can update their own images
CREATE POLICY "Users can update their own product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
);

-- Users can delete their own images
CREATE POLICY "Users can delete their own product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
);

-- ============================================
-- RETURN IMAGES POLICIES
-- ============================================

-- Users can upload return images
CREATE POLICY "Users can upload return images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'return-images' 
  AND auth.uid() IS NOT NULL
);

-- Users can view their own return images
CREATE POLICY "Users can view their own return images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'return-images' 
  AND auth.uid() IS NOT NULL
);

-- Admins can view all return images
CREATE POLICY "Admins can view all return images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'return-images' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- ============================================
-- PROFILE PHOTOS POLICIES
-- ============================================

-- Public read access
CREATE POLICY "Profile photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');

-- Users can upload their own photo
CREATE POLICY "Users can upload their own profile photo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-photos' 
  AND auth.uid() IS NOT NULL
);

-- Users can update their own photo
CREATE POLICY "Users can update their own profile photo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-photos' 
  AND auth.uid() IS NOT NULL
);

-- Users can delete their own photo
CREATE POLICY "Users can delete their own profile photo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-photos' 
  AND auth.uid() IS NOT NULL
);

-- ============================================
-- STORE LOGOS POLICIES
-- ============================================

-- Public read access
CREATE POLICY "Store logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-logos');

-- Vendors can upload their logo
CREATE POLICY "Vendors can upload store logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'store-logos' 
  AND auth.uid() IS NOT NULL
);

-- Vendors can update their own logo
CREATE POLICY "Vendors can update their own store logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'store-logos' 
  AND auth.uid() IS NOT NULL
);

-- ============================================
-- CHAT ATTACHMENTS POLICIES
-- ============================================

-- Users can upload chat attachments
CREATE POLICY "Users can upload chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-attachments' 
  AND auth.uid() IS NOT NULL
);

-- Users can view their chat attachments
CREATE POLICY "Users can view their chat attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-attachments' 
  AND auth.uid() IS NOT NULL
);

-- ============================================
-- VERIFICATION QUERY
-- ============================================

-- Check if buckets were created successfully
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
ORDER BY name;
