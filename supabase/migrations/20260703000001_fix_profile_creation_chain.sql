-- ==========================================================================
-- Migration: Fix profile creation chain (ensure_profile RPC + RLS + trigger)
--
-- Root causes:
--   1. ensure_profile() reads first_name/last_name from user_metadata.
--      If metadata is missing these fields, the values are NULL.
--      But profiles.first_name and profiles.last_name are NOT NULL → 400.
--   2. handle_new_user() trigger has the same NULL issue.
--   3. RLS INSERT policy only allows service_role → authenticated users
--      cannot self-heal via direct INSERT → 403.
--   4. active_sessions and notification_preferences have FK to profiles(id).
--      If profile creation fails, these inserts fail with 409 FK violation.
--
-- Fixes:
--   A. Fix ensure_profile() to COALESce NOT NULL columns to ''
--   B. Fix handle_new_user() trigger to COALESce NOT NULL columns to ''
--   C. Add RLS INSERT policy for authenticated users (self-insert only)
--   D. Add onboarding_completed to both INSERT statements
-- ==========================================================================

BEGIN;

-- ── A. Fix ensure_profile() RPC ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_meta       JSONB;
  v_role       TEXT;
  v_first_name TEXT;
  v_last_name  TEXT;
  v_phone      TEXT;
  v_cin        TEXT;
  v_email      TEXT;
  v_existing   public.profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'ensure_profile: no authenticated user';
  END IF;

  -- Check if profile already exists
  SELECT * INTO v_existing FROM public.profiles WHERE id = v_user_id;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  -- Read metadata from auth.users
  SELECT raw_user_meta_data INTO v_meta FROM auth.users WHERE id = v_user_id;
  IF v_meta IS NULL THEN
    v_meta := '{}'::jsonb;
  END IF;

  v_role       := COALESCE(v_meta->>'role', 'buyer');
  v_first_name := COALESCE(v_meta->>'first_name', '');
  v_last_name  := COALESCE(v_meta->>'last_name', '');
  v_phone      := v_meta->>'phone';
  v_cin        := v_meta->>'cin';

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  v_email := COALESCE(v_email, '');

  -- Insert the missing profile row with safe defaults for NOT NULL columns
  -- Cast v_role::user_role because v_role is TEXT but profiles.role is user_role enum
  INSERT INTO public.profiles (id, first_name, last_name, email, role, phone, cin, onboarding_completed)
  VALUES (
    v_user_id,
    v_first_name,
    v_last_name,
    v_email,
    v_role::user_role,
    v_phone,
    v_cin,
    FALSE
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_existing;

  RETURN v_existing;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;

-- ── B. Fix handle_new_user() trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role       TEXT;
  v_first_name TEXT;
  v_last_name  TEXT;
  v_phone      TEXT;
  v_cin        TEXT;
BEGIN
  v_role       := COALESCE(NEW.raw_user_meta_data->>'role', 'buyer');
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  v_last_name  := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  v_phone      := NEW.raw_user_meta_data->>'phone';
  v_cin        := NEW.raw_user_meta_data->>'cin';

  -- Cast v_role::user_role because v_role is TEXT but profiles.role is user_role enum
  INSERT INTO public.profiles (id, email, first_name, last_name, role, phone, cin, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_first_name,
    v_last_name,
    v_role::user_role,
    v_phone,
    v_cin,
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Re-create the trigger (DROP + CREATE to ensure it picks up the new function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── C. Add RLS INSERT policy for authenticated users (self-insert only) ────
-- This allows the frontend self-heal fallback (direct INSERT) to work
-- when the ensure_profile RPC also fails.
DROP POLICY IF EXISTS "profiles_insert_authenticated_self" ON public.profiles;
CREATE POLICY "profiles_insert_authenticated_self"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

COMMIT;
