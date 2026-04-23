-- ============================================
-- Migration 006: User Reporting & Moderation
-- Purpose: Add user reporting, content moderation, and enforcement actions
-- ============================================

-- ============================================
-- 1. USER REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID REFERENCES profiles(id),
    reported_user_id UUID REFERENCES profiles(id),
    report_type TEXT NOT NULL, -- 'illegal_activity', 'false_info', 'fee_circumvention', 'harassment', 'security_violation', 'spam', 'other'
    category TEXT NOT NULL, -- 'user', 'product', 'order', 'message', 'review'
    category_id UUID, -- ID of the reported item
    description TEXT NOT NULL,
    evidence_urls TEXT[], -- Screenshots, links, etc.
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewing', 'resolved', 'dismissed'
    priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    admin_notes TEXT,
    action_taken TEXT, -- 'warning', 'suspension', 'ban', 'content_removed', 'no_action'
    suspension_duration_hours INTEGER,
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_type ON user_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_user_reports_created ON user_reports(created_at DESC);

-- RLS
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
DROP POLICY IF EXISTS "Users can create reports" ON user_reports;
CREATE POLICY "Users can create reports" ON user_reports
    FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- Users can view their own reports
DROP POLICY IF EXISTS "Users can view own reports" ON user_reports;
CREATE POLICY "Users can view own reports" ON user_reports
    FOR SELECT USING (reporter_id = auth.uid());

-- Admins can view all reports
DROP POLICY IF EXISTS "Admins can view all reports" ON user_reports;
CREATE POLICY "Admins can view all reports" ON user_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can update reports
DROP POLICY IF EXISTS "Admins can update reports" ON user_reports;
CREATE POLICY "Admins can update reports" ON user_reports
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- 2. USER VIOLATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_violations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    violation_type TEXT NOT NULL, -- 'illegal_activity', 'false_info', 'fee_circumvention', 'harassment', 'security_violation'
    severity TEXT NOT NULL, -- 'warning', 'minor', 'major', 'critical'
    description TEXT NOT NULL,
    evidence TEXT,
    action_taken TEXT NOT NULL, -- 'warning', 'temporary_suspension', 'permanent_ban', 'content_removed'
    suspension_start TIMESTAMPTZ,
    suspension_end TIMESTAMPTZ,
    reported_by UUID REFERENCES profiles(id),
    reviewed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_violations_user ON user_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_violations_type ON user_violations(violation_type);
CREATE INDEX IF NOT EXISTS idx_user_violations_severity ON user_violations(severity);

-- RLS
ALTER TABLE user_violations ENABLE ROW LEVEL SECURITY;

-- Users can view their own violations
DROP POLICY IF EXISTS "Users can view own violations" ON user_violations;
CREATE POLICY "Users can view own violations" ON user_violations
    FOR SELECT USING (user_id = auth.uid());

-- Admins can view all violations
DROP POLICY IF EXISTS "Admins can view all violations" ON user_violations;
CREATE POLICY "Admins can view all violations" ON user_violations
    FOR SELECT USING (true);

-- Admins can create violations
DROP POLICY IF EXISTS "Admins can create violations" ON user_violations;
CREATE POLICY "Admins can create violations" ON user_violations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can update violations
DROP POLICY IF EXISTS "Admins can update violations" ON user_violations;
CREATE POLICY "Admins can update violations" ON user_violations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- 3. ADD SUSPENSION FIELDS TO PROFILES
-- ============================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS suspension_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspension_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_violation_at TIMESTAMPTZ;

-- ============================================
-- 4. FUNCTIONS
-- ============================================

-- Function: Create user report
CREATE OR REPLACE FUNCTION create_user_report(
    p_reporter_id UUID,
    p_reported_user_id UUID,
    p_report_type TEXT,
    p_category TEXT,
    p_category_id UUID,
    p_description TEXT,
    p_evidence_urls TEXT[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_report_id UUID;
BEGIN
    -- Determine priority based on type
    DECLARE
        v_priority TEXT := 'medium';
    BEGIN
        IF p_report_type IN ('illegal_activity', 'security_violation') THEN
            v_priority := 'critical';
        ELSIF p_report_type IN ('harassment', 'fee_circumvention') THEN
            v_priority := 'high';
        END IF;
    END;

    INSERT INTO user_reports (
        reporter_id, reported_user_id, report_type, category, category_id,
        description, evidence_urls, priority
    ) VALUES (
        p_reporter_id, p_reported_user_id, p_report_type, p_category, p_category_id,
        p_description, p_evidence_urls, v_priority
    )
    RETURNING id INTO v_report_id;

    RETURN v_report_id;
END;
$$;

-- Function: Suspend user
CREATE OR REPLACE FUNCTION suspend_user(
    p_user_id UUID,
    p_reason TEXT,
    p_duration_hours INTEGER DEFAULT NULL,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_suspension_end TIMESTAMPTZ;
BEGIN
    -- Calculate suspension end time
    IF p_duration_hours IS NOT NULL THEN
        v_suspension_end := NOW() + (p_duration_hours || ' hours')::INTERVAL;
    END IF;

    -- Update profile
    UPDATE profiles
    SET
        is_suspended = true,
        suspension_reason = p_reason,
        suspension_start = NOW(),
        suspension_end = v_suspension_end,
        violation_count = violation_count + 1,
        last_violation_at = NOW()
    WHERE id = p_user_id;

    -- Record violation
    INSERT INTO user_violations (
        user_id, violation_type, severity, description, action_taken,
        suspension_start, suspension_end, reported_by, reviewed_by
    ) VALUES (
        p_user_id, 'policy_violation',
        CASE
            WHEN p_duration_hours IS NULL THEN 'critical'
            WHEN p_duration_hours > 168 THEN 'major'
            ELSE 'minor'
        END,
        p_reason,
        'temporary_suspension',
        NOW(),
        v_suspension_end,
        p_admin_id,
        p_admin_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'suspension_end', v_suspension_end
    );
END;
$$;

-- Function: Ban user permanently
CREATE OR REPLACE FUNCTION ban_user_permanently(
    p_user_id UUID,
    p_reason TEXT,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update profile
    UPDATE profiles
    SET
        is_suspended = true,
        suspension_reason = p_reason,
        suspension_start = NOW(),
        suspension_end = NULL, -- Permanent
        violation_count = violation_count + 1,
        last_violation_at = NOW()
    WHERE id = p_user_id;

    -- Record violation
    INSERT INTO user_violations (
        user_id, violation_type, severity, description, action_taken,
        suspension_start, reported_by, reviewed_by
    ) VALUES (
        p_user_id, 'policy_violation', 'critical', p_reason,
        'permanent_ban', NOW(), p_admin_id, p_admin_id
    );

    RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;

-- Function: Check if user is suspended
CREATE OR REPLACE FUNCTION is_user_suspended(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_result JSONB;
BEGIN
    SELECT is_suspended, suspension_reason, suspension_start, suspension_end
    INTO v_profile
    FROM profiles
    WHERE id = p_user_id;

    IF NOT FOUND OR NOT v_profile.is_suspended THEN
        RETURN jsonb_build_object('is_suspended', false);
    END IF;

    -- Check if suspension has expired
    IF v_profile.suspension_end IS NOT NULL AND v_profile.suspension_end < NOW() THEN
        -- Auto-unsuspend
        UPDATE profiles
        SET is_suspended = false, suspension_reason = NULL, suspension_start = NULL, suspension_end = NULL
        WHERE id = p_user_id;

        RETURN jsonb_build_object('is_suspended', false);
    END IF;

    RETURN jsonb_build_object(
        'is_suspended', true,
        'reason', v_profile.suspension_reason,
        'suspension_start', v_profile.suspension_start,
        'suspension_end', v_profile.suspension_end,
        'remaining_hours',
            CASE
                WHEN v_profile.suspension_end IS NULL THEN -1 -- Permanent
                ELSE EXTRACT(EPOCH FROM (v_profile.suspension_end - NOW())) / 3600
            END
    );
END;
$$;

-- Function: Get user violation history
CREATE OR REPLACE FUNCTION get_user_violations(p_user_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    id UUID,
    violation_type TEXT,
    severity TEXT,
    description TEXT,
    action_taken TEXT,
    suspension_start TIMESTAMPTZ,
    suspension_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT uv.id, uv.violation_type, uv.severity, uv.description, uv.action_taken,
           uv.suspension_start, uv.suspension_end, uv.created_at
    FROM user_violations uv
    WHERE uv.user_id = p_user_id
    ORDER BY uv.created_at DESC
    LIMIT p_limit;
END;
$$;

-- ============================================
-- 5. TRIGGERS FOR AUTOMATIC ENFORCEMENT
-- ============================================

-- Trigger: Prevent suspended users from creating orders
CREATE OR REPLACE FUNCTION check_user_suspension_before_order()
RETURNS TRIGGER AS $$
DECLARE
    v_suspension JSONB;
BEGIN
    -- Check buyer
    v_suspension := is_user_suspended(NEW.buyer_id);
    IF (v_suspension->>'is_suspended')::BOOLEAN THEN
        RAISE EXCEPTION 'Buyer account is suspended: %', v_suspension->>'reason';
    END IF;

    -- Check vendor
    v_suspension := is_user_suspended(NEW.vendor_id);
    IF (v_suspension->>'is_suspended')::BOOLEAN THEN
        RAISE EXCEPTION 'Vendor account is suspended: %', v_suspension->>'reason';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_suspension_before_order ON orders;
CREATE TRIGGER check_suspension_before_order
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION check_user_suspension_before_order();

-- ============================================
-- Migration complete!
-- ============================================
COMMENT ON TABLE user_reports IS 'User-submitted reports of policy violations';
COMMENT ON TABLE user_violations IS 'Record of user violations and enforcement actions';
