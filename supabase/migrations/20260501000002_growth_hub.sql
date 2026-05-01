-- Growth Hub: unify goals + projects + skills.
-- Skills move from localStorage to Supabase. Goals optionally link to a project.

-- 1) Skills
CREATE TABLE IF NOT EXISTS skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skills_user ON skills(user_id);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own skills"
  ON skills FOR ALL USING (auth.uid() = user_id);

-- 2) Skill activity logs
CREATE TABLE IF NOT EXISTS skill_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  minutes INTEGER NOT NULL,
  xp_gained INTEGER NOT NULL,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  logged_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skill_logs_skill ON skill_logs(skill_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_logs_user ON skill_logs(user_id, logged_at DESC);

ALTER TABLE skill_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own skill_logs"
  ON skill_logs FOR ALL USING (auth.uid() = user_id);

-- 3) Goals can belong to a project
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_goals_project ON goals(project_id) WHERE project_id IS NOT NULL;
