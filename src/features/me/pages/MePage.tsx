import React, { useState } from 'react';
import {
    Activity,
    Pill,
    FlaskConical,
    Heart,
    StickyNote,
    Calendar,
    TrendingUp,
    CheckSquare,
    Timer,
    Wrench,
    ListChecks,
    Settings as SettingsIcon,
    ChevronRight,
} from 'lucide-react';
import AccountPage from '../../core/pages/AccountPage';
import TrackerSettingsModal from '../../health-tracking/components/tracker/TrackerSettingsModal';
import ProtocolSettingsModal from '../../health-tracking/components/protocols/ProtocolSettingsModal';
import ExperimentSettingsModal from '../../health-tracking/components/experiments/ExperimentSettingsModal';
import CheckInSettingsModal from '../../health-tracking/components/checkin/CheckInSettingsModal';
import NoteSettingsModal from '../../tasks/components/notes/NoteSettingsModal';
import CalendarSettingsModal from '../../planning/components/calendar/CalendarSettingsModal';
import ReflectionSettingsModal from '../../planning/components/reflection/ReflectionSettingsModal';
import TaskSettingsModal from '../../tasks/components/TaskSettingsModal';
import PomodoroSettingsModal from '../../focus/components/PomodoroSettingsModal';
import ToolboxSettingsModal from '../../toolbox/components/ToolboxSettingsModal';
import ChecklistSettingsModal from '../../checklists/components/ChecklistSettingsModal';

type SettingsKey =
    | 'health'
    | 'protocols'
    | 'experiments'
    | 'check-in'
    | 'notes'
    | 'calendar'
    | 'reflection'
    | 'tasks'
    | 'focus'
    | 'toolbox'
    | 'checklists';

type ModalProps = { isOpen: boolean; onClose: () => void };

const SETTINGS_REGISTRY: Array<{
    key: SettingsKey;
    label: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    Modal: React.ComponentType<ModalProps>;
}> = [
    { key: 'tasks', label: 'Tasks', Icon: CheckSquare, Modal: TaskSettingsModal },
    { key: 'notes', label: 'Notes', Icon: StickyNote, Modal: NoteSettingsModal },
    { key: 'checklists', label: 'Checklists', Icon: ListChecks, Modal: ChecklistSettingsModal },
    { key: 'health', label: 'Health Trackers', Icon: Activity, Modal: TrackerSettingsModal },
    { key: 'check-in', label: 'Check-in', Icon: Heart, Modal: CheckInSettingsModal },
    { key: 'protocols', label: 'Protocols', Icon: Pill, Modal: ProtocolSettingsModal },
    {
        key: 'experiments',
        label: 'Experiments',
        Icon: FlaskConical,
        Modal: ExperimentSettingsModal,
    },
    { key: 'calendar', label: 'Calendar', Icon: Calendar, Modal: CalendarSettingsModal },
    { key: 'reflection', label: 'Reflection', Icon: TrendingUp, Modal: ReflectionSettingsModal },
    { key: 'focus', label: 'Focus Timer', Icon: Timer, Modal: PomodoroSettingsModal },
    { key: 'toolbox', label: 'Toolbox', Icon: Wrench, Modal: ToolboxSettingsModal },
];

const MePage: React.FC = () => {
    const [openKey, setOpenKey] = useState<SettingsKey | null>(null);
    const ActiveModal = openKey ? SETTINGS_REGISTRY.find((s) => s.key === openKey)?.Modal : null;

    return (
        <div className="app-page">
            <header className="hidden items-center gap-3 lg:flex">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-700">
                    <SettingsIcon size={24} />
                </div>
                <div>
                    <h1 className="app-title">Me</h1>
                    <p className="app-subtitle">Settings, account, notifications, and data.</p>
                </div>
            </header>

            <div className="grid gap-5 lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start">
                {/* Feature Settings - single destination for all per-feature settings */}
                <section className="app-surface overflow-hidden lg:sticky lg:top-8">
                    <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                        <h2 className="text-sm font-semibold text-slate-800">Feature settings</h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {SETTINGS_REGISTRY.map(({ key, label, Icon }) => (
                            <button key={key} onClick={() => setOpenKey(key)} className="app-row">
                                <Icon size={18} className="text-slate-500" />
                                <span className="flex-1 text-sm text-slate-700">{label}</span>
                                <ChevronRight size={16} className="text-slate-400" />
                            </button>
                        ))}
                    </div>
                </section>

                {/* Account, AI provider, notifications, API key, dev panel, data management */}
                <AccountPage embedded />
            </div>

            {ActiveModal && <ActiveModal isOpen={true} onClose={() => setOpenKey(null)} />}
        </div>
    );
};

export default MePage;
