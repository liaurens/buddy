// Frontend types for the assistant feature

export interface AssistantRequest {
  input: string
  source?: 'web' | 'iphone'
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
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  response?: AssistantResponse
  timestamp: number
}

export type AssistantIntent = AssistantResponse['intent']
