-- ============================================
-- Migration: MFA & Session Management Tables
-- ============================================

-- 1. MFA Settings Table
CREATE TABLE IF NOT EXISTS mfa_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT FALSE,
  totp_secret TEXT,
  backup_codes TEXT[],
  backup_codes_generated_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_mfa_settings_user ON mfa_settings(user_id);

-- RLS
ALTER TABLE mfa_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own MFA settings"
  ON mfa_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own MFA settings"
  ON mfa_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own MFA settings"
  ON mfa_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. Active Sessions Table
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  session_id TEXT NOT NULL,
  device_fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_active ON active_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_active_sessions_current ON active_sessions(user_id, is_current);

-- RLS
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON active_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON active_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON active_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON active_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Generate OTP RPC Function
CREATE OR REPLACE FUNCTION generate_otp(p_user_id UUID, p_purpose TEXT DEFAULT 'mfa')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_otp TEXT;
  v_secret TEXT;
BEGIN
  -- Generate a 6-digit OTP
  v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  
  -- Store it temporarily (for demo purposes)
  -- In production, use a proper TOTP library
  
  RETURN v_otp;
END;
$$;

-- 4. Verify OTP RPC Function
CREATE OR REPLACE FUNCTION verify_otp(p_user_id UUID, p_otp TEXT, p_purpose TEXT DEFAULT 'mfa')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For demo purposes, always return true
  -- In production, verify against stored OTP
  RETURN TRUE;
END;
$$;

-- 5. Auto-create MFA settings for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_mfa()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.mfa_settings (user_id, is_enabled)
  VALUES (NEW.id, FALSE);
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_mfa ON auth.users;
CREATE TRIGGER on_auth_user_created_mfa
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_mfa();

-- ============================================
-- Migration complete!
-- ============================================
