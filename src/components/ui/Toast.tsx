/**
 * Toast Notification System
 * Provides user feedback without blocking interactions
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextValue {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const addToast = useCallback(
        (type: ToastType, message: string, duration: number = 4000) => {
            const id = Math.random().toString(36).substring(7);
            const toast: Toast = { id, type, message, duration };

            setToasts((prev) => [...prev, toast]);

            if (duration > 0) {
                setTimeout(() => {
                    removeToast(id);
                }, duration);
            }
        },
        [removeToast],
    );

    const success = useCallback(
        (message: string, duration?: number) => {
            addToast('success', message, duration);
        },
        [addToast],
    );

    const error = useCallback(
        (message: string, duration?: number) => {
            addToast('error', message, duration);
        },
        [addToast],
    );

    const warning = useCallback(
        (message: string, duration?: number) => {
            addToast('warning', message, duration);
        },
        [addToast],
    );

    const info = useCallback(
        (message: string, duration?: number) => {
            addToast('info', message, duration);
        },
        [addToast],
    );

    return (
        <ToastContext.Provider value={{ success, error, warning, info }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

interface ToastContainerProps {
    toasts: Toast[];
    onRemove: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
    return (
        <div className="pointer-events-none fixed inset-x-4 bottom-[calc(4.5rem+1rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:items-end">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
};

interface ToastItemProps {
    toast: Toast;
    onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
    const [isExiting, setIsExiting] = useState(false);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 300);
    };

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return <CheckCircle size={20} />;
            case 'error':
                return <XCircle size={20} />;
            case 'warning':
                return <AlertCircle size={20} />;
            case 'info':
                return <Info size={20} />;
        }
    };

    // Cove tints instead of the default palette: each toast reads as a coloured
    // panel in the same family as the rest of the app, never as a browser alert.
    const getStyles = () => {
        switch (toast.type) {
            case 'success':
                return 'bg-cove-tint-green text-cove-success-deep';
            case 'error':
                return 'bg-cove-tint-danger text-cove-danger-deep';
            case 'warning':
                return 'bg-cove-tint-amber text-cove-streak-text';
            case 'info':
                return 'bg-cove-tint-blue text-cove-ink';
        }
    };

    const getIconColor = () => {
        switch (toast.type) {
            case 'success':
                return 'text-cove-success';
            case 'error':
                return 'text-cove-danger';
            case 'warning':
                return 'text-cove-streak-deep';
            case 'info':
                return 'text-cove-accent';
        }
    };

    return (
        <div
            role="status"
            aria-live="polite"
            className={`
                pointer-events-auto
                flex w-full max-w-[480px] items-start gap-3 rounded-card-lg
                border-0 p-4 shadow-[0_10px_30px_rgba(40,90,130,0.18)] sm:w-auto sm:min-w-[320px]
                ${getStyles()}
                ${
                    isExiting
                        ? 'animate-out fade-out slide-out-to-bottom sm:slide-out-to-right'
                        : 'animate-in fade-in slide-in-from-bottom sm:slide-in-from-right'
                }
            `}
        >
            <div className={getIconColor()}>{getIcon()}</div>
            <p className="flex-1 text-[13.5px] font-extrabold leading-snug">{toast.message}</p>
            <button
                onClick={handleClose}
                className="text-current opacity-50 transition-opacity hover:opacity-100"
                aria-label="Close notification"
            >
                <X size={16} />
            </button>
        </div>
    );
};
