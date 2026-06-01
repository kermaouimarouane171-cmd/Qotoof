-- Migration: Fix infinite recursion in profiles RLS policies
-- Problem:  `profiles_select_admin` (created in 20260528000003) calls
--           `current_user_role()`, which runs `SELECT role FROM profiles`.
--           PostgreSQL evaluates all SELECT policies for every row access,
--           so calling current_user_role() from inside a profiles policy
--           triggers the same policies again → infinite recursion (code 42P17).
-- Fix:      1. Add `SET row_security = off` to current_user_role() so it
--              bypasses RLS when it queries profiles — eliminating the cycle.
--           2. Drop and recreate `profiles_select_admin` using JWT metadata
--              as a belt-and-suspenders fallback that requires zero table access.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1.  Patch current_user_role() to always bypass RLS when it runs.
--     `SET row_security = off` forces the function's inner query to skip
--     row-security checks regardless of the calling role or environment.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off          -- ← prevents infinite recursion
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Re-grant in case the REPLACE changed ownership in some Supabase versions
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2.  Recreate profiles_select_admin using JWT metadata as primary check.
--     JWT app_metadata is set by the role-sync Edge Function on every
--     role change, so this is always fresh and requires zero table access.
--     current_user_role() is kept as a fallback for rows where JWT hasn't
--     been synced yet (e.g., immediately after first admin promotion).
--     Now that current_user_role() has row_security=off, the fallback path
--     is also safe.
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;

CREATE POLICY "profiles_select_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Fast path: check JWT metadata (no table query, no recursion risk)
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    -- Fallback: DB lookup via patched SECURITY DEFINER function (safe now)
    public.current_user_role() = 'admin'
  );

COMMIT;
