-- School: classes, assignments (single deadline), and recurring class sessions.
-- Assignments are independent from todos; the daily planner reads both.

-- 1) Classes
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  instructor TEXT,
  term TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_classes_user ON classes(user_id);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own classes"
  ON classes FOR ALL USING (auth.uid() = user_id);

-- 2) Assignments
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'submitted', 'graded')),
  estimated_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assignments_user_deadline
  ON assignments(user_id, deadline);
CREATE INDEX IF NOT EXISTS idx_assignments_class
  ON assignments(class_id);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own assignments"
  ON assignments FOR ALL USING (auth.uid() = user_id);

-- 3) Class sessions (recurring weekly class times)
CREATE TABLE IF NOT EXISTS class_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_class_sessions_user
  ON class_sessions(user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class
  ON class_sessions(class_id);

ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own class_sessions"
  ON class_sessions FOR ALL USING (auth.uid() = user_id);
