-- Google Calendar OAuth token storage
CREATE TABLE google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  email TEXT,             -- Google account email for display
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- Track which Google Calendar events have been turned into tasks
-- Prevents duplicate tasks on repeated syncs
CREATE TABLE google_calendar_synced_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
  event_start DATE NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, google_event_id)
);

-- RLS: users can only see their own tokens and sync records
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_synced_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own Google tokens"
  ON google_calendar_tokens FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage their own synced events"
  ON google_calendar_synced_events FOR ALL
  USING (auth.uid() = user_id);

-- Auto-update updated_at on token refresh
CREATE TRIGGER update_google_tokens_updated_at
  BEFORE UPDATE ON google_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup: remove old synced event records (>90 days) automatically
CREATE OR REPLACE FUNCTION cleanup_old_synced_events() RETURNS void AS $$
BEGIN
  DELETE FROM google_calendar_synced_events
  WHERE synced_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
