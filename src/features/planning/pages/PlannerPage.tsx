import React, { useEffect, useState } from 'react'
import { invokeAssistantAction } from '../../assistant'
import type { AssistantResponse } from '../../assistant'
import {
    Sparkles,
    RefreshCcw,
    AlertCircle,
    CheckCircle2,
    Timer,
    Brain,
    Dumbbell,
    ListChecks,
    PlayCircle,
    FileText,
} from 'lucide-react'

type Step = 'idle' | 'start' | 'generate' | 'review' | 'close' | 'done'

interface TaskRow {
    id: string
    title: string
    priority?: string | null
    due_date?: string | null
    estimated_minutes?: number | null
    average_minutes?: number | null
    recurrence?: string | null
}

interface ActivityRow {
    id: string
    name: string
    emoji?: string | null
    default_minutes?: number | null
    average_minutes?: number | null
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
}

interface BlockActual {
    block_id: string
    actual_minutes: number
    status: 'completed' | 'skipped' | 'pending'
    notes?: string
}

function todayISO() {
    return new Date().toISOString().split('T')[0]
}

const PlannerPage: React.FC = () => {
    const [step, setStep] = useState<Step>('idle')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Step 1 (start) payload
    const [tasks, setTasks] = useState<TaskRow[]>([])
    const [activities, setActivities] = useState<ActivityRow[]>([])
    const [learnings, setLearnings] = useState<unknown[]>([])

    // Step 2 (generate) inputs
    const [hoursAvailable, setHoursAvailable] = useState<number>(6)
    const [feel, setFeel] = useState<number>(7)
    const [medicationTaken, setMedicationTaken] = useState<boolean>(false)
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
    const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set())
    const [startTime, setStartTime] = useState<string>('09:00')

    // Step 2 (generate) output
    const [planId, setPlanId] = useState<string | null>(null)
    const [planMode, setPlanMode] = useState<string | null>(null)
    const [planBlocks, setPlanBlocks] = useState<BlockRow[]>([])
    const [aiReasoning, setAiReasoning] = useState<string | null>(null)
    const [planWarnings, setPlanWarnings] = useState<string[]>([])

    // Step 3 (review) state + Step 4 (close) inputs keyed by block id
    const [reviewBlocks, setReviewBlocks] = useState<BlockRow[]>([])
    const [actualsByBlock, setActualsByBlock] = useState<Record<string, { actual_minutes: number; status: BlockActual['status']; notes?: string }>>({})
    const [focusRating, setFocusRating] = useState<number>(7)
    const [planWorked, setPlanWorked] = useState<boolean>(true)
    const [closeNotes, setCloseNotes] = useState<string>('')

    // Step 5 (done) output
    const [retrospective, setRetrospective] = useState<Record<string, unknown> | null>(null)
    const [learningSummary, setLearningSummary] = useState<string | null>(null)

    useEffect(() => {
        // On mount, try to load any existing plan for today (review) silently.
        void (async () => {
            const res = await invokeAssistantAction('planning', 'plan.review', { date: todayISO() })
            if (res.success && res.data && (res.data as { plan?: { id: string } }).plan) {
                const data = res.data as { plan: { id: string }; blocks: BlockRow[] }
                setPlanId(data.plan.id)
                setReviewBlocks(data.blocks || [])
                setStep('review')
                // Seed actuals
                const seed: typeof actualsByBlock = {}
                for (const b of data.blocks || []) {
                    if (!b.id) continue
                    seed[b.id] = {
                        actual_minutes: b.actual_minutes ?? b.estimated_minutes,
                        status: (b.status as BlockActual['status']) || 'completed',
                    }
                }
                setActualsByBlock(seed)
            }
        })()
    }, [])

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
                setError(res.action_taken || res.error || 'Request failed')
                return
            }
            onSuccess(res)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Request failed')
        } finally {
            setLoading(false)
        }
    }

    const handleStart = () => {
        void runAction('plan.start', {}, (res) => {
            const data = res.data as {
                tasks: TaskRow[]
                activity_templates: ActivityRow[]
                recent_learnings: unknown[]
            }
            setTasks(data.tasks || [])
            setActivities(data.activity_templates || [])
            setLearnings(data.recent_learnings || [])
            setSelectedTaskIds(new Set())
            setSelectedActivityIds(new Set())
            setStep('start')
        })
    }

    const handleGenerate = () => {
        if (selectedActivityIds.size < 2) {
            setError('Pick at least 2 active activities (gym, walk, etc.).')
            return
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
            }
        )
    }

    const handleLoadReview = () => {
        void runAction('plan.review', { date: todayISO() }, (res) => {
            const data = res.data as { plan: { id: string } | null; blocks: BlockRow[] }
            if (!data.plan) {
                setError('No plan for today yet — start one first.')
                return
            }
            setPlanId(data.plan.id)
            setReviewBlocks(data.blocks || [])
            const seed: typeof actualsByBlock = {}
            for (const b of data.blocks || []) {
                if (!b.id) continue
                seed[b.id] = {
                    actual_minutes: b.actual_minutes ?? b.estimated_minutes,
                    status: (b.status as BlockActual['status']) || 'completed',
                }
            }
            setActualsByBlock(seed)
            setStep('review')
        })
    }

    const handleClose = () => {
        if (!planId) {
            setError('No plan loaded to close')
            return
        }
        const block_actuals: BlockActual[] = Object.entries(actualsByBlock).map(([block_id, v]) => ({
            block_id,
            actual_minutes: Number(v.actual_minutes) || 0,
            status: v.status,
            notes: v.notes,
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
            }
        )
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
    }

    const toggleInSet = (set: Set<string>, id: string): Set<string> => {
        const next = new Set(set)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
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
                    <button
                        onClick={resetFlow}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                    >
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
                        onClick={handleStart}
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white rounded-xl p-5 font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <PlayCircle size={20} />
                        {loading ? 'Loading…' : 'Start Planning Today'}
                    </button>
                    <button
                        onClick={handleLoadReview}
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
                        {tasks.length === 0 ? (
                            <p className="text-sm text-slate-500">No open tasks.</p>
                        ) : (
                            <div className="space-y-1 max-h-80 overflow-y-auto">
                                {tasks.map((t) => (
                                    <label
                                        key={t.id}
                                        className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer hover:bg-slate-50 ${selectedTaskIds.has(t.id) ? 'bg-indigo-50' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedTaskIds.has(t.id)}
                                            onChange={() => setSelectedTaskIds(toggleInSet(selectedTaskIds, t.id))}
                                            className="mt-0.5"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-slate-800 truncate">{t.title}</div>
                                            <div className="text-xs text-slate-500">
                                                {t.priority && <span className="mr-2">P: {t.priority}</span>}
                                                {t.estimated_minutes != null && <span className="mr-2">~{t.estimated_minutes}min</span>}
                                                {t.average_minutes != null && <span className="mr-2">avg {t.average_minutes}min</span>}
                                                {t.recurrence && t.recurrence !== 'none' && <span className="text-amber-600">↻ {t.recurrence}</span>}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </Section>

                    <Section title={`Active activities — pick ≥ 2 (${selectedActivityIds.size} selected)`}>
                        {activities.length === 0 ? (
                            <p className="text-sm text-slate-500">No health-category activity templates. Add some in Planning Settings first.</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {activities.map((a) => (
                                    <label
                                        key={a.id}
                                        className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer ${selectedActivityIds.has(a.id) ? 'bg-emerald-50 border-emerald-300' : 'border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedActivityIds.has(a.id)}
                                            onChange={() => setSelectedActivityIds(toggleInSet(selectedActivityIds, a.id))}
                                        />
                                        <Dumbbell size={14} className="text-emerald-600" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-slate-800 truncate">
                                                {a.emoji} {a.name}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {(a.average_minutes ?? a.default_minutes) ?? '—'} min
                                            </div>
                                        </div>
                                    </label>
                                ))}
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
                        onClick={handleLoadReview}
                        className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl p-3 font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
                    >
                        <ListChecks size={16} />
                        Open review view
                    </button>
                </div>
            )}

            {step === 'review' && (
                <div className="space-y-5">
                    <Section title="Log actuals for each block">
                        <div className="space-y-3">
                            {reviewBlocks.map((b) => {
                                if (!b.id) return null
                                const actual = actualsByBlock[b.id]
                                return (
                                    <div key={b.id} className={`border rounded-lg p-3 ${b.recurring ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
                                        <div className="flex items-baseline justify-between gap-2 mb-2">
                                            <h4 className="font-semibold text-slate-900 text-sm">
                                                {b.title}
                                                {b.recurring && <span className="ml-2 text-xs text-amber-700">↻ recurring</span>}
                                            </h4>
                                            <span className="text-xs text-slate-500 flex-shrink-0">
                                                {b.start_time} · planned {b.estimated_minutes}min
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <label className="text-xs text-slate-600">
                                                Actual minutes
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={actual?.actual_minutes ?? b.estimated_minutes}
                                                    onChange={(e) =>
                                                        setActualsByBlock((prev) => ({
                                                            ...prev,
                                                            [b.id!]: { ...(prev[b.id!] || { status: 'completed' }), actual_minutes: Number(e.target.value) },
                                                        }))
                                                    }
                                                    className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm"
                                                />
                                            </label>
                                            <label className="text-xs text-slate-600">
                                                Status
                                                <select
                                                    value={actual?.status ?? 'completed'}
                                                    onChange={(e) =>
                                                        setActualsByBlock((prev) => ({
                                                            ...prev,
                                                            [b.id!]: { ...(prev[b.id!] || { actual_minutes: b.estimated_minutes }), status: e.target.value as BlockActual['status'] },
                                                        }))
                                                    }
                                                    className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm"
                                                >
                                                    <option value="completed">Completed</option>
                                                    <option value="skipped">Skipped</option>
                                                    <option value="pending">Pending</option>
                                                </select>
                                            </label>
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
                        <Timer size={16} />
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
