/**
 * Send Notification Edge Function
 *
 * Sends a single Web Push notification using proper VAPID JWT (ES256) signing
 * and AES128GCM payload encryption via the `web-push` npm package.
 *
 * Called by:
 *   - `schedule-notifications` (cron-driven) to flush pending notifications
 *   - Directly (not currently; see scheduler.service.ts for usage)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_EMAIL = Deno.env.get('VAPID_EMAIL') || 'mailto:noreply@buddy-app.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface NotificationPayload {
    subscriptionId: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    icon?: string;
    badge?: string;
    tag?: string;
    requireInteraction?: boolean;
    actions?: Array<{ action: string; title: string; icon?: string }>;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return new Response(
            JSON.stringify({
                error: 'VAPID keys not configured (set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY on this function)',
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    try {
        const payload = (await req.json()) as NotificationPayload;
        const { subscriptionId, title, body } = payload;

        if (!subscriptionId || !title || !body) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields (subscriptionId, title, body)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: subscription, error: fetchError } = await supabase
            .from('notification_subscriptions')
            .select('id, user_id, endpoint, p256dh, auth')
            .eq('id', subscriptionId)
            .single();

        if (fetchError || !subscription) {
            return new Response(
                JSON.stringify({ error: 'Subscription not found', details: fetchError?.message }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        const pushSubscription = {
            endpoint: subscription.endpoint as string,
            keys: {
                p256dh: subscription.p256dh as string,
                auth: subscription.auth as string,
            },
        };

        const notificationPayload = JSON.stringify({
            title,
            body,
            icon: payload.icon || '/icons/icon-192.png',
            badge: payload.badge || '/icons/icon-192.png',
            tag: payload.tag || 'buddy-notification',
            requireInteraction: payload.requireInteraction || false,
            actions: payload.actions || [],
            data: payload.data || {},
        });

        try {
            await webpush.sendNotification(pushSubscription, notificationPayload, { TTL: 86400 });

            await supabase.from('notification_logs').insert({
                subscription_id: subscriptionId,
                user_id: subscription.user_id,
                status: 'sent',
            });

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        } catch (pushError) {
            // web-push throws WebPushError with .statusCode
            const statusCode = (pushError as { statusCode?: number }).statusCode;
            const errMessage =
                pushError instanceof Error ? pushError.message : 'Unknown push error';

            // 404 Not Found / 410 Gone → subscription is permanently invalid; remove it.
            if (statusCode === 404 || statusCode === 410) {
                await supabase.from('notification_subscriptions').delete().eq('id', subscriptionId);
            }

            await supabase.from('notification_logs').insert({
                subscription_id: subscriptionId,
                user_id: subscription.user_id,
                status: 'failed',
                error_message: `[${statusCode ?? 'n/a'}] ${errMessage}`,
            });

            return new Response(JSON.stringify({ success: false, error: errMessage, statusCode }), {
                status: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
    } catch (error) {
        const errMessage = error instanceof Error ? error.message : 'Internal server error';
        console.error('Function error:', errMessage);
        return new Response(JSON.stringify({ error: errMessage }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
