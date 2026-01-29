-- Create Checklists Table
create table checklists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  name text not null,
  description text,
  emoji text,
  items jsonb default '[]'::jsonb,
  is_pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table checklists enable row level security;

-- Policies
create policy "Users can view their own checklists"
  on checklists for select
  using (auth.uid() = user_id);

create policy "Users can insert their own checklists"
  on checklists for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own checklists"
  on checklists for update
  using (auth.uid() = user_id);

create policy "Users can delete their own checklists"
  on checklists for delete
  using (auth.uid() = user_id);
