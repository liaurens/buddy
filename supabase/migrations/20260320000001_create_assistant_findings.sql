-- Assistant Findings: HR agent analysis output
-- Stores patterns, error clusters, and usage trends discovered from logs

CREATE TABLE IF NOT EXISTS assistant_findings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'unmatched_pattern',    -- inputs that fell through to AI or defaulted
    'error_cluster',        -- repeated errors from specific tools/domains
    'slow_route',           -- high latency requests
    'usage_trend',          -- command/domain usage patterns
    'ai_cost'               -- token usage trends
  )),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  data JSONB NOT NULL,
  -- Example data per type:
  -- 'unmatched_pattern': { "summary": "...", "examples": ["..."], "count": 5, "proposed_rule": {...} }
  -- 'error_cluster':     { "summary": "...", "domain": "planning", "tool_id": "tasks", "error_count": 10 }
  -- 'slow_route':        { "summary": "...", "avg_latency_ms": 2000, "examples": [...] }
  -- 'usage_trend':       { "summary": "...", "domain_counts": {...}, "command_counts": {...} }
  -- 'ai_cost':           { "summary": "...", "total_tokens": 5000, "total_calls": 50 }
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'applied', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assistant_findings_user_id ON assistant_findings(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_findings_status ON assistant_findings(status);
CREATE INDEX IF NOT EXISTS idx_assistant_findings_type ON assistant_findings(type);
CREATE INDEX IF NOT EXISTS idx_assistant_findings_created_at ON assistant_findings(created_at DESC);

-- Row Level Security
ALTER TABLE assistant_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own findings"
  ON assistant_findings FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert/update (HR and Trainer agents use service key)
CREATE POLICY "Service can manage findings"
  ON assistant_findings FOR ALL
  USING (true)
  WITH CHECK (true);
