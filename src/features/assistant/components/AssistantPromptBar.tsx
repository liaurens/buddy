import React, { useCallback, useRef } from 'react';
import { useAssistant } from '../hooks/useAssistant';
import { useAssistantHistory } from '../hooks/useAssistantHistory';
import AssistantResponseCard from './AssistantResponseCard';
import CaptureInput, { type CaptureInputHandle } from './CaptureInput';
import PendingSyncBadge from './PendingSyncBadge';
import type { AppRoute } from '../../../constants/routes';
import { PencilLine } from 'lucide-react';

interface AssistantPromptBarProps {
    onNavigate?: (route: AppRoute) => void;
    placeholder?: string;
    onMessageSent?: (input: string) => void;
    compact?: boolean;
}

const AssistantPromptBar: React.FC<AssistantPromptBarProps> = ({
    onNavigate,
    placeholder = 'Capture anything — type / for commands…',
    onMessageSent,
    compact = false,
}) => {
    const { send, isLoading, lastResponse, error, reset } = useAssistant();
    const { addUserMessage, addAssistantMessage } = useAssistantHistory();
    const captureInputRef = useRef<CaptureInputHandle>(null);

    const handleChunk = useCallback(
        async (chunk: string) => {
            const userMsgId = addUserMessage(chunk);
            const response = await send(chunk);
            if (response) {
                const content =
                    response.action_taken || (response.success ? 'Done.' : 'Something went wrong.');
                addAssistantMessage(content, response, userMsgId);
            }
        },
        [send, addUserMessage, addAssistantMessage],
    );

    const handleBeforeSubmit = useCallback(
        (text: string) => {
            onMessageSent?.(text);
            reset();
        },
        [onMessageSent, reset],
    );

    return (
        <div className="space-y-3">
            <section className={`app-surface ${compact ? 'p-2.5' : 'p-3 sm:p-4'}`}>
                <div className="flex items-end gap-3">
                    <div
                        className={`mb-1 flex flex-shrink-0 items-center justify-center rounded-xl text-cove-muted ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}
                    >
                        <PencilLine size={compact ? 18 : 21} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <CaptureInput
                            ref={captureInputRef}
                            onSubmit={handleChunk}
                            onBeforeSubmit={handleBeforeSubmit}
                            isLoading={isLoading}
                            placeholder={placeholder}
                            consumeVoiceDraft
                            enableBrainDump
                            richHints
                            hintsPosition="below"
                            variant="bare"
                        />
                    </div>
                </div>
                <div
                    className={`flex flex-wrap items-center gap-2 pl-1 text-[11px] text-cove-soft ${compact ? 'mt-2' : 'mt-3'}`}
                >
                    <PendingSyncBadge />
                    {!compact && <span>Examples:</span>}
                    {!compact &&
                        ['Call mom tomorrow', 'Read ch. 4', 'Grocery list'].map((example) => (
                            <button
                                key={example}
                                type="button"
                                // eslint-disable-next-line react-hooks/refs -- calling the CaptureInput imperative handle from a click handler is intended
                                onClick={() => captureInputRef.current?.fill(example)}
                                className="rounded-xl border border-cove-border bg-[color:var(--buddy-surface-soft)] px-2.5 py-1 font-bold text-cove-soft transition-colors hover:border-cove-border hover:bg-white hover:text-cove-muted"
                            >
                                {example}
                            </button>
                        ))}
                </div>
            </section>

            {lastResponse && (
                <AssistantResponseCard
                    response={lastResponse}
                    onNavigate={onNavigate as (route: string) => void}
                />
            )}
            {error && !lastResponse && <p className="text-xs text-cove-danger px-1">{error}</p>}
        </div>
    );
};

export default AssistantPromptBar;
