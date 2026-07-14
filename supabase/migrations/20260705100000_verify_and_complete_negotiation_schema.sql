-- ==========================================================================
-- Migration: Verify and complete negotiation schema in live DB
--
-- This migration uses information_schema checks (same pattern as
-- 010-fix-missing-columns.sql) to ensure price_negotiations table
-- and cart_items negotiation columns actually exist in the live database.
-- It re-creates them if missing — guarding against the "migration written
-- but not applied" problem encountered repeatedly in this project.
-- ==========================================================================

BEGIN;

-- Ensure pgcrypto is available for digest() in the rate limit wrapper
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================================================
-- 1. Verify / create price_negotiations table
-- ==========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'price_negotiations'
  ) THEN
    -- Create enums if they don't exist
    BEGIN
      CREATE TYPE negotiation_status AS ENUM (
        'pending', 'accepted', 'rejected', 'countered', 'expired', 'converted'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      CREATE TYPE negotiation_offer_by AS ENUM ('buyer', 'vendor');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    CREATE TABLE public.price_negotiations (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id           UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      buyer_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      vendor_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      original_price       NUMERIC(12,2) NOT NULL DEFAULT 0,
      proposed_price       NUMERIC(12,2) NOT NULL DEFAULT 0,
      proposed_quantity    INTEGER       NOT NULL DEFAULT 1,
      offer_by             negotiation_offer_by NOT NULL DEFAULT 'buyer',
      status               negotiation_status   NOT NULL DEFAULT 'pending',
      round_number         INTEGER              NOT NULL DEFAULT 1,
      max_rounds           INTEGER              NOT NULL DEFAULT 3,
      expires_at           TIMESTAMPTZ          NOT NULL DEFAULT (now() + interval '24 hours'),
      delivery_price       NUMERIC(12,2) DEFAULT 0,
      delivery_distance_km NUMERIC(8,2)  DEFAULT NULL,
      buyer_note           TEXT DEFAULT NULL,
      vendor_note          TEXT DEFAULT NULL,
      converted_order_id   UUID REFERENCES public.orders(id) ON DELETE SET NULL,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_negotiations_buyer   ON public.price_negotiations(buyer_id);
    CREATE INDEX idx_negotiations_vendor  ON public.price_negotiations(vendor_id);
    CREATE INDEX idx_negotiations_product ON public.price_negotiations(product_id);
    CREATE INDEX idx_negotiations_status  ON public.price_negotiations(status);
    CREATE INDEX idx_negotiations_expires ON public.price_negotiations(expires_at);

    RAISE NOTICE 'Created price_negotiations table (was missing from live DB)';
  ELSE
    RAISE NOTICE 'price_negotiations table already exists — verified OK';
  END IF;
END $$;

-- ==========================================================================
-- 2. Verify / create updated_at trigger on price_negotiations
-- ==========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_negotiations_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_negotiation_updated_at()
    RETURNS TRIGGER AS $f$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_negotiations_updated_at
      BEFORE UPDATE ON public.price_negotiations
      FOR EACH ROW
      EXECUTE FUNCTION public.set_negotiation_updated_at();

    RAISE NOTICE 'Created trg_negotiations_updated_at trigger (was missing)';
  ELSE
    RAISE NOTICE 'trg_negotiations_updated_at trigger already exists — verified OK';
  END IF;
END $$;

-- ==========================================================================
-- 3. Verify / enable RLS on price_negotiations
-- ==========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'price_negotiations'
      AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.price_negotiations ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS on price_negotiations (was disabled)';
  ELSE
    RAISE NOTICE 'RLS on price_negotiations already enabled — verified OK';
  END IF;
END $$;

-- ==========================================================================
-- 4. Verify / create RLS policies on price_negotiations
-- ==========================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'price_negotiations' AND policyname = 'negotiations_buyer_select') THEN
    CREATE POLICY negotiations_buyer_select
      ON public.price_negotiations FOR SELECT TO authenticated
      USING (buyer_id = auth.uid());
    RAISE NOTICE 'Created negotiations_buyer_select policy';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'price_negotiations' AND policyname = 'negotiations_vendor_select') THEN
    CREATE POLICY negotiations_vendor_select
      ON public.price_negotiations FOR SELECT TO authenticated
      USING (vendor_id = auth.uid());
    RAISE NOTICE 'Created negotiations_vendor_select policy';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'price_negotiations' AND policyname = 'negotiations_buyer_insert') THEN
    CREATE POLICY negotiations_buyer_insert
      ON public.price_negotiations FOR INSERT TO authenticated
      WITH CHECK (buyer_id = auth.uid());
    RAISE NOTICE 'Created negotiations_buyer_insert policy';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'price_negotiations' AND policyname = 'negotiations_buyer_update') THEN
    CREATE POLICY negotiations_buyer_update
      ON public.price_negotiations FOR UPDATE TO authenticated
      USING (buyer_id = auth.uid()) WITH CHECK (buyer_id = auth.uid());
    RAISE NOTICE 'Created negotiations_buyer_update policy';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'price_negotiations' AND policyname = 'negotiations_vendor_update') THEN
    CREATE POLICY negotiations_vendor_update
      ON public.price_negotiations FOR UPDATE TO authenticated
      USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());
    RAISE NOTICE 'Created negotiations_vendor_update policy';
  END IF;
END $$;

-- ==========================================================================
-- 5. Verify / create expire_stale_negotiations function
-- ==========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'expire_stale_negotiations'
  ) THEN
    CREATE OR REPLACE FUNCTION public.expire_stale_negotiations()
    RETURNS INTEGER AS $f$
    DECLARE
      v_count INTEGER;
    BEGIN
      UPDATE public.price_negotiations
        SET status = 'expired'
        WHERE status IN ('pending', 'countered')
          AND expires_at < now();
      GET DIAGNOSTICS v_count = ROW_COUNT;
      RETURN v_count;
    END;
    $f$ LANGUAGE plpgsql;

    GRANT EXECUTE ON FUNCTION public.expire_stale_negotiations() TO authenticated;
    RAISE NOTICE 'Created expire_stale_negotiations function (was missing)';
  ELSE
    RAISE NOTICE 'expire_stale_negotiations function already exists — verified OK';
  END IF;
END $$;

-- ==========================================================================
-- 6. Verify / add cart_items negotiation columns
-- ==========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cart_items'
      AND column_name = 'negotiation_id'
  ) THEN
    ALTER TABLE cart_items ADD COLUMN negotiation_id UUID REFERENCES price_negotiations(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added cart_items.negotiation_id column (was missing)';
  ELSE
    RAISE NOTICE 'cart_items.negotiation_id already exists — verified OK';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cart_items'
      AND column_name = 'locked_price'
  ) THEN
    ALTER TABLE cart_items ADD COLUMN locked_price NUMERIC(10, 2);
    RAISE NOTICE 'Added cart_items.locked_price column (was missing)';
  ELSE
    RAISE NOTICE 'cart_items.locked_price already exists — verified OK';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cart_items'
      AND column_name = 'is_negotiated'
  ) THEN
    ALTER TABLE cart_items ADD COLUMN is_negotiated BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added cart_items.is_negotiated column (was missing)';
  ELSE
    RAISE NOTICE 'cart_items.is_negotiated already exists — verified OK';
  END IF;
END $$;

-- ==========================================================================
-- 7. Verify / add cart_items negotiation constraints
-- ==========================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_negotiated_has_locked_price') THEN
    ALTER TABLE cart_items ADD CONSTRAINT check_negotiated_has_locked_price
      CHECK (NOT is_negotiated OR locked_price IS NOT NULL);
    RAISE NOTICE 'Added check_negotiated_has_locked_price constraint';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_negotiated_has_negotiation_id') THEN
    ALTER TABLE cart_items ADD CONSTRAINT check_negotiated_has_negotiation_id
      CHECK (NOT is_negotiated OR negotiation_id IS NOT NULL);
    RAISE NOTICE 'Added check_negotiated_has_negotiation_id constraint';
  END IF;
END $$;

-- ==========================================================================
-- 8. Verify / add cart_items negotiation index
-- ==========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_cart_items_negotiation_id'
  ) THEN
    CREATE INDEX idx_cart_items_negotiation_id ON cart_items(negotiation_id) WHERE negotiation_id IS NOT NULL;
    RAISE NOTICE 'Created idx_cart_items_negotiation_id index';
  END IF;
END $$;

-- ==========================================================================
-- 9. NEGOTIATION RATE LIMIT WRAPPER
--    enforce_rate_limit is granted only to service_role. This wrapper is
--    SECURITY DEFINER so it can call enforce_rate_limit internally, and is
--    granted to authenticated. Parameters are hardcoded to prevent abuse.
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.check_negotiation_rate_limit(
  p_user_id UUID,
  p_action TEXT
)
RETURNS TABLE (
  allowed BOOLEAN,
  retry_after_seconds INTEGER,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope TEXT;
  v_max_attempts INTEGER;
  v_window_seconds INTEGER;
  v_block_seconds INTEGER;
  v_identifier_hash TEXT;
BEGIN
  IF p_action = 'create' THEN
    v_scope := 'negotiation_create';
    v_max_attempts := 5;       -- 5 offers per hour
    v_window_seconds := 3600;  -- 1 hour window
    v_block_seconds := 3600;   -- block for 1 hour after limit exceeded
  ELSIF p_action = 'counter' THEN
    v_scope := 'negotiation_counter';
    v_max_attempts := 10;      -- 10 counters per hour
    v_window_seconds := 3600;
    v_block_seconds := 1800;   -- block for 30 minutes
  ELSE
    RETURN QUERY SELECT FALSE, 0, 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Hash the user_id as identifier (same approach as serverRateLimit.ts)
  v_identifier_hash := encode(
    digest(p_user_id::text, 'sha256'),
    'hex'
  );

  RETURN QUERY
  SELECT * FROM public.enforce_rate_limit(
    v_scope,
    v_identifier_hash,
    v_max_attempts,
    v_window_seconds,
    v_block_seconds
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_negotiation_rate_limit(UUID, TEXT) TO authenticated;

-- ==========================================================================
-- 10. Add suspicious_negotiation to security_alerts alert_type CHECK
--     (only if the constraint exists — some table versions don't have it)
-- ==========================================================================
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.security_alerts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%alert_type%';

  IF v_constraint_name IS NOT NULL THEN
    -- Drop and recreate with the additional value
    EXECUTE format('ALTER TABLE public.security_alerts DROP CONSTRAINT %I', v_constraint_name);
    ALTER TABLE public.security_alerts ADD CONSTRAINT security_alerts_alert_type_check
      CHECK (alert_type IN (
        'brute_force_login', 'suspicious_login', 'unauthorized_access',
        'rate_limit_exceeded', 'sql_injection_attempt', 'xss_attempt',
        'csrf_violation', 'account_takeover_attempt', 'mfa_bypass_attempt',
        'privilege_escalation', 'data_exfiltration', 'ip_blocked', 'ip_unblocked',
        'user_suspended', 'user_unsuspended', 'suspicious_negotiation', 'custom'
      ));
    RAISE NOTICE 'Updated security_alerts CHECK constraint to include suspicious_negotiation';
  ELSE
    RAISE NOTICE 'No alert_type CHECK constraint found on security_alerts — suspicious_negotiation will work without constraint';
  END IF;
END $$;

COMMIT;
