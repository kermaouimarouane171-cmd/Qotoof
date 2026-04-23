-- ============================================
-- Migration: Fix active_sessions table structure
-- ============================================

-- 1. Ensure session_token column exists and is nullable (code doesn't set session_id)
ALTER TABLE active_sessions
  ADD COLUMN IF NOT EXISTS session_token TEXT;

-- 2. Make session_token nullable since some code paths may not set it
ALTER TABLE active_sessions
  ALTER COLUMN session_token DROP NOT NULL;

-- 3. Ensure is_current and is_active columns exist
ALTER TABLE active_sessions
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT false;

ALTER TABLE active_sessions
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 4. Ensure device_fingerprint is nullable (varies by implementation)
ALTER TABLE active_sessions
  ALTER COLUMN device_fingerprint DROP NOT NULL;

-- 5. Add device_info JSONB column if it doesn't exist
ALTER TABLE active_sessions
  ADD COLUMN IF NOT EXISTS device_info JSONB;

-- ============================================
-- Migration complete!
-- ============================================
