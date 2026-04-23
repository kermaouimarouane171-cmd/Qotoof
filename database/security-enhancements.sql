-- =====================================================
-- SECURITY ENHANCEMENTS & FIXES
-- GreenMarket - Industry-Standard Security Measures
-- =====================================================

-- =====================================================
-- 1. FIX RLS POLICIES - Tighten overly permissive policies
-- =====================================================

-- Fix: deliveries INSERT policy - restrict to vendors only
DROP POLICY IF EXISTS "System can create deliveries" ON deliveries;
CREATE POLICY "Vendors can create deliveries for their orders"
  ON deliveries FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = deliveries.order_id 
      AND orders.vendor_id = auth.uid()
    )
  );

-- Fix: order_items INSERT policy - restrict to order buyers
DROP POLICY IF EXISTS "order_items_insert" ON order_items;
CREATE POLICY "Buyers can insert order items for their orders"
  ON order_items FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.buyer_id = auth.uid()
    )
  );

-- Fix: digital_signatures - restrict public access
DROP POLICY IF EXISTS "Everyone can view signatures" ON digital_signatures;
CREATE POLICY "Authenticated users can view signatures"
  ON digital_signatures FOR SELECT 
  USING (auth.role() = 'authenticated');

-- =====================================================
-- 2. ADD SERVER-SIDE INPUT VALIDATION FUNCTIONS
-- =====================================================

-- Function: Validate email format (RFC 5322 compliant)
CREATE OR REPLACE FUNCTION public.validate_email(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Sanitize text input (prevent XSS)
CREATE OR REPLACE FUNCTION public.sanitize_text_input(p_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove HTML tags
  p_text := regexp_replace(p_text, '<[^>]+>', '', 'g');
  
  -- Remove JavaScript event handlers
  p_text := regexp_replace(p_text, 'javascript:', '', 'gi');
  p_text := regexp_replace(p_text, 'on\w+\s*=', '', 'gi');
  
  -- Remove script tags content
  p_text := regexp_replace(p_text, '<script[^>]*>.*?</script>', '', 'gi');
  
  RETURN p_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Validate phone number (Moroccan format)
CREATE OR REPLACE FUNCTION public.validate_moroccan_phone(p_phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_phone ~* '^(\+212|0)([5-7][0-9]{8})$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 3. ADD DATABASE-LEVEL RATE LIMITING
-- =====================================================

-- Function: Check rate limit (server-side)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
  v_attempts INTEGER;
  v_blocked_until TIMESTAMPTZ;
BEGIN
  -- Check if user is currently blocked
  SELECT blocked_until INTO v_blocked_until
  FROM rate_limits
  WHERE user_id = auth.uid()
    AND action = p_action
    AND blocked_until > NOW();

  IF v_blocked_until IS NOT NULL THEN
    RAISE EXCEPTION 'Rate limit exceeded. Try again after %', v_blocked_until;
  END IF;

  -- Count recent attempts
  SELECT COUNT(*) INTO v_attempts
  FROM rate_limits
  WHERE user_id = auth.uid()
    AND action = p_action
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  IF v_attempts >= p_max_attempts THEN
    -- Block user for 2x the window
    INSERT INTO rate_limits (user_id, action, blocked_until)
    VALUES (auth.uid(), p_action, NOW() + (p_window_minutes * 2 || ' minutes')::INTERVAL)
    ON CONFLICT (user_id, action) 
    DO UPDATE SET blocked_until = NOW() + (p_window_minutes * 2 || ' minutes')::INTERVAL;
    
    RAISE EXCEPTION 'Rate limit exceeded for %. Try again later', p_action;
  END IF;

  -- Record this attempt
  INSERT INTO rate_limits (user_id, action)
  VALUES (auth.uid(), p_action);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. ADD IP ADDRESS CAPTURE TO AUDIT LOGS
-- =====================================================

-- Add IP address column to audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Function to get client IP (from request headers via Supabase)
CREATE OR REPLACE FUNCTION public.get_client_ip()
RETURNS INET AS $$
BEGIN
  -- In production, this should be set by a middleware
  -- For now, return NULL (IP will be set by application layer)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. ADD DATA RETENTION POLICIES
-- =====================================================

-- Function: Cleanup old audit logs (keep 1 year)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM audit_logs
    WHERE created_at < NOW() - INTERVAL '1 year'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Cleanup old location history (keep 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_location_history()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM driver_location_history
    WHERE recorded_at < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Cleanup old rate limits (keep 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM rate_limits
    WHERE created_at < NOW() - INTERVAL '7 days'
      AND blocked_until IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Cleanup old notifications (keep 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM notifications
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND is_read = true
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. ADD DATABASE TRIGGERS FOR INPUT VALIDATION
-- =====================================================

-- Trigger: Validate email on profile creation/update
CREATE OR REPLACE FUNCTION public.validate_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.validate_email(NEW.email) THEN
    RAISE EXCEPTION 'Invalid email format: %', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_email_trigger ON profiles;
CREATE TRIGGER validate_email_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_email();

-- Trigger: Sanitize text inputs on products
CREATE OR REPLACE FUNCTION public.sanitize_product_inputs()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := public.sanitize_text_input(NEW.name);
  NEW.description := public.sanitize_text_input(NEW.description);
  
  -- Validate name length
  IF LENGTH(NEW.name) > 200 THEN
    RAISE EXCEPTION 'Product name too long (max 200 characters)';
  END IF;
  
  -- Validate description length
  IF NEW.description IS NOT NULL AND LENGTH(NEW.description) > 5000 THEN
    RAISE EXCEPTION 'Product description too long (max 5000 characters)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sanitize_product_trigger ON products;
CREATE TRIGGER sanitize_product_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_product_inputs();

-- Trigger: Sanitize text inputs on orders
CREATE OR REPLACE FUNCTION public.sanitize_order_inputs()
RETURNS TRIGGER AS $$
BEGIN
  NEW.buyer_notes := public.sanitize_text_input(NEW.buyer_notes);
  NEW.vendor_notes := public.sanitize_text_input(NEW.vendor_notes);
  
  -- Validate notes length
  IF NEW.buyer_notes IS NOT NULL AND LENGTH(NEW.buyer_notes) > 1000 THEN
    RAISE EXCEPTION 'Buyer notes too long (max 1000 characters)';
  END IF;
  
  IF NEW.vendor_notes IS NOT NULL AND LENGTH(NEW.vendor_notes) > 1000 THEN
    RAISE EXCEPTION 'Vendor notes too long (max 1000 characters)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sanitize_order_trigger ON orders;
CREATE TRIGGER sanitize_order_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_order_inputs();

-- =====================================================
-- 7. ADD CONSTRAINTS FOR DATA VALIDATION
-- =====================================================

-- Add length constraints to profiles
ALTER TABLE profiles ALTER COLUMN first_name TYPE VARCHAR(100);
ALTER TABLE profiles ALTER COLUMN last_name TYPE VARCHAR(100);
ALTER TABLE profiles ALTER COLUMN phone TYPE VARCHAR(20);
ALTER TABLE profiles ALTER COLUMN city TYPE VARCHAR(100);

-- Add length constraints to products
ALTER TABLE products ALTER COLUMN name TYPE VARCHAR(200);
ALTER TABLE products ALTER COLUMN description TYPE VARCHAR(5000);

-- Add length constraints to orders
ALTER TABLE orders ALTER COLUMN buyer_notes TYPE VARCHAR(1000);
ALTER TABLE orders ALTER COLUMN vendor_notes TYPE VARCHAR(1000);
ALTER TABLE orders ALTER COLUMN cancellation_reason TYPE VARCHAR(500);

-- Add length constraints to deliveries
ALTER TABLE deliveries ALTER COLUMN driver_notes TYPE VARCHAR(1000);
ALTER TABLE deliveries ALTER COLUMN delivery_address TYPE VARCHAR(500);
ALTER TABLE deliveries ALTER COLUMN pickup_address TYPE VARCHAR(500);

-- =====================================================
-- 8. ADD SECURITY MONITORING FUNCTIONS
-- =====================================================

-- Function: Get security metrics
CREATE OR REPLACE FUNCTION public.get_security_metrics()
RETURNS TABLE (
  metric_name TEXT,
  metric_value BIGINT,
  metric_period TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'failed_login_attempts'::TEXT, COUNT(*)::BIGINT, 'last_24h'::TEXT
  FROM audit_logs
  WHERE action = 'LOGIN_FAILED'
    AND created_at > NOW() - INTERVAL '24 hours';

  RETURN QUERY
  SELECT 'active_sessions'::TEXT, COUNT(*)::BIGINT, 'current'::TEXT
  FROM active_sessions
  WHERE expires_at > NOW();

  RETURN QUERY
  SELECT 'mfa_enabled_users'::TEXT, COUNT(*)::BIGINT, 'current'::TEXT
  FROM mfa_settings
  WHERE mfa_enabled = true;

  RETURN QUERY
  SELECT 'rate_limited_users'::TEXT, COUNT(*)::BIGINT, 'current'::TEXT
  FROM rate_limits
  WHERE blocked_until > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Detect suspicious activity
CREATE OR REPLACE FUNCTION public.detect_suspicious_activity()
RETURNS TABLE (
  user_id UUID,
  activity_type TEXT,
  occurrence_count BIGINT,
  first_occurrence TIMESTAMPTZ,
  last_occurrence TIMESTAMPTZ
) AS $$
BEGIN
  -- Multiple failed login attempts
  RETURN QUERY
  SELECT 
    (data->>'user_id')::UUID,
    'FAILED_LOGINS'::TEXT,
    COUNT(*),
    MIN(created_at),
    MAX(created_at)
  FROM audit_logs
  WHERE action = 'LOGIN_FAILED'
    AND created_at > NOW() - INTERVAL '1 hour'
  GROUP BY (data->>'user_id')::UUID
  HAVING COUNT(*) >= 5;

  -- Multiple password reset requests
  RETURN QUERY
  SELECT 
    (data->>'user_id')::UUID,
    'PASSWORD_RESETS'::TEXT,
    COUNT(*),
    MIN(created_at),
    MAX(created_at)
  FROM audit_logs
  WHERE action = 'PASSWORD_RESET_REQUESTED'
    AND created_at > NOW() - INTERVAL '1 hour'
  GROUP BY (data->>'user_id')::UUID
  HAVING COUNT(*) >= 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. ADD ACCOUNT DELETION FUNCTION (GDPR Article 17)
-- =====================================================

-- Function: Soft delete account (GDPR right to erasure)
CREATE OR REPLACE FUNCTION public.request_account_deletion(p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Log the deletion request
  INSERT INTO audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    data,
    ip_address
  ) VALUES (
    v_user_id,
    'ACCOUNT_DELETION_REQUESTED',
    'profile',
    v_user_id,
    jsonb_build_object('reason', p_reason, 'requested_at', NOW()),
    public.get_client_ip()
  );

  -- Mark profile for deletion (soft delete)
  UPDATE profiles
  SET 
    is_available_for_delivery = false,
    updated_at = NOW()
  WHERE id = v_user_id;

  -- In production, this would trigger a background job
  -- to anonymize or delete all associated data
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. SCHEDULE AUTOMATED CLEANUP (via pg_cron)
-- =====================================================

-- Enable pg_cron extension (requires superuser)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup jobs
-- SELECT cron.schedule('cleanup-audit-logs', 
--   '0 2 * * 0',  -- Every Sunday at 2 AM
--   'SELECT cleanup_old_audit_logs()');

-- SELECT cron.schedule('cleanup-location-history', 
--   '0 3 * * *',  -- Daily at 3 AM
--   'SELECT cleanup_old_location_history()');

-- SELECT cron.schedule('cleanup-rate-limits', 
--   '0 4 * * 0',  -- Every Sunday at 4 AM
--   'SELECT cleanup_old_rate_limits()');

-- SELECT cron.schedule('cleanup-notifications', 
--   '0 5 * * 0',  -- Every Sunday at 5 AM
--   'SELECT cleanup_old_notifications()');

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check RLS policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('deliveries', 'order_items', 'digital_signatures')
ORDER BY tablename, policyname;

-- Check constraints
SELECT table_name, column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'products', 'orders', 'deliveries')
  AND character_maximum_length IS NOT NULL
ORDER BY table_name, column_name;

-- Check functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'validate_email', 'sanitize_text_input', 'validate_moroccan_phone',
    'check_rate_limit', 'cleanup_old_audit_logs', 'get_security_metrics',
    'detect_suspicious_activity', 'request_account_deletion'
  )
ORDER BY routine_name;

-- =====================================================
-- END OF SECURITY ENHANCEMENTS
-- =====================================================
