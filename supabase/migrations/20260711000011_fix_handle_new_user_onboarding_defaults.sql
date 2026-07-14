-- =====================================================
-- FIX handle_new_user() TO SET ONBOARDING DEFAULTS
-- =====================================================
-- Problem: The live handle_new_user() trigger function
-- (created by 20260702000001, supposed to be updated by
-- 20260703000001) does NOT set onboarding_completed or
-- onboarding_step explicitly. The DB column defaults
-- (false / 0) currently mask this, but relying on DB
-- defaults is fragile:
--   - If someone changes the column default, new users break
--   - If the INSERT ever specifies these columns as NULL,
--     the default is bypassed and the user gets NULL
--
-- This migration makes the values EXPLICIT in the trigger
-- function, matching the onboarding flow's expectations:
--   onboarding_completed = FALSE  (user hasn't onboarded yet)
--   onboarding_step = 0           (starting step)
--
-- Verification: after applying, the live function definition
-- must contain both column names in the INSERT statement.
-- =====================================================

-- Step 1: Recreate the function with explicit onboarding defaults
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
    FALSE,
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    cin = COALESCE(EXCLUDED.cin, profiles.cin),
    cin_number = COALESCE(EXCLUDED.cin_number, profiles.cin_number),
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
-- both onboarding columns
DO $$
DECLARE
  func_def TEXT;
BEGIN
  SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure) INTO func_def;

  IF func_def NOT LIKE '%onboarding_completed%' THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: handle_new_user() does not set onboarding_completed';
  END IF;

  IF func_def NOT LIKE '%onboarding_step%' THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: handle_new_user() does not set onboarding_step';
  END IF;

  RAISE NOTICE 'VERIFICATION PASSED: handle_new_user() sets both onboarding_completed and onboarding_step';
END $$;
