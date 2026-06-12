import React, { useCallback, useRef } from 'react'
import { useAssistant } from '../hooks/useAssistant'
import { useAssistantHistory } from '../hooks/useAssistantHistory'
import AssistantResponseCard from './AssistantResponseCard'
import CaptureInput, { type CaptureInputHandle } from './CaptureInput'
import PendingSyncBadge from './PendingSyncBadge'
import type { AppRoute } from '../../../constants/routes'
import { PencilLine } from 'lucide-react'

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
  const { send, isLoading, lastResponse, error, reset } = useAssistant()
  const { addUserMessage, addAssistantMessage } = useAssistantHistory()
  const captureInputRef = useRef<CaptureInputHandle>(null)

  const handleChunk = useCallback(
    async (chunk: string) => {
      const userMsgId = addUserMessage(chunk)
      const response = await send(chunk)
      if (response) {
        const content = response.action_taken || (response.success ? 'Done.' : 'Something went wrong.')
        addAssistantMessage(content, response, userMsgId)
      }
    },
    [send, addUserMessage, addAssistantMessage]
  )

  const handleBeforeSubmit = useCallback(
    (text: string) => {
      onMessageSent?.(text)
      reset()
    },
    [onMessageSent, reset]
  )

  return (
    <div className="space-y-3">
      <section className="app-surface p-3 sm:p-4">
        <div className="flex items-end gap-3">
          <div className="mb-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-slate-600">
            <PencilLine size={21} />
          </div>
          <div className="min-w-0 flex-1">
            <CaptureInput
              ref={captureInputRef}
              onSubmit={handleChunk}
              onBeforeSubmit={handleBeforeSubmit}
              isLoading={isLoading}
              placeholder={placeholder}
              consumeVoiceDraft
              enableBrainDump
              richHints
              hintsPosition="below"
              variant="bare"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-1 text-[11px] text-slate-500">
          <PendingSyncBadge />
          <span>Examples:</span>
          {['Call mom tomorrow', 'Read ch. 4', 'Grocery list'].map(example => (
            <button
              key={example}
              type="button"
              onClick={() => captureInputRef.current?.fill(example)}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-500 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-700"
            >
              {example}
            </button>
          ))}
        </div>
      </section>

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
