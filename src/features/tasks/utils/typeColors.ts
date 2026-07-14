/**
 * Resolve a TaskType.color name to literal Tailwind classes.
 *
 * Tailwind JIT can't generate classes from concatenated strings, so we hand-roll
 * the full class map for the colors we actually use.
 */

export interface TypeColorClasses {
    border: string; // left border accent
    bg: string; // soft background tint
    text: string; // text color
    dot: string; // solid color dot
    chipBg: string; // background for filter chip when active
    chipText: string; // text for active chip
}

const FALLBACK: TypeColorClasses = {
    border: 'border-slate-300',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    dot: 'bg-slate-400',
    chipBg: 'bg-slate-100',
    chipText: 'text-slate-700',
};

const MAP: Record<string, TypeColorClasses> = {
    indigo: {
        border: 'border-indigo-300',
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        dot: 'bg-indigo-500',
        chipBg: 'bg-indigo-100',
        chipText: 'text-indigo-800',
    },
    rose: {
        border: 'border-rose-300',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        dot: 'bg-rose-500',
        chipBg: 'bg-rose-100',
        chipText: 'text-rose-800',
    },
    emerald: {
        border: 'border-emerald-300',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
        chipBg: 'bg-emerald-100',
        chipText: 'text-emerald-800',
    },
    amber: {
        border: 'border-amber-300',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        dot: 'bg-amber-500',
        chipBg: 'bg-amber-100',
        chipText: 'text-amber-800',
    },
    violet: {
        border: 'border-violet-300',
        bg: 'bg-violet-50',
        text: 'text-violet-700',
        dot: 'bg-violet-500',
        chipBg: 'bg-violet-100',
        chipText: 'text-violet-800',
    },
    sky: {
        border: 'border-sky-300',
        bg: 'bg-sky-50',
        text: 'text-sky-700',
        dot: 'bg-sky-500',
        chipBg: 'bg-sky-100',
        chipText: 'text-sky-800',
    },
    slate: {
        border: 'border-slate-300',
        bg: 'bg-slate-50',
        text: 'text-slate-700',
        dot: 'bg-slate-500',
        chipBg: 'bg-slate-200',
        chipText: 'text-slate-800',
    },
    teal: {
        border: 'border-teal-300',
        bg: 'bg-teal-50',
        text: 'text-teal-700',
        dot: 'bg-teal-500',
        chipBg: 'bg-teal-100',
        chipText: 'text-teal-800',
    },
    pink: {
        border: 'border-pink-300',
        bg: 'bg-pink-50',
        text: 'text-pink-700',
        dot: 'bg-pink-500',
        chipBg: 'bg-pink-100',
        chipText: 'text-pink-800',
    },
};

export const AVAILABLE_TYPE_COLORS = Object.keys(MAP);

export function getTypeColors(color?: string | null): TypeColorClasses {
    if (!color) return FALLBACK;
    return MAP[color] || FALLBACK;
}
