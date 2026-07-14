-- Migration: Implement generate_otp and verify_otp for email MFA
-- These functions were stubs and did not store or verify OTP codes.
-- This migration uses the existing otp_codes table for MFA email verification.

-- =============================================================================
-- generate_otp
-- Generates a 6-digit OTP, stores it in otp_codes, and returns it.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_otp(
  p_user_id uuid,
  p_purpose text DEFAULT 'mfa'::text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Invalidate any existing unused codes for this user/purpose
  UPDATE public.otp_codes
  SET used = true
  WHERE user_id = p_user_id
    AND purpose = p_purpose
    AND used = false;

  -- Generate a 6-digit code
  v_code := LPAD(FLOOR(100000 + RANDOM() * 899999)::TEXT, 6, '0');
  v_expires_at := NOW() + INTERVAL '10 minutes';

  -- Insert the new code
  INSERT INTO public.otp_codes (
    user_id,
    code,
    purpose,
    expires_at,
    used,
    attempts,
    max_attempts,
    created_at
  )
  VALUES (
    p_user_id,
    v_code,
    p_purpose,
    v_expires_at,
    false,
    0,
    5,
    NOW()
  );

  RETURN v_code;
END;
$$;

-- =============================================================================
-- verify_otp
-- Verifies an OTP stored in otp_codes. Returns true if valid and not expired.
-- Marks the code as used on success. Prevents brute force via max attempts.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.verify_otp(
  p_user_id uuid,
  p_code text,
  p_purpose text DEFAULT 'mfa'::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record public.otp_codes%ROWTYPE;
  v_attempts INTEGER;
  v_locked_until TIMESTAMPTZ;
BEGIN
  -- Find the most recent unused code for this user/purpose
  SELECT *
  INTO v_record
  FROM public.otp_codes
  WHERE user_id = p_user_id
    AND purpose = p_purpose
    AND used = false
  ORDER BY created_at DESC
  LIMIT 1;

  -- No valid code found
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check lockout
  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > NOW() THEN
    RETURN false;
  END IF;

  -- Check expiration
  IF v_record.expires_at < NOW() THEN
    -- Mark expired code as used so it cannot be brute forced
    UPDATE public.otp_codes
    SET used = true
    WHERE id = v_record.id;
    RETURN false;
  END IF;

  -- Increment attempts
  v_attempts := COALESCE(v_record.attempts, 0) + 1;

  -- If max attempts exceeded, lock and fail
  IF v_attempts >= COALESCE(v_record.max_attempts, 5) THEN
    v_locked_until := NOW() + INTERVAL '15 minutes';
    UPDATE public.otp_codes
    SET
      attempts = v_attempts,
      locked_until = v_locked_until
    WHERE id = v_record.id;
    RETURN false;
  END IF;

  -- Code mismatch: update attempts and fail
  IF v_record.code != p_code THEN
    UPDATE public.otp_codes
    SET attempts = v_attempts
    WHERE id = v_record.id;
    RETURN false;
  END IF;

  -- Success: mark as used
  UPDATE public.otp_codes
  SET
    used = true,
    used_at = NOW(),
    attempts = v_attempts
  WHERE id = v_record.id;

  RETURN true;
END;
$$;
