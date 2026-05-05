import type { ToolDefinition, ToolResult, AgentContext } from '../types.ts'
import { callAI } from '../core/ai-wrapper.ts'

// ─── Helpers ────────────────────────────────────────────────────────────────

const REFLECT_SYSTEM_PROMPT = `You are Buddy, a personal reflection assistant for a student.
Based on the recent journal entries provided, write a short, thoughtful reflection.
Highlight patterns you notice (mood shifts, recurring themes, progress).
Ask one gentle follow-up question to encourage deeper thinking.
Keep it under 150 words. Be warm but not cheesy.`

/**
 * Find or create the "journal" category for this user.
 */
// deno-lint-ignore no-explicit-any
async function getJournalCategoryId(userId: string, supabase: any): Promise<string | null> {
  // Try to find existing journal category
  const { data: existing } = await supabase
    .from('note_categories')
    .select('id')
    .eq('user_id', userId)
    .ilike('flag', 'journal')
    .limit(1)
    .single()

  if (existing) return existing.id

  // Create it
  const { data: created, error } = await supabase
    .from('note_categories')
    .insert({
      user_id: userId,
      name: 'Journal',
      flag: 'journal',
      emoji: '📓',
      color: '#8B5CF6',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create journal category:', error.message)
    return null
  }

  return created.id
}

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleJournalWrite(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  const content = (params.content as string) || (params.text as string) || ''

  if (!content.trim()) {
    return {
      success: false,
      action_taken: 'Please write something. Example: /journal Today was a good day because...',
      data: {},
    }
  }

  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any
  const categoryId = await getJournalCategoryId(context.userId, supabase)

  const { data: note, error } = await supabase
    .from('smart_notes')
    .insert({
      user_id: context.userId,
      content: content.trim(),
      category_id: categoryId,
      flag: 'journal',
      processed: false,
    })
    .select()
    .single()

  if (error) {
    return { success: false, action_taken: 'Failed to save journal entry', data: { error: error.message } }
  }

  return {
    success: true,
    action_taken: 'Journal entry saved',
    data: { note_id: note.id, category: 'Journal' },
    suggestions: ['View in Notes →', '/reflect'],
  }
}

async function handleJournalReflect(_params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
  // deno-lint-ignore no-explicit-any
  const supabase = context.supabase as any

  // Fetch recent journal entries
  const categoryId = await getJournalCategoryId(context.userId, supabase)

  let query = supabase
    .from('smart_notes')
    .select('content, created_at')
    .eq('user_id', context.userId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  } else {
    query = query.eq('flag', 'journal')
  }

  const { data: entries, error } = await query

  if (error) {
    return { success: false, action_taken: 'Failed to fetch journal entries', data: { error: error.message } }
  }

  if (!entries || entries.length === 0) {
    return {
      success: true,
      action_taken: 'No journal entries yet. Write one first with /journal',
      data: { entries: [] },
      suggestions: ['/journal'],
    }
  }

  // Format entries for AI
  const entriesText = entries
    .reverse()
    // deno-lint-ignore no-explicit-any
    .map((e: any, i: number) => `Entry ${i + 1} (${new Date(e.created_at).toLocaleDateString()}): ${e.content}`)
    .join('\n\n')

  // If AI is configured, generate a reflection
  if (context.aiConfig?.key) {
    try {
      const aiResult = await callAI(
        `Here are my recent journal entries:\n\n${entriesText}`,
        context.aiConfig,
        {
          purpose: 'journal_reflection',
          model: context.aiConfig.model,
          maxTokens: 300,
          temperature: 0.7,
          systemPrompt: REFLECT_SYSTEM_PROMPT,
        }
      )

      return {
        success: true,
        action_taken: aiResult.content,
        data: {
          reflection: aiResult.content,
          entries_count: entries.length,
          isConversational: true,
          tokensUsed: aiResult.tokensIn + aiResult.tokensOut,
        },
      }
    } catch {
      // Fall through to non-AI response
    }
  }

  // No AI — just return the entries
  return {
    success: true,
    action_taken: `Your last ${entries.length} journal entries`,
    data: {
      entries: entries,
      entries_count: entries.length,
    },
  }
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export const journalTool: ToolDefinition = {
  id: 'journal',
  domain: 'mental',
  description: 'Write journal entries and get AI reflections',

  actions: [
    {
      action: 'journal.write',
      description: 'Save a journal entry to the user\'s notebook.',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The journal entry text.' },
        },
        required: ['content'],
      },
      handler: handleJournalWrite,
    },
    {
      action: 'journal.reflect',
      description: 'Generate an AI reflection on the user\'s most recent journal entries. Useful when the user asks to look back or review.',
      inputSchema: { type: 'object', properties: {} },
      handler: handleJournalReflect,
    },
  ],

  commands: [
    { command: '/journal', action: 'journal.write', description: 'Write a journal entry: /journal Today I learned...' },
    { command: '/reflect', action: 'journal.reflect', description: 'Get a reflection on recent journal entries' },
  ],

  rules: [
    {
      pattern: /\b(?:dagboek|journal|diary)\b/i,
      action: 'journal.write',
      extractParams: (_m, input) => ({ content: input }),
    },
    {
      pattern: /\b(?:reflect|reflectie|terugblik|hoe was mijn dag|hoe was mijn week)\b/i,
      action: 'journal.reflect',
    },
  ],
}
