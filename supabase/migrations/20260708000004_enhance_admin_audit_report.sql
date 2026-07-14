-- =====================================================
-- ENHANCE ADMIN AUDIT REPORT
-- Adds actor_role, target_table, and creates admin-specific view
-- =====================================================
-- Purpose: Enhance existing audit_logs table for comprehensive
-- admin activity and permissions audit reporting
-- =====================================================

-- 1. ADD MISSING COLUMNS FOR ADMIN REPORTING
-- =====================================================

-- Add actor_role to easily filter by admin actions
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS actor_role TEXT;

-- Populate actor_role from profiles for existing records
UPDATE audit_logs al
SET actor_role = p.role
FROM profiles p
WHERE al.user_id = p.id AND al.actor_role IS NULL;

-- Add target_table (extracted from entity_type or resource_type)
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS target_table TEXT;

-- Populate target_table for existing records
UPDATE audit_logs
SET target_table = COALESCE(entity_type, resource_type)
WHERE target_table IS NULL;

-- Add target_id (extracted from entity_id or resource_id)
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS target_id TEXT;

-- Populate target_id for existing records
UPDATE audit_logs
SET target_id = COALESCE(entity_id::TEXT, resource_id::TEXT)
WHERE target_id IS NULL;

-- Add comments
COMMENT ON COLUMN audit_logs.actor_role IS 'Role of the user who performed the action (admin/vendor/driver/buyer)';
COMMENT ON COLUMN audit_logs.target_table IS 'Table/entity that was affected by the action';
COMMENT ON COLUMN audit_logs.target_id IS 'ID of the affected record in target_table';

-- 2. CREATE ADMIN-SPECIFIC VIEW
-- =====================================================

-- Create a view that joins audit_logs with profiles for admin reporting
CREATE OR REPLACE VIEW admin_audit_logs_view AS
SELECT 
  al.id,
  al.user_id AS actor_id,
  al.actor_role,
  p.first_name || ' ' || p.last_name AS actor_name,
  p.email AS actor_email,
  al.action,
  al.target_table,
  al.target_id,
  al.old_values,
  al.new_values,
  al.changes,
  al.severity,
  al.ip_address,
  al.user_agent,
  al.created_at,
  al.device_fingerprint,
  al.session_id
FROM audit_logs al
LEFT JOIN profiles p ON al.user_id = p.id;

COMMENT ON VIEW admin_audit_logs_view IS 'Admin-friendly view of audit logs with actor details for reporting';

-- 3. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for filtering by actor
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_role ON audit_logs(actor_role, created_at DESC);

-- Index for filtering by target
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_table, target_id, created_at DESC);

-- Composite index for common admin queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_query ON audit_logs(actor_role, action, created_at DESC);

-- 4. CREATE AUDIT ACTION TYPE ENUM
-- =====================================================

-- Create custom type for action categories (optional, for better filtering)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action_category') THEN
    CREATE TYPE audit_action_category AS ENUM (
      'create',
      'update',
      'delete',
      'login',
      'logout',
      'permission_change',
      'export',
      'approve',
      'reject',
      'suspend',
      'unsuspend',
      'refund',
      'payment',
      'mfa',
      'security',
      'other'
    );
  END IF;
END $$;

-- Add action_category column
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS action_category audit_action_category;

-- Populate action_category based on action text for existing records
UPDATE audit_logs
SET action_category = 
  CASE 
    WHEN action ILIKE '%create%' OR action ILIKE '%insert%' THEN 'create'::audit_action_category
    WHEN action ILIKE '%update%' OR action ILIKE '%edit%' OR action ILIKE '%modify%' THEN 'update'::audit_action_category
    WHEN action ILIKE '%delete%' OR action ILIKE '%remove%' THEN 'delete'::audit_action_category
    WHEN action ILIKE '%login%' OR action ILIKE '%sign_in%' THEN 'login'::audit_action_category
    WHEN action ILIKE '%logout%' OR action ILIKE '%sign_out%' THEN 'logout'::audit_action_category
    WHEN action ILIKE '%permission%' OR action ILIKE '%role%' OR action ILIKE '%access%' THEN 'permission_change'::audit_action_category
    WHEN action ILIKE '%export%' OR action ILIKE '%download%' THEN 'export'::audit_action_category
    WHEN action ILIKE '%approve%' THEN 'approve'::audit_action_category
    WHEN action ILIKE '%reject%' THEN 'reject'::audit_action_category
    WHEN action ILIKE '%suspend%' OR action ILIKE '%block%' THEN 'suspend'::audit_action_category
    WHEN action ILIKE '%unsuspend%' OR action ILIKE '%unblock%' THEN 'unsuspend'::audit_action_category
    WHEN action ILIKE '%refund%' THEN 'refund'::audit_action_category
    WHEN action ILIKE '%payment%' OR action ILIKE '%payout%' THEN 'payment'::audit_action_category
    WHEN action ILIKE '%mfa%' OR action ILIKE '%2fa%' OR action ILIKE '%otp%' THEN 'mfa'::audit_action_category
    WHEN action ILIKE '%security%' OR action ILIKE '%alert%' THEN 'security'::audit_action_category
    ELSE 'other'::audit_action_category
  END
WHERE action_category IS NULL;

COMMENT ON COLUMN audit_logs.action_category IS 'Categorized action type for easier filtering in admin reports';

-- 5. UPDATE RLS POLICIES
-- =====================================================

-- Ensure only admins can read the admin view
DROP POLICY IF EXISTS "admin_view_select" ON admin_audit_logs_view;
-- Note: Views don't have RLS directly, but underlying table does
-- We'll use a security barrier function if needed

-- 6. CREATE FUNCTION FOR DATA REDACTION
-- =====================================================

-- Function to redact sensitive fields from JSONB
CREATE OR REPLACE FUNCTION redact_sensitive_data(data JSONB)
RETURNS JSONB AS $$
BEGIN
  -- Remove sensitive fields if present
  RETURN data - 'password' - 'token' - 'secret' - 'api_key' - 'private_key' 
         - 'access_token' - 'refresh_token' - 'otp' - 'backup_codes' 
         - 'ssn' - 'credit_card' - 'iban' - 'rib';
END;
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION redact_sensitive_data IS 'Removes sensitive fields (passwords, tokens, etc.) from JSONB data';

-- Update the view to use redaction
CREATE OR REPLACE VIEW admin_audit_logs_view AS
SELECT 
  al.id,
  al.user_id AS actor_id,
  al.actor_role,
  p.first_name || ' ' || p.last_name AS actor_name,
  p.email AS actor_email,
  al.action,
  al.action_category,
  al.target_table,
  al.target_id,
  redact_sensitive_data(al.old_values) AS old_values,
  redact_sensitive_data(al.new_values) AS new_values,
  redact_sensitive_data(al.changes) AS changes,
  al.severity,
  al.ip_address,
  al.user_agent,
  al.created_at,
  al.device_fingerprint,
  al.session_id
FROM audit_logs al
LEFT JOIN profiles p ON al.user_id = p.id;

-- 7. CREATE TRIGGER FUNCTION FOR AUTO-POPULATING actor_role
-- =====================================================

CREATE OR REPLACE FUNCTION audit_logs_set_actor_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Set actor_role from profiles if not provided
  IF NEW.actor_role IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT role INTO NEW.actor_role FROM profiles WHERE id = NEW.user_id;
  END IF;
  
  -- Set action_category if not provided
  IF NEW.action_category IS NULL AND NEW.action IS NOT NULL THEN
    NEW.action_category = 
      CASE 
        WHEN NEW.action ILIKE '%create%' OR NEW.action ILIKE '%insert%' THEN 'create'::audit_action_category
        WHEN NEW.action ILIKE '%update%' OR NEW.action ILIKE '%edit%' OR NEW.action ILIKE '%modify%' THEN 'update'::audit_action_category
        WHEN NEW.action ILIKE '%delete%' OR NEW.action ILIKE '%remove%' THEN 'delete'::audit_action_category
        WHEN NEW.action ILIKE '%login%' OR NEW.action ILIKE '%sign_in%' THEN 'login'::audit_action_category
        WHEN NEW.action ILIKE '%logout%' OR NEW.action ILIKE '%sign_out%' THEN 'logout'::audit_action_category
        WHEN NEW.action ILIKE '%permission%' OR NEW.action ILIKE '%role%' OR NEW.action ILIKE '%access%' THEN 'permission_change'::audit_action_category
        WHEN NEW.action ILIKE '%export%' OR NEW.action ILIKE '%download%' THEN 'export'::audit_action_category
        WHEN NEW.action ILIKE '%approve%' THEN 'approve'::audit_action_category
        WHEN NEW.action ILIKE '%reject%' THEN 'reject'::audit_action_category
        WHEN NEW.action ILIKE '%suspend%' OR NEW.action ILIKE '%block%' THEN 'suspend'::audit_action_category
        WHEN NEW.action ILIKE '%unsuspend%' OR NEW.action ILIKE '%unblock%' THEN 'unsuspend'::audit_action_category
        WHEN NEW.action ILIKE '%refund%' THEN 'refund'::audit_action_category
        WHEN NEW.action ILIKE '%payment%' OR NEW.action ILIKE '%payout%' THEN 'payment'::audit_action_category
        WHEN NEW.action ILIKE '%mfa%' OR NEW.action ILIKE '%2fa%' OR NEW.action ILIKE '%otp%' THEN 'mfa'::audit_action_category
        WHEN NEW.action ILIKE '%security%' OR NEW.action ILIKE '%alert%' THEN 'security'::audit_action_category
        ELSE 'other'::audit_action_category
      END;
  END IF;
  
  -- Set target_table and target_id if not provided
  IF NEW.target_table IS NULL THEN
    NEW.target_table := COALESCE(NEW.entity_type, NEW.resource_type);
  END IF;
  
  IF NEW.target_id IS NULL THEN
    NEW.target_id := COALESCE(NEW.entity_id::TEXT, NEW.resource_id::TEXT);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS audit_logs_auto_populate ON audit_logs;
CREATE TRIGGER audit_logs_auto_populate
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit_logs_set_actor_role();

COMMENT ON FUNCTION audit_logs_set_actor_role IS 'Automatically populates actor_role, action_category, target_table, and target_id before insert';
