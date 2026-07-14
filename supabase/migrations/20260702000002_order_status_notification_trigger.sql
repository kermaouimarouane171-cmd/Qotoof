-- ==========================================================================
-- Migration: Add DB trigger to auto-create notifications on order status change
-- Problem:  The createOrderNotification() function exists in the frontend
--           (src/services/notifications.js) but is never called when order
--           status changes happen server-side (e.g. via vendor dashboard,
--           driver app, or admin panel).  Notifications are only created if
--           the frontend explicitly calls the function, which is unreliable.
-- Solution: A SECURITY DEFINER trigger function that fires on UPDATE of
--           orders.status and inserts notification rows for the buyer,
--           vendor, and driver (as applicable) — mirroring the frontend
--           createOrderNotification() logic but at the database level.
-- ==========================================================================

BEGIN;

-- ── 1. Trigger function ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_number TEXT;
  v_buyer_id     UUID;
  v_vendor_id    UUID;
  v_driver_id    UUID;
  v_title        TEXT;
  v_message      TEXT;
  v_type         TEXT;
  v_category     TEXT;
BEGIN
  -- Only fire when status actually changed
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_order_number := COALESCE(NEW.order_number, NEW.id::text);
  v_buyer_id     := NEW.buyer_id;
  v_vendor_id    := NEW.vendor_id;
  v_driver_id    := NEW.driver_id;

  -- ── Buyer notifications ────────────────────────────────────────────────
  IF v_buyer_id IS NOT NULL THEN
    v_title   := NULL;
    v_message := NULL;
    v_type    := 'order';
    v_category := 'order_update';

    CASE NEW.status
      WHEN 'pending' THEN
        v_title   := 'تم استلام طلبك';
        v_message := 'تم إنشاء طلبك ' || v_order_number || ' بنجاح';
      WHEN 'vendor_accepted' THEN
        v_title   := 'تم قبول طلبك';
        v_message := 'قبل البائع طلبك ' || v_order_number;
      WHEN 'driver_assigned' THEN
        v_title   := 'تم تعيين سائق 🚚';
        v_message := 'تم تعيين سائق لطلبك ' || v_order_number;
        v_type    := 'delivery_assignment';
        v_category := 'delivery';
      WHEN 'driver_accepted' THEN
        v_title   := 'السائق قبل التوصيل';
        v_message := 'قبل السائق توصيل طلبك ' || v_order_number;
        v_type    := 'delivery';
        v_category := 'delivery';
      WHEN 'driver_picked_up' THEN
        v_title   := 'تم استلام الطلب 📦';
        v_message := 'استلم السائق طلبك ' || v_order_number;
        v_type    := 'delivery';
        v_category := 'delivery';
      WHEN 'on_the_way' THEN
        v_title   := 'الطلب في الطريق! 🚚💨';
        v_message := 'طلبك ' || v_order_number || ' في الطريق إليك';
        v_type    := 'delivery';
        v_category := 'delivery';
      WHEN 'delivered' THEN
        v_title   := 'تم توصيل الطلب! 🎉';
        v_message := 'تم توصيل طلبك ' || v_order_number || ' بنجاح';
      WHEN 'cancelled' THEN
        v_title   := 'تم إلغاء الطلب';
        v_message := 'تم إلغاء طلبك ' || v_order_number;
      ELSE
        v_title := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        v_buyer_id,
        v_title,
        v_message,
        v_type,
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', v_order_number,
          'category', v_category,
          'action_url', '/orders/' || NEW.id::text,
          'action_label', 'عرض الطلب'
        )
      );
    END IF;
  END IF;

  -- ── Vendor notifications ───────────────────────────────────────────────
  IF v_vendor_id IS NOT NULL THEN
    v_title   := NULL;
    v_message := NULL;
    v_type    := 'order';
    v_category := 'order_update';

    CASE NEW.status
      WHEN 'pending' THEN
        v_title   := 'طلب جديد';
        v_message := 'لديك طلب جديد ' || v_order_number;
      WHEN 'driver_accepted' THEN
        v_title   := 'السائق قبل التوصيل';
        v_message := 'قبل السائق توصيل طلب ' || v_order_number;
        v_type    := 'delivery';
        v_category := 'delivery';
      WHEN 'driver_picked_up' THEN
        v_title   := 'استلم السائق الطلب';
        v_message := 'استلم السائق طلب ' || v_order_number;
        v_type    := 'delivery';
        v_category := 'delivery';
      WHEN 'delivered' THEN
        v_title   := 'تم توصيل الطلب';
        v_message := 'تم توصيل طلب ' || v_order_number || ' للمشتري';
      WHEN 'cancelled' THEN
        v_title   := 'تم إلغاء الطلب';
        v_message := 'تم إلغاء طلب ' || v_order_number;
      ELSE
        v_title := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        v_vendor_id,
        v_title,
        v_message,
        v_type,
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', v_order_number,
          'category', v_category,
          'action_url', '/orders/' || NEW.id::text,
          'action_label', 'عرض الطلب'
        )
      );
    END IF;
  END IF;

  -- ── Driver notifications ───────────────────────────────────────────────
  IF v_driver_id IS NOT NULL THEN
    v_title   := NULL;
    v_message := NULL;
    v_type    := 'delivery';
    v_category := 'delivery';

    CASE NEW.status
      WHEN 'delivered' THEN
        v_title   := 'اكتمل التوصيل ✅';
        v_message := 'لقد قمت بتوصيل طلب ' || v_order_number || ' بنجاح';
      WHEN 'cancelled' THEN
        v_title   := 'تم إلغاء الطلب';
        v_message := 'تم إلغاء طلب ' || v_order_number;
      ELSE
        v_title := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        v_driver_id,
        v_title,
        v_message,
        v_type,
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', v_order_number,
          'category', v_category,
          'action_url', '/orders/' || NEW.id::text,
          'action_label', 'عرض الطلب'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. Grant execute ──────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.notify_order_status_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_order_status_change() TO service_role;

-- ── 3. Create the trigger on orders ───────────────────────────────────────
DROP TRIGGER IF EXISTS on_order_status_changed ON public.orders;
CREATE TRIGGER on_order_status_changed
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_status_change();

COMMIT;
