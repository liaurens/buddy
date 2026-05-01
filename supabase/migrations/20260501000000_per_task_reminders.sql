-- Per-Task Reminders + Off-Track Escalation
-- Adds per-todo reminder fields and source tracking on scheduled_notifications.

-- Per-task reminder configuration
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_offset_minutes int,
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_cadence text DEFAULT 'smart'
    CHECK (reminder_cadence IN ('single', 'smart', 'aggressive')),
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz;

-- Source tracking on scheduled notifications so we can cancel/dedup by origin
ALTER TABLE scheduled_notifications
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS dedup_key text;

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_source
  ON scheduled_notifications(source_type, source_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_notifications_dedup
  ON scheduled_notifications(user_id, dedup_key)
  WHERE dedup_key IS NOT NULL AND status IN ('pending', 'sent');

-- Allow new tool_category values used by off-track scanner / per-task reminders.
ALTER TABLE scheduled_notifications
  DROP CONSTRAINT IF EXISTS scheduled_notifications_tool_category_check;

ALTER TABLE scheduled_notifications
  ADD CONSTRAINT scheduled_notifications_tool_category_check
  CHECK (tool_category IN (
    'tracker', 'protocol', 'checkin', 'experiment', 'tasks', 'notes',
    'calendar', 'planning', 'reflection', 'pomodoro', 'toolbox',
    'routine_morning', 'routine_midday', 'routine_night',
    'off_track'
  ));

COMMENT ON COLUMN todos.reminder_enabled IS 'When true, a per-task reminder is scheduled on save.';
COMMENT ON COLUMN todos.reminder_offset_minutes IS 'Minutes before due_date/due_time to fire the reminder (relative mode).';
COMMENT ON COLUMN todos.reminder_at IS 'Absolute datetime to fire the reminder. Overrides reminder_offset_minutes when set.';
COMMENT ON COLUMN todos.reminder_cadence IS 'Reminder cadence: single | smart (pre/at/+15m/+1h) | aggressive (+30m/+2h).';
COMMENT ON COLUMN scheduled_notifications.source_type IS 'Origin of this reminder: task | overdue | missed_routine | skipped_checkin | idle.';
COMMENT ON COLUMN scheduled_notifications.source_id IS 'FK-like ID of the originating row (todo.id, etc.) for cancellation.';
COMMENT ON COLUMN scheduled_notifications.dedup_key IS 'Idempotency key for off-track scanner; prevents duplicate reminders.';
