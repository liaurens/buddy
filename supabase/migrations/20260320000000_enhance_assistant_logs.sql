-- Enhance assistant_logs for the multi-agent architecture
-- Adds domain routing, tool tracking, structured errors, and AI call tracking

-- Add new columns
ALTER TABLE assistant_logs
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS tool_id TEXT,
  ADD COLUMN IF NOT EXISTS routing_method TEXT,
  ADD COLUMN IF NOT EXISTS error_details JSONB,
  ADD COLUMN IF NOT EXISTS ai_calls JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS processing_steps JSONB DEFAULT '[]';

-- Update detection_method check constraint to include new routing methods
ALTER TABLE assistant_logs DROP CONSTRAINT IF EXISTS assistant_logs_detection_method_check;
ALTER TABLE assistant_logs ADD CONSTRAINT assistant_logs_detection_method_check
  CHECK (detection_method IN ('rule', 'ai', 'command', 'legacy'));

-- Update source check constraint to include siri
ALTER TABLE assistant_logs DROP CONSTRAINT IF EXISTS assistant_logs_source_check;
ALTER TABLE assistant_logs ADD CONSTRAINT assistant_logs_source_check
  CHECK (source IN ('iphone', 'web', 'siri'));

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_assistant_logs_domain ON assistant_logs(domain);
CREATE INDEX IF NOT EXISTS idx_assistant_logs_routing_method ON assistant_logs(routing_method);
CREATE INDEX IF NOT EXISTS idx_assistant_logs_tool_id ON assistant_logs(tool_id);
