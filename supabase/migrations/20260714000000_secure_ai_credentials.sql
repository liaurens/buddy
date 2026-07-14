-- Keep provider credentials out of client-readable settings rows.
CREATE TABLE IF NOT EXISTS public.ai_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'openai'
    CHECK (provider IN ('openai', 'anthropic', 'gemini')),
  api_key text NOT NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_credentials ENABLE ROW LEVEL SECURITY;

-- No client policies by design. Edge functions use the service role.
REVOKE ALL ON public.ai_credentials FROM anon, authenticated;

INSERT INTO public.ai_credentials (user_id, provider, api_key, model)
SELECT
  provider.user_id,
  COALESCE(provider.value, 'openai'),
  secret.value,
  NULLIF(model.value, 'null')
FROM public.settings AS secret
LEFT JOIN public.settings AS provider
  ON provider.user_id = secret.user_id AND provider.key = 'ai_aiProvider'
LEFT JOIN public.settings AS model
  ON model.user_id = secret.user_id AND model.key = 'ai_aiModel'
WHERE secret.key = 'ai_aiApiKey' AND NULLIF(secret.value, '') IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  provider = EXCLUDED.provider,
  api_key = EXCLUDED.api_key,
  model = EXCLUDED.model,
  updated_at = now();

DELETE FROM public.settings
WHERE key IN ('ai_aiApiKey', 'ai_aiProvider', 'ai_aiModel');

