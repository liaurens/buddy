import React, { useState } from 'react';
import { Download, Upload, Trash2 } from 'lucide-react';
import { supabase } from '../../../../services/supabase';
import { useToast } from '../../../../components/ui/Toast';

interface DataManagementSectionProps {
    userId?: string;
    onExport: () => Promise<string>;
    onImport: (data: string) => Promise<boolean>;
}

export const DataManagementSection: React.FC<DataManagementSectionProps> = ({
    userId,
    onExport,
    onImport,
}) => {
    const toast = useToast();
    const [importText, setImportText] = useState('');
    const [showImport, setShowImport] = useState(false);

    const handleExport = async () => {
        const data = await onExport();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `life-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = async () => {
        if (await onImport(importText)) {
            toast.success('Data imported successfully!');
            setImportText('');
            setShowImport(false);
        } else {
            toast.error('Failed to import data. Invalid format.');
        }
    };

    const handleResetDatabase = async () => {
        if (confirm('ARE YOU SURE? This will delete ALL your data (trackers, entries, protocols). This cannot be undone.')) {
            if (!userId) return;
            try {
                await Promise.all([
                    supabase.from('entries').delete().eq('user_id', userId),
                    supabase.from('doses').delete().eq('user_id', userId),
                    supabase.from('cycles').delete().eq('user_id', userId),
                    supabase.from('correlations').delete().eq('user_id', userId),
                ]);
                await supabase.from('experiments').delete().eq('user_id', userId);
                await supabase.from('protocols').delete().eq('user_id', userId);
                await supabase.from('trackers').delete().eq('user_id', userId);
                await supabase.from('strategies').delete().eq('user_id', userId);
                await supabase.from('todos').delete().eq('user_id', userId);
                await supabase.from('settings').delete().eq('user_id', userId);

                window.location.reload();
            } catch (error) {
                console.error('Failed to delete data:', error);
                toast.error('Failed to reset data. See console for details.');
            }
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h2 className="font-bold text-slate-800">Data Management</h2>
            </div>
            <div className="p-4 space-y-4">
                <div className="flex gap-4">
                    <button
                        onClick={handleExport}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium transition-colors"
                    >
                        <Download size={20} /> Export Data
                    </button>
                    <button
                        onClick={() => setShowImport(!showImport)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium transition-colors"
                    >
                        <Upload size={20} /> Import Data
                    </button>
                </div>

                {showImport && (
                    <div className="space-y-3 p-4 bg-slate-50 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <label className="block text-sm font-medium text-slate-700">Paste JSON Data</label>
                        <textarea
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            className="w-full h-32 p-3 text-sm font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder='{"entries": [...], "trackers": [...] }'
                        />
                        <button
                            onClick={handleImport}
                            className="w-full py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
                        >
                            Import Data
                        </button>
                    </div>
                )}

                <div className="pt-4 border-t border-slate-100">
                    <h3 className="font-bold text-rose-600 mb-2 text-sm uppercase tracking-wider">Danger Zone</h3>
                    <button
                        onClick={handleResetDatabase}
                        className="w-full py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-bold hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                    >
                        <Trash2 size={20} /> Delete All Data
                    </button>
                    <p className="text-xs text-center text-slate-400 mt-2">
                        This will permanently delete all your data from the cloud.
                    </p>
                </div>
            </div>
        </div>
    );
};
