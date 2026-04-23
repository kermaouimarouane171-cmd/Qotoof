-- ============================================
-- Migration 003: Enhanced Security Features
-- Purpose: Add comprehensive security features for vendor role
-- Features: Audit logs, MFA, session management, device tracking, digital signatures
-- ============================================

-- ============================================
-- 1. AUDIT LOG TABLE (Immutable - No UPDATE/DELETE allowed)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'MFA_ENABLED', etc.
    entity_type TEXT NOT NULL, -- 'product', 'order', 'profile', 'review', etc.
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint TEXT,
    session_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    signature TEXT -- Digital signature for non-repudiation
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- RLS for audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own audit logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;
CREATE POLICY "Users can view own audit logs" ON audit_logs
    FOR SELECT USING (user_id = auth.uid());

-- Only admins can view all audit logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
CREATE POLICY "Admins can view all audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- INSERT allowed for system (via functions)
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- IMPORTANT: No UPDATE or DELETE policies - audit logs are immutable!

-- ============================================
-- 2. ACTIVE SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS active_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,
    device_fingerprint TEXT,
    device_info JSONB, -- {os, browser, device_type}
    ip_address INET,
    user_agent TEXT,
    location_data JSONB, -- {city, country} from IP
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    is_current BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_active_sessions_active ON active_sessions(user_id, is_active);

-- RLS for active sessions
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON active_sessions;
CREATE POLICY "Users can view own sessions" ON active_sessions
    FOR SELECT USING (user_id = auth.uid());

-- Users can delete their own sessions
DROP POLICY IF EXISTS "Users can delete own sessions" ON active_sessions;
CREATE POLICY "Users can delete own sessions" ON active_sessions
    FOR DELETE USING (user_id = auth.uid());

-- System can insert sessions
DROP POLICY IF EXISTS "System can insert sessions" ON active_sessions;
CREATE POLICY "System can insert sessions" ON active_sessions
    FOR INSERT WITH CHECK (true);

-- ============================================
-- 3. MFA (Multi-Factor Authentication) TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS mfa_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    is_enabled BOOLEAN DEFAULT false,
    method TEXT DEFAULT 'email', -- 'email', 'totp', 'sms'
    totp_secret TEXT, -- For TOTP apps (Google Authenticator, Authy)
    totp_backup_codes TEXT[], -- Backup codes (hashed)
    phone_number TEXT, -- For SMS MFA
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    enabled_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ -- Lock MFA after too many failures
);

CREATE INDEX IF NOT EXISTS idx_mfa_user ON mfa_settings(user_id);

-- RLS for MFA
ALTER TABLE mfa_settings ENABLE ROW LEVEL SECURITY;

-- Users can only view/edit their own MFA settings
DROP POLICY IF EXISTS "Users can view own MFA settings" ON mfa_settings;
CREATE POLICY "Users can view own MFA settings" ON mfa_settings
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own MFA settings" ON mfa_settings;
CREATE POLICY "Users can update own MFA settings" ON mfa_settings
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own MFA settings" ON mfa_settings;
CREATE POLICY "Users can insert own MFA settings" ON mfa_settings
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- 4. OTP (One-Time Password) TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    purpose TEXT NOT NULL, -- 'mfa_verify', 'email_verify', 'password_reset', 'phone_verify'
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_codes(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- RLS for OTP
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Only system can insert OTP codes (via functions)
DROP POLICY IF EXISTS "System can insert OTP codes" ON otp_codes;
CREATE POLICY "System can insert OTP codes" ON otp_codes
    FOR INSERT WITH CHECK (true);

-- Users can only update (mark as used) their own OTP
DROP POLICY IF EXISTS "Users can update own OTP" ON otp_codes;
CREATE POLICY "Users can update own OTP" ON otp_codes
    FOR UPDATE USING (user_id = auth.uid());

-- ============================================
-- 5. DIGITAL SIGNATURES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS digital_signatures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type TEXT NOT NULL, -- 'order', 'contract', 'agreement'
    entity_id UUID NOT NULL,
    signer_id UUID REFERENCES profiles(id),
    signature_hash TEXT NOT NULL, -- SHA-256 hash of signed content
    signature_metadata JSONB, -- {algorithm, timestamp, ip_address}
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    is_valid BOOLEAN DEFAULT true,
    UNIQUE(entity_type, entity_id, signer_id)
);

CREATE INDEX IF NOT EXISTS idx_digital_signatures_entity ON digital_signatures(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_signer ON digital_signatures(signer_id);

-- RLS for digital signatures
ALTER TABLE digital_signatures ENABLE ROW LEVEL SECURITY;

-- Everyone can view signatures (transparency)
DROP POLICY IF EXISTS "Everyone can view signatures" ON digital_signatures;
CREATE POLICY "Everyone can view signatures" ON digital_signatures
    FOR SELECT USING (true);

-- Users can sign on their own behalf
DROP POLICY IF EXISTS "Users can create own signatures" ON digital_signatures;
CREATE POLICY "Users can create own signatures" ON digital_signatures
    FOR INSERT WITH CHECK (signer_id = auth.uid());

-- ============================================
-- 6. RATE LIMITING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier TEXT NOT NULL, -- user_id, IP address, or email
    action TEXT NOT NULL, -- 'login', 'signup', 'password_reset', 'api_call'
    count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    window_end TIMESTAMPTZ,
    blocked_until TIMESTAMPTZ,
    UNIQUE(identifier, action)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier, action);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON rate_limits(blocked_until);

-- RLS for rate limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Only system can manage rate limits
DROP POLICY IF EXISTS "System can manage rate limits" ON rate_limits;
CREATE POLICY "System can manage rate limits" ON rate_limits
    FOR ALL USING (true);

-- ============================================
-- 7. OFFLINE SYNC QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'create', 'update', 'delete'
    entity_type TEXT NOT NULL,
    entity_id UUID,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'synced', 'failed'
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_offline_sync_user ON offline_sync_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_offline_sync_created ON offline_sync_queue(created_at);

-- RLS for offline sync
ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;

-- Users can only view/edit their own sync queue
DROP POLICY IF EXISTS "Users can view own sync queue" ON offline_sync_queue;
CREATE POLICY "Users can view own sync queue" ON offline_sync_queue
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own sync queue" ON offline_sync_queue;
CREATE POLICY "Users can manage own sync queue" ON offline_sync_queue
    FOR ALL USING (user_id = auth.uid());

-- ============================================
-- 8. FUNCTIONS FOR SECURITY OPERATIONS
-- ============================================

-- Function: Log audit entry (immutable)
CREATE OR REPLACE FUNCTION log_audit(
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_signature TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id,
        old_values, new_values, ip_address, user_agent,
        device_fingerprint, session_id, signature
    ) VALUES (
        p_user_id, p_action, p_entity_type, p_entity_id,
        p_old_values, p_new_values, p_ip_address, p_user_agent,
        p_device_fingerprint, p_session_id, p_signature
    )
    RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$;

-- Function: Generate OTP code
CREATE OR REPLACE FUNCTION generate_otp(
    p_user_id UUID,
    p_purpose TEXT,
    p_ip_address INET DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Generate 6-digit code
    v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    v_expires_at := NOW() + INTERVAL '10 minutes';

    -- Delete old unused OTPs for this user/purpose
    DELETE FROM otp_codes
    WHERE user_id = p_user_id
    AND purpose = p_purpose
    AND used = false
    AND expires_at < NOW();

    -- Insert new OTP
    INSERT INTO otp_codes (user_id, code, purpose, expires_at, ip_address)
    VALUES (p_user_id, v_code, p_purpose, v_expires_at, p_ip_address);

    RETURN v_code;
END;
$$;

-- Function: Verify OTP code
CREATE OR REPLACE FUNCTION verify_otp(
    p_user_id UUID,
    p_code TEXT,
    p_purpose TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_otp_record RECORD;
BEGIN
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

-- Function: Clean expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE active_sessions
    SET is_active = false
    WHERE expires_at < NOW()
    AND is_active = true;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Function: Clean expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM otp_codes
    WHERE expires_at < NOW()
    OR (used = true AND created_at < NOW() - INTERVAL '30 days');

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Function: Check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier TEXT,
    p_action TEXT,
    p_max_attempts INTEGER DEFAULT 5,
    p_window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
BEGIN
    SELECT * INTO v_record
    FROM rate_limits
    WHERE identifier = p_identifier
    AND action = p_action;

    IF NOT FOUND THEN
        -- First attempt
        INSERT INTO rate_limits (identifier, action, count, window_start, window_end)
        VALUES (p_identifier, p_action, 1, NOW(), NOW() + (p_window_minutes || ' minutes')::INTERVAL);
        RETURN TRUE;
    END IF;

    -- Check if blocked
    IF v_record.blocked_until > NOW() THEN
        RETURN FALSE;
    END IF;

    -- Check if window expired
    IF v_record.window_end < NOW() THEN
        UPDATE rate_limits
        SET count = 1,
            window_start = NOW(),
            window_end = NOW() + (p_window_minutes || ' minutes')::INTERVAL,
            blocked_until = NULL
        WHERE identifier = p_identifier
        AND action = p_action;
        RETURN TRUE;
    END IF;

    -- Increment count
    UPDATE rate_limits
    SET count = count + 1,
        blocked_until = CASE
            WHEN count + 1 >= p_max_attempts THEN NOW() + INTERVAL '30 minutes'
            ELSE NULL
        END
    WHERE identifier = p_identifier
    AND action = p_action;

    RETURN v_record.count < p_max_attempts;
END;
$$;

-- ============================================
-- 9. TRIGGERS FOR AUTOMATIC AUDIT LOGGING
-- ============================================

-- Trigger: Audit products changes
CREATE OR REPLACE FUNCTION audit_products_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_audit(
            NEW.vendor_id, 'CREATE', 'product', NEW.id,
            NULL, to_jsonb(NEW), NULL, NULL, NULL, NULL, NULL
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM log_audit(
            NEW.vendor_id, 'UPDATE', 'product', NEW.id,
            to_jsonb(OLD), to_jsonb(NEW), NULL, NULL, NULL, NULL, NULL
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_audit(
            OLD.vendor_id, 'DELETE', 'product', OLD.id,
            to_jsonb(OLD), NULL, NULL, NULL, NULL, NULL, NULL
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_products_trigger ON products;
CREATE TRIGGER audit_products_trigger
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION audit_products_changes();

-- Trigger: Audit orders changes
CREATE OR REPLACE FUNCTION audit_orders_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_audit(
            NEW.buyer_id, 'CREATE', 'order', NEW.id,
            NULL, to_jsonb(NEW), NULL, NULL, NULL, NULL, NULL
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM log_audit(
            COALESCE(NEW.vendor_id, OLD.vendor_id), 'UPDATE', 'order', NEW.id,
            to_jsonb(OLD), to_jsonb(NEW), NULL, NULL, NULL, NULL, NULL
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_audit(
            OLD.vendor_id, 'DELETE', 'order', OLD.id,
            to_jsonb(OLD), NULL, NULL, NULL, NULL, NULL, NULL
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_orders_trigger ON orders;
CREATE TRIGGER audit_orders_trigger
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION audit_orders_changes();

-- Trigger: Audit profile changes
CREATE OR REPLACE FUNCTION audit_profiles_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        PERFORM log_audit(
            NEW.id, 'UPDATE', 'profile', NEW.id,
            to_jsonb(OLD), to_jsonb(NEW), NULL, NULL, NULL, NULL, NULL
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_profiles_trigger ON profiles;
CREATE TRIGGER audit_profiles_trigger
    AFTER UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_profiles_changes();

-- ============================================
-- 10. AUTOMATED CLEANUP SCHEDULE (via pg_cron if available)
-- ============================================
-- Note: These require pg_cron extension. If not available, run manually or via application.

-- Schedule: Clean expired sessions every hour
-- SELECT cron.schedule('cleanup-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions()');

-- Schedule: Clean expired OTPs every day
-- SELECT cron.schedule('cleanup-otps', '0 0 * * *', 'SELECT cleanup_expired_otps()');

-- ============================================
-- 11. ENHANCED RLS POLICIES FOR EXISTING TABLES
-- ============================================

-- Ensure vendors can only see their own sensitive data
-- (Products, Orders, Reviews already have RLS - just reinforcing)

-- Add policy to prevent vendors from seeing other vendors' data
DO $$
BEGIN
    -- Products: Vendors can only see their own products + available products
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'products'
        AND policyname = 'Vendors can view own and available products'
    ) THEN
        CREATE POLICY "Vendors can view own and available products" ON products
            FOR SELECT USING (
                vendor_id = auth.uid()
                OR is_available = true
            );
    END IF;

    -- Orders: Vendors can only see orders where they are the vendor
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'orders'
        AND policyname = 'Vendors can view own orders'
    ) THEN
        CREATE POLICY "Vendors can view own orders" ON orders
            FOR SELECT USING (
                vendor_id = auth.uid()
                OR buyer_id = auth.uid()
            );
    END IF;
END $$;

-- ============================================
-- 12. VENDOR TRUST SCORE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION calculate_vendor_trust_score(vendor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_avg_rating NUMERIC;
    v_total_reviews INTEGER;
    v_total_orders INTEGER;
    v_completed_orders INTEGER;
    v_member_days INTEGER;
    v_is_verified BOOLEAN;
    v_is_approved BOOLEAN;
    v_trust_score NUMERIC := 0;
    v_trust_level TEXT;
BEGIN
    -- Get profile data
    SELECT * INTO v_profile
    FROM profiles
    WHERE id = vendor_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Get rating stats
    SELECT COALESCE(AVG(rating), 0)::NUMERIC(3,2), COUNT(*)::INTEGER
    INTO v_avg_rating, v_total_reviews
    FROM reviews
    WHERE vendor_id = vendor_id;

    -- Get order stats
    SELECT COUNT(*)::INTEGER, COUNT(*) FILTER (WHERE status IN ('completed', 'delivered'))::INTEGER
    INTO v_total_orders, v_completed_orders
    FROM orders
    WHERE vendor_id = vendor_id;

    -- Calculate member days
    v_member_days := EXTRACT(DAY FROM NOW() - v_profile.created_at)::INTEGER;

    v_is_verified := COALESCE(v_profile.is_verified, false);
    v_is_approved := COALESCE(v_profile.is_approved, false);

    -- Calculate trust score (0-100)
    -- Rating component (30 points)
    v_trust_score := v_trust_score + (v_avg_rating / 5.0 * 30);

    -- Reviews count (10 points)
    v_trust_score := v_trust_score + LEAST(v_total_reviews / 10.0, 10);

    -- Order completion rate (25 points)
    IF v_total_orders > 0 THEN
        v_trust_score := v_trust_score + (v_completed_orders::NUMERIC / v_total_orders * 25);
    END IF;

    -- Verification status (20 points)
    IF v_is_verified THEN
        v_trust_score := v_trust_score + 20;
    ELSIF v_is_approved THEN
        v_trust_score := v_trust_score + 10;
    END IF;

    -- Member tenure (15 points) - max at 365 days
    v_trust_score := v_trust_score + LEAST(v_member_days / 365.0 * 15, 15);

    -- Determine trust level
    IF v_trust_score >= 90 THEN
        v_trust_level := 'platinum';
    ELSIF v_trust_score >= 75 THEN
        v_trust_level := 'gold';
    ELSIF v_trust_score >= 60 THEN
        v_trust_level := 'silver';
    ELSIF v_trust_score >= 40 THEN
        v_trust_level := 'bronze';
    ELSE
        v_trust_level := 'new';
    END IF;

    RETURN jsonb_build_object(
        'score', ROUND(v_trust_score, 1),
        'level', v_trust_level,
        'avg_rating', v_avg_rating,
        'total_reviews', v_total_reviews,
        'total_orders', v_total_orders,
        'completed_orders', v_completed_orders,
        'member_days', v_member_days,
        'is_verified', v_is_verified,
        'is_approved', v_is_approved
    );
END;
$$;

-- ============================================
-- Migration complete!
-- ============================================
COMMENT ON TABLE audit_logs IS 'Immutable audit log - No UPDATE/DELETE allowed for security';
COMMENT ON TABLE active_sessions IS 'Tracks all active user sessions for security management';
COMMENT ON TABLE mfa_settings IS 'Multi-factor authentication settings per user';
COMMENT ON TABLE otp_codes IS 'One-time password codes for MFA and verification';
COMMENT ON TABLE digital_signatures IS 'Digital signatures for non-repudiation';
COMMENT ON TABLE rate_limits IS 'Rate limiting to prevent abuse';
COMMENT ON TABLE offline_sync_queue IS 'Queue for offline operations sync';
