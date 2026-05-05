import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleProjectCreate(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const name = typeof params.name === 'string' && params.name.trim()
    ? params.name.trim()
    : ((params.content as string) || '').trim()

  if (!name) {
    return {
      success: false,
      action_taken: 'Please provide a project name. Example: /project Portfolio website',
      data: {},
    }
  }
  const content = name

  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      user_id: context.userId,
      name: content.trim(),
      status: 'active',
    })
    .select()
    .single()

  if (error) {
    return { success: false, action_taken: 'Failed to create project', data: { error: error.message } }
  }

  return {
    success: true,
    action_taken: `Project created: "${content.trim()}"`,
    data: { project_id: project.id, name: content.trim() },
    suggestions: ['/projects', '/project.add'],
  }
}

async function handleProjectList(_params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, status, description, created_at')
    .eq('user_id', context.userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    return { success: false, action_taken: 'Failed to list projects', data: { error: error.message } }
  }

  const count = projects?.length ?? 0
  if (count === 0) {
    return {
      success: true,
      action_taken: 'No active projects. Create one with /project',
      data: { projects: [], count: 0 },
      suggestions: ['/project'],
    }
  }

  // Get task counts per project
  const projectIds = projects.map((p: { id: string }) => p.id)
  const { data: tasks } = await supabase
    .from('todos')
    .select('project_id, completed')
    .in('project_id', projectIds)

  const taskCounts: Record<string, { total: number; done: number }> = {}
  // deno-lint-ignore no-explicit-any
  for (const t of (tasks || []) as any[]) {
    if (!taskCounts[t.project_id]) taskCounts[t.project_id] = { total: 0, done: 0 }
    taskCounts[t.project_id].total++
    if (t.completed) taskCounts[t.project_id].done++
  }

  // deno-lint-ignore no-explicit-any
  const summary = projects.map((p: any) => {
    const counts = taskCounts[p.id]
    const taskStr = counts ? ` — ${counts.done}/${counts.total} tasks` : ' — 0 tasks'
    return `• ${p.name}${taskStr}`
  }).join('\n')

  return {
    success: true,
    action_taken: `${count} active project${count === 1 ? '' : 's'}:\n${summary}`,
    data: { projects: projects ?? [], count, taskCounts },
  }
}

async function handleProjectStatus(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const content = (params.name as string) || (params.content as string) || ''

  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  // If no name provided, show all projects
  if (!content.trim()) {
    return handleProjectList(params, context)
  }

  // Find project by fuzzy name match
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, status, description')
    .eq('user_id', context.userId)
    .ilike('name', `%${content.trim()}%`)
    .limit(1)
    .single()

  if (!project) {
    return {
      success: false,
      action_taken: `Could not find project matching "${content.trim()}"`,
      data: {},
      suggestions: ['/projects'],
    }
  }

  // Get tasks for this project
  const { data: tasks } = await supabase
    .from('todos')
    .select('id, title, completed, due_date')
    .eq('project_id', project.id)
    .order('completed', { ascending: true })
    .order('created_at', { ascending: true })

  const total = tasks?.length ?? 0
  // deno-lint-ignore no-explicit-any
  const done = (tasks || []).filter((t: any) => t.completed).length
  const percent = total > 0 ? Math.round((done / total) * 100) : 0

  // deno-lint-ignore no-explicit-any
  const taskList = (tasks || []).map((t: any) => {
    const check = t.completed ? '✓' : '○'
    return `  ${check} ${t.title}`
  }).join('\n')

  return {
    success: true,
    action_taken: `${project.name} — ${done}/${total} tasks (${percent}%)\n${taskList || '  No tasks yet'}`,
    data: { project, tasks: tasks ?? [], completion: percent },
    suggestions: ['/project.add'],
  }
}

async function handleProjectAdd(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // Structured-params path
  const projectName = typeof params.project_name === 'string' ? params.project_name.trim() : ''
  const taskTitleParam = typeof params.task_title === 'string' ? params.task_title.trim() : ''
  if (projectName && taskTitleParam) {
    // deno-lint-ignore no-explicit-any
    const sb = context.supabase as any
    const { data: project } = await sb
      .from('projects')
      .select('id, name')
      .eq('user_id', context.userId)
      .ilike('name', `%${projectName}%`)
      .limit(1)
      .single()
    if (!project) {
      return {
        success: false,
        action_taken: `Could not find project matching "${projectName}"`,
        data: {},
      }
    }
    const { data: task, error } = await sb
      .from('todos')
      .insert({
        user_id: context.userId,
        title: taskTitleParam,
        completed: false,
        project_id: project.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) {
      return { success: false, action_taken: 'Failed to create task', data: { error: error.message } }
    }
    return {
      success: true,
      action_taken: `Task added to ${project.name}: "${taskTitleParam}"`,
      data: { task_id: task.id, project_id: project.id, project_name: project.name, title: taskTitleParam },
    }
  }

  const content = (params.content as string) || ''
  if (!content.trim()) {
    return {
      success: false,
      action_taken: 'Usage: /project.add ProjectName Task title here',
      data: {},
    }
  }

  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  // Split: first word(s) = project name, rest = task title
  // Try to match against existing project names
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', context.userId)
    .eq('status', 'active')

  if (!projects || projects.length === 0) {
    return {
      success: false,
      action_taken: 'No active projects. Create one first with /project',
      data: {},
      suggestions: ['/project'],
    }
  }

  // Find the best matching project name from the input
  let matchedProject: { id: string; name: string } | null = null
  let taskTitle = content.trim()

  // Sort projects by name length descending so longer names match first
  const sorted = [...projects].sort((a: { name: string }, b: { name: string }) => b.name.length - a.name.length)
  for (const p of sorted) {
    if (content.toLowerCase().startsWith(p.name.toLowerCase())) {
      matchedProject = p
      taskTitle = content.slice(p.name.length).trim()
      break
    }
  }

  // Fallback: try fuzzy match on first word
  if (!matchedProject) {
    const firstWord = content.split(/\s+/)[0]
    // deno-lint-ignore no-explicit-any
    matchedProject = projects.find((p: any) =>
      p.name.toLowerCase().includes(firstWord.toLowerCase())
    ) || null
    if (matchedProject) {
      taskTitle = content.slice(firstWord.length).trim()
    }
  }

  if (!matchedProject) {
    return {
      success: false,
      action_taken: `Could not find a project in your input. Active projects: ${projects.map((p: { name: string }) => p.name).join(', ')}`,
      data: { projects: projects.map((p: { name: string }) => p.name) },
    }
  }

  if (!taskTitle) {
    return {
      success: false,
      action_taken: `Please provide a task title. Example: /project.add ${matchedProject.name} Create homepage`,
      data: {},
    }
  }

  // Create the task linked to the project
  const { data: task, error } = await supabase
    .from('todos')
    .insert({
      user_id: context.userId,
      title: taskTitle,
      completed: false,
      project_id: matchedProject.id,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return { success: false, action_taken: 'Failed to create task', data: { error: error.message } }
  }

  return {
    success: true,
    action_taken: `Task added to ${matchedProject.name}: "${taskTitle}"`,
    data: { task_id: task.id, project_id: matchedProject.id, project_name: matchedProject.name, title: taskTitle },
    suggestions: [`/project.status ${matchedProject.name}`],
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const projectsTool: ToolDefinition = {
  id: 'projects',
  domain: 'projects',
  description: 'Create and manage projects with linked tasks',

  actions: [
    {
      action: 'project.create',
      description: 'Create a new project.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Project name' },
          description: { type: 'string' },
        },
        required: ['name'],
      },
      handler: handleProjectCreate,
    },
    {
      action: 'project.list',
      description: 'List the user\'s active projects with task progress.',
      inputSchema: { type: 'object', properties: {} },
      handler: handleProjectList,
    },
    {
      action: 'project.status',
      description: 'Show details and tasks for a specific project (matched by name).',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Project name to fuzzy-match' },
        },
        required: ['name'],
      },
      handler: handleProjectStatus,
    },
    {
      action: 'project.add',
      description: 'Add a task to a specific project.',
      inputSchema: {
        type: 'object',
        properties: {
          project_name: { type: 'string', description: 'Project name to fuzzy-match' },
          task_title: { type: 'string', description: 'Title of the task to add' },
        },
        required: ['project_name', 'task_title'],
      },
      handler: handleProjectAdd,
    },
  ],

  commands: [
    { command: '/project', action: 'project.create', description: 'Create a project: /project Portfolio website' },
    { command: '/projects', action: 'project.list', description: 'List active projects' },
    { command: '/project.status', action: 'project.status', description: 'Show project status: /project.status Portfolio' },
    { command: '/project.add', action: 'project.add', description: 'Add task to project: /project.add Portfolio Create homepage' },
  ],

  rules: [
    {
      pattern: /\b(?:projecten|projects|mijn projecten|my projects)\b/i,
      action: 'project.list',
    },
  ],
}
