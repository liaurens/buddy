import React from 'react';
import { Calendar as CalendarIcon, Check, MapPin, Clock } from 'lucide-react';
import type { Task } from '../../tasks/types';
import type { CalendarEvent } from '../../planning/types';
import type { TimelineItem } from '../hooks/useTodayItems';

interface TodayTimelineProps {
    /** Time-ordered events + timed picks. */
    timedItems: TimelineItem[];
    /** Picks without a time slot. */
    untimedPicks: Task[];
    /** Accent for the picks (light = amber, full = indigo). */
    accent?: 'amber' | 'indigo';
    /** Called when a pick row is tapped (e.g. to toggle complete). */
    onTogglePick?: (task: Task) => void;
    /** Called when the user clears the time on a pick (pencil/clear time). Optional. */
    onClearPickTime?: (task: Task) => void;
    /** Render-mode for picks: 'check' toggles completion, 'plain' just shows status. */
    pickInteraction?: 'check' | 'plain';
    /** If true, untimed picks section is hidden (Full surfaces it elsewhere). */
    hideUntimed?: boolean;
}

const ACCENTS = {
    amber: {
        pickBorder: 'border-amber-200',
        pickBg: 'bg-amber-50/60',
        pickCheck: 'border-amber-500 bg-amber-500',
        pickDot: 'border-amber-300',
        timeText: 'text-amber-700',
    },
    indigo: {
        pickBorder: 'border-indigo-200',
        pickBg: 'bg-indigo-50/60',
        pickCheck: 'border-indigo-600 bg-indigo-600',
        pickDot: 'border-indigo-300',
        timeText: 'text-indigo-700',
    },
} as const;

function EventRow({ event }: { event: CalendarEvent }) {
    return (
        <div className="flex items-start gap-3 p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
            <CalendarIcon size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{event.title}</p>
                {event.location && (
                    <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> {event.location}
                    </p>
                )}
            </div>
        </div>
    );
}

function PickRow({
    task,
    accent,
    onToggle,
    onClearTime,
    interaction,
}: {
    task: Task;
    accent: keyof typeof ACCENTS;
    onToggle?: (t: Task) => void;
    onClearTime?: (t: Task) => void;
    interaction: 'check' | 'plain';
}) {
    const cls = ACCENTS[accent];
    const isClickable = interaction === 'check' && !!onToggle;
    return (
        <div
            className={`flex items-start gap-3 p-2.5 rounded-xl border transition-colors ${
                task.completed ? 'bg-green-50 border-green-200' : `${cls.pickBg} ${cls.pickBorder}`
            }`}
        >
            <button
                onClick={isClickable ? () => onToggle?.(task) : undefined}
                disabled={!isClickable}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors mt-0.5 ${
                    task.completed
                        ? 'border-green-500 bg-green-500'
                        : isClickable ? cls.pickCheck : cls.pickDot
                } ${isClickable ? 'cursor-pointer' : ''}`}
                aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
            >
                {task.completed && <Check size={11} className="text-white" />}
            </button>
            <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${task.completed ? 'text-green-800 line-through' : 'text-slate-800'} truncate`}>
                    {task.title}
                </p>
                {task.estimatedTime && (
                    <p className="text-xs text-slate-400 mt-0.5">{task.estimatedTime}m</p>
                )}
            </div>
            {task.dueTime && onClearTime && (
                <button
                    onClick={() => onClearTime(task)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5"
                    title="Clear time slot"
                >
                    clear
                </button>
            )}
        </div>
    );
}

const TodayTimeline: React.FC<TodayTimelineProps> = ({
    timedItems,
    untimedPicks,
    accent = 'amber',
    onTogglePick,
    onClearPickTime,
    pickInteraction = 'plain',
    hideUntimed,
}) => {
    const cls = ACCENTS[accent];
    const hasTimed = timedItems.length > 0;
    const hasUntimed = !hideUntimed && untimedPicks.length > 0;

    if (!hasTimed && !hasUntimed) {
        return (
            <div className="text-sm text-slate-400 italic flex items-center gap-2">
                <Clock size={14} />
                Nothing on the timeline yet.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {hasTimed && (
                <div className="space-y-1.5">
                    {timedItems.map(item => {
                        const time = item.time;
                        return (
                            <div key={`${item.kind}-${item.kind === 'event' ? item.event.id : item.task.id}`} className="flex items-start gap-3">
                                <div className={`w-12 flex-shrink-0 pt-2 font-mono text-xs ${item.kind === 'event' ? 'text-slate-500' : cls.timeText}`}>
                                    {time}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {item.kind === 'event'
                                        ? <EventRow event={item.event} />
                                        : <PickRow
                                            task={item.task}
                                            accent={accent}
                                            onToggle={onTogglePick}
                                            onClearTime={onClearPickTime}
                                            interaction={pickInteraction}
                                        />
                                    }
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {hasUntimed && (
                <div className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium pl-1">Anytime</p>
                    {untimedPicks.map(task => (
                        <PickRow
                            key={task.id}
                            task={task}
                            accent={accent}
                            onToggle={onTogglePick}
                            interaction={pickInteraction}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default TodayTimeline;
