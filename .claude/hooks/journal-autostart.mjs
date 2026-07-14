#!/usr/bin/env node
/**
 * Journal autostart (PostToolUse: Edit|Write|MultiEdit).
 *
 * Automates /start-part: the first time code is edited in a session while NO
 * part journal is active, instruct Claude (once per session — deduped via a
 * marker file) to create the journal itself and keep it updated. Silent in
 * every other case, so the token cost is zero except that single nudge.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

let payload;
try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
} catch {
    process.exit(0);
}

const input = payload.tool_input || {};
const filePath = String(input.file_path || '').replace(/\\/g, '/');
// Only real code work should start a part — not docs, configs, or .claude files.
if (!/(^|\/)(src|supabase)\//.test(filePath)) process.exit(0);
if (!/\.(ts|tsx|js|jsx|mjs|cjs|sql)$/.test(filePath)) process.exit(0);

const progressDir = path.join(process.cwd(), '.claude', 'progress');

// An active (non-archived) journal exists → nothing to do.
try {
    const active = readdirSync(progressDir).some((f) => f.endsWith('.md'));
    if (active) process.exit(0);
} catch {
    // progress dir missing — fall through and create it with the marker.
}

// Dedupe: remind at most once per session.
const marker = path.join(progressDir, '.autostart-state.json');
const sessionId = String(payload.session_id || 'unknown');
try {
    const state = JSON.parse(readFileSync(marker, 'utf8'));
    if (state.sessionId === sessionId) process.exit(0);
} catch {
    /* no marker yet */
}
try {
    mkdirSync(progressDir, { recursive: true });
    writeFileSync(marker, JSON.stringify({ sessionId }));
} catch {
    /* marker write failed — still emit the nudge, worst case it repeats */
}

const out = {
    hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext:
            'ℹ️ Journal autostart: you are editing code but no part journal is active. ' +
            'Unless this is a trivial one-off fix, create `.claude/progress/<yyyymmdd>-<slug>.md` ' +
            'now from `.claude/templates/progress.md` (fill in part name, date, Goal, and a Status ' +
            'checklist of the planned steps — see .claude/commands/start-part.md), and keep its ' +
            'Status / Errors & gotchas / Next steps updated as you work. Do this yourself without ' +
            'asking the user.',
    },
};
process.stdout.write(JSON.stringify(out));
process.exit(0);
