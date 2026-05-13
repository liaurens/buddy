-- Task Types (mirrors note_categories pattern)
CREATE TABLE IF NOT EXISTS task_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT,
    color TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_preset BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_types_user_id ON task_types(user_id);

ALTER TABLE task_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task types"
    ON task_types FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task types"
    ON task_types FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task types"
    ON task_types FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own task types"
    ON task_types FOR DELETE USING (auth.uid() = user_id);

-- Task Routines (reusable batches)
CREATE TABLE IF NOT EXISTS task_routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_routines_user_id ON task_routines(user_id);

ALTER TABLE task_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own routines"
    ON task_routines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own routines"
    ON task_routines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own routines"
    ON task_routines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own routines"
    ON task_routines FOR DELETE USING (auth.uid() = user_id);

-- Task Routine Items
CREATE TABLE IF NOT EXISTS task_routine_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id UUID NOT NULL REFERENCES task_routines(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    task_type_id UUID REFERENCES task_types(id) ON DELETE SET NULL,
    energy TEXT,
    estimated_time INT,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_task_routine_items_routine_id ON task_routine_items(routine_id);

ALTER TABLE task_routine_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own routine items"
    ON task_routine_items FOR SELECT USING (
        EXISTS (SELECT 1 FROM task_routines r WHERE r.id = task_routine_items.routine_id AND r.user_id = auth.uid())
    );
CREATE POLICY "Users can insert own routine items"
    ON task_routine_items FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM task_routines r WHERE r.id = task_routine_items.routine_id AND r.user_id = auth.uid())
    );
CREATE POLICY "Users can update own routine items"
    ON task_routine_items FOR UPDATE USING (
        EXISTS (SELECT 1 FROM task_routines r WHERE r.id = task_routine_items.routine_id AND r.user_id = auth.uid())
    );
CREATE POLICY "Users can delete own routine items"
    ON task_routine_items FOR DELETE USING (
        EXISTS (SELECT 1 FROM task_routines r WHERE r.id = task_routine_items.routine_id AND r.user_id = auth.uid())
    );

-- Extend todos with new fields
ALTER TABLE todos
    ADD COLUMN IF NOT EXISTS task_type_id UUID REFERENCES task_types(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS energy TEXT,
    ADD COLUMN IF NOT EXISTS context TEXT,
    ADD COLUMN IF NOT EXISTS routine_id UUID REFERENCES task_routines(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS routine_order INT;

CREATE INDEX IF NOT EXISTS idx_todos_task_type ON todos(user_id, task_type_id);
CREATE INDEX IF NOT EXISTS idx_todos_routine ON todos(routine_id, routine_order);
