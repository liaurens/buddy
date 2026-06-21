#!/usr/bin/env node
/**
 * Format-on-edit (PostToolUse: Edit|Write|MultiEdit).
 *
 * Runs Prettier on the single file that was just edited. Advisory and silent:
 * it never blocks, and no-ops gracefully if Prettier is not installed yet
 * (`--no-install`) or the file is prettier-ignored.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

let raw = '';
try {
    raw = readFileSync(0, 'utf8');
} catch {
    process.exit(0);
}
if (!raw.trim()) process.exit(0);

let payload;
try {
    payload = JSON.parse(raw);
} catch {
    process.exit(0);
}

const filePath = String((payload.tool_input && payload.tool_input.file_path) || '');
if (!filePath) process.exit(0);
if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|css)$/.test(filePath)) process.exit(0);

spawnSync('npx', ['--no-install', 'prettier', '--write', filePath], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
});

process.exit(0);
