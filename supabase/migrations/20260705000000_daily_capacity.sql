-- Per-day capacity flag: the single "normal day or survival day?" switch.
--
-- Survival day = 1 morning pick instead of 3, non-anchor notifications
-- suppressed for the day (read server-side by schedule-notifications), and a
-- low-pressure pre-filled reflection. Lives on daily_plans so it dies with
-- the day — no setting to remember to switch back.

ALTER TABLE daily_plans
    ADD COLUMN IF NOT EXISTS capacity TEXT NOT NULL DEFAULT 'normal'
        CHECK (capacity IN ('normal', 'survival'));

COMMENT ON COLUMN daily_plans.capacity IS 'Self-declared day capacity. survival = 1 pick, non-anchor notifications suppressed.';
