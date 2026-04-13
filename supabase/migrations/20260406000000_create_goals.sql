-- Goals table for the improvement domain
CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_goals_user ON goals(user_id);
CREATE INDEX idx_goals_status ON goals(user_id, status);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goals"
  ON goals FOR ALL USING (auth.uid() = user_id);

-- Service role (edge functions) can manage goals for any user
CREATE POLICY "Service can manage goals"
  ON goals FOR ALL USING (true);
