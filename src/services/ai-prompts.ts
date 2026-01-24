/**
 * AI Prompt Templates for Daily Planning
 *
 * Structured prompts for:
 * - Daily plan generation
 * - Adaptive replanning
 * - Task breakdown
 */

import type { PlanGenerationContext, ReplanRequest, CalendarEvent, ActivityTemplate } from '../types/planning';
import type { Task } from '../types';

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatCalendarEvents(events: CalendarEvent[]): string {
    if (events.length === 0) return 'No calendar events today.';

    return events.map(event => {
        const start = new Date(event.startTime);
        const end = new Date(event.endTime);
        const duration = Math.round((end.getTime() - start.getTime()) / 60000);

        return `- ${formatTime(start)}-${formatTime(end)} (${duration}min): ${event.title}${event.location ? ` @ ${event.location}` : ''}${event.travelTimeMinutes ? ` [+${event.travelTimeMinutes}min travel]` : ''}`;
    }).join('\n');
}

function formatTasks(tasks: Array<{ id: string; title: string; priority?: string; estimatedTime?: number; dueDate?: string }>): string {
    if (tasks.length === 0) return 'No pending tasks.';

    return tasks.map((task, idx) => {
        const priority = task.priority ? ` [${task.priority.toUpperCase()}]` : '';
        const estimate = task.estimatedTime ? ` (~${task.estimatedTime}min)` : '';
        const deadline = task.dueDate ? ` (due: ${task.dueDate})` : '';
        return `${idx + 1}. ${task.title}${priority}${estimate}${deadline}`;
    }).join('\n');
}

function formatActivityTemplates(templates: ActivityTemplate[]): string {
    if (templates.length === 0) return 'No activity templates defined.';

    return templates
        .filter(t => t.isActive)
        .map(t => {
            const avgTime = t.averageMinutes || t.defaultMinutes;
            const pref = t.preferredTimeSlot ? ` [prefers ${t.preferredTimeSlot}]` : '';
            const freq = t.frequency ? ` (${t.frequency})` : '';
            return `- ${t.emoji || '•'} ${t.name}: ${avgTime}min${pref}${freq}`;
        }).join('\n');
}

function formatUserState(context: PlanGenerationContext): string {
    const parts = [];

    if (context.mood !== undefined) {
        parts.push(`Mood: ${context.mood}/10`);
    }
    if (context.energy !== undefined) {
        parts.push(`Energy: ${context.energy}/10`);
    }
    if (context.sleepHours !== undefined) {
        parts.push(`Sleep: ${context.sleepHours}h`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'No user state data available.';
}

function formatLearningPatterns(patterns: PlanGenerationContext['learningPatterns']): string {
    if (!patterns || patterns.length === 0) {
        return 'No historical patterns available yet. User is new or hasn\'t completed enough tasks for pattern detection.';
    }

    return patterns.map((p, idx) => {
        return `${idx + 1}. ${p.pattern} (${p.sampleSize} samples)
   → ${p.recommendation}`;
    }).join('\n');
}

// ============================================================================
// Daily Plan Generation
// ============================================================================

export function generateDailyPlanSystemPrompt(): string {
    return `You are an expert daily planner AI assistant. Your role is to create realistic, achievable daily schedules that:

1. **Respect fixed constraints**: Calendar events, meetings, and appointments are immovable.
2. **Consider user state**: Adjust ambition based on mood, energy, and sleep quality.
3. **Learn from history**: Use historical task duration data and detected patterns to make better estimates.
4. **Apply learning patterns**: When the user has established patterns (e.g., "typically underestimates coding tasks by 30%"), automatically adjust estimates accordingly.
5. **Include breaks**: Schedule buffer time between tasks and longer breaks for meals.
6. **Be realistic**: Don't overpack the schedule. Leave breathing room.
7. **Prioritize intelligently**: High-priority and deadline-driven tasks first, but balance with energy levels.
8. **Match preferences**: Respect activity template preferences (morning vs. evening, etc.).

IMPORTANT RULES:
- Always include travel time before calendar events
- Never schedule tasks during calendar events
- If energy/mood is low (<5), reduce workload and add more breaks
- If sleep is poor (<6h), prioritize essential tasks only
- Include at least one 30-60min lunch break
- Add 5-10min buffers between focused work blocks
- The schedule should end with free time, not at midnight

LEARNING FROM PATTERNS:
When the user provides learning patterns (e.g., "meetings typically run 15% over"), you MUST adjust your time estimates accordingly:
- For a 60min meeting estimate, add 15% → plan for 69min (round up to 70min)
- For coding tasks that typically take 30% longer, a 90min estimate becomes 117min (round up to 120min)
- Apply general variance patterns to all tasks if no specific pattern exists
- Be conservative: it's better to finish early than run late

Return your response as valid JSON matching this structure:
{
  "blocks": [
    {
      "title": "Task or activity name",
      "description": "Optional details",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "estimatedMinutes": 60,
      "taskId": "uuid-if-from-task-list",
      "activityTemplateId": "uuid-if-from-template",
      "calendarEventId": "uuid-if-from-calendar",
      "status": "pending",
      "sortOrder": 0
    }
  ],
  "reasoning": "Brief explanation of why you structured the day this way",
  "warnings": ["Warning 1", "Warning 2"],
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "totalMinutes": 480,
  "freeTimeMinutes": 120
}`;
}

export function generateDailyPlanUserPrompt(context: PlanGenerationContext): string {
    const date = new Date(context.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return `Create a daily plan for ${date}.

USER STATE:
${formatUserState(context)}

LEARNING PATTERNS (Apply these to your estimates):
${formatLearningPatterns(context.learningPatterns)}

CALENDAR EVENTS (Fixed - cannot move):
${formatCalendarEvents(context.calendarEvents)}

PENDING TASKS:
${formatTasks(context.tasks)}

RECURRING ACTIVITIES (Optional - include if time permits):
${formatActivityTemplates(context.activityTemplates)}

PREFERENCES:
- Work hours: ${context.workStartTime || '09:00'} - ${context.workEndTime || '17:00'}
${context.breakPreferences?.includeLunchBreak ? `- Lunch break: ${context.breakPreferences.lunchDuration || 60} minutes` : ''}
${context.breakPreferences?.includeShortBreaks ? `- Short breaks: Every ${context.breakPreferences.shortBreakInterval || 90} minutes` : ''}

IMPORTANT: Use the learning patterns above to adjust your time estimates. If the user typically underestimates tasks, add buffer time accordingly.

Please create a realistic, balanced schedule that respects the calendar events and helps complete high-priority tasks while maintaining wellbeing.`;
}

// ============================================================================
// Adaptive Replanning
// ============================================================================

export function generateReplanSystemPrompt(): string {
    return `You are an empathetic AI planner helping users adapt their schedule when things don't go as planned.

Your role is to:
1. **Be encouraging**: Don't make the user feel bad for being behind schedule
2. **Be realistic**: Only replan what's actually achievable in remaining time
3. **Prioritize ruthlessly**: Focus on what truly matters
4. **Suggest deferrals**: Recommend moving non-urgent tasks to tomorrow
5. **Maintain balance**: Don't create an impossible catch-up schedule

TONE GUIDELINES:
- "encouraging": Use supportive language like "Here's a fresh plan for the rest of your day"
- "neutral": Just present the facts and new schedule without emotional language

Return JSON in the same format as daily plan generation.`;
}

export function generateReplanUserPrompt(request: ReplanRequest, remainingTasks: Task[], currentTime: string): string {
    const now = new Date(currentTime);
    const timeStr = formatTime(now);
    const tone = request.tone || 'encouraging';

    let intro = '';
    if (tone === 'encouraging') {
        intro = `No worries about running behind! Let's create a realistic plan for the rest of your day.`;
    } else {
        intro = `Replanning remaining tasks for today.`;
    }

    return `${intro}

CURRENT TIME: ${timeStr}

REMAINING TASKS:
${formatTasks(remainingTasks)}

${request.addTasks && request.addTasks.length > 0 ? `
NEW TASKS TO ADD:
${request.addTasks.map((t, idx) => `${idx + 1}. ${t.title} (~${t.estimatedTime}min)`).join('\n')}
` : ''}

${request.skipBlockIds && request.skipBlockIds.length > 0 ? `
TASKS TO SKIP/DEFER:
${request.skipBlockIds.length} blocks marked to skip
` : ''}

Please create a realistic plan for the rest of today. If there isn't enough time for everything, suggest which tasks should move to tomorrow.`;
}

// ============================================================================
// Task Breakdown
// ============================================================================

export function generateTaskBreakdownSystemPrompt(): string {
    return `You are a task breakdown specialist. When given a large or vague task, you break it down into specific, actionable subtasks.

Guidelines:
- Each subtask should be concrete and completable
- Subtasks should be in logical order
- Time estimates should be realistic (not overly optimistic)
- Aim for 3-5 subtasks (adjust based on complexity)
- Each subtask should take 5-60 minutes

Return JSON format:
{
  "subtasks": [
    { "title": "Specific actionable step", "estimatedMinutes": 15 }
  ]
}`;
}

// ============================================================================
// Historical Learning Prompts
// ============================================================================

export function generateHistoricalInsightsPrompt(taskHistory: Array<{ title: string; estimated: number; actual: number }>): string {
    return `Based on the user's task history, provide insights about their time estimation patterns:

TASK HISTORY:
${taskHistory.map(h => `- "${h.title}": Estimated ${h.estimated}min, took ${h.actual}min (${h.actual > h.estimated ? '+' : ''}${h.actual - h.estimated}min)`).join('\n')}

Return JSON:
{
  "patterns": ["Pattern 1", "Pattern 2"],
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "averageVariance": 0,
  "tendencyToUnderestimate": true
}`;
}
