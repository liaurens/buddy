import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

const DEFAULT_XP_PER_MINUTE = 1

// ─── Helpers ────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function findSkill(name: string, userId: string, supabase: any) {
  const exact = await supabase
    .from('skills')
    .select('id, name, xp, level')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle()
  if (exact.data) return exact.data
  const fuzzy = await supabase
    .from('skills')
    .select('id, name, xp, level')
    .eq('user_id', userId)
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle()
  return fuzzy.data
}

function levelFromXp(xp: number): number {
  // Simple: 100 XP per level. Adjust if the UI uses a different curve.
  return Math.max(1, Math.floor(xp / 100) + 1)
}

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleCreateSkill(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const name = (typeof params.name === 'string' ? params.name : (params.content as string) || '').trim()
  if (!name) {
    return { success: false, action_taken: 'Provide a skill name. Example: { name: "Spanish" }', data: {} }
  }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const { data: skill, error } = await supabase
    .from('skills')
    .insert({
      user_id: context.userId,
      name,
      level: 1,
      xp: 0,
      color: typeof params.color === 'string' ? params.color : '#3b82f6',
      icon: typeof params.icon === 'string' ? params.icon : '✨',
    })
    .select('id, name')
    .single()
  if (error) {
    return { success: false, action_taken: 'Failed to create skill', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Skill "${name}" created.`,
    data: { skill_id: skill.id, name },
    suggestions: ['Log practice with skill_log'],
  }
}

async function handleLogPractice(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const skillName = (params.skill as string || '').trim()
  if (!skillName) {
    return { success: false, action_taken: 'Provide a skill name.', data: {} }
  }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const skill = await findSkill(skillName, context.userId, supabase)
  if (!skill) {
    return { success: false, action_taken: `Could not find skill "${skillName}". Create it with skill_create.`, data: {} }
  }
  const minutes = typeof params.minutes === 'number' ? params.minutes : 0
  const xpGained = typeof params.xp === 'number'
    ? params.xp
    : minutes * DEFAULT_XP_PER_MINUTE
  const note = typeof params.notes === 'string' ? params.notes : null

  const { error: logErr } = await supabase
    .from('skill_logs')
    .insert({
      skill_id: skill.id,
      user_id: context.userId,
      minutes,
      xp_gained: xpGained,
      is_critical: !!params.is_critical,
      note,
      logged_at: new Date().toISOString(),
    })
  if (logErr) {
    return { success: false, action_taken: 'Failed to log practice', data: { error: logErr.message } }
  }

  const newXp = (skill.xp ?? 0) + xpGained
  const newLevel = levelFromXp(newXp)
  const leveledUp = newLevel > (skill.level ?? 1)
  await supabase
    .from('skills')
    .update({ xp: newXp, level: newLevel, updated_at: new Date().toISOString() })
    .eq('id', skill.id)

  return {
    success: true,
    action_taken: `Logged ${minutes} min on "${skill.name}" (+${xpGained} XP${leveledUp ? `, level ${newLevel}! 🎉` : ''}).`,
    data: { skill_id: skill.id, minutes, xp_gained: xpGained, new_xp: newXp, new_level: newLevel, leveled_up: leveledUp },
  }
}

async function handleListSkills(_params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const { data: skills, error } = await supabase
    .from('skills')
    .select('id, name, level, xp, icon')
    .eq('user_id', context.userId)
    .order('xp', { ascending: false })
    .limit(20)
  if (error) {
    return { success: false, action_taken: 'Failed to list skills', data: { error: error.message } }
  }
  const count = skills?.length ?? 0
  if (count === 0) {
    return { success: true, action_taken: 'No skills yet. Create one with skill_create.', data: { skills: [], count: 0 } }
  }
  // deno-lint-ignore no-explicit-any
  const summary = skills.map((s: any) => `• ${s.icon || '✨'} ${s.name} — lvl ${s.level} (${s.xp} XP)`).join('\n')
  return {
    success: true,
    action_taken: `${count} skill${count === 1 ? '' : 's'}:\n${summary}`,
    data: { skills, count },
  }
}

async function handleSkillProgress(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const skillName = (params.skill as string || '').trim()
  if (!skillName) {
    return { success: false, action_taken: 'Provide a skill name.', data: {} }
  }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const skill = await findSkill(skillName, context.userId, supabase)
  if (!skill) {
    return { success: false, action_taken: `Could not find skill "${skillName}"`, data: {} }
  }
  // 30-day timeline
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const { data: logs } = await supabase
    .from('skill_logs')
    .select('logged_at, minutes, xp_gained, is_critical')
    .eq('skill_id', skill.id)
    .gte('logged_at', cutoff.toISOString())
    .order('logged_at', { ascending: false })
    .limit(60)

  const list = logs ?? []
  // deno-lint-ignore no-explicit-any
  const totalMinutes = list.reduce((s: number, l: any) => s + (l.minutes || 0), 0)
  // deno-lint-ignore no-explicit-any
  const totalXp = list.reduce((s: number, l: any) => s + (l.xp_gained || 0), 0)
  const days = new Set(
    // deno-lint-ignore no-explicit-any
    list.map((l: any) => (l.logged_at || '').slice(0, 10)).filter(Boolean)
  ).size

  return {
    success: true,
    action_taken: `"${skill.name}" — lvl ${skill.level}, ${skill.xp} XP. Last 30d: ${list.length} sessions, ${totalMinutes} min, +${totalXp} XP, ${days} active days.`,
    data: {
      skill_id: skill.id,
      level: skill.level,
      xp: skill.xp,
      last_30d: { session_count: list.length, minutes: totalMinutes, xp_gained: totalXp, active_days: days },
      recent: list.slice(0, 10),
    },
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const skillsTool: ToolDefinition = {
  id: 'skills',
  domain: 'improvement',
  description: 'Growth Hub: manage skills the user is developing and log practice sessions.',

  actions: [
    {
      action: 'skill.create',
      description: 'Create a new skill to track. Example: { name: "Spanish", icon: "🇪🇸" }.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Skill name (e.g. "Spanish", "Piano").' },
          color: { type: 'string', description: 'Optional hex color.' },
          icon: { type: 'string', description: 'Optional emoji or icon.' },
        },
        required: ['name'],
      },
      handler: handleCreateSkill,
    },
    {
      action: 'skill.log',
      description: 'Log a practice session against a skill. Provide minutes; XP is auto-calculated unless explicit `xp` is given. Skill name is fuzzy-matched.',
      inputSchema: {
        type: 'object',
        properties: {
          skill: { type: 'string', description: 'Skill name (fuzzy-matched).' },
          minutes: { type: 'integer', description: 'How many minutes of practice.' },
          xp: { type: 'integer', description: 'Override XP (defaults to minutes × 1).' },
          notes: { type: 'string', description: 'Optional notes about the session.' },
          is_critical: { type: 'boolean', description: 'Mark as a critical/breakthrough session.' },
        },
        required: ['skill'],
      },
      handler: handleLogPractice,
    },
    {
      action: 'skill.list',
      description: 'List the user\'s skills with current level and XP.',
      inputSchema: { type: 'object', properties: {} },
      handler: handleListSkills,
    },
    {
      action: 'skill.progress',
      description: 'Show recent practice progress for a skill (last 30 days).',
      inputSchema: {
        type: 'object',
        properties: {
          skill: { type: 'string', description: 'Skill name (fuzzy-matched).' },
        },
        required: ['skill'],
      },
      handler: handleSkillProgress,
    },
  ],

  commands: [
    { command: '/skill', action: 'skill.create', description: 'Create a skill: /skill Spanish' },
    { command: '/skills', action: 'skill.list', description: 'List your skills' },
    { command: '/skill.log', action: 'skill.log', description: 'Log practice (use AI/JSON for params)' },
  ],

  rules: [
    {
      pattern: /^(?:oefen|practice|log\s+practice)\s+(.+)$/i,
      action: 'skill.log',
      extractParams: (m) => ({ skill: m[1], minutes: 0 }),
    },
  ],
}
