import React from 'react';
import { Cloud, LogOut } from 'lucide-react';

interface AccountSectionProps {
    userEmail?: string;
    onLogout: () => Promise<void>;
}

export const AccountSection: React.FC<AccountSectionProps> = ({ userEmail, onLogout }) => {
    return (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-xl shadow-sm text-white">
            <div className="flex items-center gap-3 mb-4">
                <Cloud size={24} />
                <h2 className="text-xl font-semibold">Account</h2>
            </div>

            <div className="space-y-4">
                <div className="bg-white/20 rounded-lg p-4">
                    <p className="text-sm opacity-90">Logged in as:</p>
                    <p className="font-semibold text-lg">{userEmail}</p>
                    <p className="text-xs opacity-75 mt-1">
                        Data synced across all devices
                    </p>
                </div>
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors"
                >
                    <LogOut size={18} /> Log Out
                </button>
            </div>
        </div>
    );
};
