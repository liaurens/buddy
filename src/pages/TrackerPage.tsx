import { useState, useEffect } from 'react';
import Dashboard from '../features/tracker/Dashboard';
import EntryForm from '../features/tracker/EntryForm';
import Analysis from '../features/tracker/Analysis';

interface TrackerPageProps {
    initialParams?: {
        subTab?: 'dashboard' | 'add' | 'analysis';
        xId?: string;
        yId?: string;
    } | null;
}

const TrackerPage: React.FC<TrackerPageProps> = ({ initialParams }) => {
    const [trackerSubTab, setTrackerSubTab] = useState<'dashboard' | 'add' | 'analysis'>(
        initialParams?.subTab || 'dashboard'
    );

    // Reset subtab if params change (optional, but good for navigation)
    useEffect(() => {
        if (initialParams?.subTab) {
            setTrackerSubTab(initialParams.subTab);
        }
    }, [initialParams]);

    return (
        <div className="space-y-6">
            {/* Tracker Sub-Navigation */}
            <div className="flex p-1 bg-slate-200 rounded-lg">
                <button
                    onClick={() => setTrackerSubTab('dashboard')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${trackerSubTab === 'dashboard' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Dashboard
                </button>
                <button
                    onClick={() => setTrackerSubTab('add')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${trackerSubTab === 'add' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Add Entry
                </button>
                <button
                    onClick={() => setTrackerSubTab('analysis')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${trackerSubTab === 'analysis' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Analysis
                </button>
            </div>

            {trackerSubTab === 'dashboard' && <Dashboard />}
            {trackerSubTab === 'add' && <EntryForm />}
            {trackerSubTab === 'analysis' && (
                <Analysis
                    initialX={initialParams?.xId}
                    initialY={initialParams?.yId}
                />
            )}
        </div>
    );
};

export default TrackerPage;
