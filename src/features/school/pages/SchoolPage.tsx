import React, { useState } from 'react';
import { AlertTriangle, CalendarCheck, CalendarDays, CheckSquare, Clock, GraduationCap, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useClasses } from '../hooks/useClasses';
import { useAssignments } from '../hooks/useAssignments';
import { useClassSessions } from '../hooks/useClassSessions';
import { ClassForm } from '../components/ClassForm';
import { AssignmentForm } from '../components/AssignmentForm';
import { SessionForm } from '../components/SessionForm';
import { DeadlineList } from '../components/DeadlineList';
import { ClassList } from '../components/ClassList';
import { WeeklyScheduleGrid } from '../components/WeeklyScheduleGrid';
import { CheckpointPanel } from '../components/CheckpointPanel';
import type { Assignment, SchoolClass, CheckpointItem, ClassSession } from '../../../services/supabase/converters/school';

type SchoolTab = 'deadlines' | 'classes' | 'schedule';

const TABS: Array<{ id: SchoolTab; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = [
    { id: 'deadlines', label: 'Tasks', Icon: CheckSquare },
    { id: 'classes', label: 'Classes', Icon: GraduationCap },
    { id: 'schedule', label: 'Schedule', Icon: CalendarDays },
];

function assignmentDone(a: Assignment): boolean {
    return a.status === 'submitted' || a.status === 'graded';
}

function getNextOpenAssignment(assignments: Assignment[]): Assignment | undefined {
    const now = new Date();
    return assignments
        .filter(a => !assignmentDone(a) && new Date(a.deadline) >= now)
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0];
}

function getNextSession(sessions: ClassSession[]): ClassSession | undefined {
    const now = new Date();
    const today = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return sessions
        .map(session => {
            const dayOffset = (session.dayOfWeek - today + 7) % 7;
            const adjustedOffset = dayOffset === 0 && session.startTime < currentTime ? 7 : dayOffset;
            return { session, adjustedOffset };
        })
        .sort((a, b) => a.adjustedOffset - b.adjustedOffset || a.session.startTime.localeCompare(b.session.startTime))[0]?.session;
}

interface SchoolFocusRailProps {
    assignments: Assignment[];
    classes: SchoolClass[];
    sessions: ClassSession[];
}

const SchoolFocusRail: React.FC<SchoolFocusRailProps> = ({ assignments, classes, sessions }) => {
    const now = new Date();
    const classMap = new Map(classes.map(c => [c.id, c]));
    const open = assignments.filter(a => !assignmentDone(a));
    const overdue = open.filter(a => new Date(a.deadline) < now);
    const dueSoonLimit = new Date(now);
    dueSoonLimit.setDate(now.getDate() + 7);
    const dueSoon = open.filter(a => {
        const deadline = new Date(a.deadline);
        return deadline >= now && deadline <= dueSoonLimit;
    });
    const submitted = assignments.filter(assignmentDone);
    const nextAssignment = getNextOpenAssignment(assignments);
    const nextSession = getNextSession(sessions);
    const nextSessionClass = nextSession ? classMap.get(nextSession.classId) : undefined;
    const mostLoadedClasses = classes
        .filter(c => !c.archived)
        .map(c => ({
            classItem: c,
            openCount: open.filter(a => a.classId === c.id).length,
            overdueCount: overdue.filter(a => a.classId === c.id).length,
        }))
        .sort((a, b) => b.openCount - a.openCount || b.overdueCount - a.overdueCount)
        .slice(0, 3);

    return (
        <aside className="space-y-4">
            <section className="app-surface p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-950">Today focus</h2>
                        <p className="mt-1 text-sm leading-5 text-slate-500">What needs attention first.</p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                        <CalendarCheck size={19} />
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                        <p className="text-2xl font-semibold leading-none text-slate-950">{open.length}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">Open</p>
                    </div>
                    <div className="rounded-xl border border-red-100 bg-red-50/70 p-3">
                        <p className="text-2xl font-semibold leading-none text-red-700">{overdue.length}</p>
                        <p className="mt-1 text-xs font-medium text-red-700">Overdue</p>
                    </div>
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
                        <p className="text-2xl font-semibold leading-none text-indigo-800">{dueSoon.length}</p>
                        <p className="mt-1 text-xs font-medium text-indigo-700">Due soon</p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                        <p className="text-2xl font-semibold leading-none text-emerald-700">{submitted.length}</p>
                        <p className="mt-1 text-xs font-medium text-emerald-700">Submitted</p>
                    </div>
                </div>
            </section>

            <section className="app-surface p-4">
                <h2 className="text-sm font-semibold text-slate-950">Next up</h2>
                {nextAssignment ? (
                    <div className="mt-3 rounded-xl border border-slate-200/80 bg-white p-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
                            <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: classMap.get(nextAssignment.classId)?.color ?? '#64748b' }}
                            />
                            <span className="min-w-0 truncate">{nextAssignment.title}</span>
                        </div>
                        <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                            <Clock size={15} className="text-slate-400" />
                            {format(new Date(nextAssignment.deadline), 'EEE, MMM d, h:mm a')}
                        </p>
                    </div>
                ) : (
                    <p className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-sm text-slate-500">
                        No upcoming open school tasks.
                    </p>
                )}

                <div className="mt-4 border-t border-slate-100 pt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next class</h3>
                    {nextSession ? (
                        <div className="mt-2 flex items-start gap-3">
                            <span
                                className="mt-1 h-9 w-1.5 rounded-full"
                                style={{ backgroundColor: nextSessionClass?.color ?? '#64748b' }}
                            />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{nextSessionClass?.name ?? 'Unknown class'}</p>
                                <p className="mt-0.5 text-sm text-slate-500">
                                    {nextSession.startTime.slice(0, 5)} - {nextSession.endTime.slice(0, 5)}
                                    {nextSession.location ? ` · ${nextSession.location}` : ''}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-2 text-sm text-slate-500">No class times scheduled.</p>
                    )}
                </div>
            </section>

            <section className="app-surface p-4">
                <h2 className="text-sm font-semibold text-slate-950">Class load</h2>
                <div className="mt-3 space-y-2">
                    {mostLoadedClasses.length === 0 ? (
                        <p className="text-sm text-slate-500">Add classes to see a lighter course snapshot here.</p>
                    ) : mostLoadedClasses.map(({ classItem, openCount, overdueCount }) => (
                        <div key={classItem.id} className="flex items-center gap-3 rounded-xl border border-slate-200/80 px-3 py-2.5">
                            <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: classItem.color }} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-slate-900">{classItem.name}</p>
                                <p className="text-xs text-slate-500">
                                    {openCount} open{overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
                                </p>
                            </div>
                            {overdueCount > 0 && <AlertTriangle size={16} className="text-red-500" />}
                        </div>
                    ))}
                </div>
            </section>
        </aside>
    );
};

const SchoolPage: React.FC = () => {
    const [tab, setTab] = useState<SchoolTab>('deadlines');
    const { classes, addClass, updateClass, deleteClass } = useClasses(true);
    const { assignments, addAssignment, updateAssignment, setStatus, deleteAssignment } = useAssignments();
    const { sessions, addSession, deleteSession } = useClassSessions();

    const [showClassForm, setShowClassForm] = useState(false);
    const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
    const [showAssignmentForm, setShowAssignmentForm] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
    const [defaultAssignmentClassId, setDefaultAssignmentClassId] = useState<string | undefined>();
    const [showSessionForm, setShowSessionForm] = useState(false);
    const [checkpointAssignment, setCheckpointAssignment] = useState<Assignment | null>(null);

    const activeClasses = classes.filter(c => !c.archived);
    const openAssignments = assignments.filter(a => !assignmentDone(a));
    const overdueAssignments = openAssignments.filter(a => new Date(a.deadline) < new Date());

    const handleAddPrimary = () => {
        if (tab === 'deadlines') {
            if (activeClasses.length === 0) {
                setEditingClass(null);
                setShowClassForm(true);
            } else {
                setEditingAssignment(null);
                setShowAssignmentForm(true);
            }
        } else if (tab === 'classes') {
            setEditingClass(null);
            setShowClassForm(true);
        } else {
            if (activeClasses.length === 0) {
                setEditingClass(null);
                setShowClassForm(true);
            } else {
                setShowSessionForm(true);
            }
        }
    };

    return (
        <div className="app-page max-w-7xl space-y-6">
            <header className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600">
                        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-indigo-800">
                            <GraduationCap size={15} />
                            {activeClasses.length} active classes
                        </span>
                        {overdueAssignments.length > 0 && (
                            <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-red-700">
                                <AlertTriangle size={15} />
                                {overdueAssignments.length} overdue
                            </span>
                        )}
                    </div>
                    <h1 className="text-3xl font-semibold leading-tight tracking-normal text-slate-950">School</h1>
                    <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
                        Classes, school tasks, hard deadlines, and weekly schedule in one calmer view.
                    </p>
                </div>
                <button onClick={handleAddPrimary}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:opacity-45">
                    <Plus size={16} /> Add
                </button>
            </header>

            <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1">
                {TABS.map(({ id, label, Icon }) => (
                    <button key={id} onClick={() => setTab(id)}
                        className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 ${
                            tab === id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}>
                        <Icon size={16} /> {label}
                    </button>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
                <section className="min-w-0">
                    {tab === 'deadlines' && (
                        <DeadlineList
                            assignments={assignments}
                            classes={classes}
                            onEdit={a => { setEditingAssignment(a); setShowAssignmentForm(true); }}
                            onComplete={a => setStatus(a.id, 'submitted')}
                            onDelete={a => {
                                if (confirm(`Delete "${a.title}"?`)) deleteAssignment(a.id);
                            }}
                            onCheckpoints={a => setCheckpointAssignment(a)}
                        />
                    )}

                    {tab === 'classes' && (
                        <ClassList
                            classes={classes}
                            assignments={assignments}
                            onEdit={c => { setEditingClass(c); setShowClassForm(true); }}
                            onArchive={c => updateClass(c.id, { archived: !c.archived })}
                            onDelete={c => {
                                if (confirm(`Delete "${c.name}" and all its school tasks, deadlines, class times, and uploaded PDFs?`)) deleteClass(c.id);
                            }}
                            onAddAssignment={classId => {
                                setEditingAssignment(null);
                                setDefaultAssignmentClassId(classId);
                                setShowAssignmentForm(true);
                            }}
                            onEditAssignment={a => { setEditingAssignment(a); setDefaultAssignmentClassId(undefined); setShowAssignmentForm(true); }}
                            onCompleteAssignment={a => setStatus(a.id, 'submitted')}
                        />
                    )}

                    {tab === 'schedule' && (
                        <WeeklyScheduleGrid
                            sessions={sessions}
                            classes={classes}
                            onDelete={s => {
                                if (confirm('Remove this class time?')) deleteSession(s.id);
                            }}
                        />
                    )}
                </section>

                <div className="lg:sticky lg:top-8">
                    <SchoolFocusRail assignments={assignments} classes={classes} sessions={sessions} />
                </div>
            </div>

            {showClassForm && (
                <ClassForm
                    initial={editingClass}
                    onClose={() => { setShowClassForm(false); setEditingClass(null); }}
                    onSubmit={async params => {
                        if (editingClass) await updateClass(editingClass.id, params);
                        else await addClass(params);
                    }}
                />
            )}

            {showAssignmentForm && (
                <AssignmentForm
                    initial={editingAssignment}
                    classes={activeClasses}
                    defaultClassId={editingAssignment ? undefined : defaultAssignmentClassId}
                    onClose={() => {
                        setShowAssignmentForm(false);
                        setEditingAssignment(null);
                        setDefaultAssignmentClassId(undefined);
                    }}
                    onSubmit={async params => {
                        if (editingAssignment) await updateAssignment(editingAssignment.id, params);
                        else await addAssignment(params);
                    }}
                />
            )}

            {showSessionForm && (
                <SessionForm
                    classes={activeClasses}
                    onClose={() => setShowSessionForm(false)}
                    onSubmit={addSession}
                />
            )}

            {checkpointAssignment && (
                <CheckpointPanel
                    assignment={checkpointAssignment}
                    onClose={() => setCheckpointAssignment(null)}
                    onSave={async (checkpoints: CheckpointItem[]) => {
                        await updateAssignment(checkpointAssignment.id, { checkpoints });
                        setCheckpointAssignment(null);
                    }}
                />
            )}
        </div>
    );
};

export default SchoolPage;
