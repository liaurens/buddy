import React, { useState } from 'react';
import ExperimentList from '../components/experiments/ExperimentList';
import ExperimentWizard from '../components/experiments/ExperimentWizard';
import ExperimentDetails from '../components/experiments/ExperimentDetails';
import ExperimentSettingsModal from '../components/experiments/ExperimentSettingsModal';
import type { Experiment } from '../types';
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
            const firstIndependentId =
                experiment.independentIds && experiment.independentIds.length > 0
                    ? experiment.independentIds[0]
                    : experiment.tracker1Id;

            onNavigate('health', {
                subTab: 'analysis',
                xId: firstIndependentId,
                yId: experiment.tracker2Id,
            });
        }
    };

    if (selectedExperiment) {
        return (
            <ExperimentDetails
                experiment={selectedExperiment}
                onBack={() => setSelectedExperiment(null)}
                onRunAnalysis={() => handleRunAnalysis(selectedExperiment)}
            />
        );
    }

    return (
        <div className="app-page">
            <div className="flex items-center justify-end lg:justify-between">
                <div className="hidden lg:block">
                    <h1 className="app-title flex items-center gap-2">
                        <FlaskConical className="text-indigo-600" />
                        Experiments
                    </h1>
                    <p className="app-subtitle">
                        Test your hypotheses and find what works for you.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="app-icon-button"
                        aria-label="Experiment Settings"
                    >
                        <Settings size={20} />
                    </button>
                    <button onClick={() => setIsWizardOpen(true)} className="app-primary-button">
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

            {isWizardOpen && <ExperimentWizard onClose={() => setIsWizardOpen(false)} />}

            {/* Settings Modal */}
            <ExperimentSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </div>
    );
};

export default ExperimentsPage;
