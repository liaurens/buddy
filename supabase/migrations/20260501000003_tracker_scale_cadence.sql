-- Tracker scale + cadence redesign
-- Adds:
--   * cadence  — 'daily' | 'episodic' | 'weekly' (controls whether the tracker
--                appears in the daily check-in grid or only as an episodic chip)
--   * scale    — JSONB { min, max, step?, lowLabel, highLabel, direction }
--                so rating/number trackers can render with explicit endpoint
--                labels and a direction-aware UI ("higher = better" vs not).

ALTER TABLE trackers
    ADD COLUMN IF NOT EXISTS cadence text NOT NULL DEFAULT 'daily',
    ADD COLUMN IF NOT EXISTS scale   jsonb;

-- Backfill scale for existing rating-type trackers so the new UI renders
-- without requiring users to edit each one.
UPDATE trackers
SET scale = jsonb_build_object(
    'min', 1,
    'max', 10,
    'step', 1,
    'lowLabel', 'Low',
    'highLabel', 'High',
    'direction', 'higher_better'
)
WHERE type = 'rating' AND scale IS NULL;
