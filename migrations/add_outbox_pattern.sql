-- Outbox pattern table: stores domain events inside the DB transaction so side-effects
-- (email, SMS, notifications, loyalty updates) can be processed reliably and retried.
CREATE TABLE domain_events_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,       -- 'order.accepted', 'delivery.assigned', etc.
  payload jsonb NOT NULL,
  processed_at timestamptz,
  error text,
  retry_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_outbox_unprocessed ON domain_events_outbox(created_at)
  WHERE processed_at IS NULL AND retry_count < 3;

COMMENT ON TABLE domain_events_outbox IS
  'Transactional outbox for reliable async domain-event processing with retries.';

ALTER TABLE domain_events_outbox ENABLE ROW LEVEL SECURITY;

-- No client access: anon/authenticated have no policies.
-- service_role policy is provided for worker/Edge Function access.
CREATE POLICY domain_events_outbox_service_role_all
  ON domain_events_outbox
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
