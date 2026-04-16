import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'
import { callAI } from '../core/ai-wrapper.ts'
import { createLearning, getLearnings } from './learnings.tool.ts'

// deno-lint-ignore no-explicit-any
type Sb = any

type PlanMode = 'chronobiological' | 'behavioral_activation' | 'standard'

interface UserContext {
  hours_available: number
  feel: number
  medication_taken: boolean
  focus_rating?: number
  mode?: PlanMode
}

interface GeneratedBlock {
  title: string
  start_time: string
  end_time: string
  estimated_minutes: number
  task_id?: string
  activity_template_id?: string
  smallest_first_step?: string
  notes?: string
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function chooseMode(medicated: boolean, feel: number): PlanMode {
  if (feel <= 4) return 'behavioral_activation'
  if (medicated) return 'chronobiological'
  return 'standard'
}

function parseJson<T = unknown>(text: string): T | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
  try {
    return JSON.parse(trimmed) as T
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as T
    } catch {
      return null
    }
  }
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

function avg(nums: number[] | null | undefined): number | null {
  if (!nums || nums.length === 0) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

// ─── Inventory fetchers ─────────────────────────────────────────────────────

async function fetchOpenTodos(userId: string, supabase: Sb) {
  const { data } = await supabase
    .from('todos')
    .select('id, title, priority, due_date, estimated_time, historical_minutes, recurrence, project_id')
    .eq('user_id', userId)
    .eq('completed', false)
    .order('due_date', { ascending: true, nullsLast: true })
    .limit(40)
  return (data ?? []).map((t: Sb) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    due_date: t.due_date,
    estimated_minutes: t.estimated_time,
    average_minutes: avg(t.historical_minutes),
    average_count: Array.isArray(t.historical_minutes) ? t.historical_minutes.length : 0,
    recurrence: t.recurrence,
  }))
}

async function fetchActiveActivityTemplates(userId: string, supabase: Sb, categories: string[]) {
  const cats = Array.isArray(categories) && categories.length > 0 ? categories : ['health']
  const { data } = await supabase
    .from('activity_templates')
    .select('id, name, emoji, default_minutes, historical_minutes, preferred_time_slot, preferred_start_time, category')
    .eq('user_id', userId)
    .in('category', cats)
    .eq('is_active', true)
    .order('name')
  return (data ?? []).map((t: Sb) => ({
    id: t.id,
    name: t.name,
    emoji: t.emoji,
    category: t.category,
    default_minutes: t.default_minutes,
    average_minutes: avg(t.historical_minutes) ?? t.default_minutes,
    average_count: Array.isArray(t.historical_minutes) ? t.historical_minutes.length : 0,
    preferred_time_slot: t.preferred_time_slot,
    preferred_start_time: t.preferred_start_time,
  }))
}

// ─── Prompts ────────────────────────────────────────────────────────────────

function buildGeneratorSystemPrompt(mode: PlanMode, medicated: boolean): string {
  const base = `You are a daily-plan generator for an adult with ADHD.
Return ONLY valid JSON, no prose, no code fences. Schema:
{
  "blocks": [
    { "title": string, "start_time": "HH:MM", "end_time": "HH:MM",
      "estimated_minutes": number, "task_id": string | null,
      "activity_template_id": string | null,
      "smallest_first_step": string | null, "notes": string | null }
  ],
  "reasoning": string,
  "warnings": string[]
}
Rules that always apply:
- Include every selected_task_id and every scheduled_activity_template_id exactly once.
- Blocks cannot overlap; use a short (5-10 min) transition between non-trivial blocks.
- Respect hours_available as the total focused work budget across task blocks.
- If a task has "user_estimated_minutes", set the block's estimated_minutes to exactly that value (you may split across multiple short blocks if the mode requires shorter blocks, but the SUM must equal user_estimated_minutes).
- If an activity has "user_duration_minutes", the block's estimated_minutes MUST equal that value exactly — do not shorten or lengthen it.`

  if (mode === 'behavioral_activation') {
    return `${base}
This user feels low today (feel<=4). Use CADDI-style behavioral activation:
- Cap every task block at <= 25 minutes. Split longer tasks across multiple short blocks with micro-breaks.
- For every task block, fill "smallest_first_step" with a concrete 1-2 minute opener ("Open the doc, read heading 1").
- Deprioritize low-priority tasks; prefer quick wins first to build momentum.
- Schedule at least one active (health) activity before 12:00 — exercise is the strongest executive-function lever when motivation is absent.`
  }

  if (medicated) {
    return `${base}
User reports medication taken today. Apply chronobiological scheduling:
- Put the heaviest executive-function tasks (deep focus, study, complex decisions) in the first 3-5 hours of the plan while reward salience is elevated.
- Schedule ONE active (health) activity in the late-afternoon rebound window (16:00-19:00) — a walk or low-stim movement to bridge the medication wear-off.
- Add a "high-protein snack" warning in warnings[] timed ~30-60 min before the expected wear-off.
- Keep evening blocks low-cognitive-load only (admin, light chores, wind-down).`
  }

  return `${base}
User is unmedicated. Use aggressive externalization:
- Cap most task blocks at <= 45 minutes; never more than 60.
- Schedule at least one active (health) activity before 12:00.
- For any task with estimated_minutes > 30 or no historical data, include "smallest_first_step".
- Avoid rapid task-switching: group similar tasks contiguously.`
}

const CLOSE_LEARNING_SYSTEM_PROMPT = `You analyze one day of planned vs actual time data and output ONE compact learning.
Return ONLY valid JSON, no prose, no code fences. Schema:
{
  "pattern": string,
  "description": string,
  "variance_pct": number,
  "recommendation": string,
  "applies_when": { "medicated": boolean | null, "time_of_day": "morning"|"afternoon"|"evening"|null, "task_category": string | null },
  "confidence": number
}
Rules:
- Frame the description as a SYSTEM adjustment, never personal blame. Say "the plan underestimated X by Y min", not "you took too long".
- Use explicit numbers (variance_pct, minutes).
- "recommendation" must be actionable on the next plan generation (e.g. "add a 15-min buffer before afternoon deep-work blocks").
- If the day had fewer than 3 completed blocks, set confidence <= 0.4.`

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handlePlanStart(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const supabase = context.supabase as Sb
  const rawCats = params.activity_categories
  const categories = Array.isArray(rawCats)
    ? rawCats.filter((c): c is string => typeof c === 'string' && c.length > 0)
    : ['health']
  const [tasks, activities, learnings] = await Promise.all([
    fetchOpenTodos(context.userId, supabase),
    fetchActiveActivityTemplates(context.userId, supabase, categories.length ? categories : ['health']),
    getLearnings(context.userId, supabase, 'behavior'),
  ])

  return {
    success: true,
    action_taken: `Ready to plan. ${tasks.length} open tasks, ${activities.length} active activities available.`,
    data: {
      tasks,
      activity_templates: activities,
      recent_learnings: learnings.slice(0, 5).map(l => l.content),
      questions: [
        { key: 'hours_available', prompt: 'How many hours do you want to work today?', type: 'number' },
        { key: 'feel', prompt: 'How do you feel? (1 = rough, 10 = great)', type: 'number' },
        { key: 'medication_taken', prompt: 'Did you take your medication?', type: 'boolean' },
        { key: 'selected_task_ids', prompt: 'Which tasks will you tackle today?', type: 'multi_select', options: 'tasks' },
        { key: 'scheduled_activity_template_ids', prompt: 'Pick at least 2 active activities (gym, walk, etc.).', type: 'multi_select', min: 2, options: 'activity_templates' },
      ],
      next_action: 'plan.generate',
    },
    suggestions: ['Fill the questions, then post plan.generate'],
  }
}

async function handlePlanGenerate(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const supabase = context.supabase as Sb
  const date = (params.date as string) || todayISO()
  const hours_available = Number(params.hours_available)
  const feel = Number(params.feel)
  const medication_taken = Boolean(params.medication_taken)
  const selected_task_ids = (params.selected_task_ids as string[]) || []
  const scheduled_activity_template_ids = (params.scheduled_activity_template_ids as string[]) || []
  const start_time = (params.start_time as string) || '09:00'

  const normalizeMinutesMap = (raw: unknown): Record<string, number> => {
    if (!raw || typeof raw !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) out[k] = Math.round(n)
    }
    return out
  }
  const task_estimates = normalizeMinutesMap(params.task_estimates)
  const activity_durations = normalizeMinutesMap(params.activity_durations)

  if (!Number.isFinite(hours_available) || hours_available <= 0) {
    return { success: false, action_taken: 'hours_available must be a positive number', data: {} }
  }
  if (!Number.isFinite(feel) || feel < 1 || feel > 10) {
    return { success: false, action_taken: 'feel must be between 1 and 10', data: {} }
  }
  if (scheduled_activity_template_ids.length < 2) {
    return {
      success: false,
      action_taken: 'Schedule at least 2 active activities (gym, walk, etc.).',
      data: { active_count: scheduled_activity_template_ids.length },
    }
  }

  // Verify all scheduled templates are health-category
  const { data: templates } = await supabase
    .from('activity_templates')
    .select('id, name, category, default_minutes, historical_minutes, preferred_time_slot, preferred_start_time')
    .eq('user_id', context.userId)
    .in('id', scheduled_activity_template_ids)
  const tpls = (templates ?? []) as Sb[]
  const nonHealth = tpls.filter(t => t.category !== 'health')
  if (nonHealth.length > 0 || tpls.length !== scheduled_activity_template_ids.length) {
    return {
      success: false,
      action_taken: 'All scheduled activities must be category="health" (gym, walk, run, etc.).',
      data: { offending: nonHealth.map(t => t.name) },
    }
  }

  // Fetch selected tasks
  const { data: selectedTasks } = selected_task_ids.length
    ? await supabase
        .from('todos')
        .select('id, title, priority, estimated_time, historical_minutes, recurrence')
        .eq('user_id', context.userId)
        .in('id', selected_task_ids)
    : { data: [] as Sb[] }

  const mode = chooseMode(medication_taken, feel)

  // Fetch learnings and filter to ones whose applies_when matches today
  const allLearnings = await getLearnings(context.userId, supabase, 'behavior')
  const relevantLearnings = allLearnings
    .filter(l => {
      const aw = (l.content as Sb)?.applies_when
      if (!aw) return true
      if (aw.medicated !== null && aw.medicated !== undefined && aw.medicated !== medication_taken) return false
      return true
    })
    .slice(0, 8)
    .map(l => l.content)

  const aiInput = {
    date,
    start_time,
    hours_available,
    feel,
    medication_taken,
    mode,
    tasks: (selectedTasks ?? []).map((t: Sb) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      estimated_minutes: t.estimated_time,
      user_estimated_minutes: task_estimates[t.id] ?? null,
      average_actual_minutes: avg(t.historical_minutes),
      recurrence: t.recurrence,
    })),
    active_activities: tpls.map(t => ({
      id: t.id,
      name: t.name,
      default_minutes: t.default_minutes,
      user_duration_minutes: activity_durations[t.id] ?? null,
      average_minutes: avg(t.historical_minutes) ?? t.default_minutes,
      preferred_time_slot: t.preferred_time_slot,
      preferred_start_time: t.preferred_start_time,
    })),
    learnings: relevantLearnings,
  }

  if (!context.aiConfig?.key) {
    return {
      success: false,
      action_taken: 'AI provider not configured — set an API key in Settings before generating a plan.',
      data: { mode, input: aiInput },
    }
  }

  let aiContent = ''
  try {
    const ai = await callAI(JSON.stringify(aiInput), context.aiConfig, {
      purpose: 'planner_generate',
      model: context.aiConfig.model,
      maxTokens: 2000,
      temperature: 0.3,
      systemPrompt: buildGeneratorSystemPrompt(mode, medication_taken),
    })
    aiContent = ai.content
  } catch (err) {
    return {
      success: false,
      action_taken: 'AI plan generation failed',
      data: { error: err instanceof Error ? err.message : String(err) },
    }
  }

  const parsed = parseJson<{ blocks: GeneratedBlock[]; reasoning: string; warnings?: string[] }>(aiContent)
  if (!parsed || !Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
    return {
      success: false,
      action_taken: 'AI returned an unparseable plan',
      data: { raw: aiContent },
    }
  }

  // Upsert daily_plans row (UNIQUE on user_id, date)
  const userContext: UserContext = { hours_available, feel, medication_taken, mode }
  const { data: existing } = await supabase
    .from('daily_plans')
    .select('id')
    .eq('user_id', context.userId)
    .eq('date', date)
    .maybeSingle()

  let planId: string
  if (existing?.id) {
    planId = existing.id
    await supabase
      .from('daily_plans')
      .update({
        status: 'active',
        ai_reasoning: parsed.reasoning,
        ai_warnings: parsed.warnings ?? [],
        ai_model_used: context.aiConfig.model ?? null,
        user_context: userContext,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)
    await supabase.from('time_blocks').delete().eq('plan_id', planId).eq('user_id', context.userId)
  } else {
    const { data: created, error } = await supabase
      .from('daily_plans')
      .insert({
        user_id: context.userId,
        date,
        status: 'active',
        ai_reasoning: parsed.reasoning,
        ai_warnings: parsed.warnings ?? [],
        ai_model_used: context.aiConfig.model ?? null,
        user_context: userContext,
      })
      .select('id')
      .single()
    if (error || !created) {
      return { success: false, action_taken: 'Failed to save plan', data: { error: error?.message } }
    }
    planId = created.id
  }

  // Insert time_blocks
  const rows = parsed.blocks.map((b, i) => ({
    user_id: context.userId,
    plan_id: planId,
    task_id: b.task_id || null,
    activity_template_id: b.activity_template_id || null,
    title: b.title,
    description: b.smallest_first_step || null,
    start_time: b.start_time,
    end_time: b.end_time,
    estimated_minutes: b.estimated_minutes || minutesBetween(b.start_time, b.end_time),
    status: 'pending',
    sort_order: i,
    notes: b.notes || null,
  }))
  const { error: blocksError } = await supabase.from('time_blocks').insert(rows)
  if (blocksError) {
    return { success: false, action_taken: 'Failed to save plan blocks', data: { error: blocksError.message } }
  }

  return {
    success: true,
    action_taken: `Plan for ${date} created — ${rows.length} blocks (${mode}).`,
    data: {
      plan_id: planId,
      mode,
      blocks: rows,
      ai_reasoning: parsed.reasoning,
      warnings: parsed.warnings ?? [],
    },
    suggestions: ['/plan.review', '/plan.close'],
  }
}

async function handlePlanReview(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const supabase = context.supabase as Sb
  const date = (params.date as string) || todayISO()

  const { data: plan } = await supabase
    .from('daily_plans')
    .select('id, date, status, ai_reasoning, ai_warnings, user_context')
    .eq('user_id', context.userId)
    .eq('date', date)
    .maybeSingle()

  if (!plan) {
    return {
      success: true,
      action_taken: `No plan for ${date} yet.`,
      data: { plan: null, blocks: [] },
      suggestions: ['/plan'],
    }
  }

  const { data: blocks } = await supabase
    .from('time_blocks')
    .select('id, task_id, activity_template_id, title, start_time, end_time, estimated_minutes, actual_minutes, status, sort_order, notes')
    .eq('plan_id', plan.id)
    .eq('user_id', context.userId)
    .order('sort_order', { ascending: true })

  const rows = (blocks ?? []) as Sb[]

  // Mark recurring blocks: any block whose task has recurrence != 'none' OR any activity_template block
  const taskIds = rows.map(b => b.task_id).filter(Boolean)
  const recurringTaskIds = new Set<string>()
  const taskHistory = new Map<string, { avg: number | null; count: number }>()
  if (taskIds.length) {
    const { data: trs } = await supabase
      .from('todos')
      .select('id, recurrence, historical_minutes')
      .in('id', taskIds)
    for (const t of (trs ?? []) as Sb[]) {
      if (t.recurrence && t.recurrence !== 'none') recurringTaskIds.add(t.id)
      taskHistory.set(t.id, {
        avg: avg(t.historical_minutes),
        count: Array.isArray(t.historical_minutes) ? t.historical_minutes.length : 0,
      })
    }
  }

  const templateIds = rows.map(b => b.activity_template_id).filter(Boolean)
  const templateHistory = new Map<string, { avg: number | null; count: number }>()
  if (templateIds.length) {
    const { data: tps } = await supabase
      .from('activity_templates')
      .select('id, average_minutes, historical_minutes, default_minutes')
      .in('id', templateIds)
    for (const t of (tps ?? []) as Sb[]) {
      templateHistory.set(t.id, {
        avg: t.average_minutes ?? avg(t.historical_minutes) ?? t.default_minutes,
        count: Array.isArray(t.historical_minutes) ? t.historical_minutes.length : 0,
      })
    }
  }

  const enriched = rows.map(b => {
    const variance = b.actual_minutes != null ? b.actual_minutes - b.estimated_minutes : null
    const isActivity = Boolean(b.activity_template_id)
    const taskIsRecurring = b.task_id ? recurringTaskIds.has(b.task_id) : false
    const recurring = isActivity || taskIsRecurring
    const hist = isActivity
      ? templateHistory.get(b.activity_template_id) ?? { avg: null, count: 0 }
      : b.task_id
        ? taskHistory.get(b.task_id) ?? { avg: null, count: 0 }
        : { avg: null, count: 0 }
    return {
      ...b,
      variance_minutes: variance,
      recurring,
      is_recurring_or_activity: recurring,
      average_minutes: hist.avg,
      average_count: hist.count,
    }
  })

  const completed = enriched.filter(b => b.status === 'completed').length
  const totalVariance = enriched
    .filter(b => typeof b.variance_minutes === 'number')
    .reduce((a, b) => a + (b.variance_minutes as number), 0)

  return {
    success: true,
    action_taken: `${completed}/${enriched.length} blocks done. Running variance: ${totalVariance >= 0 ? '+' : ''}${totalVariance} min.`,
    data: {
      plan,
      blocks: enriched,
      recurring_block_ids: enriched.filter(b => b.recurring).map(b => b.id),
      stats: { completed, total: enriched.length, total_variance_minutes: totalVariance },
    },
    suggestions: ['/plan.close'],
  }
}

interface BlockActual {
  block_id: string
  actual_minutes: number
  status: 'completed' | 'skipped' | 'pending' | 'active' | 'rescheduled'
  notes?: string
}

async function handlePlanClose(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const supabase = context.supabase as Sb
  const plan_id = params.plan_id as string
  const focus_rating = Number(params.focus_rating)
  const plan_worked = Boolean(params.plan_worked)
  const block_actuals = (params.block_actuals as BlockActual[]) || []
  const notes = (params.notes as string) || ''

  if (!plan_id) {
    return { success: false, action_taken: 'plan_id is required', data: {} }
  }
  if (!Number.isFinite(focus_rating) || focus_rating < 1 || focus_rating > 10) {
    return { success: false, action_taken: 'focus_rating must be between 1 and 10', data: {} }
  }

  // Load plan + blocks
  const { data: plan } = await supabase
    .from('daily_plans')
    .select('id, date, user_context, ai_model_used')
    .eq('user_id', context.userId)
    .eq('id', plan_id)
    .maybeSingle()
  if (!plan) {
    return { success: false, action_taken: 'Plan not found', data: {} }
  }

  const { data: blocks } = await supabase
    .from('time_blocks')
    .select('id, task_id, activity_template_id, title, estimated_minutes, start_time')
    .eq('plan_id', plan_id)
    .eq('user_id', context.userId)
  const blockMap = new Map<string, Sb>(((blocks ?? []) as Sb[]).map(b => [b.id, b]))

  // Apply each actual
  for (const a of block_actuals) {
    const b = blockMap.get(a.block_id)
    if (!b) continue
    const actual = Math.max(0, Math.round(a.actual_minutes))

    await supabase
      .from('time_blocks')
      .update({
        actual_minutes: actual,
        status: a.status,
        completed_at: a.status === 'completed' ? new Date().toISOString() : null,
        notes: a.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', a.block_id)
      .eq('user_id', context.userId)

    if (b.task_id) {
      const { data: t } = await supabase
        .from('todos')
        .select('historical_minutes, completed, recurrence')
        .eq('id', b.task_id)
        .maybeSingle()
      const isRecurring = t?.recurrence && t.recurrence !== 'none'
      const patch: Sb = { actual_minutes: actual }
      if (isRecurring) {
        const hist = Array.isArray(t?.historical_minutes) ? [...t.historical_minutes, actual] : [actual]
        patch.historical_minutes = hist.slice(-20)
      }
      if (a.status === 'completed' && !t?.completed) {
        patch.completed = true
        patch.completed_at = new Date().toISOString()
      }
      await supabase.from('todos').update(patch).eq('id', b.task_id).eq('user_id', context.userId)
    }

    if (b.activity_template_id) {
      const { data: tpl } = await supabase
        .from('activity_templates')
        .select('historical_minutes')
        .eq('id', b.activity_template_id)
        .maybeSingle()
      const hist = Array.isArray(tpl?.historical_minutes) ? [...tpl.historical_minutes, actual] : [actual]
      const average = Math.round(hist.reduce((x, y) => x + y, 0) / hist.length)
      await supabase
        .from('activity_templates')
        .update({
          historical_minutes: hist.slice(-20),
          average_minutes: average,
          updated_at: new Date().toISOString(),
        })
        .eq('id', b.activity_template_id)
        .eq('user_id', context.userId)
    }
  }

  // Retrospective stats
  const planned = ((blocks ?? []) as Sb[]).reduce((a, b) => a + (b.estimated_minutes || 0), 0)
  const actualTotal = block_actuals.reduce((a, b) => a + (Math.max(0, Math.round(b.actual_minutes || 0))), 0)
  const completedCount = block_actuals.filter(b => b.status === 'completed').length
  const skippedCount = block_actuals.filter(b => b.status === 'skipped').length
  const completionRate = blocks && blocks.length ? Math.round((completedCount / blocks.length) * 100) : 0

  const perBlockVariance = block_actuals
    .map(a => {
      const b = blockMap.get(a.block_id)
      if (!b) return null
      return {
        title: b.title,
        start_time: b.start_time,
        estimated: b.estimated_minutes,
        actual: a.actual_minutes,
        variance: (a.actual_minutes || 0) - (b.estimated_minutes || 0),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const retrospective = {
    plan_id,
    date: plan.date,
    blocks_planned: blocks?.length ?? 0,
    blocks_completed: completedCount,
    blocks_skipped: skippedCount,
    completion_rate: completionRate,
    total_planned_minutes: planned,
    total_actual_minutes: actualTotal,
    variance_minutes: actualTotal - planned,
    focus_rating,
    plan_worked,
    notes,
    per_block: perBlockVariance,
  }

  // Close the plan
  const updatedContext = { ...(plan.user_context || {}), focus_rating }
  await supabase
    .from('daily_plans')
    .update({ status: 'completed', user_context: updatedContext, updated_at: new Date().toISOString() })
    .eq('id', plan_id)
    .eq('user_id', context.userId)

  // Ask AI for a learning (only if we have enough data + AI)
  let learning_id: string | null = null
  let learning_summary: string | null = null
  if (context.aiConfig?.key && blocks && blocks.length > 0) {
    try {
      const aiInput = {
        retrospective,
        medicated: (plan.user_context as Sb)?.medication_taken ?? null,
      }
      const ai = await callAI(JSON.stringify(aiInput), context.aiConfig, {
        purpose: 'planner_close_learning',
        model: context.aiConfig.model,
        maxTokens: 400,
        temperature: 0.4,
        systemPrompt: CLOSE_LEARNING_SYSTEM_PROMPT,
      })
      const parsed = parseJson<Sb>(ai.content)
      if (parsed && typeof parsed === 'object') {
        const res = await createLearning(context.userId, 'behavior', parsed, supabase)
        if (res.success) {
          learning_id = (res.data as Sb)?.learning_id ?? null
          learning_summary = parsed.description ?? null
        }
      }
    } catch {
      // Swallow — learning generation is best-effort
    }
  }

  return {
    success: true,
    action_taken: `Day closed. ${completedCount}/${blocks?.length ?? 0} blocks completed, variance ${retrospective.variance_minutes >= 0 ? '+' : ''}${retrospective.variance_minutes} min.`,
    data: { retrospective, learning_id, learning_summary },
    suggestions: ['/plan'],
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const plannerTool: ToolDefinition = {
  id: 'planner',
  domain: 'planning',
  description: 'ADHD-aware daily planner: morning intake, plan generation, end-of-day reflection, and learning loop',

  actions: [
    { action: 'plan.start', description: 'Inventory open tasks and ask the daily questions', handler: handlePlanStart },
    { action: 'plan.generate', description: 'Generate a plan from user answers', handler: handlePlanGenerate },
    { action: 'plan.review', description: "Show today's plan with running variance", handler: handlePlanReview },
    { action: 'plan.close', description: 'Submit actuals, write learning, close the day', handler: handlePlanClose },
  ],

  commands: [
    { command: '/plan', action: 'plan.start', description: 'Start planning your day' },
    { command: '/plan.review', action: 'plan.review', description: "Review today's plan" },
    { command: '/plan.close', action: 'plan.close', description: 'Close the day and capture learnings' },
  ],

  rules: [
    {
      pattern: /\b(?:plan (?:my )?(?:day|dag)|dagplan|plan vandaag|plan today)\b/i,
      action: 'plan.start',
    },
    {
      pattern: /\b(?:how(?:'s| is) (?:my|the) plan|hoe staat (?:mijn|het) plan|review (?:my )?plan)\b/i,
      action: 'plan.review',
    },
    {
      pattern: /\b(?:close (?:the )?day|sluit (?:de )?dag|end of day|einde (?:van de )?dag)\b/i,
      action: 'plan.close',
    },
  ],
}
