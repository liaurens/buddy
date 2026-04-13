-- Migration: add recurrence fields to todos table

alter table todos
  add column if not exists recurrence text not null default 'none'
    check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'weekdays')),
  add column if not exists recurrence_config jsonb default null;

create index if not exists idx_todos_recurrence
  on todos (user_id, recurrence)
  where recurrence <> 'none';

comment on column todos.recurrence is
  'Recurrence pattern: none | daily | weekly | monthly | weekdays';
comment on column todos.recurrence_config is
  'Config JSON: { daysOfWeek?: number[] (0=Sun..6=Sat), interval?: number }';
