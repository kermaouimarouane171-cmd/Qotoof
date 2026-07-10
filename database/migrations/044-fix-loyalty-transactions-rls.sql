-- Fix loyalty_transactions RLS policies
-- Problem: No policy for authenticated users to insert their own transactions
-- Solution: Add user-insert policy
-- Date: 2025-01-20
-- Priority: P1

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS loyalty_transactions_system_insert ON loyalty_transactions;

-- Create service_role policy (for system operations)
CREATE POLICY loyalty_transactions_service_insert ON loyalty_transactions
FOR INSERT TO service_role
WITH CHECK (true);

-- Create user policy (for users to insert their own transactions)
CREATE POLICY loyalty_transactions_user_insert ON loyalty_transactions
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Ensure users can read their own transactions
DROP POLICY IF EXISTS loyalty_transactions_user_select ON loyalty_transactions;
CREATE POLICY loyalty_transactions_user_select ON loyalty_transactions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Add comments for documentation
COMMENT ON POLICY loyalty_transactions_service_insert ON loyalty_transactions IS 'Allows service role to insert any transaction (for system operations)';
COMMENT ON POLICY loyalty_transactions_user_insert ON loyalty_transactions IS 'Allows authenticated users to insert their own transactions';
COMMENT ON POLICY loyalty_transactions_user_select ON loyalty_transactions IS 'Allows authenticated users to read their own transactions';
