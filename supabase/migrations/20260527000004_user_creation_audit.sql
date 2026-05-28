-- ==========================================================================
-- Migration: user_creation_audit table (idempotency for create-user-with-role)
-- ==========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_creation_audit (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key  TEXT        UNIQUE,
  auth_user_id     UUID,
  role             TEXT        NOT NULL CHECK (role IN ('admin', 'vendor', 'buyer', 'driver')),
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'success', 'failed')),
  error_message    TEXT,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_creation_audit_idempotency
  ON public.user_creation_audit (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_creation_audit_auth_user
  ON public.user_creation_audit (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_creation_audit_status
  ON public.user_creation_audit (status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_user_creation_audit_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_user_creation_audit_updated_at ON public.user_creation_audit;
CREATE TRIGGER trg_user_creation_audit_updated_at
  BEFORE UPDATE ON public.user_creation_audit
  FOR EACH ROW EXECUTE FUNCTION public.set_user_creation_audit_updated_at();

-- RLS: only admins can read; service_role can do everything
ALTER TABLE public.user_creation_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_creation_audit_admin_select" ON public.user_creation_audit;
CREATE POLICY "user_creation_audit_admin_select"
  ON public.user_creation_audit
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "user_creation_audit_service" ON public.user_creation_audit;
CREATE POLICY "user_creation_audit_service"
  ON public.user_creation_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
