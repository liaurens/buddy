import React from 'react';
import { GraduationCap, ChevronRight } from 'lucide-react';
import { useAssignments } from '../hooks/useAssignments';
import { useClasses } from '../hooks/useClasses';

interface UpcomingDeadlinesBannerProps {
    onOpenSchool?: () => void;
    limit?: number;
}

export const UpcomingDeadlinesBanner: React.FC<UpcomingDeadlinesBannerProps> = ({
    onOpenSchool,
    limit = 3,
}) => {
    const { assignments } = useAssignments({ activeOnly: true });
    const { classes } = useClasses();

    if (assignments.length === 0) return null;

    const classMap = new Map(classes.map((c) => [c.id, c]));
    const next = assignments.slice(0, limit);

    return (
        <button
            type="button"
            onClick={onOpenSchool}
            className="w-full text-left bg-white rounded-[18px] shadow-cove p-4 hover:bg-[#eef6fa] transition-colors"
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-[14.5px] font-extrabold text-cove-ink">
                    <GraduationCap size={16} className="text-cove-accent" />
                    Upcoming school deadlines
                </div>
                {onOpenSchool && <ChevronRight size={16} className="text-cove-soft" />}
            </div>
            <ul className="space-y-1.5">
                {next.map((a) => {
                    const cls = classMap.get(a.classId);
                    const d = new Date(a.deadline);
                    return (
                        <li
                            key={a.id}
                            className="flex items-center gap-2 text-[12px] font-semibold text-cove-muted"
                        >
                            <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: cls?.color ?? '#9cb9c9' }}
                            />
                            <span className="font-bold text-cove-ink truncate flex-1">
                                {a.title}
                            </span>
                            <span className="text-cove-soft shrink-0">
                                {d.toLocaleDateString([], {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </button>
    );
};
