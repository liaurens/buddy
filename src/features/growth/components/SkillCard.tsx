import type { Skill } from '../types';
import { getRequiredXpForLevel, calculateTitle } from '../types';
import { Award, Zap } from 'lucide-react';

interface SkillCardProps {
  skill: Skill;
  onLogActivity: (skillId: string) => void;
  onDelete: (skillId: string) => void;
}

export function SkillCard({ skill, onLogActivity, onDelete }: SkillCardProps) {
  const reqXp = getRequiredXpForLevel(skill.level);
  const progressPercent = Math.min(100, Math.floor((skill.xp / reqXp) * 100));
  const title = calculateTitle(skill.level);

  return (
    <div className="relative group overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
      {/* Top Banner mapping color */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r" style={{ backgroundImage: skill.color }} />
      
      {/* Delete button (shows on hover) */}
      <button 
        onClick={() => onDelete(skill.id)}
        className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
        title="Delete skill"
      >
        ×
      </button>

      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundImage: skill.color }}
            >
              <span className="text-2xl">{skill.icon}</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800">{skill.name}</h3>
              <p className="text-sm font-medium text-slate-500 flex items-center gap-1">
                <Award size={14} />
                {title} (Lv. {skill.level})
              </p>
            </div>
          </div>
        </div>

        {/* Level Progress */}
        <div className="mt-6">
          <div className="flex justify-between text-xs font-semibold mb-2">
            <span className="text-slate-600">Level {skill.level}</span>
            <span className="text-slate-500">{skill.xp} / {reqXp} XP</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
              style={{ width: `${progressPercent}%`, backgroundImage: skill.color }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={() => onLogActivity(skill.id)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm border-2 border-slate-100 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <Zap size={16} className="text-yellow-500" />
            Log Activity
          </button>
        </div>
      </div>
    </div>
  );
}
