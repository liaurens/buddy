import { useState, useEffect } from 'react';
import { TrackerProvider } from './context/TrackerContext';
import { TaskProvider } from './context/TaskContext';
import { ProtocolProvider } from './context/ProtocolContext';
import { ExperimentProvider } from './context/ExperimentContext';
import { SmartNotesProvider } from './context/SmartNotesContext';
import MainLayout from './layouts/MainLayout';
// Feature imports
import { HomePage, SettingsPage } from './features/core';
import { TrackerPage, ProtocolsPage, ExperimentsPage, CheckInPage } from './features/health-tracking';
import { PlanPage, CalendarPage, ReflectionPage } from './features/planning';
import { TodoPage, NotesPage } from './features/tasks';
import { ToolboxPage } from './features/toolbox';
import PomodoroTimer from './features/focus/PomodoroTimer';
import LoginScreen from './components/LoginScreen';
import { useAuth } from './hooks/useAuth';
import { isSupabaseConfigured } from './services/supabase';

type AppRoute = 'home' | 'health' | 'protocols' | 'experiments' | 'check-in' | 'planning' | 'calendar' | 'reflection' | 'tasks' | 'notes' | 'toolbox' | 'focus' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppRoute>('home');
  const [navParams, setNavParams] = useState<any>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

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
      case 'settings':
        return <SettingsPage />;
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
    <TrackerProvider>
      <ProtocolProvider>
        <ExperimentProvider>
          <TaskProvider>
            <SmartNotesProvider>
              <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
                {renderContent()}
              </MainLayout>
            </SmartNotesProvider>
          </TaskProvider>
        </ExperimentProvider>
      </ProtocolProvider>
    </TrackerProvider>
  );
}

export default App;
