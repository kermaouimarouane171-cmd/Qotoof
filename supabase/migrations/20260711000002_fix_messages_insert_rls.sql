-- ============================================
-- Fix messages INSERT RLS policy (Phase 4A-3, Item 1)
-- 
-- Vulnerability: existing INSERT policies only check sender_id = auth.uid()
-- without verifying that the sender is a participant in the conversation.
-- This allows any authenticated user to inject messages into other users'
-- conversations.
--
-- Fix: require BOTH sender_id = auth.uid() AND conversation participation.
--
-- Note: conversation_id is NOT NULL in the live schema, so all messages
-- belong to a conversation. No need to handle NULL conversation_id.
-- ============================================

-- 1. Drop all existing INSERT (ALL) policies on messages
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;
DROP POLICY IF EXISTS "messages_user_insert" ON messages;

-- 2. Create new secure INSERT policy
CREATE POLICY "messages_user_insert"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

-- Notify success
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed messages INSERT RLS policy';
  RAISE NOTICE '   - Dropped vulnerable policies (sender_id check only)';
  RAISE NOTICE '   - New policy requires both sender_id = auth.uid() AND conversation participation';
END $$;
