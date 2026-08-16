#!/usr/bin/env node
/**
 * Reachability check — which modules under src/ can the shipped bundle reach?
 *
 * Walks static imports, `export … from`, and dynamic `import()` out from
 * src/main.tsx, resolving `@/` and relative specifiers the same way Vite does.
 * Anything it never reaches is dead: it compiles, it lints, its tests run, and
 * no user can ever see it.
 *
 * This exists because the Cove redesign orphaned ~35 components (the whole
 * day/ morning+midday card system and every core/ home card) and nothing
 * noticed for months — barrel files re-exported them, so a naive "is it
 * imported?" grep reported them alive.
 *
 * Advisory: prints a report and exits 0 unless --strict is passed.
 *
 *   node scripts/check-reachability.mjs
 *   node scripts/check-reachability.mjs --strict   # exit 1 if anything is dead
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const ENTRY = path.join(SRC, 'main.tsx');
const EXTS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * Files that are unreachable on purpose and must not be reported.
 * Keep this list short and justified — every entry is a thing no user can see.
 */
const ALLOWED = [
    // Feature barrels: the public API convention. Consumers deep-import, so the
    // barrel itself is often unreferenced. Harmless as long as it only re-exports
    // things that ARE reachable — check that by hand when you touch one.
    /^src\/features\/[^/]+\/index\.ts$/,
    // Ambient type declarations have no runtime import.
    /^src\/vite-env\.d\.ts$/,
    // Two components kept on purpose for features the user wants but that are
    // not designed yet. Both are the ONLY implementation of their flow, so
    // deleting them would mean rewriting from scratch. See the "Deferred by
    // design" section of src/features/tasks/README.md — if that section ever
    // goes away, these entries must go with it.
    //   UrgentScheduleModal — writes parent_todo_id / notes / the Google Calendar columns
    //   AITaskSplitter      — writes subtasks
    /^src\/features\/tasks\/components\/UrgentScheduleModal\.tsx$/,
    /^src\/features\/tasks\/components\/AITaskSplitter\.tsx$/,
];

const norm = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const isTest = (p) => /\.test\.|\/tests?\//.test(norm(p));

function resolveSpec(spec, fromFile) {
    let base;
    if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
    else return null; // bare specifier — node_modules, not ours

    for (const e of EXTS) {
        const p = base + e;
        if (fs.existsSync(p)) return p;
    }
    if (fs.existsSync(base)) {
        const stat = fs.statSync(base);
        if (stat.isDirectory()) {
            for (const e of EXTS) {
                const p = path.join(base, 'index' + e);
                if (fs.existsSync(p)) return p;
            }
        } else if (stat.isFile()) {
            return base;
        }
    }
    return null;
}

const IMPORT_RE =
    /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;

const reached = new Set();
function walk(file) {
    if (reached.has(file)) return;
    reached.add(file);
    let src;
    try {
        src = fs.readFileSync(file, 'utf8');
    } catch {
        return;
    }
    for (const m of src.matchAll(IMPORT_RE)) {
        const resolved = resolveSpec(m[1] || m[2] || m[3], file);
        if (resolved) walk(resolved);
    }
}

function allFiles(dir, acc = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) allFiles(p, acc);
        else if (EXTS.includes(path.extname(p))) acc.push(p);
    }
    return acc;
}

walk(ENTRY);

const dead = allFiles(SRC)
    .filter((f) => !reached.has(f) && !isTest(f))
    .map(norm)
    .filter((f) => !ALLOWED.some((re) => re.test(f)))
    .sort();

if (dead.length === 0) {
    if (!process.argv.includes('--quiet')) {
        console.log(`✓ reachability: all ${reached.size} modules reachable from src/main.tsx`);
    }
    process.exit(0);
}

console.error(
    `⚠️ reachability: ${dead.length} module(s) under src/ cannot be reached from src/main.tsx:`,
);
for (const f of dead) console.error(`  ${f}`);
console.error(
    'Delete them, wire them up, or add a justified entry to ALLOWED in scripts/check-reachability.mjs.',
);

process.exit(process.argv.includes('--strict') ? 1 : 0);
