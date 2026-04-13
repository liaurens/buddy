import React, { useState, useEffect } from 'react';
import { Trophy, Plus, X } from 'lucide-react';

interface DailyWinsProps {
    wins: string[];
    onChange: (wins: string[]) => void;
}

const DailyWins: React.FC<DailyWinsProps> = ({ wins, onChange }) => {
    const [input, setInput] = useState('');
    const [localWins, setLocalWins] = useState<string[]>(wins);

    useEffect(() => {
        setLocalWins(wins);
    }, [wins]);

    const addWin = () => {
        if (!input.trim() || localWins.length >= 5) return;
        const newWins = [...localWins, input.trim()];
        setLocalWins(newWins);
        onChange(newWins);
        setInput('');
    };

    const removeWin = (index: number) => {
        const newWins = localWins.filter((_, i) => i !== index);
        setLocalWins(newWins);
        onChange(newWins);
    };

    return (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Trophy size={18} className="text-amber-600" />
                <h3 className="text-sm font-semibold text-slate-800">Today's Wins</h3>
                <span className="text-xs text-slate-400">{localWins.length}/5</span>
            </div>

            {localWins.length > 0 && (
                <div className="space-y-1.5">
                    {localWins.map((win, i) => (
                        <div key={i} className="flex items-start gap-2 bg-white rounded-xl p-2.5">
                            <span className="text-amber-500 mt-0.5 text-sm font-bold">{i + 1}.</span>
                            <span className="flex-1 text-sm text-slate-700">{win}</span>
                            <button onClick={() => removeWin(i)} className="text-slate-300 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {localWins.length < 5 && (
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addWin(); } }}
                        placeholder="Add a win..."
                        className="flex-1 p-2.5 border border-amber-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-300 outline-none"
                    />
                    <button
                        onClick={addWin}
                        disabled={!input.trim()}
                        className="px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            )}

            {localWins.length === 0 && (
                <p className="text-xs text-amber-700/70 italic">
                    Capture up to 5 wins from today — big or small.
                </p>
            )}
        </div>
    );
};

export default DailyWins;
