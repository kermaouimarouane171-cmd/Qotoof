-- Migration: Harden mfa_settings RLS to prevent lockout bypass
-- CVE Class: OWASP A01:2021 – Broken Access Control
--
-- VULNERABILITY: The original migration 20260414000006_mfa_and_sessions.sql created
-- "Users can update own MFA settings" which allows any authenticated user to directly
-- UPDATE their own mfa_settings row via the Supabase client API.
-- An attacker can reset failed_attempts=0 and locked_until=NULL to bypass server-side
-- MFA lockout enforced by verify_mfa_code RPC and verify-mfa Edge Function.
--
-- FIX: Remove client-level INSERT/UPDATE rights on mfa_settings.
-- All writes to mfa_settings must go through SECURITY DEFINER RPCs or Edge Functions
-- that use the service_role key.
-- Users retain SELECT access to read their own MFA status.

-- 1. Drop vulnerable write policies for authenticated users
DROP POLICY IF EXISTS "Users can update own MFA settings" ON mfa_settings;
DROP POLICY IF EXISTS "Users can insert own MFA settings" ON mfa_settings;

-- 2. Confirm service_role full-access policy exists (idempotent guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mfa_settings'
      AND policyname = 'Service role full access on mfa_settings'
  ) THEN
    CREATE POLICY "Service role full access on mfa_settings"
      ON mfa_settings
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- 3. Confirm users can still SELECT their own MFA status (needed for UI)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mfa_settings'
      AND policyname = 'Users can view own MFA settings'
  ) THEN
    CREATE POLICY "Users can view own MFA settings"
      ON mfa_settings FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

-- 4. Verify: No authenticated-user INSERT or UPDATE policy should remain.
--    The following statement will raise an error if such a policy still exists.
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'mfa_settings'
    AND grantee = 'authenticated'
    AND (cmd = 'INSERT' OR cmd = 'UPDATE');

  IF v_count > 0 THEN
    RAISE EXCEPTION 'SECURITY: mfa_settings still has authenticated INSERT/UPDATE policies. Lockout bypass possible!';
  END IF;
END;
$$;
