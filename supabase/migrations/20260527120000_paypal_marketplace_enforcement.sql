BEGIN;

-- 1) Profiles payment fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paypal_email TEXT,
  ADD COLUMN IF NOT EXISTS paypal_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payout_method TEXT NOT NULL DEFAULT 'paypal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_payout_method_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_payout_method_check
      CHECK (payout_method IN ('paypal', 'bank', 'stripe'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_paypal_email_vendor_driver_unique
  ON public.profiles (lower(paypal_email))
  WHERE paypal_email IS NOT NULL
    AND role IN ('vendor', 'driver');

-- 2) Orders fields for PayPal transaction tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_payment_status_check'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_payment_status_check;
  END IF;

  ALTER TABLE public.orders
    ADD CONSTRAINT orders_payment_status_check
    CHECK (
      payment_status IN (
        'pending',
        'captured',
        'failed',
        'refunded',
        -- backward compatibility with existing flows
        'paid',
        'verified',
        'processing'
      )
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id
  ON public.orders (payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders (payment_status);

-- 3) Payment strategy tables for future extensibility
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  provider_key TEXT,
  paypal_email TEXT,
  stripe_account_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, payment_method_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_payment_methods_paypal_email_unique
  ON public.user_payment_methods (lower(paypal_email))
  WHERE paypal_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user_default
  ON public.user_payment_methods (user_id, is_default);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_methods_read_all" ON public.payment_methods;
CREATE POLICY "payment_methods_read_all"
  ON public.payment_methods
  FOR SELECT
  TO authenticated, anon
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "payment_methods_manage_admin" ON public.payment_methods;
CREATE POLICY "payment_methods_manage_admin"
  ON public.payment_methods
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "user_payment_methods_self_read" ON public.user_payment_methods;
CREATE POLICY "user_payment_methods_self_read"
  ON public.user_payment_methods
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "user_payment_methods_self_write" ON public.user_payment_methods;
CREATE POLICY "user_payment_methods_self_write"
  ON public.user_payment_methods
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.current_user_role() = 'admin')
  WITH CHECK (user_id = auth.uid() OR public.current_user_role() = 'admin');

-- Seed common methods (idempotent)
INSERT INTO public.payment_methods (name, is_active, config)
VALUES
  ('paypal', TRUE, '{"supportsPayouts": true, "supportsGuestCheckout": true}'::jsonb),
  ('bank_transfer', FALSE, '{"supportsPayouts": true}'::jsonb),
  ('stripe', FALSE, '{"supportsPayouts": true}'::jsonb)
ON CONFLICT (name) DO UPDATE
SET is_active = EXCLUDED.is_active,
    config = EXCLUDED.config,
    updated_at = NOW();

-- 4) Enforce immutable paypal_email after verification (non-admin)
CREATE OR REPLACE FUNCTION public.prevent_paypal_email_change_after_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.role IN ('vendor', 'driver')
     AND COALESCE(OLD.paypal_verified, FALSE) = TRUE
     AND lower(COALESCE(OLD.paypal_email, '')) IS DISTINCT FROM lower(COALESCE(NEW.paypal_email, ''))
     AND public.current_user_role() <> 'admin'
  THEN
    RAISE EXCEPTION 'permission_denied: paypal_email cannot be changed after verification'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_paypal_email_change_after_verification ON public.profiles;
CREATE TRIGGER trg_prevent_paypal_email_change_after_verification
  BEFORE UPDATE OF paypal_email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_paypal_email_change_after_verification();

-- 5) Products RLS hardening: vendor must have valid verified PayPal to create/update own products
DROP POLICY IF EXISTS "Vendors can insert own products" ON public.products;
CREATE POLICY "Vendors can insert own products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'vendor'
        AND COALESCE(paypal_verified, FALSE) = TRUE
        AND NULLIF(trim(paypal_email), '') IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Vendors can update own products" ON public.products;
CREATE POLICY "Vendors can update own products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (
    vendor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'vendor'
        AND COALESCE(paypal_verified, FALSE) = TRUE
        AND NULLIF(trim(paypal_email), '') IS NOT NULL
    )
  );

COMMIT;
