import React, { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import TaskTypeManager from './TaskTypeManager';
import RoutineEditor from './RoutineEditor';

interface TasksOrganizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'types' | 'routines';
}

const TasksOrganizationModal: React.FC<TasksOrganizationModalProps> = ({
    isOpen,
    onClose,
    initialTab = 'types',
}) => {
    const [tab, setTab] = useState<'types' | 'routines'>(initialTab);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Organize tasks" size="lg">
            <div className="flex gap-1 border-b border-slate-200 -mt-2 mb-4">
                <TabButton active={tab === 'types'} onClick={() => setTab('types')}>
                    Types
                </TabButton>
                <TabButton active={tab === 'routines'} onClick={() => setTab('routines')}>
                    Routines
                </TabButton>
            </div>
            {tab === 'types' ? <TaskTypeManager /> : <RoutineEditor />}
        </Modal>
    );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
        }`}
    >
        {children}
    </button>
);

export default TasksOrganizationModal;
