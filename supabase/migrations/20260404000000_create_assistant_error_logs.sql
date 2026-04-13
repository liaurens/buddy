-- Dedicated error logging for the assistant pipeline.
-- Captures every error with full context for debugging and future self-learning.

CREATE TABLE IF NOT EXISTS assistant_error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  input TEXT NOT NULL,
  error_type TEXT NOT NULL CHECK (error_type IN ('routing_error', 'execution_error', 'ai_error', 'validation_error', 'auth_error')),
  error_message TEXT NOT NULL,
  error_stack TEXT,
  step TEXT NOT NULL CHECK (step IN ('routing', 'execution', 'ai_classification', 'ai_conversation', 'parsing', 'auth', 'validation')),
  domain TEXT,
  intent TEXT,
  routing_method TEXT,
  ai_provider TEXT,
  ai_model TEXT,
  request_metadata JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT false,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX idx_error_logs_user ON assistant_error_logs(user_id);
CREATE INDEX idx_error_logs_type ON assistant_error_logs(error_type);
CREATE INDEX idx_error_logs_step ON assistant_error_logs(step);
CREATE INDEX idx_error_logs_created ON assistant_error_logs(created_at DESC);
CREATE INDEX idx_error_logs_unresolved ON assistant_error_logs(resolved) WHERE resolved = false;

-- Row Level Security
ALTER TABLE assistant_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own error logs"
  ON assistant_error_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (edge functions) bypasses RLS, but we need an INSERT policy
-- for the anon key path. Using permissive insert since edge functions use service role.
CREATE POLICY "Service can insert error logs"
  ON assistant_error_logs FOR INSERT
  WITH CHECK (true);
