-- Migration: Drop legacy recursive policies on profiles
-- Problem:  The old policies "Admins can view all profiles" and
--           "Admins can update any profile" (created by early migrations before
--           20260527000001) were never dropped.  They use direct subqueries into
--           `profiles` from within profiles SELECT/UPDATE policies, causing
--           infinite recursion (42P17) even after the 20260601000001 fix.
--
-- These are superseded by:
--   - profiles_select_admin  (patched in 20260601000001, uses JWT + current_user_role())
--   - profiles_admin_update  (created in 20260528000001, uses current_user_role())
--
-- Also drop "Public profiles are viewable by everyone" (USING true, no role scope)
-- which is superseded by profiles_select_own + profiles_select_active_drivers +
-- profiles_select_order_participant.  Keeping it open was the original workaround
-- for marketplace anon access but the public_profiles SECURITY DEFINER view
-- (created in 20260528000004) is the correct replacement.

BEGIN;

-- Drop the two old recursive policies
DROP POLICY IF EXISTS "Admins can view all profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile"  ON public.profiles;

-- Drop the blanket PUBLIC policy (superseded by public_profiles view for anon
-- and by specific policies for authenticated users)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Drop the old "Users can insert own profile" / "Users can update own profile"
-- which are superseded by profiles_insert_service_role / profiles_update_own
DROP POLICY IF EXISTS "Users can insert own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"   ON public.profiles;

COMMIT;
