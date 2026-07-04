import React, { useState } from 'react';
import { format } from 'date-fns';
import { Bell, ChevronDown, ChevronUp, Search, Sun } from 'lucide-react';
import type { AppRoute } from '../../../constants/routes';
import { useAuth } from '../../../hooks/useAuth';
import NotificationPermissionPrompt from '../../../components/notifications/NotificationPermissionPrompt';
import AssistantPromptBar from '../../assistant/components/AssistantPromptBar';
import DailyRoutineCard from '../components/DailyRoutineCard';
import TriageInboxCard from '../components/TriageInboxCard';
import TodayCard from '../components/TodayCard';
import TodayFocusCard from '../components/TodayFocusCard';

interface HomePageProps {
    onNavigate: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const PUSH_PROMPT_DISMISSED_KEY = 'push_prompt_dismissed';

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
    const today = new Date();
    const hour = today.getHours();
    const greeting = hour < 11 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const { user } = useAuth();

    // One-time push permission prompt; hides itself once subscribed, and stays
    // away after an explicit dismiss.
    const [pushPromptDismissed, setPushPromptDismissed] = useState(() => {
        try {
            return localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === '1';
        } catch {
            return true;
        }
    });
    const dismissPushPrompt = () => {
        setPushPromptDismissed(true);
        try {
            localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, '1');
        } catch {
            /* ignore */
        }
    };

    // Everything that isn't picks/capture/close-day lives behind a fold —
    // visible-but-unused surfaces are demand load, not neutral.
    const [showMore, setShowMore] = useState(false);

    return (
        <div className="mx-auto w-full max-w-7xl space-y-5 pb-28 lg:space-y-7 lg:pb-10">
            <header className="flex items-start justify-between gap-4 pt-1">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h1 className="app-title truncate">{format(today, 'EEEE, MMMM d')}</h1>
                        <Sun size={23} className="hidden text-slate-400 sm:block" />
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600 sm:text-base">
                        {greeting}.
                    </p>
                </div>

                <div className="hidden shrink-0 items-center gap-2 lg:flex">
                    <button
                        type="button"
                        onClick={() => onNavigate('browse')}
                        className="app-icon-button"
                        aria-label="Search and browse"
                    >
                        <Search size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate('notifications')}
                        className="app-icon-button"
                        aria-label="Notifications"
                    >
                        <Bell size={18} />
                    </button>
                </div>
            </header>

            <AssistantPromptBar onNavigate={onNavigate} compact />

            {user && !pushPromptDismissed && (
                <NotificationPermissionPrompt userId={user.id} onClose={dismissPushPrompt} />
            )}

            {/* Three-touch home: today's picks lead (done/snooze/split + evening
                close-day), the capture bar sits above, and the inbox surfaces only
                when it has items. Everything else folds. */}
            <div className="mx-auto max-w-3xl space-y-5">
                <TodayFocusCard onNavigate={onNavigate} />

                <TriageInboxCard />

                <button
                    type="button"
                    onClick={() => setShowMore((v) => !v)}
                    className="flex w-full items-center justify-center gap-1 py-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
                >
                    {showMore ? (
                        <>Less <ChevronUp size={14} /></>
                    ) : (
                        <>More — routine & stats <ChevronDown size={14} /></>
                    )}
                </button>

                {showMore && (
                    <div className="space-y-5">
                        <DailyRoutineCard onNavigate={onNavigate} />
                        <TodayCard onNavigate={onNavigate} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomePage;
