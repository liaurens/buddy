import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { useLatestInsight } from '../hooks/useLatestInsight';

const SEVERITY_STYLES: Record<string, string> = {
    info: 'bg-violet-50 border-violet-200 text-violet-900',
    nudge: 'bg-amber-50 border-amber-200 text-amber-900',
    urgent: 'bg-rose-50 border-rose-200 text-rose-900',
};

const InsightCard: React.FC = () => {
    const { finding, dismiss } = useLatestInsight();

    if (!finding) return null;

    const style = SEVERITY_STYLES[finding.severity] || SEVERITY_STYLES.info;

    return (
        <section className={`rounded-2xl border p-4 shadow-sm ${style}`}>
            <div className="flex items-start gap-3">
                <div className="p-2 bg-white/60 rounded-lg mt-0.5">
                    <Sparkles size={18} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-70">Insight</h3>
                    <p className="text-sm font-medium mt-1 leading-snug">{finding.summary}</p>
                </div>
                <button
                    onClick={dismiss}
                    className="p-1 rounded hover:bg-white/40 transition-colors"
                    aria-label="Dismiss"
                >
                    <X size={16} />
                </button>
            </div>
        </section>
    );
};

export default InsightCard;
