import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { useLatestInsight } from '../hooks/useLatestInsight';

const SEVERITY_STYLES: Record<string, string> = {
    info: 'bg-indigo-50 border-indigo-100 text-indigo-950',
    nudge: 'bg-amber-50 border-amber-200 text-amber-900',
    urgent: 'bg-rose-50 border-rose-200 text-rose-900',
};

const InsightCard: React.FC = () => {
    const { finding, dismiss } = useLatestInsight();

    if (!finding) return null;

    return (
        <section className={`rounded-xl border p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ${SEVERITY_STYLES[finding.severity] || SEVERITY_STYLES.info}`}>
            <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-white/70 p-2 text-indigo-700">
                    <Sparkles size={17} />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-slate-950">Insight</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{finding.summary}</p>
                </div>
                <button
                    onClick={dismiss}
                    className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-700"
                    aria-label="Dismiss"
                >
                    <X size={16} />
                </button>
            </div>
        </section>
    );
};

export default InsightCard;
