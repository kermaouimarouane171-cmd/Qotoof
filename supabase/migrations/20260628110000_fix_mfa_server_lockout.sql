-- Migration: Server-side MFA lockout enforcement
-- Prevents bypassing MFA lockout by clearing sessionStorage/localStorage.
-- Adds a structured verify_mfa_code RPC that tracks failed_attempts and locked_until
-- in mfa_settings and logs MFA audit events from the database.

CREATE OR REPLACE FUNCTION verify_mfa_code(
    p_user_id UUID,
    p_code TEXT,
    p_method TEXT DEFAULT 'email'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings RECORD;
    v_max_attempts INTEGER := 5;
    v_lockout_minutes INTEGER := 15;
    v_otp_valid BOOLEAN;
    v_failed_attempts INTEGER;
    v_locked_until TIMESTAMPTZ;
    v_retry_after INTEGER;
    v_attempts_remaining INTEGER;
BEGIN
    -- Ensure an mfa_settings row exists for this user.
    SELECT * INTO v_settings
    FROM mfa_settings
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        INSERT INTO mfa_settings (user_id, is_enabled, method, failed_attempts, locked_until)
        VALUES (p_user_id, false, p_method, 0, NULL)
        RETURNING * INTO v_settings;
    END IF;

    -- Enforce user-level lockout. This is independent of any client state.
    IF v_settings.locked_until IS NOT NULL AND v_settings.locked_until > NOW() THEN
        v_retry_after := GREATEST(EXTRACT(EPOCH FROM (v_settings.locked_until - NOW()))::INTEGER, 0);

        PERFORM log_audit(
            p_user_id, 'MFA_VERIFY_LOCKED', 'mfa', p_user_id,
            jsonb_build_object('locked_until', v_settings.locked_until, 'method', p_method),
            NULL, NULL, NULL, NULL, NULL, NULL
        );

        RETURN jsonb_build_object(
            'success', false,
            'locked', true,
            'locked_until', v_settings.locked_until,
            'retry_after', v_retry_after,
            'attempts_remaining', 0,
            'error', 'Too many attempts. Account locked. Please try again later.'
        );
    END IF;

    -- Validate the MFA code. Currently email OTP is supported via verify_otp.
    IF p_method = 'email' THEN
        v_otp_valid := verify_otp(p_user_id, p_code, 'mfa_verify');
    ELSE
        -- TOTP verification requires a server-side TOTP validator (planned in a separate migration/Edge Function).
        RETURN jsonb_build_object(
            'success', false,
            'locked', false,
            'attempts_remaining', GREATEST(v_max_attempts - COALESCE(v_settings.failed_attempts, 0), 0),
            'error', 'TOTP verification is not implemented'
        );
    END IF;

    IF v_otp_valid THEN
        -- Reset failed attempts and lockout on success.
        UPDATE mfa_settings
        SET failed_attempts = 0,
            locked_until = NULL,
            last_used_at = NOW()
        WHERE user_id = p_user_id;

        PERFORM log_audit(
            p_user_id, 'MFA_VERIFIED', 'mfa', p_user_id,
            NULL, jsonb_build_object('method', p_method), NULL, NULL, NULL, NULL, NULL
        );

        RETURN jsonb_build_object(
            'success', true,
            'locked', false,
            'attempts_remaining', v_max_attempts
        );
    END IF;

    -- Failed attempt: increment user-level counter and lock if threshold reached.
    UPDATE mfa_settings
    SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
        locked_until = CASE
            WHEN COALESCE(failed_attempts, 0) + 1 >= v_max_attempts THEN NOW() + (v_lockout_minutes || ' minutes')::INTERVAL
            ELSE NULL
        END
    WHERE user_id = p_user_id
    RETURNING failed_attempts, locked_until INTO v_failed_attempts, v_locked_until;

    v_retry_after := CASE
        WHEN v_locked_until IS NOT NULL THEN GREATEST(EXTRACT(EPOCH FROM (v_locked_until - NOW()))::INTEGER, 0)
        ELSE 0
    END;

    v_attempts_remaining := GREATEST(v_max_attempts - v_failed_attempts, 0);

    PERFORM log_audit(
        p_user_id, 'MFA_VERIFY_FAILED', 'mfa', p_user_id,
        jsonb_build_object('failed_attempts', v_failed_attempts, 'locked_until', v_locked_until, 'method', p_method),
        NULL, NULL, NULL, NULL, NULL, NULL
    );

    RETURN jsonb_build_object(
        'success', false,
        'locked', v_locked_until IS NOT NULL,
        'locked_until', v_locked_until,
        'retry_after', v_retry_after,
        'attempts_remaining', v_attempts_remaining,
        'error', CASE WHEN v_locked_until IS NOT NULL THEN 'Too many attempts. Account locked. Please try again later.' ELSE 'Invalid or expired code' END
    );
END;
$$;
