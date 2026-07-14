-- Migration: Protect products.approval_status from vendor manipulation
-- CVE Class: OWASP A01:2021 – Broken Access Control (Business Logic Bypass)
--
-- VULNERABILITY: The RLS policy "Vendors can update own products" allows vendors
-- to UPDATE any column on their own products, including approval_status.
-- A vendor whose product was suspended or rejected by an admin can directly call:
--   supabase.from('products').update({ approval_status: 'published' }).eq('vendor_id', user.id)
-- This bypasses the admin moderation workflow.
--
-- FIX: Add a BEFORE UPDATE trigger that blocks changes to approval_status,
-- approved_by, approved_at, and rejection_reason by non-service-role callers.
-- Admins are allowed via their own RLS policy (which runs as service_role via DEFINER
-- RPCs) or directly when current_user = 'postgres' / 'service_role'.

CREATE OR REPLACE FUNCTION public.prevent_vendor_approval_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow postgres and service_role (used by admin RPCs and Edge Functions)
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- Block changes to approval workflow columns by the vendor (client-side)
  IF (NEW.approval_status   IS DISTINCT FROM OLD.approval_status)
  OR (NEW.approved_by       IS DISTINCT FROM OLD.approved_by)
  OR (NEW.approved_at       IS DISTINCT FROM OLD.approved_at)
  OR (NEW.rejection_reason  IS DISTINCT FROM OLD.rejection_reason)
  THEN
    RAISE EXCEPTION
      'Direct modification of product approval fields is not permitted. '
      'Approval status can only be changed by an admin.'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  RETURN NEW;
END;
$$;

-- Apply the trigger (BEFORE UPDATE so the block takes effect before any write)
DROP TRIGGER IF EXISTS trg_prevent_vendor_approval_status_change ON public.products;

CREATE TRIGGER trg_prevent_vendor_approval_status_change
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_vendor_approval_status_change();

-- Grant execute to authenticated for completeness (trigger fires automatically)
REVOKE ALL ON FUNCTION public.prevent_vendor_approval_status_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_vendor_approval_status_change() TO service_role;
