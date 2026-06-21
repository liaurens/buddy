import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalMenuProps {
    /** Ref to the trigger element the menu is anchored to. */
    anchorRef: React.RefObject<HTMLElement | null>;
    open: boolean;
    onClose: () => void;
    /** Menu width in px. Default 192 (matches the old w-48). */
    width?: number;
    /** Preferred horizontal alignment to the anchor. Default 'right'. */
    align?: 'left' | 'right';
    children: React.ReactNode;
}

/**
 * A dropdown menu rendered through a portal to <body>, anchored to a trigger.
 *
 * Why a portal: task cards live inside `overflow-hidden` section wrappers, which
 * clip absolutely-positioned dropdowns. Portaling to the body escapes the clip,
 * and fixed positioning lets the menu flip on-screen near viewport edges and
 * scroll (max-h) when its list is long.
 */
const PortalMenu: React.FC<PortalMenuProps> = ({
    anchorRef,
    open,
    onClose,
    width = 192,
    align = 'right',
    children,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({
        position: 'fixed',
        top: 0,
        left: 0,
        width,
        visibility: 'hidden',
    });

    useLayoutEffect(() => {
        const anchorEl = anchorRef.current;
        if (!open || !anchorEl) return;
        const reposition = () => {
            const a = anchorEl.getBoundingClientRect();
            const menuH = menuRef.current?.offsetHeight ?? 0;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const gap = 4;
            const margin = 8;

            // Horizontal: prefer aligning to the chosen anchor edge, then clamp
            // so the menu never spills off either side.
            let left = align === 'right' ? a.right - width : a.left;
            if (left + width > vw - margin) left = vw - margin - width;
            if (left < margin) left = margin;

            // Vertical: open below when it fits (or there's more room below),
            // otherwise flip above the anchor.
            const spaceBelow = vh - a.bottom;
            const spaceAbove = a.top;
            const top =
                spaceBelow >= menuH + gap + margin || spaceBelow >= spaceAbove
                    ? a.bottom + gap
                    : Math.max(margin, a.top - menuH - gap);

            setStyle({ position: 'fixed', top, left, width, visibility: 'visible' });
        };
        reposition();
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        return () => {
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        };
    }, [open, anchorRef, width, align]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (menuRef.current?.contains(target)) return;
            if (anchorRef.current?.contains(target)) return;
            onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, onClose, anchorRef]);

    if (!open) return null;

    return createPortal(
        <div
            ref={menuRef}
            style={style}
            className="z-[60] max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white text-sm shadow-lg"
            onClick={e => e.stopPropagation()}
        >
            {children}
        </div>,
        document.body,
    );
};

export default PortalMenu;
