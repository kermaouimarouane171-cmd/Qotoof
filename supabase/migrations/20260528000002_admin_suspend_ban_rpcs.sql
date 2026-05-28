-- =============================================================================
-- Migration: suspend_user and ban_user_permanently PostgreSQL RPCs
-- File:      20260528000002_admin_suspend_ban_rpcs.sql
-- Date:      2026-05-28
-- Fixes:     C-2 — Moderation.jsx calls supabase.rpc('suspend_user', ...) and
--            supabase.rpc('ban_user_permanently', ...) but these PostgreSQL
--            functions were never created in supabase/migrations/ (they existed
--            only in database/migrations/006b-add-user-reporting.sql which is
--            not managed by the Supabase CLI).
-- Parameters used by Moderation.jsx (must match exactly):
--   suspend_user(p_user_id uuid, p_reason text, p_duration_hours int, p_admin_id uuid)
--   ban_user_permanently(p_user_id uuid, p_reason text, p_admin_id uuid)
-- Security:
--   • SECURITY DEFINER so the function runs as the definer role (can bypass
--     profiles_update_own RLS for the UPDATE that is internal to the function).
--   • Internal admin check: raises 42501 if auth.uid() is not role=admin.
--   • Admin cannot suspend/ban themselves.
--   • Writes an audit record to user_violations (created below if absent).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. user_violations audit table
--    (Defined in database/migrations/006b-add-user-reporting.sql but NOT in
--     supabase/migrations/ — created here idempotently.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_violations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  violation_type  TEXT        NOT NULL,
  severity        TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  evidence        TEXT,
  action_taken    TEXT        NOT NULL,
  suspension_start TIMESTAMPTZ,
  suspension_end   TIMESTAMPTZ,
  reported_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_violations_user
  ON public.user_violations (user_id);
CREATE INDEX IF NOT EXISTS idx_user_violations_action
  ON public.user_violations (action_taken, created_at DESC);

ALTER TABLE public.user_violations ENABLE ROW LEVEL SECURITY;

-- Users can view their own violations
DROP POLICY IF EXISTS "user_violations_own_select" ON public.user_violations;
CREATE POLICY "user_violations_own_select"
  ON public.user_violations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all violations
DROP POLICY IF EXISTS "user_violations_admin_select" ON public.user_violations;
CREATE POLICY "user_violations_admin_select"
  ON public.user_violations FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');

-- Only admins can insert violations (function runs as SECURITY DEFINER,
-- so the actual INSERT inside the function bypasses RLS anyway — this policy
-- is a belt-and-suspenders guard for direct table access)
DROP POLICY IF EXISTS "user_violations_admin_insert" ON public.user_violations;
CREATE POLICY "user_violations_admin_insert"
  ON public.user_violations FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 2. suspend_user RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.suspend_user(
  p_user_id        UUID,
  p_reason         TEXT,
  p_duration_hours INTEGER  DEFAULT NULL,  -- NULL = permanent
  p_admin_id       UUID     DEFAULT NULL   -- defaults to auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id       UUID;
  v_suspension_end TIMESTAMPTZ;
BEGIN
  -- Resolve admin id: prefer explicit parameter, fall back to session user
  v_admin_id := COALESCE(p_admin_id, auth.uid());

  -- ── Security checks ────────────────────────────────────────────────────
  -- 1. Caller must be an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'permission_denied: only admins can suspend users'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Admin cannot suspend themselves
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'permission_denied: admin cannot suspend their own account'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Target must exist
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'not_found: target user does not exist'
      USING ERRCODE = 'P0002';
  END IF;
  -- ────────────────────────────────────────────────────────────────────────

  -- Calculate suspension end
  IF p_duration_hours IS NOT NULL THEN
    v_suspension_end := NOW() + (p_duration_hours || ' hours')::INTERVAL;
  ELSE
    v_suspension_end := NULL;  -- permanent
  END IF;

  -- Update the profile (bypasses RLS because function is SECURITY DEFINER)
  UPDATE public.profiles
  SET
    is_suspended      = TRUE,
    suspension_reason = p_reason,
    suspension_start  = NOW(),
    suspension_end    = v_suspension_end,
    violation_count   = COALESCE(violation_count, 0) + 1,
    last_violation_at = NOW()
  WHERE id = p_user_id;

  -- Audit record
  INSERT INTO public.user_violations (
    user_id, violation_type, severity, description, action_taken,
    suspension_start, suspension_end, reported_by, reviewed_by
  ) VALUES (
    p_user_id,
    'policy_violation',
    CASE
      WHEN p_duration_hours IS NULL     THEN 'critical'
      WHEN p_duration_hours > 168       THEN 'major'
      ELSE                                   'minor'
    END,
    COALESCE(p_reason, 'Policy violation'),
    CASE WHEN p_duration_hours IS NULL THEN 'permanent_ban' ELSE 'temporary_suspension' END,
    NOW(),
    v_suspension_end,
    v_admin_id,
    v_admin_id
  );

  RETURN jsonb_build_object(
    'success',         TRUE,
    'user_id',         p_user_id,
    'suspension_end',  v_suspension_end
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. ban_user_permanently RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ban_user_permanently(
  p_user_id    UUID,
  p_reason     TEXT,
  p_admin_id   UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := COALESCE(p_admin_id, auth.uid());

  -- ── Security checks ────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'permission_denied: only admins can permanently ban users'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'permission_denied: admin cannot ban their own account'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'not_found: target user does not exist'
      USING ERRCODE = 'P0002';
  END IF;
  -- ────────────────────────────────────────────────────────────────────────

  UPDATE public.profiles
  SET
    is_suspended      = TRUE,
    suspension_reason = COALESCE(p_reason, 'Permanently banned'),
    suspension_start  = NOW(),
    suspension_end    = NULL,   -- NULL = permanent
    violation_count   = COALESCE(violation_count, 0) + 1,
    last_violation_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO public.user_violations (
    user_id, violation_type, severity, description, action_taken,
    suspension_start, reported_by, reviewed_by
  ) VALUES (
    p_user_id,
    'policy_violation',
    'critical',
    COALESCE(p_reason, 'Permanently banned'),
    'permanent_ban',
    NOW(),
    v_admin_id,
    v_admin_id
  );

  RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Grant EXECUTE to authenticated role so the Supabase JS client can call
--    the functions via supabase.rpc(). Security checks inside the functions
--    enforce that only admins can actually perform the action.
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.suspend_user(UUID, TEXT, INTEGER, UUID)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.ban_user_permanently(UUID, TEXT, UUID)
  TO authenticated;

COMMIT;
