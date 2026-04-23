-- ===================================================================
-- Migration 023: Create Missing Core Tables
-- Purpose: Create 7 essential tables for security, MFA, and data sync
-- Tables: audit_logs, mfa_settings, active_sessions, digital_signatures,
--         offline_sync_queue, security_alerts, blocked_ips
-- ===================================================================

-- ============================================
-- 1. AUDIT_LOGS TABLE
-- ============================================
-- Comprehensive audit trail for all user actions
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    device_fingerprint TEXT,
    signature TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT audit_logs_signature_check CHECK (character_length(signature) = 64)
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON audit_logs(ip_address);

-- RLS for audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs"
    ON audit_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
    ON audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- System can insert audit logs (via service role)
-- Inserts are done server-side with service_role key

-- ============================================
-- 2. MFA_SETTINGS TABLE
-- ============================================
-- Stores MFA configuration and backup codes for each user
-- Note: Uses references to profiles.id for compatibility with existing schema
CREATE TABLE IF NOT EXISTS mfa_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    email_otp_enabled BOOLEAN DEFAULT FALSE,
    totp_enabled BOOLEAN DEFAULT FALSE,
    totp_secret TEXT,
    backup_codes TEXT[],
    last_totp_verified_at TIMESTAMPTZ,
    last_email_otp_sent_at TIMESTAMPTZ,
    attempted_verifications INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for mfa_settings
CREATE INDEX IF NOT EXISTS idx_mfa_settings_user_id ON mfa_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_settings_totp_enabled ON mfa_settings(totp_enabled) WHERE totp_enabled = TRUE;

-- RLS for mfa_settings
ALTER TABLE mfa_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own MFA settings
CREATE POLICY "Users can view their own MFA settings"
    ON mfa_settings FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own MFA settings
CREATE POLICY "Users can update their own MFA settings"
    ON mfa_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- System can insert MFA settings (via service role)

-- ============================================
-- 3. ACTIVE_SESSIONS TABLE
-- ============================================
-- Tracks active user sessions for device management
CREATE TABLE IF NOT EXISTS active_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    device_name TEXT,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    CONSTRAINT active_sessions_device_fp_check CHECK (character_length(device_fingerprint) > 0)
);

-- Indexes for active_sessions
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_device_fp ON active_sessions(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_active_sessions_revoked ON active_sessions(is_revoked) WHERE is_revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at) WHERE expires_at IS NOT NULL AND is_revoked = FALSE;

-- RLS for active_sessions
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
    ON active_sessions FOR SELECT
    USING (auth.uid() = user_id);

-- Users can revoke their own sessions
CREATE POLICY "Users can revoke their own sessions"
    ON active_sessions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- System can insert sessions (via service role)

-- ============================================
-- 4. DIGITAL_SIGNATURES TABLE
-- ============================================
-- Stores digital signatures for sensitive operations
CREATE TABLE IF NOT EXISTS digital_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    data_hash TEXT NOT NULL,
    signature TEXT NOT NULL,
    algorithm TEXT DEFAULT 'sha256',
    document_type TEXT,
    document_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT digital_signatures_hash_check CHECK (character_length(data_hash) > 0),
    CONSTRAINT digital_signatures_signature_check CHECK (character_length(signature) > 0),
    CONSTRAINT digital_signatures_algorithm_check CHECK (algorithm IN ('sha256', 'sha512'))
);

-- Indexes for digital_signatures
CREATE INDEX IF NOT EXISTS idx_digital_signatures_user_id ON digital_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_data_hash ON digital_signatures(data_hash);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_created ON digital_signatures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_document ON digital_signatures(document_type, document_id);

-- RLS for digital_signatures
ALTER TABLE digital_signatures ENABLE ROW LEVEL SECURITY;

-- Users can view their own signatures
CREATE POLICY "Users can view their own digital signatures"
    ON digital_signatures FOR SELECT
    USING (auth.uid() = user_id);

-- System can insert signatures (via service role)

-- ============================================
-- 5. OFFLINE_SYNC_QUEUE TABLE
-- ============================================
-- Queue for offline operations to be synced when online
CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ,
    CONSTRAINT offline_sync_status_check CHECK (status IN ('pending', 'synced', 'failed')),
    CONSTRAINT offline_sync_action_check CHECK (action IN ('create', 'update', 'delete'))
);

-- Indexes for offline_sync_queue
CREATE INDEX IF NOT EXISTS idx_offline_sync_user_id ON offline_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_status ON offline_sync_queue(status) WHERE status != 'synced';
CREATE INDEX IF NOT EXISTS idx_offline_sync_created ON offline_sync_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offline_sync_resource ON offline_sync_queue(resource_type, resource_id);

-- RLS for offline_sync_queue
ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own sync queue
CREATE POLICY "Users can view their own offline sync queue"
    ON offline_sync_queue FOR SELECT
    USING (auth.uid() = user_id);

-- System can insert queue items (via service role)
-- System can update queue status (via service role)

-- ============================================
-- 6. SECURITY_ALERTS TABLE (if not exists)
-- ============================================
-- Real-time security monitoring and alerts
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Indexes for security_alerts
CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON security_alerts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved ON security_alerts(resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_ip ON security_alerts(ip_address);

-- RLS for security_alerts
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can view all security alerts
CREATE POLICY "Admins can view all security alerts"
    ON security_alerts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Users can view their own alerts
CREATE POLICY "Users can view their own security alerts"
    ON security_alerts FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can update alerts (resolve)
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

-- ============================================
-- 7. BLOCKED_IPS TABLE (if not exists)
-- ============================================
-- IP-based access control
CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address INET NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    blocked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    CONSTRAINT blocked_ips_ip_not_empty CHECK (ip_address IS NOT NULL)
);

-- Indexes for blocked_ips
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires ON blocked_ips(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blocked_ips_created ON blocked_ips(created_at DESC);

-- RLS for blocked_ips
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- Admins can view all blocked IPs
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
CREATE POLICY "Admins can unblock IPs"
    ON blocked_ips FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ===================================================================
-- Migration Summary
-- ===================================================================
-- ✅ Created audit_logs table with integrity signature support
-- ✅ Created mfa_settings table for MFA configuration
-- ✅ Created active_sessions table for device management
-- ✅ Created digital_signatures table for document signing
-- ✅ Created offline_sync_queue table for offline sync
-- ✅ Created security_alerts table for real-time monitoring
-- ✅ Created blocked_ips table for access control
-- ✅ Added RLS policies for all tables
-- ✅ Added indexes for performance optimization
-- ===================================================================
