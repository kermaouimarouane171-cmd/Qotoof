-- =====================================================
-- Migration: Hash Backup Codes for TOTP
-- SECURITY CRITICAL - Hash plaintext backup codes
-- =====================================================

-- 1. BACKUP: Create backup of plaintext codes (for audit)
CREATE TABLE IF NOT EXISTS mfa_settings_backup_plaintext (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  plaintext_codes TEXT[] NOT NULL,
  backed_up_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- 2. NOTE: This migration should be run with a Node.js script
-- The actual hashing must be done client-side or in a trusted backend environment
-- See: database/scripts/hash-backup-codes.js for the hashing process

-- 3. ADD: Column to track if codes have been hashed
ALTER TABLE mfa_settings 
ADD COLUMN IF NOT EXISTS totp_backup_codes_hashed BOOLEAN DEFAULT FALSE;

-- 4. CREATE: Function to mark codes as hashed
CREATE OR REPLACE FUNCTION mark_backup_codes_as_hashed(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE mfa_settings
  SET totp_backup_codes_hashed = TRUE,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. CREATE: Policy to check if backup codes need hashing
CREATE OR REPLACE FUNCTION get_unhashed_backup_codes()
RETURNS TABLE(user_id UUID, plaintext_codes TEXT[]) AS $$
BEGIN
  RETURN QUERY
  SELECT ms.user_id, ms.totp_backup_codes
  FROM mfa_settings ms
  WHERE ms.totp_backup_codes IS NOT NULL
    AND ms.totp_backup_codes_hashed = FALSE
    AND ms.method = 'totp';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. DOCUMENTATION: How to run the hashing process
-- 1. Run this migration to create the necessary functions and columns
-- 2. Execute the Node.js script: npm run hash:backup-codes
-- 3. This will hash all existing plaintext backup codes
-- 4. New codes created after TOTP setup will be automatically hashed

-- 7. AUDIT LOG: Add security audit record
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  resource_id,
  changes,
  ip_address,
  user_agent,
  severity,
  created_at
) SELECT
  NULL,
  'SECURITY_MIGRATION_APPLIED',
  'mfa_settings',
  NULL,
  jsonb_build_object(
    'migration', '022-hash-backup-codes',
    'description', 'Applied backup code hashing migration',
    'timestamp', NOW()
  ),
  '127.0.0.1',
  'migration',
  'high',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM audit_logs 
  WHERE action = 'SECURITY_MIGRATION_APPLIED' 
  AND resource_type = 'mfa_settings'
  AND changes->>'migration' = '022-hash-backup-codes'
);

-- 8. VERIFICATION: Check status of backup code hashing
-- Run this query to see progress:
-- SELECT 
--   COUNT(*) as total_mfa_settings,
--   COUNT(*) FILTER (WHERE totp_backup_codes IS NOT NULL) as with_backup_codes,
--   COUNT(*) FILTER (WHERE totp_backup_codes IS NOT NULL AND totp_backup_codes_hashed = TRUE) as hashed_codes,
--   COUNT(*) FILTER (WHERE totp_backup_codes IS NOT NULL AND totp_backup_codes_hashed = FALSE) as unhashed_codes
-- FROM mfa_settings;
