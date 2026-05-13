import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import { getRequiredXpForLevel } from '../types';
import type { Skill, SkillLog } from '../types';

interface DbSkill {
    id: string;
    user_id: string;
    name: string;
    level: number;
    xp: number;
    color: string;
    icon: string;
    created_at: string;
    updated_at: string;
}

interface DbSkillLog {
    id: string;
    skill_id: string;
    user_id: string;
    project_id: string | null;
    minutes: number;
    xp_gained: number;
    is_critical: boolean;
    note: string | null;
    logged_at: string;
}

const dbToSkill = (r: DbSkill): Skill => ({
    id: r.id,
    name: r.name,
    level: r.level,
    xp: r.xp,
    color: r.color,
    icon: r.icon,
    createdAt: r.created_at,
});

const dbToSkillLog = (r: DbSkillLog): SkillLog & { projectId: string | null; minutes: number } => ({
    id: r.id,
    skillId: r.skill_id,
    xpGained: r.xp_gained,
    date: r.logged_at,
    note: r.note ?? '',
    isCritical: r.is_critical,
    projectId: r.project_id,
    minutes: r.minutes,
});

interface LogActivityResult {
    xp: number;
    critical: boolean;
    levelUp: boolean;
    oldLevel: number;
    newLevel: number;
}

interface UseSkillsReturn {
    skills: Skill[];
    logs: Array<SkillLog & { projectId: string | null; minutes: number }>;
    isLoading: boolean;
    addSkill: (name: string, color: string, icon: string) => Promise<void>;
    updateSkill: (id: string, patch: { name?: string; icon?: string; color?: string }) => Promise<void>;
    deleteSkill: (id: string) => Promise<void>;
    logActivity: (skillId: string, minutes: number, note: string, projectId?: string | null) => Promise<LogActivityResult>;
}

const EMPTY_SKILLS: Skill[] = [];
const EMPTY_LOGS: Array<SkillLog & { projectId: string | null; minutes: number }> = [];

export function useSkills(): UseSkillsReturn {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;

    const { data: skills = EMPTY_SKILLS, isLoading } = useQuery({
        queryKey: ['skills', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('skills')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return (data as DbSkill[]).map(dbToSkill);
        },
        enabled: !!userId,
    });

    const { data: logs = EMPTY_LOGS } = useQuery({
        queryKey: ['skill_logs', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('skill_logs')
                .select('*')
                .eq('user_id', userId)
                .order('logged_at', { ascending: false })
                .limit(200);
            if (error) throw error;
            return (data as DbSkillLog[]).map(dbToSkillLog);
        },
        enabled: !!userId,
    });

    const addSkill = useCallback(async (name: string, color: string, icon: string) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase.from('skills').insert({
            user_id: userId,
            name,
            level: 1,
            xp: 0,
            color,
            icon,
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['skills', userId] });
    }, [userId, queryClient]);

    const updateSkill = useCallback(async (id: string, patch: { name?: string; icon?: string; color?: string }) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase
            .from('skills')
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['skills', userId] });
    }, [userId, queryClient]);

    const deleteSkill = useCallback(async (id: string) => {
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase.from('skills').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['skills', userId] });
        queryClient.invalidateQueries({ queryKey: ['skill_logs', userId] });
    }, [userId, queryClient]);

    const logActivity = useCallback(async (
        skillId: string,
        minutes: number,
        note: string,
        projectId: string | null = null,
    ): Promise<LogActivityResult> => {
        if (!userId) throw new Error('Not authenticated');
        const skill = skills.find(s => s.id === skillId);
        if (!skill) throw new Error('Skill not found');

        let xpGained = minutes;
        const isCritical = Math.random() < 0.15;
        if (isCritical) {
            xpGained = Math.floor(xpGained * 1.5) + (minutes > 15 ? 20 : 10);
        }

        const oldLevel = skill.level;
        let currentXp = skill.xp + xpGained;
        let currentLevel = skill.level;
        let levelUp = false;
        let requiredXp = getRequiredXpForLevel(currentLevel);
        while (currentXp >= requiredXp) {
            currentXp -= requiredXp;
            currentLevel += 1;
            levelUp = true;
            requiredXp = getRequiredXpForLevel(currentLevel);
        }
        const newLevel = currentLevel;

        const { error: logErr } = await supabase.from('skill_logs').insert({
            skill_id: skillId,
            user_id: userId,
            project_id: projectId,
            minutes,
            xp_gained: xpGained,
            is_critical: isCritical,
            note: note || null,
        });
        if (logErr) throw logErr;

        const { error: updErr } = await supabase
            .from('skills')
            .update({
                xp: currentXp,
                level: currentLevel,
                updated_at: new Date().toISOString(),
            })
            .eq('id', skillId)
            .eq('user_id', userId);
        if (updErr) throw updErr;

        queryClient.invalidateQueries({ queryKey: ['skills', userId] });
        queryClient.invalidateQueries({ queryKey: ['skill_logs', userId] });

        return { xp: xpGained, critical: isCritical, levelUp, oldLevel, newLevel };
    }, [userId, skills, queryClient]);

    return { skills, logs, isLoading, addSkill, updateSkill, deleteSkill, logActivity };
}
