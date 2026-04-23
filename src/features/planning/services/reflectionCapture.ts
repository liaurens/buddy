import { supabase } from '../../../services/supabase'

export type ReflectionSubtype = 
  | 'reflection_memory' 
  | 'reflection_gratitude' 
  | 'reflection_challenge' 
  | 'reflection_priority' 
  | 'reflection_win' 
  | 'reflection_blocker'

interface ReflectionContent {
  subtype: ReflectionSubtype
  text: string
  date: string
  source: 'reflection'
}

/**
 * Store reflection items as assistant_learnings rows (type='note', subtype in content).
 * The assistant_learnings.type column has a CHECK constraint restricted to
 * 'new_rule' | 'correction' | 'behavior' | 'note', so reflection variants are
 * carried in the JSONB content.
 */
export async function saveReflectionItems(
  userId: string,
  date: string,
  items: Array<{ subtype: ReflectionSubtype; text: string }>
): Promise<void> {
  const rows = items
    .filter(i => i.text.trim().length > 0)
    .map(i => ({
      user_id: userId,
      type: 'note',
      active: true,
      content: {
        subtype: i.subtype,
        text: i.text.trim(),
        date,
        source: 'reflection',
      } satisfies ReflectionContent,
    }))

  if (rows.length === 0) return

  const { error } = await supabase.from('assistant_learnings').insert(rows)
  if (error) throw new Error(`Failed to save reflection: ${error.message}`)
}

export async function loadReflectionForDate(
  userId: string,
  date: string
): Promise<{ memory: string; gratitude: string; challenge: string; priority: string; wins: string[]; blocker: string }> {
  const { data, error } = await supabase
    .from('assistant_learnings')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('type', 'note')
    .eq('active', true)
    .contains('content', { source: 'reflection', date })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('load reflection failed', error)
    return { wins: [], blocker: '', priority: '' }
  }

  let memory = ''
  let gratitude = ''
  let challenge = ''
  const wins: string[] = []
  let blocker = ''
  let priority = ''
  for (const row of data ?? []) {
    const c = row.content as ReflectionContent | null
    if (!c) continue
    if (c.subtype === 'reflection_memory') memory = c.text
    else if (c.subtype === 'reflection_gratitude') gratitude = c.text
    else if (c.subtype === 'reflection_challenge') challenge = c.text
    else if (c.subtype === 'reflection_win') wins.push(c.text)
    else if (c.subtype === 'reflection_blocker') blocker = c.text
    else if (c.subtype === 'reflection_priority') priority = c.text
  }
  return { memory, gratitude, challenge, wins, blocker, priority }
}
