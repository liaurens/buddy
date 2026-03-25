import React, { useState, useRef, useCallback, useMemo } from 'react'
import { SendHorizontal, Loader2 } from 'lucide-react'
import { useAssistant } from '../hooks/useAssistant'
import AssistantResponseCard from './AssistantResponseCard'
import type { AppRoute } from '../../../constants/routes'

// All available slash commands with descriptions
const COMMANDS = [
  { command: '/task', description: 'Create a task', example: '/task Fix bike tire by friday' },
  { command: '/done', description: 'Complete a task', example: '/done fix bike' },
  { command: '/today', description: "Today's tasks", example: '/today' },
  { command: '/task.list', description: 'List all tasks', example: '/task.list' },
  { command: '/note', description: 'Create a note', example: '/note Meeting notes from today' },
  { command: '/shop', description: 'Shopping list', example: '/shop Milk and cheese' },
  { command: '/find', description: 'Search notes', example: '/find machine learning' },
  { command: '/checkin', description: 'Log health', example: '/checkin mood 4 energy 3' },
  { command: '/health', description: 'Health query', example: '/health how was my sleep?' },
  { command: '/agenda', description: "Today's events", example: '/agenda' },
  { command: '/habits', description: 'Habit status', example: '/habits' },
  { command: '/remind', description: 'Set reminder', example: '/remind 14:00 call dentist' },
  { command: '/help', description: 'Show all commands', example: '/help' },
]

interface AssistantPromptBarProps {
  onNavigate?: (route: AppRoute) => void
  placeholder?: string
  onMessageSent?: (input: string) => void
}

const AssistantPromptBar: React.FC<AssistantPromptBarProps> = ({
  onNavigate,
  placeholder = 'Type / for commands or ask anything…',
  onMessageSent,
}) => {
  const [input, setInput] = useState('')
  const [showHints, setShowHints] = useState(false)
  const [selectedHint, setSelectedHint] = useState(0)
  const { send, isLoading, lastResponse, reset } = useAssistant()
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter commands based on current input
  const filteredCommands = useMemo(() => {
    if (!input.startsWith('/')) return []
    const query = input.toLowerCase()
    return COMMANDS.filter(
      c => c.command.startsWith(query) || c.command.includes(query)
    )
  }, [input])

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || isLoading) return

      setShowHints(false)
      onMessageSent?.(trimmed)
      setInput('')
      reset()
      await send(trimmed)
    },
    [input, isLoading, send, reset, onMessageSent]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
    setShowHints(value.startsWith('/') && value.length < 20)
    setSelectedHint(0)
  }

  const handleSelectCommand = (command: string) => {
    setInput(command + ' ')
    setShowHints(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showHints && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedHint(prev => Math.min(prev + 1, filteredCommands.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedHint(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        handleSelectCommand(filteredCommands[selectedHint].command)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (showHints && filteredCommands.length > 0 && input === filteredCommands[selectedHint]?.command) {
        handleSelectCommand(filteredCommands[selectedHint].command)
      } else {
        handleSubmit()
      }
    }
    if (e.key === 'Escape') {
      setShowHints(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Input row */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => input.startsWith('/') && setShowHints(true)}
            onBlur={() => setTimeout(() => setShowHints(false), 150)}
            placeholder={placeholder}
            disabled={isLoading}
            aria-label="Assistant input"
            autoComplete="off"
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
        </div>

        {/* Command hints dropdown */}
        {showHints && filteredCommands.length > 0 && (
          <div className="absolute left-0 right-12 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
            {filteredCommands.slice(0, 6).map((cmd, i) => (
              <button
                key={cmd.command}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelectCommand(cmd.command)
                }}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
                  i === selectedHint ? 'bg-indigo-50' : 'hover:bg-slate-50'
                }`}
              >
                <span className="font-mono text-indigo-600 font-medium w-20 flex-shrink-0">
                  {cmd.command}
                </span>
                <span className="text-slate-500 truncate">{cmd.description}</span>
              </button>
            ))}
          </div>
        )}
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
