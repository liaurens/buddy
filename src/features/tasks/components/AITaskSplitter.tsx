/**
 * AITaskSplitter — "this is too big to start, break it up for me".
 *
 * Rendered inside TaskDetailSheet's Steps section. Calls the assistant's
 * `planning / task.ai.split` action and hands the accepted steps back to the
 * sheet's draft; nothing here writes to the database. Accepted and discarded
 * splits are remembered in localStorage and fed back as worked examples — the
 * same shape of learning loop triage uses.
 */

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { splitTask } from '../../assistant/services/ai-actions.service';
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
    } catch {
        /* ignore */
    }
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
    const historyContext =
        learning.history.length > 0
            ? `\n\nPrevious task splits the user has done (learn from these):\n${learning.history
                  .filter((h) => h.accepted)
                  .slice(-5)
                  .map((h) => `- "${h.originalTask}" → ${h.subtasks.join(', ')}`)
                  .join('\n')}`
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
${task.taskTypeId ? `Type: ${task.taskTypeId}` : ''}`;

    return { system, user };
}

const AITaskSplitter: React.FC<AITaskSplitterProps> = ({ task, onSplit, onCancel }) => {
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<SplitSuggestion[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);

        try {
            const learning = getLearningData();
            const prompt = buildSplitPrompt(task, learning);

            const result = await splitTask({
                title: task.title,
                estimatedMinutes: task.estimatedTime || 60,
                systemPrompt: prompt.system,
                userPrompt: prompt.user,
            });
            setSuggestions(result.subtasks);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = () => {
        if (!suggestions) return;

        const subtasks: Subtask[] = suggestions.map((s) => ({
            id: uuidv4(),
            title: s.title,
            completed: false,
        }));

        // Save to learning data
        const learning = getLearningData();
        learning.history.push({
            originalTask: task.title,
            subtasks: suggestions.map((s) => s.title),
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
                subtasks: suggestions.map((s) => s.title),
                accepted: false,
                timestamp: new Date().toISOString(),
            });
            saveLearningData(learning);
        }
        onCancel();
    };

    // Initial state — offer the split
    if (!suggestions && !loading && !error) {
        return (
            <div className="rounded-xl bg-cove-tint-purple p-3.5">
                <div className="pb-2.5 text-[12.5px] font-bold leading-snug text-cove-muted">
                    Buddy can break this into a few steps you could actually start.
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => void handleGenerate()}
                        className="rounded-full bg-cove-ink px-3.5 py-1.5 text-[12.5px] font-extrabold text-white"
                    >
                        ✨ Break it up
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-full bg-transparent px-3 py-1.5 text-[12.5px] font-extrabold text-cove-faint"
                    >
                        Not now
                    </button>
                </div>
            </div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <div className="rounded-xl bg-cove-tint-purple p-3.5 text-[12.5px] font-extrabold text-cove-muted">
                Thinking about the steps…
            </div>
        );
    }

    // Error state — never a dead end; adding steps by hand still works
    if (error) {
        return (
            <div className="rounded-xl bg-cove-tint-danger p-3.5">
                <div className="pb-2.5 text-[12.5px] font-bold leading-snug text-cove-danger-deep">
                    Buddy couldn’t split that — {error}. Adding steps by hand works too.
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => void handleGenerate()}
                        className="rounded-full bg-cove-ink px-3.5 py-1.5 text-[12.5px] font-extrabold text-white"
                    >
                        Try again
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-full bg-transparent px-3 py-1.5 text-[12.5px] font-extrabold text-cove-faint"
                    >
                        Not now
                    </button>
                </div>
            </div>
        );
    }

    // Suggestions state
    if (suggestions) {
        return (
            <div className="cove-fadeslide rounded-xl bg-cove-tint-purple p-3.5">
                <div className="pb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-cove-faint">
                    Buddy suggests
                </div>
                <div className="flex flex-col gap-1.5 pb-3">
                    {suggestions.map((s, i) => (
                        <div
                            key={i}
                            className="flex items-start gap-2.5 rounded-xl bg-white px-3 py-2"
                        >
                            <span className="shrink-0 pt-px text-[12.5px] font-extrabold text-cove-faint">
                                {i + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[13.5px] font-bold leading-snug text-cove-ink">
                                    {s.title}
                                </span>
                                {s.estimatedMinutes > 0 ? (
                                    <span className="block pt-0.5 text-[11.5px] font-semibold text-cove-faint">
                                        ~{s.estimatedMinutes} min
                                    </span>
                                ) : null}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handleAccept}
                        className="rounded-full bg-cove-ink px-3.5 py-1.5 text-[12.5px] font-extrabold text-white"
                    >
                        Use these steps
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleGenerate()}
                        className="rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-extrabold text-cove-muted"
                    >
                        Try again
                    </button>
                    <button
                        type="button"
                        onClick={handleReject}
                        className="rounded-full bg-transparent px-3 py-1.5 text-[12.5px] font-extrabold text-cove-faint"
                    >
                        Discard
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

export default AITaskSplitter;
