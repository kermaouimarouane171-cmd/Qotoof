BEGIN;

CREATE TABLE IF NOT EXISTS public.request_rate_limits (
  scope TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, identifier_hash),
  CONSTRAINT request_rate_limits_scope_check CHECK (char_length(trim(scope)) > 0),
  CONSTRAINT request_rate_limits_identifier_hash_check CHECK (char_length(trim(identifier_hash)) > 0),
  CONSTRAINT request_rate_limits_attempt_count_check CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_request_rate_limits_blocked_until
  ON public.request_rate_limits (blocked_until)
  WHERE blocked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_request_rate_limits_updated_at
  ON public.request_rate_limits (updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_request_rate_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_request_rate_limits_updated_at ON public.request_rate_limits;
CREATE TRIGGER trg_request_rate_limits_updated_at
BEFORE UPDATE ON public.request_rate_limits
FOR EACH ROW EXECUTE FUNCTION public.set_request_rate_limits_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
  p_scope TEXT,
  p_identifier_hash TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER,
  p_block_seconds INTEGER DEFAULT NULL
)
RETURNS TABLE (
  allowed BOOLEAN,
  retry_after_seconds INTEGER,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_record public.request_rate_limits%ROWTYPE;
  v_effective_block_seconds INTEGER := GREATEST(COALESCE(p_block_seconds, p_window_seconds), 1);
  v_reset_at TIMESTAMPTZ;
BEGIN
  IF COALESCE(trim(p_scope), '') = '' THEN
    RAISE EXCEPTION 'Rate limit scope is required';
  END IF;

  IF COALESCE(trim(p_identifier_hash), '') = '' THEN
    RAISE EXCEPTION 'Rate limit identifier is required';
  END IF;

  IF COALESCE(p_max_attempts, 0) < 1 THEN
    RAISE EXCEPTION 'Rate limit max attempts must be positive';
  END IF;

  IF COALESCE(p_window_seconds, 0) < 1 THEN
    RAISE EXCEPTION 'Rate limit window must be positive';
  END IF;

  INSERT INTO public.request_rate_limits (
    scope,
    identifier_hash,
    window_started_at,
    attempt_count,
    blocked_until
  )
  VALUES (
    trim(p_scope),
    trim(p_identifier_hash),
    v_now,
    0,
    NULL
  )
  ON CONFLICT (scope, identifier_hash) DO NOTHING;

  SELECT *
  INTO v_record
  FROM public.request_rate_limits
  WHERE scope = trim(p_scope)
    AND identifier_hash = trim(p_identifier_hash)
  FOR UPDATE;

  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
    RETURN QUERY
    SELECT
      FALSE,
      GREATEST(CEIL(EXTRACT(EPOCH FROM (v_record.blocked_until - v_now)))::INTEGER, 1),
      0,
      v_record.blocked_until;
    RETURN;
  END IF;

  v_reset_at := v_record.window_started_at + make_interval(secs => p_window_seconds);

  IF v_reset_at <= v_now THEN
    UPDATE public.request_rate_limits
    SET
      window_started_at = v_now,
      attempt_count = 1,
      blocked_until = NULL
    WHERE scope = v_record.scope
      AND identifier_hash = v_record.identifier_hash;

    RETURN QUERY
    SELECT TRUE, 0, GREATEST(p_max_attempts - 1, 0), v_now + make_interval(secs => p_window_seconds);
    RETURN;
  END IF;

  UPDATE public.request_rate_limits
  SET
    attempt_count = attempt_count + 1,
    blocked_until = CASE
      WHEN attempt_count + 1 > p_max_attempts THEN v_now + make_interval(secs => v_effective_block_seconds)
      ELSE NULL
    END
  WHERE scope = v_record.scope
    AND identifier_hash = v_record.identifier_hash
  RETURNING * INTO v_record;

  IF v_record.attempt_count > p_max_attempts THEN
    RETURN QUERY
    SELECT
      FALSE,
      GREATEST(CEIL(EXTRACT(EPOCH FROM (v_record.blocked_until - v_now)))::INTEGER, 1),
      0,
      v_record.blocked_until;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT TRUE, 0, GREATEST(p_max_attempts - v_record.attempt_count, 0), v_reset_at;
END;
$$;

REVOKE ALL ON TABLE public.request_rate_limits FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_rate_limit(TEXT, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.enforce_rate_limit(TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

COMMIT;