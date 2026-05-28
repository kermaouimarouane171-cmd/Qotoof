-- =============================================================================
-- Migration: Admin UPDATE policy for profiles + missing admin columns
-- File:      20260528000001_admin_profiles_update_policy.sql
-- Date:      2026-05-28
-- Fixes:     C-1 — Admin cannot approve/reject vendors because the only
--            UPDATE policy on profiles is profiles_update_own (id = auth.uid()),
--            which blocks any update on a row where id != auth.uid().
-- Strategy:
--   • Add profiles_admin_update RLS policy that allows users with role=admin
--     to UPDATE any profile row.
--   • The existing prevent_role_self_update trigger already enforces that only
--     admins can change the role column, so we do NOT duplicate that logic here.
--   • Non-admin users retain full access to update their own rows (existing
--     profiles_update_own policy is untouched).
--   • Ensure vendor_status, is_suspended, suspension_* columns exist so that
--     admin operations on profiles always find the expected columns.
--   • Block users from setting admin-only columns in their own row update.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Ensure columns used by admin operations exist
--    (These were defined in database/migrations/ but never in supabase/migrations/)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vendor_status       TEXT       DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_suspended        BOOLEAN    DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspension_reason   TEXT,
  ADD COLUMN IF NOT EXISTS suspension_start    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_end      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS violation_count     INTEGER    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_violation_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_status_updated_at TIMESTAMPTZ;

-- vendor_status CHECK constraint (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_schema   = 'public'
      AND tc.table_name     = 'profiles'
      AND tc.constraint_type = 'CHECK'
      AND ccu.column_name   = 'vendor_status'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_vendor_status_check
      CHECK (vendor_status IN ('pending', 'approved', 'rejected', 'suspended'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. admin UPDATE policy — allows admin users to update any profile row
--    Security guarantees:
--      • Only users whose own profile has role='admin' can use this policy.
--        We use current_user_role() (a SECURITY DEFINER function defined in
--        migration 20260527000001) to avoid infinite recursion.
--      • The WITH CHECK ensures the caller remains admin during the operation
--        (prevents an admin from removing their own admin role via UPDATE).
--      • The prevent_role_self_update trigger (20260527000001) still fires and
--        enforces role-change auditing; this policy only unblocks the RLS gate.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING  (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 3. Guard: prevent regular users from writing admin-only fields in their OWN
--    row update.  The profiles_update_own policy already limits which rows a
--    non-admin can touch; this trigger enforces column-level restrictions.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_user_admin_field_self_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role unrestricted access (Edge Functions, migrations)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admins can change anything (role changes are still audited by
  -- prevent_role_self_update, which runs in the same transaction)
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  -- Non-admins: block writes to admin-only columns
  IF OLD.is_verified     IS DISTINCT FROM NEW.is_verified     OR
     OLD.vendor_status   IS DISTINCT FROM NEW.vendor_status   OR
     OLD.is_suspended    IS DISTINCT FROM NEW.is_suspended     OR
     OLD.suspension_reason IS DISTINCT FROM NEW.suspension_reason OR
     OLD.suspension_start  IS DISTINCT FROM NEW.suspension_start  OR
     OLD.suspension_end    IS DISTINCT FROM NEW.suspension_end    OR
     OLD.violation_count   IS DISTINCT FROM NEW.violation_count   OR
     OLD.admin_notes       IS DISTINCT FROM NEW.admin_notes       OR
     OLD.verification_status IS DISTINCT FROM NEW.verification_status
  THEN
    RAISE EXCEPTION 'permission_denied: only admins can modify these profile fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_user_admin_field_self_write ON public.profiles;
CREATE TRIGGER trg_prevent_user_admin_field_self_write
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_admin_field_self_write();

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_status
  ON public.profiles (vendor_status);

CREATE INDEX IF NOT EXISTS idx_profiles_is_suspended
  ON public.profiles (is_suspended)
  WHERE is_suspended = TRUE;

COMMIT;
