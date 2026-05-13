import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

interface ChecklistItem {
  id: string
  text: string
  isChecked: boolean
}

function makeItem(text: string): ChecklistItem {
  return { id: crypto.randomUUID(), text, isChecked: false }
}

// deno-lint-ignore no-explicit-any
async function findChecklist(name: string, userId: string, supabase: any) {
  const exact = await supabase
    .from('checklists')
    .select('id, name, items, emoji')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle()
  if (exact.data) return exact.data
  const fuzzy = await supabase
    .from('checklists')
    .select('id, name, items, emoji')
    .eq('user_id', userId)
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle()
  return fuzzy.data
}

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleCreateChecklist(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const name = (typeof params.name === 'string' ? params.name : (params.content as string) || '').trim()
  if (!name) {
    return { success: false, action_taken: 'Provide a checklist name. Example: { name: "packing", items: ["passport","charger"] }', data: {} }
  }
  const items = Array.isArray(params.items)
    ? (params.items as unknown[]).map((s) => String(s).trim()).filter(Boolean).map(makeItem)
    : []
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const { data: checklist, error } = await supabase
    .from('checklists')
    .insert({
      user_id: context.userId,
      name,
      description: typeof params.description === 'string' ? params.description : null,
      emoji: typeof params.emoji === 'string' ? params.emoji : null,
      items,
      is_pinned: false,
    })
    .select('id, name')
    .single()
  if (error) {
    return { success: false, action_taken: 'Failed to create checklist', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Checklist "${name}" created with ${items.length} item${items.length === 1 ? '' : 's'}.`,
    data: { checklist_id: checklist.id, name, item_count: items.length },
  }
}

async function handleListChecklists(_params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const { data: checklists, error } = await supabase
    .from('checklists')
    .select('id, name, emoji, items, is_pinned')
    .eq('user_id', context.userId)
    .order('is_pinned', { ascending: false })
    .order('name', { ascending: true })
  if (error) {
    return { success: false, action_taken: 'Failed to list checklists', data: { error: error.message } }
  }
  const list = checklists ?? []
  if (list.length === 0) {
    return { success: true, action_taken: 'No checklists yet.', data: { checklists: [], count: 0 } }
  }
  // deno-lint-ignore no-explicit-any
  const summary = list.map((c: any) => {
    const items = Array.isArray(c.items) ? c.items : []
    const done = items.filter((i: ChecklistItem) => i.isChecked).length
    return `• ${c.emoji ? c.emoji + ' ' : ''}${c.name} (${done}/${items.length})`
  }).join('\n')
  return {
    success: true,
    action_taken: `${list.length} checklist${list.length === 1 ? '' : 's'}:\n${summary}`,
    data: { checklists: list, count: list.length },
  }
}

async function handleGetChecklist(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const name = (params.name as string || (params.content as string) || '').trim()
  if (!name) return { success: false, action_taken: 'Provide a checklist name.', data: {} }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const cl = await findChecklist(name, context.userId, supabase)
  if (!cl) {
    return { success: false, action_taken: `Could not find checklist "${name}"`, data: {} }
  }
  const items = Array.isArray(cl.items) ? cl.items : []
  // deno-lint-ignore no-explicit-any
  const summary = items.map((i: ChecklistItem) => `${i.isChecked ? '✓' : '○'} ${i.text}`).join('\n')
  const done = items.filter((i: ChecklistItem) => i.isChecked).length
  return {
    success: true,
    action_taken: `${cl.name} (${done}/${items.length}):\n${summary || '(empty)'}`,
    data: { checklist_id: cl.id, name: cl.name, items, done, total: items.length },
  }
}

async function handleCheckItem(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const listName = (params.checklist as string || '').trim()
  const itemText = (params.item as string || '').trim()
  if (!listName || !itemText) {
    return { success: false, action_taken: 'Provide checklist and item.', data: {} }
  }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const cl = await findChecklist(listName, context.userId, supabase)
  if (!cl) return { success: false, action_taken: `Could not find checklist "${listName}"`, data: {} }
  const items: ChecklistItem[] = Array.isArray(cl.items) ? cl.items : []
  const lower = itemText.toLowerCase()
  const idx = items.findIndex((i) => i.text.toLowerCase() === lower)
  const targetIdx = idx >= 0 ? idx : items.findIndex((i) => i.text.toLowerCase().includes(lower))
  if (targetIdx === -1) {
    return { success: false, action_taken: `Could not find item "${itemText}" in checklist "${cl.name}"`, data: {} }
  }
  const updated = items.map((it, i) => i === targetIdx ? { ...it, isChecked: !it.isChecked } : it)
  const { error } = await supabase
    .from('checklists')
    .update({ items: updated, updated_at: new Date().toISOString() })
    .eq('id', cl.id)
    .eq('user_id', context.userId)
  if (error) {
    return { success: false, action_taken: 'Failed to update checklist', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `${updated[targetIdx].isChecked ? 'Checked' : 'Unchecked'} "${updated[targetIdx].text}" in "${cl.name}".`,
    data: { checklist_id: cl.id, item_id: updated[targetIdx].id, checked: updated[targetIdx].isChecked },
  }
}

async function handleResetChecklist(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const name = (params.name as string || (params.content as string) || '').trim()
  if (!name) return { success: false, action_taken: 'Provide a checklist name.', data: {} }
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const cl = await findChecklist(name, context.userId, supabase)
  if (!cl) return { success: false, action_taken: `Could not find checklist "${name}"`, data: {} }
  const items: ChecklistItem[] = Array.isArray(cl.items) ? cl.items : []
  const reset = items.map((i) => ({ ...i, isChecked: false }))
  const { error } = await supabase
    .from('checklists')
    .update({ items: reset, updated_at: new Date().toISOString() })
    .eq('id', cl.id)
    .eq('user_id', context.userId)
  if (error) {
    return { success: false, action_taken: 'Failed to reset checklist', data: { error: error.message } }
  }
  return {
    success: true,
    action_taken: `Reset "${cl.name}" (${items.length} items unchecked).`,
    data: { checklist_id: cl.id, count: items.length },
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const checklistsTool: ToolDefinition = {
  id: 'checklists',
  domain: 'planning',
  description: 'Reusable checklists for recurring routines (packing, weekly review, pre-flight, etc.).',

  actions: [
    {
      action: 'checklist.create',
      description: 'Create a new reusable checklist. Example: { name: "packing", items: ["passport","charger","toothbrush"] }.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Checklist name.' },
          items: { type: 'array', items: { type: 'string' }, description: 'Initial item texts.' },
          emoji: { type: 'string', description: 'Optional emoji.' },
          description: { type: 'string', description: 'Optional description.' },
        },
        required: ['name'],
      },
      handler: handleCreateChecklist,
    },
    {
      action: 'checklist.list',
      description: 'List the user\'s checklists with completion counts.',
      inputSchema: { type: 'object', properties: {} },
      handler: handleListChecklists,
    },
    {
      action: 'checklist.get',
      description: 'Get a single checklist by name (fuzzy-matched), with items and check state.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Checklist name to fuzzy-match.' },
        },
        required: ['name'],
      },
      handler: handleGetChecklist,
    },
    {
      action: 'checklist.check_item',
      description: 'Toggle the checked state of a single item in a checklist. Both fuzzy-matched.',
      inputSchema: {
        type: 'object',
        properties: {
          checklist: { type: 'string', description: 'Checklist name (fuzzy-matched).' },
          item: { type: 'string', description: 'Item text (fuzzy-matched).' },
        },
        required: ['checklist', 'item'],
      },
      handler: handleCheckItem,
    },
    {
      action: 'checklist.reset',
      description: 'Uncheck all items in a checklist so it can be reused.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Checklist name (fuzzy-matched).' },
        },
        required: ['name'],
      },
      handler: handleResetChecklist,
    },
  ],

  commands: [
    { command: '/checklist', action: 'checklist.get', description: 'Show a checklist: /checklist packing' },
    { command: '/checklists', action: 'checklist.list', description: 'List your checklists' },
  ],

  rules: [],
}
