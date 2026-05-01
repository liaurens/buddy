import { supabase } from '../../../services/supabase'

export type ReflectionSubtype =
  | 'reflection_memory'
  | 'reflection_gratitude'
  | 'reflection_challenge'
  | 'reflection_priority'
  | 'reflection_win'
  | 'reflection_blocker'
  | 'reflection_focus'

interface ReflectionContent {
  subtype: ReflectionSubtype
  text: string
  date: string
  source: 'reflection'
}

export interface ReflectionFocusPick {
  kind: 'goal' | 'project' | 'skill'
  refId: string
  refTitle: string
  plan: string
}

interface ReflectionFocusContent {
  subtype: 'reflection_focus'
  date: string
  source: 'reflection'
  kind: 'goal' | 'project' | 'skill'
  refId: string
  refTitle: string
  plan: string
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
    return { memory: '', gratitude: '', challenge: '', priority: '', wins: [], blocker: '' }
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

export async function saveReflectionFocus(
  userId: string,
  date: string,
  picks: ReflectionFocusPick[]
): Promise<void> {
  // Replace existing focus picks for this date by deactivating old rows, then inserting new.
  const { data: existing, error: fetchErr } = await supabase
    .from('assistant_learnings')
    .select('id, content')
    .eq('user_id', userId)
    .eq('type', 'note')
    .eq('active', true)
    .contains('content', { source: 'reflection', date, subtype: 'reflection_focus' })

  if (fetchErr) throw new Error(`Failed to load existing focus picks: ${fetchErr.message}`)

  const idsToDeactivate = (existing ?? []).map(r => r.id)
  if (idsToDeactivate.length > 0) {
    const { error: deactivateErr } = await supabase
      .from('assistant_learnings')
      .update({ active: false })
      .in('id', idsToDeactivate)
    if (deactivateErr) throw new Error(`Failed to clear old focus picks: ${deactivateErr.message}`)
  }

  const rows = picks
    .filter(p => p.refId && p.plan.trim().length > 0)
    .map(p => ({
      user_id: userId,
      type: 'note',
      active: true,
      content: {
        subtype: 'reflection_focus',
        date,
        source: 'reflection',
        kind: p.kind,
        refId: p.refId,
        refTitle: p.refTitle,
        plan: p.plan.trim(),
      } satisfies ReflectionFocusContent,
    }))

  if (rows.length === 0) return
  const { error } = await supabase.from('assistant_learnings').insert(rows)
  if (error) throw new Error(`Failed to save focus picks: ${error.message}`)
}

export async function loadReflectionFocus(
  userId: string,
  date: string
): Promise<ReflectionFocusPick[]> {
  const { data, error } = await supabase
    .from('assistant_learnings')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('type', 'note')
    .eq('active', true)
    .contains('content', { source: 'reflection', date, subtype: 'reflection_focus' })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('load reflection focus failed', error)
    return []
  }

  const picks: ReflectionFocusPick[] = []
  for (const row of data ?? []) {
    const c = row.content as ReflectionFocusContent | null
    if (!c || c.subtype !== 'reflection_focus') continue
    picks.push({ kind: c.kind, refId: c.refId, refTitle: c.refTitle, plan: c.plan })
  }
  return picks
}
