// Shared helpers for the Google Calendar edge functions.
// Token vault access + refresh, JWT auth, and deterministic event ids.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

/** JSON Response with CORS headers. */
export function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

/** Service-role client — bypasses RLS, used for all token-vault and todo writes. */
export function serviceClient(): SupabaseClient {
    return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

/** Validate the caller's Supabase JWT and return their user id. Throws on failure. */
export async function getUserId(req: Request): Promise<string> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) throw new Error('Authentication required');
    const jwt = authHeader.slice(7);
    const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const {
        data: { user },
        error,
    } = await userClient.auth.getUser();
    if (!user || error) throw new Error('Authentication required');
    return user.id;
}

export interface GoogleCredentials {
    user_id: string;
    access_token: string | null;
    refresh_token: string | null;
    access_token_expires_at: string | null;
    scope: string | null;
    google_email: string | null;
    default_calendar_id: string;
    status: 'connected' | 'revoked' | 'error';
}

/**
 * Return a valid (refreshed if needed) access token for the user.
 * Throws { code: 'not_connected' | 'revoked' } style errors the caller maps to 409.
 */
export async function getFreshAccessToken(
    supabase: SupabaseClient,
    userId: string,
): Promise<{ accessToken: string; calendarId: string }> {
    const { data } = await supabase
        .from('google_calendar_credentials')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    const creds = data as GoogleCredentials | null;
    if (!creds || creds.status === 'revoked' || !creds.refresh_token) {
        throw new GoogleAuthError('not_connected');
    }

    const calendarId = creds.default_calendar_id || 'primary';

    // Still valid (60s skew)?
    const expiresAt = creds.access_token_expires_at
        ? new Date(creds.access_token_expires_at).getTime()
        : 0;
    if (creds.access_token && expiresAt - Date.now() > 60_000) {
        return { accessToken: creds.access_token, calendarId };
    }

    // Refresh.
    const refreshed = await refreshAccessToken(creds.refresh_token);
    if (!refreshed) {
        await supabase
            .from('google_calendar_credentials')
            .update({ status: 'revoked', access_token: null })
            .eq('user_id', userId);
        throw new GoogleAuthError('revoked');
    }

    await supabase
        .from('google_calendar_credentials')
        .update({
            access_token: refreshed.access_token,
            access_token_expires_at: new Date(
                Date.now() + refreshed.expires_in * 1000,
            ).toISOString(),
            status: 'connected',
        })
        .eq('user_id', userId);

    return { accessToken: refreshed.access_token, calendarId };
}

export class GoogleAuthError extends Error {
    constructor(public code: 'not_connected' | 'revoked') {
        super(code);
        this.name = 'GoogleAuthError';
    }
}

interface RefreshResult {
    access_token: string;
    expires_in: number;
}

/** Exchange a refresh token for a new access token. Returns null on invalid_grant (revoked). */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult | null> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
            client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });
    if (!res.ok) {
        const body = await res.text();
        if (body.includes('invalid_grant')) return null;
        throw new Error(`Token refresh failed: ${res.status} ${body}`);
    }
    return (await res.json()) as RefreshResult;
}

/**
 * Deterministic Google event id derived from a todo id so creates are idempotent.
 * Google ids must be base32hex (chars 0-9 and a-v), 5-1024 chars. A dash-stripped UUID
 * is 32 hex chars (0-9a-f) — a subset of the allowed alphabet — so it is used verbatim.
 */
export function deterministicEventId(todoId: string): string {
    return todoId.replace(/-/g, '').toLowerCase();
}
