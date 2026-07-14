import { lazy, Suspense, useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { ToastProvider } from './components/ui/Toast';
import MainLayout from './layouts/MainLayout';
// Feature imports
import HomePage from './features/core/pages/HomePage';
import UrgentInboxCard from './features/core/components/UrgentInboxCard';
import NextUpCard from './features/core/components/NextUpCard';
import LoginScreen from './features/core/components/LoginScreen';
import { ensureAnchorSchedule } from './features/notifications/services/notifications-schedule.service';
import InAppReminderBanner from './components/notifications/InAppReminderBanner';
import { syncCalendarIfStale } from './features/planning/services/calendar-sync.service';
import { flushGoogleCalendarOutbox } from './features/planning/services/google-calendar.service';
import { flushPendingCaptures } from './features/assistant/services/assistant.service';
import { CAPTURE_DRAFT_KEY } from './features/assistant/constants';
import { logAppEvent } from './services/app-events';
import { useAuth } from './hooks/useAuth';
import { isSupabaseConfigured } from './services/supabase';
import type { AppRoute } from './constants/routes';
import { LOADING_TIMEOUT_MS } from './constants/config';

const AccountPage = lazy(() => import('./features/core/pages/AccountPage'));
const TrackerPage = lazy(() => import('./features/health-tracking/pages/TrackerPage'));
const ProtocolsPage = lazy(() => import('./features/health-tracking/pages/ProtocolsPage'));
const ExperimentsPage = lazy(() => import('./features/health-tracking/pages/ExperimentsPage'));
const CalendarPage = lazy(() => import('./features/planning/pages/CalendarPage'));
const ReflectionPage = lazy(() => import('./features/planning/pages/ReflectionPage'));
const TodoPage = lazy(() => import('./features/tasks/pages/TodoPage'));
const NotesPage = lazy(() => import('./features/tasks/pages/NotesPage'));
const ChecklistsPage = lazy(() =>
    import('./features/checklists/pages/ChecklistsPage').then((module) => ({
        default: module.ChecklistsPage,
    })),
);
const ToolboxPage = lazy(() => import('./features/toolbox/pages/ToolboxPage'));
const PomodoroTimer = lazy(() => import('./features/focus/components/PomodoroTimer'));
const AssistantChat = lazy(() => import('./features/assistant/components/AssistantChat'));
const SchoolPage = lazy(() => import('./features/school/pages/SchoolPage'));
const MePage = lazy(() => import('./features/me/pages/MePage'));
const BrowsePage = lazy(() => import('./features/browse/pages/BrowsePage'));
const DayPage = lazy(() => import('./features/day/pages/DayPage'));
const NotificationsPage = lazy(() => import('./features/notifications/pages/NotificationsPage'));
const GoogleOAuthCallbackPage = lazy(
    () => import('./features/planning/pages/GoogleOAuthCallbackPage'),
);
const DevPortal = lazy(() =>
    import('./components/dev/DevPortal').then((module) => ({ default: module.DevPortal })),
);

const PageFallback = () => (
    <div className="flex min-h-48 items-center justify-center text-sm text-slate-400">Loading…</div>
);

function initialNavigation(): { route: AppRoute; params: Record<string, unknown> | null } {
    const search = new URLSearchParams(window.location.search);
    const route = (search.get('route') as AppRoute | null) ?? 'home';
    const intent = search.get('intent');
    const taskId = search.get('taskId');
    const step = search.get('step');
    if (intent && taskId) return { route, params: { intent, taskId } };
    if (step) return { route, params: { step } };
    return { route, params: null };
}

const App: React.FC = () => {
    const [initialNav] = useState(initialNavigation);
    const [activeTab, setActiveTab] = useState<AppRoute>(initialNav.route);
    const [navParams, setNavParams] = useState<Record<string, unknown> | null>(initialNav.params);
    const [loadingTimeout, setLoadingTimeout] = useState(false);

    // Check if user is logged in
    const { isLoggedIn, isLoading, user } = useAuth();

    // Timeout for loading state
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isLoading) {
                setLoadingTimeout(true);
            }
        }, LOADING_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [isLoading]);

    // Auto-sync calendar on login (fires only if URL configured and last sync > 60 min ago)
    useEffect(() => {
        if (!user?.id) return;
        syncCalendarIfStale(user.id).catch((err) =>
            console.warn('Calendar auto-sync skipped:', err),
        );
    }, [user?.id]);

    // Handle deep-links from notifications (?route=tasks&intent=complete&taskId=…)
    // and incoming Web Share Target shares (?title=…&text=…&url=…).
    useEffect(() => {
        if (!isLoggedIn) return;
        const params = new URLSearchParams(window.location.search);
        const route = params.get('route') as AppRoute | null;
        const sharedText = [params.get('title'), params.get('text'), params.get('url')]
            .filter(Boolean)
            .join('\n')
            .trim();

        if (route) {
            // Route and intent were used as the initial state above.
        } else if (sharedText) {
            // Seed the capture input with the shared content; the user confirms before submit.
            try {
                sessionStorage.setItem(CAPTURE_DRAFT_KEY, sharedText);
            } catch {
                // sessionStorage unavailable (private mode) — share is lost, but don't crash.
            }
        }

        void logAppEvent('app_open', {
            source: route ? 'notification' : sharedText ? 'share' : 'direct',
            ...(route ? { route } : {}),
        });

        if (route || sharedText) {
            // Clear the query so a refresh doesn't re-fire the intent.
            const url = new URL(window.location.href);
            url.search = '';
            window.history.replaceState({}, '', url.toString());
        }
    }, [isLoggedIn]);

    // Log route visits so surface engagement is measurable.
    useEffect(() => {
        if (!isLoggedIn) return;
        void logAppEvent('route_visit', { route: activeTab });
    }, [isLoggedIn, activeTab]);

    // Offline capture outbox: replay queued captures on login and whenever
    // connectivity returns.
    useEffect(() => {
        if (!isLoggedIn) return;
        void flushPendingCaptures();
        void flushGoogleCalendarOutbox();
        const onOnline = () => {
            void flushPendingCaptures();
            void flushGoogleCalendarOutbox();
        };
        window.addEventListener('online', onOnline);
        return () => window.removeEventListener('online', onOnline);
    }, [isLoggedIn]);

    // Keep the daily anchor notifications alive (self-heals at most every 12h).
    useEffect(() => {
        if (!user?.id) return;
        void ensureAnchorSchedule(user.id);
    }, [user?.id]);

    const handleNavigate = (tab: typeof activeTab, params?: Record<string, unknown>) => {
        setActiveTab(tab);
        setNavParams(params ?? null);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'home':
                return <HomePage onNavigate={handleNavigate} />;
            case 'health':
                return <TrackerPage initialParams={navParams} />;
            case 'protocols':
                return <ProtocolsPage />;
            case 'toolbox':
                return <ToolboxPage />;
            case 'tasks':
                return (
                    <TodoPage
                        initialParams={navParams}
                        onNavigate={handleNavigate}
                        topSlot={
                            <>
                                <UrgentInboxCard onNavigate={handleNavigate} />
                                <NextUpCard onNavigate={handleNavigate} />
                            </>
                        }
                    />
                );
            case 'calendar':
                return <CalendarPage />;
            case 'account':
                return <AccountPage />;
            case 'experiments':
                return <ExperimentsPage onNavigate={handleNavigate} />;
            case 'notes':
                return <NotesPage />;
            case 'focus':
                return <PomodoroTimer />;
            case 'reflection':
                return <ReflectionPage />;
            case 'checklists':
                return <ChecklistsPage />;
            case 'assistant':
                return (
                    <div className="mx-auto flex h-[calc(100dvh-7rem)] w-full max-w-6xl flex-col lg:h-[calc(100dvh-4rem)]">
                        <AssistantChat onNavigate={handleNavigate} />
                    </div>
                );
            // Growth Hub was folded into the reflection flow (goals check-in,
            // skills log, journal). Old growth/goals deep links land there.
            case 'growth':
                return <ReflectionPage />;
            case 'school':
                return <SchoolPage />;
            case 'browse':
                return <BrowsePage onNavigate={handleNavigate} />;
            case 'me':
                return <MePage />;
            case 'today':
                return <DayPage onNavigate={handleNavigate} initialParams={navParams} />;
            case 'goals':
                return <ReflectionPage />;
            case 'notifications':
                return <NotificationsPage />;
            default:
                return <HomePage onNavigate={handleNavigate} />;
        }
    };

    // Show error if Supabase not configured
    if (!isSupabaseConfigured) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-red-900/50 border border-red-500 rounded-xl p-6 max-w-md text-center">
                    <h1 className="text-red-400 text-xl font-bold mb-2">Configuration Error</h1>
                    <p className="text-red-200">
                        Supabase environment variables are not configured. Please set
                        VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
                    </p>
                </div>
            </div>
        );
    }

    // Show loading state with timeout
    if (isLoading) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#f7f8fb]">
                <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-indigo-700 text-white shadow-[0_14px_34px_rgba(37,50,155,0.24)]">
                    <MessageSquare size={26} />
                </div>
                <div className="text-sm font-medium text-slate-500">Loading Buddy…</div>
                {loadingTimeout && (
                    <div className="max-w-xs text-center text-sm text-slate-500">
                        Taking longer than expected. Check browser console for errors.
                        <button
                            onClick={() => window.location.reload()}
                            className="mx-auto mt-3 block rounded-lg bg-indigo-700 px-4 py-2 text-sm text-white hover:bg-indigo-800"
                        >
                            Reload Page
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Google OAuth callback — handle before login gating so the code exchange can run
    // using the persisted Supabase session.
    if (window.location.pathname === '/oauth/google/callback') {
        return (
            <Suspense fallback={<PageFallback />}>
                <GoogleOAuthCallbackPage />
            </Suspense>
        );
    }

    // Show login screen if not logged in
    if (!isLoggedIn) {
        return <LoginScreen />;
    }

    return (
        <ToastProvider>
            <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
                <Suspense fallback={<PageFallback />}>{renderContent()}</Suspense>
            </MainLayout>
            <InAppReminderBanner onNavigate={handleNavigate} />
            {import.meta.env.DEV && (
                <Suspense fallback={null}>
                    <DevPortal />
                </Suspense>
            )}
        </ToastProvider>
    );
};

export default App;
