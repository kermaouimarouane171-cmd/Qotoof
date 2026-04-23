-- =====================================================
-- Fix RLS Policies - Complete Reset
-- Run this in Supabase SQL Editor
-- =====================================================

-- Drop ALL existing policies on profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;

-- Drop ALL existing policies on stores
DROP POLICY IF EXISTS "Stores are viewable by everyone" ON stores;
DROP POLICY IF EXISTS "Vendors can manage own stores" ON stores;

-- Drop ALL existing policies on products
DROP POLICY IF EXISTS "Products are viewable by everyone" ON products;
DROP POLICY IF EXISTS "Vendors can manage own products" ON products;

-- Drop ALL existing policies on orders
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Buyers can create orders" ON orders;
DROP POLICY IF EXISTS "Vendors can update own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;

-- Drop ALL existing policies on deliveries
DROP POLICY IF EXISTS "Users can view own deliveries" ON deliveries;
DROP POLICY IF EXISTS "Vendors can assign drivers" ON deliveries;
DROP POLICY IF EXISTS "Drivers can update assigned deliveries" ON deliveries;
DROP POLICY IF EXISTS "System can create deliveries" ON deliveries;
DROP POLICY IF EXISTS "Anyone can create deliveries" ON deliveries;

-- Drop ALL existing policies on reviews
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON reviews;
DROP POLICY IF EXISTS "Buyers can create reviews" ON reviews;

-- Drop ALL existing policies on notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- Drop ALL existing policies on product_images
DROP POLICY IF EXISTS "Product images are viewable by everyone" ON product_images;
DROP POLICY IF EXISTS "Vendors can manage own product images" ON product_images;

-- Drop ALL existing policies on order_items
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
DROP POLICY IF EXISTS "Buyers can create order items" ON order_items;

-- =====================================================
-- Create NEW simplified policies
-- =====================================================

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Stores
CREATE POLICY "stores_select" ON stores FOR SELECT USING (true);
CREATE POLICY "stores_all" ON stores FOR ALL USING (owner_id = auth.uid());

-- Products
CREATE POLICY "products_select" ON products FOR SELECT USING (true);
CREATE POLICY "products_all" ON products FOR ALL USING (vendor_id = auth.uid());

-- Product Images
CREATE POLICY "product_images_select" ON product_images FOR SELECT USING (true);
CREATE POLICY "product_images_all" ON product_images FOR ALL USING (
  EXISTS (SELECT 1 FROM products WHERE products.id = product_images.product_id AND products.vendor_id = auth.uid())
);

-- Orders
CREATE POLICY "orders_select" ON orders FOR SELECT USING (
  buyer_id = auth.uid() OR vendor_id = auth.uid()
);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (vendor_id = auth.uid());

-- Order Items
CREATE POLICY "order_items_select" ON order_items FOR SELECT USING (true);
CREATE POLICY "order_items_insert" ON order_items FOR INSERT WITH CHECK (true);

-- Deliveries
CREATE POLICY "deliveries_select" ON deliveries FOR SELECT USING (true);
CREATE POLICY "deliveries_insert" ON deliveries FOR INSERT WITH CHECK (true);
CREATE POLICY "deliveries_update" ON deliveries FOR UPDATE USING (
  driver_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM orders WHERE orders.id = deliveries.order_id AND orders.vendor_id = auth.uid())
);

-- Reviews
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Notifications
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (user_id = auth.uid());
