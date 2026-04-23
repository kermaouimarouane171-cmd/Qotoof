-- =====================================================
-- ENABLE EMAIL CONFIRMATIONS
-- Run this in Supabase SQL Editor
-- =====================================================

-- Note: Email confirmations are primarily controlled 
-- in Supabase Dashboard → Authentication → Settings
-- But we can ensure the trigger handles it properly

-- Update the trigger to work with email confirmations
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

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
    role,
    is_approved
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'role', ''),
      'buyer'
    )::user_role,
    -- Auto-approve buyers and drivers, vendors need approval
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'vendor' THEN false
      ELSE true
    END
  );
  RETURN NEW;
EXCEPTION 
  WHEN OTHERS THEN
    RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS policies allow the trigger to work
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles 
  FOR INSERT WITH CHECK (true);

-- Notify success
DO $$
BEGIN
  RAISE NOTICE '✅ Email confirmation support is ready!';
  RAISE NOTICE '   To enable: Go to Supabase Dashboard → Auth → Settings → Enable email confirmations';
END $$;
