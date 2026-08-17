import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Trash2, BookOpen, Menu, Plus, MessageSquare, Edit2 } from 'lucide-react';
import { useAssistant } from '../hooks/useAssistant';
import { useAssistantHistory } from '../hooks/useAssistantHistory';
import AssistantChatBubble from './AssistantChatBubble';
import AssistantGuide from './AssistantGuide';
import CaptureInput from './CaptureInput';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import type { AppRoute } from '../../../constants/routes';
import type { AssistantResponse } from '../types';

interface AssistantChatProps {
    onNavigate?: (route: AppRoute) => void;
}

const AssistantChat: React.FC<AssistantChatProps> = ({ onNavigate }) => {
    const [showGuide, setShowGuide] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [editingConvoId, setEditingConvoId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const { send, isLoading } = useAssistant();
    const {
        conversations,
        activeConversationId,
        messages,
        addUserMessage,
        addAssistantMessage,
        createConversation,
        switchConversation,
        renameConversation,
        deleteConversation,
    } = useAssistantHistory();

    const bottomRef = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (editingConvoId && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editingConvoId]);

    const handleChunk = useCallback(
        async (chunk: string) => {
            const userMsgId = addUserMessage(chunk);
            const response = await send(chunk);
            if (response) {
                const content =
                    response.action_taken || (response.success ? 'Done.' : 'Something went wrong.');
                addAssistantMessage(content, response, userMsgId);
            } else {
                const errorResponse: AssistantResponse = {
                    success: false,
                    intent: 'unknown',
                    action_taken: 'Request failed. Check your AI settings in Account.',
                    data: {},
                };
                addAssistantMessage(errorResponse.action_taken, errorResponse, userMsgId);
            }
        },
        [send, addUserMessage, addAssistantMessage],
    );

    const handleCreateNew = () => {
        createConversation();
        setShowSidebar(false);
        setShowGuide(false);
    };

    const handleSwitch = (id: string) => {
        switchConversation(id);
        setShowSidebar(false);
        setShowGuide(false);
    };

    const handleStartEdit = (id: string, currentTitle: string) => {
        setEditingConvoId(id);
        setEditTitle(currentTitle);
    };

    const handleSaveEdit = (id: string) => {
        const trimmed = editTitle.trim();
        if (trimmed) {
            renameConversation(id, trimmed);
        }
        setEditingConvoId(null);
    };

    const handleDeleteConvo = (id: string) => {
        setPendingDeleteId(id);
    };

    const confirmDeleteConvo = () => {
        if (pendingDeleteId) {
            deleteConversation(pendingDeleteId);
        }
        setPendingDeleteId(null);
    };

    return (
        <div className="relative flex h-full overflow-hidden rounded-xl border border-cove-border bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            {/* Sidebar Overlay (Mobile/Narrow views) */}
            {showSidebar && (
                <div
                    className="absolute inset-0 bg-cove-ink/20 z-40"
                    onClick={() => setShowSidebar(false)}
                />
            )}

            {/*
             * Conversations drawer — always a drawer, never a permanent column.
             * Tailwind's `lg:` keys off the viewport, but this page renders inside
             * MainLayout's 520px shell, so on a desktop browser `lg:` matched and
             * pinned a 256px sidebar beside a ~180px chat column: replies wrapped
             * to two or three words a line. No viewport breakpoint can describe
             * the shell, so the narrow layout is the only layout.
             */}
            <div
                className={`absolute z-50 flex h-full w-64 flex-col border-r border-cove-border bg-[color:var(--buddy-surface-soft)]/85 transition-transform duration-300 ease-in-out ${showSidebar ? 'translate-x-0' : 'hidden -translate-x-full'}`}
            >
                <div className="p-4 border-b border-cove-border flex items-center justify-between">
                    <h2 className="font-semibold text-cove-muted">Chats</h2>
                    <button
                        onClick={handleCreateNew}
                        className="rounded-xl bg-cove-tint-blue p-1.5 text-cove-ink transition-colors hover:bg-cove-accent-pale"
                        title="New Chat"
                    >
                        <Plus size={16} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {conversations.length === 0 && (
                        <p className="text-xs text-center text-cove-faint mt-4">
                            No conversations yet.
                        </p>
                    )}
                    {conversations.map((c) => (
                        <div
                            key={c.id}
                            className={`group flex w-full items-center rounded-xl border px-3 py-2.5 text-sm transition-colors ${activeConversationId === c.id ? 'border-cove-accent-pale bg-cove-tint-blue shadow-cove' : 'border-transparent hover:bg-[color:var(--buddy-surface-soft)]'}`}
                        >
                            <div
                                className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                                onClick={() => handleSwitch(c.id)}
                            >
                                <MessageSquare
                                    size={14}
                                    className={
                                        activeConversationId === c.id
                                            ? 'text-cove-accent'
                                            : 'text-cove-faint'
                                    }
                                />
                                {editingConvoId === c.id ? (
                                    <input
                                        ref={editInputRef}
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(c.id)}
                                        onBlur={() => handleSaveEdit(c.id)}
                                        className="flex-1 min-w-0 bg-white border-cove-accent rounded px-1.5 py-0.5 text-xs text-cove-ink focus:outline-none focus:ring-1 focus:ring-cove-accent"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span
                                        className={`truncate font-bold ${activeConversationId === c.id ? 'text-cove-ink' : 'text-cove-muted'}`}
                                    >
                                        {c.title}
                                    </span>
                                )}
                            </div>

                            {/* Actions */}
                            {!editingConvoId && (
                                <div className="hidden group-hover:flex items-center ml-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartEdit(c.id, c.title);
                                        }}
                                        className="p-1 text-cove-faint hover:text-cove-accent rounded"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteConvo(c.id);
                                        }}
                                        className="p-1 text-cove-faint hover:text-cove-danger rounded"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex flex-col flex-1 min-w-0 h-full">
                {/* Chat header */}
                <div className="flex flex-shrink-0 items-center justify-between border-b border-cove-border bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            aria-label="Show chats"
                            className="p-1.5 text-cove-soft hover:bg-[color:var(--buddy-surface-soft)] rounded-xl transition-colors"
                        >
                            <Menu size={18} />
                        </button>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cove-accent shadow-inner">
                            <span className="text-xs font-bold text-white">B</span>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-cove-ink">Buddy Assistant</p>
                            <p className="text-[10px] text-cove-soft font-bold tracking-wide w-full truncate">
                                {conversations.find((c) => c.id === activeConversationId)?.title ||
                                    'AI-powered personal assistant'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowGuide(!showGuide)}
                            aria-label="Toggle guide"
                            className={`p-1.5 rounded-xl transition-colors border ${
                                showGuide
                                    ? 'text-cove-accent bg-cove-tint-blue border-cove-accent-pale'
                                    : 'text-cove-faint border-transparent hover:text-cove-accent hover:bg-[color:var(--buddy-surface-soft)]'
                            }`}
                        >
                            <BookOpen size={16} />
                        </button>
                    </div>
                </div>

                {/* Messages list */}
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[color:var(--buddy-surface-soft)]/60 px-4 py-4">
                    {showGuide && <AssistantGuide />}
                    {!showGuide && messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-cove-faint text-sm px-6">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cove-tint-blue">
                                <MessageSquare size={24} className="text-cove-accent" />
                            </div>
                            <p className="font-bold text-cove-muted mb-2 text-lg">
                                Start a conversation
                            </p>
                            <p className="text-xs max-w-sm mx-auto leading-relaxed text-cove-soft">
                                Type{' '}
                                <span className="font-mono text-cove-accent bg-cove-tint-blue px-1 py-0.5 rounded">
                                    /
                                </span>{' '}
                                for commands, or just ask whatever comes to mind naturally. Buddy
                                can track your health, manage tasks, and organize your day.
                            </p>
                            <button
                                onClick={() => setShowGuide(true)}
                                className="mt-6 px-4 py-2 bg-white border border-cove-border rounded-xl text-xs font-semibold text-cove-muted hover:text-cove-accent hover:border-cove-accent-pale hover:bg-cove-tint-blue transition-all shadow-cove"
                            >
                                View full setup guide
                            </button>
                        </div>
                    ) : !showGuide ? (
                        messages.map((message) => (
                            <AssistantChatBubble
                                key={message.id}
                                message={message}
                                onNavigate={onNavigate as (route: string) => void}
                            />
                        ))
                    ) : null}
                    {isLoading && (
                        <div className="flex justify-start gap-2 items-start">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-cove-accent shadow-inner">
                                <span className="text-xs font-bold text-white">B</span>
                            </div>
                            <div className="bg-white border border-cove-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-cove">
                                <div className="flex gap-1.5 items-center h-4">
                                    <span className="w-1.5 h-1.5 bg-cove-accent-pale rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-1.5 h-1.5 bg-cove-accent-pale rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-1.5 h-1.5 bg-cove-accent-pale rounded-full animate-bounce" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Input bar */}
                <div className="px-4 py-3 border-t border-cove-border bg-white flex-shrink-0">
                    <CaptureInput
                        onSubmit={handleChunk}
                        isLoading={isLoading}
                        placeholder="Ask something or type / for commands..."
                        ariaLabel="Chat input"
                        consumeVoiceDraft
                        enableBrainDump
                        hintsPosition="above"
                        variant="comfortable"
                    />
                </div>
            </div>

            <ConfirmDialog
                isOpen={pendingDeleteId !== null}
                title="Delete chat"
                message="Are you sure you want to delete this chat session?"
                confirmLabel="Delete"
                destructive
                onConfirm={confirmDeleteConvo}
                onCancel={() => setPendingDeleteId(null)}
            />
        </div>
    );
};

export default AssistantChat;
