/**
 * MorningProtocolsCard — active protocols (supplements/meds/practices) in the
 * morning routine.
 *
 * Surfaces every active protocol with a one-tap "Taken" / "Skip" so dose
 * logging happens inside the morning flow instead of on a separate page.
 * Renders nothing when no protocol is active.
 */
import React, { useState } from 'react';
import { format } from 'date-fns';
import { Check, Pill, X } from 'lucide-react';
import { useProtocols } from '../../health-tracking/hooks/useProtocols';
import { useToast } from '../../../components/ui/Toast';
import type { Protocol } from '../../health-tracking/types';

const MorningProtocolsCard: React.FC = () => {
    const { getActiveProtocols, getActiveCycle, logDose, skipDose, doses } = useProtocols();
    const toast = useToast();
    const [busyId, setBusyId] = useState<string | null>(null);

    const activeProtocols = getActiveProtocols();
    if (activeProtocols.length === 0) return null;

    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const doseToday = (protocolId: string) =>
        doses.find((d) => d.protocolId === protocolId && (d.takenAt ?? '').startsWith(todayKey));

    const doseLabel = (p: Protocol) =>
        p.doseAmount ? `${p.doseAmount}${p.doseUnit ? ` ${p.doseUnit}` : ''}` : null;

    const handle = async (p: Protocol, action: 'take' | 'skip') => {
        if (busyId) return;
        setBusyId(p.id);
        try {
            const cycleId = getActiveCycle(p.id)?.id;
            if (action === 'take') await logDose(p.id, cycleId);
            else await skipDose(p.id, cycleId, 'skipped in morning routine');
        } catch (err) {
            console.error('Failed to log dose:', err);
            toast.error(`Could not log ${p.name}.`);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-cove-border shadow-cove p-5 space-y-3">
            <div>
                <h2 className="font-semibold text-cove-ink flex items-center gap-2">
                    <Pill size={16} className="text-cove-success-deep" /> Protocols
                </h2>
                <p className="text-sm text-cove-soft mt-0.5">
                    Your active supplements, meds, and practices.
                </p>
            </div>
            <ul className="space-y-2">
                {activeProtocols.map((p) => {
                    const dose = doseToday(p.id);
                    const done = !!dose && !dose.skipped;
                    const skipped = !!dose && dose.skipped;
                    return (
                        <li
                            key={p.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border ${
                                done
                                    ? 'bg-cove-tint-green border-cove-success'
                                    : skipped
                                      ? 'bg-[color:var(--buddy-surface-soft)] border-cove-border'
                                      : 'border-cove-border'
                            }`}
                        >
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-cove-ink truncate">{p.name}</p>
                                <p className="text-xs text-cove-faint">
                                    {[doseLabel(p), p.timingNotes].filter(Boolean).join(' · ') ||
                                        p.frequency}
                                </p>
                            </div>
                            {done ? (
                                <span className="text-xs font-bold text-cove-success-deep flex items-center gap-1">
                                    <Check size={13} /> Taken
                                </span>
                            ) : skipped ? (
                                <span className="text-xs font-bold text-cove-soft">Skipped</span>
                            ) : (
                                <div className="flex gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => void handle(p, 'take')}
                                        disabled={busyId === p.id}
                                        className="px-3 py-1.5 text-xs font-bold text-white bg-cove-success hover:bg-cove-success-deep rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        Taken
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handle(p, 'skip')}
                                        disabled={busyId === p.id}
                                        aria-label={`Skip ${p.name}`}
                                        className="p-1.5 text-cove-faint hover:text-cove-muted hover:bg-[color:var(--buddy-surface-soft)] rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        <X size={15} />
                                    </button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default MorningProtocolsCard;
