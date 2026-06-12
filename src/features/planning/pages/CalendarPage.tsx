import React, { useState, useEffect } from 'react';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useClasses } from '../../school/hooks/useClasses';
import { useClassSessions } from '../../school/hooks/useClassSessions';
import { useAssignments } from '../../school/hooks/useAssignments';
import { useAuth } from '../../../hooks/useAuth';
import { supabase, dbToCalendarEvent, type DbCalendarEvent } from '../../../services/supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle, Circle, Clock, MapPin, Settings, GraduationCap } from 'lucide-react';
import CalendarSettingsModal from '../components/calendar/CalendarSettingsModal';
import type { CalendarEvent } from '../../../types/planning';

const CalendarPage: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const { tasks: allTodos } = useTasks();
    const { user } = useAuth();
    const { classes } = useClasses();
    const { sessions } = useClassSessions();
    const { assignments } = useAssignments();
    const classMap = new Map(classes.map(c => [c.id, c]));
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

                const events = (data as DbCalendarEvent[] || []).map(dbToCalendarEvent);
                setCalendarEvents(events);
            } catch (err) {
                console.error('Error fetching calendar events:', err);
            }
        };

        fetchCalendarEvents();
    }, [user?.id, currentDate]);

    const getTodosForDay = (date: Date) => {
        return allTodos.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), date));
    };

    const getCalendarEventsForDay = (date: Date) => {
        return calendarEvents.filter(e => isSameDay(new Date(e.startTime), date));
    };

    const getClassSessionsForDay = (date: Date) => {
        const dow = getDay(date);
        return sessions.filter(s => s.dayOfWeek === dow);
    };

    const getAssignmentsForDay = (date: Date) => {
        return assignments.filter(a => isSameDay(new Date(a.deadline), date));
    };

    const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

    return (
        <div className="app-page">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="app-title hidden items-center gap-3 lg:flex">
                    <div className="rounded-xl bg-rose-50 p-2 text-rose-600">
                        <CalendarIcon size={24} />
                    </div>
                    Calendar
                </h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="app-icon-button"
                        aria-label="Calendar Settings"
                    >
                        <Settings size={20} />
                    </button>
                    <div className="flex gap-2">
                        <button onClick={prevMonth} className="app-icon-button"><ChevronLeft size={20} /></button>
                        <span className="w-32 text-center text-base font-semibold">{format(currentDate, 'MMMM yyyy')}</span>
                        <button onClick={nextMonth} className="app-icon-button"><ChevronRight size={20} /></button>
                    </div>
                </div>
            </header>

            <div className="app-surface overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 text-sm">
                    {startPadding.map((_, i) => <div key={`pad-${i}`} className="h-24 border-b border-r border-slate-50 bg-slate-50/30 lg:h-32" />)}

                    {days.map(day => {
                        const dayTodos = getTodosForDay(day);
                        const dayEvents = getCalendarEventsForDay(day);
                        const daySessions = getClassSessionsForDay(day);
                        const dayAssignments = getAssignmentsForDay(day);
                        const totalItems = dayTodos.length + dayEvents.length + daySessions.length + dayAssignments.length;
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
                                className={`relative h-24 cursor-pointer border-b border-r border-slate-50 p-1 transition-colors lg:h-32 ${isSelected ? 'bg-indigo-50 ring-inset ring-2 ring-indigo-500' : 'hover:bg-slate-50'
                                    }`}
                            >
                                <span className={`inline-block w-6 h-6 text-center leading-6 rounded-full font-medium text-xs ${isCurrent ? 'bg-indigo-600 text-white' : 'text-slate-700'
                                    }`}>
                                    {format(day, 'd')}
                                </span>

                                <div className="mt-1 space-y-1">
                                    {sessionChips.map(s => {
                                        const cls = classMap.get(s.classId);
                                        return (
                                            <div key={s.id} className="text-[10px] truncate px-1 rounded flex items-center gap-1"
                                                style={{ backgroundColor: cls ? cls.color + '22' : '#e0e7ff', color: cls?.color ?? '#6366f1' }}>
                                                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: cls?.color ?? '#6366f1' }} />
                                                {s.startTime.slice(0, 5)} {cls?.name ?? 'Class'}
                                            </div>
                                        );
                                    })}
                                    {assignmentChips.map(a => {
                                        const cls = classMap.get(a.classId);
                                        const isDone = a.status === 'submitted' || a.status === 'graded';
                                        return (
                                            <div key={a.id} className={`text-[10px] truncate px-1 rounded flex items-center gap-1 ${isDone ? 'bg-slate-100 text-slate-400 line-through' : 'bg-rose-100 text-rose-700'}`}>
                                                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: cls?.color ?? '#e11d48' }} />
                                                {format(new Date(a.deadline), 'HH:mm')} {a.title}
                                            </div>
                                        );
                                    })}
                                    {eventChips.map(event => (
                                        <div key={event.id} className="text-[10px] truncate px-1 rounded flex items-center gap-1 bg-purple-100 text-purple-700">
                                            <div className="w-1 h-1 rounded-full bg-purple-500" />
                                            {format(new Date(event.startTime), 'HH:mm')} {event.title}
                                        </div>
                                    ))}
                                    {todoChips.map(todo => (
                                        <div key={todo.id} className={`text-[10px] truncate px-1 rounded flex items-center gap-1 ${todo.completed ? 'bg-slate-100 text-slate-400 line-through' : 'bg-indigo-100 text-indigo-700'
                                            }`}>
                                            <div className={`w-1 h-1 rounded-full ${todo.completed ? 'bg-slate-400' : 'bg-indigo-500'}`} />
                                            {todo.title}
                                        </div>
                                    ))}
                                    {totalItems > 3 && (
                                        <div className="text-[9px] text-slate-400 pl-1">+{totalItems - 3} more</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {selectedDay && (
                <div className="app-surface p-5 animate-in slide-in-from-bottom-2 fade-in">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
                        {format(selectedDay, 'EEEE, MMMM do')}
                    </h3>

                    {getTodosForDay(selectedDay).length === 0 && getCalendarEventsForDay(selectedDay).length === 0 && getClassSessionsForDay(selectedDay).length === 0 && getAssignmentsForDay(selectedDay).length === 0 ? (
                        <p className="text-slate-400 italic">No events or tasks scheduled for this day.</p>
                    ) : (
                        <div className="space-y-4">
                            {getClassSessionsForDay(selectedDay).length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Classes</h4>
                                    <div className="space-y-2">
                                        {getClassSessionsForDay(selectedDay).map(s => {
                                            const cls = classMap.get(s.classId);
                                            return (
                                                <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border"
                                                    style={{ backgroundColor: cls ? cls.color + '11' : '#f5f3ff', borderColor: cls ? cls.color + '44' : '#ddd6fe' }}>
                                                    <GraduationCap size={16} className="mt-0.5 shrink-0" style={{ color: cls?.color ?? '#6366f1' }} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-slate-800">{cls?.name ?? 'Class'}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
                                                            {s.location && <span> · {s.location}</span>}
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
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">School deadlines</h4>
                                    <div className="space-y-2">
                                        {getAssignmentsForDay(selectedDay).map(a => {
                                            const cls = classMap.get(a.classId);
                                            const deadline = new Date(a.deadline);
                                            const isDone = a.status === 'submitted' || a.status === 'graded';
                                            return (
                                                <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border ${isDone ? 'bg-slate-50 border-slate-100' : 'bg-rose-50 border-rose-100'}`}>
                                                    <Clock size={16} className={`mt-0.5 shrink-0 ${isDone ? 'text-slate-400' : 'text-rose-600'}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`font-medium truncate ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{a.title}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            {format(deadline, 'h:mm a')}
                                                            {cls && <span> · {cls.name}</span>}
                                                            {a.estimatedMinutes && <span> · {a.estimatedMinutes}m</span>}
                                                        </div>
                                                        {a.description && (
                                                            <div className="text-xs text-slate-500 mt-1">{a.description}</div>
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
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Calendar Events</h4>
                                    <div className="space-y-2">
                                        {getCalendarEventsForDay(selectedDay).map(event => (
                                            <div key={event.id} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                                                <CalendarIcon size={16} className="text-purple-600 mt-0.5 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-slate-800 truncate">{event.title}</div>
                                                    <div className="text-xs text-slate-600 mt-1">
                                                        {format(new Date(event.startTime), 'h:mm a')} - {format(new Date(event.endTime), 'h:mm a')}
                                                    </div>
                                                    {event.location && (
                                                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                            <MapPin size={12} />
                                                            {event.location}
                                                        </div>
                                                    )}
                                                    {event.description && (
                                                        <div className="text-xs text-slate-500 mt-1">{event.description}</div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {getTodosForDay(selectedDay).length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tasks</h4>
                                    <div className="space-y-2">
                                        {getTodosForDay(selectedDay).map(todo => (
                                            <div key={todo.id} className="flex items-center gap-3">
                                                {todo.completed ? (
                                                    <CheckCircle size={18} className="text-emerald-500" />
                                                ) : (
                                                    <Circle size={18} className="text-slate-300" />
                                                )}
                                                <span className={todo.completed ? 'line-through text-slate-400' : 'text-slate-700'}>
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
            <CalendarSettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </div>
    );
};

export default CalendarPage;
