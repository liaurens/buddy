import { useState, useEffect } from 'react';
import { ToastProvider } from './components/ui/Toast';
import MainLayout from './layouts/MainLayout';
// Feature imports
import { HomePage } from './features/core';
import AccountPage from './features/core/pages/AccountPage';
import { TrackerPage, ProtocolsPage, ExperimentsPage } from './features/health-tracking';
import { PlanPage, CalendarPage, ReflectionPage, PlannerPage } from './features/planning';
import { TodoPage, NotesPage } from './features/tasks';
import { ChecklistsPage } from './features/checklists';
import { ToolboxPage } from './features/toolbox';
import PomodoroTimer from './features/focus/components/PomodoroTimer';
import AssistantChat from './features/assistant/components/AssistantChat';
import { GrowthPage } from './features/growth/pages/GrowthPage';
import LoginScreen from './features/core/components/LoginScreen';
import MePage from './features/me/pages/MePage';
import BrowsePage from './features/browse/pages/BrowsePage';
import DayPage from './features/day/pages/DayPage';
import GoalsPage from './features/core/pages/GoalsPage';
import { NotificationsPage } from './features/notifications';
import InAppReminderBanner from './components/notifications/InAppReminderBanner';
import { syncCalendarIfStale } from './features/planning/services/calendar-sync.service';
import { useAuth } from './hooks/useAuth';
import { isSupabaseConfigured } from './services/supabase';
import { DevPortal } from './components/dev/DevPortal';
import type { AppRoute } from './constants/routes';
import { LOADING_TIMEOUT_MS } from './constants/config';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppRoute>('home');
  const [navParams, setNavParams] = useState<Record<string, unknown> | null>(null);
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
    syncCalendarIfStale(user.id).catch(err => console.warn('Calendar auto-sync skipped:', err));
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
        return <TodoPage />;
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
      case 'planning':
        return <PlanPage />;
      case 'planner':
        return <PlannerPage />;
      case 'checklists':
        return <ChecklistsPage />;
      case 'assistant':
        return (
          <div className="max-w-2xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
            <AssistantChat onNavigate={handleNavigate} />
          </div>
        );
      case 'growth':
        return <GrowthPage />;
      case 'browse':
        return <BrowsePage onNavigate={handleNavigate} />;
      case 'me':
        return <MePage />;
      case 'today':
        return <DayPage onNavigate={handleNavigate} />;
      case 'goals':
        return <GoalsPage />;
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
            Supabase environment variables are not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
          </p>
        </div>
      </div>
    );
  }

  // Show loading state with timeout
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <div className="text-white text-lg">Loading...</div>
        {loadingTimeout && (
          <div className="text-slate-400 text-sm text-center max-w-xs">
            Taking longer than expected. Check browser console for errors.
            <button
              onClick={() => window.location.reload()}
              className="block mx-auto mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
            >
              Reload Page
            </button>
          </div>
        )}
      </div>
    );
  }

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <ToastProvider>
      <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </MainLayout>
      <InAppReminderBanner onNavigate={handleNavigate} />
      <DevPortal />
    </ToastProvider>
  );
}

export default App;
