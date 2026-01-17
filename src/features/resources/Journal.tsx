import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Sun, Moon, Save } from 'lucide-react';

interface JournalEntry {
    date: string;
    intention: string;
    reflection: string;
}

const Journal: React.FC = () => {
    const [intention, setIntention] = useState('');
    const [reflection, setReflection] = useState('');
    const [saved, setSaved] = useState(false);

    const today = format(new Date(), 'yyyy-MM-dd');
    const STORAGE_KEY = 'buddy-app-journal';

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const entries: Record<string, JournalEntry> = JSON.parse(stored);
            if (entries[today]) {
                setIntention(entries[today].intention);
                setReflection(entries[today].reflection);
            }
        }
    }, [today]);

    const handleSave = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        const entries: Record<string, JournalEntry> = stored ? JSON.parse(stored) : {};

        entries[today] = {
            date: today,
            intention,
            reflection
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-xl font-semibold text-slate-800">Daily Journal</h2>

            {/* Morning Intention */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-500 font-medium">
                    <Sun size={20} />
                    <h3>Morning Intention</h3>
                </div>
                <p className="text-xs text-slate-400">What is one thing you want to focus on today?</p>
                <textarea
                    value={intention}
                    onChange={(e) => setIntention(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-200 outline-none text-sm"
                    rows={3}
                    placeholder="Today I want to..."
                />
            </div>

            {/* Evening Reflection */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-indigo-500 font-medium">
                    <Moon size={20} />
                    <h3>Evening Reflection</h3>
                </div>
                <p className="text-xs text-slate-400">What went well? What was challenging?</p>
                <textarea
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
                    rows={3}
                    placeholder="I felt..."
                />
            </div>

            <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-900 transition-colors font-medium"
            >
                <Save size={18} />
                {saved ? 'Saved!' : 'Save Journal'}
            </button>
        </div>
    );
};

export default Journal;
