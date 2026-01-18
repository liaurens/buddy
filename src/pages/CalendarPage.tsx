import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle, Circle } from 'lucide-react';

const CalendarPage: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Fetch all active todos (simple approach for now: fetch all and filter in memory since dataset likely small)
    // Ideally use a range query index on dueDate, but Dexie requires configured index.
    const allTodos = useLiveQuery(() => db.todos.toArray()) || [];

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Pad start of month
    const startPadding = Array(monthStart.getDay()).fill(null);

    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    const getTodosForDay = (date: Date) => {
        return allTodos.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), date));
    };

    const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24 space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                    <div className="p-2 bg-pink-100 rounded-xl text-pink-600">
                        <CalendarIcon size={24} />
                    </div>
                    Calendar
                </h1>
                <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft size={20} /></button>
                    <span className="font-bold text-lg w-32 text-center">{format(currentDate, 'MMMM yyyy')}</span>
                    <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight size={20} /></button>
                </div>
            </header>

            {/* Calendar Grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 text-sm">
                    {startPadding.map((_, i) => <div key={`pad-${i}`} className="h-24 bg-slate-50/30 border-b border-r border-slate-50" />)}

                    {days.map(day => {
                        const dayTodos = getTodosForDay(day);
                        const isSelected = selectedDay && isSameDay(day, selectedDay);
                        const isCurrent = isToday(day);

                        return (
                            <div
                                key={day.toISOString()}
                                onClick={() => setSelectedDay(day)}
                                className={`h-24 p-1 border-b border-r border-slate-50 cursor-pointer transition-colors relative ${isSelected ? 'bg-indigo-50 ring-inset ring-2 ring-indigo-500' : 'hover:bg-slate-50'
                                    }`}
                            >
                                <span className={`inline-block w-6 h-6 text-center leading-6 rounded-full font-medium text-xs ${isCurrent ? 'bg-indigo-600 text-white' : 'text-slate-700'
                                    }`}>
                                    {format(day, 'd')}
                                </span>

                                <div className="mt-1 space-y-1">
                                    {dayTodos.slice(0, 3).map(todo => (
                                        <div key={todo.id} className={`text-[10px] truncate px-1 rounded flex items-center gap-1 ${todo.completed ? 'bg-slate-100 text-slate-400 line-through' : 'bg-indigo-100 text-indigo-700'
                                            }`}>
                                            <div className={`w-1 h-1 rounded-full ${todo.completed ? 'bg-slate-400' : 'bg-indigo-500'}`} />
                                            {todo.title}
                                        </div>
                                    ))}
                                    {dayTodos.length > 3 && (
                                        <div className="text-[9px] text-slate-400 pl-1">+{dayTodos.length - 3} more</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Selected Day View */}
            {selectedDay && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 animate-in slide-in-from-bottom-2 fade-in">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
                        {format(selectedDay, 'EEEE, MMMM do')}
                    </h3>

                    {getTodosForDay(selectedDay).length === 0 ? (
                        <p className="text-slate-400 italic">No tasks scheduled for this day.</p>
                    ) : (
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
                    )}
                </div>
            )}
        </div>
    );
};

export default CalendarPage;
