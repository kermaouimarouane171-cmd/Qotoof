-- =====================================================
-- ALIGN refund_policies TABLE WITH FRONTEND CODE
-- =====================================================
-- Problem: The refund_policies table was created in
-- 20260422000022 with columns: allows_refund, refund_window_hours,
-- refund_conditions, no_refund_reason, who_pays_return.
--
-- But the frontend code (refundPolicyService.js +
-- RefundPolicySettings.jsx) uses a DIFFERENT schema:
--   return_window_days       (INTEGER, days not hours)
--   allow_partial_returns    (BOOLEAN)
--   return_shipping_paid_by  (TEXT: buyer/vendor/shared)
--   non_returnable_categories (TEXT[])
--   policy_text              (TEXT)
--
-- This mismatch causes PGRST204 when saving vendor refund policy
-- from the Settings page. The table has 0 rows currently (no vendor
-- has saved a refund policy yet), so adding columns is zero-risk.
--
-- Decision: Add the new columns to the DB (not change the code),
-- because:
--   1. The UI component already renders fields for the new columns
--   2. The old columns (allows_refund, refund_window_hours) have
--      different semantics (hours vs days) that would introduce
--      rounding errors if we mapped them
--   3. No existing data to migrate (0 rows)
--   4. Changing code would require rewriting 4+ files
-- =====================================================

-- Step 1: Add new columns using DO block for safety
DO $$
BEGIN
  -- return_window_days (days, not hours)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'refund_policies'
      AND column_name = 'return_window_days'
  ) THEN
    ALTER TABLE public.refund_policies
      ADD COLUMN return_window_days INTEGER DEFAULT 7
      CHECK (return_window_days >= 1 AND return_window_days <= 30);
    RAISE NOTICE 'Added column: return_window_days';
  ELSE
    RAISE NOTICE 'Column already exists: return_window_days';
  END IF;

  -- allow_partial_returns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'refund_policies'
      AND column_name = 'allow_partial_returns'
  ) THEN
    ALTER TABLE public.refund_policies
      ADD COLUMN allow_partial_returns BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added column: allow_partial_returns';
  ELSE
    RAISE NOTICE 'Column already exists: allow_partial_returns';
  END IF;

  -- return_shipping_paid_by (buyer/vendor/shared)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'refund_policies'
      AND column_name = 'return_shipping_paid_by'
  ) THEN
    ALTER TABLE public.refund_policies
      ADD COLUMN return_shipping_paid_by VARCHAR(20) DEFAULT 'buyer'
      CHECK (return_shipping_paid_by IN ('buyer', 'vendor', 'shared'));
    RAISE NOTICE 'Added column: return_shipping_paid_by';
  ELSE
    RAISE NOTICE 'Column already exists: return_shipping_paid_by';
  END IF;

  -- non_returnable_categories (array of category names)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'refund_policies'
      AND column_name = 'non_returnable_categories'
  ) THEN
    ALTER TABLE public.refund_policies
      ADD COLUMN non_returnable_categories TEXT[] DEFAULT '{}';
    RAISE NOTICE 'Added column: non_returnable_categories';
  ELSE
    RAISE NOTICE 'Column already exists: non_returnable_categories';
  END IF;

  -- policy_text (display text for buyers)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'refund_policies'
      AND column_name = 'policy_text'
  ) THEN
    ALTER TABLE public.refund_policies
      ADD COLUMN policy_text TEXT DEFAULT '';
    RAISE NOTICE 'Added column: policy_text';
  ELSE
    RAISE NOTICE 'Column already exists: policy_text';
  END IF;
END $$;

-- Step 2: Add comments
COMMENT ON COLUMN public.refund_policies.return_window_days IS 'Number of days after delivery during which returns are accepted (1-30)';
COMMENT ON COLUMN public.refund_policies.allow_partial_returns IS 'Whether partial returns (subset of order items) are allowed';
COMMENT ON COLUMN public.refund_policies.return_shipping_paid_by IS 'Who pays return shipping: buyer, vendor, or shared';
COMMENT ON COLUMN public.refund_policies.non_returnable_categories IS 'Array of product category names that cannot be returned';
COMMENT ON COLUMN public.refund_policies.policy_text IS 'Human-readable refund policy text shown to buyers on product pages';

-- Step 3: Verification
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM (VALUES
    ('return_window_days'),
    ('allow_partial_returns'),
    ('return_shipping_paid_by'),
    ('non_returnable_categories'),
    ('policy_text')
  ) AS v(col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'refund_policies'
      AND column_name = v.col
  );

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % refund_policies columns are still missing', missing_count;
  END IF;

  RAISE NOTICE 'VERIFICATION PASSED: All 5 new refund_policies columns exist';
END $$;
