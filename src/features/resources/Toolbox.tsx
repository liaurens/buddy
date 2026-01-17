import React, { useState } from 'react';
import { BookOpen, Users, Clock, Zap, ChevronRight, X } from 'lucide-react';

interface Strategy {
    id: string;
    title: string;
    icon: React.ReactNode;
    description: string;
    content: string;
    color: string;
}

const STRATEGIES: Strategy[] = [
    {
        id: 'body-doubling',
        title: 'Body Doubling',
        icon: <Users size={24} />,
        description: 'Work alongside someone else to boost productivity.',
        content: 'Body doubling is simply working in the presence of another person. The other person doesn\'t need to help you with the task; they just need to be there. This creates a sense of accountability and can help reduce task paralysis. \n\n**Try it:**\n- Ask a friend to sit with you while you study.\n- Join a virtual co-working space (like Focusmate).\n- Even a pet can sometimes work as a body double!',
        color: 'bg-rose-100 text-rose-600'
    },
    {
        id: 'pomodoro',
        title: 'Pomodoro Technique',
        icon: <Clock size={24} />,
        description: 'Break work into short, focused intervals.',
        content: 'The Pomodoro Technique uses a timer to break down work into intervals, traditionally 25 minutes in length, separated by short breaks. This helps with maintaining focus and preventing burnout.\n\n**Steps:**\n1. Pick a task.\n2. Set a timer for 25 minutes.\n3. Work until the timer rings.\n4. Take a short 5-minute break.\n5. Every 4 cycles, take a longer break.',
        color: 'bg-indigo-100 text-indigo-600'
    },
    {
        id: 'eat-the-frog',
        title: 'Eat The Frog',
        icon: <Zap size={24} />,
        description: 'Do the hardest task first.',
        content: '"Eat the Frog" means tackling your most difficult or dreaded task first thing in the morning. Once that\'s done, everything else will seem easier by comparison.\n\n**Why it works:**\n- It prevents procrastination.\n- It uses your peak morning energy.\n- It gives you a massive sense of accomplishment early in the day.',
        color: 'bg-emerald-100 text-emerald-600'
    },
    {
        id: 'chunking',
        title: 'Task Chunking',
        icon: <BookOpen size={24} />,
        description: 'Break big tasks into tiny steps.',
        content: 'Large tasks can be overwhelming and lead to paralysis. Chunking involves breaking a big project into very small, manageable steps.\n\n**Example:**\nInstead of "Write Essay", break it down to:\n1. Open document.\n2. Write title.\n3. Write 3 bullet points for arguments.\n4. Write intro sentence.',
        color: 'bg-amber-100 text-amber-600'
    }
];

const Toolbox: React.FC = () => {
    const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

    return (
        <div className="space-y-6">
            {!selectedStrategy ? (
                <div className="grid gap-4">
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Strategy Toolbox</h2>
                    {STRATEGIES.map(strategy => (
                        <button
                            key={strategy.id}
                            onClick={() => setSelectedStrategy(strategy)}
                            className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all text-left"
                        >
                            <div className={`p-3 rounded-lg ${strategy.color}`}>
                                {strategy.icon}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-800">{strategy.title}</h3>
                                <p className="text-sm text-slate-500">{strategy.description}</p>
                            </div>
                            <ChevronRight className="text-slate-300" />
                        </button>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-right-4">
                    <div className={`p-6 ${selectedStrategy.color.replace('text-', 'bg-').replace('100', '50')} border-b border-slate-100 flex justify-between items-start`}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-white/50`}>
                                {selectedStrategy.icon}
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">{selectedStrategy.title}</h2>
                        </div>
                        <button
                            onClick={() => setSelectedStrategy(null)}
                            className="p-1 hover:bg-black/5 rounded-full transition-colors"
                        >
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>
                    <div className="p-6">
                        <div className="prose prose-slate text-sm">
                            {selectedStrategy.content.split('\n').map((line, i) => (
                                <p key={i} className="mb-2">{line}</p>
                            ))}
                        </div>
                        <button
                            onClick={() => setSelectedStrategy(null)}
                            className="mt-6 w-full py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium"
                        >
                            Back to Toolbox
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Toolbox;
