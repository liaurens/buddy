/**
 * Daily Journal Prompts
 * A rotating pool of reflection questions. The day-of-year seeds which 3 prompts appear.
 */

export interface JournalPrompt {
    id: string;
    question: string;
    hint?: string;
    category: 'gratitude' | 'reflection' | 'growth' | 'challenge' | 'intention';
}

export const JOURNAL_PROMPTS: JournalPrompt[] = [
    // Gratitude
    { id: 'g1', question: 'What are you grateful for today?', hint: 'Big or small, anything that made you smile.', category: 'gratitude' },
    { id: 'g2', question: 'Who made a positive impact on you today?', category: 'gratitude' },
    { id: 'g3', question: 'What small moment brought you joy?', category: 'gratitude' },

    // Reflection
    { id: 'r1', question: 'What went well today?', hint: 'Anything — from a good conversation to crossing a task off.', category: 'reflection' },
    { id: 'r2', question: 'How did you feel today, and why?', category: 'reflection' },
    { id: 'r3', question: 'What did you notice about your energy today?', category: 'reflection' },
    { id: 'r4', question: 'What was the best part of your day?', category: 'reflection' },

    // Growth / Learning
    { id: 'gr1', question: 'What did you learn today?', hint: 'About yourself, others, or the world.', category: 'growth' },
    { id: 'gr2', question: 'What would you do differently if you could replay today?', category: 'growth' },
    { id: 'gr3', question: 'Where did you step outside your comfort zone?', category: 'growth' },

    // Challenges
    { id: 'c1', question: 'What challenged you today, and how did you handle it?', category: 'challenge' },
    { id: 'c2', question: 'Is there anything weighing on your mind?', hint: 'Writing it down often helps.', category: 'challenge' },
    { id: 'c3', question: 'Where did you struggle, and what support would have helped?', category: 'challenge' },

    // Intention for tomorrow
    { id: 'i1', question: 'What do you want to focus on tomorrow?', category: 'intention' },
    { id: 'i2', question: 'What is one thing you want to let go of before you sleep?', category: 'intention' },
    { id: 'i3', question: 'What is one small action that would make tomorrow better?', category: 'intention' },
];

/**
 * Deterministically pick 3 prompts for a given date.
 * Always includes one gratitude, one reflection, and one growth/challenge/intention.
 */
export function getPromptsForDate(date: Date): JournalPrompt[] {
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);

    const gratitudes = JOURNAL_PROMPTS.filter(p => p.category === 'gratitude');
    const reflections = JOURNAL_PROMPTS.filter(p => p.category === 'reflection');
    const others = JOURNAL_PROMPTS.filter(p => ['growth', 'challenge', 'intention'].includes(p.category));

    return [
        gratitudes[dayOfYear % gratitudes.length],
        reflections[dayOfYear % reflections.length],
        others[dayOfYear % others.length],
    ];
}
