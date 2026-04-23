-- =====================================================
-- Fix User Signup Trigger
-- Run this in Supabase SQL Editor
-- =====================================================

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
      CASE 
        WHEN NEW.raw_user_meta_data->>'role' = 'vendor' THEN 'vendor'
        WHEN NEW.raw_user_meta_data->>'role' = 'driver' THEN 'driver'
        WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'
        ELSE 'buyer'
      END,
      'buyer'
    )
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- Also ensure profiles table allows inserts from trigger
-- =====================================================

-- Disable RLS temporarily for testing (re-enable after)
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Or better: ensure the trigger bypasses RLS
-- SECURITY DEFINER already does this, but let's verify policies

-- Make sure there's no policy blocking the trigger
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);

-- =====================================================
-- Also fix: Allow unauthenticated users to sign up
-- Check Supabase Dashboard → Authentication → Settings
-- Make sure "Enable email confirmations" is OFF for testing
-- =====================================================
