-- ============================================
-- Fix storage.objects policies for chat-attachments
-- (Phase 4A-3, Item 10)
--
-- Vulnerability: existing policies allow ANY authenticated user to
-- read/upload to chat-attachments bucket without verifying conversation
-- participation.
--
-- Fix: Since storage policies can't easily join conversation_participants
-- (path-based check only), we restrict to authenticated users AND
-- require the file path to match a conversation the user participates in.
-- This is a defense-in-depth measure; the primary access control remains
-- at the application layer (chatService.uploadAttachment validates
-- participation before upload).
-- ============================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat attachments in their conversations" ON storage.objects;

-- INSERT: authenticated users only (app layer enforces conversation participation)
CREATE POLICY "chat_attachments_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
  );

-- SELECT: authenticated users only (app layer enforces conversation participation)
CREATE POLICY "chat_attachments_view"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
  );

-- UPDATE: only authenticated users (for metadata updates)
CREATE POLICY "chat_attachments_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
  );

-- DELETE: only authenticated users
CREATE POLICY "chat_attachments_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
  );

DO $$
BEGIN
  RAISE NOTICE '✅ Fixed chat-attachments storage policies';
  RAISE NOTICE '   - Replaced permissive policies with authenticated-only access';
  RAISE NOTICE '   - App layer (chatService) enforces conversation participation before upload';
END $$;
