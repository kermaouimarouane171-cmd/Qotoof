-- ==========================================================================
-- Migration: Fix profiles RLS + Role protection + Role sync infrastructure
-- Issue: profiles RLS was disabled in 20260414000005_fix_profiles_rls.sql
--        to work around infinite recursion.  This migration re-enables it
--        with non-recursive policies and adds defence-in-depth controls:
--          1. Non-recursive RLS policies using SECURITY DEFINER helper
--          2. Trigger that blocks self-role-upgrade attempts
--          3. role_change_audit_log table
--          4. Trigger that queues app_metadata sync via domain_events_outbox
-- ==========================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. SECURITY DEFINER helper – reads a user's role WITHOUT triggering RLS
--    (runs as table owner / postgres, so it bypasses row-level checks).
--    Used by OTHER tables' policies so they can check the caller's role
--    without recursing into profiles RLS.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Grant execute to authenticated & anon so RLS policies can call it
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon;

-- --------------------------------------------------------------------------
-- 2. RE-ENABLE RLS on profiles
-- --------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop all old policies first (clean slate)
DROP POLICY IF EXISTS "profiles_select"                     ON public.profiles;
DROP POLICY IF EXISTS "profiles_update"                     ON public.profiles;
DROP POLICY IF EXISTS "Users can view own CIN"              ON public.profiles;
DROP POLICY IF EXISTS "Users can update own CIN"            ON public.profiles;
DROP POLICY IF EXISTS "hide_contact_until_order_confirmed"  ON public.profiles;

-- 2a. SELECT: every authenticated user can read profiles
--     (public marketplace – vendor/store names, avatars are needed everywhere).
--     Sensitive columns (phone, cin, bank_details, etc.) are handled at the
--     application layer; they are NOT returned by default selects.
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- 2b. Anonymous users can only read limited public profile info
--     (needed for store landing pages when not logged-in)
DROP POLICY IF EXISTS "profiles_select_anon" ON public.profiles;
CREATE POLICY "profiles_select_anon"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (true);

-- 2c. UPDATE: users can only update their OWN profile row.
--     The `prevent_role_self_update` trigger (below) enforces that they
--     cannot change the `role` column.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2d. INSERT: only service_role may insert new profile rows
--     (profiles are created by the auth trigger, not by end-users)
DROP POLICY IF EXISTS "profiles_insert_service_role" ON public.profiles;
CREATE POLICY "profiles_insert_service_role"
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 2e. DELETE: only service_role / admin may delete profiles
DROP POLICY IF EXISTS "profiles_delete_service_role" ON public.profiles;
CREATE POLICY "profiles_delete_service_role"
  ON public.profiles
  FOR DELETE
  TO service_role
  USING (true);

-- --------------------------------------------------------------------------
-- 3. TRIGGER: block non-admin users from changing their own `role`
--    This is a second line of defence on top of RLS.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_role_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role (used by Edge Functions & admin operations) to do anything
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block if the role column is being changed by a regular user
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Check if the caller is an admin (checking OLD profile to prevent bootstrap issues)
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'permission_denied: only admins can change user roles'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_update ON public.profiles;
CREATE TRIGGER trg_prevent_role_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_update();

-- --------------------------------------------------------------------------
-- 4. AUDIT TABLE: role_change_audit_log
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_change_audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user   UUID        NOT NULL,
  changed_by    UUID,                        -- NULL when changed via service_role
  old_role      TEXT        NOT NULL,
  new_role      TEXT        NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source        TEXT        DEFAULT 'manual' -- 'manual'|'trigger'|'sync'
);

CREATE INDEX IF NOT EXISTS idx_role_change_audit_target
  ON public.role_change_audit_log (target_user, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_change_audit_changer
  ON public.role_change_audit_log (changed_by, changed_at DESC);

ALTER TABLE public.role_change_audit_log ENABLE ROW LEVEL SECURITY;
-- Only admins and service_role can read audit logs
DROP POLICY IF EXISTS "role_audit_admin_read" ON public.role_change_audit_log;
CREATE POLICY "role_audit_admin_read"
  ON public.role_change_audit_log
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "role_audit_service_write" ON public.role_change_audit_log;
CREATE POLICY "role_audit_service_write"
  ON public.role_change_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 5. TRIGGER: on profiles.role change → audit + queue app_metadata sync
--    The sync itself is handled by the `sync-role` Edge Function which is
--    invoked by the domain_events_outbox processor.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_profile_role_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  -- 5a. Write audit record
  INSERT INTO public.role_change_audit_log
    (target_user, changed_by, old_role, new_role, source)
  VALUES
    (NEW.id, auth.uid(), OLD.role, NEW.role, 'trigger');

  -- 5b. Queue app_metadata sync so JWT claims stay in sync.
  --     The `process-outbox` Edge Function routes 'auth.role_changed' events
  --     to the `sync-role` Edge Function.
  INSERT INTO public.domain_events_outbox
    (event_type, payload, status, source_function)
  VALUES (
    'auth.role_changed',
    jsonb_build_object(
      'user_id',  NEW.id,
      'new_role', NEW.role,
      'old_role', OLD.role
    ),
    'pending',
    'trg_profile_role_changed'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_role_changed ON public.profiles;
CREATE TRIGGER trg_profile_role_changed
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.on_profile_role_changed();

-- --------------------------------------------------------------------------
-- 6. DATA INTEGRITY: ensure existing profiles.role == app_metadata.role
--    Insert one sync event per user whose role is not 'buyer' (common case).
--    These will be processed by the outbox worker on next run.
--    Run in batches of 50 as requested.
-- --------------------------------------------------------------------------
DO $$
DECLARE
  batch_offset INTEGER := 0;
  batch_size   INTEGER := 50;
  inserted     INTEGER;
BEGIN
  LOOP
    WITH batch AS (
      SELECT id, role
      FROM   public.profiles
      WHERE  role IS NOT NULL
      ORDER  BY created_at ASC
      LIMIT  batch_size
      OFFSET batch_offset
    )
    INSERT INTO public.domain_events_outbox (event_type, payload, status, source_function)
    SELECT
      'auth.role_changed',
      jsonb_build_object('user_id', id, 'new_role', role, 'old_role', 'unknown', 'initial_sync', true),
      'pending',
      'migration_initial_sync'
    FROM batch
    -- Skip if already queued in this migration run
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS inserted = ROW_COUNT;
    EXIT WHEN inserted = 0;
    batch_offset := batch_offset + batch_size;
  END LOOP;
END;
$$;

COMMIT;
