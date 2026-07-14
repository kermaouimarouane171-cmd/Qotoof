-- ===============================================================
-- Qotoof Marketplace - Add paypal_email_updated_at tracking
-- ===============================================================
-- Adds a timestamp column to track when paypal_email was last
-- changed, helping admins identify suspicious or recent changes
-- before processing payouts.
-- Safe to re-run.
-- ===============================================================

BEGIN;

-- ===============================================================
-- 1. Add paypal_email_updated_at column to profiles
-- ===============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paypal_email_updated_at TIMESTAMPTZ;

-- ===============================================================
-- 2. Add paypal_email_updated_at column to vendor_contracts
-- ===============================================================

ALTER TABLE public.vendor_contracts
  ADD COLUMN IF NOT EXISTS paypal_email_updated_at TIMESTAMPTZ;

-- ===============================================================
-- 3. Create function to auto-update paypal_email_updated_at
--    on profiles when paypal_email changes
-- ===============================================================

CREATE OR REPLACE FUNCTION public.set_paypal_email_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update the timestamp if paypal_email actually changed
  IF NEW.paypal_email IS DISTINCT FROM OLD.paypal_email THEN
    NEW.paypal_email_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===============================================================
-- 4. Create trigger on profiles BEFORE UPDATE
-- ===============================================================

DROP TRIGGER IF EXISTS trg_set_paypal_email_updated_at ON public.profiles;

CREATE TRIGGER trg_set_paypal_email_updated_at
  BEFORE UPDATE OF paypal_email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_paypal_email_updated_at();

-- ===============================================================
-- 5. Backfill existing rows with current timestamp
--    (so the column is not NULL for existing vendors)
-- ===============================================================

UPDATE public.profiles
  SET paypal_email_updated_at = NOW()
  WHERE paypal_email IS NOT NULL
    AND paypal_email_updated_at IS NULL;

COMMIT;

-- ===============================================================
-- Verification query (commented out - run manually to verify)
-- ===============================================================

-- SELECT id, paypal_email, paypal_email_updated_at
-- FROM public.profiles
-- WHERE paypal_email IS NOT NULL
-- LIMIT 10;