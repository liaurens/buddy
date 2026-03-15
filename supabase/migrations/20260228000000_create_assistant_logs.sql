-- Assistant Logs: tracks every assistant interaction for debugging and analysis
CREATE TABLE IF NOT EXISTS assistant_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  input TEXT NOT NULL,
  detected_intent TEXT NOT NULL,
  detection_method TEXT NOT NULL CHECK (detection_method IN ('rule', 'ai')),
  response JSONB NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  latency_ms INTEGER,
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('iphone', 'web')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_assistant_logs_user_id ON assistant_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_logs_created_at ON assistant_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_logs_intent ON assistant_logs(detected_intent);
CREATE INDEX IF NOT EXISTS idx_assistant_logs_method ON assistant_logs(detection_method);

-- Row Level Security
ALTER TABLE assistant_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs"
  ON assistant_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
  ON assistant_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
