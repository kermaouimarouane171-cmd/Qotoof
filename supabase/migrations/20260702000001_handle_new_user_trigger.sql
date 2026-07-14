-- ==========================================================================
-- Migration: Add handle_new_user() trigger to auto-create profile on signup
-- Problem:  The RLS policy "profiles_insert_service_role" (migration
--           20260527000001) only allows service_role to INSERT into profiles.
--           The handle_new_user() trigger existed only in database/migrations/
--           (legacy) but NOT in supabase/migrations/.  Without this trigger,
--           no profile row is created when a new auth user signs up, causing
--           "Profile could not be loaded" errors after OTP verification.
-- Solution: Create a SECURITY DEFINER trigger function that fires on
--           auth.users INSERT and creates a matching profile row from
--           raw_user_meta_data.  This bypasses RLS because the trigger
--           runs with definer privileges (postgres).
-- ==========================================================================

BEGIN;

-- ── 1. Trigger function ────────────────────────────────────────────────────
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
  -- Extract metadata from the new auth user
  v_role       := COALESCE(NEW.raw_user_meta_data->>'role', 'buyer');
  v_first_name := NEW.raw_user_meta_data->>'first_name';
  v_last_name  := NEW.raw_user_meta_data->>'last_name';
  v_phone      := NEW.raw_user_meta_data->>'phone';
  v_cin        := NEW.raw_user_meta_data->>'cin';

  -- Insert the profile row (bypasses RLS because SECURITY DEFINER)
  INSERT INTO public.profiles (id, email, first_name, last_name, role, phone, cin)
  VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    v_role,
    v_phone,
    v_cin
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── 2. Grant execute (trigger fires automatically) ─────────────────────────
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- ── 3. Create the trigger on auth.users ────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;
