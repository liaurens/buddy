import React from 'react';
import { Bell, CheckSquare, Grid2X2, Home, LayoutGrid, MessageSquare, PlusCircle, Sparkles, User } from 'lucide-react';
import type { AppRoute } from '../constants/routes';
import CaptureFAB from '../components/CaptureFAB';

interface MainLayoutProps {
    children: React.ReactNode;
    activeTab: AppRoute;
    setActiveTab: (tab: AppRoute) => void;
}

const TABS: Array<{ key: AppRoute; label: string; Icon: typeof Home }> = [
    { key: 'home', label: 'Now', Icon: Home },
    { key: 'tasks', label: 'Tasks', Icon: CheckSquare },
    { key: 'assistant', label: 'Capture', Icon: MessageSquare },
    { key: 'browse', label: 'Browse', Icon: LayoutGrid },
    { key: 'me', label: 'Me', Icon: User },
];

const MainLayout: React.FC<MainLayoutProps> = ({ children, activeTab, setActiveTab }) => {
    const isActiveTab = (key: AppRoute) => activeTab === key || (key === 'me' && activeTab === 'account');
    const mobileTitle: Partial<Record<AppRoute, string>> = {
        home: 'Buddy',
        tasks: 'Tasks',
        browse: 'Browse',
        assistant: 'Capture',
        me: 'Me',
        today: 'Today',
        calendar: 'Calendar',
        school: 'School',
        notes: 'Notes',
        checklists: 'Checklists',
        toolbox: 'Toolbox',
        growth: 'Growth',
        health: 'Health',
        protocols: 'Protocols',
        experiments: 'Experiments',
        notifications: 'Notifications',
        focus: 'Focus',
        reflection: 'Reflect',
        account: 'Account',
    };

    return (
        <div className="min-h-screen text-slate-950">
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200/80 bg-white/85 px-4 py-5 shadow-[10px_0_30px_rgba(15,23,42,0.03)] backdrop-blur-xl lg:flex lg:flex-col">
                <div className="mb-8 flex items-center gap-3 px-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700">
                        <MessageSquare size={19} />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold leading-tight text-slate-950">Buddy</h1>
                        <p className="text-xs text-slate-500">Capture, plan, reflect</p>
                    </div>
                </div>

                <nav className="space-y-1">
                    {TABS.map(({ key, label, Icon }) => {
                        const active = isActiveTab(key);
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                                    active
                                        ? 'bg-indigo-50 text-indigo-800'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                                }`}
                            >
                                <Icon size={19} />
                                <span>{label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <p className="text-xs font-medium leading-5 text-slate-500">
                        Use Capture for brain dumps, tasks, notes, reminders, school, and health logs.
                    </p>
                </div>
            </aside>

            <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
                <div className="mx-auto grid max-w-2xl grid-cols-[44px_1fr_44px] items-center px-4 py-3">
                    <button
                        onClick={() => setActiveTab('home')}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-indigo-800 transition-colors hover:bg-indigo-50"
                        aria-label="Go to Now"
                    >
                        <Sparkles size={21} />
                    </button>
                    <h1 className="min-w-0 justify-self-center truncate text-center text-lg font-semibold text-slate-950">
                        {mobileTitle[activeTab] ?? 'Buddy'}
                    </h1>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className="flex h-10 w-10 items-center justify-center justify-self-end rounded-xl text-slate-700 transition-colors hover:bg-slate-100"
                        aria-label="Notifications"
                    >
                        <Bell size={20} />
                    </button>
                </div>
            </header>

            <main className="px-4 py-5 sm:px-6 lg:ml-64 lg:px-8 lg:py-8 xl:px-10">
                {children}
            </main>

            <CaptureFAB activeTab={activeTab} onNavigate={setActiveTab} />

            <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200/80 bg-white/90 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
                <div className="mx-auto flex h-[4.5rem] max-w-2xl items-center justify-around gap-1">
                    {TABS.map(({ key, label, Icon }) => {
                        const isActive = isActiveTab(key);
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                aria-current={isActive ? 'page' : undefined}
                                className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition-colors ${
                                    isActive ? 'bg-indigo-50 text-indigo-800' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {key === 'assistant' ? <PlusCircle size={23} /> : key === 'browse' ? <Grid2X2 size={22} /> : <Icon size={22} />}
                                <span>{label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default MainLayout;
