import { useState, useCallback, useEffect, useMemo } from 'react'
import type { ChatMessage, AssistantResponse, AssistantConversation } from '../types'

const STORAGE_KEY = 'assistant_conversations'
const OLD_STORAGE_KEY = 'assistant_chat_history' // For auto-migration
const MAX_MESSAGES_PER_CONVO = 100
const MAX_STORED_CONVOS = 25

function loadConversations(): AssistantConversation[] {
  try {
    let convos: AssistantConversation[] = []
    
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      convos = JSON.parse(stored)
    }

    // Auto-migrate old chat history if it exists and we haven't migrated yet
    const oldStored = localStorage.getItem(OLD_STORAGE_KEY)
    if (oldStored) {
      const oldMessages: ChatMessage[] = JSON.parse(oldStored)
      if (oldMessages.length > 0) {
        const migratedConvo: AssistantConversation = {
          id: `conv_migrated_${Date.now()}`,
          title: 'Imported Conversation',
          messages: oldMessages.slice(-MAX_MESSAGES_PER_CONVO),
          createdAt: oldMessages[0]?.timestamp || Date.now(),
          updatedAt: oldMessages[oldMessages.length - 1]?.timestamp || Date.now(),
        }
        convos.push(migratedConvo)
      }
      // Remove the old key so we don't migrate again
      localStorage.removeItem(OLD_STORAGE_KEY)
    }
    
    return convos.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

function saveConversations(convos: AssistantConversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_STORED_CONVOS)))
  } catch {
    // ignore
  }
}

export function useAssistantHistory() {
  const [conversations, setConversations] = useState<AssistantConversation[]>(loadConversations)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversations.length > 0 ? conversations[0].id : null
  )

  useEffect(() => {
    saveConversations(conversations)
  }, [conversations])

  // Get current active conversation, or create a temporary one if none exists
  const activeConversation = useMemo(() => {
    return conversations.find(c => c.id === activeConversationId) || null
  }, [conversations, activeConversationId])

  const createConversation = useCallback(() => {
    const newId = `conv_${Date.now()}`
    const newConvo: AssistantConversation = {
      id: newId,
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setConversations(prev => [newConvo, ...prev])
    setActiveConversationId(newId)
    return newId
  }, [])

  const switchConversation = useCallback((id: string) => {
    setActiveConversationId(id)
  }, [])

  const renameConversation = useCallback((id: string, newTitle: string) => {
    setConversations(prev => prev.map(c => 
      c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c
    ))
  }, [])

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id)
      if (activeConversationId === id) {
        setActiveConversationId(filtered.length > 0 ? filtered[0].id : null)
      }
      return filtered
    })
  }, [activeConversationId])

  const ensureActiveConversation = useCallback(() => {
    // if we already have an active that exists in the array, return it
    if (activeConversationId && conversations.some(c => c.id === activeConversationId)) {
      return activeConversationId
    }
    // otherwise create one
    return createConversation()
  }, [activeConversationId, conversations, createConversation])

  const addUserMessage = useCallback((content: string): string => {
    const convoId = ensureActiveConversation()
    const id = `msg_${Date.now()}_user`
    const message: ChatMessage = {
      id,
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    
    setConversations(prev => prev.map(c => {
      if (c.id === convoId) {
        // Auto-generate title if this is the first message and it's named "New Conversation" or "Imported Conversation"
        const isUntitled = c.title === 'New Conversation' || c.messages.length === 0
        const title = isUntitled ? (content.substring(0, 30) + (content.length > 30 ? '...' : '')) : c.title
        
        return {
          ...c,
          title,
          messages: [...c.messages, message].slice(-MAX_MESSAGES_PER_CONVO),
          updatedAt: Date.now()
        }
      }
      return c
    }))
    
    return id
  }, [ensureActiveConversation])

  const addAssistantMessage = useCallback(
    (content: string, response: AssistantResponse, _userMessageId: string) => {
      const convoId = ensureActiveConversation()
      const message: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content,
        response,
        timestamp: Date.now(),
      }
      
      setConversations(prev => prev.map(c => {
        if (c.id === convoId) {
          return {
            ...c,
            messages: [...c.messages, message].slice(-MAX_MESSAGES_PER_CONVO),
            updatedAt: Date.now()
          }
        }
        return c
      }))
    },
    [ensureActiveConversation]
  )

  const clearHistory = useCallback(() => {
    if (window.confirm('Are you sure you want to delete ALL conversations? This cannot be undone.')) {
      setConversations([])
      setActiveConversationId(null)
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
    }
  }, [])

  return { 
    conversations,
    activeConversation,
    activeConversationId,
    messages: activeConversation?.messages || [], 
    addUserMessage, 
    addAssistantMessage, 
    clearHistory,
    createConversation,
    switchConversation,
    renameConversation,
    deleteConversation
  }
}
