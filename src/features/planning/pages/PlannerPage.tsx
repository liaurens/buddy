import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invokeAssistantAction } from '../../assistant'
import type { AssistantResponse } from '../../assistant'
import { useAuth } from '../../../hooks/useAuth'
import { useTimer } from '../../../hooks/useTimer'
import { useToast } from '../../../components/ui/Toast'
import { getCategorySettings } from '../../../services/settings'
import { supabase, todoToDb } from '../../../services/supabase'
import { v4 as uuidv4 } from 'uuid'
import { useQueryClient } from '@tanstack/react-query'
import {
    startBlock as startBlockSvc,
    completeBlock as completeBlockSvc,
    skipBlock as skipBlockSvc,
} from '../services/planning.service'
import { recordBlockCompletion } from '../services/reflection.service'
import {
    Sparkles,
    RefreshCcw,
    AlertCircle,
    CheckCircle2,
    Timer as TimerIcon,
    Brain,
    Dumbbell,
    ListChecks,
    PlayCircle,
    Play,
    Pause,
    SkipForward,
    FileText,
    Pencil,
    Repeat,
} from 'lucide-react'

type Step = 'idle' | 'start' | 'generate' | 'review' | 'done'

interface TaskRow {
    id: string
    title: string
    priority?: string | null
    due_date?: string | null
    estimated_minutes?: number | null
    average_minutes?: number | null
    average_count?: number
    recurrence?: string | null
}

interface ActivityRow {
    id: string
    name: string
    emoji?: string | null
    default_minutes?: number | null
    average_minutes?: number | null
    average_count?: number
}

interface BlockRow {
    id?: string
    title: string
    start_time: string
    end_time: string
    estimated_minutes: number
    actual_minutes?: number | null
    task_id?: string | null
    activity_template_id?: string | null
    description?: string | null
    status?: string
    variance_minutes?: number | null
    recurring?: boolean
    is_recurring_or_activity?: boolean
    average_minutes?: number | null
    average_count?: number
}

interface BlockActual {
    block_id: string
    actual_minutes: number
    status: 'completed' | 'skipped' | 'pending'
    notes?: string
}

interface ActivityDurationEntry {
    minutes: number
    fixed: boolean
}

interface PlannerDraft {
    hoursAvailable: number
    feel: number
    medicationTaken: boolean
    startTime: string
    selectedTaskIds: string[]
    selectedActivityIds: string[]
    taskEstimates: Record<string, number>
    activityDurations: Record<string, ActivityDurationEntry>
}

function todayISO() {
    return new Date().toISOString().split('T')[0]
}

const draftKey = (date: string) => `planner_draft_${date}`
const fixedMapKey = (date: string) => `planner_fixed_${date}`

function readFixedMap(date: string): Record<string, boolean> {
    try {
        const raw = localStorage.getItem(fixedMapKey(date))
        return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    } catch {
        return {}
    }
}

function writeFixedMap(date: string, map: Record<string, boolean>) {
    try {
        localStorage.setItem(fixedMapKey(date), JSON.stringify(map))
    } catch {
        /* ignore */
    }
}

const PlannerPage: React.FC = () => {
    const { user } = useAuth()
    const timer = useTimer()
    const toast = useToast()
    const queryClient = useQueryClient()
    const [activityCategories, setActivityCategories] = useState<string[]>(['health'])

    const [step, setStep] = useState<Step>('idle')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Step 1 inventory
    const [tasks, setTasks] = useState<TaskRow[]>([])
    const [activities, setActivities] = useState<ActivityRow[]>([])
    const [learnings, setLearnings] = useState<unknown[]>([])

    // Step 1 inputs
    const [hoursAvailable, setHoursAvailable] = useState<number>(6)
    const [feel, setFeel] = useState<number>(7)
    const [medicationTaken, setMedicationTaken] = useState<boolean>(false)
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
    const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set())
    const [startTime, setStartTime] = useState<string>('09:00')
    const [taskEstimates, setTaskEstimates] = useState<Record<string, number>>({})
    const [activityDurations, setActivityDurations] = useState<Record<string, ActivityDurationEntry>>({})

    // Inline Add Task form
    const [addTaskOpen, setAddTaskOpen] = useState<boolean>(false)
    const [newTaskTitle, setNewTaskTitle] = useState<string>('')
    const [newTaskMinutes, setNewTaskMinutes] = useState<number>(30)
    const [newTaskRecurrence, setNewTaskRecurrence] = useState<string>('none')
    const [newTaskTimed, setNewTaskTimed] = useState<boolean>(false)
    const [creatingTask, setCreatingTask] = useState<boolean>(false)

    // Inline Add Activity form
    const [addActivityOpen, setAddActivityOpen] = useState<boolean>(false)
    const [newActivityName, setNewActivityName] = useState<string>('')
    const [newActivityEmoji, setNewActivityEmoji] = useState<string>('💪')
    const [newActivityCategory, setNewActivityCategory] = useState<string>('health')
    const [newActivityMinutes, setNewActivityMinutes] = useState<number>(30)
    const [creatingActivity, setCreatingActivity] = useState<boolean>(false)

    // Step 2 output
    const [planId, setPlanId] = useState<string | null>(null)
    const [planMode, setPlanMode] = useState<string | null>(null)
    const [planBlocks, setPlanBlocks] = useState<BlockRow[]>([])
    const [aiReasoning, setAiReasoning] = useState<string | null>(null)
    const [planWarnings, setPlanWarnings] = useState<string[]>([])

    // Step 3 state
    const [reviewBlocks, setReviewBlocks] = useState<BlockRow[]>([])
    const [reviewStats, setReviewStats] = useState<{ completed: number; total: number; total_variance_minutes: number } | null>(null)
    const [adjustingBlockId, setAdjustingBlockId] = useState<string | null>(null)
    const [adjustValue, setAdjustValue] = useState<number>(0)

    // Step 4 close inputs
    const [focusRating, setFocusRating] = useState<number>(7)
    const [planWorked, setPlanWorked] = useState<boolean>(true)
    const [closeNotes, setCloseNotes] = useState<string>('')

    // Step 5 done output
    const [retrospective, setRetrospective] = useState<Record<string, unknown> | null>(null)
    const [learningSummary, setLearningSummary] = useState<string | null>(null)

    const autoCompleteFiredRef = useRef<Set<string>>(new Set())
    const bootstrappedRef = useRef(false)

    // ─── Draft persistence ──────────────────────────────────────────────────
    useEffect(() => {
        if (step !== 'start') return
        const draft: PlannerDraft = {
            hoursAvailable,
            feel,
            medicationTaken,
            startTime,
            selectedTaskIds: Array.from(selectedTaskIds),
            selectedActivityIds: Array.from(selectedActivityIds),
            taskEstimates,
            activityDurations,
        }
        try {
            localStorage.setItem(draftKey(todayISO()), JSON.stringify(draft))
        } catch {
            /* ignore */
        }
    }, [step, hoursAvailable, feel, medicationTaken, startTime, selectedTaskIds, selectedActivityIds, taskEstimates, activityDurations])

    const hydrateFromDraft = useCallback(() => {
        try {
            const raw = localStorage.getItem(draftKey(todayISO()))
            if (!raw) return false
            const d = JSON.parse(raw) as PlannerDraft
            setHoursAvailable(d.hoursAvailable ?? 6)
            setFeel(d.feel ?? 7)
            setMedicationTaken(Boolean(d.medicationTaken))
            setStartTime(d.startTime ?? '09:00')
            setSelectedTaskIds(new Set(d.selectedTaskIds ?? []))
            setSelectedActivityIds(new Set(d.selectedActivityIds ?? []))
            setTaskEstimates(d.taskEstimates ?? {})
            setActivityDurations(d.activityDurations ?? {})
            return true
        } catch {
            return false
        }
    }, [])

    // ─── Load category preference ───────────────────────────────────────────
    useEffect(() => {
        if (!user) return
        void (async () => {
            try {
                const s = await getCategorySettings(user.id, 'planning')
                if (Array.isArray(s.activityCategories) && s.activityCategories.length > 0) {
                    setActivityCategories(s.activityCategories)
                }
            } catch {
                /* fall back to default ['health'] */
            }
        })()
    }, [user])

    // ─── Bootstrap: check for active plan today, else draft ─────────────────
    useEffect(() => {
        if (bootstrappedRef.current) return
        bootstrappedRef.current = true
        void (async () => {
            const res = await invokeAssistantAction('planning', 'plan.review', { date: todayISO() })
            if (res.success && (res.data as { plan?: { id: string } }).plan) {
                const data = res.data as {
                    plan: { id: string }
                    blocks: BlockRow[]
                    stats?: { completed: number; total: number; total_variance_minutes: number }
                }
                setPlanId(data.plan.id)
                setReviewBlocks(data.blocks || [])
                setReviewStats(data.stats ?? null)
                setStep('review')
                return
            }
            // No plan — try to hydrate draft + jump into Step 1 (fetch inventory fresh)
            const hadDraft = hydrateFromDraft()
            if (hadDraft) {
                await handleStart(true)
            }
        })()
    }, [hydrateFromDraft]) // eslint-disable-line react-hooks/exhaustive-deps

    // ─── API helpers ────────────────────────────────────────────────────────
    const runAction = async (
        action: string,
        params: Record<string, unknown>,
        onSuccess: (data: AssistantResponse) => void
    ) => {
        setLoading(true)
        setError(null)
        try {
            const res = await invokeAssistantAction('planning', action, params)
            if (!res.success) {
                const msg = res.action_taken || res.error || 'Request failed'
                setError(msg)
                return
            }
            onSuccess(res)
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Request failed'
            setError(msg)
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }

    const handleStart = async (keepFormState = false) => {
        await runAction('plan.start', { activity_categories: activityCategories }, (res) => {
            const data = res.data as {
                tasks: TaskRow[]
                activity_templates: ActivityRow[]
                recent_learnings: unknown[]
            }
            setTasks(data.tasks || [])
            setActivities(data.activity_templates || [])
            setLearnings(data.recent_learnings || [])
            if (!keepFormState) {
                setSelectedTaskIds(new Set())
                setSelectedActivityIds(new Set())
                setTaskEstimates({})
                setActivityDurations({})
            }
            setStep('start')
        })
    }

    const handleGenerate = () => {
        if (selectedActivityIds.size < 2) {
            setError('Pick at least 2 active activities (gym, walk, etc.).')
            return
        }
        const activity_durations: Record<string, number> = {}
        const fixedMap: Record<string, boolean> = {}
        for (const id of selectedActivityIds) {
            const entry = activityDurations[id]
            if (entry?.minutes) activity_durations[id] = entry.minutes
            if (entry?.fixed) fixedMap[id] = true
        }
        writeFixedMap(todayISO(), fixedMap)

        const task_estimates: Record<string, number> = {}
        for (const id of selectedTaskIds) {
            const v = taskEstimates[id]
            if (Number.isFinite(v) && v > 0) task_estimates[id] = v
        }

        void runAction(
            'plan.generate',
            {
                date: todayISO(),
                start_time: startTime,
                hours_available: hoursAvailable,
                feel,
                medication_taken: medicationTaken,
                selected_task_ids: Array.from(selectedTaskIds),
                scheduled_activity_template_ids: Array.from(selectedActivityIds),
                task_estimates,
                activity_durations,
            },
            (res) => {
                const data = res.data as {
                    plan_id: string
                    mode: string
                    blocks: BlockRow[]
                    ai_reasoning: string
                    warnings: string[]
                }
                setPlanId(data.plan_id)
                setPlanMode(data.mode)
                setPlanBlocks(data.blocks || [])
                setAiReasoning(data.ai_reasoning)
                setPlanWarnings(data.warnings || [])
                setStep('generate')
                toast.success(`Plan generated — ${(data.blocks || []).length} blocks (${data.mode}).`)
                try {
                    localStorage.removeItem(draftKey(todayISO()))
                } catch {
                    /* ignore */
                }
            }
        )
    }

    const loadReview = useCallback(async () => {
        await runAction('plan.review', { date: todayISO() }, (res) => {
            const data = res.data as {
                plan: { id: string } | null
                blocks: BlockRow[]
                stats?: { completed: number; total: number; total_variance_minutes: number }
            }
            if (!data.plan) {
                setError('No plan for today yet — start one first.')
                return
            }
            setPlanId(data.plan.id)
            setReviewBlocks(data.blocks || [])
            setReviewStats(data.stats ?? null)
            setStep('review')
        })
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Live timer actions ─────────────────────────────────────────────────
    const activeBlockId = timer.activeBlockId
    const fixedMap = useMemo(() => readFixedMap(todayISO()), [reviewBlocks.length])

    const handleStartBlock = async (block: BlockRow) => {
        if (!user?.id || !block.id) return
        if (timer.isRunning) {
            toast.warning('Finish the current block first.')
            return
        }
        try {
            await startBlockSvc(user.id, block.id)
            timer.start(block.id)
            await loadReview()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to start block')
        }
    }

    const handleCompleteBlock = useCallback(async (block: BlockRow, overrideMinutes?: number) => {
        if (!user?.id || !block.id) return
        const actual = overrideMinutes != null ? overrideMinutes : timer.stop()
        try {
            await completeBlockSvc(user.id, block.id, actual)
            if (block.is_recurring_or_activity && block.task_id) {
                await recordBlockCompletion(user.id, block.id, actual)
            }
            const avgHint = block.average_minutes ? `. Avg ${block.average_minutes}min` : ''
            toast.success(`Logged ${actual}min${avgHint}`)
            await loadReview()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to complete block')
        }
    }, [user?.id, timer, toast, loadReview])

    const handleSkipBlock = async (block: BlockRow) => {
        if (!user?.id || !block.id) return
        try {
            if (timer.activeBlockId === block.id) timer.stop()
            await skipBlockSvc(user.id, block.id)
            await loadReview()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to skip block')
        }
    }

    // Fixed-duration auto-complete: when countdown hits zero, fire complete once.
    useEffect(() => {
        if (!activeBlockId) return
        const block = reviewBlocks.find(b => b.id === activeBlockId)
        if (!block || !block.id) return
        const isFixed =
            (block.activity_template_id && fixedMap[block.activity_template_id]) ||
            (block.task_id && fixedMap[block.task_id])
        if (!isFixed) return
        const elapsedSec = timer.elapsedMinutes * 60 + timer.elapsedSeconds
        const targetSec = block.estimated_minutes * 60
        if (elapsedSec >= targetSec && !autoCompleteFiredRef.current.has(block.id)) {
            autoCompleteFiredRef.current.add(block.id)
            void handleCompleteBlock(block, block.estimated_minutes)
        }
    }, [timer.elapsedMinutes, timer.elapsedSeconds, activeBlockId, reviewBlocks, fixedMap, handleCompleteBlock])

    const handleAdjustSave = async (block: BlockRow) => {
        if (!user?.id || !block.id) return
        const next = Math.max(0, Math.round(adjustValue))
        try {
            await completeBlockSvc(user.id, block.id, next)
            toast.success(`Updated to ${next}min`)
            setAdjustingBlockId(null)
            await loadReview()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update block')
        }
    }

    // ─── Close ──────────────────────────────────────────────────────────────
    const allTimed = reviewBlocks.length > 0 && reviewBlocks.every(b => b.status !== 'pending' && b.status !== 'active')

    const handleClose = () => {
        if (!planId) {
            toast.error('No plan loaded to close')
            return
        }
        const block_actuals: BlockActual[] = reviewBlocks
            .filter(b => b.id)
            .map(b => ({
                block_id: b.id!,
                actual_minutes: Number(b.actual_minutes ?? b.estimated_minutes) || 0,
                status: b.status === 'active' || !b.status ? 'pending' : (b.status as BlockActual['status']),
            }))
        void runAction(
            'plan.close',
            {
                plan_id: planId,
                focus_rating: focusRating,
                plan_worked: planWorked,
                block_actuals,
                notes: closeNotes,
            },
            (res) => {
                const data = res.data as {
                    retrospective: Record<string, unknown>
                    learning_summary: string | null
                }
                setRetrospective(data.retrospective)
                setLearningSummary(data.learning_summary)
                setStep('done')
                toast.success('Day closed. Learning captured.')
            }
        )
    }

    // ─── UI helpers ─────────────────────────────────────────────────────────
    const toggleInSet = (set: Set<string>, id: string): Set<string> => {
        const next = new Set(set)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
    }

    const toggleTask = (task: TaskRow) => {
        setSelectedTaskIds((prev) => {
            const next = toggleInSet(prev, task.id)
            setTaskEstimates((est) => {
                if (next.has(task.id) && est[task.id] == null) {
                    return { ...est, [task.id]: task.average_minutes ?? task.estimated_minutes ?? 30 }
                }
                if (!next.has(task.id)) {
                    const { [task.id]: _drop, ...rest } = est
                    return rest
                }
                return est
            })
            return next
        })
    }

    const handleAddInlineTask = async () => {
        if (!user) return
        const title = newTaskTitle.trim()
        if (!title) {
            toast.error('Task title is required')
            return
        }
        const minutes = Math.max(1, Math.round(newTaskMinutes) || 30)
        setCreatingTask(true)
        try {
            const id = uuidv4()
            const dbRow = todoToDb(
                {
                    id,
                    title,
                    completed: false,
                    createdAt: new Date().toISOString(),
                    priority: 'medium',
                    estimatedTime: minutes,
                    subtasks: [],
                    recurrence: (newTaskRecurrence as 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays') || 'none',
                },
                user.id
            )
            const { error: insertErr } = await supabase.from('todos').insert(dbRow)
            if (insertErr) throw insertErr

            const row: TaskRow = {
                id,
                title,
                priority: 'medium',
                estimated_minutes: minutes,
                recurrence: newTaskRecurrence,
            }
            setTasks((prev) => [row, ...prev])
            setSelectedTaskIds((prev) => {
                const next = new Set(prev)
                next.add(id)
                return next
            })
            setTaskEstimates((prev) => ({ ...prev, [id]: minutes }))
            if (newTaskTimed) {
                const map = readFixedMap(todayISO())
                map[id] = true
                writeFixedMap(todayISO(), map)
            }
            queryClient.invalidateQueries({ queryKey: ['todos', user.id] })
            toast.success(`Added "${title}"`)
            setNewTaskTitle('')
            setNewTaskMinutes(30)
            setNewTaskRecurrence('none')
            setNewTaskTimed(false)
            setAddTaskOpen(false)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to add task')
        } finally {
            setCreatingTask(false)
        }
    }

    const toggleActivity = (a: ActivityRow) => {
        setSelectedActivityIds((prev) => {
            const next = toggleInSet(prev, a.id)
            setActivityDurations((dur) => {
                if (next.has(a.id) && !dur[a.id]) {
                    return { ...dur, [a.id]: { minutes: a.average_minutes ?? a.default_minutes ?? 30, fixed: false } }
                }
                if (!next.has(a.id)) {
                    const { [a.id]: _drop, ...rest } = dur
                    return rest
                }
                return dur
            })
            return next
        })
    }

    const handleAddInlineActivity = async () => {
        if (!user) return
        const name = newActivityName.trim()
        if (!name) {
            toast.error('Activity name is required')
            return
        }
        const minutes = Math.max(1, Math.round(newActivityMinutes) || 30)
        setCreatingActivity(true)
        try {
            const id = uuidv4()
            const category = newActivityCategory || activityCategories[0] || 'health'
            const dbRow = {
                id,
                user_id: user.id,
                name,
                emoji: newActivityEmoji || '💪',
                category,
                default_minutes: minutes,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }
            const { error: insertErr } = await supabase.from('activity_templates').insert(dbRow)
            if (insertErr) throw insertErr

            const row: ActivityRow = {
                id,
                name,
                emoji: newActivityEmoji || '💪',
                default_minutes: minutes,
            }
            setActivities((prev) => [row, ...prev])
            setSelectedActivityIds((prev) => {
                const next = new Set(prev)
                next.add(id)
                return next
            })
            setActivityDurations((prev) => ({ ...prev, [id]: { minutes, fixed: false } }))
            
            toast.success(`Added "${name}"`)
            setNewActivityName('')
            setNewActivityEmoji('💪')
            setNewActivityMinutes(30)
            setAddActivityOpen(false)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to add activity')
        } finally {
            setCreatingActivity(false)
        }
    }

    const resetFlow = () => {
        setStep('idle')
        setError(null)
        setPlanId(null)
        setPlanBlocks([])
        setReviewBlocks([])
        setRetrospective(null)
        setLearningSummary(null)
        setAiReasoning(null)
        setPlanWarnings([])
        autoCompleteFiredRef.current.clear()
    }

    return (
        <div className="max-w-3xl mx-auto p-4 pb-24 space-y-6">
            <header className="flex items-center justify-between pt-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Brain className="text-indigo-600" size={24} />
                        Daily Planner
                    </h1>
                    <p className="text-sm text-slate-500">ADHD-aware: morning intake → plan → evening reflection → learning.</p>
                </div>
                {step !== 'idle' && (
                    <button onClick={resetFlow} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                        <RefreshCcw size={12} />
                        Restart
                    </button>
                )}
            </header>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-800">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {step === 'idle' && (
                <div className="space-y-3">
                    <button
                        onClick={() => void handleStart()}
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white rounded-xl p-5 font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <PlayCircle size={20} />
                        {loading ? 'Loading…' : 'Start Planning Today'}
                    </button>
                    <button
                        onClick={() => void loadReview()}
                        disabled={loading}
                        className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl p-4 font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <ListChecks size={18} />
                        Review / Close Today's Plan
                    </button>
                </div>
            )}

            {step === 'start' && (
                <div className="space-y-5">
                    <Section title="How you feel">
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="Hours available" value={hoursAvailable} onChange={setHoursAvailable} min={0.5} step={0.5} />
                            <NumberField label="Feel (1–10)" value={feel} onChange={setFeel} min={1} max={10} />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-700 mt-3">
                            <input
                                type="checkbox"
                                checked={medicationTaken}
                                onChange={(e) => setMedicationTaken(e.target.checked)}
                                className="rounded"
                            />
                            Medication taken today
                        </label>
                        <div className="mt-3">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Start time</label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </Section>

                    <Section title={`Tasks to tackle (${selectedTaskIds.size} selected)`}>
                        <div className="mb-3">
                            {!addTaskOpen ? (
                                <button
                                    onClick={() => setAddTaskOpen(true)}
                                    className="w-full text-left px-3 py-2 border border-dashed border-indigo-300 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
                                >
                                    + Add task
                                </button>
                            ) : (
                                <div className="space-y-2 p-3 border border-indigo-200 rounded-lg bg-indigo-50/40">
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Task title"
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="text-xs text-slate-600 flex items-center gap-1">
                                            Est.
                                            <input
                                                type="number"
                                                min={1}
                                                value={newTaskMinutes}
                                                onChange={(e) => setNewTaskMinutes(Number(e.target.value))}
                                                className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                                            />
                                            min
                                        </label>
                                        <label className="text-xs text-slate-600 flex items-center gap-1">
                                            Repeat
                                            <select
                                                value={newTaskRecurrence}
                                                onChange={(e) => setNewTaskRecurrence(e.target.value)}
                                                className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                                            >
                                                <option value="none">None</option>
                                                <option value="daily">Daily</option>
                                                <option value="weekdays">Weekdays</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                            </select>
                                        </label>
                                    </div>
                                    <label className="flex items-center gap-2 text-xs text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={newTaskTimed}
                                            onChange={(e) => setNewTaskTimed(e.target.checked)}
                                            className="rounded"
                                        />
                                        Timed (countdown auto-completes at target)
                                    </label>
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={() => void handleAddInlineTask()}
                                            disabled={creatingTask || !newTaskTitle.trim()}
                                            className="flex-1 bg-indigo-600 text-white text-sm font-medium rounded-md py-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                        >
                                            {creatingTask ? 'Adding…' : 'Add task'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setAddTaskOpen(false)
                                                setNewTaskTitle('')
                                                setNewTaskMinutes(30)
                                                setNewTaskRecurrence('none')
                                                setNewTaskTimed(false)
                                            }}
                                            disabled={creatingTask}
                                            className="px-3 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        {tasks.length === 0 ? (
                            <p className="text-sm text-slate-500">No open tasks.</p>
                        ) : (
                            <div className="space-y-1 max-h-96 overflow-y-auto">
                                {tasks.map((t) => {
                                    const checked = selectedTaskIds.has(t.id)
                                    const preFilled = t.average_minutes != null
                                    return (
                                        <div
                                            key={t.id}
                                            className={`flex items-start gap-2 p-2 rounded-lg ${checked ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleTask(t)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-medium text-slate-800 truncate">{t.title}</span>
                                                    {t.recurrence && t.recurrence !== 'none' && (
                                                        <Repeat size={12} className="text-amber-600 flex-shrink-0" aria-label="recurring" />
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {t.priority && <span className="mr-2">P: {t.priority}</span>}
                                                    {t.estimated_minutes != null && <span className="mr-2">orig ~{t.estimated_minutes}min</span>}
                                                </div>
                                                {checked && (
                                                    <div className="mt-1.5 flex items-center gap-2">
                                                        <label className="text-xs text-slate-600 flex items-center gap-1">
                                                            Est.
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                value={taskEstimates[t.id] ?? ''}
                                                                onChange={(e) =>
                                                                    setTaskEstimates((prev) => ({ ...prev, [t.id]: Number(e.target.value) }))
                                                                }
                                                                className="w-20 border border-slate-200 rounded-md px-2 py-1 text-sm"
                                                            />
                                                            min
                                                        </label>
                                                        {preFilled && (
                                                            <span className="text-[11px] text-indigo-600">
                                                                avg of last {t.average_count ?? '?'}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </Section>

                    <Section title={`Active activities — pick ≥ 2 (${selectedActivityIds.size} selected)`}>
                        <div className="mb-3">
                            {!addActivityOpen ? (
                                <button
                                    onClick={() => setAddActivityOpen(true)}
                                    className="w-full text-left px-3 py-2 border border-dashed border-emerald-300 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50 transition-colors"
                                >
                                    + Add activity template
                                </button>
                            ) : (
                                <div className="space-y-2 p-3 border border-emerald-200 rounded-lg bg-emerald-50/40">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Emoji (💪)"
                                            value={newActivityEmoji}
                                            onChange={(e) => setNewActivityEmoji(e.target.value)}
                                            className="w-16 border border-slate-200 rounded-md px-3 py-2 text-sm text-center"
                                            maxLength={2}
                                        />
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder="Activity name (e.g. Morning Walk)"
                                            value={newActivityName}
                                            onChange={(e) => setNewActivityName(e.target.value)}
                                            className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="text-xs text-slate-600 flex items-center gap-1">
                                            Est.
                                            <input
                                                type="number"
                                                min={1}
                                                value={newActivityMinutes}
                                                onChange={(e) => setNewActivityMinutes(Number(e.target.value))}
                                                className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                                            />
                                            min
                                        </label>
                                        <label className="text-xs text-slate-600 flex items-center gap-1">
                                            Category
                                            <select
                                                value={newActivityCategory}
                                                onChange={(e) => setNewActivityCategory(e.target.value)}
                                                className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm text-slate-600"
                                            >
                                                <option value="health">Health</option>
                                                <option value="routine">Routine</option>
                                                <option value="chore">Chore</option>
                                                <option value="work">Work</option>
                                                <option value="leisure">Leisure</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={() => void handleAddInlineActivity()}
                                            disabled={creatingActivity || !newActivityName.trim()}
                                            className="flex-1 bg-emerald-600 text-white text-sm font-medium rounded-md py-2 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                        >
                                            {creatingActivity ? 'Adding…' : 'Add activity'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setAddActivityOpen(false)
                                                setNewActivityName('')
                                                setNewActivityEmoji('💪')
                                                setNewActivityMinutes(30)
                                            }}
                                            disabled={creatingActivity}
                                            className="px-3 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        {activities.length === 0 ? (
                            <p className="text-sm text-slate-500">No health-category activity templates. Add some above, or edit Planning Settings.</p>
                        ) : (
                            <div className="space-y-2">
                                {activities.map((a) => {
                                    const checked = selectedActivityIds.has(a.id)
                                    const entry = activityDurations[a.id]
                                    return (
                                        <div
                                            key={a.id}
                                            className={`p-3 border rounded-lg ${checked ? 'bg-emerald-50 border-emerald-300' : 'border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleActivity(a)}
                                                />
                                                <Dumbbell size={14} className="text-emerald-600" />
                                                <span className="text-sm font-medium text-slate-800 flex-1 min-w-0 truncate">
                                                    {a.emoji} {a.name}
                                                </span>
                                            </label>
                                            {checked && (
                                                <div className="mt-2 ml-6 flex flex-wrap items-center gap-3">
                                                    <label className="text-xs text-slate-600 flex items-center gap-1">
                                                        Target
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            value={entry?.minutes ?? ''}
                                                            onChange={(e) =>
                                                                setActivityDurations((prev) => ({
                                                                    ...prev,
                                                                    [a.id]: { minutes: Number(e.target.value), fixed: prev[a.id]?.fixed ?? false },
                                                                }))
                                                            }
                                                            className="w-20 border border-slate-200 rounded-md px-2 py-1 text-sm"
                                                        />
                                                        min
                                                    </label>
                                                    <label className="text-xs text-slate-600 flex items-center gap-1.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={entry?.fixed ?? false}
                                                            onChange={(e) =>
                                                                setActivityDurations((prev) => ({
                                                                    ...prev,
                                                                    [a.id]: { minutes: prev[a.id]?.minutes ?? a.default_minutes ?? 30, fixed: e.target.checked },
                                                                }))
                                                            }
                                                        />
                                                        Fixed duration (countdown, auto-complete)
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </Section>

                    {learnings.length > 0 && (
                        <Section title="Recent learnings the AI will use">
                            <ul className="text-xs text-slate-600 space-y-1">
                                {learnings.slice(0, 3).map((l, i) => {
                                    const obj = l as { description?: string; pattern?: string }
                                    return (
                                        <li key={i} className="flex gap-1.5">
                                            <Sparkles size={12} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                                            <span>{obj.description || obj.pattern || JSON.stringify(l)}</span>
                                        </li>
                                    )
                                })}
                            </ul>
                        </Section>
                    )}

                    <button
                        onClick={handleGenerate}
                        disabled={loading || selectedActivityIds.size < 2}
                        className="w-full bg-indigo-600 text-white rounded-xl p-4 font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Sparkles size={18} />
                        {loading ? 'Generating plan…' : 'Generate Plan'}
                    </button>
                </div>
            )}

            {step === 'generate' && (
                <div className="space-y-5">
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                        <div className="flex items-start gap-2">
                            <Sparkles className="text-indigo-600 mt-0.5 flex-shrink-0" size={18} />
                            <div>
                                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Mode: {planMode}</p>
                                {aiReasoning && <p className="text-sm text-indigo-900 mt-1">{aiReasoning}</p>}
                            </div>
                        </div>
                    </div>

                    {planWarnings.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs font-semibold text-amber-800 mb-1">Warnings</p>
                            <ul className="text-sm text-amber-900 space-y-1">
                                {planWarnings.map((w, i) => (
                                    <li key={i}>• {w}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <Section title="Your plan">
                        <div className="space-y-2">
                            {planBlocks.map((b, i) => (
                                <div key={i} className="border border-slate-200 rounded-lg p-3 bg-white">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <h4 className="font-semibold text-slate-900 text-sm">{b.title}</h4>
                                        <span className="text-xs text-slate-500 flex-shrink-0">
                                            {b.start_time}–{b.end_time} · {b.estimated_minutes}min
                                        </span>
                                    </div>
                                    {b.description && <p className="text-xs text-slate-600 mt-1">→ {b.description}</p>}
                                </div>
                            ))}
                        </div>
                    </Section>

                    <button
                        onClick={() => void loadReview()}
                        className="w-full bg-indigo-600 text-white rounded-xl p-4 font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2"
                    >
                        <TimerIcon size={18} />
                        Open live review
                    </button>
                </div>
            )}

            {step === 'review' && (
                <div className="space-y-5">
                    {reviewStats && (
                        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3">
                            <span className="text-sm text-slate-700">
                                {reviewStats.completed} / {reviewStats.total} blocks done
                            </span>
                            <span
                                className={`text-sm font-semibold ${reviewStats.total_variance_minutes > 0 ? 'text-rose-600' : reviewStats.total_variance_minutes < 0 ? 'text-emerald-600' : 'text-slate-600'}`}
                            >
                                {reviewStats.total_variance_minutes >= 0 ? '+' : ''}
                                {reviewStats.total_variance_minutes} min vs plan
                            </span>
                        </div>
                    )}

                    <Section title="Today's blocks">
                        <div className="space-y-2">
                            {reviewBlocks.map((b) => {
                                if (!b.id) return null
                                const isActive = timer.activeBlockId === b.id
                                const isCompleted = b.status === 'completed'
                                const isSkipped = b.status === 'skipped'
                                const isFixed =
                                    (b.activity_template_id ? fixedMap[b.activity_template_id] === true : false) ||
                                    (b.task_id ? fixedMap[b.task_id] === true : false)
                                const elapsedSec = isActive ? timer.elapsedMinutes * 60 + timer.elapsedSeconds : 0
                                const targetSec = b.estimated_minutes * 60
                                const remaining = Math.max(0, targetSec - elapsedSec)
                                const displayMinutes = isFixed && isActive
                                    ? Math.floor(remaining / 60)
                                    : timer.elapsedMinutes
                                const displaySeconds = isFixed && isActive
                                    ? remaining % 60
                                    : timer.elapsedSeconds

                                return (
                                    <div
                                        key={b.id}
                                        className={`rounded-lg p-3 border ${
                                            isActive
                                                ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200'
                                                : isCompleted
                                                    ? 'bg-green-50 border-green-200'
                                                    : isSkipped
                                                        ? 'bg-slate-100 border-slate-200 opacity-60'
                                                        : b.recurring
                                                            ? 'border-amber-200 bg-amber-50/30'
                                                            : 'border-slate-200 bg-white'
                                        }`}
                                    >
                                        <div className="flex items-baseline justify-between gap-2">
                                            <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                                                {b.title}
                                                {b.recurring && <Repeat size={12} className="text-amber-600" />}
                                                {isFixed && <span className="text-[10px] uppercase tracking-wider text-emerald-700">fixed</span>}
                                            </h4>
                                            <span className="text-xs text-slate-500 flex-shrink-0">
                                                {b.start_time} · planned {b.estimated_minutes}min
                                                {b.average_minutes != null && ` · avg ${b.average_minutes}min`}
                                            </span>
                                        </div>

                                        {isActive && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="font-mono text-lg font-semibold text-indigo-700">
                                                    {String(displayMinutes).padStart(2, '0')}:{String(displaySeconds).padStart(2, '0')}
                                                </span>
                                                {timer.isPaused && <span className="text-xs text-amber-700 font-medium">PAUSED</span>}
                                                {isFixed && <span className="text-xs text-slate-500">countdown</span>}
                                            </div>
                                        )}

                                        {isCompleted && adjustingBlockId !== b.id && (
                                            <div className="mt-1 flex items-center gap-2 text-sm text-green-800">
                                                <CheckCircle2 size={14} />
                                                <span>Logged {b.actual_minutes}min</span>
                                                {b.variance_minutes != null && b.variance_minutes !== 0 && (
                                                    <span className="text-xs text-slate-600">
                                                        ({b.variance_minutes > 0 ? '+' : ''}{b.variance_minutes}min vs plan)
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setAdjustingBlockId(b.id!)
                                                        setAdjustValue(b.actual_minutes ?? b.estimated_minutes)
                                                    }}
                                                    className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                                >
                                                    <Pencil size={12} />
                                                    Adjust
                                                </button>
                                            </div>
                                        )}

                                        {isCompleted && adjustingBlockId === b.id && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={adjustValue}
                                                    onChange={(e) => setAdjustValue(Number(e.target.value))}
                                                    className="w-24 border border-slate-200 rounded-md px-2 py-1 text-sm"
                                                />
                                                <span className="text-xs text-slate-500">min</span>
                                                <button
                                                    onClick={() => void handleAdjustSave(b)}
                                                    className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setAdjustingBlockId(null)}
                                                    className="px-3 py-1 text-xs bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        )}

                                        <div className="mt-2 flex gap-2 flex-wrap">
                                            {b.status === 'pending' && !timer.isRunning && (
                                                <button
                                                    onClick={() => void handleStartBlock(b)}
                                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center gap-1"
                                                >
                                                    <Play size={14} />
                                                    Start
                                                </button>
                                            )}
                                            {isActive && !timer.isPaused && (
                                                <button
                                                    onClick={timer.pause}
                                                    className="px-3 py-1.5 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 flex items-center gap-1"
                                                >
                                                    <Pause size={14} />
                                                    Pause
                                                </button>
                                            )}
                                            {isActive && timer.isPaused && (
                                                <button
                                                    onClick={timer.resume}
                                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center gap-1"
                                                >
                                                    <Play size={14} />
                                                    Resume
                                                </button>
                                            )}
                                            {isActive && (
                                                <button
                                                    onClick={() => void handleCompleteBlock(b)}
                                                    className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 flex items-center gap-1"
                                                >
                                                    <CheckCircle2 size={14} />
                                                    Complete
                                                </button>
                                            )}
                                            {(b.status === 'pending' || isActive) && (
                                                <button
                                                    onClick={() => void handleSkipBlock(b)}
                                                    className="px-2 py-1.5 bg-slate-200 text-slate-700 rounded-md text-sm hover:bg-slate-300 flex items-center gap-1"
                                                >
                                                    <SkipForward size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </Section>

                    <Section title="End of day">
                        <div className="grid grid-cols-2 gap-3">
                            <NumberField label="Focus rating (1–10)" value={focusRating} onChange={setFocusRating} min={1} max={10} />
                            <label className="flex items-end gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={planWorked}
                                    onChange={(e) => setPlanWorked(e.target.checked)}
                                    className="rounded mb-2"
                                />
                                <span className="mb-2">The plan worked</span>
                            </label>
                        </div>
                        <label className="block text-xs font-medium text-slate-600 mt-3">
                            Notes
                            <textarea
                                value={closeNotes}
                                onChange={(e) => setCloseNotes(e.target.value)}
                                rows={3}
                                className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm"
                                placeholder="What threw off the plan? What helped?"
                            />
                        </label>
                        {!allTimed && (
                            <p className="text-xs text-slate-500 mt-2">
                                Tip: use the Start button on each block during the day to auto-log actuals. Blocks still marked pending will be treated as such.
                            </p>
                        )}
                    </Section>

                    <button
                        onClick={handleClose}
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white rounded-xl p-4 font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <CheckCircle2 size={18} />
                        {loading ? 'Closing…' : 'Close Day & Capture Learning'}
                    </button>
                </div>
            )}

            {step === 'done' && retrospective && (
                <div className="space-y-5">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-2">
                        <CheckCircle2 className="text-green-600 mt-0.5 flex-shrink-0" size={20} />
                        <div>
                            <p className="font-semibold text-green-900">Day closed.</p>
                            <p className="text-sm text-green-800">
                                {String(retrospective.blocks_completed)} / {String(retrospective.blocks_planned)} blocks completed · variance{' '}
                                {Number(retrospective.variance_minutes) >= 0 ? '+' : ''}
                                {String(retrospective.variance_minutes)}min
                            </p>
                        </div>
                    </div>

                    {learningSummary && (
                        <Section title="What the system learned">
                            <div className="flex gap-2 items-start">
                                <FileText size={16} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-slate-800">{learningSummary}</p>
                            </div>
                        </Section>
                    )}

                    <Section title="Retrospective stats">
                        <dl className="grid grid-cols-2 gap-3 text-sm">
                            <Stat label="Focus" value={String(retrospective.focus_rating)} />
                            <Stat label="Completion" value={`${retrospective.completion_rate}%`} />
                            <Stat label="Planned total" value={`${retrospective.total_planned_minutes} min`} />
                            <Stat label="Actual total" value={`${retrospective.total_actual_minutes} min`} />
                        </dl>
                    </Section>

                    <button
                        onClick={resetFlow}
                        className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl p-3 font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
                    >
                        <TimerIcon size={16} />
                        Plan another day
                    </button>
                </div>
            )}
        </div>
    )
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
        {children}
    </section>
)

const NumberField: React.FC<{
    label: string
    value: number
    onChange: (v: number) => void
    min?: number
    max?: number
    step?: number
}> = ({ label, value, onChange, min, max, step }) => (
    <label className="text-xs font-medium text-slate-600 block">
        {label}
        <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            min={min}
            max={max}
            step={step}
            className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm"
        />
    </label>
)

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="border border-slate-100 rounded-lg p-3">
        <dt className="text-xs text-slate-500 uppercase tracking-wider">{label}</dt>
        <dd className="text-lg font-semibold text-slate-900">{value}</dd>
    </div>
)

export default PlannerPage
