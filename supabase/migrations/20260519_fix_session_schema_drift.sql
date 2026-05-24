-- ============================================
-- Migration: Fix session/MFA schema drift
-- ============================================
-- Consolidates changes spread across migrations 006, 007, 009, 010 and
-- corrects FK references from auth.users(id) → profiles(id) on both
-- mfa_settings and active_sessions.
--
-- Safe to run multiple times (idempotent ALTER TABLE ... ADD COLUMN IF NOT EXISTS).
-- Run AFTER the profiles table exists (created in 000 / 20260519_add_missing_profiles_columns).
-- ============================================

-- ────────────────────────────────────────────
-- 1.  mfa_settings — ensure canonical column set
-- ────────────────────────────────────────────

ALTER TABLE mfa_settings
  ADD COLUMN IF NOT EXISTS totp_backup_codes       TEXT[],
  ADD COLUMN IF NOT EXISTS enabled_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS method                  TEXT DEFAULT 'totp',
  ADD COLUMN IF NOT EXISTS last_used_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_attempts         INTEGER DEFAULT 0;

-- totp_secret was added in 007 with ADD COLUMN IF NOT EXISTS — ensure it exists
ALTER TABLE mfa_settings
  ADD COLUMN IF NOT EXISTS totp_secret             TEXT;

-- ────────────────────────────────────────────
-- 2.  active_sessions — ensure canonical column set
-- ────────────────────────────────────────────

ALTER TABLE active_sessions
  ADD COLUMN IF NOT EXISTS session_token           TEXT,
  ADD COLUMN IF NOT EXISTS device_info             JSONB,
  ADD COLUMN IF NOT EXISTS device_fingerprint      TEXT,
  ADD COLUMN IF NOT EXISTS ip_address              TEXT,
  ADD COLUMN IF NOT EXISTS user_agent              TEXT,
  ADD COLUMN IF NOT EXISTS is_current              BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_active               BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_active             TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at              TIMESTAMPTZ;

-- Make nullable columns that are not always set
ALTER TABLE active_sessions
  ALTER COLUMN session_token      DROP NOT NULL,
  ALTER COLUMN device_fingerprint DROP NOT NULL;

-- ────────────────────────────────────────────
-- 3.  Re-parent FKs: auth.users → profiles
--
--     The original migrations created mfa_settings.user_id and
--     active_sessions.user_id with REFERENCES auth.users(id).
--     We move them to REFERENCES profiles(id) so all user-related
--     tables join consistently through the application schema.
-- ────────────────────────────────────────────

DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  -- ── mfa_settings ──
  SELECT conname INTO v_constraint
  FROM   pg_constraint
  WHERE  conrelid = 'mfa_settings'::regclass
    AND  contype  = 'f'
    AND  conkey   = ARRAY[(
          SELECT attnum FROM pg_attribute
          WHERE attrelid = 'mfa_settings'::regclass AND attname = 'user_id'
        )];

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE mfa_settings DROP CONSTRAINT %I', v_constraint);
  END IF;

  ALTER TABLE mfa_settings
    ADD CONSTRAINT mfa_settings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

  -- ── active_sessions ──
  SELECT conname INTO v_constraint
  FROM   pg_constraint
  WHERE  conrelid = 'active_sessions'::regclass
    AND  contype  = 'f'
    AND  conkey   = ARRAY[(
          SELECT attnum FROM pg_attribute
          WHERE attrelid = 'active_sessions'::regclass AND attname = 'user_id'
        )];

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE active_sessions DROP CONSTRAINT %I', v_constraint);
  END IF;

  ALTER TABLE active_sessions
    ADD CONSTRAINT active_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
END;
$$;

-- ────────────────────────────────────────────
-- 4.  Indexes
-- ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_mfa_settings_user
  ON mfa_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user
  ON active_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_active_sessions_active
  ON active_sessions(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_active_sessions_expires
  ON active_sessions(expires_at)
  WHERE expires_at IS NOT NULL;

-- ────────────────────────────────────────────
-- 5.  RLS — ensure policies exist on both tables
--     (Original policies in migration 006 remain; this block is a no-op
--      if they already exist because of the IF NOT EXISTS guard on the table.)
-- ────────────────────────────────────────────

-- mfa_settings: service-role write access (for OTP + MFA Edge Functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mfa_settings' AND policyname = 'Service role full access on mfa_settings'
  ) THEN
    CREATE POLICY "Service role full access on mfa_settings"
      ON mfa_settings
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- active_sessions: service-role write access (for secure-login Edge Function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'active_sessions' AND policyname = 'Service role full access on active_sessions'
  ) THEN
    CREATE POLICY "Service role full access on active_sessions"
      ON active_sessions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- ============================================
-- Migration complete!
-- ============================================
