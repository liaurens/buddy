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
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

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
    warnings.push(
        'console.log found in src/ — remove it or use a proper logger before committing.',
    );
}

// TypeScript strict / no-any.
if (isTs && /(:\s*any\b|\bas\s+any\b|<any>)/.test(text)) {
    warnings.push(
        '`any` type detected — this project is TS strict / no-any. Find or declare the real type.',
    );
}

// Critical naming gotchas (see CLAUDE.md).
if (/tracker_entries/.test(text)) {
    warnings.push(
        'Table `tracker_entries` does not exist — health check-ins live in the `entries` table.',
    );
}
if (/from\(\s*['"]tasks['"]\s*\)/.test(text)) {
    warnings.push('Table `tasks` does not exist — todos live in the `todos` table.');
}

// Raw locale date formatting — project standard is date-fns.
if (inSrc && /\.toLocaleDateString\s*\(|\.toLocaleString\s*\(/.test(text)) {
    warnings.push('Raw locale date formatting detected — use date-fns `format()` instead.');
}

// Buddy Cove palette drift (see CLAUDE.md "Buddy Cove UI").
//
// The redesign landed on the page shells but the leaves kept hand-rolling
// `border-slate-300 rounded-lg`, which is how ~1,500 pre-Cove utilities survived
// inside Cove pages. Catch new ones at the point of writing.
if (inSrc && /\.(tsx|jsx)$/.test(filePath)) {
    const DEFAULT_PALETTE =
        /(?:^|[\s"'`])(?:[a-z-]+:)*(?:bg|text|border|ring|divide|from|to|via|placeholder:text|fill|stroke|shadow|outline|accent)-(?:gray|slate|zinc|neutral|stone|blue|indigo|violet|purple|fuchsia|pink|rose|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky)-\d{2,3}\b/;
    if (DEFAULT_PALETTE.test(text)) {
        warnings.push(
            'Default Tailwind palette class in a component — this app uses the Buddy Cove tokens. ' +
                'Use `cove-*` colours (cove-ink/muted/soft/faint, cove-accent, cove-success, cove-streak, ' +
                'cove-danger, cove-tint-*) or an `app-*` primitive from src/index.css (app-input, app-card, ' +
                'app-primary-button, app-tint-blue, …).',
        );
    }
    if (/\bfont-(?:medium|normal|light|thin)\b/.test(text)) {
        warnings.push(
            'Cove typography uses semibold/bold/extrabold/black only — `font-medium`/`font-normal` is pre-Cove.',
        );
    }
    if (/\bmin-h-screen\b|\bh-screen\b|100vh/.test(text)) {
        warnings.push(
            '`vh` units overflow the visible area on iOS (viewport-fit=cover) — use `min-h-dvh`/`dvh`.',
        );
    }
    if (/\bbg-gradient-to-/.test(text)) {
        warnings.push('Buddy Cove has no gradients — use a flat `cove-tint-*` panel instead.');
    }
}

// Tasks-feature invariants (see CLAUDE.md "Tasks feature invariants").
if (inSrc && /new Date\(\s*['"]\d{4}-/.test(text)) {
    warnings.push(
        "`new Date('YYYY-MM-DD')` parses as UTC midnight and shifts the calendar day — use `parseDueDate` from src/features/tasks/utils/dueDates.ts for due dates.",
    );
}
const isTaskWritePath =
    filePath.includes('src/features/tasks/services/') ||
    filePath.includes('src/services/supabase/');
if (
    inSrc &&
    !isTaskWritePath &&
    /from\(\s*['"]todos['"]\s*\)/.test(text) &&
    /\.(update|insert|upsert)\s*\(/.test(text)
) {
    warnings.push(
        'Direct todos write outside the canonical write path — use `persistTaskUpdate` (services/taskWrites.ts) or `applyTriagePatch` (services/applyTriage.ts).',
    );
}
if (inSrc && /kind\s*[:=]\s*['"]school['"]/.test(text)) {
    warnings.push(
        '`school` TaskKind is derived-only — never write it to `todos.kind` (DB CHECK rejects it). Derive from assignment_id / triage_destination.',
    );
}

// Migration guard (supabase/migrations/*.sql): RLS + timestamp ordering.
if (/supabase\/migrations\/\d{14}_.*\.sql$/.test(filePath)) {
    if (/create\s+table/i.test(text) && !/enable\s+row\s+level\s+security/i.test(text)) {
        warnings.push(
            'Migration creates a table but never enables RLS — add `alter table public.<t> enable row level security;` plus per-operation policies scoped to auth.uid() = user_id.',
        );
    }
    const fileName = path.basename(filePath);
    const stamp = fileName.slice(0, 14);
    try {
        const dir = path.join(process.cwd(), 'supabase', 'migrations');
        const latest = readdirSync(dir)
            .filter((f) => /^\d{14}_/.test(f) && f !== fileName)
            .map((f) => f.slice(0, 14))
            .sort()
            .pop();
        if (latest && stamp <= latest) {
            warnings.push(
                `Migration timestamp ${stamp} does not sort after the latest existing migration (${latest}) — bump the prefix or it will be skipped/misordered by the CLI.`,
            );
        }
    } catch {
        /* migrations dir unreadable — skip the ordering check */
    }
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
