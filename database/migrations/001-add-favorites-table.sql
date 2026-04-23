-- =====================================================
-- Migration: Add Favorites/Wishlist Table
-- =====================================================

-- Create favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure user can't favorite the same product twice
  CONSTRAINT unique_user_product_favorite UNIQUE (user_id, product_id),
  -- Ensure at least one of product_id or vendor_id is set
  CONSTRAINT check_favorite_target CHECK (product_id IS NOT NULL OR vendor_id IS NOT NULL)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product ON favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_favorites_vendor ON favorites(vendor_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created ON favorites(created_at);

-- Enable RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;
CREATE POLICY "Users can view own favorites"
  ON favorites FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can add own favorites" ON favorites;
CREATE POLICY "Users can add own favorites"
  ON favorites FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove own favorites" ON favorites;
CREATE POLICY "Users can remove own favorites"
  ON favorites FOR DELETE USING (user_id = auth.uid());

-- Add verification_status to profiles for trust system
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_documents JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Add verification badge column to stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Create verification_documents table
CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('id_card', 'driver_license', 'business_license', 'vehicle_registration', 'insurance')),
  document_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_docs_user ON verification_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_docs_status ON verification_documents(status);

-- Enable RLS
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own verification documents" ON verification_documents;
CREATE POLICY "Users can view own verification documents"
  ON verification_documents FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can upload own verification documents" ON verification_documents;
CREATE POLICY "Users can upload own verification documents"
  ON verification_documents FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own verification documents" ON verification_documents;
CREATE POLICY "Users can update own verification documents"
  ON verification_documents FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');

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

-- Create messages table for in-app communication
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_delivery ON messages(delivery_id);
CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, is_read) WHERE is_read = false;

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages they sent or received" ON messages;
CREATE POLICY "Users can view messages they sent or received"
  ON messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can update messages they received" ON messages;
CREATE POLICY "Users can update messages they received"
  ON messages FOR UPDATE USING (receiver_id = auth.uid());

-- Add order timeline table
CREATE TABLE IF NOT EXISTS order_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_timeline_order ON order_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_order_timeline_created ON order_timeline(created_at);

-- Enable RLS
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view timeline for their orders" ON order_timeline;
CREATE POLICY "Users can view timeline for their orders"
  ON order_timeline FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_timeline.order_id
      AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "System can create timeline entries" ON order_timeline;
CREATE POLICY "System can create timeline entries"
  ON order_timeline FOR INSERT WITH CHECK (true);

-- Function to auto-create timeline entry on order status change
CREATE OR REPLACE FUNCTION public.create_order_timeline_entry()
RETURNS TRIGGER AS $$
DECLARE
  status_desc TEXT;
  updated_by_id UUID;
BEGIN
  IF NEW.status != OLD.status THEN
    -- Get description based on status
    CASE NEW.status
      WHEN 'pending' THEN status_desc := 'Order placed by buyer';
      WHEN 'vendor_accepted' THEN status_desc := 'Order accepted by vendor';
      WHEN 'vendor_rejected' THEN status_desc := 'Order rejected by vendor';
      WHEN 'driver_assigned' THEN status_desc := 'Driver assigned to delivery';
      WHEN 'driver_accepted' THEN status_desc := 'Driver accepted delivery';
      WHEN 'driver_picked_up' THEN status_desc := 'Driver picked up from vendor';
      WHEN 'on_the_way' THEN status_desc := 'Driver is on the way to buyer';
      WHEN 'delivered' THEN status_desc := 'Order delivered successfully';
      WHEN 'cancelled' THEN status_desc := 'Order cancelled';
      ELSE status_desc := 'Status updated to ' || NEW.status;
    END CASE;

    -- Determine who updated (vendor or driver)
    IF NEW.status = 'vendor_accepted' OR NEW.status = 'vendor_rejected' THEN
      updated_by_id := NEW.vendor_id;
    ELSE
      updated_by_id := NEW.buyer_id;
    END IF;

    INSERT INTO order_timeline (order_id, status, description, updated_by)
    VALUES (NEW.id, NEW.status, status_desc, updated_by_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_create_order_timeline ON orders;
CREATE TRIGGER auto_create_order_timeline
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_order_timeline_entry();

-- Function to auto-create timeline entry on delivery status change
CREATE OR REPLACE FUNCTION public.create_delivery_timeline_entry()
RETURNS TRIGGER AS $$
DECLARE
  status_desc TEXT;
BEGIN
  IF NEW.status != OLD.status THEN
    CASE NEW.status
      WHEN 'unassigned' THEN status_desc := 'Delivery created, waiting for driver';
      WHEN 'assigned' THEN status_desc := 'Driver assigned to delivery';
      WHEN 'accepted' THEN status_desc := 'Driver accepted delivery';
      WHEN 'picked_up' THEN status_desc := 'Driver picked up from vendor';
      WHEN 'on_the_way' THEN status_desc := 'Driver is on the way';
      WHEN 'delivered' THEN status_desc := 'Delivery completed';
      WHEN 'failed' THEN status_desc := 'Delivery failed';
      ELSE status_desc := 'Status updated to ' || NEW.status;
    END CASE;

    INSERT INTO order_timeline (order_id, status, description, updated_by)
    VALUES (NEW.order_id, 'delivery_' || NEW.status, status_desc, NEW.driver_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_create_delivery_timeline ON deliveries;
CREATE TRIGGER auto_create_delivery_timeline
  AFTER UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.create_delivery_timeline_entry();

-- Create storage bucket for verification documents
INSERT INTO storage.buckets (id, name, public) VALUES
  ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for verification documents
DROP POLICY IF EXISTS "Users can upload verification documents" ON storage.objects;
CREATE POLICY "Users can upload verification documents"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'verification-docs' AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Users can view own verification documents" ON storage.objects;
CREATE POLICY "Users can view own verification documents"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'verification-docs' AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Admins can view all verification documents" ON storage.objects;
CREATE POLICY "Admins can view all verification documents"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'verification-docs' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
