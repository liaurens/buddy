-- Event-triggered checklists: a checklist with a trigger keyword surfaces in
-- the day view whenever a calendar event that day matches the keyword
-- (e.g. keyword "work" -> the work checklist pops up on workdays).

ALTER TABLE checklists
    ADD COLUMN IF NOT EXISTS trigger_keyword TEXT;

COMMENT ON COLUMN checklists.trigger_keyword IS 'Case-insensitive substring matched against today''s calendar event titles; on match the checklist is shown in the day view.';
