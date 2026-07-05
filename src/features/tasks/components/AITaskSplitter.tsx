/**
 * AITaskSplitter - AI-powered task breakdown component
 *
 * Uses the existing AI service to split a large task into subtasks.
 * Stores learning preferences in localStorage for adaptation over time.
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, Check, X, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getAIService, isAIConfigured, initializeAIService } from '../../planning/services/ai.service';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import type { Task, Subtask } from '../types';

interface AITaskSplitterProps {
    task: Task;
    onSplit: (subtasks: Subtask[]) => void;
    onCancel: () => void;
}

interface SplitSuggestion {
    title: string;
    estimatedMinutes: number;
}

// Learning preferences stored in localStorage
const LEARNING_KEY = 'buddy_ai_split_preferences';

interface LearningData {
    /** Categories the AI has learned the user prefers */
    preferredCategories: string[];
    /** Typical subtask size preference */
    preferredSubtaskSize: 'small' | 'medium' | 'large';
    /** Past splits for context */
    history: Array<{
        originalTask: string;
        subtasks: string[];
        accepted: boolean;
        timestamp: string;
    }>;
}

function getLearningData(): LearningData {
    try {
        const raw = localStorage.getItem(LEARNING_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
        preferredCategories: [],
        preferredSubtaskSize: 'medium',
        history: [],
    };
}

function saveLearningData(data: LearningData): void {
    // Keep last 20 entries
    data.history = data.history.slice(-20);
    localStorage.setItem(LEARNING_KEY, JSON.stringify(data));
}

function buildSplitPrompt(task: Task, learning: LearningData): { system: string; user: string } {
    const historyContext = learning.history.length > 0
        ? `\n\nPrevious task splits the user has done (learn from these):\n${
            learning.history
                .filter(h => h.accepted)
                .slice(-5)
                .map(h => `- "${h.originalTask}" → ${h.subtasks.join(', ')}`)
                .join('\n')
        }`
        : '';

    const sizeGuide = {
        small: '5-15 minutes each, very granular steps',
        medium: '15-45 minutes each, balanced steps',
        large: '30-90 minutes each, broader chunks',
    }[learning.preferredSubtaskSize];

    const system = `You are a task breakdown expert that helps users split large tasks into actionable subtasks.
You adapt to the user's preferences and patterns.

Guidelines:
- Create 3-6 concrete, actionable subtasks
- Each subtask should be completable in one sitting
- Subtask size preference: ${sizeGuide}
- Order subtasks logically (what needs to happen first)
- Make subtask titles specific and action-oriented (start with a verb)${historyContext}

Return a JSON object:
{
  "subtasks": [
    { "title": "Specific actionable step", "estimatedMinutes": 15 }
  ]
}`;

    const user = `Break down this task into subtasks:

Task: ${task.title}
Priority: ${task.priority || 'medium'}
${task.dueDate ? `Due date: ${task.dueDate}` : ''}
${task.estimatedTime ? `Estimated total time: ${task.estimatedTime} minutes` : ''}
${task.labels?.length ? `Labels: ${task.labels.join(', ')}` : ''}`;

    return { system, user };
}

const AITaskSplitter: React.FC<AITaskSplitterProps> = ({ task, onSplit, onCancel }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<SplitSuggestion[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(isAIConfigured());

    useEffect(() => {
        if (!user?.id || ready) return;
        void (async () => {
            const { data } = await supabase
                .from('settings')
                .select('key, value')
                .eq('user_id', user.id)
                .in('key', ['ai_aiProvider', 'ai_aiApiKey', 'ai_aiModel']);
            if (!data) return;
            const m = data.reduce((acc, s) => {
                acc[s.key] = s.value;
                return acc;
            }, {} as Record<string, string>);
            const provider = m['ai_aiProvider'] as 'openai' | 'anthropic' | 'gemini' | undefined;
            const apiKey = m['ai_aiApiKey'];
            const model = m['ai_aiModel'];
            if (provider && apiKey) {
                initializeAIService({ provider, apiKey, model: model || undefined });
                setReady(true);
            }
        })();
    }, [user?.id, ready]);

    const handleGenerate = async () => {
        const aiService = getAIService();
        if (!aiService) {
            setError('AI not configured. Set up an AI provider in Settings to use this feature.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const learning = getLearningData();
            const prompt = buildSplitPrompt(task, learning);

            const result = await aiService.breakdownTask(
                task.title,
                '',
                task.estimatedTime || 60,
                prompt,
            );

            if (result.success && result.data?.subtasks) {
                setSuggestions(result.data.subtasks);
            } else {
                setError(result.error || 'Failed to generate subtasks');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = () => {
        if (!suggestions) return;

        const subtasks: Subtask[] = suggestions.map(s => ({
            id: uuidv4(),
            title: s.title,
            completed: false,
        }));

        // Save to learning data
        const learning = getLearningData();
        learning.history.push({
            originalTask: task.title,
            subtasks: suggestions.map(s => s.title),
            accepted: true,
            timestamp: new Date().toISOString(),
        });
        saveLearningData(learning);

        onSplit(subtasks);
    };

    const handleReject = () => {
        // Save rejection to learning data
        if (suggestions) {
            const learning = getLearningData();
            learning.history.push({
                originalTask: task.title,
                subtasks: suggestions.map(s => s.title),
                accepted: false,
                timestamp: new Date().toISOString(),
            });
            saveLearningData(learning);
        }
        onCancel();
    };

    // Initial state - show generate button
    if (!suggestions && !loading && !error) {
        return (
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={16} className="text-indigo-500" />
                    <span className="text-sm font-semibold text-indigo-700">AI Task Splitter</span>
                </div>
                <p className="text-xs text-indigo-600 mb-3">
                    Break "{task.title}" into smaller, actionable subtasks using AI.
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={handleGenerate}
                        disabled={!ready}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Sparkles size={14} />
                        Generate Subtasks
                    </button>
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                </div>
                {!ready && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Configure an AI provider in Account settings first.
                    </p>
                )}
            </div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 text-center">
                <Loader2 size={20} className="animate-spin text-indigo-500 mx-auto mb-2" />
                <p className="text-sm text-indigo-600">Breaking down task...</p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={16} className="text-rose-500" />
                    <span className="text-sm font-semibold text-rose-700">Failed</span>
                </div>
                <p className="text-xs text-rose-600 mb-3">{error}</p>
                <div className="flex gap-2">
                    <button
                        onClick={handleGenerate}
                        className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-lg transition-colors"
                    >
                        Retry
                    </button>
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // Suggestions state
    if (suggestions) {
        return (
            <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
                    <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-500" />
                        <span className="text-sm font-semibold text-indigo-700">Suggested Subtasks</span>
                    </div>
                </div>
                <div className="p-3 space-y-2">
                    {suggestions.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700">{s.title}</p>
                                {s.estimatedMinutes > 0 && (
                                    <p className="text-xs text-slate-400 mt-0.5">~{s.estimatedMinutes} min</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
                    <button
                        onClick={handleReject}
                        className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                    >
                        <X size={14} />
                        Discard
                    </button>
                    <button
                        onClick={handleGenerate}
                        className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                        Regenerate
                    </button>
                    <button
                        onClick={handleAccept}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1"
                    >
                        <Check size={14} />
                        Use These
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

export default AITaskSplitter;
