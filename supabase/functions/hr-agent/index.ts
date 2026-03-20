/**
 * HR Agent (Component V)
 *
 * Monitors assistant logs and produces findings:
 * - Unmatched patterns (inputs that fell through to AI or defaulted)
 * - Error clusters (repeated failures from specific tools/domains)
 * - Slow routes (high latency requests)
 * - Usage trends (command/domain popularity)
 * - AI cost tracking (token usage)
 *
 * Triggered by:
 * - pg_cron daily at 3 AM
 * - On-demand via HTTP POST
 *
 * IQ: 5/10 — pattern recognition over logs
 * Access: 6/10 — reads assistant_logs, writes assistant_findings
 * Usage: 1/10 — runs daily + on-demand
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { analyzeUnmatchedPatterns } from './analyzer.ts'
import { analyzeErrorClusters } from './analyzer.ts'
import { analyzeSlowRoutes } from './analyzer.ts'
import { analyzeUsageTrends } from './analyzer.ts'
import { analyzeAICost } from './analyzer.ts'
import { writeFindings } from './findings-writer.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse optional params (days to analyze, specific user)
    let days = 7
    let userId: string | null = null
    try {
      const body = await req.json()
      days = body.days || 7
      userId = body.user_id || null
    } catch {
      // No body = use defaults (cron trigger)
    }

    // Get the time window
    const since = new Date()
    since.setDate(since.getDate() - days)

    // Fetch logs for analysis
    let query = supabase
      .from('assistant_logs')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: logs, error } = await query

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!logs || logs.length === 0) {
      return new Response(JSON.stringify({ message: 'No logs to analyze', findings: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Group logs by user for per-user analysis
    const logsByUser = new Map<string, typeof logs>()
    for (const log of logs) {
      const uid = log.user_id
      if (!logsByUser.has(uid)) logsByUser.set(uid, [])
      logsByUser.get(uid)!.push(log)
    }

    let totalFindings = 0

    for (const [uid, userLogs] of logsByUser) {
      const findings = [
        ...analyzeUnmatchedPatterns(userLogs),
        ...analyzeErrorClusters(userLogs),
        ...analyzeSlowRoutes(userLogs),
        ...analyzeUsageTrends(userLogs),
        ...analyzeAICost(userLogs),
      ]

      if (findings.length > 0) {
        await writeFindings(uid, findings, supabase)
        totalFindings += findings.length
      }
    }

    return new Response(
      JSON.stringify({
        message: `Analysis complete`,
        users_analyzed: logsByUser.size,
        findings: totalFindings,
        days_analyzed: days,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('HR Agent error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
