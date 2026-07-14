ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS waiting_on text,
  ADD COLUMN IF NOT EXISTS start_date date;

ALTER TABLE public.task_types
  ADD COLUMN IF NOT EXISTS home_days smallint[];

ALTER TABLE public.todos DROP CONSTRAINT IF EXISTS todos_kind_check;
ALTER TABLE public.todos ADD CONSTRAINT todos_kind_check
  CHECK (kind IS NULL OR kind IN ('urgent', 'backlog', 'deadline', 'routine', 'standard', 'waiting'));

ALTER TABLE public.task_types DROP CONSTRAINT IF EXISTS task_types_home_days_check;
ALTER TABLE public.task_types ADD CONSTRAINT task_types_home_days_check
  CHECK (home_days IS NULL OR home_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]);

