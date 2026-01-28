import React from 'react';
import { useTracker } from '../../../context/TrackerContext';
import { useAuth } from '../../../hooks/useAuth';
import { AccountSection } from '../components/settings/AccountSection';
import { QuickNotesAPISection } from '../components/settings/QuickNotesAPISection';
import { AIConfigSection } from '../components/settings/AIConfigSection';
import { CalendarConfigSection } from '../components/settings/CalendarConfigSection';
import { TrackerManagementSection } from '../components/settings/TrackerManagementSection';
import { DataManagementSection } from '../components/settings/DataManagementSection';

const Settings: React.FC = () => {
    const { trackers, addTracker, deleteTracker, updateTracker, exportData, importData } = useTracker();
    const { user, signOut } = useAuth();

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <div className="space-y-6">
            <AccountSection
                userEmail={user?.email}
                onLogout={handleLogout}
            />

            <QuickNotesAPISection
                userId={user?.id}
            />

            <AIConfigSection
                userId={user?.id}
            />

            <CalendarConfigSection
                userId={user?.id}
            />

            <TrackerManagementSection
                trackers={trackers}
                onAddTracker={addTracker}
                onDeleteTracker={deleteTracker}
                onUpdateTracker={updateTracker}
            />

            <DataManagementSection
                userId={user?.id}
                onExport={exportData}
                onImport={importData}
            />
        </div>
    );
};

export default Settings;
