import { useState, useEffect } from 'react';
import { ToastProvider } from './components/ui/Toast';
import MainLayout from './layouts/MainLayout';
// Feature imports
import { HomePage } from './features/core';
import AccountPage from './features/core/pages/AccountPage';
import { TrackerPage, ProtocolsPage, ExperimentsPage, CheckInPage } from './features/health-tracking';
import { PlanPage, CalendarPage, ReflectionPage, PlannerPage } from './features/planning';
import { TodoPage, NotesPage } from './features/tasks';
import { ChecklistsPage } from './features/checklists';
import { ToolboxPage } from './features/toolbox';
import PomodoroTimer from './features/focus/components/PomodoroTimer';
import AssistantChat from './features/assistant/components/AssistantChat';
import { GrowthPage } from './features/growth/pages/GrowthPage';
import LoginScreen from './features/core/components/LoginScreen';
import { useAuth } from './hooks/useAuth';
import { isSupabaseConfigured } from './services/supabase';
import { DevPortal } from './components/dev/DevPortal';

// Settings Modals
import TrackerSettingsModal from './features/health-tracking/components/tracker/TrackerSettingsModal';
import ProtocolSettingsModal from './features/health-tracking/components/protocols/ProtocolSettingsModal';
import ExperimentSettingsModal from './features/health-tracking/components/experiments/ExperimentSettingsModal';
import CheckInSettingsModal from './features/health-tracking/components/checkin/CheckInSettingsModal';
import NoteSettingsModal from './features/tasks/components/notes/NoteSettingsModal';
import CalendarSettingsModal from './features/planning/components/calendar/CalendarSettingsModal';
import PlanningSettingsModal from './features/planning/components/plan/PlanningSettingsModal';
import ReflectionSettingsModal from './features/planning/components/reflection/ReflectionSettingsModal';
import TaskSettingsModal from './features/tasks/components/TaskSettingsModal';
import PomodoroSettingsModal from './features/focus/components/PomodoroSettingsModal';
import ToolboxSettingsModal from './features/toolbox/components/ToolboxSettingsModal';
import ChecklistSettingsModal from './features/checklists/components/ChecklistSettingsModal';
import type { AppRoute } from './constants/routes';
import { LOADING_TIMEOUT_MS } from './constants/config';

type SettingsModalProps = { isOpen: boolean; onClose: () => void };

const SETTINGS_MODALS: Partial<Record<AppRoute, React.ComponentType<SettingsModalProps>>> = {
  health: TrackerSettingsModal,
  protocols: ProtocolSettingsModal,
  experiments: ExperimentSettingsModal,
  'check-in': CheckInSettingsModal,
  notes: NoteSettingsModal,
  calendar: CalendarSettingsModal,
  planning: PlanningSettingsModal,
  reflection: ReflectionSettingsModal,
  tasks: TaskSettingsModal,
  focus: PomodoroSettingsModal,
  toolbox: ToolboxSettingsModal,
  checklists: ChecklistSettingsModal,
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppRoute>('home');
  const [navParams, setNavParams] = useState<Record<string, unknown> | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleSettingsClick = () => {
    setShowSettings(true);
  };

  // Check if user is logged in
  const { isLoggedIn, isLoading } = useAuth();

  // Timeout for loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        setLoadingTimeout(true);
      }
    }, LOADING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

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
      case 'check-in':
        return <CheckInPage />;
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
      <MainLayout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSettingsClick={handleSettingsClick}
      >
        {renderContent()}
      </MainLayout>

      {/* Context-Aware Settings Modal */}
      {showSettings && SETTINGS_MODALS[activeTab] && (() => {
        const SettingsModal = SETTINGS_MODALS[activeTab]!;
        return <SettingsModal isOpen={true} onClose={() => setShowSettings(false)} />;
      })()}

      {/* Account Page Modal for Home */}
      {showSettings && (activeTab === 'home' || activeTab === 'account') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="relative w-full max-w-2xl mx-4 bg-white rounded-lg shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <AccountPage />
            <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <DevPortal />
    </ToastProvider>
  );
}

export default App;
