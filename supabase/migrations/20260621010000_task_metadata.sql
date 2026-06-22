-- Task metadata for self-sorting capture.
--
--   hardness            'fixed' = tied to a real moment, planner locks it & reminders escalate;
--                       'flexible' = reschedulable. NULL = unknown (treated as flexible).
--   auto_triaged        TRUE  = AI routed this without human confirmation. Drives the "I sorted
--                       these" review section; cleared once the user confirms or corrects.
--   triage_destination  the destination the task was routed to ('urgent'/'today'/'someday'/
--                       'school'/'routine'). Persisted so the review UI can show "where it went"
--                       and so loose school tasks (triage_destination='school' AND
--                       assignment_id IS NULL) can be found by school planning.

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS hardness text,
  ADD COLUMN IF NOT EXISTS auto_triaged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS triage_destination text;

-- Loose school tasks are looked up by destination + missing assignment, per user.
CREATE INDEX IF NOT EXISTS idx_todos_loose_school
  ON todos(user_id)
  WHERE triage_destination = 'school' AND assignment_id IS NULL AND completed = false;

COMMENT ON COLUMN todos.hardness IS 'fixed (planner locks it) | flexible (reschedulable) | NULL';
COMMENT ON COLUMN todos.auto_triaged IS 'TRUE = AI-applied without confirmation; cleared on confirm/correct.';
COMMENT ON COLUMN todos.triage_destination IS 'Destination the task was routed to by triage.';
