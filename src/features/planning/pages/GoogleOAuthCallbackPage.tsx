/**
 * Google OAuth callback landing page.
 *
 * Reached at /oauth/google/callback?code=…&state=… after the user consents.
 * Exchanges the code (via the edge function), then returns to the calendar page.
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { completeGoogleAuth } from '../services/google-calendar.service';

type Phase = 'working' | 'done' | 'error';

const GoogleOAuthCallbackPage: React.FC = () => {
    const [phase, setPhase] = useState<Phase>('working');
    const [message, setMessage] = useState('Connecting your Google Calendar…');

    useEffect(() => {
        const finish = (to: string) => {
            // Drop the OAuth query and return to the app.
            window.history.replaceState({}, '', to);
            window.location.replace(to);
        };

        const run = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const state = params.get('state');
            const oauthError = params.get('error');

            if (oauthError) {
                setPhase('error');
                setMessage(`Google sign-in was cancelled (${oauthError}).`);
                setTimeout(() => finish('/?route=calendar'), 2500);
                return;
            }
            if (!code || !state) {
                setPhase('error');
                setMessage('Missing authorization code. Please try connecting again.');
                setTimeout(() => finish('/?route=calendar'), 2500);
                return;
            }

            try {
                await completeGoogleAuth(code, state);
                setPhase('done');
                setMessage('Connected! Returning to your calendar…');
                setTimeout(() => finish('/?route=calendar'), 1200);
            } catch (err: unknown) {
                setPhase('error');
                setMessage(
                    err instanceof Error ? err.message : 'Could not connect Google Calendar.',
                );
                setTimeout(() => finish('/?route=calendar'), 3000);
            }
        };

        void run();
    }, []);

    const Icon = phase === 'done' ? CheckCircle2 : phase === 'error' ? AlertTriangle : Loader2;
    const tone =
        phase === 'done'
            ? 'text-emerald-600'
            : phase === 'error'
              ? 'text-rose-600'
              : 'text-indigo-600';

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#f7f8fb] p-6 text-center">
            <Icon size={40} className={`${tone} ${phase === 'working' ? 'animate-spin' : ''}`} />
            <p className="max-w-sm text-sm font-medium text-slate-600">{message}</p>
        </div>
    );
};

export default GoogleOAuthCallbackPage;
