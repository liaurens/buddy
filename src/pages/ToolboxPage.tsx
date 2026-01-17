import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Plus, Trash2, Search, BookOpen, Lightbulb, Star, ChevronRight, X } from 'lucide-react';
import { format } from 'date-fns';
import type { Strategy } from '../types';

const PRESET_TAGS = [
    { label: 'Strength', color: 'bg-emerald-100 text-emerald-700' },
    { label: 'Weakness', color: 'bg-rose-100 text-rose-700' },
    { label: 'Focus', color: 'bg-blue-100 text-blue-700' },
    { label: 'Anxiety', color: 'bg-amber-100 text-amber-700' },
    { label: 'Sleep', color: 'bg-indigo-100 text-indigo-700' },
    { label: 'Energy', color: 'bg-yellow-100 text-yellow-700' },
    { label: 'Morning', color: 'bg-orange-100 text-orange-700' },
];

const ToolboxPage: React.FC = () => {
    const strategies = useLiveQuery(() => db.strategies.toArray()) || [];
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

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
        if (!newTitle.trim()) return;
        await db.strategies.add({
            id: window.crypto.randomUUID(),
            title: newTitle,
            description: newDesc,
            category: 'General', // Deprecated in favor of tags, keeping for schema compat
            tags: newTags,
            findings: []
        });
        setNewTitle('');
        setNewDesc('');
        setNewTags([]);
        setIsAdding(false);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Delete this strategy?')) {
            await db.strategies.delete(id);
            if (selectedStrategy?.id === id) setSelectedStrategy(null);
        }
    };

    const toggleTag = (tag: string) => {
        if (newTags.includes(tag)) {
            setNewTags(newTags.filter(t => t !== tag));
        } else {
            setNewTags([...newTags, tag]);
        }
    };

    const addFinding = async () => {
        if (!selectedStrategy) return;
        const finding = {
            id: window.crypto.randomUUID(),
            date: new Date().toISOString(),
            note: newFindingNote,
            rating: newFindingRating
        };

        const updatedFindings = [finding, ...(selectedStrategy.findings || [])];

        await db.strategies.update(selectedStrategy.id, {
            findings: updatedFindings
        });

        // Optimistic update for local state interaction
        setSelectedStrategy({ ...selectedStrategy, findings: updatedFindings });
        setNewFindingNote('');
        setNewFindingRating(3);
    };

    const filteredStrategies = strategies.filter(s => {
        const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTag = activeFilterTag ? (s.tags || []).includes(activeFilterTag) : true;
        return matchesSearch && matchesTag;
    });

    return (
        <div className="max-w-4xl mx-auto p-4 pb-24 h-[calc(100vh-80px)] flex gap-6">

            {/* Left Panel: List */}
            <div className={`flex-1 flex flex-col space-y-4 ${selectedStrategy ? 'hidden md:flex' : 'flex'}`}>
                <header>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                            <Lightbulb size={24} />
                        </div>
                        Toolbox
                    </h1>
                    <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                        {PRESET_TAGS.map(tag => (
                            <button
                                key={tag.label}
                                onClick={() => setActiveFilterTag(activeFilterTag === tag.label ? null : tag.label)}
                                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold transition-all border ${activeFilterTag === tag.label
                                    ? 'bg-slate-800 text-white border-slate-800'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                {tag.label}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search strategies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pb-20">
                    <button
                        onClick={() => setIsAdding(true)}
                        className="w-full p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-500 transition-all"
                    >
                        <Plus size={20} /> Add New Strategy
                    </button>

                    {filteredStrategies.map(strategy => (
                        <div
                            key={strategy.id}
                            onClick={() => setSelectedStrategy(strategy)}
                            className={`bg-white p-4 rounded-xl border cursor-pointer transition-all text-left ${selectedStrategy?.id === strategy.id
                                ? 'border-primary-500 shadow-md ring-1 ring-primary-500'
                                : 'border-slate-100 shadow-sm hover:border-slate-300'
                                }`}
                        >
                            <div className="flex flex-wrap gap-2 mb-2">
                                {strategy.tags?.map(tag => {
                                    const preset = PRESET_TAGS.find(p => p.label === tag);
                                    return (
                                        <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${preset?.color || 'bg-slate-100 text-slate-600'}`}>
                                            {tag}
                                        </span>
                                    )
                                })}
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg mb-1">{strategy.title}</h3>
                            <p className="text-sm text-slate-500 line-clamp-2">{strategy.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel: Details (or Modal on Mobile) */}
            {selectedStrategy && (
                <div className="fixed inset-0 z-50 md:static md:z-0 md:flex-[1.5] bg-slate-50 md:bg-transparent flex flex-col md:h-full">
                    {/* Mobile Back Button */}
                    <div className="md:hidden p-4 bg-white border-b border-slate-200 flex items-center gap-2">
                        <button onClick={() => setSelectedStrategy(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                            <ChevronRight size={24} className="rotate-180" />
                        </button>
                        <h2 className="font-bold text-lg">Details</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-0">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:h-full flex flex-col">

                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {selectedStrategy.tags?.map(tag => {
                                            const preset = PRESET_TAGS.find(p => p.label === tag);
                                            return (
                                                <span key={tag} className={`px-3 py-1 rounded-lg text-xs font-bold ${preset?.color || 'bg-slate-100 text-slate-600'}`}>
                                                    {tag}
                                                </span>
                                            )
                                        })}
                                    </div>
                                    <h2 className="text-3xl font-bold text-slate-900 mb-2">{selectedStrategy.title}</h2>
                                </div>
                                <button onClick={() => handleDelete(selectedStrategy.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-2">
                                    <Trash2 size={20} />
                                </button>
                            </div>

                            <div className="prose prose-slate max-w-none mb-8">
                                <p className="text-lg text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedStrategy.description}</p>
                            </div>

                            {/* Findings / Logs Section */}
                            <div className="mt-auto border-t border-slate-100 pt-6">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <BookOpen size={20} className="text-indigo-500" /> Findings & Application
                                </h3>

                                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                                    <input
                                        className="w-full bg-transparent border-none outline-none font-medium text-slate-700 placeholder:text-slate-400 mb-2"
                                        placeholder="Add a new finding or observation..."
                                        value={newFindingNote}
                                        onChange={e => setNewFindingNote(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') addFinding();
                                        }}
                                    />
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <button
                                                    key={star}
                                                    onClick={() => setNewFindingRating(star)}
                                                    className={`transition-all hover:scale-110 ${star <= newFindingRating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`}
                                                >
                                                    <Star size={16} />
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={addFinding}
                                            disabled={!newFindingNote.trim()}
                                            className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            Log Finding
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                    {selectedStrategy.findings?.length === 0 && (
                                        <p className="text-slate-400 text-sm text-center italic">No findings recorded yet. Try this tool and log how it went!</p>
                                    )}
                                    {selectedStrategy.findings?.map(finding => (
                                        <div key={finding.id} className="bg-white border border-slate-100 p-3 rounded-lg text-sm">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-slate-400 text-xs font-medium">{format(new Date(finding.date), 'MMM d, h:mm a')}</span>
                                                <div className="flex gap-0.5">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star key={i} size={10} className={i < finding.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} />
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="text-slate-700">{finding.note}</p>
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
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-800">New Strategy</h3>
                            <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                                <input
                                    className="w-full text-lg font-bold border-b-2 border-slate-200 outline-none py-1 focus:border-indigo-500 transition-colors"
                                    placeholder="e.g. Pomodoro Technique"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tags</label>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_TAGS.map(tag => (
                                        <button
                                            key={tag.label}
                                            onClick={() => toggleTag(tag.label)}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${newTags.includes(tag.label)
                                                ? 'bg-slate-800 text-white border-slate-800'
                                                : `${tag.color.split(' ')[0]} ${tag.color.split(' ')[1]} border-transparent opacity-60 hover:opacity-100`
                                                }`}
                                        >
                                            {tag.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                <textarea
                                    className="w-full p-3 bg-slate-50 rounded-xl outline-none resize-none h-32 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700"
                                    placeholder="How does this strategy work?"
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                />
                            </div>

                            <button
                                onClick={handleAdd}
                                disabled={!newTitle.trim()}
                                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                            >
                                Add to Toolbox
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ToolboxPage;
