-- School document imports: original PDFs, extracted previews, and links to generated rows.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'class-documents',
  'class-documents',
  false,
  52428800,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS class_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN ('cursushandleiding', 'instructions', 'other')),
  folder TEXT NOT NULL DEFAULT 'General',
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  extracted_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE class_documents
  ADD COLUMN IF NOT EXISTS folder TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

CREATE INDEX IF NOT EXISTS idx_class_documents_user_class
  ON class_documents(user_id, class_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_class_documents_storage_path
  ON class_documents(storage_path);

ALTER TABLE class_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own class_documents" ON class_documents;
CREATE POLICY "Users manage own class_documents"
  ON class_documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES class_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkpoints JSONB;

CREATE INDEX IF NOT EXISTS idx_assignments_source_document
  ON assignments(source_document_id)
  WHERE source_document_id IS NOT NULL;

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_todos_assignment
  ON todos(user_id, assignment_id)
  WHERE assignment_id IS NOT NULL;

DROP POLICY IF EXISTS "Users read own class documents" ON storage.objects;
CREATE POLICY "Users read own class documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'class-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users upload own class documents" ON storage.objects;
CREATE POLICY "Users upload own class documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'class-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own class documents" ON storage.objects;
CREATE POLICY "Users update own class documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'class-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'class-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own class documents" ON storage.objects;
CREATE POLICY "Users delete own class documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'class-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
