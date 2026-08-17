/**
 * Tool Registry — the central place to register all tools.
 *
 * To add a new tool:
 * 1. Create a file: tools/my-tool.tool.ts that exports a ToolDefinition
 * 2. Import and add it to ALL_TOOLS below
 *
 * That's it. The General Manager and Domain Managers auto-discover
 * commands, rules, and actions from this registry.
 *
 * Keep this registry lean: every registered tool's schema is sent to the
 * model on each request, which costs tokens and hurts routing accuracy.
 * Tools removed in the 2026-06 prune (habits, mood, journal, study,
 * projects, task-routines, task-types, context) live in git history.
 */

import type { ToolDefinition } from '../types.ts';

// Planning domain
import { tasksTool } from './tasks.tool.ts';
import { taskAITool } from './task-ai.tool.ts';
import { calendarTool } from './calendar.tool.ts';
import { notificationsTool } from './notifications.tool.ts';

// Health domain
import { trackerTool } from './tracker.tool.ts';

// Content domain — retired 2026-08-17. The Notes surface was removed (no note
// written in 90 days) and Capture is the single inbox, so `note.create` would
// have written rows nobody could read. Note-shaped input now falls through to
// tasksTool, which is where the user goes looking for it.

// Extra / System domain
import { systemTool } from './system.tool.ts';

// Improvement domain

// School domain
import { schoolTool } from './school.tool.ts';

export const ALL_TOOLS: ToolDefinition[] = [
    // Planning
    tasksTool,
    taskAITool,
    calendarTool,
    notificationsTool,

    // Health
    trackerTool,

    // School
    schoolTool,

    // Extra / System
    systemTool,
];
