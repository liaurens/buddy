import React, { useState } from 'react';
import { format } from 'date-fns';
import { Bell, Search, Sun } from 'lucide-react';
import type { AppRoute } from '../../../constants/routes';
import { useAuth } from '../../../hooks/useAuth';
import NotificationPermissionPrompt from '../../../components/notifications/NotificationPermissionPrompt';
import AssistantPromptBar from '../../assistant/components/AssistantPromptBar';
import DailyRoutineCard from '../components/DailyRoutineCard';
import NextUpCard from '../components/NextUpCard';
import UrgentInboxCard from '../components/UrgentInboxCard';
import TodayCard from '../components/TodayCard';
import InsightCard from '../components/InsightCard';

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
        try { return localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === '1'; } catch { return true; }
    });
    const dismissPushPrompt = () => {
        setPushPromptDismissed(true);
        try { localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, '1'); } catch { /* ignore */ }
    };

    return (
        <div className="mx-auto w-full max-w-7xl space-y-5 pb-28 lg:space-y-7 lg:pb-10">
            <header className="flex items-start justify-between gap-4 pt-1">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h1 className="app-title truncate">
                            {format(today, 'EEEE, MMMM d')}
                        </h1>
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

            <AssistantPromptBar onNavigate={onNavigate} />

            {user && !pushPromptDismissed && (
                <NotificationPermissionPrompt userId={user.id} onClose={dismissPushPrompt} />
            )}

            <UrgentInboxCard onNavigate={onNavigate} />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)] lg:items-start lg:gap-6">
                <section className="space-y-5">
                    <NextUpCard onNavigate={onNavigate} />

                    <div className="hidden lg:block">
                        <InsightCard />
                    </div>
                </section>

                <aside className="space-y-5 lg:sticky lg:top-8">
                    <DailyRoutineCard onNavigate={onNavigate} />

                    <TodayCard onNavigate={onNavigate} />

                    <div className="lg:hidden">
                        <InsightCard />
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default HomePage;
