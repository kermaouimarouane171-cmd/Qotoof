-- =====================================================
-- UPDATE handle_new_user() TO PERSIST city + store_name
-- =====================================================
-- Problem: The handle_new_user() trigger reads role, first_name,
-- last_name, phone, cin from raw_user_meta_data but does NOT read
-- city or store_name. These fields are sent in signUpOptions.data
-- from authActionsService.js but never reach the profiles table
-- via the trigger.
--
-- The fallback upsert in authActionsService.js (after signUp) fails
-- silently when email confirmation is enabled because there is no
-- session (auth.uid() is NULL) and RLS policy profiles_update_own
-- requires id = auth.uid(). This means city and store_name entered
-- during registration are LOST for every new vendor/buyer.
--
-- Fix: Read city and store_name from raw_user_meta_data in the
-- trigger and persist them to profiles directly (SECURITY DEFINER
-- bypasses RLS).
--
-- Verification: after applying, the live function definition must
-- contain both 'city' and 'store_name' in the INSERT statement.
-- =====================================================

-- Step 1: Recreate the function with city + store_name support
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
  v_city       TEXT;
  v_store_name TEXT;
BEGIN
  v_role       := COALESCE(NEW.raw_user_meta_data->>'role', 'buyer');
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  v_last_name  := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  v_phone      := NEW.raw_user_meta_data->>'phone';
  v_cin        := NEW.raw_user_meta_data->>'cin';
  v_city       := NEW.raw_user_meta_data->>'city';
  v_store_name := NEW.raw_user_meta_data->>'store_name';

  -- Explicitly set onboarding_completed = FALSE and onboarding_step = 0
  -- so new users are correctly routed to the onboarding flow.
  -- ON CONFLICT DO UPDATE preserves existing data for re-signups.
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    role,
    phone,
    cin,
    cin_number,
    city,
    store_name,
    onboarding_completed,
    onboarding_step
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_first_name,
    v_last_name,
    v_role::user_role,
    v_phone,
    v_cin,
    v_cin,
    v_city,
    v_store_name,
    FALSE,
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    cin = COALESCE(EXCLUDED.cin, profiles.cin),
    cin_number = COALESCE(EXCLUDED.cin_number, profiles.cin_number),
    city = COALESCE(NULLIF(EXCLUDED.city, ''), profiles.city),
    store_name = COALESCE(NULLIF(EXCLUDED.store_name, ''), profiles.store_name),
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), profiles.last_name);

  RETURN NEW;
END;
$$;

-- Step 2: Ensure permissions are correct
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Step 3: Recreate the trigger (DROP + CREATE to pick up new function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Verification — check the function definition contains
-- both city and store_name
DO $$
DECLARE
  func_def TEXT;
BEGIN
  SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure) INTO func_def;

  IF func_def NOT LIKE '%v_city%' THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: handle_new_user() does not read city';
  END IF;

  IF func_def NOT LIKE '%v_store_name%' THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: handle_new_user() does not read store_name';
  END IF;

  RAISE NOTICE 'VERIFICATION PASSED: handle_new_user() reads both city and store_name from raw_user_meta_data';
END $$;
