-- Task triage — track whether a captured task has been sorted into a destination.
--
-- The capture inbox = active, not completed, triaged_at IS NULL. The morning
-- triage router (and the standalone Sort flow) stamp triaged_at when a task is
-- routed to a destination (urgent / today / someday / school / routine).

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS triaged_at timestamptz;

-- Backfill: treat every existing task as already triaged so the inbox starts
-- empty rather than flooding with the user's whole backlog on first run.
UPDATE todos SET triaged_at = created_at WHERE triaged_at IS NULL;

-- Inbox lookups are "untriaged + active for this user".
CREATE INDEX IF NOT EXISTS idx_todos_untriaged
  ON todos(user_id)
  WHERE triaged_at IS NULL AND completed = false;

COMMENT ON COLUMN todos.triaged_at IS 'When the task was routed by triage. NULL = still in the capture inbox.';
