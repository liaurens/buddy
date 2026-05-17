import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { SendHorizontal, Loader2, ArrowRight } from 'lucide-react'
import { useAssistantCommands } from '../hooks/useAssistantCommands'
import { useRoutePreview } from '../hooks/useRoutePreview'

const VOICE_DRAFT_KEY = 'captureFAB.voiceDraft'

interface CaptureInputProps {
  onSubmit: (text: string) => Promise<void> | void
  isLoading?: boolean
  placeholder?: string
  ariaLabel?: string
  consumeVoiceDraft?: boolean
  enableBrainDump?: boolean
  hintsPosition?: 'above' | 'below'
  richHints?: boolean
  variant?: 'compact' | 'comfortable' | 'bare'
  onBeforeSubmit?: (text: string) => void
}

const CaptureInput: React.FC<CaptureInputProps> = ({
  onSubmit,
  isLoading = false,
  placeholder = 'Capture anything — type / for commands…',
  ariaLabel = 'Assistant input',
  consumeVoiceDraft = false,
  enableBrainDump = false,
  hintsPosition = 'below',
  richHints = false,
  variant = 'compact',
  onBeforeSubmit,
}) => {
  // Seed from CaptureFAB voice draft on first render. Lazy initializer avoids
  // setState-in-effect. We don't auto-submit — speech recognition errors are
  // common and the user should confirm the transcript first.
  const [input, setInput] = useState<string>(() => {
    if (!consumeVoiceDraft) return ''
    try {
      const draft = sessionStorage.getItem(VOICE_DRAFT_KEY)
      if (draft) {
        sessionStorage.removeItem(VOICE_DRAFT_KEY)
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { commands, primaryCommands } = useAssistantCommands()
  const routePreview = useRoutePreview(input)

  const filteredCommands = useMemo(() => {
    if (!input.startsWith('/')) return []
    const query = input.toLowerCase()
    return commands.filter(
      c => c.command.startsWith(query) || c.command.includes(query)
    )
  }, [input, commands])

  const visibleHints = useMemo(() => {
    if (!richHints) return filteredCommands.slice(0, 6)
    if (input.length > 1) return filteredCommands
    return showAllHints ? commands : primaryCommands
  }, [filteredCommands, input, showAllHints, richHints, commands, primaryCommands])

  // Auto-grow textarea up to 200px.
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
    // Only run on mount; later changes shouldn't steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || isLoading) return

      setShowHints(false)
      onBeforeSubmit?.(trimmed)
      setInput('')

      const chunks = enableBrainDump
        ? trimmed.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
        : [trimmed]
      const captures = chunks.length > 1 ? chunks : [trimmed]

      for (const chunk of captures) {
        await onSubmit(chunk)
      }
    },
    [input, isLoading, onSubmit, onBeforeSubmit, enableBrainDump]
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

  const isCompact = variant === 'compact'
  const isBare = variant === 'bare'
  const textareaClasses = isBare
    ? 'flex-1 min-w-0 bg-transparent px-1 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 resize-none leading-snug'
    : isCompact
    ? 'flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 disabled:opacity-50 shadow-[0_8px_24px_rgba(15,23,42,0.05)] resize-none leading-snug'
    : 'flex-1 min-w-0 bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 disabled:opacity-50 transition-shadow resize-none leading-snug'
  const buttonClasses = isBare
    ? 'flex-shrink-0 w-11 h-11 flex items-center justify-center bg-indigo-950 hover:bg-indigo-900 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-colors shadow-[0_10px_24px_rgba(30,41,99,0.2)] active:scale-95'
    : isCompact
    ? 'flex-shrink-0 w-10 h-10 flex items-center justify-center bg-indigo-700 hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl transition-colors shadow-sm'
    : 'flex-shrink-0 w-11 h-11 flex items-center justify-center bg-indigo-700 hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl transition-all shadow-sm active:scale-95'

  const showPreviewChip = !!routePreview && !showHints && !isLoading

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      {showPreviewChip && routePreview && (
        <div className="absolute -top-7 right-0 flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5 shadow-sm">
          <ArrowRight size={10} className="text-indigo-500" />
          <span className="text-slate-700">{routePreview.label}</span>
        </div>
      )}
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
          aria-label={ariaLabel}
          autoComplete="off"
          rows={1}
          className={textareaClasses}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Send"
          className={buttonClasses}
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
        </button>
      </div>

      {showHints && visibleHints.length > 0 && (
        <div
          className={`absolute left-0 right-12 ${
            hintsPosition === 'above' ? 'bottom-full mb-2' : 'top-full mt-1'
          } bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50`}
        >
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
          {richHints && !showAllHints && input.length <= 1 && visibleHints.length < commands.length && (
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
  )
}

export default CaptureInput
