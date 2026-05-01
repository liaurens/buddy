-- Schedule the off-track-scanner Edge Function every 15 minutes.
-- Detects overdue tasks, missed routines, skipped check-ins, and idleness,
-- enqueueing reminders into scheduled_notifications.

SELECT cron.schedule(
  'off-track-scanner',
  '*/15 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://kdwgznfszbrysepsltua.supabase.co/functions/v1/off-track-scanner',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type',
        'application/json'
      )
    ) AS request_id;
  $$
);
