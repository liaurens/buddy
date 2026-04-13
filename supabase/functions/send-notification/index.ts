/**
 * Send Notification Edge Function
 * Sends push notifications using Web Push protocol
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_EMAIL = Deno.env.get('VAPID_EMAIL') || 'mailto:noreply@buddy-app.com';

interface NotificationPayload {
  subscriptionId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Generate VAPID Authorization header
 */
async function generateVAPIDAuth(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidEmail: string
): Promise<string> {
  // Web Push VAPID implementation
  // This is a simplified version - in production use web-push library
  const urlParts = new URL(endpoint);
  const audience = `${urlParts.protocol}//${urlParts.host}`;

  // JWT header
  const header = {
    typ: 'JWT',
    alg: 'ES256',
  };

  // JWT payload
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
    sub: vapidEmail,
  };

  // Base64 URL encode
  const base64UrlEncode = (str: string) => {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));

  // Note: Actual signing requires crypto library
  // For production, use web-push npm package
  const token = `${headerEncoded}.${payloadEncoded}.SIGNATURE`;

  return `vapid t=${token}, k=${vapidPublicKey}`;
}

/**
 * Send push notification to a single subscription
 */
async function sendPushNotification(
  subscription: PushSubscription,
  payload: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const vapidAuth = await generateVAPIDAuth(
      subscription.endpoint,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
      VAPID_EMAIL
    );

    // Encrypt payload (simplified - production needs proper encryption)
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        Authorization: vapidAuth,
        TTL: '86400', // 24 hours
      },
      body: payload,
    });

    if (response.ok || response.status === 201) {
      return { success: true };
    }

    // Handle subscription expiration
    if (response.status === 404 || response.status === 410) {
      return {
        success: false,
        error: 'subscription_expired',
      };
    }

    return {
      success: false,
      error: `Push service error: ${response.status}`,
    };
  } catch (error) {
    console.error('Push send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get request body
    const { subscriptionId, title, body, data, icon, badge, tag, requireInteraction, actions } =
      (await req.json()) as NotificationPayload;

    // Validate required fields
    if (!subscriptionId || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get subscription details
    const { data: subscription, error: fetchError } = await supabase
      .from('notification_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (fetchError || !subscription) {
      return new Response(
        JSON.stringify({ error: 'Subscription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare push subscription object
    const pushSubscription: PushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title,
      body,
      icon: icon || '/icon-192.png',
      badge: badge || '/icons/icon-192.png',
      tag: tag || 'buddy-notification',
      requireInteraction: requireInteraction || false,
      actions: actions || [],
      data: data || {},
    });

    // Send push notification
    const result = await sendPushNotification(pushSubscription, notificationPayload);

    // Log the notification
    await supabase.from('notification_logs').insert({
      subscription_id: subscriptionId,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error,
      sent_at: new Date().toISOString(),
    });

    // If subscription expired, mark as inactive
    if (result.error === 'subscription_expired') {
      await supabase
        .from('notification_subscriptions')
        .update({ is_active: false })
        .eq('id', subscriptionId);
    }

    return new Response(
      JSON.stringify({
        success: result.success,
        error: result.error,
      }),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
