import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Skill, SkillLog } from '../types';
import { getRequiredXpForLevel } from '../types';

const STORAGE_KEY = 'buddy_growth_state';

interface UseSkillsReturn {
  skills: Skill[];
  logs: SkillLog[];
  addSkill: (name: string, color: string, icon: string) => void;
  deleteSkill: (id: string) => void;
  logActivity: (skillId: string, minutes: number, note: string) => { 
    xp: number; 
    critical: boolean; 
    levelUp: boolean;
    oldLevel: number;
    newLevel: number;
  };
}

export function useSkills(): UseSkillsReturn {
  const [skills, setSkills] = useState<Skill[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).skills || [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [logs, setLogs] = useState<SkillLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).logs || [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Save to local storage whenever state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ skills, logs }));
  }, [skills, logs]);

  const addSkill = (name: string, color: string, icon: string) => {
    const newSkill: Skill = {
      id: uuidv4(),
      name,
      level: 1,
      xp: 0,
      color,
      icon,
      createdAt: new Date().toISOString(),
    };
    setSkills(prev => [...prev, newSkill]);
  };

  const deleteSkill = (id: string) => {
    setSkills(prev => prev.filter(s => s.id !== id));
    setLogs(prev => prev.filter(l => l.skillId !== id));
  };

  const logActivity = (skillId: string, minutes: number, note: string) => {
    // Determine XP (1 minute = 1 XP)
    let xpGained = minutes;
    
    // 15% chance for a "Critical Success" (double XP or +50 bonus)
    const isCritical = Math.random() < 0.15;
    if (isCritical) {
      xpGained = Math.floor(xpGained * 1.5) + (minutes > 15 ? 20 : 10);
    }

    const newLog: SkillLog = {
      id: uuidv4(),
      skillId,
      xpGained,
      date: new Date().toISOString(),
      note,
      isCritical,
    };

    let levelUp = false;
    let oldLevel = 1;
    let newLevel = 1;

    setSkills(prev => prev.map(skill => {
      if (skill.id !== skillId) return skill;
      
      let currentXp = skill.xp + xpGained;
      let currentLevel = skill.level;
      let requiredXp = getRequiredXpForLevel(currentLevel);
      
      oldLevel = skill.level;

      // Handle multiple level ups
      while (currentXp >= requiredXp) {
        currentXp -= requiredXp;
        currentLevel += 1;
        levelUp = true;
        requiredXp = getRequiredXpForLevel(currentLevel);
      }
      
      newLevel = currentLevel;

      return {
        ...skill,
        xp: currentXp,
        level: currentLevel,
      };
    }));

    setLogs(prev => [newLog, ...prev]);

    return {
      xp: xpGained,
      critical: isCritical,
      levelUp,
      oldLevel,
      newLevel
    };
  };

  return {
    skills,
    logs,
    addSkill,
    deleteSkill,
    logActivity,
  };
}
