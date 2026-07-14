-- ==========================================================================
-- Migration: Create missing security_alerts and blocked_ips tables
--
-- These tables were originally defined in database/migrations/008b-add-security-
-- alerts-and-ip-blocking.sql but were never ported to supabase/migrations/,
-- causing 400/404 errors in production.
-- ==========================================================================

BEGIN;

-- ============================================
-- 1. SECURITY ALERTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.security_alerts (
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
        'suspicious_negotiation',
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

CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON public.security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON public.security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved ON public.security_alerts(is_resolved) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON public.security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_ip ON public.security_alerts(source_ip);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON public.security_alerts(user_id);

-- RLS for security_alerts
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view security alerts" ON public.security_alerts;
CREATE POLICY "Admins can view security alerts"
    ON public.security_alerts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can insert security alerts" ON public.security_alerts;
CREATE POLICY "Admins can insert security alerts"
    ON public.security_alerts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can update security alerts" ON public.security_alerts;
CREATE POLICY "Admins can update security alerts"
    ON public.security_alerts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Note: Inserts into security_alerts are done via SECURITY DEFINER RPCs
-- (e.g. create_security_alert) so no open INSERT policy is needed.

-- ============================================
-- 2. BLOCKED IPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.blocked_ips (
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

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON public.blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_active ON public.blocked_ips(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires ON public.blocked_ips(expires_at) WHERE expires_at IS NOT NULL;

-- RLS for blocked_ips
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view blocked IPs" ON public.blocked_ips;
CREATE POLICY "Admins can view blocked IPs"
    ON public.blocked_ips FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can block IPs" ON public.blocked_ips;
CREATE POLICY "Admins can block IPs"
    ON public.blocked_ips FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can update blocked IPs" ON public.blocked_ips;
CREATE POLICY "Admins can update blocked IPs"
    ON public.blocked_ips FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can unblock IPs" ON public.blocked_ips;
CREATE POLICY "Admins can unblock IPs"
    ON public.blocked_ips FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger for updated_at on blocked_ips
DROP TRIGGER IF EXISTS update_blocked_ips_updated_at ON public.blocked_ips;
CREATE TRIGGER update_blocked_ips_updated_at
    BEFORE UPDATE ON public.blocked_ips
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip INET)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_blocked RECORD;
BEGIN
    SELECT * INTO v_blocked
    FROM public.blocked_ips
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

CREATE OR REPLACE FUNCTION public.cleanup_expired_ip_blocks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.blocked_ips
    SET is_active = false, updated_at = NOW()
    WHERE is_active = true
      AND expires_at IS NOT NULL
      AND expires_at <= NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================
-- 4. GRANTS
-- ============================================
GRANT ALL ON public.security_alerts TO postgres;
GRANT ALL ON public.blocked_ips TO postgres;
GRANT SELECT, INSERT, UPDATE ON public.security_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_ips TO authenticated;

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
