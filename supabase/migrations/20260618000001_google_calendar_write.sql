-- Google Calendar WRITE integration.
-- A service-role-only token vault + todo→event mapping so scheduled tasks land
-- in the user's real Google Calendar.

-- 1. Token vault. Tokens are written/read ONLY by edge functions (service role).
CREATE TABLE IF NOT EXISTS google_calendar_credentials (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token text,
    refresh_token text,
    access_token_expires_at timestamptz,
    scope text,
    google_email text,
    default_calendar_id text NOT NULL DEFAULT 'primary',
    status text NOT NULL DEFAULT 'connected'
        CHECK (status IN ('connected', 'revoked', 'error')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_calendar_credentials ENABLE ROW LEVEL SECURITY;

-- The frontend may read its own connection metadata (email/status) but NEVER the tokens.
CREATE POLICY "Users can view own google calendar connection"
    ON google_calendar_credentials FOR SELECT USING (auth.uid() = user_id);

-- Hard guarantee: even with a crafted query, the browser keys cannot read token columns.
REVOKE SELECT (access_token, refresh_token) ON google_calendar_credentials FROM anon, authenticated;

-- No INSERT/UPDATE/DELETE policies: only the service role (edge functions) mutates this table.

CREATE TRIGGER trigger_google_calendar_credentials_updated_at
    BEFORE UPDATE ON google_calendar_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE google_calendar_credentials IS 'Per-user Google OAuth tokens for Calendar write. Service-role only; token columns revoked from anon/authenticated.';

-- 2. Map a todo to its Google Calendar event for idempotent sync.
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_calendar_id text,
  ADD COLUMN IF NOT EXISTS google_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_todos_google_event
  ON todos(user_id, google_event_id)
  WHERE google_event_id IS NOT NULL;

COMMENT ON COLUMN todos.google_event_id IS 'Google Calendar event id (deterministic from todo id) when synced.';
COMMENT ON COLUMN todos.google_calendar_id IS 'Google calendar the event lives in (usually primary).';
COMMENT ON COLUMN todos.google_synced_at IS 'Last successful Google Calendar sync timestamp.';

-- 3. Allow 'google' as a calendar_events source (for optional local mirroring; no round-trip import).
ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_source_check;

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_source_check
  CHECK (source IN ('ical', 'caldav', 'manual', 'google'));
