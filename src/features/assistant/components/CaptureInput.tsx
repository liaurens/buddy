import React, {
    useState,
    useRef,
    useCallback,
    useMemo,
    useEffect,
    useImperativeHandle,
} from 'react';
import { SendHorizontal, Loader2, ArrowRight } from 'lucide-react';
import { useAssistantCommands } from '../hooks/useAssistantCommands';
import { useRoutePreview } from '../hooks/useRoutePreview';
import { CAPTURE_DRAFT_KEY } from '../constants';

export interface CaptureInputHandle {
    /** Replace the input text and focus the textarea (caret at end). */
    fill: (text: string) => void;
}

interface CaptureInputProps {
    onSubmit: (text: string) => Promise<void> | void;
    isLoading?: boolean;
    placeholder?: string;
    ariaLabel?: string;
    consumeVoiceDraft?: boolean;
    enableBrainDump?: boolean;
    hintsPosition?: 'above' | 'below';
    richHints?: boolean;
    variant?: 'compact' | 'comfortable' | 'bare';
    onBeforeSubmit?: (text: string) => void;
    ref?: React.Ref<CaptureInputHandle>;
}

const CaptureInput: React.FC<CaptureInputProps> = ({
    onSubmit,
    isLoading = false,
    placeholder = 'Capture anything — type / for commands…',
    ariaLabel = 'Assistant input',
    consumeVoiceDraft = false,
    enableBrainDump = false,
    hintsPosition = 'below',
    richHints = false,
    variant = 'compact',
    onBeforeSubmit,
    ref,
}) => {
    // Seed from CaptureFAB voice draft on first render. Lazy initializer avoids
    // setState-in-effect. We don't auto-submit — speech recognition errors are
    // common and the user should confirm the transcript first.
    const [input, setInput] = useState<string>(() => {
        if (!consumeVoiceDraft) return '';
        try {
            const draft = sessionStorage.getItem(CAPTURE_DRAFT_KEY);
            if (draft) {
                sessionStorage.removeItem(CAPTURE_DRAFT_KEY);
                return draft;
            }
        } catch {
            // sessionStorage may be unavailable (private mode, etc.)
        }
        return '';
    });
    const [showHints, setShowHints] = useState(false);
    const [showAllHints, setShowAllHints] = useState(false);
    const [selectedHint, setSelectedHint] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { commands, primaryCommands } = useAssistantCommands();
    const routePreview = useRoutePreview(input);

    const filteredCommands = useMemo(() => {
        if (!input.startsWith('/')) return [];
        const query = input.toLowerCase();
        return commands.filter((c) => c.command.startsWith(query) || c.command.includes(query));
    }, [input, commands]);

    const visibleHints = useMemo(() => {
        if (!richHints) return filteredCommands.slice(0, 6);
        if (input.length > 1) return filteredCommands;
        return showAllHints ? commands : primaryCommands;
    }, [filteredCommands, input, showAllHints, richHints, commands, primaryCommands]);

    // Auto-grow textarea up to 200px.
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }, [input]);

    useImperativeHandle(
        ref,
        () => ({
            fill: (text: string) => {
                setInput(text);
                setShowHints(false);
                const ta = textareaRef.current;
                if (!ta) return;
                ta.focus();
                // Caret placement must wait until the new value is rendered.
                requestAnimationFrame(() => ta.setSelectionRange(text.length, text.length));
            },
        }),
        [],
    );

    // If seeded from voice draft, focus the textarea with caret at end.
    useEffect(() => {
        if (!input) return;
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(input.length, input.length);
        // Only run on mount; later changes shouldn't steal focus.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSubmit = useCallback(
        async (e?: React.FormEvent) => {
            e?.preventDefault();
            const trimmed = input.trim();
            if (!trimmed || isLoading) return;

            setShowHints(false);
            onBeforeSubmit?.(trimmed);
            setInput('');

            const chunks = enableBrainDump
                ? trimmed
                      .split(/\n\s*\n/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                : [trimmed];
            const captures = chunks.length > 1 ? chunks : [trimmed];

            for (const chunk of captures) {
                await onSubmit(chunk);
            }
        },
        [input, isLoading, onSubmit, onBeforeSubmit, enableBrainDump],
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInput(value);
        setShowHints(value.startsWith('/') && value.length < 20);
        setSelectedHint(0);
    };

    const handleSelectCommand = (command: string) => {
        setInput(command + ' ');
        setShowHints(false);
        textareaRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showHints && visibleHints.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedHint((prev) => Math.min(prev + 1, visibleHints.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedHint((prev) => Math.max(prev - 1, 0));
                return;
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                handleSelectCommand(visibleHints[selectedHint].command);
                return;
            }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (
                showHints &&
                visibleHints.length > 0 &&
                input === visibleHints[selectedHint]?.command
            ) {
                handleSelectCommand(visibleHints[selectedHint].command);
            } else {
                handleSubmit();
            }
        }
        if (e.key === 'Escape') {
            setShowHints(false);
        }
    };

    const isCompact = variant === 'compact';
    const isBare = variant === 'bare';
    // `bare` sits inside a surface that already draws the border (the capture page),
    // so it stays transparent; the other two draw their own Cove field.
    const textareaClasses = isBare
        ? 'flex-1 min-w-0 resize-none bg-transparent px-1 py-3 text-base font-bold leading-snug text-cove-ink placeholder:font-semibold placeholder:text-cove-faint focus:outline-none disabled:opacity-50'
        : isCompact
          ? 'app-textarea flex-1 min-w-0 py-2.5 text-sm shadow-cove'
          : 'app-textarea flex-1 min-w-0 bg-[color:var(--buddy-surface-soft)] py-3 text-sm';
    const sendBase =
        'flex flex-shrink-0 items-center justify-center bg-cove-ink text-white transition-colors hover:opacity-90 disabled:bg-cove-track disabled:text-cove-faint';
    const buttonClasses = isBare
        ? `${sendBase} h-11 w-11 rounded-xl shadow-[0_10px_24px_rgba(29,58,77,0.22)] active:scale-95`
        : isCompact
          ? `${sendBase} h-10 w-10 rounded-xl shadow-cove`
          : `${sendBase} h-11 w-11 rounded-xl shadow-cove active:scale-95`;

    const showPreviewChip = !!routePreview && !showHints && !isLoading;

    return (
        <form onSubmit={handleSubmit} className="relative w-full">
            {showPreviewChip && routePreview && (
                <div className="absolute -top-7 right-0 flex items-center gap-1 rounded-full border-0 bg-white px-2.5 py-1 text-[11px] font-extrabold text-cove-muted shadow-cove">
                    <ArrowRight size={10} className="text-cove-accent" />
                    <span className="text-cove-ink">{routePreview.label}</span>
                </div>
            )}
            <div className="flex gap-2 items-end">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => input.startsWith('/') && setShowHints(true)}
                    onBlur={() => setTimeout(() => setShowHints(false), 150)}
                    placeholder={placeholder}
                    disabled={isLoading}
                    aria-label={ariaLabel}
                    autoComplete="off"
                    rows={1}
                    className={textareaClasses}
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    aria-label="Send"
                    className={buttonClasses}
                >
                    {isLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <SendHorizontal size={18} />
                    )}
                </button>
            </div>

            {showHints && visibleHints.length > 0 && (
                <div
                    className={`absolute left-0 right-12 ${
                        hintsPosition === 'above' ? 'bottom-full mb-2' : 'top-full mt-1'
                    } z-50 overflow-hidden rounded-card border-0 bg-white shadow-[0_10px_30px_rgba(40,90,130,0.18)]`}
                >
                    {visibleHints.map((cmd, i) => (
                        <button
                            key={cmd.command}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectCommand(cmd.command);
                            }}
                            className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                                i === selectedHint
                                    ? 'bg-cove-tint-blue'
                                    : 'hover:bg-[color:var(--buddy-surface-soft)]'
                            }`}
                        >
                            <span className="w-20 flex-shrink-0 font-mono text-[13px] font-extrabold text-cove-accent">
                                {cmd.command}
                            </span>
                            <span className="truncate font-semibold text-cove-muted">
                                {cmd.description}
                            </span>
                        </button>
                    ))}
                    {richHints &&
                        !showAllHints &&
                        input.length <= 1 &&
                        visibleHints.length < commands.length && (
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setShowAllHints(true);
                                }}
                                className="w-full border-t border-cove-border px-3 py-2 text-left text-xs font-extrabold text-cove-accent hover:bg-[color:var(--buddy-surface-soft)]"
                            >
                                Show all commands…
                            </button>
                        )}
                </div>
            )}
        </form>
    );
};

export default CaptureInput;
