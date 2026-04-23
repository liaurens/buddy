import React, { useRef, useState } from 'react';
import { Plus, Mic } from 'lucide-react';
import type { AppRoute } from '../constants/routes';

interface SpeechRecognitionLike {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: (event: { results: Array<Array<{ transcript: string }>> }) => void;
    onerror: () => void;
    onend: () => void;
    start(): void;
}

interface CaptureFABProps {
    activeTab: AppRoute;
    onNavigate: (tab: AppRoute) => void;
}

const HIDDEN_ON: AppRoute[] = ['home', 'assistant'];

/**
 * Persistent capture entry-point on every tab except Now (where the prompt bar is already visible)
 * and the Capture tab itself.
 *
 * Tap → switch to Capture tab.
 * Long-press → browser SpeechRecognition for voice capture (Chrome/Safari only; iOS PWA flaky).
 */
const CaptureFAB: React.FC<CaptureFABProps> = ({ activeTab, onNavigate }) => {
    const [recording, setRecording] = useState(false);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggeredLongPress = useRef(false);

    if (HIDDEN_ON.includes(activeTab)) return null;

    const startVoice = () => {
        triggeredLongPress.current = true;
        const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
        const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (!SR) {
            alert('Voice capture is not supported in this browser.');
            return;
        }
        const rec = new SR();
        rec.lang = navigator.language || 'en-US';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        setRecording(true);
        rec.onresult = (event) => {
            const text = event.results[0]?.[0]?.transcript;
            if (text) {
                onNavigate('assistant');
                sessionStorage.setItem('captureFAB.voiceDraft', text);
            }
            setRecording(false);
        };
        rec.onerror = () => setRecording(false);
        rec.onend = () => setRecording(false);
        rec.start();
    };

    const handlePointerDown = () => {
        triggeredLongPress.current = false;
        longPressTimer.current = setTimeout(startVoice, 500);
    };

    const handlePointerUp = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        if (!triggeredLongPress.current) {
            onNavigate('assistant');
        }
    };

    const handlePointerCancel = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    return (
        <button
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerCancel}
            aria-label="Quick capture (long-press for voice)"
            className={`fixed right-5 bottom-28 z-30 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all active:scale-95 ${
                recording ? 'bg-rose-600 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
        >
            {recording ? <Mic size={24} /> : <Plus size={24} />}
        </button>
    );
};

export default CaptureFAB;
