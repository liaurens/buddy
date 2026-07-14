/**
 * Trainer Agent (Component VI)
 *
 * Uses HR findings to improve the assistant:
 * - Generates new routing rules from unmatched pattern findings
 * - Logs corrections from error cluster findings
 * - Reviews and processes new findings
 *
 * Triggered by:
 * - HR Agent completion
 * - On-demand via HTTP POST
 *
 * IQ: 6/10 — highest IQ, generates regex patterns
 * Access: 4/10 — reads findings, writes rules and learnings
 * Usage: 1/10 — runs after HR, infrequently
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateRules } from './rule-generator.ts';

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
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Optional: specific user or finding IDs
        let userId: string | null = null;
        try {
            const body = await req.json();
            userId = body.user_id || null;
        } catch {
            // No body = process all new findings
        }

        // Fetch new findings
        let query = supabase
            .from('assistant_findings')
            .select('*')
            .eq('status', 'new')
            .order('created_at', { ascending: true })
            .limit(50);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data: findings, error } = await query;

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (!findings || findings.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No new findings to process', rules_created: 0 }),
                {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                },
            );
        }

        let rulesCreated = 0;
        let findingsProcessed = 0;

        for (const finding of findings) {
            const result = await generateRules(finding, supabase);
            rulesCreated += result.rulesCreated;
            findingsProcessed++;

            // Mark finding as processed
            await supabase
                .from('assistant_findings')
                .update({ status: result.rulesCreated > 0 ? 'applied' : 'reviewed' })
                .eq('id', finding.id);
        }

        return new Response(
            JSON.stringify({
                message: 'Training complete',
                findings_processed: findingsProcessed,
                rules_created: rulesCreated,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
        );
    } catch (err) {
        console.error('Trainer Agent error:', err);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
