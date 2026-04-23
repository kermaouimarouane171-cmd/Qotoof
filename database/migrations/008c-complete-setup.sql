-- ============================================
-- QOTOOF - Complete Database Migration Script
-- ============================================
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- This script creates all missing columns, tables, and configurations

-- ============================================
-- 1. PROFILES TABLE - Add Missing Columns
-- ============================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS vendor_guidelines_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vendor_guidelines_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_available_for_delivery BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'van',
ADD COLUMN IF NOT EXISTS vehicle_plate TEXT,
ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS store_name TEXT,
ADD COLUMN IF NOT EXISTS store_description TEXT,
ADD COLUMN IF NOT EXISTS cin_number TEXT,
ADD COLUMN IF NOT EXISTS cin_verified BOOLEAN DEFAULT FALSE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_guidelines ON profiles(vendor_guidelines_accepted);
CREATE INDEX IF NOT EXISTS idx_profiles_verified ON profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_profiles_available_delivery ON profiles(is_available_for_delivery);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(latitude, longitude);

-- ============================================
-- 2. STORAGE BUCKETS - Create if not exists
-- ============================================

-- Enable storage
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('product-images', 'product-images', true),
  ('return-images', 'return-images', true),
  ('profile-photos', 'profile-photos', true),
  ('store-logos', 'store-logos', true),
  ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product-images
CREATE POLICY "Product images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND auth.uid() = owner);

CREATE POLICY "Users can update their own product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' AND auth.uid() = owner);

CREATE POLICY "Users can delete their own product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND auth.uid() = owner);

-- Storage policies for profile-photos
CREATE POLICY "Profile photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload their own profile photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-photos' AND auth.uid() = owner);

CREATE POLICY "Users can update their own profile photo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-photos' AND auth.uid() = owner);

CREATE POLICY "Users can delete their own profile photo"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-photos' AND auth.uid() = owner);

-- Storage policies for store-logos
CREATE POLICY "Store logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-logos');

CREATE POLICY "Vendors can upload their store logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'store-logos' AND auth.uid() = owner);

CREATE POLICY "Vendors can update their store logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'store-logos' AND auth.uid() = owner);

-- Storage policies for return-images
CREATE POLICY "Return images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'return-images');

CREATE POLICY "Authenticated users can upload return images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'return-images' AND auth.uid() = owner);

-- Storage policies for chat-attachments (private)
CREATE POLICY "Users can view chat attachments they have access to"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid() = owner);

CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() = owner);

-- ============================================
-- 3. ROW LEVEL SECURITY (RLS) - Enable & Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Public profiles are viewable by everyone"
ON profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Products RLS policies
CREATE POLICY "Products are viewable by everyone"
ON products FOR SELECT
USING (is_available = true OR auth.uid() = vendor_id);

CREATE POLICY "Vendors can insert own products"
ON products FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update own products"
ON products FOR UPDATE
TO authenticated
USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete own products"
ON products FOR DELETE
TO authenticated
USING (auth.uid() = vendor_id);

-- Orders RLS policies
CREATE POLICY "Users can view own orders"
ON orders FOR SELECT
TO authenticated
USING (buyer_id = auth.uid() OR vendor_id = auth.uid() OR driver_id = auth.uid());

CREATE POLICY "Buyers can create orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Vendors can update orders they receive"
ON orders FOR UPDATE
TO authenticated
USING (vendor_id = auth.uid());

CREATE POLICY "Drivers can update assigned deliveries"
ON orders FOR UPDATE
TO authenticated
USING (driver_id = auth.uid());

-- Order items RLS policies
CREATE POLICY "Order items viewable by order participants"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid() OR orders.driver_id = auth.uid())
  )
);

CREATE POLICY "Order items can be inserted with order"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.buyer_id = auth.uid()
  )
);

-- Payments RLS policies
CREATE POLICY "Payments viewable by order participants"
ON payments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = payments.order_id 
    AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid())
  )
);

CREATE POLICY "Payments can be created with order"
ON payments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = payments.order_id 
    AND orders.buyer_id = auth.uid()
  )
);

-- Reviews RLS policies
CREATE POLICY "Reviews are publicly viewable"
ON reviews FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create reviews"
ON reviews FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Users can update own reviews"
ON reviews FOR UPDATE
TO authenticated
USING (auth.uid() = buyer_id);

-- Messages RLS policies
CREATE POLICY "Users can view their own messages"
ON messages FOR SELECT
TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- Deliveries RLS policies
CREATE POLICY "Deliveries viewable by participants"
ON deliveries FOR SELECT
TO authenticated
USING (
  buyer_id = auth.uid() OR 
  vendor_id = auth.uid() OR 
  driver_id = auth.uid()
);

CREATE POLICY "Deliveries can be created by system or vendor"
ON deliveries FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = vendor_id OR 
  auth.uid() = buyer_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Drivers can update delivery status"
ON deliveries FOR UPDATE
TO authenticated
USING (driver_id = auth.uid());

-- Returns RLS policies
CREATE POLICY "Returns viewable by participants"
ON returns FOR SELECT
TO authenticated
USING (
  buyer_id = auth.uid() OR 
  vendor_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Buyers can create return requests"
ON returns FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Vendors can update return status"
ON returns FOR UPDATE
TO authenticated
USING (vendor_id = auth.uid());

-- Coupons RLS policies
CREATE POLICY "Coupons viewable by everyone"
ON coupons FOR SELECT
USING (true);

CREATE POLICY "Vendors can manage own coupons"
ON coupons FOR ALL
TO authenticated
USING (auth.uid() = vendor_id)
WITH CHECK (auth.uid() = vendor_id);

-- Favorites RLS policies
CREATE POLICY "Users can view own favorites"
ON favorites FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own favorites"
ON favorites FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Addresses RLS policies
CREATE POLICY "Users can view own addresses"
ON addresses FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own addresses"
ON addresses FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Notifications RLS policies
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Notifications can be created for users"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- 4. FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup (if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 5. REALTIME - Enable for required tables
-- ============================================

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================
-- 6. VERIFICATION & TESTING
-- ============================================

-- Verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verify storage buckets
SELECT id, name, public 
FROM storage.buckets 
ORDER BY id;

-- Verify indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- After running this script:
-- 1. Check the output for any errors
-- 2. Verify all tables, policies, and buckets exist
-- 3. Test user signup and login
-- 4. Test product creation and viewing
-- 5. Test order creation flow
-- 6. Deploy Edge Functions next
