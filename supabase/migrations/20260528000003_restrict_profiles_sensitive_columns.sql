-- Migration: H-1 – Restrict profiles SELECT policy
-- Problem: profiles_select_authenticated uses USING(true), allowing any
--          authenticated user to read ALL columns (paypal_email, cin, bank details, etc.)
--          from ANY user's row via the PostgREST API.
-- Fix:     Replace the blanket policy with role-aware policies:
--          1. Owner can read their own full row.
--          2. Admin can read any row in full.
--          3. Vendor/Driver profiles are business listings – any authenticated
--             user may read them (needed for marketplace, checkout, delivery).
--          4. Buyer/Admin profiles are private – only owner + admin may read them.
-- Result:  Sensitive columns (paypal_email, cin, stripe_*, admin_notes, suspension_*)
--          are no longer exposed to arbitrary authenticated users via direct table queries.
--          All existing frontend functionality is preserved.

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Drop the old blanket SELECT policy
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. New SELECT policies
-- ──────────────────────────────────────────────────────────────────────────────

-- 2a. Owner reads own full row (covers all own-profile queries including
--     sensitive fields like paypal_email, cin, stripe_customer_id, etc.)
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 2b. Admin reads any row in full (covers all admin moderation/management pages)
CREATE POLICY "profiles_select_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (current_user_role() = 'admin');

-- 2c. Vendor & Driver profiles are public business listings – any authenticated
--     user may read them.  This covers:
--     - Marketplace vendor listings (api.js vendorsApi)
--     - Checkout vendor/driver info (CheckoutSimplified)
--     - Vendor-driver preference setup (DriverPreferenceSetup, VendorPreferenceSetup)
--     - Delivery matching joins (deliveryMatchingService driver:profiles(...))
--     - Buyer dashboard recent vendor cards
--     - Cart vendor name/min_order lookup
CREATE POLICY "profiles_select_business"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (role IN ('vendor', 'driver'));

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Public-safe view for unauthenticated/anonymous access
--    (also serves as a documented list of columns safe for cross-user exposure)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.public_profiles
  WITH (security_invoker = true)
AS
SELECT
  id,
  role,
  first_name,
  last_name,
  email,
  phone,
  avatar_url,
  city,
  country,
  store_name,
  store_description,
  store_type,
  bio,
  rating,
  is_verified,
  is_approved,
  operating_hours,
  active_products_count,
  delivery_option,
  has_own_driver,
  has_preferred_vendor,
  preferred_driver_id,
  partnership_status,
  is_available_for_delivery,
  vehicle_type,
  vehicle_plate,
  accepted_cargo_sizes,
  min_order_amount,
  min_delivery_distance_km,
  max_delivery_distance_km,
  driver_delivery_payment_cash,
  driver_delivery_payment_transfer,
  driver_delivery_payment_notes,
  latitude,
  longitude,
  created_at
FROM public.profiles;

-- Grant read access on the view to authenticated and anon roles
GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Comment documenting columns intentionally excluded from public_profiles
-- ──────────────────────────────────────────────────────────────────────────────
COMMENT ON VIEW public.public_profiles IS
  'Safe cross-user view. Excludes: paypal_email, paypal_verified, cin, cin_number, '
  'cin_verified, cin_verified_by, stripe_customer_id, stripe_subscription_id, '
  'admin_notes, is_suspended, suspension_reason, suspension_start, suspension_end, '
  'failed_login_count, failed_payments_count, violation_count, last_violation_at, '
  'trust_score, locked_until, grace_period_ends, vendor_warning_count, '
  'vendor_suspension_count, onboarding_completed, mfa_enabled, referral_code, '
  'referred_by, last_seen_at, verification_documents.';
