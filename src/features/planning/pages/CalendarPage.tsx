import React, { useState, useEffect } from 'react';
import { useTasks } from '../../tasks/hooks/useTasks';
import { parseDueDate } from '../../tasks/utils/dueDates';
import { useClasses } from '../../school/hooks/useClasses';
import { useClassSessions } from '../../school/hooks/useClassSessions';
import { useAssignments } from '../../school/hooks/useAssignments';
import { useAuth } from '../../../hooks/useAuth';
import { supabase, dbToCalendarEvent, type DbCalendarEvent } from '../../../services/supabase';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    addMonths,
    subMonths,
    isToday,
    getDay,
} from 'date-fns';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    CheckCircle,
    Circle,
    Clock,
    MapPin,
    Settings,
    GraduationCap,
} from 'lucide-react';
import CalendarSettingsModal from '../components/calendar/CalendarSettingsModal';
import type { CalendarEvent } from '../../../types/planning';

const CalendarPage: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const { tasks: allTodos } = useTasks();
    const { user } = useAuth();
    const { classes } = useClasses();
    const { sessions } = useClassSessions();
    const { assignments } = useAssignments();
    const classMap = new Map(classes.map((c) => [c.id, c]));
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [showSettings, setShowSettings] = useState(false);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const startPadding = Array(monthStart.getDay()).fill(null);

    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    useEffect(() => {
        const fetchCalendarEvents = async () => {
            if (!user?.id) return;

            try {
                const { data, error } = await supabase
                    .from('calendar_events')
                    .select('*')
                    .eq('user_id', user.id)
                    .gte('start_time', monthStart.toISOString())
                    .lte('start_time', monthEnd.toISOString())
                    .order('start_time', { ascending: true });

                if (error) {
                    console.error('Failed to fetch calendar events:', error);
                    return;
                }

                const events = ((data as DbCalendarEvent[]) || []).map(dbToCalendarEvent);
                setCalendarEvents(events);
            } catch (err) {
                console.error('Error fetching calendar events:', err);
            }
        };

        fetchCalendarEvents();
    }, [user?.id, currentDate]);

    const getTodosForDay = (date: Date) => {
        return allTodos.filter((t) => t.dueDate && isSameDay(parseDueDate(t.dueDate), date));
    };

    const getCalendarEventsForDay = (date: Date) => {
        return calendarEvents.filter((e) => isSameDay(new Date(e.startTime), date));
    };

    const getClassSessionsForDay = (date: Date) => {
        const dow = getDay(date);
        return sessions.filter((s) => s.dayOfWeek === dow);
    };

    const getAssignmentsForDay = (date: Date) => {
        return assignments.filter((a) => isSameDay(new Date(a.deadline), date));
    };

    const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

    return (
        <div className="app-page">
            <header>
                <div className="px-1 pb-1 pt-1.5 text-[22px] font-black text-cove-ink">
                    Calendar
                </div>
                <div className="px-1 pb-4 text-[13.5px] font-semibold text-cove-muted">
                    Classes, deadlines, events, and tasks — one month at a glance.
                </div>
                <div className="flex items-center justify-between gap-2">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="app-icon-button"
                        aria-label="Calendar Settings"
                    >
                        <Settings size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <button onClick={prevMonth} className="app-icon-button">
                            <ChevronLeft size={20} />
                        </button>
                        <span className="w-32 text-center text-[14.5px] font-extrabold text-cove-ink">
                            {format(currentDate, 'MMMM yyyy')}
                        </span>
                        <button onClick={nextMonth} className="app-icon-button">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="app-surface overflow-hidden">
                <div className="grid grid-cols-7 bg-[#eef6fa]">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                        <div
                            key={d}
                            className="py-2 text-center text-[11px] font-extrabold text-cove-soft uppercase tracking-wider"
                        >
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 text-sm">
                    {startPadding.map((_, i) => (
                        <div
                            key={`pad-${i}`}
                            className="h-24 border-b border-r border-cove-border/30 bg-[#eef6fa]/60 lg:h-32"
                        />
                    ))}

                    {days.map((day) => {
                        const dayTodos = getTodosForDay(day);
                        const dayEvents = getCalendarEventsForDay(day);
                        const daySessions = getClassSessionsForDay(day);
                        const dayAssignments = getAssignmentsForDay(day);
                        const totalItems =
                            dayTodos.length +
                            dayEvents.length +
                            daySessions.length +
                            dayAssignments.length;
                        const isSelected = selectedDay && isSameDay(day, selectedDay);
                        const isCurrent = isToday(day);

                        let slotsLeft = 3;
                        const sessionChips = daySessions.slice(0, slotsLeft);
                        slotsLeft -= sessionChips.length;
                        const assignmentChips = dayAssignments.slice(0, slotsLeft);
                        slotsLeft -= assignmentChips.length;
                        const eventChips = dayEvents.slice(0, slotsLeft);
                        slotsLeft -= eventChips.length;
                        const todoChips = dayTodos.slice(0, slotsLeft);

                        return (
                            <div
                                key={day.toISOString()}
                                onClick={() => setSelectedDay(day)}
                                className={`relative h-24 cursor-pointer border-b border-r border-cove-border/30 p-1 transition-colors lg:h-32 ${
                                    isSelected
                                        ? 'bg-cove-tint-blue ring-inset ring-2 ring-cove-accent'
                                        : 'hover:bg-[#eef6fa]'
                                }`}
                            >
                                <span
                                    className={`inline-block w-6 h-6 text-center leading-6 rounded-full font-bold text-xs ${
                                        isCurrent ? 'bg-cove-accent text-white' : 'text-cove-ink'
                                    }`}
                                >
                                    {format(day, 'd')}
                                </span>

                                <div className="mt-1 space-y-1">
                                    {sessionChips.map((s) => {
                                        const cls = classMap.get(s.classId);
                                        return (
                                            <div
                                                key={s.id}
                                                className="text-[10px] truncate px-1 rounded flex items-center gap-1"
                                                style={{
                                                    backgroundColor: cls
                                                        ? cls.color + '22'
                                                        : '#e3f0fa',
                                                    color: cls?.color ?? '#4d9fd6',
                                                }}
                                            >
                                                <div
                                                    className="w-1 h-1 rounded-full flex-shrink-0"
                                                    style={{
                                                        backgroundColor: cls?.color ?? '#4d9fd6',
                                                    }}
                                                />
                                                {s.startTime.slice(0, 5)} {cls?.name ?? 'Class'}
                                            </div>
                                        );
                                    })}
                                    {assignmentChips.map((a) => {
                                        const cls = classMap.get(a.classId);
                                        const isDone =
                                            a.status === 'submitted' || a.status === 'graded';
                                        return (
                                            <div
                                                key={a.id}
                                                className={`text-[10px] truncate px-1 rounded flex items-center gap-1 ${isDone ? 'bg-cove-track/60 text-cove-faint line-through' : 'bg-cove-tint-pink text-cove-pink'}`}
                                            >
                                                <div
                                                    className="w-1 h-1 rounded-full flex-shrink-0"
                                                    style={{
                                                        backgroundColor: cls?.color ?? '#e8899a',
                                                    }}
                                                />
                                                {format(new Date(a.deadline), 'HH:mm')} {a.title}
                                            </div>
                                        );
                                    })}
                                    {eventChips.map((event) => (
                                        <div
                                            key={event.id}
                                            className="text-[10px] truncate px-1 rounded flex items-center gap-1 bg-cove-tint-purple text-cove-purple"
                                        >
                                            <div className="w-1 h-1 rounded-full bg-cove-purple" />
                                            {format(new Date(event.startTime), 'HH:mm')}{' '}
                                            {event.title}
                                        </div>
                                    ))}
                                    {todoChips.map((todo) => (
                                        <div
                                            key={todo.id}
                                            className={`text-[10px] truncate px-1 rounded flex items-center gap-1 ${
                                                todo.completed
                                                    ? 'bg-cove-track/60 text-cove-faint line-through'
                                                    : 'bg-cove-tint-blue text-cove-accent'
                                            }`}
                                        >
                                            <div
                                                className={`w-1 h-1 rounded-full ${todo.completed ? 'bg-cove-faint' : 'bg-cove-accent'}`}
                                            />
                                            {todo.title}
                                        </div>
                                    ))}
                                    {totalItems > 3 && (
                                        <div className="text-[9px] font-bold text-cove-faint pl-1">
                                            +{totalItems - 3} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {selectedDay && (
                <div className="app-surface p-5 animate-in slide-in-from-bottom-2 fade-in">
                    <h3 className="text-[15px] font-extrabold text-cove-ink mb-4 border-b border-cove-border/50 pb-2">
                        {format(selectedDay, 'EEEE, MMMM do')}
                    </h3>

                    {getTodosForDay(selectedDay).length === 0 &&
                    getCalendarEventsForDay(selectedDay).length === 0 &&
                    getClassSessionsForDay(selectedDay).length === 0 &&
                    getAssignmentsForDay(selectedDay).length === 0 ? (
                        <p className="text-cove-soft font-semibold italic">
                            No events or tasks scheduled for this day.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {getClassSessionsForDay(selectedDay).length > 0 && (
                                <div>
                                    <h4 className="app-label mb-2">Classes</h4>
                                    <div className="space-y-2">
                                        {getClassSessionsForDay(selectedDay).map((s) => {
                                            const cls = classMap.get(s.classId);
                                            return (
                                                <div
                                                    key={s.id}
                                                    className="flex items-start gap-3 p-3 rounded-lg border"
                                                    style={{
                                                        backgroundColor: cls
                                                            ? cls.color + '11'
                                                            : '#e3f0fa',
                                                        borderColor: cls
                                                            ? cls.color + '44'
                                                            : '#bfe2f5',
                                                    }}
                                                >
                                                    <GraduationCap
                                                        size={16}
                                                        className="mt-0.5 shrink-0"
                                                        style={{ color: cls?.color ?? '#4d9fd6' }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-cove-ink">
                                                            {cls?.name ?? 'Class'}
                                                        </div>
                                                        <div className="text-xs font-semibold text-cove-muted mt-0.5">
                                                            {s.startTime.slice(0, 5)} –{' '}
                                                            {s.endTime.slice(0, 5)}
                                                            {s.location && (
                                                                <span> · {s.location}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {getAssignmentsForDay(selectedDay).length > 0 && (
                                <div>
                                    <h4 className="app-label mb-2">School deadlines</h4>
                                    <div className="space-y-2">
                                        {getAssignmentsForDay(selectedDay).map((a) => {
                                            const cls = classMap.get(a.classId);
                                            const deadline = new Date(a.deadline);
                                            const isDone =
                                                a.status === 'submitted' || a.status === 'graded';
                                            return (
                                                <div
                                                    key={a.id}
                                                    className={`flex items-start gap-3 p-3 rounded-lg ${isDone ? 'bg-[#eef6fa]' : 'bg-cove-tint-pink'}`}
                                                >
                                                    <Clock
                                                        size={16}
                                                        className={`mt-0.5 shrink-0 ${isDone ? 'text-cove-faint' : 'text-cove-pink'}`}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div
                                                            className={`font-bold truncate ${isDone ? 'text-cove-faint line-through' : 'text-cove-ink'}`}
                                                        >
                                                            {a.title}
                                                        </div>
                                                        <div className="text-xs font-semibold text-cove-muted mt-0.5">
                                                            {format(deadline, 'h:mm a')}
                                                            {cls && <span> · {cls.name}</span>}
                                                            {a.estimatedMinutes && (
                                                                <span>
                                                                    {' '}
                                                                    · {a.estimatedMinutes}m
                                                                </span>
                                                            )}
                                                        </div>
                                                        {a.description && (
                                                            <div className="text-xs text-slate-500 mt-1">
                                                                {a.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {getCalendarEventsForDay(selectedDay).length > 0 && (
                                <div>
                                    <h4 className="app-label mb-2">Calendar Events</h4>
                                    <div className="space-y-2">
                                        {getCalendarEventsForDay(selectedDay).map((event) => (
                                            <div
                                                key={event.id}
                                                className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100"
                                            >
                                                <CalendarIcon
                                                    size={16}
                                                    className="text-purple-600 mt-0.5 shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-slate-800 truncate">
                                                        {event.title}
                                                    </div>
                                                    <div className="text-xs text-slate-600 mt-1">
                                                        {format(
                                                            new Date(event.startTime),
                                                            'h:mm a',
                                                        )}{' '}
                                                        -{' '}
                                                        {format(new Date(event.endTime), 'h:mm a')}
                                                    </div>
                                                    {event.location && (
                                                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                            <MapPin size={12} />
                                                            {event.location}
                                                        </div>
                                                    )}
                                                    {event.description && (
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            {event.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {getTodosForDay(selectedDay).length > 0 && (
                                <div>
                                    <h4 className="app-label mb-2">Tasks</h4>
                                    <div className="space-y-2">
                                        {getTodosForDay(selectedDay).map((todo) => (
                                            <div key={todo.id} className="flex items-center gap-3">
                                                {todo.completed ? (
                                                    <CheckCircle
                                                        size={18}
                                                        className="text-emerald-500"
                                                    />
                                                ) : (
                                                    <Circle size={18} className="text-slate-300" />
                                                )}
                                                <span
                                                    className={
                                                        todo.completed
                                                            ? 'line-through text-slate-400'
                                                            : 'text-slate-700'
                                                    }
                                                >
                                                    {todo.title}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Settings Modal */}
            <CalendarSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </div>
    );
};

export default CalendarPage;
