-- ============================================================================
-- "Close day" state
-- ============================================================================
-- The daily loop needs an explicit end: a one-tap close after the night
-- reflection. Stored on daily_plans (one row per user per date; the row is
-- upserted if no plan was generated that day).
-- ============================================================================

ALTER TABLE daily_plans
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

COMMENT ON COLUMN daily_plans.closed_at IS 'When the user explicitly closed this day (evening ritual). NULL = not closed.';

CREATE INDEX IF NOT EXISTS idx_daily_plans_closed
    ON daily_plans(user_id, date)
    WHERE closed_at IS NOT NULL;
