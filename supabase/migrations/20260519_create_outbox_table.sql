-- Migration: create domain_events_outbox table
-- Purpose: Reliable delivery of async side-effects (email, SMS) via transactional outbox pattern.
--          Edge Functions write events here; a pg_cron worker delivers them to send-email/send-sms.

CREATE TABLE IF NOT EXISTS domain_events_outbox (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT        NOT NULL,
  payload         JSONB       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts        INT         NOT NULL DEFAULT 0,
  max_attempts    INT         NOT NULL DEFAULT 3,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  error_message   TEXT,
  source_function TEXT
);

-- Partial index: only pending/failed rows that still have retries left are ever scanned by the worker
CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON domain_events_outbox (created_at ASC)
  WHERE status IN ('pending', 'failed') AND attempts < max_attempts;

-- General status index for monitoring queries
CREATE INDEX IF NOT EXISTS idx_outbox_status
  ON domain_events_outbox (status);

-- RLS: accessible only by the service_role (Edge Functions); no authenticated user may see rows
ALTER TABLE domain_events_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only"
  ON domain_events_outbox
  USING (false)
  WITH CHECK (false);
