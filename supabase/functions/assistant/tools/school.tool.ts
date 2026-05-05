/**
 * School tool — classes, assignments (with deadlines), and class sessions.
 *
 * Composite reminder: school_assignment_create accepts reminder_days_before /
 * reminder_hours_before so the agent can create the deadline AND the reminder
 * in a single call. The handler inserts both rows; partial failures are
 * surfaced in the ToolResult so the caller knows which step failed.
 *
 * Class-name fuzzy resolution: when class_name is provided without class_id,
 * the handler does a case-insensitive substring match. 0/≥2 matches return
 * structured errors so the model can either ask the user or call school_class_create.
 */

import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

interface ClassRow { id: string; name: string }

async function resolveClass(
  context: AgentContext,
  classId: string | undefined,
  className: string | undefined
): Promise<{ ok: true; class: ClassRow } | { ok: false; result: ToolResult }> {
  // deno-lint-ignore no-explicit-any
  const sb = context.supabase as any
  if (classId) {
    const { data, error } = await sb
      .from('classes')
      .select('id, name')
      .eq('user_id', context.userId)
      .eq('id', classId)
      .single()
    if (error || !data) {
      return {
        ok: false,
        result: {
          success: false,
          action_taken: `No class with id ${classId}.`,
          data: { error: 'class_not_found' },
        },
      }
    }
    return { ok: true, class: data as ClassRow }
  }

  if (!className) {
    return {
      ok: false,
      result: {
        success: false,
        action_taken: 'Provide either class_id or class_name.',
        data: { error: 'missing_class_ref' },
      },
    }
  }

  const { data: classes } = await sb
    .from('classes')
    .select('id, name')
    .eq('user_id', context.userId)
    .eq('archived', false)
  const list: ClassRow[] = Array.isArray(classes) ? classes : []
  const needle = className.toLowerCase()
  const exact = list.filter(c => c.name.toLowerCase() === needle)
  const matches = exact.length > 0
    ? exact
    : list.filter(c => c.name.toLowerCase().includes(needle))

  if (matches.length === 0) {
    return {
      ok: false,
      result: {
        success: false,
        action_taken: `No class named "${className}". Existing classes: ${list.map(c => c.name).join(', ') || '(none)'}. Create it first via school_class_create or ask the user.`,
        data: { error: 'class_not_found', available: list.map(c => c.name) },
      },
    }
  }
  if (matches.length > 1) {
    return {
      ok: false,
      result: {
        success: false,
        action_taken: `Multiple classes match "${className}": ${matches.map(c => c.name).join(', ')}. Ask the user which one or pass class_id.`,
        data: { error: 'class_ambiguous', candidates: matches },
      },
    }
  }
  return { ok: true, class: matches[0] }
}

// ─── Class actions ──────────────────────────────────────────────────────────

async function handleClassCreate(
  params: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  const name = typeof params.name === 'string' ? params.name.trim() : ''
  if (!name) {
    return { success: false, action_taken: 'name is required', data: {} }
  }
  // deno-lint-ignore no-explicit-any
  const sb = context.supabase as any
  const { data, error } = await sb
    .from('classes')
    .insert({
      user_id: context.userId,
      name,
      instructor: params.instructor ?? null,
      term: params.term ?? null,
      color: params.color ?? '#6366f1',
    })
    .select()
    .single()
  if (error) {
    return { success: false, action_taken: 'Failed to create class', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Class created: "${data.name}"`,
    data: { class_id: data.id, name: data.name },
  }
}

async function handleClassList(
  params: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const sb = context.supabase as any
  let q = sb.from('classes').select('id, name, instructor, term, color, archived')
    .eq('user_id', context.userId)
    .order('name', { ascending: true })
  if (params.archived !== true) q = q.eq('archived', false)
  const { data, error } = await q
  if (error) {
    return { success: false, action_taken: 'Failed to list classes', data: { error: error.message } }
  }
  const classes = data ?? []
  return {
    success: true,
    action_taken: `${classes.length} classes`,
    data: { classes },
  }
}

// ─── Assignment actions ─────────────────────────────────────────────────────

async function handleAssignmentCreate(
  params: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  const title = typeof params.title === 'string' ? params.title.trim() : ''
  const deadline = typeof params.deadline === 'string' ? params.deadline : ''
  if (!title || !deadline) {
    return { success: false, action_taken: 'title and deadline are required', data: {} }
  }
  const deadlineDate = new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) {
    return { success: false, action_taken: `Invalid deadline ISO timestamp: ${deadline}`, data: {} }
  }

  const resolved = await resolveClass(
    context,
    typeof params.class_id === 'string' ? params.class_id : undefined,
    typeof params.class_name === 'string' ? params.class_name : undefined
  )
  if (!resolved.ok) return resolved.result

  // deno-lint-ignore no-explicit-any
  const sb = context.supabase as any
  const { data: assignment, error } = await sb
    .from('assignments')
    .insert({
      user_id: context.userId,
      class_id: resolved.class.id,
      title,
      description: params.description ?? null,
      deadline: deadlineDate.toISOString(),
      status: 'pending',
      estimated_minutes: typeof params.estimated_minutes === 'number' ? params.estimated_minutes : null,
    })
    .select()
    .single()

  if (error) {
    return { success: false, action_taken: 'Failed to create assignment', data: { error: error.message } }
  }

  // ─── Optional reminder ────────────────────────────────────────────────────
  const reminderDays = Number(params.reminder_days_before) || 0
  const reminderHours = Number(params.reminder_hours_before) || 0
  const reminderTimeOfDay = typeof params.reminder_time_of_day === 'string'
    ? params.reminder_time_of_day
    : ''

  let reminderId: string | null = null
  let reminderError: string | null = null

  if (reminderDays > 0 || reminderHours > 0 || reminderTimeOfDay) {
    const reminderAt = new Date(deadlineDate.getTime())
    reminderAt.setDate(reminderAt.getDate() - reminderDays)
    reminderAt.setHours(reminderAt.getHours() - reminderHours)
    if (reminderTimeOfDay && /^\d{1,2}:\d{2}$/.test(reminderTimeOfDay)) {
      const [hh, mm] = reminderTimeOfDay.split(':').map(Number)
      reminderAt.setHours(hh, mm, 0, 0)
    }
    if (reminderAt.getTime() <= Date.now()) {
      reminderError = `Reminder time ${reminderAt.toISOString()} is in the past; skipped.`
    } else {
      const message = `Upcoming: ${title} (${resolved.class.name}) — due ${deadlineDate.toISOString().slice(0, 10)}`
      const { data: notif, error: notifErr } = await sb
        .from('scheduled_notifications')
        .insert({
          user_id: context.userId,
          tool_category: 'planning',
          notification_type: 'school_deadline_reminder',
          title: `Reminder: ${title}`,
          body: message,
          scheduled_for: reminderAt.toISOString(),
          status: 'pending',
          data: { assignment_id: assignment.id, class_id: resolved.class.id },
        })
        .select()
        .single()
      if (notifErr) {
        reminderError = notifErr.message
      } else {
        reminderId = notif.id
      }
    }
  }

  const reminderSummary = reminderId
    ? ` + reminder set`
    : reminderError
      ? ` (reminder failed: ${reminderError})`
      : ''
  return {
    success: !reminderError, // assignment created either way; reminder failure surfaces here
    action_taken: `Assignment "${title}" added to ${resolved.class.name}, due ${deadlineDate.toISOString().slice(0, 10)}${reminderSummary}`,
    data: {
      assignment_id: assignment.id,
      class_id: resolved.class.id,
      class_name: resolved.class.name,
      deadline: deadlineDate.toISOString(),
      reminder_id: reminderId,
      reminder_error: reminderError,
    },
  }
}

async function handleAssignmentList(
  params: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const sb = context.supabase as any
  let q = sb
    .from('assignments')
    .select('id, title, deadline, status, class_id, classes(name)')
    .eq('user_id', context.userId)
    .order('deadline', { ascending: true })
    .limit(50)

  if (typeof params.class_id === 'string') q = q.eq('class_id', params.class_id)
  if (typeof params.class_name === 'string') {
    const resolved = await resolveClass(context, undefined, params.class_name)
    if (!resolved.ok) return resolved.result
    q = q.eq('class_id', resolved.class.id)
  }
  if (typeof params.status === 'string') q = q.eq('status', params.status)
  if (typeof params.days_ahead === 'number' && params.days_ahead > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + params.days_ahead)
    q = q.lte('deadline', cutoff.toISOString())
  }

  const { data, error } = await q
  if (error) {
    return { success: false, action_taken: 'Failed to list assignments', data: { error: error.message } }
  }
  const assignments = data ?? []
  return {
    success: true,
    action_taken: `${assignments.length} assignments`,
    data: { assignments },
  }
}

async function handleAssignmentComplete(
  params: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const sb = context.supabase as any
  const status = typeof params.status === 'string' ? params.status : 'submitted'
  let assignmentId = typeof params.assignment_id === 'string' ? params.assignment_id : null

  if (!assignmentId && typeof params.title === 'string') {
    const { data } = await sb
      .from('assignments')
      .select('id, title')
      .eq('user_id', context.userId)
      .ilike('title', `%${params.title}%`)
      .order('deadline', { ascending: true })
      .limit(1)
      .single()
    if (data) assignmentId = data.id
  }

  if (!assignmentId) {
    return { success: false, action_taken: 'Provide assignment_id or a title to match.', data: {} }
  }

  const { data, error } = await sb
    .from('assignments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', assignmentId)
    .eq('user_id', context.userId)
    .select()
    .single()

  if (error) {
    return { success: false, action_taken: 'Failed to update assignment', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Assignment "${data.title}" marked ${status}`,
    data: { assignment_id: data.id, status },
  }
}

// ─── Session actions ────────────────────────────────────────────────────────

async function handleSessionList(
  params: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const sb = context.supabase as any
  let q = sb
    .from('class_sessions')
    .select('id, class_id, day_of_week, start_time, end_time, location, classes(name)')
    .eq('user_id', context.userId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })
  if (typeof params.day_of_week === 'number') q = q.eq('day_of_week', params.day_of_week)
  if (typeof params.class_id === 'string') q = q.eq('class_id', params.class_id)
  const { data, error } = await q
  if (error) {
    return { success: false, action_taken: 'Failed to list sessions', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `${(data ?? []).length} class sessions`,
    data: { sessions: data ?? [] },
  }
}

async function handleSessionCreate(
  params: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  const dayOfWeek = Number(params.day_of_week)
  const startTime = typeof params.start_time === 'string' ? params.start_time : ''
  const endTime = typeof params.end_time === 'string' ? params.end_time : ''
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !startTime || !endTime) {
    return { success: false, action_taken: 'day_of_week (0-6), start_time, end_time are required', data: {} }
  }
  const resolved = await resolveClass(
    context,
    typeof params.class_id === 'string' ? params.class_id : undefined,
    typeof params.class_name === 'string' ? params.class_name : undefined
  )
  if (!resolved.ok) return resolved.result
  // deno-lint-ignore no-explicit-any
  const sb = context.supabase as any
  const { data, error } = await sb
    .from('class_sessions')
    .insert({
      user_id: context.userId,
      class_id: resolved.class.id,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      location: params.location ?? null,
    })
    .select()
    .single()
  if (error) {
    return { success: false, action_taken: 'Failed to create class session', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Session added for ${resolved.class.name} on day ${dayOfWeek} ${startTime}–${endTime}`,
    data: { session_id: data.id },
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const schoolTool: ToolDefinition = {
  id: 'school',
  domain: 'school',
  description: 'Manage school classes, assignments (with deadlines), and weekly class sessions.',

  actions: [
    {
      action: 'school.class.create',
      description: 'Create a new school class.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Class name (e.g. "Calculus II")' },
          instructor: { type: 'string', description: 'Optional instructor name' },
          term: { type: 'string', description: 'Optional term (e.g. "Spring 2026")' },
          color: { type: 'string', description: 'Hex color, defaults to #6366f1' },
        },
        required: ['name'],
      },
      handler: handleClassCreate,
    },
    {
      action: 'school.class.list',
      description: 'List the user\'s school classes.',
      inputSchema: {
        type: 'object',
        properties: {
          archived: { type: 'boolean', description: 'Include archived classes (default false)' },
        },
      },
      handler: handleClassList,
    },
    {
      action: 'school.assignment.create',
      description: 'Create a school assignment with a deadline. If reminder_days_before / reminder_hours_before is set, also schedules a reminder relative to the deadline.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Assignment title' },
          deadline: { type: 'string', format: 'date-time', description: 'ISO 8601 deadline timestamp' },
          class_id: { type: 'string', description: 'Class id (preferred)' },
          class_name: { type: 'string', description: 'Class name to fuzzy-match if class_id is unknown' },
          description: { type: 'string', description: 'Optional details' },
          estimated_minutes: { type: 'integer', description: 'Estimated work time in minutes' },
          reminder_days_before: { type: 'integer', description: 'Schedule a reminder N days before the deadline' },
          reminder_hours_before: { type: 'integer', description: 'Schedule a reminder N hours before the deadline' },
          reminder_time_of_day: { type: 'string', description: 'Override the reminder time-of-day in HH:MM (e.g. "09:00")' },
        },
        required: ['title', 'deadline'],
      },
      handler: handleAssignmentCreate,
    },
    {
      action: 'school.assignment.list',
      description: 'List school assignments, optionally filtered by class, status, or upcoming window.',
      inputSchema: {
        type: 'object',
        properties: {
          class_id: { type: 'string' },
          class_name: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'submitted', 'graded'] },
          days_ahead: { type: 'integer', description: 'Only show assignments due within the next N days' },
        },
      },
      handler: handleAssignmentList,
    },
    {
      action: 'school.assignment.complete',
      description: 'Mark a school assignment as submitted/graded/in_progress.',
      inputSchema: {
        type: 'object',
        properties: {
          assignment_id: { type: 'string' },
          title: { type: 'string', description: 'Fuzzy-match a title if assignment_id is unknown' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'submitted', 'graded'], default: 'submitted' },
        },
      },
      handler: handleAssignmentComplete,
    },
    {
      action: 'school.session.list',
      description: 'List the user\'s recurring weekly class sessions.',
      inputSchema: {
        type: 'object',
        properties: {
          day_of_week: { type: 'integer', description: '0=Sunday … 6=Saturday' },
          class_id: { type: 'string' },
        },
      },
      handler: handleSessionList,
    },
    {
      action: 'school.session.create',
      description: 'Add a recurring weekly class session for a class.',
      inputSchema: {
        type: 'object',
        properties: {
          class_id: { type: 'string' },
          class_name: { type: 'string' },
          day_of_week: { type: 'integer', description: '0=Sunday … 6=Saturday' },
          start_time: { type: 'string', description: 'HH:MM (24h)' },
          end_time: { type: 'string', description: 'HH:MM (24h)' },
          location: { type: 'string' },
        },
        required: ['day_of_week', 'start_time', 'end_time'],
      },
      handler: handleSessionCreate,
    },
  ],

  commands: [],
  rules: [],
}
