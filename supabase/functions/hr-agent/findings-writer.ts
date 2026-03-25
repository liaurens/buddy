/**
 * Findings Writer — persists HR analysis results to the database.
 */

import type { Finding } from './analyzer.ts'

export async function writeFindings(
  userId: string,
  findings: Finding[],
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<void> {
  if (findings.length === 0) return

  const rows = findings.map(f => ({
    user_id: userId,
    type: f.type,
    severity: f.severity,
    data: f.data,
    status: 'new',
  }))

  const { error } = await supabase
    .from('assistant_findings')
    .insert(rows)

  if (error) {
    console.error('Failed to write findings:', error.message)
  }
}
