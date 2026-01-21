# Experiments Feature Upgrade - Jan 2026

## Database Schema Changes (Supabase)

Run the following SQL in the Supabase SQL Editor to support multiple independent variables and daily notes.

```sql
-- 1. Add array column for multiple independent variables to experiments table
ALTER TABLE experiments ADD COLUMN independent_ids text[];

-- 2. Create table for daily experiment logs/notes
CREATE TABLE experiment_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  experiment_id uuid REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  content text NOT NULL,
  mood_rating int,
  created_at timestamptz DEFAULT now()
);

-- 3. Enable RLS and policies for the new table
ALTER TABLE experiment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own logs" ON experiment_logs
  USING (auth.uid() = user_id);
```

## Code Changes Summary

1.  **Types (`src/types.ts`)**: Updated `Experiment` to have `independentIds`. Added `ExperimentLog` interface.
2.  **Supabase Service (`src/services/supabase.ts`)**: Mapped new fields and tables.
3.  **UI Components**:
    - `ExperimentWizard`: Modified to allow multiple selections.
    - `ExperimentList`: Updated to show "A + B -> C".
    - `ExperimentDetails`: New component for notes and logs.
