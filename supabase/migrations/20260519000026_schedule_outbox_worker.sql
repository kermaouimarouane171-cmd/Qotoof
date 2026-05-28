-- Migration: schedule domain_events_outbox worker via pg_cron
-- Requires: pg_cron + pg_net extensions enabled in Supabase dashboard.
--
-- The worker Edge Function (process-outbox) is invoked every 30 seconds.
-- The SUPABASE_FUNCTIONS_URL secret must be set as a database secret or
-- as the literal URL of your project's Edge Functions base.

DO $migration$
BEGIN
  IF to_regnamespace('cron') IS NULL OR to_regnamespace('net') IS NULL THEN
    RAISE NOTICE 'Skipping outbox scheduler migration: pg_cron/pg_net schema is not available in this environment.';
    RETURN;
  END IF;

  -- Unschedule any previous version so this migration is idempotent
  PERFORM cron.unschedule('process-outbox-worker')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-outbox-worker'
  );

  PERFORM cron.schedule(
    'process-outbox-worker',
    '30 seconds',
    $job$
    SELECT net.http_post(
      url     := current_setting('app.supabase_functions_url', true)
                 || '/process-outbox',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
                 ),
      body    := '{}'::jsonb
    ) AS request_id;
    $job$
  );
END;
$migration$;
