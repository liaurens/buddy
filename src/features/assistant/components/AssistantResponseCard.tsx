import React, { useState } from 'react'
import { CheckCircle, XCircle, ListTodo, StickyNote, Calendar, Activity, Bell, TrendingUp, HelpCircle, HelpingHand, GraduationCap } from 'lucide-react'
import type { AssistantResponse } from '../types'
import { invokeAssistantAction } from '../services/assistant.service'

interface AssistantResponseCardProps {
  response: AssistantResponse
  onNavigate?: (route: string) => void
}

interface ClarifyCandidate {
  intent: string
  domain: string
  label: string
}

function ClarifyCandidates({ response }: { response: AssistantResponse }) {
  const candidates = (response.data?.candidates as ClarifyCandidate[] | undefined) ?? []
  const original = typeof response.data?.original === 'string' ? response.data.original : ''
  const [resolved, setResolved] = useState<{ label: string; ok: boolean; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (resolved) {
    return (
      <p className="mt-2 text-xs text-slate-600">
        Routed as <span className="font-medium text-slate-800">{resolved.label}</span>
        {resolved.message ? ` — ${resolved.message}` : ''}.
      </p>
    )
  }

  const pick = async (c: ClarifyCandidate) => {
    if (busy) return
    setBusy(true)
    const result = await invokeAssistantAction(c.domain, c.intent, { content: original })
    setResolved({
      label: c.label,
      ok: result.success,
      message: result.action_taken || (result.success ? 'Done' : 'Something went wrong'),
    })
    setBusy(false)
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {candidates.map(c => (
        <button
          key={`${c.domain}:${c.intent}`}
          onClick={() => pick(c)}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-medium rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

function intentIcon(intent: string, domain?: string) {
  // Domain-based icons (preferred when available)
  if (domain === 'school') return <GraduationCap size={16} className="text-rose-600" />
  if (domain === 'improvement') return <TrendingUp size={16} className="text-green-600" />
  if (domain === 'extra') return <HelpCircle size={16} className="text-slate-500" />

  // Intent-based icons (fallback)
  if (intent.startsWith('school')) return <GraduationCap size={16} className="text-rose-600" />
  if (intent.startsWith('note')) return <StickyNote size={16} className="text-cyan-600" />
  if (intent.startsWith('task')) return <ListTodo size={16} className="text-indigo-600" />
  if (intent.startsWith('tracker')) return <Activity size={16} className="text-blue-600" />
  if (intent.startsWith('calendar')) return <Calendar size={16} className="text-pink-600" />
  if (intent.startsWith('notification')) return <Bell size={16} className="text-amber-600" />
  return null
}

function intentRoute(intent: string, domain?: string): string | null {
  // Domain-based routing
  if (domain === 'health') return 'health'
  if (domain === 'planning') {
    if (intent.startsWith('calendar')) return 'calendar'
    return 'tasks'
  }
  if (domain === 'content') return 'notes'

  // Intent-based fallback
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

function StepsList({ steps }: { steps: NonNullable<AssistantResponse['steps']> }) {
  if (!steps.length) return null
  return (
    <ul className="mt-3 space-y-1.5">
      {steps.map(step => {
        const ok = step.result.success
        const errorDetail = !ok && typeof step.result.data?.error === 'string'
          ? (step.result.data.error as string)
          : null
        return (
          <li key={step.id} className="flex items-start gap-2 text-xs">
            {ok ? (
              <CheckCircle size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className={ok ? 'text-slate-700' : 'text-red-700'}>{step.result.action_taken}</p>
              {errorDetail && (
                <p className="text-[11px] text-red-500 mt-0.5">{errorDetail}</p>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{step.action}</span>
          </li>
        )
      })}
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
  const route = intentRoute(response.intent, response.domain)
  const isClarify = response.data?.clarify === true

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border p-4 shadow-sm text-sm transition-all ${
        isClarify
          ? 'bg-amber-50 border-amber-100'
          : response.success
          ? 'bg-white border-slate-100'
          : 'bg-red-50 border-red-100'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex-shrink-0">
          {isClarify ? (
            <HelpingHand size={16} className="text-amber-600" />
          ) : response.success ? (
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
        <div className="flex-shrink-0">{intentIcon(response.intent, response.domain)}</div>
      </div>

      {isClarify && <ClarifyCandidates response={response} />}

      {/* Multi-step agent results */}
      {response.steps && response.steps.length > 0 && (
        <StepsList steps={response.steps} />
      )}

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

          {/* Help: command list */}
          {typeof response.data.help === 'string' && (
            <div className="mt-2 space-y-0.5">
              {(response.data.help as string).split('\n').map((line, i) => {
                const [cmd, ...desc] = line.split(' — ')
                return (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="font-mono text-indigo-600 w-20 flex-shrink-0">{cmd}</span>
                    <span className="text-slate-500">{desc.join(' — ')}</span>
                  </div>
                )
              })}
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
