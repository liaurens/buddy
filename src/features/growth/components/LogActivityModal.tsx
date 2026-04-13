import { useState } from 'react';
import { X, Sparkles, TrendingUp } from 'lucide-react';
import type { Skill } from '../types';

interface LogActivityModalProps {
  skill: Skill;
  onClose: () => void;
  onSubmit: (minutes: number, note: string) => { xp: number; critical: boolean; levelUp: boolean; oldLevel: number; newLevel: number };
}

export function LogActivityModal({ skill, onClose, onSubmit }: LogActivityModalProps) {
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<{ xp: number; critical: boolean; levelUp: boolean; oldLevel: number; newLevel: number } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onSubmit(minutes, note);
    setResult(res);

    if (!res.levelUp) {
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
        {result?.critical && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-yellow-400/20 animate-pulse" />
          </div>
        )}

        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="text-2xl">{skill.icon}</span> Log {skill.name} Activity
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {result ? (
            <div className="text-center py-6 animate-in zoom-in duration-300">
              {result.levelUp ? (
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-100 text-yellow-500 mb-2">
                    <TrendingUp size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800">Level Up!</h3>
                  <p className="text-slate-600 font-medium">You reached Level {result.newLevel}</p>
                  <p className="text-sm text-slate-500 mt-2">({result.xp} XP Gained)</p>
                  <button 
                    onClick={onClose}
                    className="mt-6 w-full py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Awesome
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-2 ${result.critical ? 'bg-yellow-100 text-yellow-500 scale-110' : 'bg-green-100 text-green-500'}`}>
                    <Sparkles size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">
                    +{result.xp} XP
                  </h3>
                  {result.critical && (
                    <p className="text-yellow-600 font-bold text-sm bg-yellow-50 inline-block px-3 py-1 rounded-full border border-yellow-200">
                      CRITICAL SUCCESS!
                    </p>
                  )}
                  <p className="text-slate-500 text-sm">Progress saved!</p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Time Spent (Minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  required
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">What did you do? (Optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Read chapter 4 of Atomic Habits"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 focus:ring-4 focus:ring-slate-200 transition-all transform active:scale-95"
              >
                Log XP
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
