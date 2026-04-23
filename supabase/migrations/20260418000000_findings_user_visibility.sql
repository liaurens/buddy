-- Phase 4: surface assistant findings to the user.
-- Adds visibility flag, severity tier, and a dismissed-at marker.

-- Note: `severity` column already exists (info | warning | critical) for the dev panel.
-- We don't constrain it further so analyzers can keep their existing vocabulary;
-- the frontend maps unknown values to 'info' for styling.

ALTER TABLE assistant_findings
    ADD COLUMN IF NOT EXISTS user_visible boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS seen_at timestamptz;

CREATE INDEX IF NOT EXISTS assistant_findings_unseen_visible_idx
    ON assistant_findings (user_id, created_at DESC)
    WHERE user_visible = true AND seen_at IS NULL;
