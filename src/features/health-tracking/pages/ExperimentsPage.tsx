import React, { useState } from 'react';
import ExperimentList from '../components/experiments/ExperimentList';
import ExperimentWizard from '../components/experiments/ExperimentWizard';
import ExperimentDetails from '../components/experiments/ExperimentDetails';
import ExperimentSettingsModal from '../components/experiments/ExperimentSettingsModal';
import type { Experiment } from '../../../types';
import { Plus, FlaskConical, Settings } from 'lucide-react';
import type { AppRoute } from '../../../constants/routes';

interface ExperimentsPageProps {
    onNavigate?: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const ExperimentsPage: React.FC<ExperimentsPageProps> = ({ onNavigate }) => {
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    const handleRunAnalysis = (experiment: Experiment) => {
        if (onNavigate) {
            // Use independentIds (newer) or fall back to tracker1Id (legacy)
            const firstIndependentId = (experiment.independentIds && experiment.independentIds.length > 0)
                ? experiment.independentIds[0]
                : experiment.tracker1Id;

            onNavigate('health', {
                subTab: 'analysis',
                xId: firstIndependentId,
                yId: experiment.tracker2Id
            });
        }
    };

    if (selectedExperiment) {
        return (
            <ExperimentDetails
                experiment={selectedExperiment}
                onBack={() => setSelectedExperiment(null)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FlaskConical className="text-indigo-600" />
                        Experiments
                    </h1>
                    <p className="text-slate-500">Test your hypotheses and find what works for you.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                        aria-label="Experiment Settings"
                    >
                        <Settings size={20} />
                    </button>
                    <button
                        onClick={() => setIsWizardOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                    >
                        <Plus size={20} />
                        New Experiment
                    </button>
                </div>
            </div>

            <ExperimentList
                onRunAnalysis={handleRunAnalysis}
                onViewDetails={setSelectedExperiment}
                onCreateNew={() => setIsWizardOpen(true)}
            />

            {isWizardOpen && (
                <ExperimentWizard onClose={() => setIsWizardOpen(false)} />
            )}

            {/* Settings Modal */}
            <ExperimentSettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </div>
    );
};

export default ExperimentsPage;
