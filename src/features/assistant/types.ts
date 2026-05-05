// Frontend types for the assistant feature

export interface AssistantRequest {
  input: string
  source?: 'web' | 'iphone'
  action?: string
  params?: Record<string, unknown>
  domain?: string
}

export interface AssistantStepResult {
  success: boolean
  action_taken: string
  data: Record<string, unknown>
  suggestions?: string[]
}

export interface AssistantStep {
  id: string
  domain: string
  action: string
  params: Record<string, unknown>
  result: AssistantStepResult
  durationMs: number
}

export interface AssistantResponse {
  success: boolean
  intent: string
  domain?: string
  action_taken: string
  data: Record<string, unknown>
  suggestions?: string[]
  feedback_prompt?: string
  error?: string
  steps?: AssistantStep[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  response?: AssistantResponse
  timestamp: number
}

export type AssistantIntent = AssistantResponse['intent']

export interface AssistantConversation {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
  createdAt: number
}
