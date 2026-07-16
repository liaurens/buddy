import React from 'react';

interface SpeechBubbleProps {
    title: string;
    line?: string;
    className?: string;
}

/** White speech bubble next to the whale (Now hero). */
const SpeechBubble: React.FC<SpeechBubbleProps> = ({ title, line, className }) => (
    <div
        className={`flex-1 rounded-[18px_18px_18px_4px] bg-white px-3.5 py-3 shadow-[0_3px_12px_rgba(40,90,130,0.1)] ${className ?? ''}`}
    >
        <div className="text-[15px] font-extrabold leading-[1.3] text-cove-ink">{title}</div>
        {line ? (
            <div className="text-[13px] font-semibold leading-[1.4] text-cove-muted">{line}</div>
        ) : null}
    </div>
);

export default SpeechBubble;
