-- Fix: notify_admins_on_new_product() was missing NOT NULL "title" column
-- This caused a 400 error when vendors added new products (trigger fired, insert failed)
-- Solution: add 'title' to the INSERT statement

CREATE OR REPLACE FUNCTION public.notify_admins_on_new_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vendor_name TEXT;
  v_admin_id    UUID;
BEGIN
  -- Fetch vendor display name
  SELECT COALESCE(store_name, first_name || ' ' || last_name, 'بائع')
  INTO   v_vendor_name
  FROM   profiles
  WHERE  id = NEW.vendor_id;

  -- Insert one notification per admin
  FOR v_admin_id IN SELECT public.get_admin_user_ids() LOOP
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_admin_id,
      'new_product_pending',
      'منتج جديد بانتظار المراجعة',
      'منتج جديد بانتظار المراجعة: "' || NEW.name || '" من البائع ' || COALESCE(v_vendor_name, ''),
      jsonb_build_object(
        'product_id',   NEW.id,
        'product_name', NEW.name,
        'vendor_id',    NEW.vendor_id,
        'vendor_name',  v_vendor_name
      )
    );
  END LOOP;
  RETURN NEW;
END;
$function$;
