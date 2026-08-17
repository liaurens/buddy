-- One-off drain of the backlog left by the cron auth outage.
--
-- Between 2026-07-04 and 2026-08-14 the `send-pending-notifications` cron was
-- rejected by the gateway on every run (see
-- 20260814000002_fix_notification_cron_auth.sql), so `off-track-scanner` kept
-- enqueueing nudges that nothing ever flushed: 348 pending rows, the oldest from
-- 2026-07-05. Delivering those now would mean a wall of six-week-old
-- "you have an overdue task" pings, three per hour for days.
--
-- Retire every non-anchor row that predates the fix. The three routine anchors
-- (morning/midday/night, already queued for 2026-08-15) are deliberately left
-- pending — they are the rhythm the user actually wants back.
--
-- Going forward this stays drained on its own: schedule-notifications now expires
-- anything more than MAX_STALENESS_MINUTES past its scheduled time instead of
-- delivering it late.

UPDATE scheduled_notifications
SET status = 'cancelled',
    error_message = 'Expired: cron auth outage backlog (2026-07-04 to 2026-08-14)'
WHERE status = 'pending'
  AND notification_type <> 'routine_reminder'
  AND created_at < TIMESTAMPTZ '2026-08-14 21:00:00+00';
