-- Disable Email MFA - TOTP only
-- Problem: Email MFA is not functional (no email sending capability)
-- Solution: Disable MFA for users with method = 'email' or change to 'totp'
-- Date: 2025-01-20
-- Priority: P0 (Critical - users locked in Email MFA screen)

-- Disable MFA for users with method = 'email'
UPDATE public.mfa_settings
SET is_enabled = false, method = 'totp'
WHERE method = 'email';

-- Log the change
INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
SELECT user_id, 'MFA_METHOD_DISABLED', 'mfa_settings', id,
       jsonb_build_object('method', method, 'is_enabled', is_enabled),
       jsonb_build_object('method', 'totp', 'is_enabled', false)
FROM public.mfa_settings
WHERE method = 'email';

-- Add comment for documentation
COMMENT ON TABLE public.mfa_settings IS 'MFA settings - TOTP only (email MFA disabled)';
