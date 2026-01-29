import React from 'react';
import { Settings, CheckSquare, Activity, Pill, FlaskConical, Calendar, TrendingUp, CalendarClock, StickyNote, ListChecks } from 'lucide-react';

type AppRoute = 'home' | 'health' | 'protocols' | 'experiments' | 'check-in' | 'planning' | 'calendar' | 'reflection' | 'tasks' | 'notes' | 'checklists' | 'toolbox' | 'focus' | 'account';

interface MainLayoutProps {
    children: React.ReactNode;
    activeTab: AppRoute;
    setActiveTab: (tab: AppRoute) => void;
    onSettingsClick: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, activeTab, setActiveTab, onSettingsClick }) => {
    // Determine hub context
    const getHubContext = () => {
        if (['health', 'protocols', 'experiments'].includes(activeTab)) {
            return { name: 'Health Hub', tab: activeTab };
        }
        if (['calendar', 'planning', 'reflection'].includes(activeTab)) {
            return { name: 'Calendar Hub', tab: activeTab };
        }
        if (['tasks', 'checklists'].includes(activeTab)) {
            return { name: 'Tasks Hub', tab: activeTab };
        }
        if (activeTab === 'notes') {
            return { name: 'Notebook', tab: activeTab };
        }
        return null;
    };

    const hubContext = getHubContext();

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-md mx-auto px-4 py-4">
                    {/* Breadcrumb when in hub */}
                    {hubContext && (
                        <div className="text-xs text-slate-500 mb-1 font-medium">
                            {hubContext.name} › {activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ')}
                        </div>
                    )}
                    <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                        Correlate Tracker
                    </h1>
                </div>
            </header>

            <main className="max-w-md mx-auto px-4 py-6">
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 z-20 safe-area-inset-bottom">
                <div className="flex justify-around items-center h-20">
                    {/* Always show Home */}
                    <button
                        onClick={() => setActiveTab('home')}
                        className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'home' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <CheckSquare size={28} />
                        <span className="text-xs mt-1 font-medium">Home</span>
                    </button>

                    {/* Context: CHECK-IN */}
                    {(activeTab === 'check-in') && (
                        <>
                            {/* Maybe add a 'History' vs 'Entry' toggle here if Check-in expands?
                                 For now, Check-in is single page, so maybe just Settings?
                                 Or user wants context specific tools.
                                 Let's add 'Statistics' shortcut for Check-in context?
                             */}
                        </>
                    )}

                    {/* Context: HEALTH / EXPERIMENTS / PROTOCOLS */}
                    {['health', 'experiments', 'protocols'].includes(activeTab) && (
                        <>
                            <button
                                onClick={() => setActiveTab('health')}
                                className={`flex-1 flex flex-col items-center justify-center w-full h-full ${activeTab === 'health' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Activity size={28} />
                                <span className="text-xs mt-1 font-medium">Metrics</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('experiments')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'experiments' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <FlaskConical size={28} />
                                <span className="text-xs mt-1 font-medium">Experiments</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('protocols')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'protocols' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Pill size={28} />
                                <span className="text-xs mt-1 font-medium">Protocols</span>
                            </button>
                        </>
                    )}

                    {/* Context: CALENDAR HUB (Calendar + Planning + Reflection) */}
                    {['calendar', 'planning', 'reflection'].includes(activeTab) && (
                        <>
                            <button
                                onClick={() => setActiveTab('calendar')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'calendar' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Calendar size={28} />
                                <span className="text-xs mt-1 font-medium">Calendar</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('planning')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'planning' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <CalendarClock size={28} />
                                <span className="text-xs mt-1 font-medium">Plan</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('reflection')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'reflection' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <TrendingUp size={28} />
                                <span className="text-xs mt-1 font-medium">Reflect</span>
                            </button>
                        </>
                    )}

                    {/* Context: TASKS HUB (Tasks + Checklists) */}
                    {['tasks', 'checklists'].includes(activeTab) && (
                        <>
                            <button
                                onClick={() => setActiveTab('tasks')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'tasks' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <CheckSquare size={28} />
                                <span className="text-xs mt-1 font-medium">Tasks</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('checklists')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'checklists' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <ListChecks size={28} />
                                <span className="text-xs mt-1 font-medium">Lists</span>
                            </button>
                        </>
                    )}

                    {/* Context: NOTES */}
                    {activeTab === 'notes' && (
                        <>
                            <button
                                onClick={() => setActiveTab('tasks')}
                                className="flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-slate-600"
                            >
                                <CheckSquare size={28} />
                                <span className="text-xs mt-1 font-medium">Tasks</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('notes')}
                                className="flex flex-col items-center justify-center w-full h-full text-indigo-600"
                            >
                                <StickyNote size={28} />
                                <span className="text-xs mt-1 font-medium">Notes</span>
                            </button>
                        </>
                    )}

                    <button
                        onClick={onSettingsClick}
                        className="flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-slate-600"
                    >
                        <Settings size={28} />
                        <span className="text-xs mt-1 font-medium">Settings</span>
                    </button>
                </div>
            </nav>
        </div>
    );
};

export default MainLayout;
