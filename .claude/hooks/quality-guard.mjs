#!/usr/bin/env node
/**
 * Advisory quality guard (PostToolUse: Edit|Write|MultiEdit).
 *
 * Reads the hook payload on stdin, inspects the text the tool just wrote, and
 * surfaces ADVISORY warnings (never blocks — always exits 0) when an edit
 * introduces a violation of this project's hard rules. Warnings are fed back to
 * Claude via `hookSpecificOutput.additionalContext` so it can self-correct.
 *
 * Rules encoded here come from the Buddy project's CLAUDE.md — NOT the unrelated
 * snowboard-app rules.
 */
import { readFileSync } from 'node:fs';

function readStdin() {
    try {
        return readFileSync(0, 'utf8');
    } catch {
        return '';
    }
}

const raw = readStdin();
if (!raw.trim()) process.exit(0);

let payload;
try {
    payload = JSON.parse(raw);
} catch {
    process.exit(0);
}

const input = payload.tool_input || {};
const filePath = String(input.file_path || '').replace(/\\/g, '/');
if (!filePath) process.exit(0);

// Only scan code/SQL — skip docs, markdown, and config so rule descriptions
// (e.g. agent files that mention forbidden table names) aren't false-flagged.
if (!/\.(ts|tsx|js|jsx|mjs|cjs|sql)$/.test(filePath)) process.exit(0);

// Gather the new text written by Write / Edit / MultiEdit.
let text = '';
if (typeof input.content === 'string') text += input.content;
if (typeof input.new_string === 'string') text += '\n' + input.new_string;
if (Array.isArray(input.edits)) {
    for (const e of input.edits) {
        if (e && typeof e.new_string === 'string') text += '\n' + e.new_string;
    }
}
if (!text.trim()) process.exit(0);

const inSrc = /(^|\/)src\//.test(filePath);
const inEdgeFn = filePath.includes('/supabase/functions/');
const isTs = /\.(ts|tsx)$/.test(filePath);

const warnings = [];

// console.log in app source (Deno edge functions legitimately log to stdout).
if (inSrc && !inEdgeFn && /\bconsole\.log\s*\(/.test(text)) {
    warnings.push('console.log found in src/ — remove it or use a proper logger before committing.');
}

// TypeScript strict / no-any.
if (isTs && /(:\s*any\b|\bas\s+any\b|<any>)/.test(text)) {
    warnings.push('`any` type detected — this project is TS strict / no-any. Find or declare the real type.');
}

// Critical naming gotchas (see CLAUDE.md).
if (/tracker_entries/.test(text)) {
    warnings.push("Table `tracker_entries` does not exist — health check-ins live in the `entries` table.");
}
if (/from\(\s*['"]tasks['"]\s*\)/.test(text)) {
    warnings.push("Table `tasks` does not exist — todos live in the `todos` table.");
}

// Raw locale date formatting — project standard is date-fns.
if (inSrc && /\.toLocaleDateString\s*\(|\.toLocaleString\s*\(/.test(text)) {
    warnings.push('Raw locale date formatting detected — use date-fns `format()` instead.');
}

if (warnings.length === 0) process.exit(0);

const body = `⚠️ Quality guard (advisory) — ${filePath}:\n- ${warnings.join('\n- ')}`;
const out = {
    hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: body,
    },
};
process.stdout.write(JSON.stringify(out));
process.exit(0);
