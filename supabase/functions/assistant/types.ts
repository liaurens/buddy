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
  | 'school'
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
  | 'plan.start'
  | 'plan.generate'
  | 'plan.review'
  | 'plan.close'
  // Health
  | 'tracker.checkin'
  | 'tracker.query'
  | 'experiment.ask'
  | 'experiment.list'
  // Mental
  | 'mood.log'
  | 'mood.query'
  | 'journal.write'
  | 'journal.reflect'
  // Improvement
  | 'goal.create'
  | 'goal.list'
  | 'goal.progress'
  | 'goal.complete'
  // Studying
  | 'study.log'
  | 'study.stats'
  // Projects
  | 'project.create'
  | 'project.list'
  | 'project.status'
  | 'project.add'
  // School
  | 'school.class.create'
  | 'school.class.list'
  | 'school.assignment.create'
  | 'school.assignment.list'
  | 'school.assignment.complete'
  | 'school.session.list'
  | 'school.session.create'
  // Notifications
  | 'notification.schedule.relative'
  // Extra / System
  | 'general.question'
  | 'system.help'
  | 'system.feedback'
  | 'unknown'

// ─── Tool Registration System ───────────────────────────────────────────────

// ─── JSON Schema (minimal local subset for tool input schemas) ───────────────

export interface JsonSchema {
  type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array'
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  enum?: Array<string | number>
  items?: JsonSchema
  format?: string
  default?: unknown
}

export interface ActionDefinition {
  action: Intent
  description: string
  // Optional JSON Schema for structured params (used by the agent loop's tool-use mode).
  // Handlers should still accept legacy { content } params for fast-path rule routing.
  inputSchema?: JsonSchema
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
  // Direct-invoke path: when set, routing is skipped and the handler for
  // (domain, action) is called with params. Used by dedicated UIs like the Planner page.
  action?: Intent
  params?: Record<string, unknown>
  domain?: Domain
}

export interface AssistantStep {
  id: string                            // tool_use_id from the model
  domain: Domain
  action: Intent
  params: Record<string, unknown>
  result: ToolResult
  durationMs: number
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
  steps?: AssistantStep[]
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
  aiConfig?: { key: string; provider: string; model?: string }
}
