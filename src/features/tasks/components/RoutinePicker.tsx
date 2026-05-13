import React, { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import { useRoutines } from '../hooks/useRoutines';
import { Play } from 'lucide-react';

interface RoutinePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onRan?: (count: number) => void;
}

const RoutinePicker: React.FC<RoutinePickerProps> = ({ isOpen, onClose, onRan }) => {
    const { routines, runRoutine } = useRoutines();
    const [running, setRunning] = useState<string | null>(null);

    const handleRun = async (id: string) => {
        setRunning(id);
        try {
            const count = await runRoutine(id);
            onRan?.(count);
            onClose();
        } finally {
            setRunning(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Run a routine">
            <div className="space-y-2">
                {routines.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                        No routines yet. Open settings to define one.
                    </div>
                ) : (
                    routines.map(r => (
                        <button
                            key={r.id}
                            onClick={() => handleRun(r.id)}
                            disabled={running === r.id || r.items.length === 0}
                            className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{r.emoji || '🔁'}</span>
                                <div className="flex-1">
                                    <div className="font-medium text-slate-800">{r.name}</div>
                                    {r.description && (
                                        <div className="text-xs text-slate-500">{r.description}</div>
                                    )}
                                    <div className="text-xs text-slate-400 mt-1">
                                        {r.items.length} {r.items.length === 1 ? 'step' : 'steps'}
                                    </div>
                                </div>
                                <Play size={16} className="text-indigo-500" />
                            </div>
                        </button>
                    ))
                )}
            </div>
        </Modal>
    );
};

export default RoutinePicker;
