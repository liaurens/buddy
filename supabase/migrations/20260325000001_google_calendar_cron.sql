-- Daily Google Calendar sync at 7:00 AM UTC
-- Calls the google-calendar-sync edge function for all users

SELECT cron.schedule(
  'sync-google-calendar-daily',
  '0 7 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://kdwgznfszbrysepsltua.supabase.co/functions/v1/google-calendar-sync',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type',
        'application/json'
      )
    ) AS request_id;
  $$
);

-- Weekly cleanup of old synced event records
SELECT cron.schedule(
  'cleanup-synced-calendar-events',
  '0 4 * * 0',
  'SELECT cleanup_old_synced_events();'
);
