import React from 'react';

interface MoodEnergyCaptureProps {
    mood?: number;
    energy?: number;
    onMoodChange: (mood: number) => void;
    onEnergyChange: (energy: number) => void;
}

const MOOD_EMOJIS: { value: number; emoji: string; label: string }[] = [
    { value: 1, emoji: '😞', label: 'Awful' },
    { value: 2, emoji: '😕', label: 'Bad' },
    { value: 3, emoji: '😐', label: 'Okay' },
    { value: 4, emoji: '🙂', label: 'Good' },
    { value: 5, emoji: '😄', label: 'Great' },
];

const MoodEnergyCapture: React.FC<MoodEnergyCaptureProps> = ({ mood, energy, onMoodChange, onEnergyChange }) => {
    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 space-y-4">
            {/* Mood */}
            <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
                    How are you feeling?
                </label>
                <div className="flex justify-between gap-1">
                    {MOOD_EMOJIS.map(({ value, emoji, label }) => {
                        const isSelected = mood === value;
                        return (
                            <button
                                key={value}
                                onClick={() => onMoodChange(value)}
                                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all ${
                                    isSelected
                                        ? 'bg-white shadow-md scale-105'
                                        : 'hover:bg-white/60'
                                }`}
                            >
                                <span className={`text-2xl ${isSelected ? '' : 'opacity-60'}`}>{emoji}</span>
                                <span className={`text-[10px] font-medium ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>
                                    {label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Energy */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Energy level
                    </label>
                    <span className="text-sm font-bold text-slate-700">{energy ?? '-'}/5</span>
                </div>
                <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(val => {
                        const isActive = energy && energy >= val;
                        return (
                            <button
                                key={val}
                                onClick={() => onEnergyChange(val)}
                                className={`flex-1 h-9 rounded-lg transition-all ${
                                    isActive
                                        ? 'bg-gradient-to-r from-amber-400 to-orange-400 shadow-sm'
                                        : 'bg-white/60 hover:bg-white'
                                }`}
                                aria-label={`Energy ${val}`}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MoodEnergyCapture;
