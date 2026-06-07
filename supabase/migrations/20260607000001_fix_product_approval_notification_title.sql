--- =============================================================================
-- Migration: Fix notify_vendor_on_product_decision title NOT NULL violation
-- =============================================================================
-- Problem:
--   public.notify_vendor_on_product_decision() inserts into notifications
--   without a title column, but notifications.title is NOT NULL.
--   This causes: "null value in column title of relation notifications
--   violates not-null constraint" whenever admin approves/rejects/suspends
--   a product.
--
-- Fix:
--   Re-create the function adding an appropriate title for each decision type.
--   No logic changes beyond adding title.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_vendor_on_product_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when approval_status actually changes
  IF NEW.approval_status IS NOT DISTINCT FROM OLD.approval_status THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status = 'published' THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.vendor_id,
      'product_approved',
      'تمت الموافقة على المنتج',
      'تمت الموافقة على منتجك "' || NEW.name || '" وهو الآن مرئي للمشترين',
      jsonb_build_object('product_id', NEW.id, 'product_name', NEW.name)
    );

  ELSIF NEW.approval_status = 'rejected' THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.vendor_id,
      'product_rejected',
      'تم رفض المنتج',
      'تم رفض منتجك "' || NEW.name || '". السبب: ' || COALESCE(NEW.rejection_reason, 'لم يُحدد'),
      jsonb_build_object(
        'product_id',       NEW.id,
        'product_name',     NEW.name,
        'rejection_reason', NEW.rejection_reason
      )
    );

  ELSIF NEW.approval_status = 'suspended' THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.vendor_id,
      'product_suspended',
      'تم تعليق المنتج',
      'تم تعليق منتجك "' || NEW.name || '" مؤقتاً من قبل الإدارة',
      jsonb_build_object('product_id', NEW.id, 'product_name', NEW.name)
    );
  END IF;

  RETURN NEW;
END;
$$;
