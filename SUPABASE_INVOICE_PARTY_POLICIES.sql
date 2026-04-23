BEGIN;

DROP POLICY IF EXISTS invoices_vendor_insert ON invoices;
DROP POLICY IF EXISTS invoices_order_parties_insert ON invoices;
CREATE POLICY invoices_order_parties_insert
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (vendor_id = auth.uid() OR buyer_id = auth.uid());

DROP POLICY IF EXISTS invoices_vendor_update ON invoices;
DROP POLICY IF EXISTS invoices_order_parties_update ON invoices;
CREATE POLICY invoices_order_parties_update
  ON invoices FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid() OR buyer_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid() OR buyer_id = auth.uid());

COMMIT;