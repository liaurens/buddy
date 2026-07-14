import { useState, useEffect } from 'react';
import Dashboard from '../components/tracker/Dashboard';
import EntryForm from '../components/tracker/EntryForm';
import Analysis from '../components/tracker/Analysis';
import CreateTrackerModal from '../components/tracker/CreateTrackerModal';
import SegmentComparePanel from '../components/tracker/SegmentComparePanel';
import type { TrackerDefinition } from '../types';
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
        initialParams?.subTab || 'dashboard',
    );
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTracker, setEditingTracker] = useState<TrackerDefinition | undefined>(undefined);
    const [analysisPair, setAnalysisPair] = useState<{ xId?: string; yId?: string }>({
        xId: initialParams?.xId,
        yId: initialParams?.yId,
    });

    // Reset subtab if params change (optional, but good for navigation)
    useEffect(() => {
        if (initialParams?.subTab) {
            setTrackerSubTab(initialParams.subTab);
        }
        if (initialParams?.xId || initialParams?.yId) {
            setAnalysisPair({ xId: initialParams.xId, yId: initialParams.yId });
        }
    }, [initialParams]);

    return (
        <div className="app-page">
            {/* Page Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="hidden lg:block">
                    <h1 className="app-title">Health Tracking</h1>
                    <p className="app-subtitle">Monitor your metrics and discover patterns.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingTracker(undefined);
                        setIsCreateModalOpen(true);
                    }}
                    className="app-primary-button self-start sm:self-auto"
                >
                    <Plus size={18} />
                    <span>New Tracker</span>
                </button>
            </div>

            {/* Tracker Sub-Navigation */}
            <div className="app-segmented">
                <button
                    onClick={() => setTrackerSubTab('dashboard')}
                    className={`app-segment ${
                        trackerSubTab === 'dashboard' ? 'app-segment-active' : ''
                    }`}
                >
                    Dashboard
                </button>
                <button
                    onClick={() => setTrackerSubTab('add')}
                    className={`app-segment ${trackerSubTab === 'add' ? 'app-segment-active' : ''}`}
                >
                    Add Entry
                </button>
                <button
                    onClick={() => setTrackerSubTab('analysis')}
                    className={`app-segment ${
                        trackerSubTab === 'analysis' ? 'app-segment-active' : ''
                    }`}
                >
                    Analysis
                </button>
            </div>

            {trackerSubTab === 'dashboard' && (
                <Dashboard
                    onEditTracker={(tracker) => {
                        setEditingTracker(tracker);
                        setIsCreateModalOpen(true);
                    }}
                />
            )}
            {trackerSubTab === 'add' && (
                <EntryForm
                    onManageTrackers={() => {
                        setEditingTracker(undefined);
                        setIsCreateModalOpen(true);
                    }}
                />
            )}
            {trackerSubTab === 'analysis' && (
                <>
                    <Analysis
                        key={`${analysisPair.xId ?? ''}-${analysisPair.yId ?? ''}`}
                        initialX={analysisPair.xId}
                        initialY={analysisPair.yId}
                    />
                    <SegmentComparePanel />
                </>
            )}

            <CreateTrackerModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setEditingTracker(undefined);
                }}
                editingTracker={editingTracker}
            />
        </div>
    );
};

export default TrackerPage;
