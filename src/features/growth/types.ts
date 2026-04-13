export interface SkillLog {
  id: string;
  skillId: string;
  xpGained: number;
  date: string; // ISO string
  note: string;
  isCritical?: boolean;
}

export interface Skill {
  id: string;
  name: string;
  level: number;
  xp: number;
  color: string;
  icon: string;
  createdAt: string;
}

export interface GrowthState {
  skills: Skill[];
  logs: SkillLog[];
}

export function getRequiredXpForLevel(level: number): number {
  // $XP_{required} = 100 \times 1.15^{(Level-1)}$
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

export function calculateTitle(level: number): string {
  if (level < 5) return 'Novice';
  if (level < 10) return 'Apprentice';
  if (level < 20) return 'Adept';
  if (level < 35) return 'Expert';
  if (level < 50) return 'Master';
  return 'Grandmaster';
}
