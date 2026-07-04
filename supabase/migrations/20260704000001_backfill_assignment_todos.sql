-- Backfill linked todos for existing open assignments that don't have one yet.
--
-- Every assignment now mirrors onto a todo (todos.assignment_id) so school
-- deadlines live on the main task surface. New assignments get their todo at
-- creation time (client hook + school-import edge fn); this catches the
-- pre-existing rows. Field shape mirrors buildAssignmentTodo
-- (src/features/school/utils/assignmentTodo.ts).
--
-- Timezone note: deadlines are timestamptz; the app derives the local date.
-- Europe/Amsterdam matches the account_timezone default used by the
-- notification pipeline.

INSERT INTO todos (
    id, user_id, title, completed, created_at, due_date,
    kind, priority, estimated_time, assignment_id,
    triage_destination, triaged_at, recurrence
)
SELECT
    gen_random_uuid(),
    a.user_id,
    a.title,
    false,
    now(),
    (a.deadline AT TIME ZONE 'Europe/Amsterdam')::date,
    'deadline',
    'medium',
    a.estimated_minutes,
    a.id,
    'school',
    now(),
    'none'
FROM assignments a
WHERE a.status IN ('pending', 'in_progress')
  AND NOT EXISTS (
      SELECT 1 FROM todos t WHERE t.assignment_id = a.id
  );
