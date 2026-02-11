-- Smart Notes (QuickSort Notes) Migration
-- Run this in your Supabase SQL Editor

-- Note Categories table
CREATE TABLE IF NOT EXISTS note_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    flag TEXT NOT NULL,
    emoji TEXT,
    color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Smart Notes table
CREATE TABLE IF NOT EXISTS smart_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    category_id UUID REFERENCES note_categories(id) ON DELETE SET NULL,
    flag TEXT,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_note_categories_user_id ON note_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_notes_user_id ON smart_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_notes_category_id ON smart_notes(category_id);
CREATE INDEX IF NOT EXISTS idx_smart_notes_processed ON smart_notes(user_id, processed);

-- Row Level Security (RLS)
ALTER TABLE note_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for note_categories
CREATE POLICY "Users can view own categories"
    ON note_categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
    ON note_categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
    ON note_categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
    ON note_categories FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for smart_notes
CREATE POLICY "Users can view own notes"
    ON smart_notes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
    ON smart_notes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
    ON smart_notes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
    ON smart_notes FOR DELETE
    USING (auth.uid() = user_id);
