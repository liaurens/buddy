-- Stuck-signal tracking on todos.
--
-- A task that keeps getting pushed (snooze_count) or sits untouched past its
-- date (last_touched_at) is stuck — the UI surfaces a one-tap "split this"
-- affordance at that moment (the point of avoidance) instead of hoping the
-- user remembers the AI splitter exists.

ALTER TABLE todos
    ADD COLUMN IF NOT EXISTS snooze_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_touched_at TIMESTAMPTZ;

COMMENT ON COLUMN todos.snooze_count IS 'Times pushed to a later date while incomplete. Stuck signal.';
COMMENT ON COLUMN todos.last_touched_at IS 'Last user interaction (edit/toggle/start/reschedule). NULL = fall back to created_at.';
