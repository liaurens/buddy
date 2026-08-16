import React, { useState } from 'react';
import {
    CheckCircle,
    XCircle,
    ListTodo,
    StickyNote,
    Calendar,
    Activity,
    Bell,
    TrendingUp,
    HelpCircle,
    HelpingHand,
    GraduationCap,
} from 'lucide-react';
import type { AssistantResponse } from '../types';
import { invokeAssistantAction } from '../services/assistant.service';

interface AssistantResponseCardProps {
    response: AssistantResponse;
    onNavigate?: (route: string) => void;
}

interface ClarifyCandidate {
    intent: string;
    domain: string;
    label: string;
}

function ClarifyCandidates({ response }: { response: AssistantResponse }) {
    const candidates = (response.data?.candidates as ClarifyCandidate[] | undefined) ?? [];
    const original = typeof response.data?.original === 'string' ? response.data.original : '';
    const [resolved, setResolved] = useState<{
        label: string;
        ok: boolean;
        message: string;
    } | null>(null);
    const [busy, setBusy] = useState(false);

    if (resolved) {
        return (
            <p className="mt-2 text-xs text-cove-muted">
                Routed as <span className="font-bold text-cove-ink">{resolved.label}</span>
                {resolved.message ? ` — ${resolved.message}` : ''}.
            </p>
        );
    }

    const pick = async (c: ClarifyCandidate) => {
        if (busy) return;
        setBusy(true);
        const result = await invokeAssistantAction(c.domain, c.intent, { content: original });
        setResolved({
            label: c.label,
            ok: result.success,
            message: result.action_taken || (result.success ? 'Done' : 'Something went wrong'),
        });
        setBusy(false);
    };

    return (
        <div className="mt-3 flex flex-wrap gap-2">
            {candidates.map((c) => (
                <button
                    key={`${c.domain}:${c.intent}`}
                    onClick={() => pick(c)}
                    disabled={busy}
                    className="rounded-full border-0 bg-cove-tint-blue px-3 py-1.5 text-xs font-extrabold text-cove-ink transition-colors hover:bg-cove-accent-pale disabled:opacity-50"
                >
                    {c.label}
                </button>
            ))}
        </div>
    );
}

function intentIcon(intent: string, domain?: string) {
    // Domain-based icons (preferred when available)
    // One Cove hue per domain. Danger is reserved for actual failures, so school
    // takes pink rather than the old rose-600.
    if (domain === 'school') return <GraduationCap size={16} className="text-cove-pink" />;
    if (domain === 'improvement') return <TrendingUp size={16} className="text-cove-success" />;
    if (domain === 'extra') return <HelpCircle size={16} className="text-cove-soft" />;

    // Intent-based icons (fallback)
    if (intent.startsWith('school')) return <GraduationCap size={16} className="text-cove-pink" />;
    if (intent.startsWith('note')) return <StickyNote size={16} className="text-cove-purple" />;
    if (intent.startsWith('task')) return <ListTodo size={16} className="text-cove-accent" />;
    if (intent.startsWith('tracker')) return <Activity size={16} className="text-cove-success" />;
    if (intent.startsWith('calendar'))
        return <Calendar size={16} className="text-cove-accent-light" />;
    if (intent.startsWith('notification'))
        return <Bell size={16} className="text-cove-streak-deep" />;
    return null;
}

function intentRoute(intent: string, domain?: string): string | null {
    // Domain-based routing
    if (domain === 'health') return 'health';
    if (domain === 'planning') {
        if (intent.startsWith('calendar')) return 'calendar';
        return 'tasks';
    }
    if (domain === 'content') return 'notes';

    // Intent-based fallback
    if (intent.startsWith('note')) return 'notes';
    if (intent.startsWith('task')) return 'tasks';
    if (intent.startsWith('tracker')) return 'health';
    if (intent.startsWith('calendar')) return 'calendar';
    if (intent.startsWith('habits')) return 'tasks';
    return null;
}

function TaskList({ tasks }: { tasks: Array<{ id: string; title: string; due_date?: string }> }) {
    if (!tasks.length) return <p className="text-xs text-cove-faint">No tasks found.</p>;
    return (
        <ul className="mt-2 space-y-1">
            {tasks.slice(0, 6).map((task) => (
                <li key={task.id} className="flex items-start gap-2 text-sm text-cove-muted">
                    <span className="mt-0.5 w-4 h-4 rounded border border-cove-border flex-shrink-0" />
                    <span className="flex-1">{task.title}</span>
                    {task.due_date && (
                        <span className="text-[11px] text-cove-faint flex-shrink-0">
                            {task.due_date}
                        </span>
                    )}
                </li>
            ))}
        </ul>
    );
}

function StepsList({ steps }: { steps: NonNullable<AssistantResponse['steps']> }) {
    if (!steps.length) return null;
    return (
        <ul className="mt-3 space-y-1.5">
            {steps.map((step) => {
                const ok = step.result.success;
                const errorDetail =
                    !ok && typeof step.result.data?.error === 'string'
                        ? (step.result.data.error as string)
                        : null;
                return (
                    <li key={step.id} className="flex items-start gap-2 text-xs">
                        {ok ? (
                            <CheckCircle
                                size={14}
                                className="text-cove-success flex-shrink-0 mt-0.5"
                            />
                        ) : (
                            <XCircle size={14} className="text-cove-danger flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className={ok ? 'text-cove-muted' : 'text-cove-danger-deep'}>
                                {step.result.action_taken}
                            </p>
                            {errorDetail && (
                                <p className="text-[11px] text-cove-danger mt-0.5">{errorDetail}</p>
                            )}
                        </div>
                        <span className="text-[10px] font-mono text-cove-faint flex-shrink-0">
                            {step.action}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

function EventList({ events }: { events: Array<{ title: string; start: string; end?: string }> }) {
    if (!events.length) return <p className="text-xs text-cove-faint">No events today.</p>;
    return (
        <ul className="mt-2 space-y-1">
            {events.map((event, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-cove-muted">
                    <span className="text-xs font-mono text-cove-faint w-10 flex-shrink-0">
                        {event.start}
                    </span>
                    <span>{event.title}</span>
                </li>
            ))}
        </ul>
    );
}

const AssistantResponseCard: React.FC<AssistantResponseCardProps> = ({ response, onNavigate }) => {
    const route = intentRoute(response.intent, response.domain);
    const isClarify = response.data?.clarify === true;

    return (
        <div
            role="status"
            aria-live="polite"
            className={`rounded-card border-0 p-4 text-sm shadow-cove transition-all ${
                isClarify
                    ? 'bg-cove-tint-amber'
                    : response.success
                      ? 'bg-white'
                      : 'bg-cove-tint-danger'
            }`}
        >
            {/* Header row */}
            <div className="flex items-start gap-2">
                <div className="mt-0.5 flex-shrink-0">
                    {isClarify ? (
                        <HelpingHand size={16} className="text-cove-streak-deep" />
                    ) : response.success ? (
                        <CheckCircle size={16} className="text-cove-success" />
                    ) : (
                        <XCircle size={16} className="text-cove-danger" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-cove-ink leading-snug">{response.action_taken}</p>
                    {response.error && (
                        <p className="text-xs text-cove-danger mt-0.5">{response.error}</p>
                    )}
                </div>
                <div className="flex-shrink-0">{intentIcon(response.intent, response.domain)}</div>
            </div>

            {isClarify && <ClarifyCandidates response={response} />}

            {/* Multi-step agent results */}
            {response.steps && response.steps.length > 0 && <StepsList steps={response.steps} />}

            {/* Inline data display */}
            {response.success && response.data && (
                <>
                    {/* Task list */}
                    {Array.isArray(response.data.tasks) && (
                        <TaskList
                            tasks={
                                response.data.tasks as Array<{
                                    id: string;
                                    title: string;
                                    due_date?: string;
                                }>
                            }
                        />
                    )}

                    {/* Calendar events */}
                    {Array.isArray(response.data.events) && (
                        <EventList
                            events={response.data.events as Array<{ title: string; start: string }>}
                        />
                    )}

                    {/* Tracker summary */}
                    {response.data.summary && typeof response.data.summary === 'object' && (
                        <div className="mt-2 grid grid-cols-2 gap-1">
                            {Object.entries(
                                response.data.summary as Record<
                                    string,
                                    { avg: number; count: number }
                                >,
                            ).map(([metric, stats]) => (
                                <div
                                    key={metric}
                                    className="bg-cove-tint-blue rounded-xl px-2 py-1"
                                >
                                    <p className="text-[10px] font-bold text-cove-accent uppercase tracking-wide">
                                        {metric}
                                    </p>
                                    <p className="text-sm font-bold text-cove-ink">{stats.avg}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Help: command list */}
                    {typeof response.data.help === 'string' && (
                        <div className="mt-2 space-y-0.5">
                            {(response.data.help as string).split('\n').map((line, i) => {
                                const [cmd, ...desc] = line.split(' — ');
                                return (
                                    <div key={i} className="flex gap-2 text-xs">
                                        <span className="font-mono text-cove-accent w-20 flex-shrink-0">
                                            {cmd}
                                        </span>
                                        <span className="text-cove-soft">{desc.join(' — ')}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Navigation button */}
            {response.success && route && onNavigate && (
                <button
                    onClick={() => onNavigate(route)}
                    className="mt-3 text-xs font-bold text-cove-accent hover:text-cove-ink transition-colors"
                    aria-label={`Navigate to ${route}`}
                >
                    View in {route.charAt(0).toUpperCase() + route.slice(1)} →
                </button>
            )}
        </div>
    );
};

export default AssistantResponseCard;
