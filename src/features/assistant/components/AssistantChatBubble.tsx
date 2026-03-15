import React from 'react'
import { format } from 'date-fns'
import AssistantResponseCard from './AssistantResponseCard'
import type { ChatMessage } from '../types'

interface AssistantChatBubbleProps {
  message: ChatMessage
  onNavigate?: (route: string) => void
}

const AssistantChatBubble: React.FC<AssistantChatBubbleProps> = ({ message, onNavigate }) => {
  const isUser = message.role === 'user'
  const timeStr = format(new Date(message.timestamp), 'HH:mm')

  if (isUser) {
    return (
      <div className="flex justify-end gap-2 items-end">
        <div className="max-w-[80%]">
          <div className="bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm shadow-sm">
            {message.content}
          </div>
          <p className="text-right text-[10px] text-slate-400 mt-1 mr-1">{timeStr}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start gap-2 items-start">
      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-1">
        <span className="text-xs font-bold text-indigo-600">B</span>
      </div>
      <div className="max-w-[85%] space-y-1">
        {message.response ? (
          <AssistantResponseCard response={message.response} onNavigate={onNavigate} />
        ) : (
          <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-slate-700 shadow-sm">
            {message.content}
          </div>
        )}
        <p className="text-[10px] text-slate-400 ml-1">{timeStr}</p>
      </div>
    </div>
  )
}

export default AssistantChatBubble
