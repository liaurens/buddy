-- Fix: the notification flusher cron has been sending an empty bearer token.
--
-- `20260130000000_setup_notification_cron.sql` built the Authorization header from
-- `current_setting('app.settings.service_role_key', true)`. That GUC has never been
-- set on this project, so the header was literally `Bearer ` (the later `coalesce`
-- only turned a NULL header into an empty-token header). While
-- `schedule-notifications` was deployed with `verify_jwt = false` this went
-- unnoticed; the 2026-07-04 redeploy flipped it to `verify_jwt = true` and from
-- that moment the Supabase gateway rejected every run with
--   401 {"code":"UNAUTHORIZED_INVALID_JWT_FORMAT","message":"Auth header is not 'Bearer {token}'"}
-- ...once per minute, so no scheduled notification has been pushed since
-- 2026-07-04 (last `notification_logs` row) while `scheduled_notifications`
-- accumulated a pending backlog.
--
-- Fix: send the project's publishable key, which is what CLAUDE.md already
-- documents for non-browser callers of a verify_jwt function. It is a public
-- client key (the same one shipped in the frontend bundle), so hardcoding it in a
-- migration leaks nothing — unlike the service role key it was standing in for.
-- The functions still authenticate real work with their own service-role env key.

DO $$
DECLARE
    -- Public, client-side key. Safe to commit; rotate via the Supabase dashboard
    -- and re-run this migration's body if it ever changes.
    publishable_key CONSTANT text := 'sb_publishable_s6w14E6z2hl5Bj9q9co1PQ_NjpHrLXH';
    -- NOT named `job`: that shadows the `cron.job` table and makes every
    -- `jobname` reference below ambiguous (42702).
    j RECORD;
BEGIN
    FOR j IN
        SELECT *
        FROM (VALUES
            ('send-pending-notifications', '* * * * *',   'schedule-notifications'),
            ('off-track-scanner',          '*/15 * * * *', 'off-track-scanner')
        ) AS t(jobname, schedule, fn)
    LOOP
        -- cron.schedule() upserts by name, but unschedule first so a rename or a
        -- half-applied earlier run cannot leave a duplicate behind.
        PERFORM cron.unschedule(j.jobname)
        WHERE EXISTS (SELECT 1 FROM cron.job c WHERE c.jobname = j.jobname);

        PERFORM cron.schedule(
            j.jobname,
            j.schedule,
            format(
                $cmd$
                SELECT net.http_post(
                    url := 'https://kdwgznfszbrysepsltua.supabase.co/functions/v1/%s',
                    headers := jsonb_build_object(
                        'Authorization', 'Bearer %s',
                        'Content-Type', 'application/json'
                    ),
                    timeout_milliseconds := 30000
                ) AS request_id;
                $cmd$,
                j.fn,
                publishable_key
            )
        );
    END LOOP;
END $$;
