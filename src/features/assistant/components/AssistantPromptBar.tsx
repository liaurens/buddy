import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { SendHorizontal, Loader2 } from 'lucide-react'
import { useAssistant } from '../hooks/useAssistant'
import { useAssistantHistory } from '../hooks/useAssistantHistory'
import AssistantResponseCard from './AssistantResponseCard'
import { COMMANDS, PRIMARY_COMMANDS } from '../constants/commands'
import type { AppRoute } from '../../../constants/routes'

interface AssistantPromptBarProps {
  onNavigate?: (route: AppRoute) => void
  placeholder?: string
  onMessageSent?: (input: string) => void
}

const AssistantPromptBar: React.FC<AssistantPromptBarProps> = ({
  onNavigate,
  placeholder = 'Capture anything — type / for commands…',
  onMessageSent,
}) => {
  // Seed from CaptureFAB voice draft on first render. Lazy initializer avoids
  // the setState-in-effect pattern. We don't auto-submit — speech recognition
  // errors are common and the user should confirm the transcript first.
  const [input, setInput] = useState<string>(() => {
    try {
      const draft = sessionStorage.getItem('captureFAB.voiceDraft')
      if (draft) {
        sessionStorage.removeItem('captureFAB.voiceDraft')
        return draft
      }
    } catch {
      // sessionStorage may be unavailable (private mode, etc.)
    }
    return ''
  })
  const [showHints, setShowHints] = useState(false)
  const [showAllHints, setShowAllHints] = useState(false)
  const [selectedHint, setSelectedHint] = useState(0)
  const { send, isLoading, lastResponse, error, reset } = useAssistant()
  const { addUserMessage, addAssistantMessage } = useAssistantHistory()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const filteredCommands = useMemo(() => {
    if (!input.startsWith('/')) return []
    const query = input.toLowerCase()
    const matches = COMMANDS.filter(
      c => c.command.startsWith(query) || c.command.includes(query)
    )
    return matches
  }, [input])

  // Top-4 by default to avoid overwhelming the picker.
  const visibleHints = useMemo(() => {
    if (input.length > 1) return filteredCommands
    return showAllHints ? COMMANDS : PRIMARY_COMMANDS
  }, [filteredCommands, input, showAllHints])

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [input])

  // If seeded from voice draft, focus the textarea with caret at end.
  useEffect(() => {
    if (!input) return
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(input.length, input.length)
    // Only run on mount; subsequent input changes shouldn't steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || isLoading) return

      setShowHints(false)
      onMessageSent?.(trimmed)
      setInput('')
      reset()

      // Brain dump support: split on blank lines, send each non-empty chunk.
      const chunks = trimmed.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
      const captures = chunks.length > 1 ? chunks : [trimmed]

      for (const chunk of captures) {
        const userMsgId = addUserMessage(chunk)
        const response = await send(chunk)
        if (response) {
          const content = response.action_taken || (response.success ? 'Done.' : 'Something went wrong.')
          addAssistantMessage(content, response, userMsgId)
        }
      }
    },
    [input, isLoading, send, reset, onMessageSent, addUserMessage, addAssistantMessage]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInput(value)
    setShowHints(value.startsWith('/') && value.length < 20)
    setSelectedHint(0)
  }

  const handleSelectCommand = (command: string) => {
    setInput(command + ' ')
    setShowHints(false)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showHints && visibleHints.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedHint(prev => Math.min(prev + 1, visibleHints.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedHint(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        handleSelectCommand(visibleHints[selectedHint].command)
        return
      }
    }
    // Enter submits, Shift+Enter inserts newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (showHints && visibleHints.length > 0 && input === visibleHints[selectedHint]?.command) {
        handleSelectCommand(visibleHints[selectedHint].command)
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
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => input.startsWith('/') && setShowHints(true)}
            onBlur={() => setTimeout(() => setShowHints(false), 150)}
            placeholder={placeholder}
            disabled={isLoading}
            aria-label="Assistant input"
            autoComplete="off"
            rows={1}
            className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent disabled:opacity-50 shadow-sm resize-none leading-snug"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Send"
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl transition-colors shadow-sm"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
          </button>
        </div>

        {showHints && visibleHints.length > 0 && (
          <div className="absolute left-0 right-12 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
            {visibleHints.map((cmd, i) => (
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
            {!showAllHints && input.length <= 1 && visibleHints.length < COMMANDS.length && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setShowAllHints(true) }}
                className="w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-slate-50 border-t border-slate-100"
              >
                Show all commands…
              </button>
            )}
          </div>
        )}
      </form>

      {lastResponse && (
        <AssistantResponseCard
          response={lastResponse}
          onNavigate={onNavigate as (route: string) => void}
        />
      )}
      {error && !lastResponse && (
        <p className="text-xs text-red-500 px-1">{error}</p>
      )}
    </div>
  )
}

export default AssistantPromptBar
