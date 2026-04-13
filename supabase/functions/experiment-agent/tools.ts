/**
 * Experiment Agent Tools
 *
 * Function definitions that the AI can call to take action on experiments.
 * Each tool has a schema (sent to the model) and an executor.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any

export interface ToolSchema {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface ToolContext {
  userId: string
  supabase: SupabaseClient
  experimentId?: string
}

export interface ToolExecutionResult {
  ok: boolean
  summary: string
  data?: Record<string, unknown>
}

// ─── Tool Schemas (sent to Anthropic) ────────────────────────────────────────

export const EXPERIMENT_TOOLS: ToolSchema[] = [
  {
    name: 'get_experiment',
    description: 'Get the full details of the current experiment including custom metrics, phases, status, hypothesis, and tags.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_experiments',
    description: 'List all experiments for the user, with status, name, and id.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'paused', 'completed', 'archived', 'all'],
          description: 'Filter by status (default: all)',
        },
      },
    },
  },
  {
    name: 'get_checkin_data',
    description: 'Get recent check-in entries for the current experiment, grouped by date and metric. Useful for analysis and summaries.',
    input_schema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'How many past days to include (default: 30)',
        },
      },
    },
  },
  {
    name: 'update_metrics',
    description: 'Replace the custom_metrics array on the current experiment. Use this to add, remove, or modify experiment-specific check-in metrics. Provide the FULL desired metrics array — it replaces the existing one.',
    input_schema: {
      type: 'object',
      properties: {
        metrics: {
          type: 'array',
          description: 'Full array of metrics. Each metric: {id, name, emoji, type (rating|number|boolean|text), unit?, min?, max?, required?, description?}',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              emoji: { type: 'string' },
              type: { type: 'string', enum: ['rating', 'number', 'boolean', 'text'] },
              unit: { type: 'string' },
              min: { type: 'number' },
              max: { type: 'number' },
              required: { type: 'boolean' },
              description: { type: 'string' },
            },
            required: ['id', 'name', 'emoji', 'type'],
          },
        },
      },
      required: ['metrics'],
    },
  },
  {
    name: 'update_phases',
    description: 'Replace the phases array on the current experiment. Provide the FULL array — it replaces existing phases.',
    input_schema: {
      type: 'object',
      properties: {
        phases: {
          type: 'array',
          description: 'Full array of phases. Each phase: {id, name, startDate (YYYY-MM-DD), endDate? (YYYY-MM-DD), description?, order}',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              startDate: { type: 'string' },
              endDate: { type: 'string' },
              description: { type: 'string' },
              order: { type: 'number' },
            },
            required: ['id', 'name', 'startDate', 'order'],
          },
        },
      },
      required: ['phases'],
    },
  },
  {
    name: 'update_experiment',
    description: 'Update top-level fields on the current experiment: name, hypothesis, description, status, tags, checkinSchedule.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        hypothesis: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['active', 'paused', 'completed', 'archived'] },
        tags: { type: 'array', items: { type: 'string' } },
        checkinSchedule: { type: 'string', enum: ['daily', 'twice_daily', 'weekly'] },
      },
    },
  },
  {
    name: 'analyze_results',
    description: 'Compute summary statistics (mean, count, trend) for each custom metric, broken down by phase. Use this when the user asks for analysis or interpretation.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
]

// ─── Executors ───────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  switch (name) {
    case 'get_experiment':
      return getExperiment(ctx)
    case 'list_experiments':
      return listExperiments(input, ctx)
    case 'get_checkin_data':
      return getCheckinData(input, ctx)
    case 'update_metrics':
      return updateMetrics(input, ctx)
    case 'update_phases':
      return updatePhases(input, ctx)
    case 'update_experiment':
      return updateExperiment(input, ctx)
    case 'analyze_results':
      return analyzeResults(ctx)
    default:
      return { ok: false, summary: `Unknown tool: ${name}` }
  }
}

async function getExperiment(ctx: ToolContext): Promise<ToolExecutionResult> {
  if (!ctx.experimentId) {
    return { ok: false, summary: 'No experiment in context. Use list_experiments first.' }
  }
  const { data, error } = await ctx.supabase
    .from('experiments')
    .select('*')
    .eq('id', ctx.experimentId)
    .eq('user_id', ctx.userId)
    .single()

  if (error || !data) {
    return { ok: false, summary: `Could not load experiment: ${error?.message ?? 'not found'}` }
  }

  return {
    ok: true,
    summary: `Loaded experiment "${data.name}"`,
    data: {
      id: data.id,
      name: data.name,
      description: data.description,
      hypothesis: data.hypothesis,
      status: data.status,
      tags: data.tags,
      phases: data.phases,
      custom_metrics: data.custom_metrics,
      checkin_schedule: data.checkin_schedule,
      start_date: data.start_date,
      end_date: data.end_date,
    },
  }
}

async function listExperiments(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecutionResult> {
  const status = (input.status as string) || 'all'
  let query = ctx.supabase
    .from('experiments')
    .select('id, name, status, hypothesis, start_date, end_date')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) return { ok: false, summary: `Failed: ${error.message}` }
  return {
    ok: true,
    summary: `Found ${data?.length ?? 0} experiments`,
    data: { experiments: data ?? [] },
  }
}

async function getCheckinData(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecutionResult> {
  if (!ctx.experimentId) {
    return { ok: false, summary: 'No experiment in context.' }
  }
  const days = (input.days as number) || 30
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data, error } = await ctx.supabase
    .from('experiment_checkin_entries')
    .select('*')
    .eq('experiment_id', ctx.experimentId)
    .eq('user_id', ctx.userId)
    .gte('date', sinceStr)
    .order('date', { ascending: true })

  if (error) return { ok: false, summary: `Failed: ${error.message}` }

  // Group by date
  const byDate: Record<string, Array<Record<string, unknown>>> = {}
  for (const row of data ?? []) {
    if (!byDate[row.date]) byDate[row.date] = []
    byDate[row.date].push({
      metric_id: row.metric_id,
      phase_id: row.phase_id,
      value: row.value,
      text_value: row.text_value,
    })
  }

  return {
    ok: true,
    summary: `Retrieved ${data?.length ?? 0} check-in entries across ${Object.keys(byDate).length} days`,
    data: { entries_by_date: byDate, total: data?.length ?? 0 },
  }
}

async function updateMetrics(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecutionResult> {
  if (!ctx.experimentId) return { ok: false, summary: 'No experiment in context.' }
  const metrics = input.metrics as unknown[]
  if (!Array.isArray(metrics)) return { ok: false, summary: 'metrics must be an array' }

  const { error } = await ctx.supabase
    .from('experiments')
    .update({ custom_metrics: metrics, updated_at: new Date().toISOString() })
    .eq('id', ctx.experimentId)
    .eq('user_id', ctx.userId)

  if (error) return { ok: false, summary: `Failed: ${error.message}` }
  return { ok: true, summary: `Updated metrics (${metrics.length} total)`, data: { count: metrics.length } }
}

async function updatePhases(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecutionResult> {
  if (!ctx.experimentId) return { ok: false, summary: 'No experiment in context.' }
  const phases = input.phases as unknown[]
  if (!Array.isArray(phases)) return { ok: false, summary: 'phases must be an array' }

  const { error } = await ctx.supabase
    .from('experiments')
    .update({ phases, updated_at: new Date().toISOString() })
    .eq('id', ctx.experimentId)
    .eq('user_id', ctx.userId)

  if (error) return { ok: false, summary: `Failed: ${error.message}` }
  return { ok: true, summary: `Updated phases (${phases.length} total)`, data: { count: phases.length } }
}

async function updateExperiment(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecutionResult> {
  if (!ctx.experimentId) return { ok: false, summary: 'No experiment in context.' }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof input.name === 'string') update.name = input.name
  if (typeof input.hypothesis === 'string') update.hypothesis = input.hypothesis
  if (typeof input.description === 'string') update.description = input.description
  if (typeof input.status === 'string') update.status = input.status
  if (Array.isArray(input.tags)) update.tags = input.tags
  if (typeof input.checkinSchedule === 'string') update.checkin_schedule = input.checkinSchedule

  const { error } = await ctx.supabase
    .from('experiments')
    .update(update)
    .eq('id', ctx.experimentId)
    .eq('user_id', ctx.userId)

  if (error) return { ok: false, summary: `Failed: ${error.message}` }
  return { ok: true, summary: `Updated experiment fields: ${Object.keys(update).filter(k => k !== 'updated_at').join(', ')}` }
}

async function analyzeResults(ctx: ToolContext): Promise<ToolExecutionResult> {
  if (!ctx.experimentId) return { ok: false, summary: 'No experiment in context.' }

  const { data: exp } = await ctx.supabase
    .from('experiments')
    .select('custom_metrics, phases')
    .eq('id', ctx.experimentId)
    .eq('user_id', ctx.userId)
    .single()

  if (!exp) return { ok: false, summary: 'Experiment not found' }

  const { data: entries } = await ctx.supabase
    .from('experiment_checkin_entries')
    .select('*')
    .eq('experiment_id', ctx.experimentId)
    .eq('user_id', ctx.userId)

  const metrics = (exp.custom_metrics || []) as Array<{ id: string; name: string; type: string }>
  const phases = (exp.phases || []) as Array<{ id: string; name: string }>

  // Compute mean per (metric × phase)
  const stats: Record<string, Record<string, { count: number; sum: number; mean?: number }>> = {}

  for (const metric of metrics) {
    if (metric.type !== 'rating' && metric.type !== 'number') continue
    stats[metric.id] = { _overall: { count: 0, sum: 0 } }
    for (const phase of phases) {
      stats[metric.id][phase.id] = { count: 0, sum: 0 }
    }
  }

  for (const entry of entries ?? []) {
    if (typeof entry.value !== 'number') continue
    const metricStats = stats[entry.metric_id]
    if (!metricStats) continue
    metricStats._overall.count++
    metricStats._overall.sum += entry.value
    if (entry.phase_id && metricStats[entry.phase_id]) {
      metricStats[entry.phase_id].count++
      metricStats[entry.phase_id].sum += entry.value
    }
  }

  // Compute means
  const result: Record<string, unknown> = {}
  for (const metric of metrics) {
    const ms = stats[metric.id]
    if (!ms) continue
    const byPhase: Record<string, { count: number; mean: number | null }> = {}
    byPhase.overall = {
      count: ms._overall.count,
      mean: ms._overall.count > 0 ? +(ms._overall.sum / ms._overall.count).toFixed(2) : null,
    }
    for (const phase of phases) {
      const ps = ms[phase.id]
      byPhase[phase.name] = {
        count: ps.count,
        mean: ps.count > 0 ? +(ps.sum / ps.count).toFixed(2) : null,
      }
    }
    result[metric.name] = byPhase
  }

  return {
    ok: true,
    summary: `Analyzed ${entries?.length ?? 0} entries across ${metrics.length} metrics and ${phases.length} phases`,
    data: { total_entries: entries?.length ?? 0, stats: result },
  }
}
