#!/usr/bin/env node
/**
 * Stop audit (Stop hook).
 *
 * When a session ends, scan the git-changed src files for lingering rule
 * violations and print a one-line-per-file summary to stderr. Advisory only —
 * always exits 0, never forces the session to continue.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

function changedFiles() {
    const res = spawnSync('git', ['diff', '--name-only', 'HEAD'], {
        encoding: 'utf8',
        shell: process.platform === 'win32',
    });
    if (res.status !== 0 || !res.stdout) return [];
    return res.stdout
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
}

const files = changedFiles().filter((f) => f.startsWith('src/') && /\.(ts|tsx)$/.test(f));
const hits = [];

for (const f of files) {
    if (!existsSync(f)) continue;
    let content = '';
    try {
        content = readFileSync(f, 'utf8');
    } catch {
        continue;
    }
    const issues = [];
    if (/\bconsole\.log\s*\(/.test(content)) issues.push('console.log');
    if (/(:\s*any\b|\bas\s+any\b|<any>)/.test(content)) issues.push('any');
    if (/tracker_entries/.test(content)) issues.push('tracker_entries');
    if (issues.length) hits.push(`  ${f}: ${issues.join(', ')}`);
}

if (hits.length) {
    process.stderr.write('⚠️ Stop audit — changed src files still contain:\n' + hits.join('\n') + '\n');
}

process.exit(0);
