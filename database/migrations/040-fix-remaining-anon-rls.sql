-- Migration 040: Fix remaining anonymous (anon) RLS exposures
--
-- Targets identified during guest/visitor role review:
--   1. driver_locations: anon could read live lat/lng of online drivers.
--   2. payment_methods: anon could read payment gateway config (JSONB).
--   3. contact_messages: anon could insert unlimited messages (spam/DoS).
--   4. verify_mfa_code / verify_otp: PUBLIC EXECUTE was not revoked.
--
-- After applying this migration:
--   SELECT * FROM public.driver_locations WHERE is_online = true  → should fail for anon
--   SELECT * FROM public.payment_methods WHERE is_active = true  → should fail for anon
--   INSERT INTO public.contact_messages (...)                      → should fail for anon
--   SELECT public.verify_mfa_code(...) / public.verify_otp(...)    → should fail for anon
-- =============================================================================

-- =============================================================================
-- 1. DRIVER LOCATIONS: restrict live location reads to authenticated users
-- =============================================================================
DROP POLICY IF EXISTS "driver_locations_public_select" ON public.driver_locations;

CREATE POLICY "driver_locations_authenticated_select"
  ON public.driver_locations
  FOR SELECT
  TO authenticated
  USING (is_online = true);

-- Drivers can still manage their own location.
-- The existing "driver_locations_driver_manage" policy is kept as-is.

-- =============================================================================
-- 2. PAYMENT METHODS: restrict payment gateway config to authenticated users
-- =============================================================================
DROP POLICY IF EXISTS "payment_methods_public_select" ON public.payment_methods;
DROP POLICY IF EXISTS "payment_methods_read_all" ON public.payment_methods;

CREATE POLICY "payment_methods_authenticated_select"
  ON public.payment_methods
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Admin management policy remains authenticated-only.

-- =============================================================================
-- 3. CONTACT MESSAGES: restrict inserts to authenticated users
--    (Guest contact form is disabled to prevent spam/DoS. Re-enable later with
--     a CAPTCHA-protected Edge Function or rate-limited RLS helper.)
-- =============================================================================
DROP POLICY IF EXISTS "contact_messages_public_insert" ON public.contact_messages;

CREATE POLICY "contact_messages_authenticated_insert"
  ON public.contact_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin select/update policies remain unchanged.

-- =============================================================================
-- 4. MFA FUNCTIONS: revoke PUBLIC EXECUTE and grant only authenticated
-- =============================================================================
REVOKE ALL ON FUNCTION public.verify_mfa_code(UUID, TEXT, TEXT DEFAULT 'email') FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_mfa_code(UUID, TEXT, TEXT DEFAULT 'email') TO authenticated;

REVOKE ALL ON FUNCTION public.verify_otp(UUID, TEXT, TEXT DEFAULT 'mfa_verify') FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_otp(UUID, TEXT, TEXT DEFAULT 'mfa_verify') TO authenticated;
