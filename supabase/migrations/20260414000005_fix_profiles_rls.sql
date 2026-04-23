-- ============================================
-- Fix infinite recursion in profiles RLS policies
-- ============================================

-- Option 1: Disable RLS on profiles (quick fix)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS enabled, use this instead:
-- First drop the problematic policies, then recreate them safely
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Users can view own CIN" ON profiles;
-- DROP POLICY IF EXISTS "Users can update own CIN" ON profiles;
-- CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
-- CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
