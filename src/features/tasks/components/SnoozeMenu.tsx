import React, { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import PortalMenu from './PortalMenu';

interface SnoozeMenuProps {
    /** Ref to the trigger element the menu anchors to. */
    anchorRef: React.RefObject<HTMLElement | null>;
    /** Called with new dueDate (YYYY-MM-DD) and optional dueTime (HH:MM) */
    onSnooze: (dueDate: string, dueTime?: string) => void;
    onClose: () => void;
}

function toIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function tonight(): { date: string; time: string } {
    return { date: toIso(new Date()), time: '18:00' };
}

function tomorrow(): { date: string } {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return { date: toIso(d) };
}

function thisWeekend(): { date: string } {
    const d = new Date();
    const diff = ((6 - d.getDay()) + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return { date: toIso(d) };
}

function nextWeek(): { date: string } {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return { date: toIso(d) };
}

const SnoozeMenu: React.FC<SnoozeMenuProps> = ({ anchorRef, onSnooze, onClose }) => {
    const [picking, setPicking] = useState(false);
    const [customDate, setCustomDate] = useState('');

    return (
        <PortalMenu anchorRef={anchorRef} open onClose={onClose} width={176}>
            {!picking ? (
                <>
                    <button onClick={() => { const t = tonight(); onSnooze(t.date, t.time); }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700">
                        Tonight <span className="text-xs text-slate-400">· 6pm</span>
                    </button>
                    <button onClick={() => onSnooze(tomorrow().date)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700">
                        Tomorrow
                    </button>
                    <button onClick={() => onSnooze(thisWeekend().date)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700">
                        This weekend
                    </button>
                    <button onClick={() => onSnooze(nextWeek().date)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700">
                        Next week
                    </button>
                    <button onClick={() => setPicking(true)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-indigo-600 border-t border-slate-100 flex items-center gap-2">
                        <CalendarIcon size={13} /> Pick date…
                    </button>
                </>
            ) : (
                <div className="p-2 space-y-2">
                    <input
                        type="date"
                        value={customDate}
                        onChange={e => setCustomDate(e.target.value)}
                        className="w-full text-sm rounded border border-slate-200 px-2 py-1"
                    />
                    <button
                        disabled={!customDate}
                        onClick={() => customDate && onSnooze(customDate)}
                        className="w-full bg-indigo-600 text-white rounded px-2 py-1 text-sm font-medium disabled:opacity-40"
                    >
                        Snooze
                    </button>
                </div>
            )}
        </PortalMenu>
    );
};

export default SnoozeMenu;
