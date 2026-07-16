-- Buddy Cove morning check-in gate.
-- The whole app is gated behind a once-per-day check-in; done/skipped is
-- persisted on daily_plans (same one-row-per-user-per-date pattern as
-- capacity and closed_at) so it syncs across devices and edge functions
-- can read it. `intention` is the optional "one word for today".

ALTER TABLE public.daily_plans
    ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS checkin_skipped BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS intention TEXT;

COMMENT ON COLUMN public.daily_plans.checked_in_at IS 'When the morning check-in gate was completed (NULL = not yet)';
COMMENT ON COLUMN public.daily_plans.checkin_skipped IS 'True when the user explicitly skipped the check-in for this day';
COMMENT ON COLUMN public.daily_plans.intention IS 'One word for today, captured at the check-in gate';
