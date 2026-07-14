import React from 'react';
import { X } from 'lucide-react';
import type { Entry, Dose } from '../../types';
import CheckinForm from './CheckinForm';

interface CheckinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    date?: Date; // Optional date for backdating
    existingEntries?: Entry[]; // Existing entries for the date
    existingDoses?: Dose[]; // Existing doses for the date
}

const EMPTY_ARRAY: never[] = [];

const CheckinModal: React.FC<CheckinModalProps> = ({
    isOpen,
    onClose,
    onComplete,
    date,
    existingEntries = EMPTY_ARRAY,
    existingDoses = EMPTY_ARRAY,
}) => {
    if (!isOpen) return null;

    const targetDate = date || new Date();

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
            <div className="min-h-screen p-3 flex flex-col max-w-xl mx-auto">
                <div className="flex justify-between items-center text-white mb-4 mt-1">
                    <h2 className="text-xl font-bold">Daily Check-in</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 pb-4">
                    <CheckinForm
                        date={targetDate}
                        showProtocols={true}
                        showDatePicker={false}
                        onComplete={() => {
                            onComplete();
                            onClose();
                        }}
                        existingEntries={existingEntries}
                        existingDoses={existingDoses}
                    />
                </div>
            </div>
        </div>
    );
};

export default CheckinModal;
