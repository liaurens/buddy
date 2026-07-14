/**
 * Google Calendar write integration (frontend).
 *
 * OAuth (auth code + PKCE) is started here and finished by the google-calendar-auth
 * edge function (which holds the client secret). Task writes go through
 * google-calendar-write, falling back to a durable offline outbox on network failure.
 */

import { supabase } from '../../../services/supabase';
import {
    googleCalendarOutbox,
    type GoogleEventPayload,
    type GoogleCalendarOutboxItem,
} from '../../../services/offline/googleCalendarOutbox';
import type { Task } from '../../tasks/types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined;
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const PKCE_STORAGE_KEY = 'google_oauth_pkce';
const CALLBACK_PATH = '/oauth/google/callback';

export const isGoogleCalendarConfigured = !!CLIENT_ID;

export function googleRedirectUri(): string {
    return `${window.location.origin}${CALLBACK_PATH}`;
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function base64UrlEncode(bytes: Uint8Array): string {
    let str = '';
    for (const b of bytes) str += String.fromCharCode(b);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(length: number): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
}

async function sha256Challenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64UrlEncode(new Uint8Array(digest));
}

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------

/** Begin the consent flow: stash PKCE + state, then redirect to Google. */
export async function startGoogleAuth(): Promise<void> {
    if (!CLIENT_ID)
        throw new Error('Google Calendar is not configured (VITE_GOOGLE_OAUTH_CLIENT_ID).');
    const codeVerifier = randomString(48);
    const state = randomString(16);
    const codeChallenge = await sha256Challenge(codeVerifier);

    sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify({ codeVerifier, state }));

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: googleRedirectUri(),
        response_type: 'code',
        scope: SCOPE,
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
    });
    window.location.assign(`${AUTH_ENDPOINT}?${params.toString()}`);
}

export interface ConnectionStatus {
    connected: boolean;
    googleEmail: string | null;
    status: string;
}

/** Finish the consent flow from the callback page. Verifies state, exchanges the code. */
export async function completeGoogleAuth(code: string, state: string): Promise<ConnectionStatus> {
    const raw = sessionStorage.getItem(PKCE_STORAGE_KEY);
    sessionStorage.removeItem(PKCE_STORAGE_KEY);
    if (!raw) throw new Error('Missing PKCE state — please start the connection again.');
    const { codeVerifier, state: savedState } = JSON.parse(raw) as {
        codeVerifier: string;
        state: string;
    };
    if (savedState !== state) throw new Error('State mismatch — possible CSRF, aborting.');

    const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
            action: 'exchange',
            code,
            code_verifier: codeVerifier,
            redirect_uri: googleRedirectUri(),
        },
    });
    if (error) throw new Error(error.message || 'Token exchange failed');
    if (data?.error) throw new Error(data.error);
    return { connected: true, googleEmail: data?.googleEmail ?? null, status: 'connected' };
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
    const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'status' },
    });
    if (error || data?.error)
        return { connected: false, googleEmail: null, status: 'disconnected' };
    return {
        connected: !!data.connected,
        googleEmail: data.googleEmail ?? null,
        status: data.status ?? 'disconnected',
    };
}

export async function disconnectGoogle(): Promise<void> {
    const { error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'disconnect' },
    });
    if (error) throw new Error(error.message || 'Disconnect failed');
}

// ---------------------------------------------------------------------------
// Event writes
// ---------------------------------------------------------------------------

function isNetworkError(error: { name?: string; message?: string }): boolean {
    if (error.name === 'FunctionsFetchError') return true;
    return /failed to fetch|network|load failed|fetch failed/i.test(error.message ?? '');
}

/** Local timezone for event payloads. */
function localTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

/** Build a Google event payload from a scheduled task. Returns null if not schedulable. */
export function taskToGooglePayload(task: Task): GoogleEventPayload | null {
    if (!task.dueDate) return null;
    const timeZone = localTimeZone();
    const summary = task.title;
    const base = {
        summary,
        description: task.notes || undefined,
        location: task.location || undefined,
    };

    if (task.dueTime) {
        const start = new Date(`${task.dueDate}T${task.dueTime}`);
        const durationMin = task.estimatedTime && task.estimatedTime > 0 ? task.estimatedTime : 30;
        const end = new Date(start.getTime() + durationMin * 60_000);
        return {
            ...base,
            start: start.toISOString(),
            end: end.toISOString(),
            isAllDay: false,
            timeZone,
        };
    }
    // All-day: Google's end date is exclusive, so use the next day.
    const startDate = task.dueDate;
    const next = new Date(`${task.dueDate}T00:00:00`);
    next.setDate(next.getDate() + 1);
    const endDate = next.toISOString().slice(0, 10);
    return { ...base, start: startDate, end: endDate, isAllDay: true, timeZone };
}

type WriteOp = 'create' | 'update' | 'delete';

async function invokeWrite(
    op: WriteOp,
    todoId: string,
    payload?: GoogleEventPayload,
    googleEventId?: string,
): Promise<void> {
    const { data, error } = await supabase.functions.invoke('google-calendar-write', {
        body: { action: op, todoId, googleEventId, event: payload },
    });
    if (error) {
        if (isNetworkError(error)) {
            await googleCalendarOutbox.enqueue({ op, todoId, payload, googleEventId });
            return;
        }
        // Domain errors (e.g. not_connected) propagate so callers can prompt re-connect.
        throw new Error(data?.error || error.message || 'Google Calendar write failed');
    }
    if (data?.error && data.error !== 'not_connected') {
        throw new Error(data.error);
    }
}

/** Push a newly-scheduled task to Google Calendar (idempotent on the server). */
export async function pushTaskToGoogle(task: Task): Promise<void> {
    const payload = taskToGooglePayload(task);
    if (!payload) return;
    await invokeWrite('create', task.id, payload, task.googleEventId);
}

/** Update the event after a reschedule/edit. */
export async function updateTaskOnGoogle(task: Task): Promise<void> {
    const payload = taskToGooglePayload(task);
    if (!payload) return;
    await invokeWrite('update', task.id, payload, task.googleEventId);
}

/** Remove the event (on complete/delete) if one exists. */
export async function removeTaskFromGoogle(
    task: Pick<Task, 'id' | 'googleEventId'>,
): Promise<void> {
    if (!task.googleEventId) return;
    await invokeWrite('delete', task.id, undefined, task.googleEventId);
}

/** Flush the offline write queue. Call on `online` / app open. */
export async function flushGoogleCalendarOutbox(): Promise<void> {
    await googleCalendarOutbox.flush(async (item: GoogleCalendarOutboxItem) => {
        try {
            const { data, error } = await supabase.functions.invoke('google-calendar-write', {
                body: {
                    action: item.op,
                    todoId: item.todoId,
                    googleEventId: item.googleEventId,
                    event: item.payload,
                },
            });
            if (error) return isNetworkError(error) ? 'retry' : 'delivered';
            if (data?.error && data.error !== 'not_connected') return 'delivered';
            return 'delivered';
        } catch {
            return 'retry';
        }
    });
}
