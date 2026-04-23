INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('payment-receipts', 'payment-receipts', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('dispute-evidence', 'dispute-evidence', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload payment receipts" ON storage.objects;
CREATE POLICY "Users can upload payment receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Parties can view payment receipts" ON storage.objects;
CREATE POLICY "Parties can view payment receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1
        FROM orders
        WHERE orders.id::text = (storage.foldername(name))[2]
          AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Owners can update payment receipts" ON storage.objects;
CREATE POLICY "Owners can update payment receipts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Owners can delete payment receipts" ON storage.objects;
CREATE POLICY "Owners can delete payment receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can upload dispute evidence" ON storage.objects;
CREATE POLICY "Users can upload dispute evidence"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dispute-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Dispute parties can view dispute evidence" ON storage.objects;
CREATE POLICY "Dispute parties can view dispute evidence"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1
        FROM payment_disputes
        WHERE payment_disputes.id::text = (storage.foldername(name))[2]
          AND (payment_disputes.buyer_id = auth.uid() OR payment_disputes.vendor_id = auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Owners can update dispute evidence" ON storage.objects;
CREATE POLICY "Owners can update dispute evidence"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Owners can delete dispute evidence" ON storage.objects;
CREATE POLICY "Owners can delete dispute evidence"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );