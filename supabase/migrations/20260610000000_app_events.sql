-- ============================================================================
-- App usage instrumentation
-- ============================================================================
-- Minimal event log so "I don't know why I'm not using it" becomes measurable:
-- app opens (and whether they came from a notification/share), route visits,
-- captures, and day closes. Used to decide which modules to freeze later.
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- e.g. 'app_open' | 'route_visit' | 'capture_submitted' | 'capture_synced' | 'day_closed'
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE app_events IS 'Lightweight client-side usage events (opens, route visits, captures, day closes)';
COMMENT ON COLUMN app_events.payload IS 'Event context, e.g. {"source":"notification"} for app_open or {"route":"tasks"} for route_visit';

CREATE INDEX IF NOT EXISTS idx_app_events_user_time ON app_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_user_type ON app_events(user_id, event_type, created_at DESC);

ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own app events"
    ON app_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own app events"
    ON app_events FOR SELECT
    USING (auth.uid() = user_id);
