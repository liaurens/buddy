import { useState, useEffect } from 'react';
import Dashboard from '../components/tracker/Dashboard';
import EntryForm from '../components/tracker/EntryForm';
import Analysis from '../components/tracker/Analysis';
import CreateTrackerModal from '../components/tracker/CreateTrackerModal';
import SegmentComparePanel from '../components/tracker/SegmentComparePanel';
import type { TrackerDefinition } from '../types';
import { ChevronDown, Plus } from 'lucide-react';

interface TrackerPageProps {
    initialParams?: {
        subTab?: 'dashboard' | 'add' | 'analysis';
        xId?: string;
        yId?: string;
    } | null;
}

const TrackerPage: React.FC<TrackerPageProps> = ({ initialParams }) => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTracker, setEditingTracker] = useState<TrackerDefinition | undefined>(undefined);
    const [analysisPair, setAnalysisPair] = useState<{ xId?: string; yId?: string }>({
        xId: initialParams?.xId,
        yId: initialParams?.yId,
    });
    const [isAnalysisOpen, setIsAnalysisOpen] = useState(
        initialParams?.subTab === 'analysis' || Boolean(initialParams?.xId || initialParams?.yId),
    );

    // Deep-links (e.g. correlation notifications) still open the analysis fold.
    useEffect(() => {
        if (initialParams?.subTab === 'analysis' || initialParams?.xId || initialParams?.yId) {
            setIsAnalysisOpen(true);
        }
        if (initialParams?.xId || initialParams?.yId) {
            setAnalysisPair({ xId: initialParams.xId, yId: initialParams.yId });
        }
    }, [initialParams]);

    return (
        <div className="app-page">
            {/* Page Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="px-1 pb-1 pt-1.5 text-[22px] font-black text-cove-ink">
                        Health
                    </div>
                    <div className="px-1 pb-4 text-[13.5px] font-semibold text-cove-muted">
                        Check in daily and watch your patterns.
                    </div>
                </div>
                <button
                    onClick={() => {
                        setEditingTracker(undefined);
                        setIsCreateModalOpen(true);
                    }}
                    className="app-primary-button mt-1.5 shrink-0"
                >
                    <Plus size={18} />
                    <span>New Tracker</span>
                </button>
            </div>

            {/* Daily check-in first */}
            <EntryForm
                onManageTrackers={() => {
                    setEditingTracker(undefined);
                    setIsCreateModalOpen(true);
                }}
            />

            {/* Simple trends */}
            <Dashboard
                onEditTracker={(tracker) => {
                    setEditingTracker(tracker);
                    setIsCreateModalOpen(true);
                }}
            />

            {/* Deep analysis, folded behind one quiet disclosure */}
            <div>
                <button
                    type="button"
                    onClick={() => setIsAnalysisOpen((open) => !open)}
                    className="flex items-center gap-1 px-1 text-[13px] font-extrabold text-cove-faint transition-colors hover:text-cove-muted"
                >
                    Explore my data
                    <ChevronDown
                        size={15}
                        className={`transition-transform ${isAnalysisOpen ? 'rotate-180' : ''}`}
                    />
                </button>
                {isAnalysisOpen && (
                    <div className="mt-4 space-y-5">
                        <Analysis
                            key={`${analysisPair.xId ?? ''}-${analysisPair.yId ?? ''}`}
                            initialX={analysisPair.xId}
                            initialY={analysisPair.yId}
                        />
                        <SegmentComparePanel />
                    </div>
                )}
            </div>

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
