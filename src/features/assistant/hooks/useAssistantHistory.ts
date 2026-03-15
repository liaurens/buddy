import { useState, useCallback, useEffect } from 'react'
import type { ChatMessage, AssistantResponse } from '../types'

const STORAGE_KEY = 'assistant_chat_history'
const MAX_MESSAGES = 50

function loadHistory(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveHistory(messages: ChatMessage[]): void {
  try {
    // Keep only the most recent messages
    const trimmed = messages.slice(-MAX_MESSAGES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage may be unavailable
  }
}

interface UseAssistantHistoryReturn {
  messages: ChatMessage[]
  addUserMessage: (content: string) => string
  addAssistantMessage: (content: string, response: AssistantResponse, userMessageId: string) => void
  clearHistory: () => void
}

export function useAssistantHistory(): UseAssistantHistoryReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory)

  useEffect(() => {
    saveHistory(messages)
  }, [messages])

  const addUserMessage = useCallback((content: string): string => {
    const id = `msg_${Date.now()}_user`
    const message: ChatMessage = {
      id,
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, message])
    return id
  }, [])

  const addAssistantMessage = useCallback(
    (content: string, response: AssistantResponse, _userMessageId: string) => {
      const message: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content,
        response,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, message])
    },
    []
  )

  const clearHistory = useCallback(() => {
    setMessages([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  return { messages, addUserMessage, addAssistantMessage, clearHistory }
}
