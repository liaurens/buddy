import React, { useState, useRef, useEffect } from 'react';
import { Send, Zap } from 'lucide-react';
import { useSmartNotes } from '../../context/SmartNotesContext';

interface QuickNoteInputProps {
    autoFocus?: boolean;
    onNoteAdded?: () => void;
}

export const QuickNoteInput: React.FC<QuickNoteInputProps> = ({ autoFocus = false, onNoteAdded }) => {
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const { addNote, categories } = useSmartNotes();

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await addNote(content.trim());
            setContent('');
            onNoteAdded?.();
        } catch (error) {
            console.error('Failed to add note:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Detect if current input matches a flag
    const flagMatch = content.match(/-(\w+)/);
    const detectedFlag = flagMatch ? flagMatch[1].toLowerCase() : null;
    const matchingCategory = detectedFlag
        ? categories.find(c => c.flag.toLowerCase() === detectedFlag)
        : null;

    return (
        <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center gap-2 bg-white rounded-xl p-2 border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all shadow-sm">
                <Zap className="w-5 h-5 text-indigo-600 ml-2 flex-shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Quick note... (use -flag to sort)"
                    className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 outline-none text-sm"
                    disabled={isSubmitting}
                />
                <button
                    type="submit"
                    disabled={!content.trim() || isSubmitting}
                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>

            {/* Flag detection indicator */}
            {matchingCategory && (
                <div className="absolute -bottom-6 left-0 text-xs text-slate-600 flex items-center gap-1">
                    <span>Will sort to:</span>
                    <span
                        className="px-2 py-0.5 rounded-full text-white text-xs"
                        style={{ backgroundColor: matchingCategory.color || '#6366f1' }}
                    >
                        {matchingCategory.emoji} {matchingCategory.name}
                    </span>
                </div>
            )}

            {detectedFlag && !matchingCategory && (
                <div className="absolute -bottom-6 left-0 text-xs text-amber-600">
                    Unknown flag "-{detectedFlag}" - will go to Inbox
                </div>
            )}
        </form>
    );
};
