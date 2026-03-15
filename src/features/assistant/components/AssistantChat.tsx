import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Trash2, SendHorizontal, Loader2 } from 'lucide-react'
import { useAssistant } from '../hooks/useAssistant'
import { useAssistantHistory } from '../hooks/useAssistantHistory'
import AssistantChatBubble from './AssistantChatBubble'
import type { AppRoute } from '../../../constants/routes'

interface AssistantChatProps {
  onNavigate?: (route: AppRoute) => void
}

const AssistantChat: React.FC<AssistantChatProps> = ({ onNavigate }) => {
  const [input, setInput] = useState('')
  const { send, isLoading } = useAssistant()
  const { messages, addUserMessage, addAssistantMessage, clearHistory } = useAssistantHistory()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || isLoading) return

      setInput('')
      addUserMessage(trimmed)

      const response = await send(trimmed)
      if (response) {
        const content = response.action_taken || (response.success ? 'Done.' : 'Something went wrong.')
        addAssistantMessage(content, response, '')
      }
    },
    [input, isLoading, send, addUserMessage, addAssistantMessage]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
            <span className="text-xs font-bold text-indigo-600">B</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Buddy Assistant</p>
            <p className="text-[10px] text-slate-400">AI-powered personal assistant</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            aria-label="Clear chat history"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-12">
            <p className="font-medium text-slate-500 mb-1">Start a conversation</p>
            <p className="text-xs max-w-xs mx-auto leading-relaxed">
              Try: "Koop melk -shop", "Wat moet ik vandaag doen?",
              or "Check-in: mood 4, sleep 7"
            </p>
          </div>
        ) : (
          messages.map(message => (
            <AssistantChatBubble
              key={message.id}
              message={message}
              onNavigate={onNavigate as (route: string) => void}
            />
          ))
        )}
        {isLoading && (
          <div className="flex justify-start gap-2 items-start">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-indigo-600">B</span>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 items-center px-4 py-3 border-t border-slate-100 bg-white flex-shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything…"
          disabled={isLoading}
          aria-label="Chat input"
          className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl transition-colors"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <SendHorizontal size={16} />
          )}
        </button>
      </form>
    </div>
  )
}

export default AssistantChat
