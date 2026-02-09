import { useState, useEffect } from 'react';
import { ToastProvider } from './components/ui/Toast';
import MainLayout from './layouts/MainLayout';
// Feature imports
import { HomePage } from './features/core';
import AccountPage from './features/core/pages/AccountPage';
import { TrackerPage, ProtocolsPage, ExperimentsPage, CheckInPage } from './features/health-tracking';
import { PlanPage, CalendarPage, ReflectionPage } from './features/planning';
import { TodoPage, NotesPage } from './features/tasks';
import { ChecklistsPage } from './features/checklists';
import { ToolboxPage } from './features/toolbox';
import PomodoroTimer from './features/focus/components/PomodoroTimer';
import LoginScreen from './features/core/components/LoginScreen';
import { useAuth } from './hooks/useAuth';
import { isSupabaseConfigured } from './services/supabase';

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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppRoute>('home');
  const [navParams, setNavParams] = useState<any>(null);
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
    }, 5000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const handleNavigate = (tab: typeof activeTab, params?: any) => {
    setActiveTab(tab);
    setNavParams(params);
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
      case 'checklists':
        return <ChecklistsPage />;
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

      {/* Context-Aware Settings Modals */}
      {showSettings && activeTab === 'health' && <TrackerSettingsModal isOpen={true} onClose={() => setShowSettings(false)} />}
      {showSettings && activeTab === 'protocols' && <ProtocolSettingsModal isOpen={true} onClose={() => setShowSettings(false)} />}
      {showSettings && activeTab === 'experiments' && <ExperimentSettingsModal isOpen={true} onClose={() => setShowSettings(false)} />}
      {showSettings && activeTab === 'check-in' && <CheckInSettingsModal isOpen={true} onClose={() => setShowSettings(false)} />}
      {showSettings && activeTab === 'notes' && <NoteSettingsModal isOpen={true} onClose={() => setShowSettings(false)} />}
      {showSettings && activeTab === 'calendar' && <CalendarSettingsModal isOpen={true} onClose={() => setShowSettings(false)} />}
      {showSettings && activeTab === 'planning' && <PlanningSettingsModal isOpen={true} onClose={() => setShowSettings(false)} />}
      {showSettings && activeTab === 'reflection' && <ReflectionSettingsModal isOpen={true} onClose={() => setShowSettings(false)} />}
      {showSettings && activeTab === 'tasks' && <TaskSettingsModal isOpen={true} onClose={() => setShowSettings(false)} />}
      {showSettings && activeTab === 'focus' && <PomodoroSettingsModal isOpen={true} onClose={() => setShowSettings(false)} />}
      {showSettings && activeTab === 'toolbox' && <ToolboxSettingsModal isOpen={true} onClose={() => setShowSettings(false)} />}
      {showSettings && activeTab === 'checklists' && <ChecklistSettingsModal isOpen={true} onClose={() => setShowSettings(false)} />}

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
    </ToastProvider>
  );
}

export default App;
