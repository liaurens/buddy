/**
 * Shared class strings for the task detail sheet and its extracted sections.
 *
 * Constants rather than components so the section files can import them
 * without a mixed component/non-component module (which costs HMR).
 */

export const labelClass =
    'pb-1.5 pt-3.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-cove-faint';

export const inputClass =
    'w-full rounded-xl border border-cove-border bg-white px-3 py-2.5 text-[14.5px] font-bold text-cove-ink outline-none placeholder:text-cove-faint focus:border-cove-accent';

export const chipClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-[12.5px] font-extrabold transition-colors ${
        active ? 'bg-cove-ink text-white' : 'bg-cove-tint-blue text-cove-muted'
    }`;
