-- ============================================
-- QOTOOF - Complete Fresh Database Setup
-- ============================================
-- Run this ONCE in Supabase SQL Editor
-- This creates ALL tables, policies, functions, and storage buckets

-- ============================================
-- 1. ENABLE EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. CREATE ENUMS
-- ============================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('buyer', 'vendor', 'admin', 'driver');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE product_category AS ENUM ('plants', 'vegetables', 'fruits', 'herbs', 'seeds');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending', 'vendor_accepted', 'vendor_rejected',
    'driver_assigned', 'driver_accepted', 'driver_picked_up',
    'on_the_way', 'delivered', 'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE vendor_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM (
    'unassigned', 'assigned', 'accepted', 'picked_up',
    'on_the_way', 'delivered', 'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_type AS ENUM ('motorcycle', 'car', 'van', 'truck');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 3. CREATE CORE TABLES
-- ============================================

-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'buyer',
  store_name TEXT,
  store_description TEXT,
  store_image_url TEXT,
  is_approved BOOLEAN DEFAULT false,
  vendor_status vendor_status DEFAULT 'pending',
  vehicle_type vehicle_type,
  vehicle_plate TEXT,
  is_available_for_delivery BOOLEAN DEFAULT false,
  driver_rating DECIMAL(3, 2) DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Morocco',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  vendor_guidelines_accepted BOOLEAN DEFAULT FALSE,
  vendor_guidelines_accepted_at TIMESTAMPTZ,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status TEXT DEFAULT 'pending',
  last_seen_at TIMESTAMPTZ,
  cin_number TEXT,
  cin_verified BOOLEAN DEFAULT FALSE,
  rating DECIMAL(3,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- STORES TABLE
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Morocco',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT true,
  min_order_value DECIMAL(10, 2) DEFAULT 0,
  delivery_radius_km DECIMAL(5, 2) DEFAULT 50,
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category product_category NOT NULL,
  subcategory TEXT,
  price_per_unit DECIMAL(10, 2) NOT NULL,
  unit_type TEXT NOT NULL DEFAULT 'kg',
  min_order_quantity DECIMAL(10, 2) DEFAULT 1,
  available_quantity DECIMAL(10, 2) NOT NULL,
  is_available BOOLEAN DEFAULT true,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  images_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRODUCT IMAGES TABLE
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  vendor_id UUID NOT NULL REFERENCES profiles(id),
  store_id UUID REFERENCES stores(id),
  status order_status DEFAULT 'pending',
  subtotal DECIMAL(10, 2) NOT NULL,
  shipping_cost DECIMAL(10, 2) DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  shipping_address TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_country TEXT DEFAULT 'Morocco',
  shipping_latitude DECIMAL(10, 8),
  shipping_longitude DECIMAL(11, 8),
  buyer_notes TEXT,
  vendor_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

-- ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DELIVERIES TABLE
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_number TEXT UNIQUE NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES profiles(id),
  status delivery_status DEFAULT 'unassigned',
  pickup_address TEXT,
  pickup_latitude DECIMAL(10, 8),
  pickup_longitude DECIMAL(11, 8),
  delivery_address TEXT,
  delivery_latitude DECIMAL(10, 8),
  delivery_longitude DECIMAL(11, 8),
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  last_location_update TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  driver_notes TEXT,
  delivery_proof_url TEXT,
  signature_url TEXT
);

-- REVIEWS TABLE
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  order_id UUID REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DRIVER REVIEWS TABLE
CREATE TABLE IF NOT EXISTS driver_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  delivery_id UUID REFERENCES deliveries(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VENDOR DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS vendor_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. CREATE EXTENSION TABLES
-- ============================================

-- FAVORITES TABLE
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK ((product_id IS NOT NULL) OR (vendor_id IS NOT NULL))
);

-- MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT,
  message_type TEXT DEFAULT 'text',
  attachment_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL DEFAULT 'direct',
  title TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONVERSATION PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT false,
  UNIQUE(conversation_id, user_id)
);

-- DELIVERY ZONES TABLE
CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_name TEXT NOT NULL,
  zone_code TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
  price_per_km DECIMAL(10, 2) NOT NULL DEFAULT 2.50,
  max_distance_km DECIMAL(5, 2) NOT NULL DEFAULT 50.00,
  estimated_delivery_min INTEGER NOT NULL DEFAULT 30,
  estimated_delivery_max INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DRIVER PRICING TABLE
CREATE TABLE IF NOT EXISTS driver_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  base_price DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
  price_per_km DECIMAL(10, 2) NOT NULL DEFAULT 2.50,
  min_price DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
  max_price DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id)
);

-- DELIVERY TRACKING TABLE
CREATE TABLE IF NOT EXISTS delivery_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES profiles(id),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  speed_kmh DECIMAL(5, 2) DEFAULT 0,
  heading DECIMAL(5, 2),
  accuracy_meters INTEGER,
  battery_level INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TIER PRICING TABLE
CREATE TABLE IF NOT EXISTS tier_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  min_quantity DECIMAL(10, 2) NOT NULL,
  max_quantity DECIMAL(10, 2),
  price_per_unit DECIMAL(10, 2) NOT NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DRIVER LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  speed_kmh DECIMAL(5, 2) DEFAULT 0,
  heading DECIMAL(5, 2),
  accuracy_meters INTEGER,
  is_online BOOLEAN DEFAULT false,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id)
);

-- DELIVERY REQUESTS TABLE
CREATE TABLE IF NOT EXISTS delivery_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES profiles(id),
  pickup_address TEXT NOT NULL,
  pickup_latitude DECIMAL(10, 8),
  pickup_longitude DECIMAL(11, 8),
  delivery_address TEXT NOT NULL,
  delivery_latitude DECIMAL(10, 8),
  delivery_longitude DECIMAL(11, 8),
  estimated_distance_km DECIMAL(5, 2),
  estimated_price DECIMAL(10, 2),
  status TEXT DEFAULT 'pending',
  assigned_driver_id UUID REFERENCES profiles(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDER TIMELINE TABLE
CREATE TABLE IF NOT EXISTS order_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_description TEXT,
  performed_by UUID REFERENCES profiles(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VERIFICATION DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- USER REPORTS TABLE
CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  reported_user_id UUID NOT NULL REFERENCES profiles(id),
  report_type TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT DEFAULT 'pending',
  resolution_notes TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DELIVERY CHECKLIST TABLE
CREATE TABLE IF NOT EXISTS delivery_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  items_verified BOOLEAN DEFAULT false,
  buyer_confirmed_receipt BOOLEAN DEFAULT false,
  buyer_reported_issues BOOLEAN DEFAULT false,
  issues_description TEXT,
  photo_proof_url TEXT,
  signature_url TEXT,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(delivery_id)
);

-- PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADDRESSES TABLE
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT DEFAULT 'Morocco',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COUPONS TABLE
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10, 2) NOT NULL,
  min_order_amount DECIMAL(10, 2) DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RETURNS TABLE
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  vendor_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  refund_amount DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BANK ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  rib TEXT,
  iban TEXT,
  account_holder_name TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VENDOR SCHEDULES TABLE
CREATE TABLE IF NOT EXISTS vendor_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- STOCK HISTORY TABLE
CREATE TABLE IF NOT EXISTS stock_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_quantity DECIMAL(10, 2),
  new_quantity DECIMAL(10, 2),
  change_reason TEXT,
  changed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SECURITY TABLES
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  message TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blocked_ips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address TEXT UNIQUE NOT NULL,
  reason TEXT,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADDITIONAL TABLES (missing from original setup)
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  order_id UUID REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS return_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  vendor_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  refund_amount DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comparison_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  order_id UUID REFERENCES orders(id),
  discount_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_availability_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_availability_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_verification_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  amount DECIMAL(10, 2),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  level TEXT DEFAULT 'bronze',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  points_change INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity DECIMAL(10, 2) DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, store_id)
);

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, setting_key)
);

-- ============================================
-- 5. CREATE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_status ON profiles(vendor_status);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_available ON products(is_available);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price_per_unit);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_reviews_buyer ON reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_city ON delivery_zones(city);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_code ON delivery_zones(zone_code);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_driver_pricing_driver ON driver_pricing(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_delivery ON delivery_tracking(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_driver ON delivery_tracking(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_timestamp ON delivery_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_tier_pricing_product ON tier_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_tier_pricing_vendor ON tier_pricing(vendor_id);
CREATE INDEX IF NOT EXISTS idx_tier_pricing_active ON tier_pricing(is_active);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_online ON driver_locations(is_online);
CREATE INDEX IF NOT EXISTS idx_driver_locations_location ON driver_locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_order ON delivery_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_vendor ON delivery_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_driver ON delivery_requests(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON delivery_requests(status);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_created ON delivery_requests(requested_at);
CREATE INDEX IF NOT EXISTS idx_order_timeline_order ON order_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_order_timeline_event ON order_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_order_timeline_created ON order_timeline(created_at);
CREATE INDEX IF NOT EXISTS idx_verification_documents_user ON verification_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_documents_type ON verification_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_verification_documents_status ON verification_documents(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_created ON user_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_delivery_checklist_delivery ON delivery_checklist(delivery_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_vendor ON coupons(vendor_id);
CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_buyer ON returns(buyer_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_vendor ON bank_accounts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);

-- ============================================
-- 6. CREATE FUNCTIONS
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
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')::user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate distance (Haversine)
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DECIMAL, lon1 DECIMAL,
  lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  earth_radius DECIMAL := 6371;
  dlat DECIMAL;
  dlon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2) * sin(dlat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql;

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(TO_CHAR(NEXTVAL('order_seq'), 'FM99999'), 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate delivery number
CREATE OR REPLACE FUNCTION generate_delivery_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.delivery_number := 'DEL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(TO_CHAR(NEXTVAL('delivery_seq'), 'FM99999'), 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. CREATE SEQUENCES
-- ============================================
CREATE SEQUENCE IF NOT EXISTS order_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS delivery_seq START WITH 1;

-- ============================================
-- 8. CREATE TRIGGERS
-- ============================================

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deliveries_updated_at ON deliveries;
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_zones_updated_at ON delivery_zones;
CREATE TRIGGER update_delivery_zones_updated_at BEFORE UPDATE ON delivery_zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_driver_pricing_updated_at ON driver_pricing;
CREATE TRIGGER update_driver_pricing_updated_at BEFORE UPDATE ON driver_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tier_pricing_updated_at ON tier_pricing;
CREATE TRIGGER update_tier_pricing_updated_at BEFORE UPDATE ON tier_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_driver_locations_updated_at ON driver_locations;
CREATE TRIGGER update_driver_locations_updated_at BEFORE UPDATE ON driver_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_requests_updated_at ON delivery_requests;
CREATE TRIGGER update_delivery_requests_updated_at BEFORE UPDATE ON delivery_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_verification_documents_updated_at ON verification_documents;
CREATE TRIGGER update_verification_documents_updated_at BEFORE UPDATE ON verification_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_reports_updated_at ON user_reports;
CREATE TRIGGER update_user_reports_updated_at BEFORE UPDATE ON user_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_checklist_updated_at ON delivery_checklist;
CREATE TRIGGER update_delivery_checklist_updated_at BEFORE UPDATE ON delivery_checklist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Order number trigger
DROP TRIGGER IF EXISTS set_order_number ON orders;
CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- Delivery number trigger
DROP TRIGGER IF EXISTS set_delivery_number ON deliveries;
CREATE TRIGGER set_delivery_number
  BEFORE INSERT ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION generate_delivery_number();

-- ============================================
-- 9. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Additional tables RLS
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_availability_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_availability_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. CREATE RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Stores policies
CREATE POLICY "Stores are viewable by everyone" ON stores FOR SELECT USING (is_active = true OR owner_id = auth.uid());
CREATE POLICY "Vendors can manage own stores" ON stores FOR ALL TO authenticated USING (owner_id = auth.uid());

-- Products policies
CREATE POLICY "Products are viewable by everyone" ON products FOR SELECT USING (is_available = true OR vendor_id = auth.uid());
CREATE POLICY "Vendors can manage own products" ON products FOR ALL TO authenticated USING (vendor_id = auth.uid());

-- Product images policies
CREATE POLICY "Product images are viewable by everyone" ON product_images FOR SELECT USING (true);
CREATE POLICY "Vendors can manage own product images" ON product_images FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_images.product_id AND products.vendor_id = auth.uid()));

-- Orders policies
CREATE POLICY "Users can view own orders" ON orders FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR vendor_id = auth.uid());
CREATE POLICY "Buyers can create orders" ON orders FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "Vendors can update own orders" ON orders FOR UPDATE TO authenticated USING (vendor_id = auth.uid());

-- Order items policies
CREATE POLICY "Users can view own order items" ON order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid())));
CREATE POLICY "Buyers can create order items" ON order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.buyer_id = auth.uid()));

-- Deliveries policies
CREATE POLICY "Users can view own deliveries" ON deliveries FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = deliveries.order_id AND orders.buyer_id = auth.uid())
  OR EXISTS (SELECT 1 FROM orders WHERE orders.id = deliveries.order_id AND orders.vendor_id = auth.uid())
  OR driver_id = auth.uid()
);
CREATE POLICY "System can create deliveries" ON deliveries FOR INSERT WITH CHECK (true);
CREATE POLICY "Drivers can update assigned deliveries" ON deliveries FOR UPDATE TO authenticated USING (driver_id = auth.uid());

-- Reviews policies
CREATE POLICY "Reviews are publicly viewable" ON reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE TO authenticated USING (auth.uid() = buyer_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Notifications can be created for users" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Favorites policies
CREATE POLICY "Users can view own favorites" ON favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own favorites" ON favorites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Messages policies
CREATE POLICY "Users can view their own messages" ON messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()));
CREATE POLICY "Users can send messages" ON messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- Conversations policies
CREATE POLICY "Users can view conversations they participate in" ON conversations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()));
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- Conversation participants policies
CREATE POLICY "Users can view participants of their conversations" ON conversation_participants FOR SELECT TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM conversation_participants cp2 WHERE cp2.conversation_id = conversation_participants.conversation_id AND cp2.user_id = auth.uid()));
CREATE POLICY "Users can join conversations" ON conversation_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Delivery zones policies
CREATE POLICY "Delivery zones are viewable by everyone" ON delivery_zones FOR SELECT USING (is_active = true);

-- Driver pricing policies
CREATE POLICY "Driver pricing is viewable by everyone" ON driver_pricing FOR SELECT USING (true);
CREATE POLICY "Drivers can manage own pricing" ON driver_pricing FOR ALL TO authenticated USING (driver_id = auth.uid());

-- Delivery tracking policies
CREATE POLICY "Users can view tracking for their deliveries" ON delivery_tracking FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM deliveries d WHERE d.id = delivery_tracking.delivery_id AND (d.driver_id = auth.uid() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = d.order_id AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid())))));
CREATE POLICY "Drivers can insert their own tracking" ON delivery_tracking FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid());

-- Tier pricing policies
CREATE POLICY "Tier pricing is viewable by everyone" ON tier_pricing FOR SELECT USING (is_active = true);
CREATE POLICY "Vendors can manage own tier pricing" ON tier_pricing FOR ALL TO authenticated USING (vendor_id = auth.uid());

-- Driver locations policies
CREATE POLICY "Driver locations are viewable when online" ON driver_locations FOR SELECT USING (is_online = true);
CREATE POLICY "Drivers can update own location" ON driver_locations FOR ALL TO authenticated USING (driver_id = auth.uid());

-- Delivery requests policies
CREATE POLICY "Users can view their delivery requests" ON delivery_requests FOR SELECT TO authenticated USING (vendor_id = auth.uid() OR assigned_driver_id = auth.uid() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()));
CREATE POLICY "Vendors can create delivery requests" ON delivery_requests FOR INSERT TO authenticated WITH CHECK (vendor_id = auth.uid());
CREATE POLICY "Vendors can update their delivery requests" ON delivery_requests FOR UPDATE TO authenticated USING (vendor_id = auth.uid());

-- Order timeline policies
CREATE POLICY "Users can view timeline for their orders" ON order_timeline FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_timeline.order_id AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid())));

-- Verification documents policies
CREATE POLICY "Users can view own verification documents" ON verification_documents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can upload own documents" ON verification_documents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own documents" ON verification_documents FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- User reports policies
CREATE POLICY "Users can view own reports" ON user_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid());
CREATE POLICY "Users can create reports" ON user_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

-- Delivery checklist policies
CREATE POLICY "Users can view checklist for their deliveries" ON delivery_checklist FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM deliveries d WHERE d.id = delivery_checklist.delivery_id AND (d.driver_id = auth.uid() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = d.order_id AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid())))));
CREATE POLICY "Drivers can complete checklist" ON delivery_checklist FOR ALL TO authenticated USING (completed_by = auth.uid());

-- Payments policies
CREATE POLICY "Payments viewable by order participants" ON payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid())));
CREATE POLICY "Payments can be created with order" ON payments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.buyer_id = auth.uid()));

-- Addresses policies
CREATE POLICY "Users can view own addresses" ON addresses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own addresses" ON addresses FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Coupons policies
CREATE POLICY "Coupons viewable by everyone" ON coupons FOR SELECT USING (true);
CREATE POLICY "Vendors can manage own coupons" ON coupons FOR ALL TO authenticated USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);

-- Returns policies
CREATE POLICY "Returns viewable by participants" ON returns FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR vendor_id = auth.uid());
CREATE POLICY "Buyers can create return requests" ON returns FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Vendors can update return status" ON returns FOR UPDATE TO authenticated USING (vendor_id = auth.uid());

-- Bank accounts policies
CREATE POLICY "Users can view own bank accounts" ON bank_accounts FOR SELECT TO authenticated USING (vendor_id = auth.uid());
CREATE POLICY "Users can manage own bank accounts" ON bank_accounts FOR ALL TO authenticated USING (vendor_id = auth.uid());

-- Vendor schedules policies
CREATE POLICY "Vendor schedules are publicly viewable" ON vendor_schedules FOR SELECT USING (true);
CREATE POLICY "Vendors can manage own schedules" ON vendor_schedules FOR ALL TO authenticated USING (vendor_id = auth.uid());

-- Stock history policies
CREATE POLICY "Stock history viewable by vendor" ON stock_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM products WHERE products.id = stock_history.product_id AND products.vendor_id = auth.uid()));

-- Audit logs policies
CREATE POLICY "Admins can view audit logs" ON audit_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Security alerts policies
CREATE POLICY "Users can view own security alerts" ON security_alerts FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Rate limits policies
CREATE POLICY "Rate limits are viewable by system" ON rate_limits FOR SELECT USING (true);
CREATE POLICY "Rate limits can be created by system" ON rate_limits FOR INSERT WITH CHECK (true);

-- Additional tables policies
CREATE POLICY "Product reviews are publicly viewable" ON product_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create product reviews" ON product_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Users can update own product reviews" ON product_reviews FOR UPDATE TO authenticated USING (auth.uid() = buyer_id);

CREATE POLICY "Users can view own return requests" ON return_requests FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR vendor_id = auth.uid());
CREATE POLICY "Buyers can create return requests" ON return_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Vendors can update return status" ON return_requests FOR UPDATE TO authenticated USING (vendor_id = auth.uid());

CREATE POLICY "Users can view own support tickets" ON support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create support tickets" ON support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own support tickets" ON support_tickets FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can view own comparison lists" ON comparison_lists FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own comparison lists" ON comparison_lists FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Contact messages can be created by anyone" ON contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view contact messages" ON contact_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view own coupon redemptions" ON coupon_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Coupon redemptions can be created by buyers" ON coupon_redemptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Drivers can view own availability log" ON driver_availability_log FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "Drivers can insert own availability" ON driver_availability_log FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Drivers can view own availability requests" ON driver_availability_requests FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "Drivers can create availability requests" ON driver_availability_requests FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Drivers can view own verification documents" ON driver_verification_documents FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "Drivers can upload own documents" ON driver_verification_documents FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Admins can view financial audit logs" ON financial_audit_log FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view own loyalty points" ON loyalty_points FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own loyalty points" ON loyalty_points FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can view own loyalty transactions" ON loyalty_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can view platform settings" ON platform_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update platform settings" ON platform_settings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view settings audit log" ON settings_audit_log FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view own shopping lists" ON shopping_lists FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own shopping lists" ON shopping_lists FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own shopping list items" ON shopping_list_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM shopping_lists WHERE shopping_lists.id = shopping_list_items.shopping_list_id AND shopping_lists.user_id = auth.uid()));
CREATE POLICY "Users can manage own shopping list items" ON shopping_list_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM shopping_lists WHERE shopping_lists.id = shopping_list_items.shopping_list_id AND shopping_lists.user_id = auth.uid()));

CREATE POLICY "Users can view own store follows" ON store_follows FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own store follows" ON store_follows FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================
-- 11. CREATE STORAGE BUCKETS
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-images', 'product-images', true),
  ('return-images', 'return-images', true),
  ('profile-photos', 'profile-photos', true),
  ('store-logos', 'store-logos', true),
  ('chat-attachments', 'chat-attachments', false),
  ('avatars', 'avatars', true),
  ('documents', 'documents', false),
  ('delivery-proofs', 'delivery-proofs', true),
  ('signatures', 'signatures', true),
  ('vehicle-photos', 'vehicle-photos', true),
  ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies - Drop existing first to avoid conflicts
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own product images" ON storage.objects;
DROP POLICY IF EXISTS "Profile photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Store logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can upload their store logo" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can update their store logo" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Delivery proofs are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can upload delivery proofs" ON storage.objects;
DROP POLICY IF EXISTS "Signatures are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can upload signatures" ON storage.objects;
DROP POLICY IF EXISTS "Vehicle photos are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can upload vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat attachments in their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own verification documents" ON storage.objects;

CREATE POLICY "Product images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Authenticated users can upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND auth.uid() = owner);
CREATE POLICY "Users can update their own product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND auth.uid() = owner);

CREATE POLICY "Profile photos are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');
CREATE POLICY "Users can upload their own profile photo" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-photos' AND auth.uid() = owner);
CREATE POLICY "Users can update their own profile photo" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profile-photos' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own profile photo" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'profile-photos' AND auth.uid() = owner);

CREATE POLICY "Store logos are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'store-logos');
CREATE POLICY "Vendors can upload their store logo" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'store-logos' AND auth.uid() = owner);
CREATE POLICY "Vendors can update their store logo" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'store-logos' AND auth.uid() = owner);

CREATE POLICY "Avatars are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND auth.uid() = owner);

CREATE POLICY "Delivery proofs are publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'delivery-proofs');
CREATE POLICY "Drivers can upload delivery proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'delivery-proofs');

CREATE POLICY "Signatures are publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'signatures');
CREATE POLICY "Drivers can upload signatures" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Vehicle photos are publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'vehicle-photos');
CREATE POLICY "Drivers can upload vehicle photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vehicle-photos');

CREATE POLICY "Users can upload chat attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');
CREATE POLICY "Users can view chat attachments in their conversations" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can upload verification documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'verification-docs');
CREATE POLICY "Users can view own verification documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'verification-docs' AND auth.uid() = owner);

-- ============================================
-- 12. INSERT DEFAULT DATA
-- ============================================

-- Default delivery zones for Moroccan cities
INSERT INTO delivery_zones (zone_name, zone_code, city, base_price, price_per_km, max_distance_km, estimated_delivery_min, estimated_delivery_max) VALUES
  ('Casablanca Centre', 'CASA-Centre', 'Casablanca', 15.00, 2.50, 20.00, 30, 45),
  ('Casablanca Peripherie', 'CASA-Peripherie', 'Casablanca', 20.00, 3.00, 40.00, 45, 60),
  ('Rabat Centre', 'RABAT-Centre', 'Rabat', 15.00, 2.50, 15.00, 30, 45),
  ('Marrakech Centre', 'MARR-Centre', 'Marrakech', 15.00, 2.50, 15.00, 30, 45),
  ('Fes Centre', 'FES-Centre', 'Fes', 15.00, 2.50, 15.00, 30, 45),
  ('Tangier Centre', 'TANG-Centre', 'Tangier', 15.00, 2.50, 15.00, 30, 45),
  ('Agadir Centre', 'AGAD-Centre', 'Agadir', 15.00, 2.50, 15.00, 30, 45),
  ('Inter-City', 'INTER-City', 'All Cities', 35.00, 5.00, 200.00, 120, 240)
ON CONFLICT (zone_code) DO NOTHING;

-- ============================================
-- 13. ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================
-- 14. VERIFICATION QUERIES
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

-- ============================================
-- MIGRATION COMPLETE!
-- ============================================
-- Database is ready to use.
-- Test user signup and start using the app!
