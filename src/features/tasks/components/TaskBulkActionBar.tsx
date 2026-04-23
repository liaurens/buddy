import React, { useState } from 'react'
import { addDays, format } from 'date-fns'
import { Calendar, CheckCircle, Trash2, X, Clock } from 'lucide-react'
import type { Task } from '../types'

interface TaskBulkActionBarProps {
  selectedIds: string[]
  tasks: Task[]
  onReschedule: (ids: string[], isoDate: string) => Promise<void>
  onComplete: (ids: string[]) => Promise<void>
  onDelete: (ids: string[]) => Promise<void>
  onClear: () => void
}

const TaskBulkActionBar: React.FC<TaskBulkActionBarProps> = ({
  selectedIds,
  onReschedule,
  onComplete,
  onDelete,
  onClear,
}) => {
  const [busy, setBusy] = useState(false)
  const [pickingDate, setPickingDate] = useState(false)

  if (selectedIds.length === 0) return null

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      onClear()
    } finally {
      setBusy(false)
    }
  }

  const rescheduleTo = (daysFromToday: number) => {
    const iso = format(addDays(new Date(), daysFromToday), 'yyyy-MM-dd')
    return run(() => onReschedule(selectedIds, iso))
  }

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2 max-w-[95vw]">
      <span className="text-sm font-medium mr-2">{selectedIds.length} selected</span>

      <button
        onClick={() => rescheduleTo(0)}
        disabled={busy}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition-colors"
        title="Due today"
      >
        <Calendar size={14} /> Today
      </button>
      <button
        onClick={() => rescheduleTo(1)}
        disabled={busy}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition-colors"
        title="Due tomorrow"
      >
        Tomorrow
      </button>
      <button
        onClick={() => rescheduleTo(7)}
        disabled={busy}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition-colors"
        title="Snooze 1 week"
      >
        <Clock size={14} /> +1w
      </button>
      <label className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors">
        Pick…
        <input
          type="date"
          className="sr-only"
          onFocus={() => setPickingDate(true)}
          onBlur={() => setPickingDate(false)}
          onChange={e => {
            if (e.target.value) run(() => onReschedule(selectedIds, e.target.value))
          }}
          disabled={busy}
          aria-label="Pick a due date"
        />
      </label>

      <div className="w-px h-6 bg-slate-700 mx-1" />

      <button
        onClick={() => run(() => onComplete(selectedIds))}
        disabled={busy}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        title="Mark done"
      >
        <CheckCircle size={14} /> Done
      </button>
      <button
        onClick={() => run(() => onDelete(selectedIds))}
        disabled={busy}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-colors"
        title="Delete"
      >
        <Trash2 size={14} />
      </button>

      <button
        onClick={onClear}
        disabled={busy || pickingDate}
        className="ml-1 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        aria-label="Clear selection"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export default TaskBulkActionBar
