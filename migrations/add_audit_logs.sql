-- Audit log table and trigger wiring for order status changes

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_select
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS audit_logs_service_insert ON public.audit_logs;
CREATE POLICY audit_logs_service_insert
  ON public.audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS audit_logs_no_update ON public.audit_logs;
CREATE POLICY audit_logs_no_update
  ON public.audit_logs
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS audit_logs_no_delete ON public.audit_logs;
CREATE POLICY audit_logs_no_delete
  ON public.audit_logs
  FOR DELETE
  TO authenticated
  USING (false);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created_at
  ON public.audit_logs (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  header_json jsonb := COALESCE(current_setting('request.headers', true), '{}')::jsonb;
  action_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    action_name := format('%s.status_changed', TG_TABLE_NAME);
  ELSE
    action_name := format('%s.%s', TG_TABLE_NAME, lower(TG_OP));
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data,
    ip_address
  )
  VALUES (
    actor,
    action_name,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    to_jsonb(OLD),
    to_jsonb(NEW),
    COALESCE(header_json ->> 'x-forwarded-for', header_json ->> 'x-real-ip')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_audit_status_change ON public.orders;
CREATE TRIGGER trg_orders_audit_status_change
AFTER UPDATE ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.log_audit_event();
