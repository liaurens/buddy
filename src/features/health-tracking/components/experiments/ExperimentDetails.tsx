import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    Plus,
    Calendar as CalendarIcon,
    Save,
    CheckSquare,
    BarChart3,
    Bot,
    Settings as SettingsIcon,
    FileText,
    Pause,
    Check,
    Archive,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Experiment, ExperimentStatus } from '../../types';
import { getExperimentLogs, addExperimentLog } from '../../../../services/supabase';
import { useTrackers } from '../../hooks/useTrackers';
import { useProtocols } from '../../hooks/useProtocols';
import { useExperiments } from '../../hooks/useExperiments';
import { useExperimentCheckins } from '../../hooks/useExperimentCheckins';
import ExperimentCheckinForm from './ExperimentCheckinForm';
import ExperimentPhaseTimeline from './ExperimentPhaseTimeline';
import ExperimentAnalysisPanel from './ExperimentAnalysisPanel';
import ExperimentMetricBuilder from './ExperimentMetricBuilder';
import ExperimentAgentChat from './ExperimentAgentChat';

interface ExperimentDetailsProps {
    experiment: Experiment;
    onBack: () => void;
    onRunAnalysis?: () => void;
}

type Tab = 'checkin' | 'notes' | 'analysis' | 'agent' | 'settings';

const STATUS_CONFIG: Record<ExperimentStatus, { label: string; color: string }> = {
    active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700' },
    paused: { label: 'Paused', color: 'bg-amber-100 text-amber-700' },
    completed: { label: 'Completed', color: 'bg-indigo-100 text-indigo-700' },
    archived: { label: 'Archived', color: 'bg-slate-100 text-slate-600' },
};

const ExperimentDetails: React.FC<ExperimentDetailsProps> = ({
    experiment: initialExperiment,
    onBack,
    onRunAnalysis,
}) => {
    const queryClient = useQueryClient();
    const { trackers } = useTrackers();
    const { protocols } = useProtocols();
    const { experiments, updateExperiment } = useExperiments();
    const { checkins, saveCheckin, removeCheckinForDate } = useExperimentCheckins(
        initialExperiment.id,
    );

    // Always read the latest experiment from the list in case it was updated
    const experiment = experiments.find((e) => e.id === initialExperiment.id) || initialExperiment;

    const [activeTab, setActiveTab] = useState<Tab>('checkin');
    const [checkinDate, setCheckinDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Notes tab state
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [noteDate, setNoteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [noteContent, setNoteContent] = useState('');
    const [moodRating, setMoodRating] = useState<number | undefined>(undefined);

    // Fetch notes
    const { data: logs = [], isLoading: logsLoading } = useQuery({
        queryKey: ['experiment_logs', experiment.id],
        queryFn: () => getExperimentLogs(experiment.id),
    });

    const addLogMutation = useMutation({
        mutationFn: async () => {
            return await addExperimentLog({
                experimentId: experiment.id,
                date: noteDate,
                content: noteContent,
                moodRating,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['experiment_logs', experiment.id] });
            setIsAddingNote(false);
            setNoteContent('');
            setMoodRating(undefined);
            setNoteDate(format(new Date(), 'yyyy-MM-dd'));
        },
    });

    const getVariableName = (id: string) => {
        const t = trackers.find((t) => t.id === id);
        if (t) return `${t.emoji} ${t.name}`;
        const p = protocols.find((p) => p.id === id);
        if (p) return `💊 ${p.name}`;
        return 'Unknown';
    };

    const checkinsForDate = checkins.filter((c) => c.date === checkinDate);

    const daysActive = Math.floor(
        (new Date().getTime() - new Date(experiment.startDate).getTime()) / (1000 * 60 * 60 * 24),
    );

    const handleStatusChange = async (status: ExperimentStatus) => {
        await updateExperiment({ ...experiment, status, active: status === 'active' });
    };

    const statusInfo = STATUS_CONFIG[experiment.status] || STATUS_CONFIG.active;

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'checkin', label: 'Check-in', icon: <CheckSquare size={16} /> },
        { id: 'notes', label: 'Notes', icon: <FileText size={16} /> },
        { id: 'analysis', label: 'Analysis', icon: <BarChart3 size={16} /> },
        { id: 'agent', label: 'Agent', icon: <Bot size={16} /> },
        { id: 'settings', label: 'Settings', icon: <SettingsIcon size={16} /> },
    ];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start gap-3">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-2xl font-bold text-slate-800">{experiment.name}</h2>
                        <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}
                        >
                            {statusInfo.label}
                        </span>
                    </div>
                    {experiment.hypothesis && (
                        <p className="text-slate-500 text-sm mt-1">{experiment.hypothesis}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span>Day {daysActive}</span>
                        <span>·</span>
                        <span>{checkins.length} check-ins</span>
                        <span>·</span>
                        <span>{logs.length} notes</span>
                    </div>
                </div>
            </div>

            {/* Phase Timeline */}
            {experiment.phases.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <ExperimentPhaseTimeline
                        phases={experiment.phases}
                        startDate={experiment.startDate}
                    />
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
                {activeTab === 'checkin' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-600">Date:</label>
                            <input
                                type="date"
                                value={checkinDate}
                                onChange={(e) => setCheckinDate(e.target.value)}
                                className="p-1.5 border border-slate-200 rounded-lg text-sm"
                            />
                        </div>
                        <ExperimentCheckinForm
                            metrics={experiment.customMetrics}
                            phases={experiment.phases}
                            date={checkinDate}
                            existingEntries={checkinsForDate}
                            onSave={saveCheckin}
                            onDelete={removeCheckinForDate}
                        />

                        {/* Recent check-ins */}
                        {checkins.length > 0 && (
                            <div className="pt-4 mt-4 border-t border-slate-100">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    Recent Check-ins
                                </h4>
                                <div className="space-y-1">
                                    {Array.from(new Set(checkins.map((c) => c.date)))
                                        .slice(0, 7)
                                        .map((date) => {
                                            const entries = checkins.filter((c) => c.date === date);
                                            return (
                                                <button
                                                    key={date}
                                                    onClick={() => setCheckinDate(date)}
                                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg text-sm"
                                                >
                                                    <span className="text-slate-700">
                                                        {format(new Date(date), 'EEE, MMM d')}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {entries.length} metrics
                                                    </span>
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'notes' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                <CalendarIcon size={18} className="text-indigo-600" />
                                Daily Notes
                            </h3>
                            <button
                                onClick={() => setIsAddingNote(true)}
                                className="text-sm bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:border-indigo-300 hover:text-indigo-600 flex items-center gap-1.5"
                            >
                                <Plus size={16} /> Add Note
                            </button>
                        </div>

                        {isAddingNote && (
                            <div className="p-4 border border-indigo-200 rounded-xl bg-indigo-50/30 space-y-3">
                                <div className="flex gap-3">
                                    <input
                                        type="date"
                                        value={noteDate}
                                        onChange={(e) => setNoteDate(e.target.value)}
                                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                                    />
                                    <select
                                        value={moodRating || ''}
                                        onChange={(e) =>
                                            setMoodRating(
                                                e.target.value ? Number(e.target.value) : undefined,
                                            )
                                        }
                                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                                    >
                                        <option value="">Mood (optional)</option>
                                        {[1, 2, 3, 4, 5].map((r) => (
                                            <option key={r} value={r}>
                                                {r} -{' '}
                                                {['Awful', 'Bad', 'Okay', 'Good', 'Great'][r - 1]}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <textarea
                                    value={noteContent}
                                    onChange={(e) => setNoteContent(e.target.value)}
                                    placeholder="What did you notice today? Any observations?"
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm resize-none"
                                    rows={3}
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setIsAddingNote(false)}
                                        className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => addLogMutation.mutate()}
                                        disabled={!noteContent.trim() || addLogMutation.isPending}
                                        className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {addLogMutation.isPending ? (
                                            'Saving...'
                                        ) : (
                                            <>
                                                <Save size={14} /> Save
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="divide-y divide-slate-100">
                            {logsLoading ? (
                                <div className="p-8 text-center text-slate-400">Loading...</div>
                            ) : logs.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 italic">
                                    No notes yet.
                                </div>
                            ) : (
                                logs.map((log) => (
                                    <div key={log.id} className="py-3">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                {format(new Date(log.date), 'EEE, MMM d')}
                                            </span>
                                            {log.moodRating && (
                                                <span
                                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                                        log.moodRating >= 4
                                                            ? 'bg-green-100 text-green-700'
                                                            : log.moodRating <= 2
                                                              ? 'bg-red-100 text-red-700'
                                                              : 'bg-yellow-100 text-yellow-700'
                                                    }`}
                                                >
                                                    Mood: {log.moodRating}/5
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-slate-700 whitespace-pre-wrap text-sm">
                                            {log.content}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'analysis' && (
                    <ExperimentAnalysisPanel
                        metrics={experiment.customMetrics}
                        checkins={checkins}
                        phases={experiment.phases}
                        onRunFullAnalysis={onRunAnalysis}
                    />
                )}

                {activeTab === 'agent' && (
                    <ExperimentAgentChat experimentId={experiment.id} experiment={experiment} />
                )}

                {activeTab === 'settings' && (
                    <div className="space-y-5">
                        <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Status
                            </h4>
                            <div className="flex gap-2 flex-wrap">
                                {(
                                    [
                                        'active',
                                        'paused',
                                        'completed',
                                        'archived',
                                    ] as ExperimentStatus[]
                                ).map((s) => {
                                    const isCurrent = experiment.status === s;
                                    const icon =
                                        s === 'active' ? (
                                            <Check size={14} />
                                        ) : s === 'paused' ? (
                                            <Pause size={14} />
                                        ) : s === 'completed' ? (
                                            <Check size={14} />
                                        ) : (
                                            <Archive size={14} />
                                        );
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => handleStatusChange(s)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                isCurrent
                                                    ? STATUS_CONFIG[s].color
                                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            {icon}
                                            {STATUS_CONFIG[s].label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Custom Metrics
                            </h4>
                            <ExperimentMetricBuilder
                                metrics={experiment.customMetrics}
                                onChange={async (customMetrics) => {
                                    await updateExperiment({ ...experiment, customMetrics });
                                }}
                            />
                        </div>

                        <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Linked Trackers
                            </h4>
                            <div className="space-y-2">
                                <div className="text-sm">
                                    <span className="text-slate-500">Independent: </span>
                                    <span className="text-slate-800">
                                        {(experiment.independentIds || [])
                                            .map(getVariableName)
                                            .join(', ') || 'None'}
                                    </span>
                                </div>
                                <div className="text-sm">
                                    <span className="text-slate-500">Dependent: </span>
                                    <span className="text-slate-800">
                                        {experiment.tracker2Id
                                            ? getVariableName(experiment.tracker2Id)
                                            : 'None'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Start Date
                            </h4>
                            <span className="text-slate-700 text-sm">
                                {format(new Date(experiment.startDate), 'MMMM d, yyyy')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExperimentDetails;
