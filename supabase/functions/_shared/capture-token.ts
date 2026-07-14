import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function hashCaptureToken(token: string): Promise<string> {
    const bytes = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
        '',
    );
}

export async function authenticateCaptureToken(
    token: string,
    supabase: SupabaseClient,
): Promise<string | null> {
    const tokenHash = await hashCaptureToken(token);
    const { data, error } = await supabase
        .from('capture_tokens')
        .select('user_id')
        .eq('token_hash', tokenHash)
        .maybeSingle();

    if (error || !data?.user_id) return null;

    void supabase
        .from('capture_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', data.user_id);

    return data.user_id as string;
}
