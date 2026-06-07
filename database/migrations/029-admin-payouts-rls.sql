-- ============================================================
-- Migration: Add admin RLS policies for payouts table
-- Purpose: Allow admin users to SELECT and UPDATE all payouts
-- Idempotent: safe to re-run
-- ============================================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE IF EXISTS public.payouts ENABLE ROW LEVEL SECURITY;

-- Admin SELECT policy: admins can view all payouts
DROP POLICY IF EXISTS "Admins can view all payouts" ON public.payouts;
CREATE POLICY "Admins can view all payouts"
  ON public.payouts
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());

-- Admin UPDATE policy: admins can update payout status
DROP POLICY IF EXISTS "Admins can update payouts" ON public.payouts;
CREATE POLICY "Admins can update payouts"
  ON public.payouts
  FOR UPDATE
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
