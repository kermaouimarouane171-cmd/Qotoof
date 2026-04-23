-- ===================================================================
-- Migration 024: Fix Schema Conflicts
-- Purpose: Resolve duplicate/conflicting table definitions from migrations 001 and 002
-- 
-- Conflicts:
-- 1. messages: Two schemas - direct messaging (001) vs conversation-based (002)
-- 2. order_timeline: Two schemas - status-based (001) vs event-based (002)
-- 3. verification_documents: Two schemas with different columns
-- ===================================================================

-- ===================================================================
-- 1. MESSAGES TABLE - Unified Schema
-- ===================================================================
-- Decision: Keep 002 schema (conversation-based) as primary
-- Add missing direct messaging columns for backward compatibility

-- Drop policies first (if they exist)
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update messages they received" ON messages;

-- Add backward compatibility columns for order/delivery messaging
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message TEXT;

-- Standardize column names (support both old and new naming)
-- content column exists, message is alias
CREATE OR REPLACE VIEW message_compatibility AS
SELECT 
  id, 
  conversation_id,
  delivery_id,
  order_id,
  sender_id,
  receiver_id,
  COALESCE(content, message) as content,
  COALESCE(content, message) as message,
  message_type,
  attachment_url,
  is_read,
  read_at,
  created_at,
  updated_at
FROM messages;

-- Add comprehensive indexes
CREATE INDEX IF NOT EXISTS idx_messages_delivery ON messages(delivery_id) WHERE delivery_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id) WHERE receiver_id IS NOT NULL;

-- Recreate RLS policies (more comprehensive)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
    ON messages FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM conversation_participants
        WHERE conversation_participants.conversation_id = messages.conversation_id
        AND conversation_participants.user_id = auth.uid()
      )
      OR sender_id = auth.uid()
      OR receiver_id = auth.uid()
    );

-- Policy 2: Users can send messages in their conversations
CREATE POLICY "Users can send messages in their conversations"
    ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Policy 3: Users can update their own messages (mark as read)
CREATE POLICY "Users can update their own messages"
    ON messages FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- ===================================================================
-- 2. ORDER_TIMELINE TABLE - Unified Schema
-- ===================================================================
-- Decision: Keep 001 schema (status-based) as primary
-- The triggers reference this schema, so keep it consistent

-- Drop policies first
DROP POLICY IF EXISTS "Users can view timeline for their orders" ON order_timeline;

-- Add new columns from 002 (event_type semantics)
ALTER TABLE order_timeline ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE order_timeline ADD COLUMN IF NOT EXISTS event_description TEXT;
ALTER TABLE order_timeline ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE order_timeline ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- For backward compatibility, populate event_type from status
UPDATE order_timeline 
SET event_type = status 
WHERE event_type IS NULL AND status IS NOT NULL;

-- Rename columns for consistency (if needed)
-- status column can serve as event_type
-- description column can serve as event_description
-- updated_by can serve as performed_by

-- Add comprehensive indexes
CREATE INDEX IF NOT EXISTS idx_order_timeline_event_type ON order_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_order_timeline_performed_by ON order_timeline(performed_by);

-- Recreate RLS
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view timeline for their orders"
    ON order_timeline FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_timeline.order_id
        AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid())
      )
    );

CREATE POLICY "System can create timeline entries"
    ON order_timeline FOR INSERT WITH CHECK (true);

-- ===================================================================
-- 3. VERIFICATION_DOCUMENTS TABLE - Unified Schema
-- ===================================================================
-- Decision: Keep 001 schema as base, add new columns from 002

-- Drop policies
DROP POLICY IF EXISTS "Users can view own verification documents" ON verification_documents;
DROP POLICY IF EXISTS "Users can upload own documents" ON verification_documents;
DROP POLICY IF EXISTS "Admins can view all verification documents" ON verification_documents;
DROP POLICY IF EXISTS "Admins can update verification documents" ON verification_documents;
DROP POLICY IF EXISTS "Users can update own verification documents" ON verification_documents;

-- Add missing columns from 002
ALTER TABLE verification_documents ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE verification_documents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE verification_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Recreate RLS
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;

-- Users can view own documents
CREATE POLICY "Users can view own verification documents"
    ON verification_documents FOR SELECT USING (user_id = auth.uid());

-- Users can upload own documents
CREATE POLICY "Users can upload own documents"
    ON verification_documents FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update own pending documents
CREATE POLICY "Users can update own verification documents"
    ON verification_documents FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');

-- Admins can view all documents
CREATE POLICY "Admins can view all verification documents"
    ON verification_documents FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Admins can update documents
CREATE POLICY "Admins can update verification documents"
    ON verification_documents FOR UPDATE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ===================================================================
-- 4. Update Triggers for updated_at columns
-- ===================================================================

-- For messages table
CREATE TRIGGER IF NOT EXISTS update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- For verification_documents table
CREATE TRIGGER IF NOT EXISTS update_verification_documents_updated_at
  BEFORE UPDATE ON verification_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- 5. Add helpful comments to clarify schema decisions
-- ===================================================================

COMMENT ON TABLE messages IS 'Chat messages - unified schema supporting both conversation-based (primary) and direct order/delivery messaging (backward compat)';
COMMENT ON COLUMN messages.conversation_id IS 'Primary conversation ID (new architecture)';
COMMENT ON COLUMN messages.delivery_id IS 'Delivery ID (backward compatibility for order/delivery messages)';
COMMENT ON COLUMN messages.order_id IS 'Order ID (backward compatibility for order/delivery messages)';
COMMENT ON COLUMN messages.content IS 'Message content (primary column, replaces message)';
COMMENT ON COLUMN messages.message IS 'Message text (deprecated, use content)';

COMMENT ON TABLE order_timeline IS 'Order status timeline - unified schema with event-based metadata';
COMMENT ON COLUMN order_timeline.status IS 'Status value (e.g., pending, confirmed, delivered)';
COMMENT ON COLUMN order_timeline.event_type IS 'Event type (matches status for consistency)';
COMMENT ON COLUMN order_timeline.description IS 'Human-readable description';
COMMENT ON COLUMN order_timeline.event_description IS 'Event description (alias for description)';
COMMENT ON COLUMN order_timeline.updated_by IS 'Who made the change';
COMMENT ON COLUMN order_timeline.performed_by IS 'Who performed the event (alias for updated_by)';
COMMENT ON COLUMN order_timeline.metadata IS 'Additional event metadata as JSON';

COMMENT ON TABLE verification_documents IS 'Verification documents with admin review and rejection tracking';
COMMENT ON COLUMN verification_documents.admin_notes IS 'Admin review notes';
COMMENT ON COLUMN verification_documents.rejection_reason IS 'Reason for rejection (if status = rejected)';
COMMENT ON COLUMN verification_documents.expires_at IS 'Document expiration date (if applicable)';

-- ===================================================================
-- 6. Schema Standardization - Enforce constraints
-- ===================================================================

-- Add CHECK constraints for status consistency
ALTER TABLE verification_documents
  ADD CONSTRAINT check_rejection_reason CHECK (
    (status = 'rejected' AND rejection_reason IS NOT NULL) OR
    (status != 'rejected' AND rejection_reason IS NULL)
  );

ALTER TABLE messages
  ADD CONSTRAINT check_conversation_or_direct CHECK (
    (conversation_id IS NOT NULL) OR (delivery_id IS NOT NULL OR order_id IS NOT NULL)
  );

-- ===================================================================
-- 7. Migration Summary
-- ===================================================================
-- ✅ MESSAGES: Unified with backward compatibility
--    - Primary: conversation_id model (002)
--    - Backward compat: delivery_id, order_id, receiver_id (001)
-- ✅ ORDER_TIMELINE: Status-based with event metadata
--    - Primary: status, description, updated_by (001)
--    - Metadata: event_type, metadata (002)
-- ✅ VERIFICATION_DOCUMENTS: Combined schema
--    - Base: document review with admin_notes (001)
--    - Enhanced: rejection_reason, expires_at (002)
-- ✅ All tables have comprehensive RLS policies
-- ✅ All tables have performance indexes
-- ===================================================================
