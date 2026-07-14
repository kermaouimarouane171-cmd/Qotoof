-- DELETE ALL USERS AND ALL RELATED DATA
-- WARNING: This is a destructive operation - NO ROLLBACK
-- Date: 2025-01-20
-- Purpose: Clean database for fresh testing

-- Disable RLS temporarily to allow deletion
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts DISABLE ROW LEVEL SECURITY;

-- Delete data in dependency order (child tables first)
-- Only delete tables that exist
DO $$
DECLARE
    table_name text;
BEGIN
    -- Delete from child tables first - correct order
    FOR table_name IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
        AND tablename IN ('audit_logs', 'security_alerts', 'active_sessions', 'mfa_settings', 
                        'messages', 'reviews', 'order_items', 'delivery_requests', 'driver_locations', 
                        'disputes', 'refunds', 'loyalty_points', 'coupons', 'vendor_contracts', 
                        'payment_terms_acceptance', 'orders', 'products')
    LOOP
        BEGIN
            EXECUTE 'TRUNCATE TABLE public.' || quote_ident(table_name) || ' CASCADE';
        EXCEPTION WHEN undefined_table THEN
            CONTINUE;
        END;
    END LOOP;

    -- Delete profiles last
    TRUNCATE TABLE public.profiles CASCADE;
END $$;

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Add comment for documentation
COMMENT ON TABLE public.profiles IS 'All profiles deleted - database reset for testing';
