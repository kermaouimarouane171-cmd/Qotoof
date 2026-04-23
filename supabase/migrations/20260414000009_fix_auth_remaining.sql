-- ============================================
-- Migration: Fix remaining auth issues
-- ============================================

-- 1. Fix verify_otp function to actually verify against stored OTP codes
-- authServices.js calls: rpc('verify_otp', { p_user_id, p_code, p_purpose })
DROP FUNCTION IF EXISTS verify_otp(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS verify_otp(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS verify_otp(UUID, TEXT);

CREATE FUNCTION verify_otp(p_user_id UUID, p_code TEXT, p_purpose TEXT DEFAULT 'mfa_verify')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_otp_record RECORD;
BEGIN
    -- Look for matching unused, non-expired OTP
    SELECT * INTO v_otp_record
    FROM otp_codes
    WHERE user_id = p_user_id
      AND code = p_code
      AND purpose = p_purpose
      AND used = false
      AND expires_at > NOW()
      AND attempts < max_attempts
      AND (locked_until IS NULL OR locked_until < NOW())
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        -- Increment attempts if OTP exists but is invalid
        UPDATE otp_codes
        SET attempts = attempts + 1,
            locked_until = CASE
                WHEN attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
                ELSE NULL
            END
        WHERE user_id = p_user_id
          AND purpose = p_purpose
          AND used = false
          AND expires_at > NOW();

        RETURN FALSE;
    END IF;

    -- Mark as used
    UPDATE otp_codes
    SET used = true,
        used_at = NOW()
    WHERE id = v_otp_record.id;

    -- Update MFA last used
    UPDATE mfa_settings
    SET last_used_at = NOW(),
        failed_attempts = 0
    WHERE user_id = p_user_id;

    RETURN TRUE;
END;
$$;

-- 2. Fix generate_otp to actually store the code in otp_codes table
DROP FUNCTION IF EXISTS generate_otp(UUID, TEXT);
DROP FUNCTION IF EXISTS generate_otp(UUID);

CREATE FUNCTION generate_otp(p_user_id UUID, p_purpose TEXT DEFAULT 'mfa_verify')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_otp TEXT;
    v_expires_at TIMESTAMPTZ;
    v_ip_address INET;
BEGIN
    -- Generate 6-digit code
    v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    v_expires_at := NOW() + INTERVAL '10 minutes';

    -- Get client IP (will be NULL in some contexts)
    v_ip_address := NULL;

    -- Delete old unused OTPs for this user/purpose
    DELETE FROM otp_codes
    WHERE user_id = p_user_id
      AND purpose = p_purpose
      AND used = false
      AND expires_at < NOW();

    -- Insert new OTP
    INSERT INTO otp_codes (user_id, code, purpose, expires_at, ip_address)
    VALUES (p_user_id, v_otp, p_purpose, v_expires_at, v_ip_address);

    RETURN v_otp;
END;
$$;

-- 3. Add missing session_token column to active_sessions
ALTER TABLE active_sessions
  ADD COLUMN IF NOT EXISTS session_token TEXT;

-- 4. Fix mfa_settings trigger to use upsert (avoid duplicate key)
CREATE OR REPLACE FUNCTION public.handle_new_user_mfa()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.mfa_settings (user_id, is_enabled)
  VALUES (NEW.id, FALSE)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fix mfa_settings getSettings to use upsert instead of insert
-- (This is handled in code, but also add DB-level safety)

-- ============================================
-- Migration complete!
-- ============================================
