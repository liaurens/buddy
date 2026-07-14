#!/usr/bin/env node
/**
 * Stop audit (Stop hook).
 *
 * When a session ends, scan the git-changed src files for lingering rule
 * violations and print a one-line-per-file summary to stderr, plus reminders
 * (undeployed edge fns, stale journal). Advisory, exits 0 — with ONE exception:
 * if the active part journal's Status checklist is fully checked, it holds the
 * stop once (decision: block) and instructs Claude to perform the /finish-part
 * folding automatically. `stop_hook_active` guards against loops.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

let payload = {};
try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
} catch {
    /* no payload — treat as a plain advisory run */
}

function git(args) {
    const res = spawnSync('git', args, {
        encoding: 'utf8',
        shell: process.platform === 'win32',
    });
    if (res.status !== 0 || !res.stdout) return [];
    return res.stdout
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
}

function changedFiles() {
    // Tracked changes + untracked new files (e.g. a brand-new edge function).
    return [
        ...git(['diff', '--name-only', 'HEAD']),
        ...git(['ls-files', '--others', '--exclude-standard']),
    ];
}

const allChanged = changedFiles();
const files = allChanged.filter((f) => f.startsWith('src/') && /\.(ts|tsx)$/.test(f));
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

const notes = [];

if (hits.length) {
    notes.push('⚠️ Stop audit — changed src files still contain:\n' + hits.join('\n'));
}

// Edge functions edited this session but (probably) not deployed yet.
const fnNames = new Set(
    allChanged
        .map((f) => f.replace(/\\/g, '/').match(/^supabase\/functions\/([^/_][^/]*)\//))
        .filter(Boolean)
        .map((m) => m[1]),
);
for (const name of fnNames) {
    notes.push(`ℹ️ Edge fn '${name}' changed this session — deploy with /deploy-fn ${name}.`);
}

// Journal handling: AUTO-FINISH when complete, stale reminder when neglected.
let autoFinish = null;
try {
    const dir = path.join(process.cwd(), '.claude', 'progress');
    const journals = readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => {
            const full = path.join(dir, f);
            return { f, full, mtime: statSync(full).mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
    const active = journals[0];
    if (active) {
        const content = readFileSync(active.full, 'utf8');
        const checked = (content.match(/^\s*-\s*\[x\]/gim) || []).length;
        const unchecked = (content.match(/^\s*-\s*\[ \]/gm) || []).length;
        if (checked > 0 && unchecked === 0 && !payload.stop_hook_active) {
            autoFinish =
                `Part journal '${active.f}' has a fully-checked Status checklist — finish the part now, automatically, before stopping. ` +
                'Follow .claude/commands/finish-part.md: (1) fold "Candidate learnings for CLAUDE.md" into the project CLAUDE.md (durable, project-wide items only, no duplicates); ' +
                '(2) update docs/DESIGN.md — move the part to ✅ Done and add a dated Changelog entry; ' +
                '(3) if significant (new feature module / table / migration / edge fn / ~8+ files), write docs/<feature>.md + a Mermaid diagram in docs/diagrams/; ' +
                '(4) fold any journal-notes.md notes into the journal; ' +
                `(5) archive the journal to .claude/progress/done/${active.f}. ` +
                'Do NOT ask the user — just do it, then give a one-line summary.';
        } else if (files.length > 0 && Date.now() - active.mtime > 2 * 60 * 60 * 1000) {
            notes.push(
                `ℹ️ src/ changed but journal '${active.f}' was last updated >2h ago — update its Status / Next steps so the part stays resumable.`,
            );
        }
    }
} catch {
    /* no progress dir — nothing to nudge */
}

if (notes.length) {
    process.stderr.write(notes.join('\n') + '\n');
}

if (autoFinish) {
    process.stdout.write(JSON.stringify({ decision: 'block', reason: autoFinish }));
}

process.exit(0);
