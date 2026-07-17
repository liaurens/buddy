import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    Trash2,
    Search,
    BookOpen,
    Lightbulb,
    Star,
    ChevronRight,
    X,
    Settings,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Strategy } from '../types';
import { useAuth } from '../../../hooks/useAuth';
import { supabase, dbToStrategy, strategyToDb, type DbStrategy } from '../../../services/supabase';
import ToolboxSettingsModal from '../components/ToolboxSettingsModal';

const PRESET_TAGS = [
    { label: 'Strength', color: 'bg-cove-tint-green text-cove-success-deep' },
    { label: 'Weakness', color: 'bg-cove-tint-pink text-cove-pink' },
    { label: 'Focus', color: 'bg-cove-tint-blue text-cove-accent' },
    { label: 'Anxiety', color: 'bg-cove-tint-amber text-cove-streak-text' },
    { label: 'Sleep', color: 'bg-cove-tint-purple text-cove-purple' },
    { label: 'Energy', color: 'bg-cove-tint-amber text-cove-streak-deep' },
    { label: 'Morning', color: 'bg-cove-tint-amber text-cove-streak-text' },
];

const ToolboxPage: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    // Fetch strategies
    const { data: strategies = [] } = useQuery({
        queryKey: ['strategies', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('strategies')
                .select('*')
                .eq('user_id', userId);

            if (error) throw error;
            return (data as DbStrategy[]).map(dbToStrategy);
        },
        enabled: !!userId,
    });

    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    // Filter State
    const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);

    // Form State (New Strategy)
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newTags, setNewTags] = useState<string[]>([]);

    // Findings State
    const [newFindingNote, setNewFindingNote] = useState('');
    const [newFindingRating, setNewFindingRating] = useState(3);

    const handleAdd = async () => {
        if (!newTitle.trim() || !userId) return;

        const newStrategy = {
            id: window.crypto.randomUUID(),
            title: newTitle,
            description: newDesc,
            category: 'General',
            tags: newTags,
            findings: [],
        };

        const dbStrategy = strategyToDb(newStrategy, userId);
        await supabase.from('strategies').insert(dbStrategy);
        queryClient.invalidateQueries({ queryKey: ['strategies', userId] });

        setNewTitle('');
        setNewDesc('');
        setNewTags([]);
        setIsAdding(false);
    };

    const handleDelete = async (id: string) => {
        if (!userId) throw new Error('Not authenticated');
        if (window.confirm('Delete this strategy?')) {
            await supabase.from('strategies').delete().eq('id', id).eq('user_id', userId);
            queryClient.invalidateQueries({ queryKey: ['strategies', userId] });
            if (selectedStrategy?.id === id) setSelectedStrategy(null);
        }
    };

    const toggleTag = (tag: string) => {
        if (newTags.includes(tag)) {
            setNewTags(newTags.filter((t) => t !== tag));
        } else {
            setNewTags([...newTags, tag]);
        }
    };

    const addFinding = async () => {
        if (!selectedStrategy || !userId) return;
        const finding = {
            id: window.crypto.randomUUID(),
            date: new Date().toISOString(),
            note: newFindingNote,
            rating: newFindingRating,
        };

        const updatedFindings = [finding, ...(selectedStrategy.findings || [])];

        await supabase
            .from('strategies')
            .update({ findings: updatedFindings })
            .eq('id', selectedStrategy.id)
            .eq('user_id', userId);

        queryClient.invalidateQueries({ queryKey: ['strategies', userId] });

        // Optimistic update for local state interaction
        setSelectedStrategy({ ...selectedStrategy, findings: updatedFindings });
        setNewFindingNote('');
        setNewFindingRating(3);
    };

    const filteredStrategies = strategies.filter((s) => {
        const matchesSearch =
            s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTag = activeFilterTag ? (s.tags || []).includes(activeFilterTag) : true;
        return matchesSearch && matchesTag;
    });

    return (
        <div className="app-page flex h-[calc(100dvh-7rem)] gap-6 lg:h-[calc(100dvh-4rem)]">
            {/* Left Panel: List */}
            <div
                className={`flex-1 flex flex-col space-y-4 ${selectedStrategy ? 'hidden md:flex' : 'flex'}`}
            >
                <header className="flex items-center justify-between">
                    <h1 className="flex items-center gap-3 px-1 text-[22px] font-black text-cove-ink">
                        <div className="rounded-xl bg-cove-tint-amber p-2 text-cove-streak-text">
                            <Lightbulb size={24} />
                        </div>
                        Toolbox
                    </h1>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="app-icon-button"
                        aria-label="Toolbox Settings"
                    >
                        <Settings size={20} />
                    </button>
                </header>
                <header>
                    <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                        {PRESET_TAGS.map((tag) => (
                            <button
                                key={tag.label}
                                onClick={() =>
                                    setActiveFilterTag(
                                        activeFilterTag === tag.label ? null : tag.label,
                                    )
                                }
                                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-extrabold transition-all ${
                                    activeFilterTag === tag.label
                                        ? 'bg-cove-accent text-white shadow-cove'
                                        : 'bg-white text-cove-muted shadow-cove hover:text-cove-ink'
                                }`}
                            >
                                {tag.label}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="relative">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-cove-soft"
                        size={20}
                    />
                    <input
                        type="text"
                        placeholder="Search strategies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-[14px] bg-white py-3 pl-10 pr-4 font-semibold text-cove-ink shadow-cove outline-none placeholder:text-cove-faint focus:ring-2 focus:ring-cove-accent-pale"
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pb-20">
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-cove-border p-4 font-bold text-cove-soft transition-all hover:border-cove-accent hover:text-cove-accent"
                    >
                        <Plus size={20} /> Add New Strategy
                    </button>

                    {filteredStrategies.map((strategy) => (
                        <div
                            key={strategy.id}
                            onClick={() => setSelectedStrategy(strategy)}
                            className={`cursor-pointer rounded-[18px] bg-white p-4 text-left transition-all ${
                                selectedStrategy?.id === strategy.id
                                    ? 'shadow-cove-strong ring-2 ring-cove-accent-pale'
                                    : 'shadow-cove hover:shadow-cove-strong'
                            }`}
                        >
                            <div className="flex flex-wrap gap-2 mb-2">
                                {strategy.tags?.map((tag) => {
                                    const preset = PRESET_TAGS.find((p) => p.label === tag);
                                    return (
                                        <span
                                            key={tag}
                                            className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider ${preset?.color || 'bg-cove-track text-cove-muted'}`}
                                        >
                                            {tag}
                                        </span>
                                    );
                                })}
                            </div>
                            <h3 className="text-[15px] font-extrabold text-cove-ink mb-1">
                                {strategy.title}
                            </h3>
                            <p className="text-[13px] font-semibold text-cove-muted line-clamp-2">
                                {strategy.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel: Details (or Modal on Mobile) */}
            {selectedStrategy && (
                <div className="fixed inset-0 z-50 md:static md:z-0 md:flex-[1.5] bg-cove-bg md:bg-transparent flex flex-col md:h-full">
                    {/* Mobile Back Button */}
                    <div className="md:hidden p-4 bg-white shadow-cove flex items-center gap-2">
                        <button
                            onClick={() => setSelectedStrategy(null)}
                            className="p-2 hover:bg-cove-track/60 rounded-xl text-cove-muted"
                        >
                            <ChevronRight size={24} className="rotate-180" />
                        </button>
                        <h2 className="font-extrabold text-lg text-cove-ink">Details</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-0">
                        <div className="app-surface flex flex-col p-6 md:h-full">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {selectedStrategy.tags?.map((tag) => {
                                            const preset = PRESET_TAGS.find((p) => p.label === tag);
                                            return (
                                                <span
                                                    key={tag}
                                                    className={`px-3 py-1 rounded-full text-xs font-extrabold ${preset?.color || 'bg-cove-track text-cove-muted'}`}
                                                >
                                                    {tag}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    <h2 className="text-[22px] font-black text-cove-ink mb-2">
                                        {selectedStrategy.title}
                                    </h2>
                                </div>
                                <button
                                    onClick={() => handleDelete(selectedStrategy.id)}
                                    className="text-cove-faint hover:text-cove-pink transition-colors p-2"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>

                            <div className="prose prose-slate max-w-none mb-8">
                                <p className="text-[14px] font-semibold text-cove-muted leading-relaxed whitespace-pre-wrap">
                                    {selectedStrategy.description}
                                </p>
                            </div>

                            {/* Findings / Logs Section */}
                            <div className="mt-auto border-t border-cove-border/50 pt-6">
                                <h3 className="text-[15px] font-extrabold text-cove-ink mb-4 flex items-center gap-2">
                                    <BookOpen size={20} className="text-cove-accent" /> Findings &
                                    Application
                                </h3>

                                <div className="bg-[#eef6fa] rounded-[14px] p-4 mb-4">
                                    <input
                                        className="w-full bg-transparent border-none outline-none font-semibold text-cove-ink placeholder:text-cove-faint mb-2"
                                        placeholder="Add a new finding or observation..."
                                        value={newFindingNote}
                                        onChange={(e) => setNewFindingNote(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') addFinding();
                                        }}
                                    />
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    onClick={() => setNewFindingRating(star)}
                                                    className={`transition-all hover:scale-110 ${star <= newFindingRating ? 'text-cove-streak fill-cove-streak' : 'text-cove-faint'}`}
                                                >
                                                    <Star size={16} />
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={addFinding}
                                            disabled={!newFindingNote.trim()}
                                            className="px-3 py-1 bg-cove-accent text-white rounded-[11px] text-xs font-extrabold hover:bg-[#3a8dc7] disabled:opacity-50"
                                        >
                                            Log Finding
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                    {selectedStrategy.findings?.length === 0 && (
                                        <p className="text-cove-soft text-sm font-semibold text-center italic">
                                            No findings recorded yet. Try this tool and log how it
                                            went!
                                        </p>
                                    )}
                                    {selectedStrategy.findings?.map((finding) => (
                                        <div
                                            key={finding.id}
                                            className="bg-white shadow-cove p-3 rounded-[12px] text-sm"
                                        >
                                            <div className="flex justify-between mb-1">
                                                <span className="text-cove-soft text-xs font-bold">
                                                    {format(
                                                        new Date(finding.date),
                                                        'MMM d, h:mm a',
                                                    )}
                                                </span>
                                                <div className="flex gap-0.5">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star
                                                            key={i}
                                                            size={10}
                                                            className={
                                                                i < finding.rating
                                                                    ? 'text-cove-streak fill-cove-streak'
                                                                    : 'text-cove-border'
                                                            }
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="font-semibold text-cove-ink">
                                                {finding.note}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {isAdding && (
                <div className="fixed inset-0 z-[60] bg-cove-overlay/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[22px] shadow-cove-strong w-full max-w-md p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[18px] font-black text-cove-ink">New Strategy</h3>
                            <button
                                onClick={() => setIsAdding(false)}
                                className="p-2 hover:bg-cove-track/60 rounded-full text-cove-muted"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-extrabold text-cove-soft uppercase tracking-wider mb-1">
                                    Title
                                </label>
                                <input
                                    className="w-full text-lg font-extrabold text-cove-ink border-b-2 border-cove-border outline-none py-1 placeholder:text-cove-faint focus:border-cove-accent transition-colors"
                                    placeholder="e.g. Pomodoro Technique"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-extrabold text-cove-soft uppercase tracking-wider mb-1">
                                    Tags
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_TAGS.map((tag) => (
                                        <button
                                            key={tag.label}
                                            onClick={() => toggleTag(tag.label)}
                                            className={`px-3 py-1 rounded-full text-xs font-extrabold border transition-all ${
                                                newTags.includes(tag.label)
                                                    ? 'bg-cove-ink text-white border-cove-ink'
                                                    : `${tag.color.split(' ')[0]} ${tag.color.split(' ')[1]} border-transparent opacity-60 hover:opacity-100`
                                            }`}
                                        >
                                            {tag.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-extrabold text-cove-soft uppercase tracking-wider mb-1">
                                    Description
                                </label>
                                <textarea
                                    className="w-full p-3 bg-[#eef6fa] rounded-[14px] outline-none resize-none h-32 focus:ring-2 focus:ring-cove-accent-pale transition-all font-semibold text-cove-ink placeholder:text-cove-faint"
                                    placeholder="How does this strategy work?"
                                    value={newDesc}
                                    onChange={(e) => setNewDesc(e.target.value)}
                                />
                            </div>

                            <button
                                onClick={handleAdd}
                                disabled={!newTitle.trim()}
                                className="w-full bg-cove-accent text-white py-3 rounded-[14px] font-extrabold shadow-cove-strong hover:bg-[#3a8dc7] transition-all disabled:opacity-50"
                            >
                                Add to Toolbox
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            <ToolboxSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </div>
    );
};

export default ToolboxPage;
