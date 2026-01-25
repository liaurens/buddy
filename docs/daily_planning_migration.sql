-- ============================================================================
-- Daily Planning System - Database Migration
-- ============================================================================
-- Run this in Supabase SQL Editor to add daily planning tables
--
-- Features:
-- - Daily plans with AI-generated time blocks
-- - Activity templates for recurring tasks
-- - Calendar event caching
-- - Time tracking and historical learning
-- ============================================================================

-- ============================================================================
-- 1. DAILY PLANS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Context at plan generation time
    mood_at_plan_time SMALLINT CHECK (mood_at_plan_time >= 1 AND mood_at_plan_time <= 10),
    energy_at_plan_time SMALLINT CHECK (energy_at_plan_time >= 1 AND energy_at_plan_time <= 10),
    sleep_hours_at_plan_time NUMERIC(3,1) CHECK (sleep_hours_at_plan_time >= 0 AND sleep_hours_at_plan_time <= 24),

    -- AI metadata
    ai_prompt_used TEXT,
    ai_model_used TEXT,
    ai_reasoning TEXT,
    ai_warnings TEXT[],

    -- Plan lifecycle
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'abandoned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    -- Constraints
    UNIQUE(user_id, date)
);

COMMENT ON TABLE daily_plans IS 'AI-generated daily plans with context and metadata';
COMMENT ON COLUMN daily_plans.mood_at_plan_time IS 'User mood (1-10) when plan was generated';
COMMENT ON COLUMN daily_plans.energy_at_plan_time IS 'User energy (1-10) when plan was generated';
COMMENT ON COLUMN daily_plans.ai_reasoning IS 'AI explanation of why the plan was structured this way';
COMMENT ON COLUMN daily_plans.ai_warnings IS 'AI warnings like "Schedule is tight" or "Consider buffer time"';

-- ============================================================================
-- 2. TIME BLOCKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS time_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,

    -- References (at least one should be set)
    task_id UUID REFERENCES todos(id) ON DELETE SET NULL,
    activity_template_id UUID,  -- Will reference activity_templates once created
    calendar_event_id UUID,     -- Will reference calendar_events once created

    -- Block details
    title TEXT NOT NULL,
    description TEXT,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- Time tracking
    estimated_minutes INT NOT NULL CHECK (estimated_minutes > 0),
    actual_minutes INT CHECK (actual_minutes >= 0),

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'skipped', 'rescheduled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,

    -- Ordering
    sort_order INT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    -- Constraints
    CHECK (end_time > start_time),
    CHECK (
        (task_id IS NOT NULL) OR
        (activity_template_id IS NOT NULL) OR
        (calendar_event_id IS NOT NULL) OR
        (title IS NOT NULL)
    )
);

COMMENT ON TABLE time_blocks IS 'Individual time blocks within a daily plan';
COMMENT ON COLUMN time_blocks.task_id IS 'Reference to todo task if block is for a task';
COMMENT ON COLUMN time_blocks.activity_template_id IS 'Reference to activity template if block is for recurring activity';
COMMENT ON COLUMN time_blocks.calendar_event_id IS 'Reference to calendar event if block is from calendar';
COMMENT ON COLUMN time_blocks.actual_minutes IS 'Actual time spent (tracked via timer)';
COMMENT ON COLUMN time_blocks.sort_order IS 'Order of blocks in the day (0-based)';

-- ============================================================================
-- 3. ACTIVITY TEMPLATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Template details
    name TEXT NOT NULL,
    emoji TEXT,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
        'routine', 'chore', 'health', 'work', 'leisure', 'transit', 'meal', 'other'
    )),

    -- Duration estimates
    default_minutes INT NOT NULL DEFAULT 30 CHECK (default_minutes > 0),
    historical_minutes INT[],  -- Array of past actual durations
    average_minutes INT,       -- Computed average from historical data

    -- Scheduling preferences
    frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly', 'as-needed')),
    preferred_time_slot TEXT CHECK (preferred_time_slot IN ('morning', 'afternoon', 'evening', 'any')),
    preferred_start_time TIME,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

COMMENT ON TABLE activity_templates IS 'Reusable templates for recurring activities';
COMMENT ON COLUMN activity_templates.historical_minutes IS 'Last 10-20 actual durations for learning';
COMMENT ON COLUMN activity_templates.average_minutes IS 'Computed average from historical_minutes array';
COMMENT ON COLUMN activity_templates.preferred_time_slot IS 'When user prefers to do this activity';

-- ============================================================================
-- 4. CALENDAR EVENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Event details
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,

    -- Timing
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,

    -- Travel considerations
    travel_time_minutes INT CHECK (travel_time_minutes >= 0),
    travel_from_location TEXT,

    -- Source tracking
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('ical', 'caldav', 'manual')),
    external_id TEXT,          -- ID from external calendar
    calendar_name TEXT,        -- Which calendar it came from

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ,     -- Last sync time

    -- Constraints
    CHECK (end_time > start_time),
    UNIQUE(user_id, external_id, source)
);

COMMENT ON TABLE calendar_events IS 'Cached calendar events from external sources (iCal/CalDAV)';
COMMENT ON COLUMN calendar_events.travel_time_minutes IS 'Buffer time needed before event';
COMMENT ON COLUMN calendar_events.external_id IS 'UID from iCal or external calendar system';
COMMENT ON COLUMN calendar_events.synced_at IS 'Last time this event was synced from external calendar';

-- ============================================================================
-- 5. EXTEND TODOS TABLE FOR TIME TRACKING
-- ============================================================================
-- Add new columns to existing todos table for time tracking
ALTER TABLE todos
    ADD COLUMN IF NOT EXISTS actual_minutes INT CHECK (actual_minutes >= 0),
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS historical_minutes INT[];

COMMENT ON COLUMN todos.actual_minutes IS 'Actual time spent when completed (tracked via timer)';
COMMENT ON COLUMN todos.started_at IS 'Timestamp when task was started';
COMMENT ON COLUMN todos.completed_at IS 'Timestamp when task was completed';
COMMENT ON COLUMN todos.historical_minutes IS 'Previous durations for learning (last 5-10 times)';

-- ============================================================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Daily plans indexes
CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_plans_status ON daily_plans(user_id, status);

-- Time blocks indexes
CREATE INDEX IF NOT EXISTS idx_time_blocks_plan ON time_blocks(plan_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_time_blocks_task ON time_blocks(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_blocks_status ON time_blocks(user_id, status);

-- Activity templates indexes
CREATE INDEX IF NOT EXISTS idx_activity_templates_user ON activity_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_templates_active ON activity_templates(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_activity_templates_category ON activity_templates(user_id, category);

-- Calendar events indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time ON calendar_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_external ON calendar_events(user_id, external_id, source);
-- Note: Removed DATE(start_time) index due to immutability issues with timestamptz
-- The idx_calendar_events_user_time index above is sufficient for date-based queries

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Daily Plans Policies
CREATE POLICY "Users can view their own daily plans"
    ON daily_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily plans"
    ON daily_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily plans"
    ON daily_plans FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily plans"
    ON daily_plans FOR DELETE
    USING (auth.uid() = user_id);

-- Time Blocks Policies
CREATE POLICY "Users can view their own time blocks"
    ON time_blocks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own time blocks"
    ON time_blocks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time blocks"
    ON time_blocks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time blocks"
    ON time_blocks FOR DELETE
    USING (auth.uid() = user_id);

-- Activity Templates Policies
CREATE POLICY "Users can view their own activity templates"
    ON activity_templates FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity templates"
    ON activity_templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity templates"
    ON activity_templates FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity templates"
    ON activity_templates FOR DELETE
    USING (auth.uid() = user_id);

-- Calendar Events Policies
CREATE POLICY "Users can view their own calendar events"
    ON calendar_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar events"
    ON calendar_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events"
    ON calendar_events FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events"
    ON calendar_events FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 8. UTILITY FUNCTIONS
-- ============================================================================

-- Function to update average_minutes when historical_minutes changes
CREATE OR REPLACE FUNCTION update_activity_template_average()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.historical_minutes IS NOT NULL AND array_length(NEW.historical_minutes, 1) > 0 THEN
        NEW.average_minutes := (
            SELECT ROUND(AVG(val))::INT
            FROM unnest(NEW.historical_minutes) AS val
        );
    ELSE
        NEW.average_minutes := NEW.default_minutes;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update average_minutes
DROP TRIGGER IF EXISTS trigger_update_activity_average ON activity_templates;
CREATE TRIGGER trigger_update_activity_average
    BEFORE INSERT OR UPDATE OF historical_minutes
    ON activity_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_activity_template_average();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_daily_plans_updated_at ON daily_plans;
CREATE TRIGGER trigger_daily_plans_updated_at
    BEFORE UPDATE ON daily_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_time_blocks_updated_at ON time_blocks;
CREATE TRIGGER trigger_time_blocks_updated_at
    BEFORE UPDATE ON time_blocks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_activity_templates_updated_at ON activity_templates;
CREATE TRIGGER trigger_activity_templates_updated_at
    BEFORE UPDATE ON activity_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. SEED DEFAULT ACTIVITY TEMPLATES (OPTIONAL)
-- ============================================================================
-- Uncomment to create default templates for new users
-- Note: This won't run automatically - run manually or in application code

/*
INSERT INTO activity_templates (user_id, name, emoji, category, default_minutes, frequency, preferred_time_slot, is_active)
VALUES
    -- Morning routine
    (auth.uid(), 'Morning Routine', '🌅', 'routine', 30, 'daily', 'morning', TRUE),
    (auth.uid(), 'Breakfast', '🍳', 'meal', 20, 'daily', 'morning', TRUE),
    (auth.uid(), 'Exercise', '💪', 'health', 45, 'daily', 'morning', TRUE),
    (auth.uid(), 'Shower', '🚿', 'routine', 15, 'daily', 'morning', TRUE),

    -- Daytime
    (auth.uid(), 'Lunch', '🍽️', 'meal', 30, 'daily', 'afternoon', TRUE),
    (auth.uid(), 'Coffee Break', '☕', 'routine', 15, 'daily', 'afternoon', TRUE),
    (auth.uid(), 'Commute', '🚗', 'transit', 30, 'daily', 'any', TRUE),

    -- Evening
    (auth.uid(), 'Dinner', '🍲', 'meal', 45, 'daily', 'evening', TRUE),
    (auth.uid(), 'Evening Routine', '🌙', 'routine', 30, 'daily', 'evening', TRUE),

    -- Weekly
    (auth.uid(), 'Groceries', '🛒', 'chore', 60, 'weekly', 'any', TRUE),
    (auth.uid(), 'Laundry', '🧺', 'chore', 90, 'weekly', 'any', TRUE),
    (auth.uid(), 'Cleaning', '🧹', 'chore', 120, 'weekly', 'any', TRUE)
ON CONFLICT DO NOTHING;
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Verify the migration:
--
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('daily_plans', 'time_blocks', 'activity_templates', 'calendar_events');
--
-- Expected: 4 rows returned
-- ============================================================================
