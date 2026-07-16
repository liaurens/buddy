-- Smart Tasks: separate workflow planning from real deadlines.
-- Legacy columns remain in place for backwards-compatible reads.

ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS flag text,
  ADD COLUMN IF NOT EXISTS planned_for date,
  ADD COLUMN IF NOT EXISTS triage_source text,
  ADD COLUMN IF NOT EXISTS triage_confidence real,
  ADD COLUMN IF NOT EXISTS triage_reason text;

ALTER TABLE public.todos DROP CONSTRAINT IF EXISTS todos_flag_check;
ALTER TABLE public.todos ADD CONSTRAINT todos_flag_check
  CHECK (flag IS NULL OR flag IN (
    'urgent', 'today', 'deadline', 'waiting', 'school', 'routine', 'someday'
  ));

ALTER TABLE public.todos DROP CONSTRAINT IF EXISTS todos_triage_source_check;
ALTER TABLE public.todos ADD CONSTRAINT todos_triage_source_check
  CHECK (triage_source IS NULL OR triage_source IN ('explicit', 'parser', 'ai', 'manual'));

ALTER TABLE public.todos DROP CONSTRAINT IF EXISTS todos_triage_confidence_check;
ALTER TABLE public.todos ADD CONSTRAINT todos_triage_confidence_check
  CHECK (triage_confidence IS NULL OR triage_confidence BETWEEN 0 AND 1);

-- Backfill the single flag from the strongest legacy signal first.
UPDATE public.todos
SET flag = CASE
  WHEN assignment_id IS NOT NULL OR triage_destination = 'school' THEN 'school'
  WHEN kind = 'waiting' OR waiting_on IS NOT NULL THEN 'waiting'
  WHEN kind = 'routine' OR (recurrence IS NOT NULL AND recurrence <> 'none') THEN 'routine'
  WHEN kind = 'urgent' OR priority = 'urgent' OR triage_destination = 'urgent' THEN 'urgent'
  WHEN kind = 'deadline' THEN 'deadline'
  WHEN kind = 'standard' OR triage_destination = 'today' THEN 'today'
  WHEN kind = 'backlog' OR triage_destination = 'someday' THEN 'someday'
  WHEN due_date IS NOT NULL THEN 'deadline'
  ELSE 'someday'
END
WHERE flag IS NULL;

-- Copy dates only where legacy intent clearly meant a scheduled workday.
-- due_date is intentionally retained: ambiguous rows must not lose deadline data.
UPDATE public.todos
SET planned_for = due_date
WHERE planned_for IS NULL
  AND due_date IS NOT NULL
  AND (
    kind IN ('standard', 'urgent', 'routine', 'waiting')
    OR triage_destination IN ('today', 'urgent', 'routine')
  );

UPDATE public.todos
SET triage_source = CASE WHEN auto_triaged THEN 'ai' ELSE 'manual' END
WHERE triage_source IS NULL AND triaged_at IS NOT NULL;

ALTER TABLE public.todos ALTER COLUMN flag SET DEFAULT 'someday';
ALTER TABLE public.todos ALTER COLUMN flag SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_todos_user_flag_active
  ON public.todos(user_id, flag)
  WHERE completed = false;

CREATE INDEX IF NOT EXISTS idx_todos_user_planned_active
  ON public.todos(user_id, planned_for)
  WHERE completed = false AND planned_for IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_todos_user_deadline_active
  ON public.todos(user_id, due_date)
  WHERE completed = false AND due_date IS NOT NULL;

COMMENT ON COLUMN public.todos.flag IS 'Canonical workflow flag; exactly one per task.';
COMMENT ON COLUMN public.todos.planned_for IS 'Workday where the task appears in the plan; independent of due_date.';
COMMENT ON COLUMN public.todos.due_date IS 'Real deadline only. Use planned_for for scheduling.';
