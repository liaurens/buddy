-- Assistant Learnings: self-learning storage for the Reflection Agent
CREATE TABLE IF NOT EXISTS assistant_learnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('new_rule', 'correction', 'behavior', 'note')),
  content JSONB NOT NULL,
  -- Examples of content per type:
  -- 'new_rule':   { "pattern": "boodsch*", "intent": "note.create.shopping", "confidence": 0.9 }
  -- 'correction': { "input": "...", "wrong_intent": "...", "correct_intent": "..." }
  -- 'behavior':   { "description": "Creates tasks in morning", "confidence": 0.85 }
  -- 'note':       { "text": "Missing: recurring task support", "source": "reflection" | "user" }
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assistant_learnings_user_id ON assistant_learnings(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_learnings_type ON assistant_learnings(type);
CREATE INDEX IF NOT EXISTS idx_assistant_learnings_active ON assistant_learnings(user_id, active);

-- Row Level Security
ALTER TABLE assistant_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own learnings"
  ON assistant_learnings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_assistant_learnings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assistant_learnings_updated_at
  BEFORE UPDATE ON assistant_learnings
  FOR EACH ROW EXECUTE FUNCTION update_assistant_learnings_updated_at();
