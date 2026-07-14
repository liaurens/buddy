/**
 * Command Parser — Tier 1: Slash commands (zero AI cost)
 *
 * Parses /command input and maps to domain + action using the tool registry.
 * Also handles legacy -flag syntax for backward compatibility.
 */

import type { Domain, Intent, RoutedCommand } from '../types.ts';
import { ALL_TOOLS } from '../tools/registry.ts';

interface CommandEntry {
    domain: Domain;
    action: Intent;
}

// Build command map from all registered tools.
//
// Built lazily on first use (not at module load). ALL_TOOLS lives in registry.ts,
// which participates in an import cycle: registry → system.tool → command-parser →
// registry. Reading ALL_TOOLS at module-load time runs while registry.ts is still
// evaluating, so the binding is in its temporal dead zone and throws
// "Cannot access 'ALL_TOOLS' before initialization" — crashing the whole edge
// function at boot. Deferring the read until first call sidesteps the cycle.
let commandMap: Map<string, CommandEntry> | null = null;
function getCommandMap(): Map<string, CommandEntry> {
    if (commandMap) return commandMap;
    const map = new Map<string, CommandEntry>();
    for (const tool of ALL_TOOLS) {
        for (const cmd of tool.commands) {
            map.set(cmd.command, { domain: tool.domain, action: cmd.action });
        }
    }
    commandMap = map;
    return map;
}

// Legacy flag → slash command mapping. Keeps Dutch/EN flag style usable
// from the iPhone Shortcut so the user can skip the AI for common cases.
const LEGACY_FLAG_MAP: Record<string, string> = {
    // Shopping
    '-shop': '/shop',
    '-boodschap': '/shop',
    '-boodschappen': '/shop',
    // Tasks
    '-task': '/task',
    '-todo': '/task',
    '-taak': '/task',
    '-done': '/done',
    '-klaar': '/done',
    // Notes
    '-note': '/note',
    '-notitie': '/note',
    '-find': '/find',
    '-zoek': '/find',
    // Reminders / notifications
    '-remind': '/remind',
    '-reminder': '/remind',
    '-herinner': '/remind',
    '-herinnering': '/remind',
    // Health
    '-checkin': '/checkin',
    '-meting': '/checkin',
    // Goals
    '-goal': '/goal',
    '-doel': '/goal',
    // Calendar
    '-agenda': '/agenda',
};

/**
 * Tries to parse input as a slash command.
 * Returns null if input doesn't start with '/'.
 */
export function parseSlashCommand(input: string): RoutedCommand | null {
    if (!input.startsWith('/')) return null;

    // Find the longest matching command
    // e.g. "/task.list" should match before "/task"
    let bestMatch: { command: string; entry: CommandEntry } | null = null;

    for (const [command, entry] of getCommandMap()) {
        if (input === command || input.startsWith(command + ' ')) {
            if (!bestMatch || command.length > bestMatch.command.length) {
                bestMatch = { command, entry };
            }
        }
    }

    if (!bestMatch) return null;

    const content = input.slice(bestMatch.command.length).trim();
    return {
        domain: bestMatch.entry.domain,
        action: bestMatch.entry.action,
        params: content ? { content } : {},
        rawInput: input,
        routingMethod: 'command',
    };
}

/**
 * Tries to translate legacy -flag syntax to a slash command.
 * Returns null if no legacy flag is found.
 */
export function parseLegacyFlag(input: string): RoutedCommand | null {
    for (const [flag, command] of Object.entries(LEGACY_FLAG_MAP)) {
        if (input.toLowerCase().startsWith(flag + ' ') || input.toLowerCase() === flag) {
            // Translate to slash command and re-parse
            const newInput = command + input.slice(flag.length);
            const result = parseSlashCommand(newInput);
            if (result) {
                return { ...result, routingMethod: 'legacy', rawInput: input };
            }
        }
    }

    // Also handle flags in the middle of content (e.g. "buy milk -shop")
    const flagMatch = input.match(/-(\w+)/);
    if (flagMatch) {
        const flag = `-${flagMatch[1].toLowerCase()}`;
        const command = LEGACY_FLAG_MAP[flag];
        if (command) {
            const content = input.replace(/-\w+/, '').trim();
            const entry = getCommandMap().get(command);
            if (entry) {
                return {
                    domain: entry.domain,
                    action: entry.action,
                    params: { content },
                    rawInput: input,
                    routingMethod: 'legacy',
                };
            }
        }
    }

    return null;
}

/**
 * Get all registered commands for /help display.
 */
export function getAvailableCommands(): Array<{
    command: string;
    description: string;
    domain: Domain;
}> {
    const commands: Array<{ command: string; description: string; domain: Domain }> = [];
    for (const tool of ALL_TOOLS) {
        for (const cmd of tool.commands) {
            commands.push({
                command: cmd.command,
                description: cmd.description,
                domain: tool.domain,
            });
        }
    }
    return commands.sort((a, b) => a.command.localeCompare(b.command));
}
