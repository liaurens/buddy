import React, { useState } from 'react';
import { X, Bug, MessageSquare, StickyNote, Download, Trash2, Copy, Eraser } from 'lucide-react';
import {
    deleteFeedback,
    deleteManyFeedback,
    deleteAllFeedback,
    type SiteFeedback,
} from '../../services/supabase/operations/site-feedback';

interface ReportListModalProps {
    reports: SiteFeedback[];
    onClose: () => void;
    onRefresh?: () => void;
}

export function ReportListModal({ reports, onClose, onRefresh }: ReportListModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [exportedMarkdown, setExportedMarkdown] = useState<string | null>(null);
    const [clearing, setClearing] = useState(false);

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0 || clearing) return;
        if (
            !window.confirm(
                `Delete ${selectedIds.size} selected report${selectedIds.size === 1 ? '' : 's'}?`,
            )
        )
            return;
        setClearing(true);
        try {
            const success = await deleteManyFeedback([...selectedIds]);
            if (success) {
                setSelectedIds(new Set());
                if (onRefresh) onRefresh();
            } else {
                alert('Failed to delete the selected reports.');
            }
        } finally {
            setClearing(false);
        }
    };

    const handleClearAll = async () => {
        if (reports.length === 0 || clearing) return;
        if (!window.confirm(`Clear all ${reports.length} reports? This cannot be undone.`)) return;
        setClearing(true);
        try {
            const success = await deleteAllFeedback();
            if (success) {
                setSelectedIds(new Set());
                if (onRefresh) onRefresh();
            } else {
                alert('Failed to clear reports.');
            }
        } finally {
            setClearing(false);
        }
    };

    const handleDeleteOlderThan = async (days: number) => {
        if (clearing) return;
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const stale = reports.filter(
            (r) => r.created_at && new Date(r.created_at).getTime() < cutoff,
        );
        if (stale.length === 0) {
            alert(`No reports older than ${days} days.`);
            return;
        }
        if (
            !window.confirm(
                `Delete ${stale.length} report${stale.length === 1 ? '' : 's'} older than ${days} days?`,
            )
        )
            return;
        setClearing(true);
        try {
            const success = await deleteManyFeedback(stale.map((r) => r.id!));
            if (success) {
                setSelectedIds(new Set());
                if (onRefresh) onRefresh();
            } else {
                alert('Failed to delete old reports.');
            }
        } finally {
            setClearing(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'bug':
                return <Bug size={16} className="text-red-500" />;
            case 'feature':
                return <MessageSquare size={16} className="text-blue-500" />;
            case 'note':
                return <StickyNote size={16} className="text-amber-500" />;
            default:
                return null;
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(reports.map((r) => r.id!)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this feedback report?')) {
            const success = await deleteFeedback(id);
            if (success) {
                if (selectedIds.has(id)) {
                    const newSet = new Set(selectedIds);
                    newSet.delete(id);
                    setSelectedIds(newSet);
                }
                if (onRefresh) onRefresh();
            } else {
                alert('Failed to delete report.');
            }
        }
    };

    const generateMarkdown = async () => {
        try {
            const selectedReports = reports.filter((r) => selectedIds.has(r.id!));
            if (selectedReports.length === 0) return;

            let md = `# Bug Reports for Claude Code — ${new Date().toLocaleDateString()}\n\n`;
            md += `Fix each issue below. The app uses React 19 + TypeScript + Vite, Tailwind CSS, Supabase backend. Route/page is indicated per issue.\n\n`;
            md += `---\n\n`;

            selectedReports.forEach((r, i) => {
                const desc = r.description || 'No description provided';
                const typeLabel =
                    r.type === 'bug' ? 'BUG' : r.type === 'feature' ? 'CHANGE REQUEST' : 'NOTE';
                const page = r.pathname || '/';

                md += `## ${i + 1}. [${typeLabel}] ${desc.split('\n')[0]}\n\n`;
                md += `- **Page:** \`${page}\`\n`;
                if (r.selector) {
                    md += `- **Element:** \`${r.selector.split('>').slice(-2).join('>').trim()}\`\n`;
                }
                md += `\n**Issue:**\n${desc}\n\n`;
                md += `---\n\n`;
            });

            setExportedMarkdown(md);

            // Delete exported reports from the database
            await Promise.all(selectedReports.map((r) => deleteFeedback(r.id!)));
            if (onRefresh) onRefresh();
        } catch (err: unknown) {
            console.error(err);
            alert(
                'Failed to compile markdown: ' +
                    (err instanceof Error ? err.message : 'Unknown error'),
            );
        }
    };

    const copyToClipboard = () => {
        if (exportedMarkdown) {
            navigator.clipboard.writeText(exportedMarkdown);
            alert('Markdown copied to clipboard!');
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 dev-portal-ui">
            <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-semibold text-gray-800">
                            {exportedMarkdown ? 'Exported Report Text' : 'Site Feedback & Reports'}
                        </h2>
                        {!exportedMarkdown && selectedIds.size > 0 && (
                            <button
                                onClick={generateMarkdown}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                            >
                                <Download size={16} />
                                Generate MD for {selectedIds.size}{' '}
                                {selectedIds.size === 1 ? 'item' : 'items'}
                            </button>
                        )}
                        {!exportedMarkdown && selectedIds.size > 0 && (
                            <button
                                onClick={handleDeleteSelected}
                                disabled={clearing}
                                className="flex items-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                <Trash2 size={16} />
                                Delete selected
                            </button>
                        )}
                        {!exportedMarkdown && reports.length > 0 && selectedIds.size === 0 && (
                            <>
                                <button
                                    onClick={() => handleDeleteOlderThan(7)}
                                    disabled={clearing}
                                    className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    title="Delete reports older than 7 days"
                                >
                                    <Trash2 size={16} />
                                    Older than 7d
                                </button>
                                <button
                                    onClick={() => handleDeleteOlderThan(30)}
                                    disabled={clearing}
                                    className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    title="Delete reports older than 30 days"
                                >
                                    <Trash2 size={16} />
                                    Older than 30d
                                </button>
                            </>
                        )}
                        {!exportedMarkdown && reports.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                disabled={clearing}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                            >
                                <Eraser size={16} />
                                {clearing ? 'Clearing…' : 'Clear all'}
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {exportedMarkdown ? (
                    <div className="flex-1 flex flex-col min-h-0 bg-gray-50 p-6 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-gray-500 border border-gray-300 bg-gray-100 px-3 py-1 rounded inline-block">
                                Markdown Viewer
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setExportedMarkdown(null)}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 font-medium text-sm text-gray-700 flex items-center gap-2 transition-colors"
                                >
                                    Back to List
                                </button>
                                <button
                                    onClick={copyToClipboard}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded shadow-sm hover:bg-indigo-700 font-medium text-sm flex items-center gap-2 transition-colors"
                                >
                                    <Copy size={16} />
                                    Copy to Clipboard
                                </button>
                            </div>
                        </div>
                        <textarea
                            readOnly
                            className="flex-1 w-full p-4 font-mono text-sm border border-gray-200 rounded-lg shadow-inner focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none bg-white whitespace-pre-wrap break-words"
                            value={exportedMarkdown}
                        />
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto p-0 border-t border-gray-200 bg-white">
                        {reports.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <MessageSquare className="mx-auto mb-3 opacity-20" size={48} />
                                <p>No feedback reported yet.</p>
                            </div>
                        ) : (
                            <div className="min-w-full inline-block align-middle">
                                <table className="min-w-full divide-y divide-gray-200 text-sm text-left text-gray-600 custom-table-layout">
                                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 w-12 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    checked={
                                                        reports.length > 0 &&
                                                        selectedIds.size === reports.length
                                                    }
                                                    onChange={handleSelectAll}
                                                    title="Select All"
                                                />
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider"
                                            >
                                                Type
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider w-1/3"
                                            >
                                                Description
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider"
                                            >
                                                Date
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider"
                                            >
                                                Element Selector
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-right"
                                            >
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {reports.map((report) => (
                                            <tr
                                                key={report.id}
                                                onClick={() => handleSelectOne(report.id!)}
                                                className="hover:bg-indigo-50/50 transition-colors cursor-pointer"
                                            >
                                                <td
                                                    className="px-6 py-4 whitespace-nowrap w-12 text-center"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        checked={selectedIds.has(report.id!)}
                                                        onChange={() => handleSelectOne(report.id!)}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap flex items-center gap-2 font-medium capitalize">
                                                    {getIcon(report.type)}
                                                    {report.type === 'feature'
                                                        ? 'Change Req'
                                                        : report.type}
                                                </td>
                                                <td
                                                    className="px-6 py-4"
                                                    title={report.description}
                                                >
                                                    <div className="max-w-xs break-words line-clamp-2">
                                                        {report.description}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                                                    {new Date(report.created_at!).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {report.selector ? (
                                                        <div
                                                            className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded max-w-[150px] truncate"
                                                            title={report.selector}
                                                        >
                                                            {report.selector}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 italic text-xs">
                                                            No element attached
                                                        </span>
                                                    )}
                                                </td>
                                                <td
                                                    className="px-6 py-4 whitespace-nowrap text-right"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        onClick={(e) => handleDelete(report.id!, e)}
                                                        className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                                                        title="Delete Report"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
