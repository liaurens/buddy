import React from 'react';
import { Home, MessageSquare, LayoutGrid, User } from 'lucide-react';
import type { AppRoute } from '../constants/routes';
import CaptureFAB from '../components/CaptureFAB';

interface MainLayoutProps {
    children: React.ReactNode;
    activeTab: AppRoute;
    setActiveTab: (tab: AppRoute) => void;
}

const TABS: Array<{ key: AppRoute; label: string; Icon: typeof Home }> = [
    { key: 'home', label: 'Now', Icon: Home },
    { key: 'assistant', label: 'Capture', Icon: MessageSquare },
    { key: 'browse', label: 'Browse', Icon: LayoutGrid },
    { key: 'me', label: 'Me', Icon: User },
];

const MainLayout: React.FC<MainLayoutProps> = ({ children, activeTab, setActiveTab }) => {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-md mx-auto px-4 py-4">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                        Buddy
                    </h1>
                </div>
            </header>

            <main className="max-w-md mx-auto px-4 py-6">
                {children}
            </main>

            <CaptureFAB activeTab={activeTab} onNavigate={setActiveTab} />

            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 z-20 safe-area-inset-bottom">
                <div className="flex justify-around items-center h-20">
                    {TABS.map(({ key, label, Icon }) => {
                        const isActive = activeTab === key
                            || (key === 'home' && activeTab === 'home')
                            || (key === 'me' && activeTab === 'account');
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`flex flex-col items-center justify-center w-full h-full ${isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Icon size={28} />
                                <span className="text-xs mt-1 font-medium">{label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default MainLayout;
