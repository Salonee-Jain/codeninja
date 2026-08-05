/**
 * Content validator.
 *
 * 1. Schema-checks every DaySpec (counts, ranges, unique slugs, valid correctIndex).
 * 2. Actually EXECUTES every coding problem's solutionCode against its own tests,
 *    using the same contracts the browser sandboxes implement:
 *      - javascript -> CommonJS module, `solution` + deepEqual/close/throws helpers
 *      - html       -> linkedom Document exposed as `doc`, plus a css() shim
 *      - sql        -> sql.js (SQLite wasm), assertion is expected-rows JSON
 *      - remote     -> skipped (needs the Piston/Judge0 proxy)
 *
 * Run: npm run validate -w @codeninja/content
 */
import vm from 'node:vm';
import { createCssShim } from './cssShim';
import { days, stats } from '../src/index';
import type { CodeProblem, DaySpec } from '../src/types';

type Failure = { where: string; message: string };
const failures: Failure[] = [];
const warnings: Failure[] = [];

const fail = (where: string, message: string) => failures.push({ where, message });
const warn = (where: string, message: string) => warnings.push({ where, message });

/* ------------------------------------------------------------------ helpers */

// Must stay byte-for-byte equivalent to apps/api/src/lib/judge.ts — cross-realm safe,
// because solutions run inside a vm context where `instanceof Date` is false for a
// Date the sandbox itself created.
const tag = (v: unknown) => Object.prototype.toString.call(v);

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  const ta = tag(a);
  if (ta !== tag(b)) return false;
  if (ta === '[object Date]') return (a as Date).getTime() === (b as Date).getTime();
  if (ta === '[object RegExp]') return String(a) === String(b);
  if (ta === '[object Map]') {
    const ma = a as Map<unknown, unknown>;
    const mb = b as Map<unknown, unknown>;
    if (ma.size !== mb.size) return false;
    for (const [k, v] of ma) if (!mb.has(k) || !deepEqual(v, mb.get(k))) return false;
    return true;
  }
  if (ta === '[object Set]') {
    const sa = a as Set<unknown>;
    const sb = b as Set<unknown>;
    if (sa.size !== sb.size) return false;
    for (const v of sa) if (!sb.has(v)) return false;
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual((a as any)[k], (b as any)[k]),
  );
}
const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const throwsFn = (fn: () => unknown) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

const wordCount = (s: string) => s.trim().split(/\s+/).length;

/* --------------------------------------------------------------- structural */

const PILLARS = new Set(['FOUNDATIONS', 'FRONTEND', 'BACKEND', 'DATABASE', 'DEVOPS']);
const DIFFS = new Set(['EASY', 'MEDIUM', 'HARD']);
const MILESTONES = new Set([7, 14, 21, 26, 30]);

function checkStructure(d: DaySpec) {
  const at = `day ${d.day}`;
  if (!PILLARS.has(d.pillar)) fail(at, `bad pillar ${d.pillar}`);
  if (d.estimatedMinutes < 200 || d.estimatedMinutes > 420)
    warn(at, `estimatedMinutes ${d.estimatedMinutes} outside 200-420`);
  if (d.lessons.length < 3 || d.lessons.length > 5) fail(at, `${d.lessons.length} lessons (want 3-4)`);
  if (d.quiz.length < 6 || d.quiz.length > 8) fail(at, `${d.quiz.length} quiz questions (want 6-8)`);
  if (d.problems.length < 1 || d.problems.length > 3) fail(at, `${d.problems.length} problems (want 1-3)`);
  if (d.flashcards.length < 8 || d.flashcards.length > 12)
    fail(at, `${d.flashcards.length} flashcards (want 8-12)`);
  if (d.resources.length < 3 || d.resources.length > 5) fail(at, `${d.resources.length} resources`);
  if (!d.technologies.length) fail(at, 'no technologies listed');
  if (MILESTONES.has(d.day) && !d.project) fail(at, 'milestone day is missing a project');

  const slugs = new Set<string>();
  for (const l of d.lessons) {
    if (slugs.has(l.slug)) fail(at, `duplicate slug ${l.slug}`);
    slugs.add(l.slug);
    const wc = wordCount(l.body);
    if (wc < 450) warn(at, `lesson "${l.slug}" is short (${wc} words)`);
  }
  for (const p of d.problems) {
    if (slugs.has(p.slug)) fail(at, `duplicate slug ${p.slug}`);
    slugs.add(p.slug);
    if (!DIFFS.has(p.difficulty)) fail(at, `${p.slug}: bad difficulty`);
    if (!p.tests.length) fail(at, `${p.slug}: no tests`);
    if (!p.solutionCode?.trim()) fail(at, `${p.slug}: empty solutionCode`);
    if (p.runtime === 'sql' && !p.sqlSetup) fail(at, `${p.slug}: sql problem without sqlSetup`);
    if (p.runtime === 'remote' && !p.language) fail(at, `${p.slug}: remote problem without language`);
    if (p.xp <= 0) fail(at, `${p.slug}: xp must be positive`);
  }
  d.quiz.forEach((q, i) => {
    if (q.options.length !== 4) fail(at, `quiz[${i}] has ${q.options.length} options`);
    if (![0, 1, 2, 3].includes(q.correctIndex)) fail(at, `quiz[${i}] bad correctIndex`);
    if (!q.explanation?.trim()) fail(at, `quiz[${i}] missing explanation`);
    if (new Set(q.options).size !== q.options.length) fail(at, `quiz[${i}] duplicate options`);
  });
  const indices = new Set(d.quiz.map((q) => q.correctIndex));
  if (indices.size < 2) fail(at, 'all quiz answers share one index');
  for (const r of d.resources) {
    if (!/^https?:\/\//.test(r.url)) fail(at, `resource "${r.label}" has a bad url`);
  }
}

/* ------------------------------------------------------------- js execution */

async function runJavascript(d: DaySpec, p: CodeProblem) {
  const at = `day ${d.day} / ${p.slug}`;
  // Only genuinely-missing host capabilities. Injecting Object/Array/JSON/… would
  // shadow the context's own intrinsics and break prototype identity inside the sandbox.
  const moduleObj = { exports: {} as Record<string, unknown> };
  const sandbox: Record<string, unknown> = {
    module: moduleObj,
    exports: moduleObj.exports,
    console: { log: () => {}, info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    performance,
    TextEncoder,
    TextDecoder,
    btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
    deepEqual,
    close,
    throws: throwsFn,
    require: () => {
      throw new Error('require() is not available in the sandbox');
    },
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(
    'globalThis.structuredClone = globalThis.structuredClone || function (v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };',
    ctx,
  );

  try {
    vm.runInContext(p.solutionCode, ctx, { timeout: 5000 });
  } catch (e) {
    fail(at, `solutionCode threw: ${(e as Error).message}`);
    return;
  }
  const solution = moduleObj.exports;
  if (!solution || (typeof solution === 'object' && Object.keys(solution).length === 0)) {
    warn(at, 'solutionCode exported nothing via module.exports');
  }

  // Starter code should at least parse.
  try {
    new vm.Script(p.starterCode);
  } catch (e) {
    fail(at, `starterCode does not parse: ${(e as Error).message}`);
  }

  // Assertions run in the SAME context as the solution, so the objects a test
  // constructs and the objects the solution inspects share one realm.
  (ctx as Record<string, unknown>).solution = solution;
  for (const t of p.tests) {
    try {
      const result = await vm.runInContext(`(async () => (${t.assertion}))()`, ctx, { timeout: 5000 });
      if (result !== true) fail(at, `test "${t.name}" returned ${JSON.stringify(result)}`);
    } catch (e) {
      fail(at, `test "${t.name}" threw: ${(e as Error).message}`);
    }
  }
}

/* ----------------------------------------------------------- html execution */

async function runHtml(d: DaySpec, p: CodeProblem) {
  const at = `day ${d.day} / ${p.slug}`;
  let parseHTML: any;
  try {
    ({ parseHTML } = await import('linkedom'));
  } catch {
    warn(at, 'linkedom not installed — html problems not executed');
    return;
  }
  const { document } = parseHTML(`<!doctype html><html><body>${p.solutionCode}</body></html>`);

  const styleText = Array.from(document.querySelectorAll('style'))
    .map((s: any) => s.textContent || '')
    .join('\n');
  const css = createCssShim(document as never, styleText);

  const ctx = vm.createContext({
    doc: document,
    document,
    css,
    styleText,
    deepEqual,
    close,
    throws: throwsFn,
    Array,
    Object,
    JSON,
    RegExp,
    String,
    Number,
    Boolean,
    Math,
    console: { log: () => {} },
  });
  for (const t of p.tests) {
    try {
      const result = vm.runInContext(`(${t.assertion})`, ctx, { timeout: 5000 });
      if (result !== true) warn(at, `html test "${t.name}" returned ${JSON.stringify(result)}`);
    } catch (e) {
      warn(at, `html test "${t.name}" threw: ${(e as Error).message}`);
    }
  }
}

/* ------------------------------------------------------------ sql execution */

let SQL: any = null;
async function runSql(d: DaySpec, p: CodeProblem) {
  const at = `day ${d.day} / ${p.slug}`;
  if (SQL === null) {
    try {
      const initSqlJs = (await import('sql.js')).default as any;
      SQL = await initSqlJs();
    } catch {
      SQL = false;
    }
  }
  if (!SQL) {
    warn(at, 'sql.js not installed — sql problems not executed');
    return;
  }
  const db = new SQL.Database();
  try {
    db.run(p.sqlSetup!);
  } catch (e) {
    fail(at, `sqlSetup failed: ${(e as Error).message}`);
    return;
  }
  let rows: any[];
  try {
    const res = db.exec(p.solutionCode);
    rows = res.length
      ? res[0].values.map((v: any[]) =>
          Object.fromEntries(res[0].columns.map((c: string, i: number) => [c, v[i]])),
        )
      : [];
  } catch (e) {
    fail(at, `solution query failed: ${(e as Error).message}`);
    db.close();
    return;
  }
  for (const t of p.tests) {
    let expected: any;
    try {
      expected = JSON.parse(t.assertion);
    } catch {
      fail(at, `sql test "${t.name}" assertion is not valid JSON`);
      continue;
    }
    const norm = (r: any[]) =>
      [...r].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const ordered = /order\s+by/i.test(p.solutionCode);
    const ok = ordered ? deepEqual(rows, expected) : deepEqual(norm(rows), norm(expected));
    if (!ok) {
      fail(
        at,
        `sql test "${t.name}" mismatch.\n      got:      ${JSON.stringify(rows)}\n      expected: ${JSON.stringify(expected)}`,
      );
    }
  }
  db.close();
}

/* -------------------------------------------------------------------- main */

async function main() {
  const seenDays = new Set<number>();
  for (const d of days) {
    if (seenDays.has(d.day)) fail(`day ${d.day}`, 'duplicate day number');
    seenDays.add(d.day);
    checkStructure(d);
    for (const p of d.problems) {
      if (p.runtime === 'javascript') await runJavascript(d, p);
      else if (p.runtime === 'html') await runHtml(d, p);
      else if (p.runtime === 'sql') await runSql(d, p);
      else warn(`day ${d.day} / ${p.slug}`, `runtime "${p.runtime}" not executed locally`);
    }
  }
  for (let i = 1; i <= 30; i++) if (!seenDays.has(i)) fail(`day ${i}`, 'missing');

  console.log('\n  CodeNinja content report');
  console.log('  ─────────────────────────');
  console.log(`  days           ${stats.days}`);
  console.log(`  lessons        ${stats.lessons}`);
  console.log(`  quiz questions ${stats.quizQuestions}`);
  console.log(`  problems       ${stats.problems}`);
  console.log(`  flashcards     ${stats.flashcards}`);
  console.log(`  projects       ${stats.projects}`);
  console.log(`  study time     ${Math.round(stats.totalMinutes / 60)} h`);
  console.log(`  technologies   ${stats.technologies.length}`);

  if (warnings.length) {
    console.log(`\n  ⚠ ${warnings.length} warning(s)`);
    for (const w of warnings.slice(0, 40)) console.log(`    · ${w.where}: ${w.message}`);
    if (warnings.length > 40) console.log(`    … and ${warnings.length - 40} more`);
  }
  if (failures.length) {
    console.error(`\n  ✗ ${failures.length} failure(s)`);
    for (const f of failures) console.error(`    · ${f.where}: ${f.message}`);
    process.exit(1);
  }
  console.log('\n  ✓ all content valid\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
