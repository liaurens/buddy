import React from 'react'
import { CheckCircle, XCircle, ListTodo, StickyNote, Calendar, Activity, Bell } from 'lucide-react'
import type { AssistantResponse } from '../types'

interface AssistantResponseCardProps {
  response: AssistantResponse
  onNavigate?: (route: string) => void
}

function intentIcon(intent: string) {
  if (intent.startsWith('note')) return <StickyNote size={16} className="text-cyan-600" />
  if (intent.startsWith('task')) return <ListTodo size={16} className="text-indigo-600" />
  if (intent.startsWith('tracker')) return <Activity size={16} className="text-blue-600" />
  if (intent.startsWith('calendar')) return <Calendar size={16} className="text-pink-600" />
  if (intent.startsWith('habits')) return <ListTodo size={16} className="text-violet-600" />
  if (intent.startsWith('notification')) return <Bell size={16} className="text-amber-600" />
  return null
}

function intentRoute(intent: string): string | null {
  if (intent.startsWith('note')) return 'notes'
  if (intent.startsWith('task')) return 'tasks'
  if (intent.startsWith('tracker')) return 'health'
  if (intent.startsWith('calendar')) return 'calendar'
  if (intent.startsWith('habits')) return 'tasks'
  return null
}

function TaskList({ tasks }: { tasks: Array<{ id: string; title: string; due_date?: string }> }) {
  if (!tasks.length) return <p className="text-xs text-slate-400">No tasks found.</p>
  return (
    <ul className="mt-2 space-y-1">
      {tasks.slice(0, 6).map(task => (
        <li key={task.id} className="flex items-start gap-2 text-sm text-slate-700">
          <span className="mt-0.5 w-4 h-4 rounded border border-slate-300 flex-shrink-0" />
          <span className="flex-1">{task.title}</span>
          {task.due_date && (
            <span className="text-[11px] text-slate-400 flex-shrink-0">{task.due_date}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function EventList({ events }: { events: Array<{ title: string; start: string; end?: string }> }) {
  if (!events.length) return <p className="text-xs text-slate-400">No events today.</p>
  return (
    <ul className="mt-2 space-y-1">
      {events.map((event, i) => (
        <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
          <span className="text-xs font-mono text-slate-400 w-10 flex-shrink-0">{event.start}</span>
          <span>{event.title}</span>
        </li>
      ))}
    </ul>
  )
}

const AssistantResponseCard: React.FC<AssistantResponseCardProps> = ({ response, onNavigate }) => {
  const route = intentRoute(response.intent)

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border p-4 shadow-sm text-sm transition-all ${
        response.success
          ? 'bg-white border-slate-100'
          : 'bg-red-50 border-red-100'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex-shrink-0">
          {response.success ? (
            <CheckCircle size={16} className="text-emerald-500" />
          ) : (
            <XCircle size={16} className="text-red-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 leading-snug">{response.action_taken}</p>
          {response.error && (
            <p className="text-xs text-red-500 mt-0.5">{response.error}</p>
          )}
        </div>
        <div className="flex-shrink-0">{intentIcon(response.intent)}</div>
      </div>

      {/* Inline data display */}
      {response.success && response.data && (
        <>
          {/* Task list */}
          {Array.isArray(response.data.tasks) && (
            <TaskList tasks={response.data.tasks as Array<{ id: string; title: string; due_date?: string }>} />
          )}

          {/* Calendar events */}
          {Array.isArray(response.data.events) && (
            <EventList events={response.data.events as Array<{ title: string; start: string }>} />
          )}

          {/* Tracker summary */}
          {response.data.summary && typeof response.data.summary === 'object' && (
            <div className="mt-2 grid grid-cols-2 gap-1">
              {Object.entries(response.data.summary as Record<string, { avg: number; count: number }>).map(
                ([metric, stats]) => (
                  <div key={metric} className="bg-blue-50 rounded-lg px-2 py-1">
                    <p className="text-[10px] font-medium text-blue-500 uppercase tracking-wide">{metric}</p>
                    <p className="text-sm font-bold text-blue-900">{stats.avg}</p>
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}

      {/* Navigation button */}
      {response.success && route && onNavigate && (
        <button
          onClick={() => onNavigate(route)}
          className="mt-3 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          aria-label={`Navigate to ${route}`}
        >
          View in {route.charAt(0).toUpperCase() + route.slice(1)} →
        </button>
      )}
    </div>
  )
}

export default AssistantResponseCard
