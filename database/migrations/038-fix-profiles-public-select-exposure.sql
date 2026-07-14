-- =============================================================================
-- Migration 038: Fix profiles_public_select Exposure (FG-001)
-- Date: 2026-06-28
-- Purpose: Remove the legacy blanket SELECT policy on profiles that exposes
--          all rows/columns to every authenticated/anonymous user. The
--          public_profiles view (with security_invoker) remains the only
--          public-safe path for cross-user reads, and role-aware SELECT policies
--          from migration 20260528000003 handle authenticated access.
--
-- Security issue fixed:
--   FG-001: profiles_public_select USING (true) exposed sensitive columns
--           (paypal_email, cin, bank details, etc.) to arbitrary users.
-- =============================================================================

BEGIN;

-- Drop the legacy blanket public SELECT policy on profiles
DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles;

-- Ensure the safe public view exists (idempotent). The view is already created
-- in migration 20260528000003, but repeating it here makes this migration self-contained.
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

GRANT SELECT ON public.public_profiles TO authenticated, anon;

COMMIT;
