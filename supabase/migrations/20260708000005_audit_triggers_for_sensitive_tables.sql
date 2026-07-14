-- =====================================================
-- AUDIT TRIGGERS FOR SENSITIVE TABLES
-- Automatically logs changes to sensitive tables in audit_logs
-- =====================================================
-- Purpose: Create triggers that automatically log INSERT/UPDATE/DELETE
-- operations on sensitive tables (profiles, payouts, orders, security_alerts)
-- =====================================================

-- 1. GENERIC AUDIT TRIGGER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION log_sensitive_table_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_actor_role TEXT;
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_changes JSONB;
BEGIN
  -- Get current user ID from auth.uid()
  v_user_id := auth.uid();
  
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_new_data := to_jsonb(NEW);
    v_old_data := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_new_data := to_jsonb(NEW);
    v_old_data := to_jsonb(OLD);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_new_data := NULL;
    v_old_data := to_jsonb(OLD);
  ELSE
    RETURN NEW;
  END IF;
  
  -- Calculate changes (for UPDATE only)
  IF TG_OP = 'UPDATE' THEN
    v_changes := (
      SELECT jsonb_object_agg(key, value)
      FROM (
        SELECT key, 
               CASE 
                 WHEN to_jsonb(OLD)->>key IS DISTINCT FROM to_jsonb(NEW)->>key 
                 THEN jsonb_build_object('old', to_jsonb(OLD)->>key, 'new', to_jsonb(NEW)->>key)
                 ELSE NULL
               END as value
        FROM jsonb_object_keys(to_jsonb(OLD)) as key
      ) sub
      WHERE value IS NOT NULL
    );
  END IF;
  
  -- Get actor role if user_id is available
  IF v_user_id IS NOT NULL THEN
    SELECT role INTO v_actor_role FROM profiles WHERE id = v_user_id;
  END IF;
  
  -- Insert into audit_logs
  INSERT INTO audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    target_table,
    target_id,
    old_values,
    new_values,
    changes,
    actor_role,
    severity,
    created_at
  ) VALUES (
    v_user_id,
    v_action || ' ' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    COALESCE((NEW.id)::TEXT, (OLD.id)::TEXT),
    TG_TABLE_NAME,
    COALESCE((NEW.id)::TEXT, (OLD.id)::TEXT),
    v_old_data,
    v_new_data,
    v_changes,
    v_actor_role,
    CASE 
      WHEN TG_TABLE_NAME IN ('security_alerts', 'blocked_ips', 'profiles') THEN 'high'
      WHEN TG_TABLE_NAME IN ('payouts', 'financial_audit_log') THEN 'critical'
      ELSE 'info'
    END,
    NOW()
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_sensitive_table_change IS 'Generic trigger function to log changes to sensitive tables in audit_logs';

-- 2. CREATE TRIGGERS FOR SENSITIVE TABLES
-- =====================================================

-- Profiles table (user data changes)
DROP TRIGGER IF EXISTS profiles_audit_trigger ON profiles;
CREATE TRIGGER profiles_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_sensitive_table_change();

-- Payouts table (financial transactions)
DROP TRIGGER IF EXISTS payouts_audit_trigger ON payouts;
CREATE TRIGGER payouts_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payouts
  FOR EACH ROW
  EXECUTE FUNCTION log_sensitive_table_change();

-- Orders table (order status changes)
DROP TRIGGER IF EXISTS orders_audit_trigger ON orders;
CREATE TRIGGER orders_audit_trigger
  AFTER UPDATE OR DELETE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR TG_OP = 'DELETE')
  EXECUTE FUNCTION log_sensitive_table_change();

-- Security alerts table
DROP TRIGGER IF EXISTS security_alerts_audit_trigger ON security_alerts;
CREATE TRIGGER security_alerts_audit_trigger
  AFTER INSERT OR UPDATE ON security_alerts
  FOR EACH ROW
  EXECUTE FUNCTION log_sensitive_table_change();

-- Blocked IPs table
DROP TRIGGER IF EXISTS blocked_ips_audit_trigger ON blocked_ips;
CREATE TRIGGER blocked_ips_audit_trigger
  AFTER INSERT OR DELETE ON blocked_ips
  FOR EACH ROW
  EXECUTE FUNCTION log_sensitive_table_change();

-- Platform settings table
DROP TRIGGER IF EXISTS platform_settings_audit_trigger ON platform_settings;
CREATE TRIGGER platform_settings_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION log_sensitive_table_change();

-- 3. SPECIFIC TRIGGER FOR ROLE CHANGES (already exists, verify)
-- =====================================================

-- Note: role_change_audit_log table and trigger already exist in migration 20260527000001
-- This is just a verification comment to ensure we don't duplicate

-- 4. FUNCTION TO LOG ADMIN PERMISSION CHANGES
-- =====================================================

CREATE OR REPLACE FUNCTION log_admin_permission_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when admin role is granted or revoked
  IF (OLD.role IS DISTINCT FROM NEW.role) AND (NEW.role = 'admin' OR OLD.role = 'admin') THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      target_table,
      target_id,
      old_values,
      new_values,
      changes,
      actor_role,
      severity,
      created_at
    ) VALUES (
      auth.uid(),
      'PERMISSION_CHANGE: ' || TG_TABLE_NAME,
      'role_change',
      NEW.id,
      TG_TABLE_NAME,
      NEW.id::TEXT,
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role),
      jsonb_build_object('role', jsonb_build_object('old', OLD.role, 'new', NEW.role)),
      'admin',
      'critical',
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_admin_permission_change IS 'Logs admin role changes with critical severity';

-- Apply to profiles table for role changes
DROP TRIGGER IF EXISTS profiles_role_change_trigger ON profiles;
CREATE TRIGGER profiles_role_change_trigger
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION log_admin_permission_change();

-- 5. FUNCTION TO LOG SENSITIVE FIELD CHANGES
-- =====================================================

CREATE OR REPLACE FUNCTION log_sensitive_field_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log changes to sensitive fields like passwords, tokens, etc.
  -- This is a safety net - these fields should be redacted by the view anyway
  IF TG_OP = 'UPDATE' THEN
    -- Check if any sensitive field changed
    IF (
      OLD.password_hash IS DISTINCT FROM NEW.password_hash OR
      OLD.email IS DISTINCT FROM NEW.email OR
      OLD.phone IS DISTINCT FROM NEW.phone OR
      OLD.cin_number IS DISTINCT FROM NEW.cin_number
    ) THEN
      INSERT INTO audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        target_table,
        target_id,
        old_values,
        new_values,
        changes,
        actor_role,
        severity,
        created_at
      ) VALUES (
        auth.uid(),
        'SENSITIVE_FIELD_CHANGE: ' || TG_TABLE_NAME,
        TG_TABLE_NAME,
        NEW.id,
        TG_TABLE_NAME,
        NEW.id::TEXT,
        jsonb_build_object(
          'email', OLD.email,
          'phone', OLD.phone,
          'cin_number', OLD.cin_number
        ),
        jsonb_build_object(
          'email', NEW.email,
          'phone', NEW.phone,
          'cin_number', NEW.cin_number
        ),
        jsonb_build_object(
          'email', jsonb_build_object('old', OLD.email, 'new', NEW.email),
          'phone', jsonb_build_object('old', OLD.phone, 'new', NEW.phone),
          'cin_number', jsonb_build_object('old', OLD.cin_number, 'new', NEW.cin_number)
        ),
        (SELECT role FROM profiles WHERE id = auth.uid()),
        'high',
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_sensitive_field_change IS 'Logs changes to sensitive user fields (email, phone, CIN)';

-- Apply to profiles table for sensitive field changes
DROP TRIGGER IF EXISTS profiles_sensitive_field_trigger ON profiles;
CREATE TRIGGER profiles_sensitive_field_trigger
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_sensitive_field_change();

-- 6. VERIFICATION QUERY
-- =====================================================

-- This query can be used to verify triggers are working
-- SELECT 
--   event_object_table as table_name,
--   trigger_name,
--   action_timing,
--   event_manipulation,
--   action_statement
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND event_object_table IN ('profiles', 'payouts', 'orders', 'security_alerts', 'blocked_ips', 'platform_settings')
-- ORDER BY event_object_table, trigger_name;
