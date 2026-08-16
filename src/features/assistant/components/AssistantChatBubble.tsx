import React from 'react';
import { format } from 'date-fns';
import AssistantResponseCard from './AssistantResponseCard';
import type { ChatMessage } from '../types';

interface AssistantChatBubbleProps {
    message: ChatMessage;
    onNavigate?: (route: string) => void;
}

const AssistantChatBubble: React.FC<AssistantChatBubbleProps> = ({ message, onNavigate }) => {
    const isUser = message.role === 'user';
    const timeStr = format(new Date(message.timestamp), 'HH:mm');

    if (isUser) {
        return (
            <div className="flex items-end justify-end gap-2">
                <div className="max-w-[80%]">
                    <div className="rounded-[18px] rounded-br-[4px] bg-cove-accent px-4 py-2.5 text-sm font-bold leading-snug text-white shadow-cove">
                        {message.content}
                    </div>
                    <p className="mr-1 mt-1 text-right text-[10px] font-bold text-cove-faint">
                        {timeStr}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start justify-start gap-2">
            <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-cove-tint-blue">
                <span className="text-xs font-extrabold text-cove-accent">B</span>
            </div>
            <div className="max-w-[85%] space-y-1">
                {message.response?.data?.isConversational ? (
                    <div className="whitespace-pre-wrap rounded-bubble border-0 bg-white px-4 py-2.5 text-sm font-semibold leading-relaxed text-cove-ink shadow-cove">
                        {message.response.action_taken || message.content}
                    </div>
                ) : message.response ? (
                    <AssistantResponseCard response={message.response} onNavigate={onNavigate} />
                ) : (
                    <div className="rounded-bubble border-0 bg-white px-4 py-2.5 text-sm font-semibold leading-relaxed text-cove-ink shadow-cove">
                        {message.content}
                    </div>
                )}
                <p className="ml-1 text-[10px] font-bold text-cove-faint">{timeStr}</p>
            </div>
        </div>
    );
};

export default AssistantChatBubble;
