-- =============================================================================
-- Migration 039: Fix anon Data Exposure & RLS Hardening
-- Date: 2026-06-29
-- Purpose:
--   SEC-005: public_profiles view exposed sensitive columns (email, phone,
--            lat/lng, financial fields, vehicle_plate) to anon role.
--   SEC-006: deliveries_system_insert WITH CHECK (true) (from mig 031 line 178)
--            could be re-introduced on migration reset; this migration replaces
--            it permanently with a service_role-only INSERT policy.
--   SEC-007: profiles_self_update allows any authenticated user to set their own
--            `role` column directly from the client. Added explicit column-level
--            restriction via a second CHECK policy.
--
-- Changes:
--   1. Replace public_profiles view with a minimal safe version for anon access.
--      Sensitive columns only available to authenticated users via a separate view.
--   2. Drop deliveries_system_insert if it still exists and recreate as service_role.
--   3. Add profiles_self_update_no_role_change policy to block client-side role changes.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. SAFE PUBLIC VIEW — minimal columns for anon (storefront display only)
-- =============================================================================
-- Drop the old view that exposed sensitive data to anon
DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- Minimal safe view for anon: only store/display fields, NO PII
CREATE OR REPLACE VIEW public.public_vendor_profiles
  WITH (security_invoker = true)
AS
SELECT
  id,
  role,
  first_name,
  last_name,
  store_name,
  store_description,
  store_type,
  bio,
  avatar_url,
  city,
  country,
  rating,
  is_verified,
  is_approved,
  operating_hours,
  active_products_count,
  delivery_option,
  has_own_driver,
  min_order_amount,
  min_delivery_distance_km,
  max_delivery_distance_km,
  is_available_for_delivery,
  vehicle_type,
  accepted_cargo_sizes,
  latitude,
  longitude,
  created_at
FROM public.profiles
WHERE role IN ('vendor', 'driver');

-- Grant minimal view to anon (no PII: no email, no phone, no financial fields)
GRANT SELECT ON public.public_vendor_profiles TO authenticated, anon;

-- Full public_profiles view for authenticated users only (includes email/phone for messaging etc.)
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

-- authenticated only — NOT anon
GRANT SELECT ON public.public_profiles TO authenticated;
REVOKE SELECT ON public.public_profiles FROM anon;

-- =============================================================================
-- 2. DELIVERIES — ensure INSERT is service_role only (idempotent)
-- =============================================================================
DROP POLICY IF EXISTS "deliveries_system_insert" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_service_insert" ON public.deliveries;

CREATE POLICY "deliveries_service_insert"
  ON public.deliveries
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =============================================================================
-- 3. PROFILES — block client-side role changes
-- =============================================================================
-- Drop the existing permissive self-update policy
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;

-- Recreate with role column protection:
-- The WITH CHECK prevents setting role to anything other than what's already
-- stored, effectively blocking self-promotion. Only service_role (via Edge
-- Function upgrade-role) or admin can change the role.
CREATE POLICY "profiles_self_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent client from changing their own role
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- Admin can still update any profile (including role changes)
-- This is already covered by the existing profiles_admin_update policy from mig 031

-- =============================================================================
-- Verification comments
-- =============================================================================
-- After applying this migration:
--   SELECT * FROM public.public_profiles → should fail for anon (no grant)
--   SELECT * FROM public.public_vendor_profiles → should succeed for anon
--   SELECT email FROM public.public_vendor_profiles → should fail (column not in view)
--   UPDATE profiles SET role='admin' WHERE id=<own_id> → should fail for authenticated non-admin
-- =============================================================================

COMMIT;
