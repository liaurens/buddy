-- Drop tables with no readers or writers left in the codebase.
--
-- study_sessions: the study assistant tool was removed in the 2026-06 prune
-- (table never received a row). planner_drift_events: orphan table — no code
-- in the repo ever read or wrote it.

DROP TABLE IF EXISTS study_sessions;
DROP TABLE IF EXISTS planner_drift_events;
