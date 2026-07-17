/**
 * SkillsLogCard — log skill practice from the daily reflection.
 *
 * Replaces the Growth Hub page as the place where skill XP is earned: at the
 * end of the day you note how many minutes each skill got. Skill creation and
 * management happens via the assistant (skills tool).
 */
import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { useSkills } from '../../../growth/hooks/useSkills';

interface LogFeedback {
    skillId: string;
    message: string;
}

const SkillsLogCard: React.FC = () => {
    const { skills, logActivity } = useSkills();
    const [minutesBySkill, setMinutesBySkill] = useState<Record<string, string>>({});
    const [busySkillId, setBusySkillId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<LogFeedback | null>(null);
    const [logError, setLogError] = useState<string | null>(null);

    if (skills.length === 0) return null;

    const handleLog = async (skillId: string) => {
        const minutes = Number(minutesBySkill[skillId]);
        if (!Number.isFinite(minutes) || minutes <= 0) return;
        setBusySkillId(skillId);
        setLogError(null);
        try {
            const result = await logActivity(skillId, minutes, '');
            const parts = [`+${result.xp} XP`];
            if (result.critical) parts.push('critical!');
            if (result.levelUp) parts.push(`level ${result.oldLevel} → ${result.newLevel} 🎉`);
            setFeedback({ skillId, message: parts.join(' · ') });
            setMinutesBySkill((prev) => ({ ...prev, [skillId]: '' }));
        } catch (err) {
            console.error('Failed to log skill practice:', err);
            setLogError(err instanceof Error ? err.message : 'Failed to log practice');
        } finally {
            setBusySkillId(null);
        }
    };

    return (
        <div className="bg-white rounded-[18px] p-6 shadow-cove space-y-4">
            <h2 className="text-[15px] font-extrabold text-cove-ink flex items-center gap-2">
                <Zap size={18} className="text-cove-streak" /> Skills practiced today
            </h2>
            <p className="text-xs font-semibold text-cove-muted -mt-2">
                Minutes spent practicing each skill — XP is logged immediately.
            </p>
            {logError && <p className="text-xs font-semibold text-cove-pink">{logError}</p>}
            <ul className="space-y-3">
                {skills.map((skill) => (
                    <li key={skill.id} className="flex items-center gap-3">
                        <span className="flex-1 min-w-0 text-sm font-bold text-cove-ink truncate">
                            {skill.icon} {skill.name}
                            <span className="ml-2 text-xs font-semibold text-cove-soft">
                                lvl {skill.level}
                            </span>
                        </span>
                        {feedback?.skillId === skill.id ? (
                            <span className="text-xs font-bold text-cove-success-deep">
                                {feedback.message}
                            </span>
                        ) : (
                            <>
                                <input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={minutesBySkill[skill.id] ?? ''}
                                    onChange={(e) =>
                                        setMinutesBySkill((prev) => ({
                                            ...prev,
                                            [skill.id]: e.target.value,
                                        }))
                                    }
                                    className="w-20 px-2 py-1.5 text-sm font-semibold text-cove-ink border border-cove-border rounded-[10px] focus:outline-none focus:ring-1 focus:ring-cove-accent-pale"
                                />
                                <span className="text-xs font-semibold text-cove-muted">min</span>
                                <button
                                    type="button"
                                    onClick={() => handleLog(skill.id)}
                                    disabled={
                                        busySkillId === skill.id ||
                                        !Number(minutesBySkill[skill.id])
                                    }
                                    className="px-3 py-1.5 text-xs font-extrabold text-cove-streak-text bg-cove-tint-amber hover:bg-cove-streak/20 rounded-full transition-colors disabled:opacity-50"
                                >
                                    {busySkillId === skill.id ? 'Logging…' : 'Log'}
                                </button>
                            </>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SkillsLogCard;
