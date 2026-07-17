import React, { useState } from 'react';

interface FoldProps {
    /** Label when folded, e.g. `School deadlines (2)` — the ⌄/⌃ marks are appended. */
    label: string;
    /** Label when open; defaults to `Hide <label>`-style using openLabel or the label itself. */
    openLabel?: string;
    defaultOpen?: boolean;
    align?: 'left' | 'center';
    children: React.ReactNode;
    className?: string;
}

/**
 * Folded-section disclosure from the Cove design: a quiet text button that
 * unfolds content with a fadeslide. Everything non-essential lives in a Fold.
 */
const Fold: React.FC<FoldProps> = ({
    label,
    openLabel,
    defaultOpen = false,
    align = 'left',
    children,
    className,
}) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className={className}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className={`bg-transparent p-1.5 text-[13px] font-extrabold text-cove-faint transition-colors hover:text-cove-muted ${
                    align === 'center' ? 'w-full text-center' : 'text-left'
                }`}
            >
                {open ? `${openLabel ?? label} ⌃` : `${label} ⌄`}
            </button>
            {open ? <div className="cove-fadeslide">{children}</div> : null}
        </div>
    );
};

export default Fold;
