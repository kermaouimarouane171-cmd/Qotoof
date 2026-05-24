-- ============================================
-- COMPLETE RLS FIX - Ready to Paste & Execute
-- ============================================
-- Fixes infinite recursion on profiles table
-- Enables safe, role-based data access
-- Paste this entire script into Supabase SQL Editor
-- then click "Run" (Ctrl+Enter)

-- Step 1: Drop conflicting policies
DROP POLICY IF EXISTS "Users can view own CIN" ON profiles;
DROP POLICY IF EXISTS "Users can update own CIN" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

-- Step 2: Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SAFE POLICIES (No Infinite Recursion)
-- ============================================

-- Policy 1: Users can SELECT their own profile
CREATE POLICY "profiles_select_own" 
  ON profiles FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Service role can SELECT all (for admin operations)
CREATE POLICY "profiles_select_service_role"
  ON profiles FOR SELECT
  TO service_role
  USING (true);

-- Policy 3: Users can UPDATE their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 4: Users can INSERT their own profile (signup)
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy 5: Users can DELETE their own profile
CREATE POLICY "profiles_delete_own"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Policy 6: Service role can access all (admin operations)
CREATE POLICY "profiles_update_service_role"
  ON profiles FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "profiles_insert_service_role"
  ON profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "profiles_delete_service_role"
  ON profiles FOR DELETE
  TO service_role
  USING (true);

-- ============================================
-- VERIFICATION
-- ============================================

-- Check RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'profiles';

-- Check policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  qual
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Expected output for first query:
-- schemaname | tablename | rowsecurity
-- -----------|-----------|-----------
-- public     | profiles  | true

-- If you see rowsecurity = true ✅ RLS IS ENABLED
-- If you see rowsecurity = false ❌ RLS STILL DISABLED (run again)
