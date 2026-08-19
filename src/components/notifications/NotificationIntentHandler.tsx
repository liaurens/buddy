import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTasks } from '../../features/tasks/hooks/useTasks';
import { useToast } from '../ui/Toast';
import { snoozeTaskReminder } from '../../services/notifications/scheduler.service';

interface NotificationIntentHandlerProps {
    kind: 'complete' | 'snooze';
    taskId: string;
    /** Called exactly once, after the intent ran (or failed) — clears the params. */
    onConsumed: () => void;
}

/**
 * Headless executor for notification action buttons ("Mark done", "Snooze
 * 15m"). The service worker turns those taps into ?intent=…&taskId=… — this
 * component makes them actually happen once the task list is loaded, with a
 * toast as the receipt. It mounts outside the routed content on purpose: a
 * lock-screen "Mark done" completes the task even while the check-in gate is
 * still holding the app.
 */
const NotificationIntentHandler: React.FC<NotificationIntentHandlerProps> = ({
    kind,
    taskId,
    onConsumed,
}) => {
    const { user } = useAuth();
    const { tasks, isLoading, toggleTask } = useTasks();
    const toast = useToast();
    // The intent must run once, even though tasks/toast identities change.
    const consumedRef = useRef(false);

    useEffect(() => {
        if (consumedRef.current || isLoading || !user?.id) return;
        consumedRef.current = true;
        const task = tasks.find((t) => t.id === taskId);
        void (async () => {
            try {
                if (!task) {
                    toast.error('Could not find that task — it may have been deleted.');
                    return;
                }
                if (kind === 'complete') {
                    if (task.completed) {
                        toast.success('Already done ✓');
                    } else {
                        await toggleTask(task.id);
                        toast.success(`Done ✓ ${task.title}`);
                    }
                    return;
                }
                await snoozeTaskReminder(user.id, { id: task.id, title: task.title });
                toast.success('Snoozed — I’ll nudge you again in 15 minutes.');
            } catch (err) {
                console.error('Notification intent failed:', err);
                toast.error('Could not do that — try again from Tasks.');
            } finally {
                onConsumed();
            }
        })();
    }, [isLoading, user, tasks, kind, taskId, toggleTask, toast, onConsumed]);

    return null;
};

export default NotificationIntentHandler;
