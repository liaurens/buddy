-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule notification checker to run every minute
-- This will trigger the schedule-notifications Edge Function
SELECT cron.schedule(
  'send-pending-notifications',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
      url := 'https://kdwgznfszbrysepsltua.supabase.co/functions/v1/schedule-notifications',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type',
        'application/json'
      )
    ) AS request_id;
  $$
);

-- Optional: Clean up old logs weekly (Sundays at 2 AM)
SELECT cron.schedule(
  'cleanup-notification-logs',
  '0 2 * * 0',
  'SELECT cleanup_old_notification_logs();'
);

-- Optional: Clean up inactive subscriptions weekly (Sundays at 3 AM)
SELECT cron.schedule(
  'cleanup-inactive-subscriptions',
  '0 3 * * 0',
  'SELECT cleanup_inactive_subscriptions();'
);
