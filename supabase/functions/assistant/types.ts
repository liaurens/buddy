// Shared types for the assistant edge function

// ─── Domain Groups ──────────────────────────────────────────────────────────

export type Domain =
  | 'planning'
  | 'health'
  | 'mental'
  | 'content'
  | 'improvement'
  | 'studying'
  | 'projects'
  | 'extra'

// ─── Actions ────────────────────────────────────────────────────────────────

export type Intent =
  // Content
  | 'note.create'
  | 'note.create.shopping'
  | 'note.query'
  // Planning
  | 'task.create'
  | 'task.create.reminder'
  | 'task.list'
  | 'task.list.today'
  | 'task.complete'
  | 'calendar.today'
  | 'habits.status'
  | 'notification.schedule'
  // Health
  | 'tracker.checkin'
  | 'tracker.query'
  // Mental
  | 'mood.log'
  | 'journal.create'
  | 'reflect.prompt'
  // Improvement
  | 'goal.create'
  | 'goal.progress'
  // Studying
  | 'study.log'
  | 'flashcard.create'
  | 'flashcard.review'
  // Projects
  | 'project.create'
  | 'project.status'
  // Extra / System
  | 'general.question'
  | 'system.help'
  | 'system.feedback'
  | 'unknown'

// ─── Tool Registration System ───────────────────────────────────────────────

export interface ActionDefinition {
  action: Intent
  description: string
  handler: (params: Record<string, unknown>, context: AgentContext) => Promise<ToolResult>
}

export interface CommandDefinition {
  command: string        // e.g. '/task'
  action: Intent         // maps to which action
  description: string    // for /help display
}

export interface RuleDefinition {
  pattern: RegExp
  action: Intent
  extractParams?: (match: RegExpMatchArray, input: string) => Record<string, unknown>
}

export interface ToolDefinition {
  id: string
  domain: Domain
  description: string
  actions: ActionDefinition[]
  commands: CommandDefinition[]
  rules: RuleDefinition[]
}

// ─── Core Types ─────────────────────────────────────────────────────────────

export interface AssistantRequest {
  input: string
  api_key?: string
  source?: 'iphone' | 'web' | 'siri'
}

export interface AssistantResponse {
  success: boolean
  intent: string
  domain?: Domain
  action_taken: string
  data: Record<string, unknown>
  suggestions?: string[]
  feedback_prompt?: string
  error?: string
}

export interface RoutedCommand {
  domain: Domain
  action: Intent
  params: Record<string, unknown>
  rawInput: string
  routingMethod: 'command' | 'rule' | 'ai' | 'legacy'
}

export interface DetectedIntent {
  intent: Intent
  params: Record<string, unknown>
  method: 'command' | 'rule' | 'ai' | 'legacy'
  domain?: Domain
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
  source: 'iphone' | 'web' | 'siri'
}
