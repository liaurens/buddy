import React from 'react';
import type { AppRoute } from '../constants/routes';

interface MainLayoutProps {
    children: React.ReactNode;
    activeTab: AppRoute;
    setActiveTab: (tab: AppRoute) => void;
    /** Hide the bottom nav (the morning check-in gate replaces the whole app). */
    navHidden?: boolean;
}

type TabKey = 'home' | 'tasks' | 'assistant' | 'browse' | 'me';

const TABS: Array<{ key: TabKey; label: string }> = [
    { key: 'home', label: 'Now' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'assistant', label: 'Capture' },
    { key: 'browse', label: 'Browse' },
    { key: 'me', label: 'Me' },
];

/** Abstract nav glyphs from the Buddy Cove prototype (shapes, not icons). */
const NavGlyph: React.FC<{ tab: TabKey; active: boolean }> = ({ tab, active }) => {
    const fill = active ? 'var(--cove-accent)' : 'transparent';
    const border = active ? 'var(--cove-accent)' : 'var(--cove-border, #c6dbe7)';
    const cell = active ? 'var(--cove-accent)' : '#c6dbe7';

    if (tab === 'browse') {
        return (
            <span className="grid h-[22px] w-[22px] grid-cols-2 gap-[2.5px]" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="rounded-[3px]" style={{ background: cell }} />
                ))}
            </span>
        );
    }
    if (tab === 'assistant') {
        return (
            <span
                className="box-border flex h-[22px] w-[22px] items-center justify-center rounded-full border-[2.5px] text-sm font-extrabold leading-none"
                style={{
                    background: fill,
                    borderColor: border,
                    color: active ? '#fff' : '#c6dbe7',
                }}
                aria-hidden
            >
                +
            </span>
        );
    }
    const radius = tab === 'me' ? 'rounded-full' : 'rounded-lg';
    return (
        <span
            className={`box-border h-[22px] w-[22px] border-[2.5px] ${radius}`}
            style={{ background: fill, borderColor: border }}
            aria-hidden
        />
    );
};

const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    activeTab,
    setActiveTab,
    navHidden = false,
}) => {
    const isActiveTab = (key: AppRoute) =>
        activeTab === key || (key === 'me' && activeTab === 'account');

    return (
        <div className="flex min-h-dvh justify-center bg-cove-backdrop">
            <div className="relative flex min-h-dvh w-full max-w-[520px] flex-col bg-cove-bg text-cove-ink shadow-[0_0_40px_rgba(40,90,130,0.12)]">
                <main
                    className={`flex flex-1 flex-col overflow-y-auto px-[18px] pt-[18px] ${
                        navHidden ? 'pb-[26px]' : 'pb-[110px]'
                    }`}
                >
                    {children}
                </main>

                {navHidden ? null : (
                    <nav
                        className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[520px] -translate-x-1/2 items-center justify-around rounded-t-[26px] bg-white px-2 pt-3 shadow-cove-nav"
                        style={{ paddingBottom: 'calc(26px + env(safe-area-inset-bottom))' }}
                    >
                        {TABS.map(({ key, label }) => {
                            const active = isActiveTab(key);
                            return (
                                <button
                                    key={key}
                                    onClick={() => setActiveTab(key)}
                                    aria-current={active ? 'page' : undefined}
                                    className={`flex min-w-[56px] flex-col items-center gap-[3px] p-1 text-[11.5px] font-extrabold ${
                                        active ? 'text-cove-ink' : 'text-cove-faint'
                                    }`}
                                >
                                    <NavGlyph tab={key} active={active} />
                                    {label}
                                </button>
                            );
                        })}
                    </nav>
                )}
            </div>
        </div>
    );
};

export default MainLayout;
