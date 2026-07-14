/**
 * TriageInboxCard — home-screen entry to the capture-inbox triage flow.
 *
 * Sits at the same visual weight as the Daily Routine card. Counts the inbox
 * locally (no AI sort fires on the home screen — the count is a plain filter).
 * Tapping opens the full TriageInbox in a modal, which is where the AI sort
 * runs. Self-contained: it does not depend on the Tasks-tab triage wiring.
 * Hides itself when the inbox is empty.
 */

import React, { useState } from 'react';
import { Inbox, Sparkles, ChevronRight, X } from 'lucide-react';
import { useTasks } from '../../tasks/hooks/useTasks';
import { countInbox } from '../../tasks/utils/inbox';
import TriageInbox from '../../tasks/components/TriageInbox';

const TriageInboxCard: React.FC = () => {
    const { tasks } = useTasks();
    const count = countInbox(tasks);
    const [open, setOpen] = useState(false);

    if (count === 0) return null;

    return (
        <>
            <section className="app-surface">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="group w-full p-5 text-left"
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                                <Inbox size={18} className="text-indigo-600" />
                            </span>
                            <div>
                                <h2 className="text-base font-semibold text-slate-950">
                                    Reorganize tasks
                                </h2>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    {count} captured {count === 1 ? 'task' : 'tasks'} to sort
                                </p>
                            </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-sm font-semibold text-indigo-700">
                            {count}
                        </span>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                        <Sparkles size={14} className="text-violet-500" />
                        AI pre-sorts them — review &amp; route in one tap.
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex w-full items-center justify-between border-t border-slate-100 px-5 py-3 text-sm font-medium text-indigo-900 transition-colors hover:bg-slate-50"
                >
                    <span>Sort inbox</span>
                    <ChevronRight size={15} className="text-slate-400" />
                </button>
            </section>

            {open && (
                <div
                    className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                            <div className="flex items-center gap-2">
                                <Sparkles size={18} className="text-indigo-500" />
                                <h2 className="text-base font-semibold text-slate-900">
                                    Sort your inbox
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="app-icon-button"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-5">
                            <TriageInbox onDone={() => setOpen(false)} />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TriageInboxCard;
