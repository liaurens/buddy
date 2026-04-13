import React, { useState } from 'react';
import { useSkills } from '../hooks/useSkills';
import { SkillCard } from '../components/SkillCard';
import { LogActivityModal } from '../components/LogActivityModal';
import { Plus, Trophy } from 'lucide-react';

const GRADIENTS = [
  'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
];

const ICONS = ['🧠', '💪', '📚', '🎨', '💻', '🎸', '🗣️', '🧘‍♂️', '🛠️', '🌿'];

export function GrowthPage() {
  const { skills, addSkill, deleteSkill, logActivity } = useSkills();
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  
  // Add Skill Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  
  const totalLevel = skills.reduce((sum, skill) => sum + skill.level, 0);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    // Pick random style
    const color = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
    const icon = ICONS[Math.floor(Math.random() * ICONS.length)];
    
    addSkill(newName.trim(), color, icon);
    setNewName('');
    setShowAddForm(false);
  };

  const activeSkill = skills.find(s => s.id === activeSkillId);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <Trophy className="text-yellow-500" size={32} />
            Personal Growth
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Level up your identity and master your habits.</p>
        </div>
        
        <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl">
            {totalLevel}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Meta Level</div>
            <div className="text-sm font-medium text-slate-700">Total mastery acquired</div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Your Skills</h2>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition"
        >
          <Plus size={18} /> Add New
        </button>
      </div>

      {showAddForm && (
        <div className="mb-8 bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-4">
          <form onSubmit={handleAddSubmit} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">What do you want to master?</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Spanish, Meditation, Drawing..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button 
              type="submit" 
              disabled={!newName.trim()}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              Start Journey
            </button>
          </form>
        </div>
      )}

      {skills.length === 0 && !showAddForm ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <Trophy size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">No skills yet</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            Start your personal development journey by adding your first skill or habit to master.
          </p>
          <button 
            onClick={() => setShowAddForm(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
          >
            Add your first skill
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.map(skill => (
            <SkillCard 
              key={skill.id}
              skill={skill}
              onLogActivity={(id) => setActiveSkillId(id)}
              onDelete={deleteSkill}
            />
          ))}
        </div>
      )}

      {activeSkill && (
        <LogActivityModal 
          skill={activeSkill}
          onClose={() => setActiveSkillId(null)}
          onSubmit={(minutes, note) => logActivity(activeSkill.id, minutes, note)}
        />
      )}
    </div>
  );
}

export default GrowthPage;
