import React, { useState } from 'react';
import { CalendarClock, GraduationCap, CalendarDays, Plus } from 'lucide-react';
import { useClasses } from '../hooks/useClasses';
import { useAssignments } from '../hooks/useAssignments';
import { useClassSessions } from '../hooks/useClassSessions';
import { ClassForm } from '../components/ClassForm';
import { AssignmentForm } from '../components/AssignmentForm';
import { SessionForm } from '../components/SessionForm';
import { DeadlineList } from '../components/DeadlineList';
import { ClassList } from '../components/ClassList';
import { WeeklyScheduleGrid } from '../components/WeeklyScheduleGrid';
import type { Assignment, SchoolClass } from '../../../services/supabase/converters/school';

type SchoolTab = 'deadlines' | 'classes' | 'schedule';

const TABS: Array<{ id: SchoolTab; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = [
    { id: 'deadlines', label: 'Deadlines', Icon: CalendarClock },
    { id: 'classes', label: 'Classes', Icon: GraduationCap },
    { id: 'schedule', label: 'Schedule', Icon: CalendarDays },
];

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

    const activeClasses = classes.filter(c => !c.archived);

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
        <div className="max-w-3xl mx-auto pb-24 px-4 md:px-0 space-y-5">
            <header className="pt-2 flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">School</h1>
                    <p className="text-sm text-slate-500">Classes, deadlines, and weekly schedule.</p>
                </div>
                <button onClick={handleAddPrimary}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
                    <Plus size={16} /> Add
                </button>
            </header>

            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                {TABS.map(({ id, label, Icon }) => (
                    <button key={id} onClick={() => setTab(id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}>
                        <Icon size={16} /> {label}
                    </button>
                ))}
            </div>

            {tab === 'deadlines' && (
                <DeadlineList
                    assignments={assignments}
                    classes={classes}
                    onEdit={a => { setEditingAssignment(a); setShowAssignmentForm(true); }}
                    onComplete={a => setStatus(a.id, 'submitted')}
                    onDelete={a => {
                        if (confirm(`Delete "${a.title}"?`)) deleteAssignment(a.id);
                    }}
                />
            )}

            {tab === 'classes' && (
                <ClassList
                    classes={classes}
                    assignments={assignments}
                    onEdit={c => { setEditingClass(c); setShowClassForm(true); }}
                    onArchive={c => updateClass(c.id, { archived: !c.archived })}
                    onDelete={c => {
                        if (confirm(`Delete "${c.name}" and all its assignments and class times?`)) deleteClass(c.id);
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
        </div>
    );
};

export default SchoolPage;
