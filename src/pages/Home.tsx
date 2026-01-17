import React from 'react';
import { useTasks } from '../context/TaskContext';
import { useTracker } from '../context/TrackerContext';
import { format } from 'date-fns';
import { CheckCircle, Activity, Moon, Coffee } from 'lucide-react';

const Home: React.FC = () => {
    const { tasks } = useTasks();
    const { entries } = useTracker();

    const activeTasks = tasks.filter(t => !t.completed);
    const today = format(new Date(), 'yyyy-MM-dd');

    const todaysEntries = entries.filter(e => e.timestamp.startsWith(today));

    // Quick stats logic
    const sleepEntry = todaysEntries.find(e => e.trackerId === 'sleep'); // assuming 'sleep' id
    const caffeineEntries = todaysEntries.filter(e => e.trackerId === 'caffeine'); // assuming 'caffeine' id
    const totalCaffeine = caffeineEntries.reduce((sum, e) => sum + e.value, 0);

    const greeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-slate-800">{greeting()}!</h1>
                <p className="text-slate-500">{format(new Date(), 'EEEE, MMMM do')}</p>
            </header>

            {/* Focus Section */}
            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-6 text-white shadow-lg">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle className="text-indigo-200" size={20} />
                    Today's Focus
                </h2>
                {activeTasks.length > 0 ? (
                    <div className="space-y-3">
                        {activeTasks.slice(0, 3).map(task => (
                            <div key={task.id} className="flex items-center gap-3 bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                                <div className="w-2 h-2 rounded-full bg-indigo-300" />
                                <span className="font-medium">{task.title}</span>
                            </div>
                        ))}
                        {activeTasks.length > 3 && (
                            <p className="text-xs text-indigo-200 mt-2">+ {activeTasks.length - 3} more tasks</p>
                        )}
                    </div>
                ) : (
                    <p className="text-indigo-100">No pending tasks. Great job!</p>
                )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-500 mb-2">
                        <Moon size={16} />
                        <span className="text-xs font-medium uppercase">Sleep</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                        {sleepEntry ? `${sleepEntry.value}h` : '--'}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-500 mb-2">
                        <Coffee size={16} />
                        <span className="text-xs font-medium uppercase">Caffeine</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                        {totalCaffeine > 0 ? `${totalCaffeine}mg` : '--'}
                    </p>
                </div>
            </div>

            {/* Recent Activity Summary */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-800">
                    <Activity size={20} className="text-indigo-500" />
                    Recent Activity
                </h2>
                {todaysEntries.length > 0 ? (
                    <div className="space-y-3">
                        {todaysEntries.slice(0, 3).map(entry => (
                            <div key={entry.id} className="text-sm text-slate-600">
                                Logged <strong>{entry.value}</strong> for tracker...
                                {/* Ideally we'd look up the name, but context separation makes it tricky here without passing trackers prop or using context */}
                            </div>
                        ))}
                        <p className="text-xs text-slate-400 mt-2">Check the Tracker tab for full details.</p>
                    </div>
                ) : (
                    <p className="text-slate-500 text-sm">No activity recorded today.</p>
                )}
            </div>
        </div>
    );
};

export default Home;
