import React, { useState, useMemo, useCallback } from 'react';
import { useTrackers } from '../hooks/useTrackers';
import { useProtocols } from '../hooks/useProtocols';
import { useDailyJournal } from '../hooks/useDailyJournal';
import { useExperiments } from '../hooks/useExperiments';
import { format, subDays, isSameDay, parseISO } from 'date-fns';
import { BookHeart, SlidersHorizontal, FlaskConical, Activity, ChevronRight, Settings } from 'lucide-react';
import CheckinModal from '../components/tracker/CheckinModal';
import CheckInSettingsModal from '../components/checkin/CheckInSettingsModal';
import DailyJournalForm from '../components/journal/DailyJournalForm';
import MoodEnergyCapture from '../components/journal/MoodEnergyCapture';
import DailyWins from '../components/journal/DailyWins';
import type { AppRoute } from '../../../constants/routes';
import type { JournalPromptResponse } from '../types';

interface DailyJournalPageProps {
    onNavigate?: (tab: AppRoute, params?: Record<string, unknown>) => void;
}

const DailyJournalPage: React.FC<DailyJournalPageProps> = ({ onNavigate }) => {
    const { trackers, entries } = useTrackers();
    const { doses } = useProtocols();
    const { experiments } = useExperiments();

    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const { journalEntry, save } = useDailyJournal(selectedDate);

    const [isCheckinOpen, setIsCheckinOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const todaysEntries = useMemo(() =>
        entries.filter(e => isSameDay(new Date(e.timestamp), new Date(selectedDate))),
        [entries, selectedDate]
    );
    const todaysDoses = useMemo(() =>
        doses.filter(d => d.takenAt && isSameDay(new Date(d.takenAt), new Date(selectedDate))),
        [doses, selectedDate]
    );

    const activeExperiments = useMemo(() => experiments.filter(e => e.status === 'active'), [experiments]);

    const dates = Array.from({ length: 5 }, (_, i) => subDays(new Date(), 4 - i));

    // Journal state helpers — save full journal entry on any change
    const currentMood = journalEntry?.moodRating;
    const currentEnergy = journalEntry?.energyRating;
    const currentPrompts = journalEntry?.prompts || [];
    const currentWins = journalEntry?.wins || [];

    const saveJournal = useCallback(async (updates: {
        prompts?: JournalPromptResponse[];
        moodRating?: number;
        energyRating?: number;
        wins?: string[];
    }) => {
        await save({
            prompts: updates.prompts ?? currentPrompts,
            moodRating: updates.moodRating ?? currentMood,
            energyRating: updates.energyRating ?? currentEnergy,
            wins: updates.wins ?? currentWins,
        });
    }, [save, currentPrompts, currentMood, currentEnergy, currentWins]);

    return (
        <div className="max-w-2xl mx-auto p-4 space-y-5 pb-24">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <BookHeart className="text-indigo-600" size={28} />
                        Daily Journal
                    </h1>
                    <p className="text-slate-500 text-sm">{format(new Date(selectedDate), 'EEEE, MMM do')}</p>
                </div>
                <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                    aria-label="Settings"
                >
                    <Settings size={20} />
                </button>
            </header>

            {/* Date strip */}
            <div className="flex gap-2">
                {dates.map(date => {
                    const isSelected = isSameDay(date, new Date(selectedDate));
                    return (
                        <button
                            key={date.toISOString()}
                            onClick={() => setSelectedDate(format(date, 'yyyy-MM-dd'))}
                            className={`flex-1 h-14 rounded-xl border flex flex-col items-center justify-center transition-all ${
                                isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500'
                            }`}
                        >
                            <span className="text-[10px] font-bold uppercase">{format(date, 'EEE')}</span>
                            <span className="text-sm font-bold">{format(date, 'd')}</span>
                        </button>
                    );
                })}
            </div>

            {/* Mood & Energy */}
            <MoodEnergyCapture
                mood={currentMood}
                energy={currentEnergy}
                onMoodChange={(mood) => saveJournal({ moodRating: mood })}
                onEnergyChange={(energy) => saveJournal({ energyRating: energy })}
            />

            {/* Active Experiment Reminders */}
            {activeExperiments.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Experiments</h3>
                    <div className="space-y-2">
                        {activeExperiments.map(exp => (
                            <button
                                key={exp.id}
                                onClick={() => onNavigate?.('experiments' as AppRoute, { experimentId: exp.id })}
                                className="w-full flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 transition-colors text-left"
                            >
                                <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FlaskConical size={18} className="text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-800 truncate">{exp.name}</div>
                                    <div className="text-xs text-slate-500">
                                        {exp.customMetrics.length > 0 ? `${exp.customMetrics.length} metrics to log` : 'Active experiment'}
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-slate-400" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Reflection prompts */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <DailyJournalForm
                    date={selectedDate}
                    initial={currentPrompts}
                    onSave={(prompts) => saveJournal({ prompts })}
                />
            </div>

            {/* Wins */}
            <DailyWins
                wins={currentWins}
                onChange={(wins) => saveJournal({ wins })}
            />

            {/* Health metrics drawer */}
            <button
                onClick={() => setIsCheckinOpen(true)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                        <Activity size={18} className="text-slate-600" />
                    </div>
                    <div className="text-left">
                        <div className="text-sm font-medium text-slate-800">Log Health Metrics</div>
                        <div className="text-xs text-slate-500">
                            {todaysEntries.length > 0
                                ? `${todaysEntries.length} logged today — edit or add more`
                                : 'Trackers, sleep, protocols'}
                        </div>
                    </div>
                </div>
                <SlidersHorizontal size={18} className="text-slate-400" />
            </button>

            {/* Logged data summary */}
            {todaysEntries.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Logged Today</h3>
                    <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50">
                        {todaysEntries
                            .filter(entry => trackers.find(t => t.id === entry.trackerId)?.checkinConfig?.showInDailyReport)
                            .map(entry => {
                                const tracker = trackers.find(t => t.id === entry.trackerId);
                                if (!tracker) return null;
                                return (
                                    <div key={entry.id} className="p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{tracker.emoji}</span>
                                            <span className="text-sm font-medium text-slate-700">{tracker.name}</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-800">
                                            {tracker.type === 'boolean'
                                                ? (entry.value ? 'Yes' : 'No')
                                                : <>{entry.value} <span className="text-xs font-normal text-slate-400">{tracker.unit}</span></>
                                            }
                                        </span>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Modals */}
            <CheckinModal
                isOpen={isCheckinOpen}
                onClose={() => setIsCheckinOpen(false)}
                onComplete={() => setIsCheckinOpen(false)}
                date={parseISO(selectedDate)}
                existingEntries={todaysEntries}
                existingDoses={todaysDoses}
            />
            <CheckInSettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </div>
    );
};

export default DailyJournalPage;
