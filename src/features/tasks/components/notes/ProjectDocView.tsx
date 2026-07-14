/**
 * ProjectDocView — the "structured document" for project notes.
 *
 * Project notes captured anywhere (in-app, or the iPhone shortcut via the
 * `-project` flag) all land in the Project note category. This view compiles
 * them into one dated, readable document with one-tap capture and a Markdown
 * export, so scattered jottings read back as a single living doc.
 */

import React, { useMemo, useState } from 'react';
import { FileText, Copy, Check, Send, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useNotes } from '../../hooks/useNotes';
import type { NoteCategory, SmartNote } from '../../types';

function findProjectCategory(categories: NoteCategory[]): NoteCategory | undefined {
    return (
        categories.find((c) => c.flag.toLowerCase() === 'project') ??
        categories.find((c) => c.name.toLowerCase() === 'project')
    );
}

interface DayGroup {
    key: string;
    label: string;
    notes: SmartNote[];
}

/** Group notes (already newest-first) by calendar day. */
function groupByDay(notes: SmartNote[]): DayGroup[] {
    const groups: DayGroup[] = [];
    const index = new Map<string, DayGroup>();
    for (const note of notes) {
        const date = new Date(note.createdAt);
        const key = format(date, 'yyyy-MM-dd');
        let group = index.get(key);
        if (!group) {
            group = { key, label: format(date, 'EEEE, MMMM d, yyyy'), notes: [] };
            index.set(key, group);
            groups.push(group);
        }
        group.notes.push(note);
    }
    return groups;
}

function buildMarkdown(title: string, groups: DayGroup[]): string {
    let md = `# ${title}\n\n`;
    for (const group of groups) {
        md += `## ${group.label}\n\n`;
        for (const note of group.notes) {
            md += `- ${note.content}\n`;
        }
        md += `\n`;
    }
    return md.trimEnd() + '\n';
}

const ProjectDocView: React.FC = () => {
    const { notes, categories, addNote, deleteNote } = useNotes();
    const [draft, setDraft] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [copied, setCopied] = useState(false);

    const category = useMemo(() => findProjectCategory(categories), [categories]);

    const projectNotes = useMemo(
        () => (category ? notes.filter((n) => n.categoryId === category.id) : []),
        [notes, category],
    );
    const groups = useMemo(() => groupByDay(projectNotes), [projectNotes]);

    const title = category?.name ?? 'Project notes';

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text || submitting || !category) return;
        setSubmitting(true);
        try {
            // Reuse the flag pipeline so the note routes to the Project category.
            await addNote(`${text} -${category.flag}`);
            setDraft('');
        } catch (err) {
            console.error('Failed to add project note:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(buildMarkdown(title, groups));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy markdown:', err);
        }
    };

    if (!category) {
        return (
            <div className="py-12 text-center text-sm text-slate-500">
                No “Project” category found. Create one in note settings (flag{' '}
                <code className="rounded bg-slate-100 px-1">-project</code>) to start a project doc.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                    <FileText className="h-5 w-5" style={{ color: category.color || '#ec4899' }} />
                    {title}
                    <span className="text-sm font-normal text-slate-500">
                        ({projectNotes.length})
                    </span>
                </h2>
                {projectNotes.length > 0 && (
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        {copied ? (
                            <Check size={15} className="text-emerald-600" />
                        ) : (
                            <Copy size={15} />
                        )}
                        {copied ? 'Copied' : 'Copy as Markdown'}
                    </button>
                )}
            </div>

            <form
                onSubmit={handleAdd}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100"
            >
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Add a project note…"
                    className="ml-2 flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                    disabled={submitting}
                />
                <button
                    type="submit"
                    disabled={!draft.trim() || submitting}
                    className="rounded-lg bg-indigo-600 p-2 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Send className="h-4 w-4" />
                </button>
            </form>

            {groups.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                    No project notes yet. Add one above, or capture with{' '}
                    <code className="rounded bg-slate-100 px-1">-project</code> from the iPhone
                    shortcut.
                </div>
            ) : (
                <div className="space-y-5">
                    {groups.map((group) => (
                        <section key={group.key}>
                            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                {group.label}
                            </h3>
                            <ul className="space-y-1.5">
                                {group.notes.map((note) => (
                                    <li
                                        key={note.id}
                                        className="group flex items-start gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2"
                                    >
                                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                        <p className="flex-1 whitespace-pre-wrap text-sm text-slate-700">
                                            {note.content}
                                        </p>
                                        <button
                                            onClick={() => deleteNote(note.id)}
                                            className="shrink-0 text-slate-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
                                            aria-label="Delete note"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProjectDocView;
