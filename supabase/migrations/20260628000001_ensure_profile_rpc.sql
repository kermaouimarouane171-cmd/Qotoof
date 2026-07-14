-- ==========================================================================
-- Migration: Add ensure_profile RPC for self-healing after OTP verification
-- Problem:  When email confirmation is enabled, signUp() cannot insert into
--           profiles because (a) there is no session yet, and (b) RLS only
--           allows service_role to INSERT.  No trigger exists to create the
--           profile automatically.  After OTP verification the user has a
--           session but the profile row is missing → "Profile could not be
--           loaded" error.
-- Solution: An RPC function that runs as SECURITY DEFINER (bypasses RLS),
--           checks whether a profile exists for auth.uid(), and creates one
--           from user_metadata if it doesn't.  The function only ever
--           touches the calling user's own row.
-- ==========================================================================

BEGIN;

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
  v_existing   public.profiles%ROWTYPE;
BEGIN
  -- Guard: must be called by an authenticated user
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
  v_first_name := v_meta->>'first_name';
  v_last_name  := v_meta->>'last_name';
  v_phone      := v_meta->>'phone';
  v_cin        := v_meta->>'cin';

  -- Insert the missing profile row
  INSERT INTO public.profiles (id, first_name, last_name, email, role, phone, cin)
  VALUES (
    v_user_id,
    v_first_name,
    v_last_name,
    (SELECT email FROM auth.users WHERE id = v_user_id),
    v_role,
    v_phone,
    v_cin
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_existing;

  RETURN v_existing;
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;

COMMIT;
