import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
    Activity,
    Calendar,
    CheckSquare,
    FlaskConical,
    Heart,
    ListChecks,
    Pill,
    StickyNote,
    Timer,
    TrendingUp,
    Wrench,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { getCategorySettings } from '../../../services/settings';
import type { AppRoute } from '../../../constants/routes';
import AccountPage from '../../core/pages/AccountPage';
import CommsSettingsModal from '../../day/components/CommsSettingsModal';
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
import { Fold } from '../../cove/components';

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

interface MePageProps {
    onNavigate?: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const Row: React.FC<{ label: string; value?: string; onClick?: () => void }> = ({
    label,
    value,
    onClick,
}) => (
    <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-[15px] text-left text-sm font-extrabold text-cove-ink shadow-[0_3px_12px_rgba(40,90,130,0.07)]"
    >
        {label}
        <span
            className="text-[13px] font-bold"
            style={{ color: value === 'connected' ? '#5cb586' : '#9cb9c9' }}
        >
            {value ?? '›'}
        </span>
    </button>
);

/** Me — profile + quiet settings. No badges or counts anywhere. */
const MePage: React.FC<MePageProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const [openKey, setOpenKey] = useState<SettingsKey | null>(null);
    const [showComms, setShowComms] = useState(false);
    const ActiveModal = openKey ? SETTINGS_REGISTRY.find((s) => s.key === openKey)?.Modal : null;

    const name = user?.email ? user.email.split('@')[0] : 'you';
    const initial = name.charAt(0).toUpperCase();
    const since = user?.created_at ? format(new Date(user.created_at), 'MMMM yyyy') : null;

    const quietHours = useQuery({
        queryKey: ['me-quiet-hours', user?.id],
        enabled: !!user?.id,
        staleTime: 60_000,
        queryFn: async () => {
            const s = await getCategorySettings(user!.id, 'notifications');
            return s.quietHoursEnabled ? `${s.quietHoursStart} – ${s.quietHoursEnd}` : 'off';
        },
    });

    return (
        <div className="cove-fadeslide flex flex-col">
            <div className="px-1 pb-[18px] pt-1.5 text-[22px] font-black text-cove-ink">Me</div>

            <div className="flex items-center gap-3.5 rounded-card-xl bg-white p-[18px] shadow-cove">
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-cove-accent text-xl font-black text-white">
                    {initial}
                </span>
                <span>
                    <span className="block text-base font-black text-cove-ink">{name}</span>
                    <span className="block text-[12.5px] font-bold text-cove-soft">
                        {since ? `swimming with Buddy since ${since}` : 'swimming with Buddy'}
                    </span>
                </span>
            </div>

            <div className="mt-3.5 flex flex-col gap-2">
                <Row
                    label="Notifications & anchors"
                    onClick={() => onNavigate?.('notifications')}
                />
                <Row
                    label="Quiet hours"
                    value={quietHours.data ?? '…'}
                    onClick={() => onNavigate?.('notifications')}
                />
                <Row label="Morning comms checklist" onClick={() => setShowComms(true)} />
                <Row label="Google Calendar" onClick={() => onNavigate?.('calendar')} />
            </div>

            <Fold label="Feature settings" className="mt-4">
                <div className="flex flex-col gap-2">
                    {SETTINGS_REGISTRY.map(({ key, label, Icon }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setOpenKey(key)}
                            className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left text-sm font-extrabold text-cove-ink shadow-[0_3px_12px_rgba(40,90,130,0.07)]"
                        >
                            <Icon size={16} className="text-cove-soft" />
                            <span className="flex-1">{label}</span>
                            <span className="text-cove-faint">›</span>
                        </button>
                    ))}
                </div>
            </Fold>

            <Fold label="Account & advanced" className="mt-1">
                <div className="flex flex-col gap-2">
                    <Row
                        label="Assistant chat (power tool)"
                        onClick={() => onNavigate?.('assistant')}
                    />
                    <div className="rounded-card-lg bg-white p-1 shadow-cove">
                        <AccountPage embedded />
                    </div>
                </div>
            </Fold>

            {ActiveModal && <ActiveModal isOpen={true} onClose={() => setOpenKey(null)} />}
            {showComms ? (
                <CommsSettingsModal
                    onClose={() => setShowComms(false)}
                    onSaved={() => setShowComms(false)}
                />
            ) : null}
        </div>
    );
};

export default MePage;
