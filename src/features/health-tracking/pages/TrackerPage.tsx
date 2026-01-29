import { useState, useEffect } from 'react';
import Dashboard from '../components/tracker/Dashboard';
import EntryForm from '../components/tracker/EntryForm';
import Analysis from '../components/tracker/Analysis';
import CreateTrackerModal from '../components/tracker/CreateTrackerModal';
import { Plus } from 'lucide-react';

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
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Reset subtab if params change (optional, but good for navigation)
    useEffect(() => {
        if (initialParams?.subTab) {
            setTrackerSubTab(initialParams.subTab);
        }
    }, [initialParams]);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="mb-4 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Health Tracking</h1>
                    <p className="text-slate-500">Monitor your metrics and discover patterns</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    <span>New Tracker</span>
                </button>
            </div>

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

            <CreateTrackerModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    );
};

export default TrackerPage;
