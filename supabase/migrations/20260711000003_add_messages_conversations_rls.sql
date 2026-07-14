-- ============================================
-- Add DELETE and UPDATE RLS policies for messages and conversations
-- (Phase 4A-3, Items 8 & 9)
-- ============================================

-- 8. Messages DELETE policy: only sender can delete their own messages
DROP POLICY IF EXISTS "messages_user_delete" ON messages;
CREATE POLICY "messages_user_delete"
  ON messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- 9. Conversations UPDATE policy: only participants can update
DROP POLICY IF EXISTS "conversations_user_update" ON conversations;
CREATE POLICY "conversations_user_update"
  ON conversations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
    )
  );

DO $$
BEGIN
  RAISE NOTICE '✅ Added messages_user_delete policy (sender_id only)';
  RAISE NOTICE '✅ Added conversations_user_update policy (participants only)';
END $$;
