CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.capture_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE public.capture_tokens ENABLE ROW LEVEL SECURITY;

-- Capture tokens are managed and checked only by Edge Functions.
REVOKE ALL ON public.capture_tokens FROM anon, authenticated;

INSERT INTO public.capture_tokens (user_id, token_hash, token_prefix)
SELECT
  user_id,
  encode(digest(value, 'sha256'), 'hex'),
  left(value, 7)
FROM public.settings
WHERE key = 'quick_note_api_key' AND NULLIF(value, '') IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

DELETE FROM public.settings WHERE key = 'quick_note_api_key';
