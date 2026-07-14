import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateCaptureToken } from '../_shared/capture-token.ts';

/**
 * Authenticates a request using either:
 * 1. api_key in body (iPhone shortcut / Siri) — compares a server-side token hash
 * 2. Authorization: Bearer <jwt> header (website) — validates via Supabase auth
 *
 * Returns userId on success, throws on failure.
 */
export async function authenticateRequest(
    req: Request,
    body: { api_key?: string; source?: string },
    supabase: ReturnType<typeof createClient>,
): Promise<string> {
    // Path 1: api_key in body (iPhone shortcut / Siri)
    if (body.api_key) {
        const userId = await authenticateCaptureToken(body.api_key, supabase);
        if (userId) return userId;
        throw new Error('Invalid api_key');
    }

    // Path 2: JWT bearer token (website)
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const jwt = authHeader.slice(7);
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
        const {
            data: { user },
            error,
        } = await userClient.auth.getUser();
        if (user && !error) {
            return user.id;
        }
    }

    throw new Error('Authentication required');
}
