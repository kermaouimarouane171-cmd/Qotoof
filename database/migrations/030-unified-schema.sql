-- =============================================================================
-- Migration 030: Unified Schema — QOTOOF
-- Date: 2026-06-21
-- Purpose: Single, idempotent, canonical schema definition that consolidates:
--   • database/migrations/000-complete-fresh-setup.sql
--   • database/migrations/023b-fix-schema-conflicts.sql
--   • database/migrations/026-fix-all-schema-issues.sql
--   • database/migrations/20260519_fix_driver_schema.sql
--   • migrations/create_driver_tables.sql (deprecated)
--
-- Rules applied:
--   1. All tables are created with IF NOT EXISTS.
--   2. All conflicting columns are unified to a single canonical name.
--   3. Rogue `drivers` / `users` tables are migrated then dropped.
--   4. All foreign keys are named and point to canonical tables.
--   5. All ENUMs are created idempotently.
--   6. All operations are wrapped in a transaction.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 2. ENUMS (idempotent)
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('buyer', 'vendor', 'admin', 'driver');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE product_category AS ENUM ('plants', 'vegetables', 'fruits', 'herbs', 'seeds');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending', 'confirmed', 'payment_received', 'preparing',
    'vendor_accepted', 'vendor_rejected', 'awaiting_driver',
    'driver_assigned', 'driver_accepted', 'driver_picked_up',
    'shipped', 'on_the_way', 'delivered', 'cancelled', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE vendor_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM (
    'unassigned', 'assigned', 'accepted', 'picked_up',
    'on_the_way', 'delivered', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_type AS ENUM ('motorcycle', 'car', 'van', 'truck');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 3. CORE TABLES
-- =============================================================================

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

CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_number TEXT UNIQUE NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  order_id UUID REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  delivery_id UUID REFERENCES deliveries(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS vendor_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. EXTENSION TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK ((product_id IS NOT NULL) OR (vendor_id IS NOT NULL))
);

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

CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT false,
  UNIQUE(conversation_id, user_id)
);

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

-- Explicit named FK for messages.conversation_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'messages' AND constraint_name = 'fk_messages_conversation'
  ) THEN
    ALTER TABLE messages
      DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey,
      ADD CONSTRAINT fk_messages_conversation
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Canonicalize messages: remove deprecated column `message` if it exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'message'
  ) THEN
    ALTER TABLE messages DROP COLUMN message;
  END IF;
END $$;

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
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_tier_pricing_target CHECK (product_id IS NOT NULL OR vendor_id IS NOT NULL)
);

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
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_delivery_requests_status CHECK (
    status IN ('pending', 'assigned', 'accepted', 'picked_up', 'on_the_way', 'delivered', 'failed', 'cancelled')
  )
);

CREATE TABLE IF NOT EXISTS order_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_description TEXT,
  performed_by UUID REFERENCES profiles(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canonicalize order_timeline: drop deprecated `status` and `updated_by` columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_timeline' AND column_name = 'status'
  ) THEN
    ALTER TABLE order_timeline DROP COLUMN status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_timeline' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE order_timeline DROP COLUMN updated_by;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_timeline' AND column_name = 'description'
  ) THEN
    ALTER TABLE order_timeline DROP COLUMN description;
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT,
  gateway_transaction_id TEXT,
  payment_reference TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS vendor_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS stock_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_quantity DECIMAL(10, 2),
  new_quantity DECIMAL(10, 2),
  change_reason TEXT,
  changed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 5. SECURITY & AUDIT TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  device_fingerprint TEXT,
  session_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  changes JSONB,
  severity TEXT DEFAULT 'info',
  signature TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT audit_logs_severity_check CHECK (severity IN ('low', 'info', 'medium', 'high', 'critical'))
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, action)
);

-- =============================================================================
-- 6. ADDITIONAL PRODUCTIVITY TABLES
-- =============================================================================

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

CREATE TABLE IF NOT EXISTS driver_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  commission_rate NUMERIC(5, 2) DEFAULT 0,
  commission_amount NUMERIC(10, 2) DEFAULT 0,
  net_amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'held')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  UNIQUE(delivery_id)
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

-- =============================================================================
-- 6. ADDITIONAL NEEDED TABLES (cleaned up from scattered migrations)
-- =============================================================================

-- 6.1 E-COMMERCE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_snapshot NUMERIC(10, 2),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS checkout_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  payload_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB,
  order_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(buyer_id, idempotency_key)
);

-- 6.2 GEOGRAPHIC
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT,
  cities TEXT[] NOT NULL,
  center_lat FLOAT NOT NULL,
  center_lng FLOAT NOT NULL,
  radius_km FLOAT DEFAULT 100,
  neighboring_regions UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS city_distances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  distance_km FLOAT NOT NULL,
  estimated_hours FLOAT,
  highway BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_city, to_city)
);

INSERT INTO regions (name_ar, name_fr, name_en, cities, center_lat, center_lng, radius_km, neighboring_regions) VALUES
('طنجة-تطوان-الحسيمة', 'Tanger-Tétouan-Al Hoceïma', 'Tangier-Tetouan-Al Hoceima', ARRAY['طنجة', 'تطوان', 'الحسيمة', 'العرائش', 'الفنيدق', 'شفشاون'], 35.7595, -5.8340, 120, NULL),
('الشرق', 'Oriental', 'Oriental', ARRAY['وجدة', 'الناظور', 'بركان', 'تاوريرت', 'جرادة', 'فكيك'], 34.6814, -1.9086, 150, NULL),
('فاس-مكناس', 'Fès-Meknès', 'Fes-Meknes', ARRAY['فاس', 'مكناس', 'إفران', 'صفرو', 'تازة', 'الحاجب'], 34.0331, -5.0003, 130, NULL),
('الرباط-سلا-القنيطرة', 'Rabat-Salé-Kénitra', 'Rabat-Sale-Kenitra', ARRAY['الرباط', 'سلا', 'القنيطرة', 'تمارة', 'سيدي قاسم', 'سيدي سليمان'], 34.0209, -6.8416, 100, NULL),
('بني ملال-خنيفرة', 'Béni Mellal-Khénifra', 'Beni Mellal-Khenifra', ARRAY['بني ملال', 'خنيفرة', 'أزيلال', 'الفقيه بن صالح', 'خريبكة'], 32.3373, -6.3498, 120, NULL),
('الدار البيضاء-سطات', 'Casablanca-Settat', 'Casablanca-Settat', ARRAY['الدار البيضاء', 'سطات', 'المحمدية', 'الجديدة', 'برشيد', 'بن سليمان'], 33.5731, -7.5898, 100, NULL),
('مراكش-آسفي', 'Marrakech-Safi', 'Marrakech-Safi', ARRAY['مراكش', 'آسفي', 'قلعة السراغنة', 'شيشاوة', 'الصويرة', 'الحوز'], 31.6295, -7.9811, 130, NULL),
('درعة-تافيلالت', 'Drâa-Tafilalet', 'Draa-Tafilalet', ARRAY['الرشيدية', 'ورززات', 'زاكورة', 'تنغير', 'ميدلت'], 31.5085, -5.1256, 180, NULL),
('سوس-ماسة', 'Souss-Massa', 'Souss-Massa', ARRAY['أكادير', 'تيزنيت', 'إنزكان', 'تارودانت', 'شتوكة آيت باها'], 30.4278, -9.5981, 140, NULL),
('كلميم-واد نون', 'Guelmim-Oued Noun', 'Guelmim-Oued Noun', ARRAY['كلميم', 'طانطان', 'سيدي إفني', 'أسا الزاك'], 28.9833, -10.0567, 160, NULL),
('العيون-الساقية الحمراء', 'Laâyoune-Sakia El Hamra', 'Laayoune-Sakia El Hamra', ARRAY['العيون', 'بوجدور', 'طرفاية', 'السمارة'], 27.1253, -13.1625, 200, NULL),
('الداخلة-وادي الذهب', 'Dakhla-Oued Ed-Dahab', 'Dakhla-Oued Ed-Dahab', ARRAY['الداخلة', 'أوسرد'], 23.7151, -15.9520, 250, NULL)
ON CONFLICT DO NOTHING;

UPDATE regions SET neighboring_regions = ARRAY[
  (SELECT id FROM regions WHERE name_ar = 'الشرق'),
  (SELECT id FROM regions WHERE name_ar = 'فاس-مكناس'),
  (SELECT id FROM regions WHERE name_ar = 'الرباط-سلا-القنيطرة')
] WHERE name_ar = 'طنجة-تطوان-الحسيمة';

UPDATE regions SET neighboring_regions = ARRAY[
  (SELECT id FROM regions WHERE name_ar = 'طنجة-تطوان-الحسيمة'),
  (SELECT id FROM regions WHERE name_ar = 'فاس-مكناس')
] WHERE name_ar = 'الشرق';

UPDATE regions SET neighboring_regions = ARRAY[
  (SELECT id FROM regions WHERE name_ar = 'طنجة-تطوان-الحسيمة'),
  (SELECT id FROM regions WHERE name_ar = 'الشرق'),
  (SELECT id FROM regions WHERE name_ar = 'الرباط-سلا-القنيطرة'),
  (SELECT id FROM regions WHERE name_ar = 'بني ملال-خنيفرة')
] WHERE name_ar = 'فاس-مكناس';

UPDATE regions SET neighboring_regions = ARRAY[
  (SELECT id FROM regions WHERE name_ar = 'طنجة-تطوان-الحسيمة'),
  (SELECT id FROM regions WHERE name_ar = 'فاس-مكناس'),
  (SELECT id FROM regions WHERE name_ar = 'الدار البيضاء-سطات')
] WHERE name_ar = 'الرباط-سلا-القنيطرة';

UPDATE regions SET neighboring_regions = ARRAY[
  (SELECT id FROM regions WHERE name_ar = 'فاس-مكناس'),
  (SELECT id FROM regions WHERE name_ar = 'الرباط-سلا-القنيطرة'),
  (SELECT id FROM regions WHERE name_ar = 'الدار البيضاء-سطات'),
  (SELECT id FROM regions WHERE name_ar = 'مراكش-آسفي')
] WHERE name_ar = 'بني ملال-خنيفرة';

UPDATE regions SET neighboring_regions = ARRAY[
  (SELECT id FROM regions WHERE name_ar = 'الرباط-سلا-القنيطرة'),
  (SELECT id FROM regions WHERE name_ar = 'بني ملال-خنيفرة'),
  (SELECT id FROM regions WHERE name_ar = 'مراكش-آسفي')
] WHERE name_ar = 'الدار البيضاء-سطات';

UPDATE regions SET neighboring_regions = ARRAY[
  (SELECT id FROM regions WHERE name_ar = 'بني ملال-خنيفرة'),
  (SELECT id FROM regions WHERE name_ar = 'الدار البيضاء-سطات'),
  (SELECT id FROM regions WHERE name_ar = 'درعة-تافيلالت'),
  (SELECT id FROM regions WHERE name_ar = 'سوس-ماسة')
] WHERE name_ar = 'مراكش-آسفي';

UPDATE regions SET neighboring_regions = ARRAY[
  (SELECT id FROM regions WHERE name_ar = 'فاس-مكناس'),
  (SELECT id FROM regions WHERE name_ar = 'مراكش-آسفي'),
  (SELECT id FROM regions WHERE name_ar = 'سوس-ماسة')
] WHERE name_ar = 'درعة-تافيلالت';

UPDATE regions SET neighboring_regions = ARRAY[
  (SELECT id FROM regions WHERE name_ar = 'مراكش-آسفي'),
  (SELECT id FROM regions WHERE name_ar = 'درعة-تافيلالت'),
  (SELECT id FROM regions WHERE name_ar = 'كلميم-واد نون')
] WHERE name_ar = 'سوس-ماسة';

UPDATE regions SET neighboring_regions = ARRAY[
  (SELECT id FROM regions WHERE name_ar = 'سوس-ماسة')
] WHERE name_ar = 'كلميم-واد نون';

-- 6.3 VENDOR ENHANCEMENT
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vendor_cancellation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  allow_cancellation BOOLEAN NOT NULL DEFAULT TRUE,
  free_cancellation_window_minutes INTEGER NOT NULL DEFAULT 120,
  cutoff_status TEXT NOT NULL DEFAULT 'vendor_accepted',
  cancellation_fee_type TEXT NOT NULL DEFAULT 'fixed' CHECK (cancellation_fee_type IN ('none', 'fixed', 'percentage')),
  cancellation_fee_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  refund_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100 CHECK (refund_percentage >= 0 AND refund_percentage <= 100),
  auto_approve_before_preparing BOOLEAN NOT NULL DEFAULT TRUE,
  policy_text_ar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_delivery_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  slot_label TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  cutoff_hours INTEGER NOT NULL DEFAULT 2,
  max_orders INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, day_of_week, start_time, end_time),
  CONSTRAINT chk_vendor_delivery_slot_window CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS vendor_wait_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected')),
  waiting_period_days INTEGER NOT NULL,
  vendor_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  cin TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  bank_iban TEXT NOT NULL,
  bank_account_holder TEXT NOT NULL,
  agreed_commission_rate DECIMAL(5,4) DEFAULT 0.03,
  agreed_payment_deadline INTEGER DEFAULT 7,
  agreed_account_freeze BOOLEAN DEFAULT TRUE,
  agreed_debt_survives_deletion BOOLEAN DEFAULT TRUE,
  ip_address TEXT,
  device_fingerprint TEXT,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  contract_version VARCHAR DEFAULT 'v1.0',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.4 PRODUCT ENHANCEMENT
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_waitlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
  note TEXT,
  notify_in_app BOOLEAN NOT NULL DEFAULT TRUE,
  notify_sms BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'notified', 'fulfilled', 'cancelled')),
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

-- 6.5 USER ENHANCEMENT
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  order_updates BOOLEAN NOT NULL DEFAULT TRUE,
  payment_updates BOOLEAN NOT NULL DEFAULT TRUE,
  promotional_updates BOOLEAN NOT NULL DEFAULT TRUE,
  review_updates BOOLEAN NOT NULL DEFAULT TRUE,
  loyalty_updates BOOLEAN NOT NULL DEFAULT TRUE,
  inventory_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  delivery_updates BOOLEAN NOT NULL DEFAULT TRUE,
  system_updates BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.6 LOYALTY
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('points_discount', 'free_shipping', 'coupon')),
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  reward_value NUMERIC(12, 2),
  coupon_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.7 REFERRALS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 100,
  reward_status TEXT NOT NULL DEFAULT 'pending' CHECK (reward_status IN ('pending', 'earned', 'cancelled')),
  first_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  first_order_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referrer_id, referred_user_id)
);

-- 6.8 FINANCIAL
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL DEFAULT 'MAD',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  shipping_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fees_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'paid', 'cancelled')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pdf_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  provider_key TEXT,
  paypal_email TEXT,
  stripe_account_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, payment_method_id)
);

CREATE TABLE IF NOT EXISTS platform_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES profiles(id),
  vendor_id UUID REFERENCES profiles(id),
  driver_id UUID REFERENCES profiles(id),
  subtotal NUMERIC(10, 2) NOT NULL,
  buyer_commission NUMERIC(10, 2) DEFAULT 0,
  buyer_commission_rate NUMERIC(5, 2) DEFAULT 2.00,
  vendor_commission NUMERIC(10, 2) DEFAULT 0,
  vendor_commission_rate NUMERIC(5, 2) DEFAULT 2.00,
  vendor_amount NUMERIC(10, 2),
  driver_commission NUMERIC(10, 2) DEFAULT 0,
  driver_commission_rate NUMERIC(5, 2) DEFAULT 2.00,
  driver_amount NUMERIC(10, 2),
  total_platform_revenue NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_monthly_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_sales DECIMAL(12,2) DEFAULT 0,
  commission_rate DECIMAL(5,4) DEFAULT 0.03,
  commission_due DECIMAL(12,2) DEFAULT 0,
  commission_paid DECIMAL(12,2) DEFAULT 0,
  status VARCHAR DEFAULT 'active',
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_method VARCHAR,
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, month, year)
);

CREATE TABLE IF NOT EXISTS confirmed_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  vendor_id UUID REFERENCES profiles(id),
  buyer_id UUID REFERENCES profiles(id),
  sale_amount DECIMAL(12,2) NOT NULL,
  commission_amount DECIMAL(12,2),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  monthly_sale_id UUID REFERENCES vendor_monthly_sales(id)
);

CREATE TABLE IF NOT EXISTS commission_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES profiles(id),
  monthly_sale_id UUID REFERENCES vendor_monthly_sales(id),
  type VARCHAR NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cancellation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  cancelled_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  requested_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  vendor_id UUID REFERENCES profiles(id),
  buyer_id UUID REFERENCES profiles(id),
  dispute_type VARCHAR NOT NULL,
  description TEXT NOT NULL,
  evidence_urls TEXT[],
  status VARCHAR DEFAULT 'open',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution TEXT,
  buyer_data_released BOOLEAN DEFAULT FALSE,
  legal_action_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT payment_disputes_status_check CHECK (status IN ('open', 'under_review', 'resolved_vendor', 'resolved_buyer', 'closed')),
  CONSTRAINT payment_disputes_type_check CHECK (dispute_type IN ('not_paid', 'not_delivered', 'wrong_amount'))
);

CREATE TABLE IF NOT EXISTS payment_terms_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  order_id UUID REFERENCES orders(id),
  payment_type VARCHAR NOT NULL,
  terms_version VARCHAR DEFAULT 'v1.0',
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  warning_shown BOOLEAN DEFAULT TRUE
);

-- 6.9 DELIVERY ENHANCEMENT
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS driver_broadcast_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type VARCHAR NOT NULL DEFAULT 'heartbeat',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy_meters DOUBLE PRECISION,
  speed_kmh DOUBLE PRECISION,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 7. ROGUE SCHEMA CLEANUP (drivers, users, driver_ratings, available_deliveries)
-- =============================================================================

-- 1. Canonicalize deliveries.driver_id FK
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints
  WHERE table_name = 'deliveries'
    AND constraint_type = 'FOREIGN KEY'
    AND EXISTS (
      SELECT 1 FROM information_schema.key_column_usage
      WHERE table_name = 'deliveries'
        AND constraint_name = table_constraints.constraint_name
        AND column_name = 'driver_id'
    );

  IF v_constraint_name IS NOT NULL AND v_constraint_name != 'fk_deliveries_driver' THEN
    EXECUTE format('ALTER TABLE deliveries RENAME CONSTRAINT %I TO %I', v_constraint_name, 'fk_deliveries_driver');
  ELSIF v_constraint_name IS NULL THEN
    ALTER TABLE deliveries
      ADD CONSTRAINT fk_deliveries_driver
        FOREIGN KEY (driver_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Migrate any rogue `drivers` rows into profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'drivers'
  ) THEN
    UPDATE profiles p
    SET
      role = 'driver',
      vehicle_plate = d.license_number,
      is_available_for_delivery = (d.status = 'active'),
      driver_rating = d.rating,
      total_deliveries = d.total_deliveries,
      updated_at = NOW()
    FROM drivers d
    WHERE p.id = d.user_id
      AND p.role != 'driver';

    RAISE NOTICE 'Migrated driver rows into profiles';
  END IF;
END $$;

-- 3. Drop rogue drivers table if empty
DO $$
DECLARE v_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'drivers') THEN
    SELECT COUNT(*) INTO v_count FROM drivers;
    IF v_count = 0 THEN
      DROP TABLE drivers CASCADE;
      RAISE NOTICE 'Dropped empty rogue drivers table';
    ELSE
      RAISE WARNING 'Rogue drivers table still has % rows', v_count;
    END IF;
  END IF;
END $$;

-- 4. Migrate rogue driver_ratings into driver_reviews
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'driver_ratings'
  ) THEN
    INSERT INTO driver_reviews (id, driver_id, delivery_id, rating, comment, created_at)
    SELECT
      dr.id,
      COALESCE((SELECT user_id FROM drivers WHERE id = dr.driver_id LIMIT 1), dr.driver_id),
      dr.delivery_id,
      dr.rating,
      dr.comment,
      dr.created_at
    FROM driver_ratings dr
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Migrated driver_ratings rows into driver_reviews';
  END IF;
END $$;

-- 5. Drop rogue driver_ratings if empty
DO $$
DECLARE v_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'driver_ratings') THEN
    SELECT COUNT(*) INTO v_count FROM driver_ratings;
    IF v_count = 0 THEN
      DROP TABLE driver_ratings CASCADE;
      RAISE NOTICE 'Dropped empty rogue driver_ratings table';
    ELSE
      RAISE WARNING 'Rogue driver_ratings table still has % rows', v_count;
    END IF;
  END IF;
END $$;

-- 6. Migrate available_deliveries orphan rows into deliveries
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'available_deliveries'
  ) THEN
    INSERT INTO deliveries (id, order_id, status, delivery_address, created_at)
    SELECT ad.id, ad.order_id, 'unassigned'::delivery_status, ad.address, ad.created_at
    FROM available_deliveries ad
    WHERE NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.id = ad.id)
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Migrated available_deliveries rows into deliveries';
  END IF;
END $$;

-- 7. Create canonical view for available deliveries
CREATE OR REPLACE VIEW available_deliveries_view AS
SELECT
  d.id,
  d.order_id,
  d.delivery_address AS address,
  d.created_at
FROM deliveries d
WHERE d.status = 'unassigned' AND d.driver_id IS NULL;

COMMENT ON VIEW available_deliveries_view IS
  'Canonical replacement for the rogue available_deliveries table.';

-- 8. Drop rogue users table if it exists
DROP TABLE IF EXISTS users CASCADE;

-- 9. Drop tables merged into canonical tables or no longer needed
DROP TABLE IF EXISTS active_sessions CASCADE;
-- payouts table is NOT dropped — it is still actively used by adminPayouts.js and commissionService.js.
-- It was created in 021b-payouts-audit-trail.sql and must be preserved.
DROP TABLE IF EXISTS driver_location_history CASCADE;
DROP TABLE IF EXISTS user_violations CASCADE;
DROP TABLE IF EXISTS user_creation_audit CASCADE;
DROP TABLE IF EXISTS request_rate_limits CASCADE;


-- =============================================================================
-- 8. FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role, phone, cin_number)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')::user_role,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'cin_number'
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    cin_number = COALESCE(EXCLUDED.cin_number, profiles.cin_number),
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), profiles.last_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

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

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(TO_CHAR(NEXTVAL('order_seq'), 'FM99999'), 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_delivery_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.delivery_number := 'DEL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(TO_CHAR(NEXTVAL('delivery_seq'), 'FM99999'), 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. SEQUENCES
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS order_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS delivery_seq START WITH 1;

-- =============================================================================
-- 10. TRIGGERS
-- =============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

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

DROP TRIGGER IF EXISTS set_order_number ON orders;
CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

DROP TRIGGER IF EXISTS set_delivery_number ON deliveries;
CREATE TRIGGER set_delivery_number
  BEFORE INSERT ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION generate_delivery_number();

DROP TRIGGER IF EXISTS update_carts_updated_at ON carts;
CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cart_items_updated_at ON cart_items;
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_checkout_requests_updated_at ON checkout_requests;
CREATE TRIGGER update_checkout_requests_updated_at BEFORE UPDATE ON checkout_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_regions_updated_at ON regions;
CREATE TRIGGER update_regions_updated_at BEFORE UPDATE ON regions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_cancellation_policies_updated_at ON vendor_cancellation_policies;
CREATE TRIGGER update_vendor_cancellation_policies_updated_at BEFORE UPDATE ON vendor_cancellation_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_delivery_slots_updated_at ON vendor_delivery_slots;
CREATE TRIGGER update_vendor_delivery_slots_updated_at BEFORE UPDATE ON vendor_delivery_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_wait_responses_updated_at ON vendor_wait_responses;
CREATE TRIGGER update_vendor_wait_responses_updated_at BEFORE UPDATE ON vendor_wait_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_waitlists_updated_at ON product_waitlists;
CREATE TRIGGER update_product_waitlists_updated_at BEFORE UPDATE ON product_waitlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loyalty_rewards_updated_at ON loyalty_rewards;
CREATE TRIGGER update_loyalty_rewards_updated_at BEFORE UPDATE ON loyalty_rewards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_referrals_updated_at ON referrals;
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_payment_methods_updated_at ON user_payment_methods;
CREATE TRIGGER update_user_payment_methods_updated_at BEFORE UPDATE ON user_payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_monthly_sales_updated_at ON vendor_monthly_sales;
CREATE TRIGGER update_vendor_monthly_sales_updated_at BEFORE UPDATE ON vendor_monthly_sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cancellation_log_updated_at ON cancellation_log;
CREATE TRIGGER update_cancellation_log_updated_at BEFORE UPDATE ON cancellation_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 11. INDEXES
-- =============================================================================
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
CREATE INDEX IF NOT EXISTS idx_products_vendor_available ON products(vendor_id, is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_products_available_created ON products(is_available, created_at DESC) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON orders(buyer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_status ON orders(vendor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_reviews_buyer ON reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user_conv ON conversation_participants(user_id, last_read_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_city ON delivery_zones(city);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_code ON delivery_zones(zone_code);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_driver_pricing_driver ON driver_pricing(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_delivery ON delivery_tracking(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_driver ON delivery_tracking(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_timestamp ON delivery_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_delivery_time ON delivery_tracking(delivery_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tier_pricing_product ON tier_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_tier_pricing_vendor ON tier_pricing(vendor_id);
CREATE INDEX IF NOT EXISTS idx_tier_pricing_active ON tier_pricing(is_active);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_online ON driver_locations(is_online);
CREATE INDEX IF NOT EXISTS idx_driver_locations_location ON driver_locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_driver_locations_online_pos ON driver_locations(latitude, longitude) WHERE is_online = true;
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
CREATE INDEX IF NOT EXISTS idx_payments_gateway_txn ON payments(gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_vendor ON coupons(vendor_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code_active ON coupons(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_buyer ON returns(buyer_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_vendor ON bank_accounts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver ON driver_earnings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_delivery ON driver_earnings(delivery_id);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_status ON driver_earnings(status);
CREATE INDEX IF NOT EXISTS idx_driver_reviews_driver ON driver_reviews(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_reviews_delivery ON driver_reviews(delivery_id) WHERE delivery_id IS NOT NULL;

-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_carts_user ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_checkout_requests_buyer ON checkout_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_checkout_requests_status ON checkout_requests(status);
CREATE INDEX IF NOT EXISTS idx_checkout_requests_updated_at ON checkout_requests(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_regions_name_ar ON regions(name_ar);
CREATE INDEX IF NOT EXISTS idx_city_distances_from_to ON city_distances(from_city, to_city);
CREATE INDEX IF NOT EXISTS idx_vendor_cancellation_policies_vendor ON vendor_cancellation_policies(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_delivery_slots_vendor ON vendor_delivery_slots(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_wait_responses_order ON vendor_wait_responses(order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_wait_responses_vendor ON vendor_wait_responses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_vendor ON vendor_contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_product_waitlists_product ON product_waitlists(product_id);
CREATE INDEX IF NOT EXISTS idx_product_waitlists_product_status ON product_waitlists(product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_active ON loyalty_rewards(is_active);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active);
CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user ON user_payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user_default ON user_payment_methods(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_platform_commissions_order ON platform_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_platform_commissions_vendor ON platform_commissions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_monthly_sales_vendor ON vendor_monthly_sales(vendor_id);
CREATE INDEX IF NOT EXISTS idx_confirmed_transactions_order ON confirmed_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_notifications_vendor ON commission_notifications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_log_order ON cancellation_log(order_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_log_buyer ON cancellation_log(buyer_id, cancelled_at DESC);
CREATE INDEX IF NOT EXISTS idx_cancellation_log_vendor ON cancellation_log(vendor_id, cancelled_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_order ON payment_disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_status ON payment_disputes(status);
CREATE INDEX IF NOT EXISTS idx_payment_terms_acceptance_user ON payment_terms_acceptance(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_broadcast_events_driver ON driver_broadcast_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_broadcast_events_delivery ON driver_broadcast_events(delivery_id);

-- 12. STORAGE BUCKETS
-- =============================================================================
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

-- =============================================================================
-- 13. DEFAULT DATA
-- =============================================================================
INSERT INTO delivery_zones (zone_name, zone_code, city, base_price, price_per_km, max_distance_km, estimated_delivery_min, estimated_delivery_max)
VALUES
  ('Casablanca Centre', 'CASA-Centre', 'Casablanca', 15.00, 2.50, 20.00, 30, 45),
  ('Casablanca Peripherie', 'CASA-Peripherie', 'Casablanca', 20.00, 3.00, 40.00, 45, 60),
  ('Rabat Centre', 'RABAT-Centre', 'Rabat', 15.00, 2.50, 15.00, 30, 45),
  ('Marrakech Centre', 'MARR-Centre', 'Marrakech', 15.00, 2.50, 15.00, 30, 45),
  ('Fes Centre', 'FES-Centre', 'Fes', 15.00, 2.50, 15.00, 30, 45),
  ('Tangier Centre', 'TANG-Centre', 'Tangier', 15.00, 2.50, 15.00, 30, 45),
  ('Agadir Centre', 'AGAD-Centre', 'Agadir', 15.00, 2.50, 15.00, 30, 45),
  ('Inter-City', 'INTER-City', 'All Cities', 35.00, 5.00, 200.00, 120, 240)
ON CONFLICT (zone_code) DO NOTHING;

-- =============================================================================
-- 14. REALTIME
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- =============================================================================
-- 15. FINAL VERIFICATION
-- =============================================================================
-- Verification is performed by migration 033-verify-schema.sql
-- to avoid false negatives caused by in-transaction catalog visibility.

COMMIT;
