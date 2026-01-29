import React, { useState, useEffect } from 'react';
import { Zap, Copy, RefreshCw, Check } from 'lucide-react';
import { getSetting, setSetting } from '../../../../services/supabase';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../../../../components/ui/Toast';

interface QuickNotesAPISectionProps {
    userId?: string;
}

export const QuickNotesAPISection: React.FC<QuickNotesAPISectionProps> = ({ userId }) => {
    const toast = useToast();
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [apiKeyCopied, setApiKeyCopied] = useState(false);
    const [isGeneratingKey, setIsGeneratingKey] = useState(false);

    useEffect(() => {
        if (userId) {
            getSetting(userId, 'quick_note_api_key').then(key => {
                if (key) setApiKey(key);
            });
        }
    }, [userId]);

    const generateApiKey = async () => {
        if (!userId) return;
        setIsGeneratingKey(true);
        try {
            const newKey = `qn_${uuidv4().replace(/-/g, '')}`;
            await setSetting(userId, 'quick_note_api_key', newKey);
            setApiKey(newKey);
        } catch (error) {
            console.error('Failed to generate API key:', error);
            toast.error('Failed to generate API key');
        } finally {
            setIsGeneratingKey(false);
        }
    };

    const copyApiKey = () => {
        if (apiKey) {
            navigator.clipboard.writeText(apiKey);
            setApiKeyCopied(true);
            setTimeout(() => setApiKeyCopied(false), 2000);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
                <Zap className="text-cyan-600" size={24} />
                <h2 className="text-xl font-semibold text-slate-800">Quick Notes API</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
                Use this API key with iPhone Shortcuts to quickly capture notes via back-tap.
            </p>

            {apiKey ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <code className="flex-1 p-3 bg-slate-100 rounded-lg text-sm font-mono text-slate-700 truncate">
                            {apiKey}
                        </code>
                        <button
                            onClick={copyApiKey}
                            className="p-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Copy"
                        >
                            {apiKeyCopied ? <Check size={18} className="text-green-600" /> : <Copy size={18} className="text-slate-600" />}
                        </button>
                    </div>
                    <button
                        onClick={generateApiKey}
                        disabled={isGeneratingKey}
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
                    >
                        <RefreshCw size={14} className={isGeneratingKey ? 'animate-spin' : ''} />
                        Regenerate Key
                    </button>
                    <div className="mt-4 p-3 bg-cyan-50 rounded-lg border border-cyan-100">
                        <p className="text-xs text-cyan-800">
                            <strong>Endpoint:</strong> Your Supabase URL + <code>/functions/v1/quick-note</code>
                        </p>
                    </div>
                </div>
            ) : (
                <button
                    onClick={generateApiKey}
                    disabled={isGeneratingKey}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-medium"
                >
                    {isGeneratingKey ? (
                        <RefreshCw size={16} className="animate-spin" />
                    ) : (
                        <Zap size={16} />
                    )}
                    Generate API Key
                </button>
            )}
        </div>
    );
};
