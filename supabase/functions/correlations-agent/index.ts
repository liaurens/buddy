/**
 * Correlations Agent
 *
 * For the given user, iterates every pair of numeric trackers with ≥10 overlapping
 * days of entries, computes Pearson r + two-sided p-value + 95% CI, and upserts
 * into the `correlations` table. Replaces older rows for the same (user, pair).
 *
 * Triggered on-demand via HTTP POST from the AssistantDevPanel.
 * No pg_cron — manual only.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MIN_OVERLAP = 10

interface EntryRow {
  tracker_id: string
  value: number
  timestamp: string
}

interface TrackerRow {
  id: string
  name: string
  type: string
}

// ─── Stats ────────────────────────────────────────────────────────────────────
const pearson = (x: number[], y: number[]): number | null => {
  const n = x.length
  if (n < 3) return null
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0
  for (let i = 0; i < n; i++) {
    sx += x[i]; sy += y[i]
    sxx += x[i] * x[i]; syy += y[i] * y[i]
    sxy += x[i] * y[i]
  }
  const num = n * sxy - sx * sy
  const den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy))
  if (den === 0) return null
  return num / den
}

// Abramowitz & Stegun 7.1.26 Normal CDF
const normalCDF = (x: number): number => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  const absX = Math.abs(x) / Math.SQRT2
  const t = 1 / (1 + p * absX)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX)
  return 0.5 * (1 + sign * y)
}

const pValueTwoSided = (r: number, n: number): number => {
  if (n < 3 || Math.abs(r) >= 1) return Math.abs(r) >= 1 ? 0 : 1
  const t = r * Math.sqrt((n - 2) / (1 - r * r))
  const df = n - 2
  const x = Math.abs(t) / Math.sqrt(1 + (t * t) / df)
  const p = 2 * (1 - normalCDF(x * Math.sqrt(df)))
  return Math.min(1, Math.max(0, p))
}

// Fisher z-based 95% CI for correlation
const ciFisher = (r: number, n: number): { low: number; high: number } | null => {
  if (n < 4 || Math.abs(r) >= 1) return null
  const z = 0.5 * Math.log((1 + r) / (1 - r))
  const se = 1 / Math.sqrt(n - 3)
  const zLow = z - 1.96 * se
  const zHigh = z + 1.96 * se
  const toR = (zv: number) => (Math.exp(2 * zv) - 1) / (Math.exp(2 * zv) + 1)
  return { low: toR(zLow), high: toR(zHigh) }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    let userId: string | null = null
    try {
      const body = await req.json()
      userId = body.user_id || null
    } catch {
      // ignore
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'user_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: trackers, error: tErr } = await supabase
      .from('trackers')
      .select('id, name, type')
      .eq('user_id', userId)

    if (tErr) throw tErr

    const numericTrackers: TrackerRow[] = (trackers ?? []).filter(
      (t: TrackerRow) => t.type === 'number' || t.type === 'rating' || t.type === 'scale'
    )

    if (numericTrackers.length < 2) {
      return new Response(
        JSON.stringify({ pairs_evaluated: 0, rows_written: 0, reason: 'not enough numeric trackers' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: entries, error: eErr } = await supabase
      .from('entries')
      .select('tracker_id, value, timestamp')
      .eq('user_id', userId)

    if (eErr) throw eErr

    // Group into per-tracker per-day sums
    const byTracker = new Map<string, Map<string, number>>()
    for (const t of numericTrackers) byTracker.set(t.id, new Map())
    for (const e of (entries ?? []) as EntryRow[]) {
      const dayKey = e.timestamp.slice(0, 10) // YYYY-MM-DD
      const m = byTracker.get(e.tracker_id)
      if (!m) continue
      m.set(dayKey, (m.get(dayKey) ?? 0) + Number(e.value ?? 0))
    }

    const now = new Date().toISOString()
    const rows: Record<string, unknown>[] = []
    let pairsEvaluated = 0

    for (let i = 0; i < numericTrackers.length; i++) {
      for (let j = i + 1; j < numericTrackers.length; j++) {
        const a = numericTrackers[i]
        const b = numericTrackers[j]
        const mA = byTracker.get(a.id)!
        const mB = byTracker.get(b.id)!
        const commonDays = [...mA.keys()].filter(d => mB.has(d)).sort()
        if (commonDays.length < MIN_OVERLAP) continue
        pairsEvaluated++

        const xs = commonDays.map(d => mA.get(d)!)
        const ys = commonDays.map(d => mB.get(d)!)
        const r = pearson(xs, ys)
        if (r === null) continue
        const p = pValueTwoSided(r, xs.length)
        const ci = ciFisher(r, xs.length)

        rows.push({
          user_id: userId,
          input_tracker_id: a.id,
          output_tracker_id: b.id,
          correlation: r,
          p_value: p,
          optimal_lag_hours: 0,
          sample_size: xs.length,
          confidence_low: ci?.low ?? null,
          confidence_high: ci?.high ?? null,
          calculated_at: now,
        })
      }
    }

    if (rows.length > 0) {
      // Clear prior rows for this user, then insert fresh ones.
      const { error: delErr } = await supabase
        .from('correlations')
        .delete()
        .eq('user_id', userId)
      if (delErr) throw delErr

      const { error: insErr } = await supabase.from('correlations').insert(rows)
      if (insErr) throw insErr
    }

    return new Response(
      JSON.stringify({
        pairs_evaluated: pairsEvaluated,
        rows_written: rows.length,
        trackers: numericTrackers.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
