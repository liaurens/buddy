import React, { useState } from 'react';
import ExperimentList from '../components/experiments/ExperimentList';
import ExperimentWizard from '../components/experiments/ExperimentWizard';
import ExperimentDetails from '../components/experiments/ExperimentDetails';
import type { Experiment } from '../../../types';
import { Plus, FlaskConical } from 'lucide-react';

type AppRoute = 'home' | 'health' | 'protocols' | 'experiments' | 'check-in' | 'planning' | 'calendar' | 'reflection' | 'tasks' | 'notes' | 'toolbox' | 'focus' | 'settings';

interface ExperimentsPageProps {
    onNavigate?: (tab: AppRoute, params?: any) => void;
}

const ExperimentsPage: React.FC<ExperimentsPageProps> = ({ onNavigate }) => {
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);

    const handleRunAnalysis = (experiment: Experiment) => {
        if (onNavigate) {
            onNavigate('health', {
                subTab: 'analysis',
                xId: experiment.tracker1Id,
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
                <button
                    onClick={() => setIsWizardOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                >
                    <Plus size={20} />
                    New Experiment
                </button>
            </div>

            <ExperimentList
                onRunAnalysis={handleRunAnalysis}
                onViewDetails={setSelectedExperiment}
            />

            {isWizardOpen && (
                <ExperimentWizard onClose={() => setIsWizardOpen(false)} />
            )}
        </div>
    );
};

export default ExperimentsPage;
