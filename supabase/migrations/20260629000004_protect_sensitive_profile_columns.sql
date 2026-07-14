-- Migration: Protect sensitive profile columns from client-side manipulation
-- CVE Class: OWASP A01:2021 – Broken Access Control (Privilege Escalation)
--
-- VULNERABILITY: The RLS policy "profiles_update_own" allows users to UPDATE any
-- column on their own profile row. The only protection is the trigger
-- prevent_role_self_update which blocks changes to the `role` column.
-- However, a user can directly set:
--   - is_approved = true       → self-approve vendor account (bypass admin review)
--   - is_verified = true       → self-verify their account (bypass verification)
--   - is_suspended = false     → unsuspend themselves (bypass admin moderation)
--   - suspension_reason = NULL → clear moderation evidence
--   - suspension_end = NULL    → remove suspension end date
--   - violation_count = 0      → clear violation history
--   - approved_by = <someone>  → fake admin approval attribution
--   - approved_at = <date>     → fake approval timestamp
--
-- FIX: Add a BEFORE UPDATE trigger that blocks changes to admin-controlled
-- columns by non-service-role callers. Admins can still modify these via
-- RPCs (suspend_user, ban_user_permanently) which run as SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.prevent_sensitive_profile_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow postgres and service_role (used by admin RPCs and Edge Functions)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block changes to admin-controlled columns by regular users
  IF (NEW.is_approved        IS DISTINCT FROM OLD.is_approved)
  OR (NEW.is_verified        IS DISTINCT FROM OLD.is_verified)
  OR (NEW.is_suspended       IS DISTINCT FROM OLD.is_suspended)
  OR (NEW.suspension_reason  IS DISTINCT FROM OLD.suspension_reason)
  OR (NEW.suspension_start   IS DISTINCT FROM OLD.suspension_start)
  OR (NEW.suspension_end     IS DISTINCT FROM OLD.suspension_end)
  OR (NEW.violation_count    IS DISTINCT FROM OLD.violation_count)
  OR (NEW.last_violation_at  IS DISTINCT FROM OLD.last_violation_at)
  OR (NEW.approved_by        IS DISTINCT FROM OLD.approved_by)
  OR (NEW.approved_at        IS DISTINCT FROM OLD.approved_at)
  THEN
    RAISE EXCEPTION
      'Direct modification of admin-controlled profile fields is not permitted. '
      'These fields can only be changed by an admin or through server-side functions.'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  RETURN NEW;
END;
$$;

-- Apply the trigger
DROP TRIGGER IF EXISTS trg_prevent_sensitive_profile_self_update ON public.profiles;

CREATE TRIGGER trg_prevent_sensitive_profile_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_sensitive_profile_self_update();

-- Grant execute only to service_role (trigger fires automatically)
REVOKE ALL ON FUNCTION public.prevent_sensitive_profile_self_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_sensitive_profile_self_update() TO service_role;
