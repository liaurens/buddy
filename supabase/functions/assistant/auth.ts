import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Authenticates a request using either:
 * 1. api_key in body (iPhone shortcut) — looks up quick_note_api_key in settings
 * 2. Authorization: Bearer <jwt> header (website) — validates via Supabase auth
 *
 * Returns userId on success, throws on failure.
 */
export async function authenticateRequest(
  req: Request,
  body: { api_key?: string },
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  // Path 1: api_key in body (iPhone shortcut)
  if (body.api_key) {
    const { data: setting } = await supabase
      .from('settings')
      .select('user_id')
      .eq('key', 'quick_note_api_key')
      .eq('value', body.api_key)
      .single()

    if (setting?.user_id) {
      return setting.user_id
    }
    throw new Error('Invalid api_key')
  }

  // Path 2: JWT bearer token (website)
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const jwt = authHeader.slice(7)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: { user }, error } = await userClient.auth.getUser()
    if (user && !error) {
      return user.id
    }
  }

  throw new Error('Authentication required')
}
