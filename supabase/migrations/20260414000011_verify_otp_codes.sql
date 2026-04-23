-- ============================================
-- Migration: Verify and fix otp_codes table
-- ============================================

-- 1. Create otp_codes table if it doesn't exist
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
    ip_address INET,
    locked_until TIMESTAMPTZ
);

-- 2. Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_codes(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_locked ON otp_codes(locked_until) WHERE locked_until IS NOT NULL;

-- 3. Enable RLS
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
DROP POLICY IF EXISTS "System can insert OTP codes" ON otp_codes;
CREATE POLICY "System can insert OTP codes" ON otp_codes
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own OTP" ON otp_codes;
CREATE POLICY "Users can update own OTP" ON otp_codes
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own OTP" ON otp_codes;
CREATE POLICY "Users can view own OTP" ON otp_codes
    FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- Migration complete!
-- ============================================
