import { useState } from 'react';
import { TrackerProvider } from './context/TrackerContext';
import { TaskProvider } from './context/TaskContext';
import { ProtocolProvider } from './context/ProtocolContext';
import { ExperimentProvider } from './context/ExperimentContext';
import MainLayout from './layouts/MainLayout';
import Settings from './pages/Settings';
import TrackerPage from './pages/TrackerPage';
import ProtocolsPage from './pages/ProtocolsPage';
import DailyReportPage from './pages/DailyReportPage';
import ExperimentsPage from './pages/ExperimentsPage';
import HomePage from './pages/HomePage';
import ToolboxPage from './pages/ToolboxPage';
import TodoPage from './pages/TodoPage';
import CalendarPage from './pages/CalendarPage';
import LoginScreen from './components/LoginScreen';
import { useAuth } from './hooks/useAuth';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'tracker' | 'protocols' | 'toolbox' | 'todos' | 'calendar' | 'settings' | 'journal' | 'experiments'>('home');
  const [navParams, setNavParams] = useState<any>(null);

  // Check if user is logged in
  const { isLoggedIn, isLoading } = useAuth();

  const handleNavigate = (tab: typeof activeTab, params?: any) => {
    setActiveTab(tab);
    setNavParams(params);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} />;
      case 'tracker':
        return <TrackerPage initialParams={navParams} />;
      case 'protocols':
        return <ProtocolsPage />;
      case 'toolbox':
        return <ToolboxPage />;
      case 'todos':
        return <TodoPage />;
      case 'calendar':
        return <CalendarPage />;
      case 'settings':
        return <Settings />;
      case 'experiments':
        return <ExperimentsPage onNavigate={handleNavigate} />;
      case 'journal':
        return <DailyReportPage />;
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
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
            <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
              {renderContent()}
            </MainLayout>
          </TaskProvider>
        </ExperimentProvider>
      </ProtocolProvider>
    </TrackerProvider>
  );
}

export default App;
