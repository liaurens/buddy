import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Trash2, SendHorizontal, Loader2, BookOpen, Menu, Plus, MessageSquare, X, Edit2, Check } from 'lucide-react'
import { useAssistant } from '../hooks/useAssistant'
import { useAssistantHistory } from '../hooks/useAssistantHistory'
import AssistantChatBubble from './AssistantChatBubble'
import AssistantGuide from './AssistantGuide'
import type { AppRoute } from '../../../constants/routes'

const COMMANDS = [
  { command: '/task', description: 'Create a task' },
  { command: '/done', description: 'Complete a task' },
  { command: '/today', description: "Today's tasks" },
  { command: '/task.list', description: 'List all tasks' },
  { command: '/note', description: 'Create a note' },
  { command: '/shop', description: 'Shopping list' },
  { command: '/find', description: 'Search notes' },
  { command: '/checkin', description: 'Log health' },
  { command: '/health', description: 'Health query' },
  { command: '/agenda', description: "Today's events" },
  { command: '/habits', description: 'Habit status' },
  { command: '/remind', description: 'Set reminder' },
  { command: '/help', description: 'Show all commands' },
]

interface AssistantChatProps {
  onNavigate?: (route: AppRoute) => void
}

const AssistantChat: React.FC<AssistantChatProps> = ({ onNavigate }) => {
  const [input, setInput] = useState('')
  const [showHints, setShowHints] = useState(false)
  const [selectedHint, setSelectedHint] = useState(0)
  const [showGuide, setShowGuide] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [editingConvoId, setEditingConvoId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const { send, isLoading } = useAssistant()
  const { 
    conversations,
    activeConversationId,
    messages, 
    addUserMessage, 
    addAssistantMessage, 
    createConversation,
    switchConversation,
    renameConversation,
    deleteConversation 
  } = useAssistantHistory()
  
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (editingConvoId && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingConvoId])

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
      setInput('')
      
      const userMsgId = addUserMessage(trimmed)

      const response = await send(trimmed)
      if (response) {
        const content = response.action_taken || (response.success ? 'Done.' : 'Something went wrong.')
        addAssistantMessage(content, response, userMsgId)
      }
    },
    [input, isLoading, send, addUserMessage, addAssistantMessage]
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

  const handleCreateNew = () => {
    createConversation()
    setShowSidebar(false)
    setShowGuide(false)
  }

  const handleSwitch = (id: string) => {
    switchConversation(id)
    setShowSidebar(false)
    setShowGuide(false)
  }

  const handleStartEdit = (id: string, currentTitle: string) => {
    setEditingConvoId(id)
    setEditTitle(currentTitle)
  }

  const handleSaveEdit = (id: string) => {
    const trimmed = editTitle.trim()
    if (trimmed) {
      renameConversation(id, trimmed)
    }
    setEditingConvoId(null)
  }

  const handleDeleteConvo = (id: string) => {
    if (window.confirm('Are you sure you want to delete this chat session?')) {
      deleteConversation(id)
    }
  }

  return (
    <div className="flex bg-white rounded-2xl shadow-xl overflow-hidden h-full border border-slate-200 relative">
      
      {/* Sidebar Overlay (Mobile/Narrow views) */}
      {showSidebar && (
        <div 
          className="absolute inset-0 bg-slate-900/20 z-40" 
          onClick={() => setShowSidebar(false)} 
        />
      )}

      {/* Conversations Sidebar */}
      <div className={`absolute lg:relative z-50 h-full w-64 bg-slate-50 border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 hidden lg:flex'}`}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Chats</h2>
          <button 
            onClick={handleCreateNew}
            className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
            title="New Chat"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 && (
            <p className="text-xs text-center text-slate-400 mt-4">No conversations yet.</p>
          )}
          {conversations.map(c => (
            <div 
              key={c.id} 
              className={`group flex items-center w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${activeConversationId === c.id ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'hover:bg-slate-100 transparent border border-transparent'}`}
            >
              <div 
                className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                onClick={() => handleSwitch(c.id)}
              >
                <MessageSquare size={14} className={activeConversationId === c.id ? 'text-indigo-500' : 'text-slate-400'} />
                {editingConvoId === c.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveEdit(c.id)}
                    onBlur={() => handleSaveEdit(c.id)}
                    className="flex-1 min-w-0 bg-white border-indigo-300 rounded px-1.5 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className={`truncate font-medium ${activeConversationId === c.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                    {c.title}
                  </span>
                )}
              </div>
              
              {/* Actions */}
              {!editingConvoId && (
                <div className="hidden group-hover:flex items-center ml-2">
                   <button 
                     onClick={(e) => { e.stopPropagation(); handleStartEdit(c.id, c.title); }}
                     className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                   >
                     <Edit2 size={12} />
                   </button>
                   <button 
                     onClick={(e) => { e.stopPropagation(); handleDeleteConvo(c.id); }}
                     className="p-1 text-slate-400 hover:text-red-500 rounded"
                   >
                     <Trash2 size={12} />
                   </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Chat header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className="lg:hidden p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={18} />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-inner">
              <span className="text-xs font-bold text-white">B</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Buddy Assistant</p>
              <p className="text-[10px] text-slate-500 font-medium tracking-wide w-full truncate">
                {conversations.find(c => c.id === activeConversationId)?.title || 'AI-powered personal assistant'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowGuide(!showGuide)}
              aria-label="Toggle guide"
              className={`p-1.5 rounded-lg transition-colors border ${
                showGuide ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'text-slate-400 border-transparent hover:text-indigo-500 hover:bg-slate-50'
              }`}
            >
              <BookOpen size={16} />
            </button>
          </div>
        </div>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0 bg-slate-50/50">
          {showGuide && (
            <AssistantGuide />
          )}
          {!showGuide && messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-sm px-6">
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 inner-shadow">
                 <MessageSquare size={24} className="text-indigo-400" />
              </div>
              <p className="font-bold text-slate-700 mb-2 text-lg">Start a conversation</p>
              <p className="text-xs max-w-sm mx-auto leading-relaxed text-slate-500">
                Type <span className="font-mono text-indigo-500 bg-indigo-50 px-1 py-0.5 rounded">/</span> for commands, or just ask whatever comes to mind naturally. Buddy can track your health, manage tasks, and organize your day.
              </p>
              <button
                onClick={() => setShowGuide(true)}
                className="mt-6 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
              >
                View full setup guide
              </button>
            </div>
          ) : !showGuide ? (
            messages.map(message => (
              <AssistantChatBubble
                key={message.id}
                message={message}
                onNavigate={onNavigate as (route: string) => void}
              />
            ))
          ) : null}
          {isLoading && (
            <div className="flex justify-start gap-2 items-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-inner flex-shrink-0">
                <span className="text-xs font-bold text-white">B</span>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1.5 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <form
          onSubmit={handleSubmit}
          className="relative flex gap-2 items-center px-4 py-3 border-t border-slate-100 bg-white flex-shrink-0"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => input.startsWith('/') && setShowHints(true)}
            onBlur={() => setTimeout(() => setShowHints(false), 150)}
            placeholder="Ask something or type / for commands..."
            disabled={isLoading}
            aria-label="Chat input"
            autoComplete="off"
            className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent disabled:opacity-50 transition-shadow"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl transition-all shadow-sm active:scale-95"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <SendHorizontal size={18} />
            )}
          </button>

          {/* Command hints dropdown */}
          {showHints && filteredCommands.length > 0 && (
            <div className="absolute left-4 right-16 bottom-full mb-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 transform origin-bottom-left animate-in slide-in-from-bottom-2">
              {filteredCommands.slice(0, 6).map((cmd, i) => (
                <button
                  key={cmd.command}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelectCommand(cmd.command)
                  }}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors border-l-2 ${
                    i === selectedHint ? 'bg-indigo-50 border-indigo-500' : 'hover:bg-slate-50 border-transparent'
                  }`}
                >
                  <span className="font-mono text-indigo-600 font-bold w-24 flex-shrink-0">
                    {cmd.command}
                  </span>
                  <span className="text-slate-600 truncate font-medium">{cmd.description}</span>
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default AssistantChat
