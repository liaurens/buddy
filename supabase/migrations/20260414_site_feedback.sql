-- Migration: Create Site Feedback table for Bug Reporter & Spatial Sticky Notes
-- Created at: 2026-04-14

CREATE TABLE IF NOT EXISTS public.site_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'note')),
    description TEXT NOT NULL,
    html_snippet TEXT,
    selector TEXT,
    pathname TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Setup Row Level Security (RLS)
ALTER TABLE public.site_feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticating users or anon to insert feedback since this is a global dev tool.
-- Replace with strictly authenticated rules if you plan to expose this site externally without user login.
CREATE POLICY "Enable insert for all users" ON public.site_feedback
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable select for all users" ON public.site_feedback
    FOR SELECT USING (true);
