import React, { useState, useMemo } from 'react';
import {
    Target, FolderKanban, Trophy, Plus, Trash2, Flame, X, Clock,
    CheckSquare, TrendingUp, Award, Zap, Archive, FolderOpen,
} from 'lucide-react';
import { useGoals, type Goal, type GoalType } from '../../core/hooks/useGoals';
import { useProjects, type Project } from '../hooks/useProjects';
import { useSkills } from '../hooks/useSkills';
import { LogActivityModal } from '../components/LogActivityModal';
import { getRequiredXpForLevel, calculateTitle } from '../types';
import type { Skill } from '../types';

type HubTab = 'goals' | 'projects' | 'skills';

interface GrowthHubPageProps {
    initialParams?: Record<string, unknown> | null;
}

const TABS: Array<{ id: HubTab; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = [
    { id: 'goals',    label: 'Goals',    Icon: Target },
    { id: 'projects', label: 'Projects', Icon: FolderKanban },
    { id: 'skills',   label: 'Skills',   Icon: Trophy },
];

const GrowthHubPage: React.FC<GrowthHubPageProps> = ({ initialParams }) => {
    const requested = (initialParams?.tab as HubTab | undefined);
    const [tab, setTab] = useState<HubTab>(requested && TABS.some(t => t.id === requested) ? requested : 'goals');

    return (
        <div className="max-w-3xl mx-auto pb-24 px-4 md:px-0 space-y-5">
            <header className="pt-2">
                <h1 className="text-2xl font-bold text-slate-900">Growth</h1>
                <p className="text-sm text-slate-500">Goals, projects, and skills — your direction, work, and craft.</p>
            </header>

            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                {TABS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Icon size={16} /> {label}
                    </button>
                ))}
            </div>

            {tab === 'goals' && <GoalsTab />}
            {tab === 'projects' && <ProjectsTab />}
            {tab === 'skills' && <SkillsTab />}
        </div>
    );
};

export default GrowthHubPage;

// ─────────────────────────────────────────────────────────────────────────────
// Goals tab
// ─────────────────────────────────────────────────────────────────────────────

const GOAL_TYPE_CONFIG: Record<GoalType, { label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; color: string; description: string }> = {
    time:     { label: 'Time',     Icon: Clock,       color: 'text-blue-600 bg-blue-50',     description: 'Spend X minutes daily' },
    action:   { label: 'Action',   Icon: CheckSquare, color: 'text-green-600 bg-green-50',   description: 'A specific thing to do' },
    progress: { label: 'Progress', Icon: TrendingUp,  color: 'text-indigo-600 bg-indigo-50', description: 'Track 0–100% progress' },
    habit:    { label: 'Habit',    Icon: Flame,       color: 'text-orange-600 bg-orange-50', description: 'Build a daily streak' },
};

const PRESET_CATEGORIES = ['Health', 'Work', 'Learning', 'Habits', 'Personal'];

const GoalsTab: React.FC = () => {
    const { goals, isLoading, addGoal, updateGoalStatus, updateGoalProject, deleteGoal } = useGoals('all');
    const { projects } = useProjects('active');
    const [showAdd, setShowAdd] = useState(false);
    const [filter, setFilter] = useState<'active' | 'all'>('active');

    const displayed = filter === 'active' ? goals.filter(g => g.status === 'active') : goals;

    const grouped = useMemo(() => {
        const byCat: Record<string, Goal[]> = {};
        for (const g of displayed) {
            const cat = g.category || 'Personal';
            (byCat[cat] ||= []).push(g);
        }
        return byCat;
    }, [displayed]);

    const projectName = (id: string | null) => id ? projects.find(p => p.id === id)?.name : undefined;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    {(['active', 'all'] as const).map(s => (
                        <button key={s} onClick={() => setFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                filter === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}>
                            {s === 'active' ? 'Active' : 'All goals'}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowAdd(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
                    <Plus size={16} /> Add goal
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-8 text-sm text-slate-400">Loading goals…</div>
            ) : displayed.length === 0 ? (
                <EmptyState
                    Icon={Target}
                    title="No goals yet"
                    body="Add your first outcome to track."
                    action={{ label: 'Add goal', onClick: () => setShowAdd(true) }}
                />
            ) : (
                Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="space-y-2">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">{category}</h2>
                        {items.map(goal => {
                            const cfg = GOAL_TYPE_CONFIG[goal.goalType];
                            const linkedProject = projectName(goal.projectId);
                            return (
                                <div key={goal.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                                            <cfg.Icon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-semibold text-slate-800 truncate">{goal.title}</p>
                                                {goal.goalType === 'habit' && goal.streakCount > 0 && (
                                                    <span className="flex items-center gap-0.5 text-xs text-orange-600 font-medium">
                                                        <Flame size={12} /> {goal.streakCount}
                                                    </span>
                                                )}
                                                {linkedProject && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-fuchsia-700 bg-fuchsia-50 px-1.5 py-0.5 rounded">
                                                        <FolderOpen size={10} /> {linkedProject}
                                                    </span>
                                                )}
                                            </div>
                                            {goal.description && (
                                                <p className="text-xs text-slate-500 mt-0.5">{goal.description}</p>
                                            )}
                                            {goal.goalType === 'time' && goal.targetMinutes && (
                                                <p className="text-xs text-slate-400 mt-0.5">{goal.targetMinutes} min/day</p>
                                            )}
                                            {(goal.goalType === 'progress' || goal.goalType === 'habit') && (
                                                <div className="mt-2">
                                                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                                                        <span>Progress</span><span>{goal.progress}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500 rounded-full transition-all"
                                                            style={{ width: `${goal.progress}%` }} />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="mt-2 flex items-center gap-2">
                                                <select
                                                    value={goal.projectId ?? ''}
                                                    onChange={e => updateGoalProject(goal.id, e.target.value || null)}
                                                    className="text-[11px] px-2 py-1 border border-slate-200 rounded-md bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                                >
                                                    <option value="">No project</option>
                                                    {projects.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {goal.status === 'active' && (
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm('Finish and archive this goal?')) {
                                                            updateGoalStatus(goal.id, 'completed');
                                                        }
                                                    }}
                                                    className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                                >
                                                    Finish
                                                </button>
                                            )}
                                            <button onClick={() => deleteGoal(goal.id)}
                                                className="p-1 text-slate-300 hover:text-red-400 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))
            )}

            {showAdd && (
                <AddGoalModal
                    projects={projects}
                    onClose={() => setShowAdd(false)}
                    onAdd={addGoal}
                />
            )}
        </div>
    );
};

interface AddGoalModalProps {
    projects: Project[];
    onClose: () => void;
    onAdd: (params: {
        title: string; goalType: GoalType; category: string; description?: string;
        targetMinutes?: number; projectId?: string | null;
    }) => Promise<void>;
}

const AddGoalModal: React.FC<AddGoalModalProps> = ({ projects, onClose, onAdd }) => {
    const [title, setTitle] = useState('');
    const [goalType, setGoalType] = useState<GoalType>('habit');
    const [category, setCategory] = useState('Habits');
    const [customCategory, setCustomCategory] = useState('');
    const [description, setDescription] = useState('');
    const [targetMinutes, setTargetMinutes] = useState('');
    const [projectId, setProjectId] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const finalCategory = category === '__custom' ? customCategory : category;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        setError(null);
        try {
            await onAdd({
                title: title.trim(),
                goalType,
                category: finalCategory || 'Personal',
                description: description || undefined,
                targetMinutes: goalType === 'time' && targetMinutes ? Number(targetMinutes) : undefined,
                projectId: projectId || null,
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save goal.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-900">Add goal</h2>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Goal title</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} required
                            placeholder="e.g. Read every day"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(GOAL_TYPE_CONFIG) as [GoalType, typeof GOAL_TYPE_CONFIG[GoalType]][]).map(([type, cfg]) => (
                                <button key={type} type="button" onClick={() => setGoalType(type)}
                                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-colors ${
                                        goalType === type ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                                    }`}>
                                    <cfg.Icon size={16} className={goalType === type ? 'text-indigo-600' : 'text-slate-400'} />
                                    <div>
                                        <p className="text-xs font-medium text-slate-800">{cfg.label}</p>
                                        <p className="text-[10px] text-slate-400 leading-tight">{cfg.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {goalType === 'time' && (
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Target minutes per day</label>
                            <input type="number" value={targetMinutes} onChange={e => setTargetMinutes(e.target.value)}
                                min={1} placeholder="e.g. 30"
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">Category</label>
                        <div className="flex flex-wrap gap-1.5">
                            {PRESET_CATEGORIES.map(cat => (
                                <button key={cat} type="button" onClick={() => setCategory(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        category === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}>
                                    {cat}
                                </button>
                            ))}
                            <button type="button" onClick={() => setCategory('__custom')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    category === '__custom' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}>
                                Custom…
                            </button>
                        </div>
                        {category === '__custom' && (
                            <input value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                                placeholder="Category name"
                                className="mt-2 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Project (optional)</label>
                        <select value={projectId} onChange={e => setProjectId(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                            <option value="">No project</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                            placeholder="Why this goal matters…"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                    </div>

                    {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

                    <button type="submit" disabled={saving || !title.trim()}
                        className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {saving ? 'Adding…' : 'Add goal'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Projects tab
// ─────────────────────────────────────────────────────────────────────────────

const ProjectsTab: React.FC = () => {
    const { projects, isLoading, addProject, updateProject, deleteProject } = useProjects('all');
    const { goals } = useGoals('all');
    const [showAdd, setShowAdd] = useState(false);
    const [filter, setFilter] = useState<'active' | 'all'>('active');

    const displayed = filter === 'active' ? projects.filter(p => p.status === 'active') : projects;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    {(['active', 'all'] as const).map(s => (
                        <button key={s} onClick={() => setFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                filter === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}>
                            {s === 'active' ? 'Active' : 'All'}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowAdd(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
                    <Plus size={16} /> Add project
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-8 text-sm text-slate-400">Loading projects…</div>
            ) : displayed.length === 0 ? (
                <EmptyState
                    Icon={FolderKanban}
                    title="No projects yet"
                    body="Projects are bodies of work that hold goals and tasks."
                    action={{ label: 'Add project', onClick: () => setShowAdd(true) }}
                />
            ) : (
                <div className="space-y-2">
                    {displayed.map(project => {
                        const projectGoals = goals.filter(g => g.projectId === project.id);
                        const activeGoals = projectGoals.filter(g => g.status === 'active');
                        const avgProgress = activeGoals.length > 0
                            ? Math.round(activeGoals.reduce((sum, g) => sum + (g.progress ?? 0), 0) / activeGoals.length)
                            : 0;
                        return (
                            <div key={project.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center flex-shrink-0">
                                        <FolderKanban size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{project.name}</p>
                                            {project.status !== 'active' && (
                                                <span className="text-[10px] uppercase font-bold text-slate-400">{project.status}</span>
                                            )}
                                        </div>
                                        {project.description && (
                                            <p className="text-xs text-slate-500 mt-0.5">{project.description}</p>
                                        )}
                                        <p className="text-xs text-slate-400 mt-1">
                                            {activeGoals.length} active goal{activeGoals.length === 1 ? '' : 's'}
                                            {projectGoals.length > activeGoals.length && ` · ${projectGoals.length - activeGoals.length} archived`}
                                        </p>
                                        {activeGoals.length > 0 && (
                                            <div className="mt-2">
                                                <div className="flex justify-between text-xs text-slate-400 mb-1">
                                                    <span>Goals progress</span><span>{avgProgress}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-fuchsia-500 rounded-full transition-all"
                                                        style={{ width: `${avgProgress}%` }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {project.status === 'active' ? (
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Mark this project complete?')) {
                                                        updateProject(project.id, { status: 'completed' });
                                                    }
                                                }}
                                                className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                            >
                                                Finish
                                            </button>
                                        ) : (
                                            <button onClick={() => updateProject(project.id, { status: 'active' })}
                                                className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-1">
                                                <Archive size={11} /> Reopen
                                            </button>
                                        )}
                                        <button onClick={() => {
                                            if (window.confirm('Delete this project? Linked goals will keep working without a project.')) {
                                                deleteProject(project.id);
                                            }
                                        }}
                                            className="p-1 text-slate-300 hover:text-red-400 transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showAdd && (
                <AddProjectModal
                    onClose={() => setShowAdd(false)}
                    onAdd={addProject}
                />
            )}
        </div>
    );
};

interface AddProjectModalProps {
    onClose: () => void;
    onAdd: (params: { name: string; description?: string }) => Promise<void>;
}

const AddProjectModal: React.FC<AddProjectModalProps> = ({ onClose, onAdd }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        setError(null);
        try {
            await onAdd({ name: name.trim(), description: description || undefined });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save project.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-900">Add project</h2>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Project name</label>
                        <input value={name} onChange={e => setName(e.target.value)} required autoFocus
                            placeholder="e.g. Thesis, App refactor"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                            placeholder="What's this project about?"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                    </div>
                    {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
                    <button type="submit" disabled={saving || !name.trim()}
                        className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {saving ? 'Adding…' : 'Add project'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Skills tab
// ─────────────────────────────────────────────────────────────────────────────

const SKILL_GRADIENTS = [
    'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)',
    'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
    'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
];
const SKILL_ICONS = ['🧠', '💪', '📚', '🎨', '💻', '🎸', '🗣️', '🧘‍♂️', '🛠️', '🌿'];

const SkillsTab: React.FC = () => {
    const { skills, logs, isLoading, addSkill, deleteSkill, logActivity } = useSkills();
    const { projects } = useProjects('active');
    const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [pickedProjectId, setPickedProjectId] = useState<string>('');

    const totalLevel = skills.reduce((sum, s) => sum + s.level, 0);

    const totalMinutesBySkill = useMemo(() => {
        const m = new Map<string, number>();
        for (const log of logs) {
            m.set(log.skillId, (m.get(log.skillId) ?? 0) + (log.minutes ?? 0));
        }
        return m;
    }, [logs]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        const color = SKILL_GRADIENTS[Math.floor(Math.random() * SKILL_GRADIENTS.length)];
        const icon = SKILL_ICONS[Math.floor(Math.random() * SKILL_ICONS.length)];
        await addSkill(newName.trim(), color, icon);
        setNewName('');
        setShowAdd(false);
    };

    const activeSkill = skills.find(s => s.id === activeSkillId);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                        {totalLevel}
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Meta level</div>
                        <div className="text-xs text-slate-600">Total mastery</div>
                    </div>
                </div>
                <button onClick={() => setShowAdd(s => !s)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
                    <Plus size={16} /> Add skill
                </button>
            </div>

            {showAdd && (
                <form onSubmit={handleAdd} className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex gap-2 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-600 mb-1">What do you want to master?</label>
                        <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                            placeholder="e.g. Spanish, Drawing, Meditation"
                            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <button type="submit" disabled={!newName.trim()}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
                        Start
                    </button>
                </form>
            )}

            {isLoading ? (
                <div className="text-center py-8 text-sm text-slate-400">Loading skills…</div>
            ) : skills.length === 0 ? (
                <EmptyState
                    Icon={Trophy}
                    title="No skills yet"
                    body="Pick a craft. Log time. Watch it level up."
                    action={{ label: 'Add skill', onClick: () => setShowAdd(true) }}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {skills.map(skill => (
                        <SkillCardCompact
                            key={skill.id}
                            skill={skill}
                            totalMinutes={totalMinutesBySkill.get(skill.id) ?? 0}
                            onLog={() => setActiveSkillId(skill.id)}
                            onDelete={() => {
                                if (window.confirm(`Delete skill "${skill.name}"? All XP and logs will be lost.`)) {
                                    deleteSkill(skill.id);
                                }
                            }}
                        />
                    ))}
                </div>
            )}

            {activeSkill && (
                <div>
                    {projects.length > 0 && (
                        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] bg-white rounded-xl shadow-lg border border-slate-200 px-3 py-2 flex items-center gap-2">
                            <span className="text-xs text-slate-500">Credit project:</span>
                            <select value={pickedProjectId} onChange={e => setPickedProjectId(e.target.value)}
                                className="text-xs px-2 py-1 border border-slate-200 rounded-md bg-white">
                                <option value="">None</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <LogActivityModal
                        skill={activeSkill}
                        onClose={() => { setActiveSkillId(null); setPickedProjectId(''); }}
                        onSubmit={(minutes, note) =>
                            logActivity(activeSkill.id, minutes, note, pickedProjectId || null)
                        }
                    />
                </div>
            )}
        </div>
    );
};

interface SkillCardCompactProps {
    skill: Skill;
    totalMinutes: number;
    onLog: () => void;
    onDelete: () => void;
}

const SkillCardCompact: React.FC<SkillCardCompactProps> = ({ skill, totalMinutes, onLog, onDelete }) => {
    const reqXp = getRequiredXpForLevel(skill.level);
    const progressPercent = Math.min(100, Math.floor((skill.xp / reqXp) * 100));
    const title = calculateTitle(skill.level);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return (
        <div className="relative group overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundImage: skill.color }} />
            <button onClick={onDelete}
                className="absolute top-3 right-3 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                title="Delete skill">
                <Trash2 size={14} />
            </button>
            <div className="p-4 pt-5">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                        style={{ backgroundImage: skill.color }}>
                        <span className="text-xl">{skill.icon}</span>
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-sm text-slate-800 truncate">{skill.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Award size={11} /> {title} · Lv {skill.level}
                        </p>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between text-[11px] font-semibold mb-1">
                        <span className="text-slate-500">{skill.xp} / {reqXp} XP</span>
                        <span className="text-slate-400">
                            {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`} logged
                        </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${progressPercent}%`, backgroundImage: skill.color }} />
                    </div>
                </div>

                <button onClick={onLog}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
                    <Zap size={14} className="text-yellow-500" /> Log activity
                </button>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    title: string;
    body: string;
    action: { label: string; onClick: () => void };
}

const EmptyState: React.FC<EmptyStateProps> = ({ Icon, title, body, action }) => (
    <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <Icon size={36} className="mx-auto text-slate-300 mb-3" />
        <h3 className="text-base font-semibold text-slate-700">{title}</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">{body}</p>
        <button onClick={action.onClick}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors inline-flex items-center gap-1.5">
            <Plus size={14} /> {action.label}
        </button>
    </div>
);

