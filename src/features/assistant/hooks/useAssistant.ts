import { useState, useCallback } from 'react';
import { sendAssistantMessage } from '../services/assistant.service';
import type { AssistantResponse } from '../types';

interface UseAssistantReturn {
    send: (input: string) => Promise<AssistantResponse | null>;
    isLoading: boolean;
    lastResponse: AssistantResponse | null;
    error: string | null;
    reset: () => void;
}

export function useAssistant(): UseAssistantReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [lastResponse, setLastResponse] = useState<AssistantResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const send = useCallback(async (input: string): Promise<AssistantResponse | null> => {
        if (!input.trim()) return null;

        setIsLoading(true);
        setError(null);

        try {
            const response = await sendAssistantMessage(input);
            setLastResponse(response);
            if (!response.success) {
                setError(response.error || response.action_taken || 'Something went wrong');
            }
            return response;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Request failed';
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setLastResponse(null);
        setError(null);
    }, []);

    return { send, isLoading, lastResponse, error, reset };
}
