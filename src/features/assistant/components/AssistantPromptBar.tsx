import React, { useState, useRef, useCallback } from 'react'
import { SendHorizontal, Loader2 } from 'lucide-react'
import { useAssistant } from '../hooks/useAssistant'
import AssistantResponseCard from './AssistantResponseCard'
import type { AppRoute } from '../../../constants/routes'

interface AssistantPromptBarProps {
  onNavigate?: (route: AppRoute) => void
  placeholder?: string
  onMessageSent?: (input: string) => void
}

const AssistantPromptBar: React.FC<AssistantPromptBarProps> = ({
  onNavigate,
  placeholder = 'Ask me anything… (task, note, check-in)',
  onMessageSent,
}) => {
  const [input, setInput] = useState('')
  const { send, isLoading, lastResponse, reset } = useAssistant()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || isLoading) return

      onMessageSent?.(trimmed)
      setInput('')
      reset()
      await send(trimmed)
    },
    [input, isLoading, send, reset, onMessageSent]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-3">
      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          aria-label="Assistant input"
          className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent disabled:opacity-50 shadow-sm"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Send"
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl transition-colors shadow-sm"
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <SendHorizontal size={18} />
          )}
        </button>
      </form>

      {/* Response card */}
      {lastResponse && (
        <AssistantResponseCard
          response={lastResponse}
          onNavigate={onNavigate as (route: string) => void}
        />
      )}
    </div>
  )
}

export default AssistantPromptBar
