import React from 'react';
import { MoodRow, EnergyRow, type EnergyIndex, type MoodIndex } from '../components';

interface YesterdayStepProps {
    mood: MoodIndex | null;
    energy: EnergyIndex | null;
    onMood: (mood: MoodIndex) => void;
    onEnergy: (energy: EnergyIndex) => void;
}

/** Gate step 2 — "How was yesterday?" Two taps, no thinking required. */
const YesterdayStep: React.FC<YesterdayStepProps> = ({ mood, energy, onMood, onEnergy }) => (
    <div className="cove-fadeslide mt-4">
        <div className="px-0.5 pb-1 text-[15px] font-extrabold text-cove-ink">
            How was yesterday?
        </div>
        <div className="px-0.5 pb-3 text-[12.5px] font-semibold text-cove-soft">
            Two taps, no thinking required.
        </div>
        <div className="rounded-card bg-white p-4 shadow-cove">
            <div className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.06em] text-cove-soft">
                Mood
            </div>
            <MoodRow value={mood} onChange={onMood} variant="light" />
            <div className="mb-2.5 mt-4 text-xs font-extrabold uppercase tracking-[0.06em] text-cove-soft">
                Energy
            </div>
            <EnergyRow value={energy} onChange={onEnergy} variant="light" />
        </div>
    </div>
);

export default YesterdayStep;
