#!/usr/bin/env node
/**
 * Pre-commit gate (PreToolUse: Bash|PowerShell).
 *
 * Automates the typecheck half of /check at the moment it matters: when a
 * `git commit` command is about to run. Silent (zero tokens, near-zero time)
 * for every other command. On tsc failure it DENIES the commit and feeds the
 * errors back so Claude fixes them first.
 *
 * Escape hatch: `--no-verify` on the commit command skips the gate (same
 * convention as the husky pre-commit hook).
 *
 * Lint and tests stay manual via /check — deliberate: they are slow and the
 * lint baseline is not clean.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

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

const command = String((payload.tool_input && payload.tool_input.command) || '');
// Only gate actual git commit invocations; skip everything else instantly.
if (!/\bgit\b[^\n;|&]*\bcommit\b/.test(command)) process.exit(0);
if (command.includes('--no-verify')) process.exit(0);

// Docs/config-only commits don't need a typecheck — skip tsc when no
// TS-affecting file changed vs HEAD (staged or unstaged; untracked files
// can't be committed without being staged, which shows up here too).
const diff = spawnSync('git', ['diff', '--name-only', 'HEAD'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
});
if (diff.status === 0) {
    const tsAffecting = (diff.stdout || '')
        .split('\n')
        .some((f) => /\.(ts|tsx)$/.test(f) || /tsconfig|vite\.config/.test(f));
    if (!tsAffecting) process.exit(0);
}

const res = spawnSync('npx', ['--no-install', 'tsc', '-b', '--pretty', 'false'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 120000,
});

// tsc clean (or tsc unavailable) → let the commit through silently.
if (res.status === 0 || res.status === null || res.error) process.exit(0);

const output = `${res.stdout || ''}\n${res.stderr || ''}`
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 15)
    .join('\n');

const out = {
    hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
            'Commit blocked — `npx tsc -b` failed. Fix these type errors first ' +
            '(or commit with --no-verify to bypass):\n' +
            output,
    },
};
process.stdout.write(JSON.stringify(out));
process.exit(0);
