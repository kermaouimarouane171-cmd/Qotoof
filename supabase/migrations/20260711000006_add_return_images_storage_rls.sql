-- =============================================================================
-- Migration: Add RLS policies for return-images storage bucket
--
-- Problem: return-images bucket exists but has NO RLS policies.
--          It is also set to public=true, which means anyone (including anon)
--          can read return images that may contain sensitive product defect photos.
--
-- Fix:
--   1. Set return-images bucket to public=false (private)
--   2. Add SELECT policy: only return participants (buyer, vendor) or admin
--   3. Add INSERT policy: only buyer who created the return (path = {returnId}/...)
--   4. Add UPDATE/DELETE policy: only owner of the file
--
-- Path pattern in code (Returns.jsx:263-264):
--   `${returnData.id}/${Date.now()}-${filename}`
--   So (storage.foldername(name))[1] = returnId
--
-- Other 4 buckets (avatars, product-images, profile-photos, store-logos)
-- already have working RLS policies — NOT touched in this migration.
-- =============================================================================

-- 1. Make return-images bucket private (it was public=true)
UPDATE storage.buckets
SET public = false
WHERE id = 'return-images';

-- 2. Drop any existing policies for return-images (idempotent — none exist, but safe)
DROP POLICY IF EXISTS "return_images_participants_select" ON storage.objects;
DROP POLICY IF EXISTS "return_images_buyer_insert" ON storage.objects;
DROP POLICY IF EXISTS "return_images_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "return_images_owner_delete" ON storage.objects;

-- 3. SELECT: buyer who created the return, vendor of the order, or admin
--    Path: {returnId}/{timestamp}-{filename}
--    (storage.foldername(name))[1] = returnId
CREATE POLICY "return_images_participants_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'return-images'
    AND (
      auth.uid() = owner
      OR EXISTS (
        SELECT 1 FROM public.return_requests rr
        WHERE rr.id::text = (storage.foldername(name))[1]
          AND (rr.buyer_id = auth.uid() OR rr.vendor_id = auth.uid())
      )
      OR public.current_user_role() = 'admin'
    )
  );

-- 4. INSERT: only the buyer who created the return request
CREATE POLICY "return_images_buyer_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'return-images'
    AND auth.uid() = owner
    AND EXISTS (
      SELECT 1 FROM public.return_requests rr
      WHERE rr.id::text = (storage.foldername(name))[1]
        AND rr.buyer_id = auth.uid()
    )
  );

-- 5. UPDATE: only the file owner
CREATE POLICY "return_images_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'return-images'
    AND auth.uid() = owner
  );

-- 6. DELETE: only the file owner
CREATE POLICY "return_images_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'return-images'
    AND auth.uid() = owner
  );

DO $$
BEGIN
  RAISE NOTICE '✅ return-images bucket set to private=false';
  RAISE NOTICE '✅ Added 4 RLS policies: SELECT (participants+admin), INSERT (buyer), UPDATE (owner), DELETE (owner)';
END $$;
