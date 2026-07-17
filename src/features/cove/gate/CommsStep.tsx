import React, { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { getCategorySettings } from '../../../services/settings';
import type { CommsItem } from '../../../services/settings/settings.types';
import CommsSettingsModal from '../../day/components/CommsSettingsModal';
import PickCircle from '../components/PickCircle';

interface CommsStepProps {
    dateKey: string;
}

/**
 * Gate step 1 — the comms checklist (mail, portals, messengers, …) from the
 * user's comms settings, filtered by weekday. Checked state lives in the
 * same per-day sessionStorage key the old morning flow used.
 */
const CommsStep: React.FC<CommsStepProps> = ({ dateKey }) => {
    const { user } = useAuth();
    const [items, setItems] = useState<CommsItem[]>([]);
    const [loadError, setLoadError] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [checked, setChecked] = useState<Record<string, boolean>>(() => {
        try {
            const saved = sessionStorage.getItem(`morning_comms_${dateKey}`);
            return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
        } catch {
            return {};
        }
    });

    useEffect(() => {
        try {
            sessionStorage.setItem(`morning_comms_${dateKey}`, JSON.stringify(checked));
        } catch {
            /* ignore */
        }
    }, [checked, dateKey]);

    const loadItems = useCallback(() => {
        if (!user?.id) return;
        setLoadError(false);
        getCategorySettings(user.id, 'comms')
            .then((s) => {
                const dayOfWeek = new Date().getDay();
                setItems(
                    s.items.filter(
                        (item) => item.daysOfWeek === null || item.daysOfWeek.includes(dayOfWeek),
                    ),
                );
            })
            .catch((err) => {
                console.error('Failed to load comms items:', err);
                setLoadError(true);
            });
    }, [user?.id]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    return (
        <div className="cove-fadeslide mt-4">
            <div className="flex items-center justify-between px-0.5 pb-1">
                <div className="text-[15px] font-extrabold text-cove-ink">
                    Start with your comms
                </div>
                <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="p-1 text-cove-faint transition-colors hover:text-cove-muted"
                    aria-label="Customize comms items"
                >
                    <Settings size={15} />
                </button>
            </div>
            <div className="px-0.5 pb-3 text-[12.5px] font-semibold text-cove-soft">
                Check these before diving into your day.
            </div>

            {loadError ? (
                <div className="rounded-2xl bg-cove-tint-pink px-4 py-3 text-[12.5px] font-bold text-cove-pink">
                    Could not load your comms items. Check your connection.
                </div>
            ) : items.length === 0 ? (
                <div className="rounded-2xl bg-white/60 px-4 py-3 text-[12.5px] font-bold text-cove-soft">
                    Nothing for today — add comms items via the gear.
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {items.map((item) => {
                        const done = !!checked[item.id];
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                    setChecked((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                                }
                                className="flex items-center gap-[13px] rounded-2xl bg-white px-4 py-3.5 text-left shadow-cove"
                            >
                                <PickCircle done={done} size={28} />
                                <span
                                    className="flex-1 text-[14.5px] font-extrabold"
                                    style={{ color: done ? '#9cb9c9' : '#1d3a4d' }}
                                >
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {showSettings ? (
                <CommsSettingsModal
                    onClose={() => setShowSettings(false)}
                    onSaved={() => {
                        setShowSettings(false);
                        loadItems();
                    }}
                />
            ) : null}
        </div>
    );
};

export default CommsStep;
