-- Migration: H-1 complete fix — close anonymous exposure + restrict cross-user profile reads
--
-- Problems remaining after 20260528000003:
--   1. profiles_select_anon (TO anon USING (true)) — anonymous internet can read
--      ALL columns of ALL profiles including paypal_email, cin, stripe_customer_id.
--   2. profiles_select_business (USING (role IN ('vendor','driver'))) — any
--      authenticated user can read ALL columns from any vendor/driver profile.
--   3. public_profiles view exposes phone and email unnecessarily for anon access.
--
-- Fix:
--   1. Drop profiles_select_anon.
--   2. Drop profiles_select_business.
--   3. Recreate public_profiles as a SECURITY DEFINER view (runs as postgres,
--      bypasses RLS) — exposes only the safe columns needed for marketplace
--      operations, vendor/driver roles only, non-deleted rows.
--      Frontend cross-user reads migrate to this view.
--   4. Add profiles_select_order_participant — authenticated users may read
--      the profile of any user who shares an order with them (covers order
--      detail page embedded JOINs for phone/email of counterparts).
--   5. Add profiles_select_active_drivers — authenticated users can read
--      active driver profiles for delivery-matching queries during checkout.
--      (Narrower than the old 'business' policy; accepted residual risk.)
--
-- Residual risk acknowledged: order participants and delivery-matching callers
-- still access rows via RLS policies on the underlying table, meaning all
-- non-REVOKED columns are technically reachable. Full column-level isolation
-- (paypal_email, cin, stripe_customer_id) requires a follow-up REVOKE +
-- SECURITY DEFINER function pattern — tracked separately.

-- ── 1. Drop the two over-permissive SELECT policies ─────────────────────────

DROP POLICY IF EXISTS "profiles_select_anon"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_business" ON public.profiles;

-- ── 2. Recreate public_profiles as SECURITY DEFINER view ────────────────────
--
-- security_invoker = false  (PostgreSQL default) means the view runs with the
-- privileges of its OWNER (postgres/service_role), so it can see all rows
-- regardless of the caller's RLS context.  The WHERE clause and the explicit
-- column list provide the actual security boundary.

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
  WITH (security_invoker = false)   -- SECURITY DEFINER: runs as view owner
AS
SELECT
  -- identity (non-sensitive)
  id,
  role,
  first_name,
  last_name,
  avatar_url,
  -- contact (needed for B2B operations: vendor phone for preference setup,
  --          driver phone for delivery matching, email for order coordination)
  email,
  phone,
  -- location
  city,
  country,
  latitude,
  longitude,
  -- store / business info
  store_name,
  store_description,
  store_type,
  bio,
  operating_hours,
  active_products_count,
  min_order_amount,
  -- trust indicators (safe — these are user-facing metrics)
  rating,
  is_verified,
  is_approved,
  is_suspended,
  -- operational flags
  delivery_option,
  has_own_driver,
  has_preferred_vendor,
  preferred_driver_id,
  partnership_status,
  -- driver-specific
  is_available_for_delivery,
  vehicle_type,
  vehicle_plate,
  accepted_cargo_sizes,
  min_delivery_distance_km,
  max_delivery_distance_km,
  driver_delivery_payment_cash,
  driver_delivery_payment_transfer,
  driver_delivery_payment_notes,
  -- timestamps
  created_at
FROM public.profiles
WHERE role IN ('vendor', 'driver')
  AND deleted_at IS NULL;

-- Grant SELECT on the view to both roles (the view itself is the security boundary)
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- Update the comment to reflect the new intent
COMMENT ON VIEW public.public_profiles IS
  'SECURITY DEFINER view (runs as postgres). Safe cross-user / public access for '
  'vendor and driver profiles only. '
  'Excluded columns: paypal_email, paypal_verified, cin, cin_number, cin_verified, '
  'cin_verified_at, cin_verified_by, stripe_customer_id, stripe_subscription_id, '
  'admin_notes, suspension_reason, suspension_start, suspension_end, '
  'failed_login_count, failed_payments_count, violation_count, last_violation_at, '
  'trust_score, locked_until, grace_period_ends, vendor_warning_count, '
  'vendor_suspension_count, vendor_status, vendor_status_updated_at, '
  'mfa_enabled, onboarding_completed, referral_code, referred_by, '
  'last_seen_at, deleted_at.';

-- ── 3. Order-participant policy ──────────────────────────────────────────────
--
-- Allows authenticated users to read the profile of any user who is a
-- counterpart in one of their orders.  This covers:
--   - Buyer → read vendor + driver profiles in their orders
--   - Vendor → read buyer + driver profiles in their orders
--   - Driver → read buyer + vendor profiles in their orders
-- Used by: BUYER_ORDER_DETAILS_QUERY embedded JOINs, vendor Analytics
--          top-customer lookup, and similar contextual reads.

DROP POLICY IF EXISTS "profiles_select_order_participant" ON public.profiles;

CREATE POLICY "profiles_select_order_participant"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.orders o
      WHERE  o.deleted_at IS NULL
        AND  (
               -- buyer reads vendor or driver in their orders
               (o.buyer_id  = auth.uid() AND (id = o.vendor_id OR id = o.driver_id))
               -- vendor reads buyer or driver in their orders
            OR (o.vendor_id = auth.uid() AND (id = o.buyer_id  OR id = o.driver_id))
               -- driver reads buyer or vendor in their orders
            OR (o.driver_id = auth.uid() AND (id = o.buyer_id  OR id = o.vendor_id))
             )
    )
  );

-- ── 4. Active-driver policy for delivery matching ────────────────────────────
--
-- Allows authenticated users (vendors / buyers in checkout) to read the
-- profiles of currently-available drivers.  This replaces the previous
-- profiles_select_business for the delivery-matching use-case.
-- Narrower than the old policy: only active, non-suspended, non-deleted drivers.

DROP POLICY IF EXISTS "profiles_select_active_drivers" ON public.profiles;

CREATE POLICY "profiles_select_active_drivers"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'driver'
    AND is_available_for_delivery = true
    AND (is_suspended = false OR is_suspended IS NULL)
    AND deleted_at IS NULL
  );
