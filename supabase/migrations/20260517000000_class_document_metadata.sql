-- Add lightweight cloud-library metadata to class documents.

ALTER TABLE class_documents
  ADD COLUMN IF NOT EXISTS folder TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

