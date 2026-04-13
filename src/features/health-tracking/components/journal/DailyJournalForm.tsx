import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { JournalPromptResponse } from '../../types';
import { getPromptsForDate } from './journal-prompts';

interface DailyJournalFormProps {
    date: string;
    initial?: JournalPromptResponse[];
    onSave: (prompts: JournalPromptResponse[]) => Promise<void>;
}

const DailyJournalForm: React.FC<DailyJournalFormProps> = ({ date, initial = [], onSave }) => {
    const prompts = getPromptsForDate(new Date(date));
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const saveTimeoutRef = useRef<number | null>(null);

    // Seed answers from initial data
    useEffect(() => {
        const seed: Record<string, string> = {};
        initial.forEach(p => { seed[p.promptId] = p.answer; });
        setAnswers(seed);
    }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

    const buildResponses = useCallback((a: Record<string, string>): JournalPromptResponse[] => {
        return prompts
            .map(p => ({ promptId: p.id, question: p.question, answer: a[p.id] || '' }))
            .filter(p => p.answer.trim().length > 0);
    }, [prompts]);

    const debouncedSave = useCallback((newAnswers: Record<string, string>) => {
        if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = window.setTimeout(async () => {
            setSaving(true);
            try {
                await onSave(buildResponses(newAnswers));
                setSavedAt(new Date());
            } finally {
                setSaving(false);
            }
        }, 1200);
    }, [buildResponses, onSave]);

    const updateAnswer = (promptId: string, answer: string) => {
        const newAnswers = { ...answers, [promptId]: answer };
        setAnswers(newAnswers);
        debouncedSave(newAnswers);
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Reflection</h3>
                {saving ? (
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Loader2 size={12} className="animate-spin" /> Saving...
                    </span>
                ) : savedAt ? (
                    <span className="text-xs text-emerald-600 flex items-center gap-1.5">
                        <Check size={12} /> Saved
                    </span>
                ) : null}
            </div>

            {prompts.map(prompt => (
                <div key={prompt.id} className="space-y-2">
                    <label className="block">
                        <span className="text-sm font-medium text-slate-700 block">{prompt.question}</span>
                        {prompt.hint && <span className="text-xs text-slate-400">{prompt.hint}</span>}
                    </label>
                    <textarea
                        value={answers[prompt.id] || ''}
                        onChange={e => updateAnswer(prompt.id, e.target.value)}
                        placeholder="Write freely..."
                        className="w-full p-3 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none text-sm leading-relaxed"
                        rows={3}
                    />
                </div>
            ))}
        </div>
    );
};

export default DailyJournalForm;
