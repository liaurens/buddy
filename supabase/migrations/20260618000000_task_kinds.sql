-- Task Kinds — behavioral classification + urgent-flow support.
-- Adds an explicit (nullable) kind, a parent link for prep tasks, and a notes field.
-- When kind is NULL the app derives it from signals (see deriveTaskKind).

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS kind text
    CHECK (kind IN ('urgent', 'backlog', 'deadline', 'routine', 'standard')),
  ADD COLUMN IF NOT EXISTS parent_todo_id uuid REFERENCES todos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_todos_parent_todo_id
  ON todos(parent_todo_id)
  WHERE parent_todo_id IS NOT NULL;

COMMENT ON COLUMN todos.kind IS 'Explicit behavioral kind: urgent | backlog | deadline | routine | standard. NULL = derive from signals.';
COMMENT ON COLUMN todos.parent_todo_id IS 'Parent task this row preps for (urgent flow generates dated prep subtasks).';
COMMENT ON COLUMN todos.notes IS 'Free-form important info captured during the urgent scheduling flow.';
