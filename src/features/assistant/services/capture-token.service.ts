import { invokeAssistantAction } from './assistant.service';

export interface CaptureTokenStatus {
    configured: boolean;
    prefix: string | null;
    createdAt: string | null;
    lastUsedAt: string | null;
}

export interface CaptureTokenRotation extends CaptureTokenStatus {
    token: string;
}

async function invokeCaptureAction<T>(
    action: 'capture.token.status' | 'capture.token.rotate',
): Promise<T> {
    const response = await invokeAssistantAction('planning', action, {});
    if (!response.success) {
        throw new Error(response.error || response.action_taken || 'Capture token request failed');
    }
    return response.data as T;
}

export function getCaptureTokenStatus(): Promise<CaptureTokenStatus> {
    return invokeCaptureAction('capture.token.status');
}

export function rotateCaptureToken(): Promise<CaptureTokenRotation> {
    return invokeCaptureAction('capture.token.rotate');
}

export async function clearPrivateAccountData(): Promise<void> {
    const response = await invokeAssistantAction('planning', 'account.secrets.clear', {});
    if (!response.success) {
        throw new Error(
            response.error || response.action_taken || 'Private credential cleanup failed',
        );
    }
}
