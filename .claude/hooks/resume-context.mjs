#!/usr/bin/env node
/**
 * Resume context (SessionStart hook).
 *
 * Surfaces any unfinished progress journals in .claude/progress/ at the start of
 * a session so work can be resumed without re-deriving state. Injects a short
 * summary (title + Status + Next steps) into Claude's context. Advisory, exits 0.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

function extractSection(md, heading) {
    const re = new RegExp('##\\s+' + heading + '[^\\n]*\\n([\\s\\S]*?)(?:\\n##\\s|$)', 'i');
    const m = md.match(re);
    if (!m) return '';
    return m[1].trim().split('\n').slice(0, 4).join(' ').replace(/\s+/g, ' ').slice(0, 300);
}

const dir = path.join(process.cwd(), '.claude', 'progress');
if (!existsSync(dir)) process.exit(0);

let files = [];
try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'));
} catch {
    process.exit(0);
}
if (files.length === 0) process.exit(0);

// Token budget: only the ACTIVE journal (most recently modified) gets Status +
// Next steps; older unfinished journals are listed by name only.
const byMtime = files
    .map((f) => {
        const full = path.join(dir, f);
        try {
            return { f, full, mtime: statSync(full).mtimeMs };
        } catch {
            return null;
        }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);

const blocks = [];
for (const [i, entry] of byMtime.entries()) {
    if (i > 0) {
        blocks.push(`• ${entry.f} (older — details in the file)`);
        continue;
    }
    let content = '';
    try {
        content = readFileSync(entry.full, 'utf8');
    } catch {
        continue;
    }
    const title = (content.match(/^#\s+(.+)$/m) || [])[1] || entry.f;
    const status = extractSection(content, 'Status');
    const next = extractSection(content, 'Next steps');
    blocks.push(
        `• ${entry.f} — ${title} (active)` +
            (status ? `\n  Status: ${status}` : '') +
            (next ? `\n  Next: ${next}` : ''),
    );
}

const body =
    'Unfinished progress journals in .claude/progress/ (resume the work, or run /finish-part when done):\n' +
    blocks.join('\n');
const out = {
    hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: body,
    },
};
process.stdout.write(JSON.stringify(out));
process.exit(0);
