import React from 'react';
import { Settings as SettingsIcon, CheckSquare, Activity, Pill, FlaskConical, Calendar, TrendingUp, CalendarClock } from 'lucide-react';

interface MainLayoutProps {
    children: React.ReactNode;
    activeTab: 'home' | 'tracker' | 'protocols' | 'toolbox' | 'todos' | 'calendar' | 'settings' | 'journal' | 'experiments' | 'notes' | 'focus' | 'reflection' | 'plan';
    setActiveTab: (tab: any) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, activeTab, setActiveTab }) => {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
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
                <div className="flex justify-around items-center h-16">
                    {/* Always show Home */}
                    <button
                        onClick={() => setActiveTab('home')}
                        className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'home' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <CheckSquare size={24} />
                        <span className="text-[10px] mt-1 font-medium">Home</span>
                    </button>

                    {/* Context: JOURNAL */}
                    {(activeTab === 'journal') && (
                        <>
                            {/* Maybe add a 'History' vs 'Entry' toggle here if Journal expands? 
                                 For now, Journal is single page, so maybe just Settings? 
                                 Or user wants context specific tools. 
                                 Let's add 'Statistics' shortcut for Journal context?
                             */}
                        </>
                    )}

                    {/* Context: TRACKER / EXPERIMENTS / PROTOCOLS */}
                    {['tracker', 'experiments', 'protocols'].includes(activeTab) && (
                        <>
                            <button
                                onClick={() => setActiveTab('tracker')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'tracker' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Activity size={24} />
                                <span className="text-[10px] mt-1 font-medium">Stats</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('experiments')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'experiments' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <FlaskConical size={24} />
                                <span className="text-[10px] mt-1 font-medium">Lab</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('protocols')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'protocols' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Pill size={24} />
                                <span className="text-[10px] mt-1 font-medium">Protocols</span>
                            </button>
                        </>
                    )}

                    {/* Context: CALENDAR HUB (Calendar + Plan) */}
                    {['calendar', 'plan'].includes(activeTab) && (
                        <>
                            <button
                                onClick={() => setActiveTab('calendar')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'calendar' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Calendar size={24} />
                                <span className="text-[10px] mt-1 font-medium">Calendar</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('plan')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'plan' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <CalendarClock size={24} />
                                <span className="text-[10px] mt-1 font-medium">Plan</span>
                            </button>
                        </>
                    )}

                    {/* Context: TASKS HUB (Tasks + Reflection + Notes) */}
                    {['todos', 'notes', 'reflection'].includes(activeTab) && (
                        <>
                            <button
                                onClick={() => setActiveTab('todos')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'todos' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <CheckSquare size={24} />
                                <span className="text-[10px] mt-1 font-medium">Tasks</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('reflection')}
                                className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'reflection' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <TrendingUp size={24} />
                                <span className="text-[10px] mt-1 font-medium">Reflect</span>
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'settings' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <SettingsIcon size={24} />
                        <span className="text-[10px] mt-1 font-medium">Settings</span>
                    </button>
                </div>
            </nav>
        </div>
    );
};

export default MainLayout;
