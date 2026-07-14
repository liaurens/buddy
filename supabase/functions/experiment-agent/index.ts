/**
 * Experiment Agent Edge Function
 *
 * Chat endpoint for the experiment-specific subagent. Maintains its own
 * conversation history per experiment (or globally when experiment_id is null)
 * and has tool-calling access to read/modify experiments and check-in data.
 *
 * POST body: { message, experiment_id? }
 * Auth: JWT bearer token
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { runAgent, type ChatMessage } from './experiment-ai.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Authenticate via JWT
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return jsonResponse({ error: 'Authentication required' }, 401);
        }
        const jwt = authHeader.slice(7);
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
        const {
            data: { user },
            error: authError,
        } = await userClient.auth.getUser();
        if (!user || authError) {
            return jsonResponse({ error: 'Invalid JWT' }, 401);
        }
        const userId = user.id;

        // Parse body
        let body: { message?: string; experiment_id?: string };
        try {
            body = await req.json();
        } catch {
            return jsonResponse({ error: 'Invalid JSON body' }, 400);
        }

        const message = (body.message || '').trim();
        const experimentId = body.experiment_id || null;

        if (!message) {
            return jsonResponse({ error: 'message is required' }, 400);
        }

        const { data: aiConfig } = await supabase
            .from('ai_credentials')
            .select('provider, api_key, model')
            .eq('user_id', userId)
            .maybeSingle();

        const provider = aiConfig?.provider || 'openai';
        const key = aiConfig?.api_key;
        const model = aiConfig?.model || undefined;

        if (!key) {
            return jsonResponse({ error: 'No AI API key configured. Set one in Settings.' }, 400);
        }

        // Load existing conversation for (user, experiment)
        const { data: existing } = await supabase
            .from('experiment_agent_conversations')
            .select('id, messages')
            .eq('user_id', userId)
            .eq('experiment_id', experimentId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const history: ChatMessage[] = (existing?.messages as ChatMessage[]) || [];

        // Run the agent
        const result = await runAgent(
            message,
            history,
            { key, provider, model },
            { userId, supabase, experimentId: experimentId || undefined },
        );

        // Persist the conversation
        const now = new Date().toISOString();
        const newHistory: ChatMessage[] = [
            ...history,
            { role: 'user', content: message, timestamp: now },
            { role: 'assistant', content: result.reply, timestamp: now },
        ];

        if (existing?.id) {
            await supabase
                .from('experiment_agent_conversations')
                .update({ messages: newHistory, updated_at: now })
                .eq('id', existing.id);
        } else {
            await supabase.from('experiment_agent_conversations').insert({
                user_id: userId,
                experiment_id: experimentId,
                messages: newHistory,
            });
        }

        return jsonResponse({
            reply: result.reply,
            tools_used: result.toolsUsed,
            tokens_in: result.tokensIn,
            tokens_out: result.tokensOut,
        });
    } catch (err) {
        console.error('Experiment agent error:', err);
        const message = err instanceof Error ? err.message : String(err);
        return jsonResponse({ error: message }, 500);
    }
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
