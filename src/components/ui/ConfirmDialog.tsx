import React from 'react';
import Modal from './Modal';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Accessible replacement for window.confirm — renders a small Modal with
 * cancel/confirm actions. Use `destructive` for delete-style confirmations.
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    onConfirm,
    onCancel,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title={title}
            size="sm"
            footer={
                <>
                    <button onClick={onCancel} className="app-secondary-button py-2.5">
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`${destructive ? 'app-danger-button' : 'app-primary-button'} py-2.5`}
                    >
                        {confirmLabel}
                    </button>
                </>
            }
        >
            <p className="text-sm font-semibold leading-relaxed text-cove-muted">{message}</p>
        </Modal>
    );
};

export default ConfirmDialog;
