-- Phase 8: Notification Center & Preferences Enablement

CREATE OR REPLACE FUNCTION public.normalize_notification_category(
  p_category TEXT,
  p_type TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  raw_value TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_category), ''), NULLIF(BTRIM(p_type), ''), 'general'));
BEGIN
  IF raw_value IN ('order', 'order_update', 'order_updates', 'order_status', 'new_order') THEN
    RETURN 'order_update';
  ELSIF raw_value IN ('payment', 'payment_update', 'payment_updates', 'commission', 'bank_transfer') THEN
    RETURN 'payment';
  ELSIF raw_value IN ('promotion', 'promotions', 'promotional', 'promotional_updates', 'product') THEN
    RETURN 'promotion';
  ELSIF raw_value IN ('review', 'reviews', 'review_update', 'review_updates') THEN
    RETURN 'review';
  ELSIF raw_value IN ('loyalty', 'loyalty_update', 'loyalty_updates', 'referral', 'referrals') THEN
    RETURN 'loyalty';
  ELSIF raw_value IN ('inventory', 'inventory_alert', 'inventory_alerts', 'stock', 'low_stock') THEN
    RETURN 'inventory';
  ELSIF raw_value IN ('delivery', 'delivery_update', 'delivery_updates', 'delivery_assignment', 'driver_verification') THEN
    RETURN 'delivery';
  ELSIF raw_value IN ('message', 'messages', 'chat') THEN
    RETURN 'message';
  END IF;

  RETURN 'system';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.should_store_notification(
  p_user_id UUID,
  p_category TEXT,
  p_channel TEXT DEFAULT 'in_app'
)
RETURNS BOOLEAN AS $$
DECLARE
  preferences_row notification_preferences%ROWTYPE;
  normalized_category TEXT := public.normalize_notification_category(p_category, NULL);
  normalized_channel TEXT := COALESCE(NULLIF(BTRIM(p_channel), ''), 'in_app');
BEGIN
  SELECT *
  INTO preferences_row
  FROM notification_preferences
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  IF normalized_channel = 'email' THEN
    IF NOT COALESCE(preferences_row.email_enabled, TRUE) THEN
      RETURN FALSE;
    END IF;
  ELSIF normalized_channel = 'sms' THEN
    IF NOT COALESCE(preferences_row.sms_enabled, FALSE) THEN
      RETURN FALSE;
    END IF;
  ELSE
    IF NOT COALESCE(preferences_row.in_app_enabled, TRUE) THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN CASE normalized_category
    WHEN 'order_update' THEN COALESCE(preferences_row.order_updates, TRUE)
    WHEN 'payment' THEN COALESCE(preferences_row.payment_updates, TRUE)
    WHEN 'promotion' THEN COALESCE(preferences_row.promotional_updates, TRUE)
    WHEN 'review' THEN COALESCE(preferences_row.review_updates, TRUE)
    WHEN 'loyalty' THEN COALESCE(preferences_row.loyalty_updates, TRUE)
    WHEN 'inventory' THEN COALESCE(preferences_row.inventory_alerts, TRUE)
    WHEN 'delivery' THEN COALESCE(preferences_row.delivery_updates, TRUE)
    ELSE COALESCE(preferences_row.system_updates, TRUE)
  END;
END;
$$ LANGUAGE plpgsql STABLE;

UPDATE notifications
SET
  category = public.normalize_notification_category(category, type),
  channel = COALESCE(NULLIF(BTRIM(channel), ''), 'in_app'),
  priority = COALESCE(NULLIF(BTRIM(priority), ''), 'normal'),
  data = COALESCE(data, '{}'::jsonb)
WHERE category IS DISTINCT FROM public.normalize_notification_category(category, type)
   OR channel IS DISTINCT FROM COALESCE(NULLIF(BTRIM(channel), ''), 'in_app')
   OR priority IS DISTINCT FROM COALESCE(NULLIF(BTRIM(priority), ''), 'normal')
   OR data IS NULL;

CREATE OR REPLACE FUNCTION public.apply_notification_defaults_and_preferences()
RETURNS TRIGGER AS $$
BEGIN
  NEW.type := COALESCE(NULLIF(BTRIM(NEW.type), ''), 'system');
  NEW.category := public.normalize_notification_category(NEW.category, NEW.type);
  NEW.channel := COALESCE(NULLIF(BTRIM(NEW.channel), ''), 'in_app');
  NEW.priority := COALESCE(NULLIF(BTRIM(NEW.priority), ''), 'normal');
  NEW.data := COALESCE(NEW.data, '{}'::jsonb);

  IF TG_OP = 'INSERT'
     AND NEW.deleted_at IS NULL
     AND NOT public.should_store_notification(NEW.user_id, NEW.category, NEW.channel) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.create_user_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'system',
  p_category TEXT DEFAULT 'general',
  p_data JSONB DEFAULT '{}'::jsonb,
  p_channel TEXT DEFAULT 'in_app',
  p_priority TEXT DEFAULT 'normal',
  p_action_url TEXT DEFAULT NULL,
  p_action_label TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  inserted_id UUID;
  normalized_category TEXT := public.normalize_notification_category(p_category, p_type);
  normalized_channel TEXT := COALESCE(NULLIF(BTRIM(p_channel), ''), 'in_app');
BEGIN
  IF NOT public.should_store_notification(p_user_id, normalized_category, normalized_channel) THEN
    RETURN NULL;
  END IF;

  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    category,
    channel,
    priority,
    data,
    action_url,
    action_label,
    is_read,
    read_at
  )
  VALUES (
    p_user_id,
    p_title,
    p_message,
    COALESCE(NULLIF(BTRIM(p_type), ''), 'system'),
    normalized_category,
    normalized_channel,
    COALESCE(NULLIF(BTRIM(p_priority), ''), 'normal'),
    COALESCE(p_data, '{}'::jsonb),
    p_action_url,
    p_action_label,
    FALSE,
    NULL
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notifications_apply_defaults ON notifications;
CREATE TRIGGER trg_notifications_apply_defaults
  BEFORE INSERT OR UPDATE OF type, category, channel, priority, data, deleted_at ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_notification_defaults_and_preferences();