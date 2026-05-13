/**
 * Tool Registry — the central place to register all tools.
 *
 * To add a new tool:
 * 1. Create a file: tools/my-tool.tool.ts that exports a ToolDefinition
 * 2. Import and add it to ALL_TOOLS below
 *
 * That's it. The General Manager and Domain Managers auto-discover
 * commands, rules, and actions from this registry.
 */

import type { ToolDefinition } from '../types.ts'

// Planning domain
import { tasksTool } from './tasks.tool.ts'
import { calendarTool } from './calendar.tool.ts'
import { habitsTool } from './habits.tool.ts'
import { notificationsTool } from './notifications.tool.ts'

// Health domain
import { trackerTool } from './tracker.tool.ts'
import { experimentAgentTool } from './experiment-agent.tool.ts'

// Content domain
import { notesTool } from './notes.tool.ts'

// Extra / System domain
import { systemTool } from './system.tool.ts'

// Mental domain
import { moodTool } from './mood.tool.ts'
import { journalTool } from './journal.tool.ts'

// Improvement domain
import { goalsTool } from './goals.tool.ts'

// Studying domain
import { studyTool } from './study.tool.ts'

// Projects domain
import { projectsTool } from './projects.tool.ts'

// School domain
import { schoolTool } from './school.tool.ts'

export const ALL_TOOLS: ToolDefinition[] = [
  // Planning
  tasksTool,
  calendarTool,
  habitsTool,
  notificationsTool,

  // Health
  trackerTool,
  experimentAgentTool,

  // Mental
  moodTool,
  journalTool,

  // Content
  notesTool,

  // Improvement
  goalsTool,

  // Studying
  studyTool,

  // Projects
  projectsTool,

  // School
  schoolTool,

  // Extra / System
  systemTool,
]
