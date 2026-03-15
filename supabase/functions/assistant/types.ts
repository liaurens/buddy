// Shared types for the assistant edge function

export interface AssistantRequest {
  input: string
  api_key?: string // For iPhone shortcut authentication
  source?: 'iphone' | 'web'
}

export interface AssistantResponse {
  success: boolean
  intent: string
  action_taken: string
  data: Record<string, unknown>
  suggestions?: string[]
  feedback_prompt?: string
  error?: string
}

export type Intent =
  | 'note.create'
  | 'note.create.shopping'
  | 'note.query'
  | 'task.create'
  | 'task.create.reminder'
  | 'task.list'
  | 'task.list.today'
  | 'task.complete'
  | 'tracker.checkin'
  | 'tracker.query'
  | 'calendar.today'
  | 'habits.status'
  | 'notification.schedule'
  | 'general.question'
  | 'unknown'

export interface DetectedIntent {
  intent: Intent
  params: Record<string, unknown>
  method: 'rule' | 'ai'
}

export interface ToolResult {
  success: boolean
  action_taken: string
  data: Record<string, unknown>
  suggestions?: string[]
}

export interface AgentContext {
  userId: string
  supabase: unknown // SupabaseClient
  source: 'iphone' | 'web'
}
