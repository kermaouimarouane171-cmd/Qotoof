-- =====================================================
-- GreenMarket - Missing Tables Migration
-- Run this in Supabase SQL Editor to create remaining tables
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. DELIVERY ZONES TABLE
-- =====================================================
-- Used by: shippingCalculator.js, driverTracking.js

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

CREATE INDEX IF NOT EXISTS idx_delivery_zones_city ON delivery_zones(city);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_code ON delivery_zones(zone_code);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active);

-- Insert default delivery zones for Moroccan cities
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

-- =====================================================
-- 2. DRIVER PRICING TABLE
-- =====================================================
-- Used by: shippingCalculator.js

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

CREATE INDEX IF NOT EXISTS idx_driver_pricing_driver ON driver_pricing(driver_id);

-- =====================================================
-- 3. CONVERSATIONS TABLE (Chat System)
-- =====================================================
-- Used by: chatService.js

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL DEFAULT 'direct', -- direct, group, support
  title TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_active ON conversations(is_active);

-- Conversation participants
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT false,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id);

-- =====================================================
-- 4. MESSAGES TABLE
-- =====================================================
-- Used by: chatService.js, favorites.js

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT,
  message_type TEXT DEFAULT 'text', -- text, image, file, system
  attachment_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(is_read) WHERE is_read = false;

-- =====================================================
-- 5. DELIVERY TRACKING TABLE
-- =====================================================
-- Used by: driverTracking.js

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

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_delivery ON delivery_tracking(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_driver ON delivery_tracking(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_timestamp ON delivery_tracking(timestamp);

-- =====================================================
-- 6. TIER PRICING TABLE
-- =====================================================
-- Used by: tierPricing.js

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

CREATE INDEX IF NOT EXISTS idx_tier_pricing_product ON tier_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_tier_pricing_vendor ON tier_pricing(vendor_id);
CREATE INDEX IF NOT EXISTS idx_tier_pricing_active ON tier_pricing(is_active);

-- =====================================================
-- 7. DRIVER LOCATIONS TABLE
-- =====================================================
-- Used by: driverMatching.js, gpsTracking.js

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

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_online ON driver_locations(is_online);
CREATE INDEX IF NOT EXISTS idx_driver_locations_location ON driver_locations(latitude, longitude);

-- =====================================================
-- 8. DELIVERY REQUESTS TABLE
-- =====================================================
-- Used by: driverMatching.js

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
  status TEXT DEFAULT 'pending', -- pending, assigned, accepted, completed, cancelled
  assigned_driver_id UUID REFERENCES profiles(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_requests_order ON delivery_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_vendor ON delivery_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_driver ON delivery_requests(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON delivery_requests(status);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_created ON delivery_requests(requested_at);

-- =====================================================
-- 9. ORDER TIMELINE TABLE
-- =====================================================
-- Used by: favorites.js

CREATE TABLE IF NOT EXISTS order_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_description TEXT,
  performed_by UUID REFERENCES profiles(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_timeline_order ON order_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_order_timeline_event ON order_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_order_timeline_created ON order_timeline(created_at);

-- =====================================================
-- 10. VERIFICATION DOCUMENTS TABLE
-- =====================================================
-- Used by: favorites.js, DriverVerification.jsx

CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- cin_front, cin_back, license, insurance, vehicle_registration
  document_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_documents_user ON verification_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_documents_type ON verification_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_verification_documents_status ON verification_documents(status);

-- =====================================================
-- 11. USER REPORTS TABLE (Moderation)
-- =====================================================
-- Used by: admin/Moderation.jsx

CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  reported_user_id UUID NOT NULL REFERENCES profiles(id),
  report_type TEXT NOT NULL, -- spam, fraud, abuse, inappropriate, other
  description TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT DEFAULT 'pending', -- pending, reviewing, resolved, dismissed
  resolution_notes TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_created ON user_reports(created_at);

-- =====================================================
-- 12. DELIVERY CHECKLIST TABLE
-- =====================================================
-- Used by: DeliveryComplete.jsx

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

CREATE INDEX IF NOT EXISTS idx_delivery_checklist_delivery ON delivery_checklist(delivery_id);

-- =====================================================
-- UPDATED_AT TRIGGERS FOR NEW TABLES
-- =====================================================

DROP TRIGGER IF EXISTS update_delivery_zones_updated_at ON delivery_zones;
CREATE OR REPLACE TRIGGER update_delivery_zones_updated_at BEFORE UPDATE ON delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_driver_pricing_updated_at ON driver_pricing;
CREATE OR REPLACE TRIGGER update_driver_pricing_updated_at BEFORE UPDATE ON driver_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE OR REPLACE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE OR REPLACE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tier_pricing_updated_at ON tier_pricing;
CREATE OR REPLACE TRIGGER update_tier_pricing_updated_at BEFORE UPDATE ON tier_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_driver_locations_updated_at ON driver_locations;
CREATE OR REPLACE TRIGGER update_driver_locations_updated_at BEFORE UPDATE ON driver_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_requests_updated_at ON delivery_requests;
CREATE OR REPLACE TRIGGER update_delivery_requests_updated_at BEFORE UPDATE ON delivery_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_verification_documents_updated_at ON verification_documents;
CREATE OR REPLACE TRIGGER update_verification_documents_updated_at BEFORE UPDATE ON verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_reports_updated_at ON user_reports;
CREATE OR REPLACE TRIGGER update_user_reports_updated_at BEFORE UPDATE ON user_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_checklist_updated_at ON delivery_checklist;
CREATE OR REPLACE TRIGGER update_delivery_checklist_updated_at BEFORE UPDATE ON delivery_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) FOR NEW TABLES
-- =====================================================

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_checklist ENABLE ROW LEVEL SECURITY;

-- Delivery zones: publicly viewable
DROP POLICY IF EXISTS "Delivery zones are viewable by everyone" ON delivery_zones;
CREATE POLICY "Delivery zones are viewable by everyone"
  ON delivery_zones FOR SELECT USING (is_active = true);

-- Driver pricing: viewable by everyone, manageable by driver
DROP POLICY IF EXISTS "Driver pricing is viewable by everyone" ON driver_pricing;
CREATE POLICY "Driver pricing is viewable by everyone"
  ON driver_pricing FOR SELECT USING (true);

DROP POLICY IF EXISTS "Drivers can manage own pricing" ON driver_pricing;
CREATE POLICY "Drivers can manage own pricing"
  ON driver_pricing FOR ALL USING (driver_id = auth.uid());

-- Conversations: participants only
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
CREATE POLICY "Users can view conversations they participate in"
  ON conversations FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
      AND conversation_participants.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT WITH CHECK (created_by = auth.uid());

-- Conversation participants
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON conversation_participants;
CREATE POLICY "Users can view participants of their conversations"
  ON conversation_participants FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
      AND cp2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can join conversations" ON conversation_participants;
CREATE POLICY "Users can join conversations"
  ON conversation_participants FOR INSERT WITH CHECK (user_id = auth.uid());

-- Messages: participants only
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;
CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE USING (sender_id = auth.uid());

-- Delivery tracking: viewable by involved parties
DROP POLICY IF EXISTS "Users can view tracking for their deliveries" ON delivery_tracking;
CREATE POLICY "Users can view tracking for their deliveries"
  ON delivery_tracking FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_tracking.delivery_id
      AND (d.driver_id = auth.uid() OR
           EXISTS (SELECT 1 FROM orders o WHERE o.id = d.order_id AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid())))
    )
  );

DROP POLICY IF EXISTS "Drivers can insert their own tracking" ON delivery_tracking;
CREATE POLICY "Drivers can insert their own tracking"
  ON delivery_tracking FOR INSERT WITH CHECK (driver_id = auth.uid());

-- Tier pricing: publicly viewable
DROP POLICY IF EXISTS "Tier pricing is viewable by everyone" ON tier_pricing;
CREATE POLICY "Tier pricing is viewable by everyone"
  ON tier_pricing FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Vendors can manage own tier pricing" ON tier_pricing;
CREATE POLICY "Vendors can manage own tier pricing"
  ON tier_pricing FOR ALL USING (vendor_id = auth.uid());

-- Driver locations: publicly viewable when online
DROP POLICY IF EXISTS "Driver locations are viewable when online" ON driver_locations;
CREATE POLICY "Driver locations are viewable when online"
  ON driver_locations FOR SELECT USING (is_online = true);

DROP POLICY IF EXISTS "Drivers can update own location" ON driver_locations;
CREATE POLICY "Drivers can update own location"
  ON driver_locations FOR ALL USING (driver_id = auth.uid());

-- Delivery requests: viewable by involved parties
DROP POLICY IF EXISTS "Users can view their delivery requests" ON delivery_requests;
CREATE POLICY "Users can view their delivery requests"
  ON delivery_requests FOR SELECT USING (
    vendor_id = auth.uid() OR assigned_driver_id = auth.uid() OR
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.buyer_id = auth.uid())
  );

DROP POLICY IF EXISTS "Vendors can create delivery requests" ON delivery_requests;
CREATE POLICY "Vendors can create delivery requests"
  ON delivery_requests FOR INSERT WITH CHECK (vendor_id = auth.uid());

DROP POLICY IF EXISTS "Vendors can update their delivery requests" ON delivery_requests;
CREATE POLICY "Vendors can update their delivery requests"
  ON delivery_requests FOR UPDATE USING (vendor_id = auth.uid());

-- Order timeline: viewable by involved parties
DROP POLICY IF EXISTS "Users can view timeline for their orders" ON order_timeline;
CREATE POLICY "Users can view timeline for their orders"
  ON order_timeline FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_timeline.order_id
      AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid())
    )
  );

-- Verification documents: user and admin access
DROP POLICY IF EXISTS "Users can view own verification documents" ON verification_documents;
CREATE POLICY "Users can view own verification documents"
  ON verification_documents FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can upload own documents" ON verification_documents;
CREATE POLICY "Users can upload own documents"
  ON verification_documents FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all verification documents" ON verification_documents;
CREATE POLICY "Admins can view all verification documents"
  ON verification_documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update verification documents" ON verification_documents;
CREATE POLICY "Admins can update verification documents"
  ON verification_documents FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- User reports: reporter and admin access
DROP POLICY IF EXISTS "Users can view own reports" ON user_reports;
CREATE POLICY "Users can view own reports"
  ON user_reports FOR SELECT USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Users can create reports" ON user_reports;
CREATE POLICY "Users can create reports"
  ON user_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all reports" ON user_reports;
CREATE POLICY "Admins can view all reports"
  ON user_reports FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update reports" ON user_reports;
CREATE POLICY "Admins can update reports"
  ON user_reports FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Delivery checklist: viewable by involved parties
DROP POLICY IF EXISTS "Users can view checklist for their deliveries" ON delivery_checklist;
CREATE POLICY "Users can view checklist for their deliveries"
  ON delivery_checklist FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_checklist.delivery_id
      AND (d.driver_id = auth.uid() OR
           EXISTS (SELECT 1 FROM orders o WHERE o.id = d.order_id AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid())))
    )
  );

DROP POLICY IF EXISTS "Drivers can complete checklist" ON delivery_checklist;
CREATE POLICY "Drivers can complete checklist"
  ON delivery_checklist FOR ALL USING (completed_by = auth.uid());

-- =====================================================
-- STORAGE BUCKETS FOR NEW FEATURES
-- =====================================================

-- Chat attachments bucket
INSERT INTO storage.buckets (id, name, public) VALUES
  ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat attachments in their conversations" ON storage.objects;

CREATE POLICY "Users can upload chat attachments"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'chat-attachments' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view chat attachments in their conversations"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'chat-attachments' AND auth.role() = 'authenticated'
  );

-- Vehicle photos bucket
INSERT INTO storage.buckets (id, name, public) VALUES
  ('vehicle-photos', 'vehicle-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Drivers can upload vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Vehicle photos are publicly viewable" ON storage.objects;

CREATE POLICY "Drivers can upload vehicle photos"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'vehicle-photos' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Vehicle photos are publicly viewable"
  ON storage.objects FOR SELECT USING (bucket_id = 'vehicle-photos');

-- Verification documents bucket
INSERT INTO storage.buckets (id, name, public) VALUES
  ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all verification documents" ON storage.objects;

CREATE POLICY "Users can upload verification documents"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'verification-docs' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view own verification documents"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'verification-docs' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all verification documents"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'verification-docs' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- END OF MIGRATION
-- =====================================================
