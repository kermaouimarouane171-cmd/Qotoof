-- Migration: Harden otp_codes RLS to prevent OTP forgery and lockout bypass
-- CVE Class: OWASP A01:2021 – Broken Access Control
--
-- VULNERABILITY 1: "System can insert OTP codes" uses WITH CHECK (true) with no
-- role restriction, allowing any role (including anon) to insert OTP codes with
-- arbitrary user_id, code, and purpose. This allows:
--   a) Forging OTPs for other users and injecting known codes before verification.
--   b) Flooding the table with garbage entries.
--
-- VULNERABILITY 2: "Users can update own OTP" allows any authenticated user to
-- directly UPDATE their own otp_codes row and set:
--   - attempts = 0      → reset attempt counter (bypass per-OTP lockout)
--   - locked_until = NULL → unlock themselves
--   - used = false      → reuse an already-consumed OTP
-- This completely bypasses the server-side OTP rate limiting in verify-phone-otp
-- and the verify_mfa_code RPC.
--
-- FIX:
--   1. Restrict INSERT to service_role only (OTPs are always generated server-side).
--   2. Remove the authenticated user UPDATE policy entirely.
--   3. Confirm service_role full access exists.

-- ── 1. Drop vulnerable policies ───────────────────────────────────────────────
DROP POLICY IF EXISTS "System can insert OTP codes" ON otp_codes;
DROP POLICY IF EXISTS "Users can update own OTP"    ON otp_codes;

-- ── 2. Ensure service_role has full access (idempotent) ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'otp_codes'
      AND policyname = 'Service role full access on otp_codes'
  ) THEN
    CREATE POLICY "Service role full access on otp_codes"
      ON otp_codes
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- ── 3. Users may still SELECT their own OTP (to check status in UI) ──────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'otp_codes'
      AND policyname = 'Users can view own OTP'
  ) THEN
    CREATE POLICY "Users can view own OTP"
      ON otp_codes FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END;
$$;

-- ── 4. Verification: no authenticated/anon INSERT or UPDATE policy remains ────
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'otp_codes'
    AND grantee IN ('authenticated', 'anon', 'public')
    AND (cmd = 'INSERT' OR cmd = 'UPDATE' OR cmd = 'ALL');

  IF v_count > 0 THEN
    RAISE EXCEPTION 'SECURITY: otp_codes still has non-service_role INSERT/UPDATE/ALL policies. OTP forgery possible!';
  END IF;
END;
$$;
