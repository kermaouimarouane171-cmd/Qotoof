-- =============================================
-- Phase 8.12: PayPal Webhook Events Log Table
-- Provides idempotency for PayPal webhook handler.
-- Each PayPal event is recorded once to prevent duplicate processing.
-- =============================================

CREATE TABLE IF NOT EXISTS paypal_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paypal_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'processed',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paypal_webhook_events_event_id ON paypal_webhook_events(paypal_event_id);
CREATE INDEX IF NOT EXISTS idx_paypal_webhook_events_event_type ON paypal_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_paypal_webhook_events_processed_at ON paypal_webhook_events(processed_at DESC);

ALTER TABLE paypal_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paypal_webhook_events_service_role_all" ON paypal_webhook_events;
CREATE POLICY "paypal_webhook_events_service_role_all"
  ON paypal_webhook_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE paypal_webhook_events IS 'PayPal webhook event log for idempotent event processing';
