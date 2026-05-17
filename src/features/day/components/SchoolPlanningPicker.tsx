import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Check, ExternalLink, GraduationCap, ListChecks, Plus, Search } from 'lucide-react';
import type { AppRoute } from '../../../constants/routes';
import type { Assignment, AssignmentStatus } from '../../../services/supabase/converters/school';
import { useAssignments } from '../../school/hooks/useAssignments';
import { useClasses } from '../../school/hooks/useClasses';
import { AssignmentForm } from '../../school/components/AssignmentForm';

type Accent = 'amber' | 'indigo';
type AssignmentFilter = 'open' | 'due_soon' | 'overdue' | 'submitted' | 'all';

interface SchoolPlanningPickerProps {
    dateKey: string;
    accent: Accent;
    onNavigate?: (tab: AppRoute) => void;
}

const ACCENTS: Record<Accent, { button: string; soft: string; text: string; ring: string }> = {
    amber: {
        button: 'bg-amber-500 hover:bg-amber-600',
        soft: 'bg-amber-50 border-amber-200',
        text: 'text-amber-700',
        ring: 'focus:ring-amber-300',
    },
    indigo: {
        button: 'bg-indigo-600 hover:bg-indigo-700',
        soft: 'bg-indigo-50 border-indigo-200',
        text: 'text-indigo-700',
        ring: 'focus:ring-indigo-300',
    },
};

const FILTER_LABELS: Record<AssignmentFilter, string> = {
    open: 'Open',
    due_soon: 'Due soon',
    overdue: 'Overdue',
    submitted: 'Submitted',
    all: 'All',
};

const STATUS_LABELS: Record<AssignmentStatus, string> = {
    pending: 'Pending',
    in_progress: 'In progress',
    submitted: 'Submitted',
    graded: 'Graded',
};

function storageKey(dateKey: string): string {
    return `school_planning_picks_${dateKey}`;
}

function readSelected(dateKey: string): string[] {
    try {
        const raw = sessionStorage.getItem(storageKey(dateKey));
        return raw ? JSON.parse(raw) as string[] : [];
    } catch {
        return [];
    }
}

function writeSelected(dateKey: string, ids: string[]) {
    try {
        sessionStorage.setItem(storageKey(dateKey), JSON.stringify(ids));
    } catch {
        // Session storage is a convenience only; school records remain in Supabase.
    }
}

function isDone(assignment: Assignment): boolean {
    return assignment.status === 'submitted' || assignment.status === 'graded';
}

function isDueSoon(assignment: Assignment, now: Date): boolean {
    const deadline = new Date(assignment.deadline);
    const inSevenDays = new Date(now);
    inSevenDays.setDate(now.getDate() + 7);
    return !isDone(assignment) && deadline >= now && deadline <= inSevenDays;
}

function matchesFilter(assignment: Assignment, filter: AssignmentFilter, now: Date): boolean {
    const deadline = new Date(assignment.deadline);
    if (filter === 'all') return true;
    if (filter === 'submitted') return isDone(assignment);
    if (filter === 'overdue') return !isDone(assignment) && deadline < now;
    if (filter === 'due_soon') return isDueSoon(assignment, now);
    return !isDone(assignment);
}

const SchoolPlanningPicker: React.FC<SchoolPlanningPickerProps> = ({ dateKey, accent, onNavigate }) => {
    const cls = ACCENTS[accent];
    const { classes } = useClasses();
    const { assignments, addAssignment, setStatus } = useAssignments();
    const activeClasses = useMemo(() => classes.filter(c => !c.archived), [classes]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [filter, setFilter] = useState<AssignmentFilter>('open');
    const [query, setQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>(() => readSelected(dateKey));
    const [showAssignmentForm, setShowAssignmentForm] = useState(false);

    useEffect(() => {
        writeSelected(dateKey, selectedIds);
    }, [dateKey, selectedIds]);

    const classMap = useMemo(() => new Map(classes.map(c => [c.id, c])), [classes]);
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const now = useMemo(() => new Date(), []);
    const effectiveClassId = selectedClassId || activeClasses[0]?.id || '';

    const visibleAssignments = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        return assignments
            .filter(assignment => !effectiveClassId || assignment.classId === effectiveClassId)
            .filter(assignment => matchesFilter(assignment, filter, now))
            .filter(assignment => {
                if (!normalized) return true;
                const className = classMap.get(assignment.classId)?.name ?? '';
                return `${assignment.title} ${assignment.description ?? ''} ${className}`.toLowerCase().includes(normalized);
            })
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    }, [assignments, classMap, effectiveClassId, filter, now, query]);

    const selectedAssignments = useMemo(
        () => selectedIds
            .map(id => assignments.find(assignment => assignment.id === id))
            .filter((assignment): assignment is Assignment => Boolean(assignment)),
        [assignments, selectedIds]
    );

    const toggleSelected = (assignment: Assignment) => {
        setSelectedIds(prev => prev.includes(assignment.id)
            ? prev.filter(id => id !== assignment.id)
            : [...prev, assignment.id]
        );
    };

    const setAssignmentStatus = async (assignment: Assignment, status: AssignmentStatus) => {
        await setStatus(assignment.id, status);
    };

    const submitAssignment = async (params: {
        classId: string;
        title: string;
        description?: string;
        deadline: string;
        estimatedMinutes?: number;
        status?: AssignmentStatus;
    }) => {
        await addAssignment(params);
        setSelectedClassId(params.classId);
    };

    const openInSchool = () => onNavigate?.('school');

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-semibold text-slate-900">School planning</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Pick a class, review assignments, and keep school deadlines separate from regular tasks.
                    </p>
                </div>
                <button
                    onClick={() => setShowAssignmentForm(true)}
                    disabled={activeClasses.length === 0}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 ${cls.button}`}
                >
                    <Plus size={13} /> Add assignment
                </button>
            </div>

            {activeClasses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    Add a class in School before planning assignments.
                    <button onClick={openInSchool} className={`ml-2 font-medium ${cls.text}`}>Open School</button>
                </div>
            ) : (
                <>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {activeClasses.map(schoolClass => {
                            const active = effectiveClassId === schoolClass.id;
                            const openCount = assignments.filter(a => a.classId === schoolClass.id && !isDone(a)).length;
                            return (
                                <button
                                    key={schoolClass.id}
                                    onClick={() => setSelectedClassId(schoolClass.id)}
                                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium whitespace-nowrap ${
                                        active ? cls.soft : 'border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: schoolClass.color }} />
                                    {schoolClass.name}
                                    <span className="text-slate-400">{openCount}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                        <label className="relative block">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search assignments"
                                className={`w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 ${cls.ring}`}
                            />
                        </label>
                        <select
                            value={filter}
                            onChange={e => setFilter(e.target.value as AssignmentFilter)}
                            className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs bg-white"
                        >
                            {Object.entries(FILTER_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {selectedAssignments.length > 0 && (
                        <section className={`rounded-xl border p-3 space-y-2 ${cls.soft}`}>
                            <p className={`text-xs font-semibold ${cls.text}`}>Today's school focus</p>
                            <ul className="space-y-1.5">
                                {selectedAssignments.map(assignment => {
                                    const schoolClass = classMap.get(assignment.classId);
                                    return (
                                        <li key={assignment.id} className="flex items-center gap-2 text-xs text-slate-700">
                                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: schoolClass?.color ?? '#6366f1' }} />
                                            <span className="min-w-0 flex-1 truncate">{assignment.title}</span>
                                            <span className="text-slate-500">{schoolClass?.name}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}

                    {visibleAssignments.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
                            No assignments match this class and filter.
                        </div>
                    ) : (
                        <ul className="max-h-72 space-y-2 overflow-y-auto">
                            {visibleAssignments.map(assignment => {
                                const schoolClass = classMap.get(assignment.classId);
                                const selected = selectedSet.has(assignment.id);
                                const done = isDone(assignment);
                                const deadline = new Date(assignment.deadline);
                                const overdue = !done && deadline < now;
                                return (
                                    <li key={assignment.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                        <div className="flex items-start gap-3">
                                            <button
                                                onClick={() => toggleSelected(assignment)}
                                                className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                                    selected ? `${cls.button} border-transparent text-white` : 'border-slate-300 bg-white'
                                                }`}
                                                title={selected ? 'Remove from today focus' : 'Add to today focus'}
                                            >
                                                {selected && <Check size={11} />}
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-sm font-medium truncate ${done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                                    {assignment.title}
                                                </p>
                                                <p className="mt-0.5 text-xs text-slate-500 truncate">
                                                    <span style={{ color: schoolClass?.color ?? '#6366f1' }}>{schoolClass?.name ?? 'Class'}</span>
                                                    {' · '}
                                                    <span className={overdue ? 'text-red-600 font-medium' : ''}>
                                                        {format(deadline, 'MMM d, h:mm a')}
                                                    </span>
                                                    {assignment.estimatedMinutes && ` · ${assignment.estimatedMinutes}m`}
                                                    {assignment.checkpoints?.length ? ` · ${assignment.checkpoints.length} steps` : ''}
                                                </p>
                                                {assignment.description && (
                                                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{assignment.description}</p>
                                                )}
                                            </div>
                                            {assignment.checkpoints?.length ? <ListChecks size={15} className="mt-1 text-slate-400 flex-shrink-0" /> : <GraduationCap size={15} className="mt-1 text-slate-300 flex-shrink-0" />}
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-8">
                                            <span className="text-[11px] text-slate-400">{STATUS_LABELS[assignment.status]}</span>
                                            <div className="flex items-center gap-1.5">
                                                {!done && assignment.status !== 'in_progress' && (
                                                    <button
                                                        onClick={() => setAssignmentStatus(assignment, 'in_progress')}
                                                        className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-white hover:text-indigo-700"
                                                    >
                                                        Start
                                                    </button>
                                                )}
                                                {!done && (
                                                    <button
                                                        onClick={() => setAssignmentStatus(assignment, 'submitted')}
                                                        className="rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
                                                    >
                                                        Submitted
                                                    </button>
                                                )}
                                                <button
                                                    onClick={openInSchool}
                                                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-white hover:text-slate-800"
                                                >
                                                    <ExternalLink size={11} /> School
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            )}

            {showAssignmentForm && (
                <AssignmentForm
                    classes={activeClasses}
                    defaultClassId={effectiveClassId}
                    onClose={() => setShowAssignmentForm(false)}
                    onSubmit={submitAssignment}
                />
            )}
        </div>
    );
};

export default SchoolPlanningPicker;
