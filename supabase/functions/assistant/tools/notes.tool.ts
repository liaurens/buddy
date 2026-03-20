import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'

// ─── Internal Logic ─────────────────────────────────────────────────────────

function parseNoteContent(content: string): { cleanContent: string; flag: string | null } {
  const flagMatch = content.match(/-(\w+)/)
  if (flagMatch) {
    const flag = flagMatch[1].toLowerCase()
    const cleanContent = content.replace(/-\w+/, '').trim()
    return { cleanContent, flag }
  }
  return { cleanContent: content, flag: null }
}

function isShoppingNote(content: string, flag: string | null): boolean {
  const lower = content.toLowerCase()
  return (
    flag === 'shop' ||
    flag === 'boodschap' ||
    flag === 'boodschappen' ||
    lower.startsWith('koop ') ||
    lower.startsWith('buy ') ||
    lower.startsWith('haal ') ||
    lower.startsWith('boodschappen:') ||
    lower.startsWith('boodschappen ')
  )
}

// ─── Action Handlers ────────────────────────────────────────────────────────

export async function createNote(
  content: string,
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  forceCategory?: string
): Promise<ToolResult> {
  const { cleanContent, flag } = parseNoteContent(content)
  const effectiveFlag = forceCategory || flag

  let categoryId: string | null = null
  let categoryName = 'Inbox'

  if (effectiveFlag) {
    const { data: category } = await supabase
      .from('note_categories')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('flag', effectiveFlag)
      .single()

    if (category) {
      categoryId = category.id
      categoryName = category.name
    }
  }

  if (!categoryId && isShoppingNote(content, flag)) {
    const { data: shopCat } = await supabase
      .from('note_categories')
      .select('id, name')
      .eq('user_id', userId)
      .or('flag.ilike.shop,flag.ilike.boodschap,flag.ilike.boodschappen,name.ilike.%shop%,name.ilike.%boodschap%')
      .limit(1)
      .single()

    if (shopCat) {
      categoryId = shopCat.id
      categoryName = shopCat.name
    }
  }

  const { data: note, error } = await supabase
    .from('smart_notes')
    .insert({
      user_id: userId,
      content: cleanContent,
      category_id: categoryId,
      flag: effectiveFlag,
      processed: false,
    })
    .select()
    .single()

  if (error) {
    return { success: false, action_taken: 'Failed to save note', data: { error: error.message } }
  }

  return {
    success: true,
    action_taken: `Note saved to ${categoryName}`,
    data: { note_id: note.id, category: categoryName, flag: effectiveFlag },
    suggestions: ['View in Notes →'],
  }
}

export async function queryNotes(
  query: string,
  userId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  limit = 5
): Promise<ToolResult> {
  let dbQuery = supabase
    .from('smart_notes')
    .select('id, content, flag, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (query) {
    dbQuery = dbQuery.ilike('content', `%${query}%`)
  }

  const { data: notes, error } = await dbQuery

  if (error) {
    return { success: false, action_taken: 'Failed to query notes', data: { error: error.message } }
  }

  return {
    success: true,
    action_taken: `Found ${notes?.length ?? 0} notes`,
    data: { notes: notes ?? [] },
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

async function handleCreateNote(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const content = (params.content as string) || ''
  return createNote(content, context.userId, context.supabase)
}

async function handleCreateShoppingNote(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const content = (params.content as string) || ''
  return createNote(content, context.userId, context.supabase, 'shop')
}

async function handleQueryNotes(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const query = (params.content as string) || ''
  return queryNotes(query, context.userId, context.supabase)
}

export const notesTool: ToolDefinition = {
  id: 'notes',
  domain: 'content',
  description: 'Create and search notes',

  actions: [
    { action: 'note.create', description: 'Create a new note', handler: handleCreateNote },
    { action: 'note.create.shopping', description: 'Create a shopping note', handler: handleCreateShoppingNote },
    { action: 'note.query', description: 'Search notes', handler: handleQueryNotes },
  ],

  commands: [
    { command: '/note', action: 'note.create', description: 'Create a note: /note Buy new headphones' },
    { command: '/shop', action: 'note.create.shopping', description: 'Add to shopping list: /shop Milk and cheese' },
    { command: '/find', action: 'note.query', description: 'Search notes: /find machine learning' },
  ],

  rules: [
    // Shopping notes
    {
      pattern: /(?:^-(?:shop|boodschap|boodschappen)\b|^(?:koop|buy|haal|boodschappen[: ]))/i,
      action: 'note.create.shopping',
      extractParams: (_m, input) => ({ content: input }),
    },
    // Generic note flags or note keywords
    {
      pattern: /(?:-\w+|^(?:note|notitie|schrijf|schrijf op)[: ])/i,
      action: 'note.create',
      extractParams: (_m, input) => ({ content: input }),
    },
  ],
}
