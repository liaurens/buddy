import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import type { Experiment } from '../../types';
import { supabase } from '../../../../services/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../hooks/useAuth';

interface ExperimentAgentChatProps {
    experimentId: string;
    experiment: Experiment;
}

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
}

const SUGGESTED_PROMPTS = [
    'What metrics should I track?',
    'Analyze my latest data',
    'Suggest a phase change',
    'Is my data meaningful yet?',
];

const ExperimentAgentChat: React.FC<ExperimentAgentChatProps> = ({ experimentId, experiment }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load conversation history
    const { data: conversation } = useQuery({
        queryKey: ['experiment-agent-conversation', experimentId, user?.id],
        queryFn: async () => {
            if (!user) return null;
            const { data } = await supabase
                .from('experiment_agent_conversations')
                .select('*')
                .eq('experiment_id', experimentId)
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data;
        },
        enabled: !!user && !!experimentId,
    });

    const messages: Message[] = (conversation?.messages || []) as Message[];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const send = async (messageText: string) => {
        if (!messageText.trim() || !user || sending) return;
        setSending(true);
        setInput('');

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const response = await fetch(`${supabaseUrl}/functions/v1/experiment-agent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    message: messageText,
                    experiment_id: experimentId,
                }),
            });

            if (!response.ok) throw new Error(`Agent error: ${response.status}`);
            await response.json();

            queryClient.invalidateQueries({
                queryKey: ['experiment-agent-conversation', experimentId, user.id],
            });
            queryClient.invalidateQueries({ queryKey: ['experiments', user.id] });
            queryClient.invalidateQueries({ queryKey: ['experiment-checkins', experimentId] });
        } catch (err) {
            console.error('Agent error:', err);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col h-[500px]">
            {/* Header */}
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Sparkles size={16} className="text-white" />
                </div>
                <div>
                    <div className="text-sm font-semibold text-slate-800">Experiment Agent</div>
                    <div className="text-xs text-slate-500">Ask about "{experiment.name}"</div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
                {messages.length === 0 ? (
                    <div className="text-center py-8 space-y-4">
                        <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
                            <Bot size={28} className="text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-600 font-medium">
                                How can I help with your experiment?
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                I can suggest metrics, analyze your data, recommend phase changes,
                                and more.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center pt-2">
                            {SUGGESTED_PROMPTS.map((prompt) => (
                                <button
                                    key={prompt}
                                    onClick={() => send(prompt)}
                                    disabled={sending}
                                    className="px-3 py-1.5 text-xs bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-full transition-colors"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    msg.role === 'user'
                                        ? 'bg-slate-200'
                                        : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                                }`}
                            >
                                {msg.role === 'user' ? (
                                    <User size={14} className="text-slate-600" />
                                ) : (
                                    <Bot size={14} className="text-white" />
                                )}
                            </div>
                            <div
                                className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                                    msg.role === 'user'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-800'
                                }`}
                            >
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        </div>
                    ))
                )}
                {sending && (
                    <div className="flex gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <Bot size={14} className="text-white" />
                        </div>
                        <div className="px-3 py-2 bg-slate-100 rounded-2xl">
                            <Loader2 size={14} className="animate-spin text-slate-500" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="pt-3 border-t border-slate-100 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send(input);
                        }
                    }}
                    placeholder="Ask about your experiment..."
                    disabled={sending}
                    className="flex-1 p-2.5 border border-slate-200 rounded-xl text-sm disabled:bg-slate-50"
                />
                <button
                    onClick={() => send(input)}
                    disabled={!input.trim() || sending}
                    className="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
};

export default ExperimentAgentChat;
