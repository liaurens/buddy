import React, { useState, useEffect } from 'react';
import { useTracker } from '../../context/TrackerContext';
import { useProtocol } from '../../context/ProtocolContext';
import { useExperiment } from '../../context/ExperimentContext';
import { X, ArrowRight, ArrowLeft, FlaskConical, Calendar, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ExperimentWizardProps {
    onClose: () => void;
}

const ExperimentWizard: React.FC<ExperimentWizardProps> = ({ onClose }) => {
    const { trackers } = useTracker();
    const { protocols } = useProtocol();
    const { addExperiment } = useExperiment();
    const [step, setStep] = useState(1);

    // Form State
    const [tracker1Id, setTracker1Id] = useState('');
    const [tracker2Id, setTracker2Id] = useState('');
    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [durationWeeks, setDurationWeeks] = useState(2);

    // Auto-generate name based on trackers or protocols
    useEffect(() => {
        const t1 = trackers.find(t => t.id === tracker1Id) || protocols.find(p => p.id === tracker1Id);
        const t2 = trackers.find(t => t.id === tracker2Id); // Dependent is always tracker for now?
        if (t1 && t2) {
            setName(`Effect of ${t1.name} on ${t2.name}`);
        }
    }, [tracker1Id, tracker2Id, trackers, protocols]);

    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);

    const handleSubmit = async () => {
        await addExperiment({
            name,
            tracker1Id,
            tracker2Id,
            startDate: new Date(startDate).toISOString(),
            // Store duration/goal in description or metadata for now as Experiment interface might need update for specific duration field
            description: `Target duration: ${durationWeeks} weeks`
        });
        onClose();
    };

    const isStep1Valid = tracker1Id && tracker2Id && tracker1Id !== tracker2Id;
    const isStep2Valid = startDate && durationWeeks > 0;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <FlaskConical size={24} />
                        <h2 className="font-bold text-lg">New Experiment</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>

                {/* Steps Indicator */}
                <div className="flex p-4 gap-2">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <h3 className="text-xl font-semibold text-slate-800">Define Hypothesis</h3>
                                <p className="text-slate-500">What relationship do you want to test?</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Independent Variable (The Cause)</label>
                                    <select
                                        value={tracker1Id}
                                        onChange={e => setTracker1Id(e.target.value)}
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                                    >
                                        <option value="">Select a variable...</option>
                                        <optgroup label="Trackers">
                                            {trackers.map(t => (
                                                <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="Protocols">
                                            {protocols.filter(p => p.active).map(p => (
                                                <option key={p.id} value={p.id}>💊 {p.name}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </div>

                                <div className="flex justify-center text-slate-400">
                                    <ArrowRight className="rotate-90 md:rotate-0" size={24} />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Dependent Variable (The Effect)</label>
                                    <select
                                        value={tracker2Id}
                                        onChange={e => setTracker2Id(e.target.value)}
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                                    >
                                        <option value="">Select a tracker...</option>
                                        {trackers.map(t => (
                                            <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <h3 className="text-xl font-semibold text-slate-800">Experiment Plan</h3>
                                <p className="text-slate-500">How long will this experiment run?</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="w-full pl-10 p-3 border border-slate-200 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Duration (Weeks)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="52"
                                    value={durationWeeks}
                                    onChange={e => setDurationWeeks(parseInt(e.target.value))}
                                    className="w-full p-3 border border-slate-200 rounded-xl"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Statistics become reliable after about 2 weeks of consistent data.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 text-center">
                            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FlaskConical size={32} />
                            </div>

                            <h3 className="text-xl font-semibold text-slate-800">Ready to Start?</h3>

                            <div className="bg-slate-50 p-4 rounded-xl text-left space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Experiment</span>
                                    <span className="font-medium text-slate-800">{name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Start Date</span>
                                    <span className="font-medium text-slate-800">{format(new Date(startDate), 'MMM d, yyyy')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Goal</span>
                                    <span className="font-medium text-slate-800">{durationWeeks} weeks</span>
                                </div>
                            </div>

                            <p className="text-sm text-slate-500">
                                This will appear on your dashboard.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-slate-100 flex justify-between">
                    <button
                        onClick={handleBack}
                        disabled={step === 1}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${step === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <ArrowLeft size={18} /> Back
                    </button>

                    {step < 3 ? (
                        <button
                            onClick={handleNext}
                            disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white transition-colors ${(step === 1 ? !isStep1Valid : !isStep2Valid)
                                ? 'bg-indigo-300 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                        >
                            Next <ArrowRight size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                        >
                            <CheckCircle size={18} /> Start Experiment
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExperimentWizard;
