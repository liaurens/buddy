-- Collapse the task vocabulary onto `flag`.
--
-- The 2026-08-16 audit found the same seven concepts modelled three times:
--   flag                (84/84 rows) — canonical, derived on every read
--   kind                (19/84 rows) — legacy, renamed values (today→standard, someday→backlog)
--   triage_destination  (24/84 rows) — a third mirror written only by triage
-- plus three meta tables and three mutually-inconsistent orderings in the app.
-- Every populated kind/triage_destination value was verified consistent with its
-- row's flag before this migration, so nothing unique is lost.
--
-- Also drops three columns that have never held a value in this database:
--   labels             — superseded by task_type_id
--   project_id         — orphan; never present in DbTodo or the converter
--   historical_minutes — the duration-learning array, never written
--
-- Deliberately KEPT (wanted, pending design): subtasks, start_date,
-- parent_todo_id, notes, google_event_id / google_calendar_id / google_synced_at.

BEGIN;

-- 1. Safety net. Every row should already have a flag; derive one for any that
--    does not, so the NOT NULL below cannot fail on another environment.
UPDATE todos
SET flag = CASE
        WHEN assignment_id IS NOT NULL OR triage_destination = 'school' OR kind = 'school'
            THEN 'school'
        WHEN waiting_on IS NOT NULL OR kind = 'waiting' THEN 'waiting'
        WHEN recurrence IS NOT NULL AND recurrence <> 'none' THEN 'routine'
        WHEN kind = 'routine' THEN 'routine'
        WHEN priority = 'urgent' OR kind = 'urgent' THEN 'urgent'
        WHEN kind = 'deadline' THEN 'deadline'
        WHEN planned_for IS NOT NULL OR kind = 'standard' OR triage_destination = 'today'
            THEN 'today'
        WHEN due_date IS NOT NULL THEN 'deadline'
        ELSE 'someday'
    END
WHERE flag IS NULL;

-- 2. Drop the redundant vocabularies and the never-used columns.
ALTER TABLE todos DROP CONSTRAINT IF EXISTS todos_kind_check;

ALTER TABLE todos
    DROP COLUMN IF EXISTS kind,
    DROP COLUMN IF EXISTS triage_destination,
    DROP COLUMN IF EXISTS labels,
    DROP COLUMN IF EXISTS project_id,
    DROP COLUMN IF EXISTS historical_minutes;

-- 3. `flag` is now the single classification — make that a database guarantee,
--    so application code never has to wonder whether a stored row has one.
ALTER TABLE todos ALTER COLUMN flag SET NOT NULL;

ALTER TABLE todos DROP CONSTRAINT IF EXISTS todos_flag_check;
ALTER TABLE todos ADD CONSTRAINT todos_flag_check CHECK (
    flag IN ('urgent', 'today', 'deadline', 'waiting', 'school', 'routine', 'someday')
);

-- 4. The two-tier task picker and every count badge filter on (user_id, flag)
--    over active rows; the capture inbox filters on a null triaged_at.
CREATE INDEX IF NOT EXISTS todos_user_flag_active_idx
    ON todos (user_id, flag)
    WHERE completed = false;

COMMIT;
