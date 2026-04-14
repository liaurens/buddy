-- Planner tool: per-day user context (hours_available, feel, medication_taken, focus_rating)
alter table public.daily_plans
  add column if not exists user_context jsonb;

comment on column public.daily_plans.user_context is
  'Planner tool inputs: { hours_available, feel, medication_taken, focus_rating, mode }';
