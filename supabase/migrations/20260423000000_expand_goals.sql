ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS goal_type TEXT DEFAULT 'progress'
    CHECK (goal_type IN ('time', 'action', 'progress', 'habit')),
  ADD COLUMN IF NOT EXISTS target_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS goal_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT false,
  minutes_spent INTEGER,
  progress_delta INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_logs_goal_date ON goal_logs(goal_id, date);
ALTER TABLE goal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goal_logs"
  ON goal_logs FOR ALL USING (auth.uid() = user_id);
