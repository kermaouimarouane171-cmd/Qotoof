-- =====================================================
-- ADD SECURITY ALERTS AND IP BLOCKING TABLES
-- Creates tables for real-time security monitoring
-- and IP-based access control
-- =====================================================

-- ============================================
-- 1. SECURITY ALERTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'brute_force_login',
        'suspicious_login',
        'unauthorized_access',
        'rate_limit_exceeded',
        'sql_injection_attempt',
        'xss_attempt',
        'csrf_violation',
        'account_takeover_attempt',
        'mfa_bypass_attempt',
        'privilege_escalation',
        'data_exfiltration',
        'ip_blocked',
        'ip_unblocked',
        'user_suspended',
        'user_unsuspended',
        'custom'
    )),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT,
    source_ip INET,
    user_id UUID REFERENCES auth.users(id),
    user_agent TEXT,
    request_path TEXT,
    request_method TEXT,
    metadata JSONB DEFAULT '{}',
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved ON security_alerts(is_resolved) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_ip ON security_alerts(source_ip);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON security_alerts(user_id);

-- RLS for security_alerts
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can view all alerts
DROP POLICY IF EXISTS "Admins can view all security alerts" ON security_alerts;
CREATE POLICY "Admins can view all security alerts"
    ON security_alerts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can update alerts (resolve)
DROP POLICY IF EXISTS "Admins can update security alerts" ON security_alerts;
CREATE POLICY "Admins can update security alerts"
    ON security_alerts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- System can insert alerts (via service role)
-- Note: Insert is done via server-side functions with service role

-- ============================================
-- 2. BLOCKED IPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address INET NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    blocked_by UUID REFERENCES auth.users(id),
    block_type TEXT NOT NULL DEFAULT 'manual' CHECK (block_type IN ('manual', 'auto_brute_force', 'auto_rate_limit', 'auto_suspicious')),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_active ON blocked_ips(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires ON blocked_ips(expires_at) WHERE expires_at IS NOT NULL;

-- RLS for blocked_ips
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- Admins can view all blocked IPs
DROP POLICY IF EXISTS "Admins can view blocked IPs" ON blocked_ips;
CREATE POLICY "Admins can view blocked IPs"
    ON blocked_ips FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can insert blocked IPs
DROP POLICY IF EXISTS "Admins can block IPs" ON blocked_ips;
CREATE POLICY "Admins can block IPs"
    ON blocked_ips FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can update blocked IPs
DROP POLICY IF EXISTS "Admins can update blocked IPs" ON blocked_ips;
CREATE POLICY "Admins can update blocked IPs"
    ON blocked_ips FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can delete blocked IPs
DROP POLICY IF EXISTS "Admins can unblock IPs" ON blocked_ips;
CREATE POLICY "Admins can unblock IPs"
    ON blocked_ips FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- 3. FUNCTIONS
-- ============================================

-- Function: Check if IP is blocked
CREATE OR REPLACE FUNCTION is_ip_blocked(p_ip INET)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_blocked RECORD;
BEGIN
    SELECT * INTO v_blocked
    FROM blocked_ips
    WHERE ip_address = p_ip
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1;

    IF FOUND THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- Function: Create security alert
CREATE OR REPLACE FUNCTION create_security_alert(
    p_alert_type TEXT,
    p_severity TEXT,
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_source_ip INET DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_request_path TEXT DEFAULT NULL,
    p_request_method TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_alert_id UUID;
BEGIN
    INSERT INTO security_alerts (
        alert_type, severity, title, description, source_ip,
        user_id, user_agent, request_path, request_method, metadata
    ) VALUES (
        p_alert_type, p_severity, p_title, p_description, p_source_ip,
        p_user_id, p_user_agent, p_request_path, p_request_method, p_metadata
    ) RETURNING id INTO v_alert_id;

    RETURN v_alert_id;
END;
$$;

-- ============================================
-- 4. TRIGGERS FOR REAL-TIME NOTIFICATIONS
-- ============================================

-- Function to notify admins when critical security alerts are created
CREATE OR REPLACE FUNCTION notify_admins_on_security_alert()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify for high/critical alerts
    IF NEW.severity IN ('high', 'critical') AND NOT NEW.is_resolved THEN
        -- Insert notification for all admins
        INSERT INTO notifications (user_id, title, message, type, data)
        SELECT
            p.id,
            CASE NEW.severity
                WHEN 'critical' THEN 'Critical Security Alert'
                ELSE 'High Priority Security Alert'
            END,
            NEW.title || ': ' || COALESCE(NEW.description, ''),
            'security',
            jsonb_build_object(
                'alert_id', NEW.id,
                'alert_type', NEW.alert_type,
                'severity', NEW.severity,
                'source_ip', NEW.source_ip
            )
        FROM profiles p
        WHERE p.role = 'admin';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on security_alerts table
DROP TRIGGER IF EXISTS notify_admins_on_security_alert ON security_alerts;
CREATE TRIGGER notify_admins_on_security_alert
    AFTER INSERT ON security_alerts
    FOR EACH ROW
    EXECUTE FUNCTION notify_admins_on_security_alert();

-- ============================================
-- 5. ENABLE REALTIME FOR TABLES
-- ============================================
-- Note: In Supabase, enable realtime via Dashboard or API:
-- ALTER PUBLICATION supabase_realtime ADD TABLE security_alerts;
-- ALTER PUBLICATION supabase_realtime ADD TABLE blocked_ips;

-- ============================================
-- 6. CLEANUP FUNCTION FOR EXPIRED BLOCKS
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_ip_blocks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE blocked_ips
    SET is_active = false, updated_at = NOW()
    WHERE is_active = true
      AND expires_at IS NOT NULL
      AND expires_at <= NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Schedule cleanup (run via cron or app scheduler)
-- SELECT cleanup_expired_ip_blocks();
