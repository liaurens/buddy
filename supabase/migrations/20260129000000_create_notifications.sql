-- Notification System Tables
-- Supports cross-platform push notifications (iOS, Windows, etc.)

-- Table: notification_subscriptions
-- Stores user device push notification subscriptions (Web Push API)
CREATE TABLE notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_type TEXT CHECK (device_type IN ('ios', 'android', 'windows', 'mac', 'other')),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Table: scheduled_notifications
-- Stores notifications to be sent at specific times
CREATE TABLE scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_category TEXT NOT NULL CHECK (tool_category IN ('tracker', 'protocol', 'checkin', 'experiment', 'tasks', 'notes', 'calendar', 'planning', 'reflection', 'pomodoro', 'toolbox')),
  notification_type TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT
);

-- Table: notification_logs
-- Audit log for sent notifications (debugging and analytics)
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES notification_subscriptions(id) ON DELETE SET NULL,
  scheduled_notification_id UUID REFERENCES scheduled_notifications(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'clicked', 'dismissed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notification_subscriptions_user
  ON notification_subscriptions(user_id);

CREATE INDEX idx_notification_subscriptions_last_used
  ON notification_subscriptions(last_used_at DESC);

CREATE INDEX idx_scheduled_notifications_user
  ON scheduled_notifications(user_id);

CREATE INDEX idx_scheduled_notifications_pending
  ON scheduled_notifications(scheduled_for)
  WHERE status = 'pending';

CREATE INDEX idx_scheduled_notifications_status
  ON scheduled_notifications(status, scheduled_for);

CREATE INDEX idx_notification_logs_user
  ON notification_logs(user_id, created_at DESC);

CREATE INDEX idx_notification_logs_scheduled
  ON notification_logs(scheduled_notification_id);

-- Row Level Security (RLS) Policies

-- notification_subscriptions policies
ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
  ON notification_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON notification_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON notification_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON notification_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- scheduled_notifications policies
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduled notifications"
  ON scheduled_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scheduled notifications"
  ON scheduled_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled notifications"
  ON scheduled_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled notifications"
  ON scheduled_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- notification_logs policies
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification logs"
  ON notification_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert notification logs"
  ON notification_logs FOR INSERT
  WITH CHECK (true); -- Edge functions will insert logs

-- Function to clean up old notification logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notification_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM notification_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired subscriptions (inactive for 90 days)
CREATE OR REPLACE FUNCTION cleanup_inactive_subscriptions()
RETURNS void AS $$
BEGIN
  DELETE FROM notification_subscriptions
  WHERE last_used_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE notification_subscriptions IS 'Stores Web Push API subscription endpoints for each user device';
COMMENT ON TABLE scheduled_notifications IS 'Notifications scheduled to be sent at specific times';
COMMENT ON TABLE notification_logs IS 'Audit log of all notification delivery attempts';

COMMENT ON COLUMN notification_subscriptions.endpoint IS 'Web Push API endpoint URL';
COMMENT ON COLUMN notification_subscriptions.p256dh IS 'Public key for message encryption';
COMMENT ON COLUMN notification_subscriptions.auth IS 'Authentication secret for encryption';
COMMENT ON COLUMN scheduled_notifications.tool_category IS 'Which tool/feature triggered this notification';
COMMENT ON COLUMN scheduled_notifications.data IS 'Custom JSON payload for notification actions';
