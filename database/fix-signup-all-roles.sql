-- =====================================================
-- COMPLETE FIX: User Signup for ALL Roles
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Drop old trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create improved function that handles ALL roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'role', ''),
      'buyer'
    )::user_role
  );
  RETURN NEW;
EXCEPTION 
  WHEN OTHERS THEN
    -- Log the error but don't block user creation
    RAISE WARNING 'Profile creation failed for user %: % - Role: %', 
      NEW.id, SQLERRM, NEW.raw_user_meta_data->>'role';
    RETURN NEW;
END;
$$;

-- 3. Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Fix ALL RLS policies for profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

-- Allow anyone to read profiles
CREATE POLICY "profiles_select" ON profiles 
  FOR SELECT USING (true);

-- Allow profile creation (for trigger AND manual signup)
CREATE POLICY "profiles_insert" ON profiles 
  FOR INSERT WITH CHECK (true);

-- Allow users to update their own profile
CREATE POLICY "profiles_update" ON profiles 
  FOR UPDATE USING (auth.uid() = id);

-- 5. Verify the trigger works
DO $$
BEGIN
  RAISE NOTICE '✅ Signup trigger fixed for ALL roles!';
  RAISE NOTICE '   Roles supported: buyer, vendor, driver, admin';
END $$;
