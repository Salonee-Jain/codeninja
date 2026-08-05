/**
 * Server-side judge. This is the authoritative grader — the browser sandbox
 * gives instant feedback, but XP is only ever awarded from a run that happened
 * here, so a learner cannot fake a pass by patching client-side JS.
 *
 * Four runtimes, matching packages/content/src/types.ts:
 *   javascript → node:vm, learner exports via module.exports, exposed as `solution`
 *   html       → linkedom Document exposed as `doc`, plus a css(sel, prop) shim
 *   sql        → sql.js (SQLite compiled to wasm); assertion is expected-rows JSON
 *   remote     → proxied to a Piston-compatible executor if REMOTE_EXECUTOR_URL is set
 */
import vm from 'node:vm';
import { env } from '../env';
import { createCssShim } from './cssShim';

export interface JudgeTest {
  name: string;
  assertion: string;
  hidden: boolean;
  points: number;
}

export interface JudgeProblem {
  runtime: 'javascript' | 'sql' | 'html' | 'remote';
  language?: string | null;
  sqlSetup?: string | null;
  tests: JudgeTest[];
}

export interface TestResult {
  name: string;
  passed: boolean;
  hidden: boolean;
  message?: string;
  points: number;
}

export interface JudgeResult {
  status: 'PASSED' | 'FAILED' | 'ERROR';
  passedCount: number;
  totalCount: number;
  earnedPoints: number;
  totalPoints: number;
  results: TestResult[];
  runtimeMs: number;
  stderr?: string;
}

/* ------------------------------------------------------------------ helpers */

/**
 * Structural equality that works across V8 realms.
 *
 * `instanceof Date` is false for a Date built inside the vm context, so the type
 * tests go through Object.prototype.toString instead. Getting this wrong makes
 * assertions fail for reasons the learner cannot see or fix.
 */
const tag = (v: unknown) => Object.prototype.toString.call(v);

export function deepEqual(a: unknown, b: unknown): boolean {
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
    (k) =>
      Object.prototype.hasOwnProperty.call(b, k) &&
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
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

/**
 * Host objects injected into the sandbox.
 *
 * Deliberately NOT included: Object, Array, JSON, Map, Set, Promise, Date, and the
 * rest of the JS intrinsics. A vm context already has its own, and injecting the
 * host's would shadow them — so an object literal written inside the sandbox would
 * have the *context's* Object.prototype while the identifier `Object` resolved to
 * the *host's*. Checks like `Object.getPrototypeOf(x) === Object.prototype` would
 * then be false for a plain object, which is both wrong and impossible to debug
 * from the learner's side. Only genuinely-missing host capabilities go in here.
 */
function baseGlobals(logs: string[]) {
  const log = (...args: unknown[]) => {
    if (logs.length < 200) logs.push(args.map((a) => stringify(a)).join(' '));
  };
  return {
    console: { log, info: log, warn: log, error: log, debug: log },
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
  };
}

/**
 * Realm-native extras defined by evaluating source *inside* the context, so the
 * values they produce belong to the sandbox's realm rather than the host's.
 */
const REALM_NATIVE_SETUP = `
  globalThis.structuredClone = globalThis.structuredClone || function (v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  };
`;

function stringify(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

const errored = (
  problem: JudgeProblem,
  message: string,
  runtimeMs: number,
  logs: string[] = [],
): JudgeResult => ({
  status: 'ERROR',
  passedCount: 0,
  totalCount: problem.tests.length,
  earnedPoints: 0,
  totalPoints: problem.tests.reduce((n, t) => n + (t.points || 1), 0),
  results: problem.tests.map((t) => ({
    name: t.name,
    passed: false,
    hidden: t.hidden,
    points: t.points || 1,
    message,
  })),
  runtimeMs,
  stderr: [message, ...logs].join('\n'),
});

function summarise(
  results: TestResult[],
  tests: JudgeTest[],
  runtimeMs: number,
  logs: string[],
): JudgeResult {
  const passedCount = results.filter((r) => r.passed).length;
  const totalPoints = tests.reduce((n, t) => n + (t.points || 1), 0);
  const earnedPoints = results.reduce((n, r) => n + (r.passed ? r.points : 0), 0);
  return {
    status: passedCount === results.length && results.length > 0 ? 'PASSED' : 'FAILED',
    passedCount,
    totalCount: results.length,
    earnedPoints,
    totalPoints,
    results,
    runtimeMs,
    stderr: logs.length ? logs.join('\n') : undefined,
  };
}

/* -------------------------------------------------------------- javascript */

async function judgeJavascript(problem: JudgeProblem, code: string): Promise<JudgeResult> {
  const started = Date.now();
  const logs: string[] = [];
  const moduleObj = { exports: {} as Record<string, unknown> };
  const sandbox: Record<string, unknown> = {
    ...baseGlobals(logs),
    module: moduleObj,
    exports: moduleObj.exports,
    require: () => {
      throw new Error('require() is not available in the sandbox');
    },
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(REALM_NATIVE_SETUP, ctx);

  try {
    vm.runInContext(code, ctx, { timeout: env.JUDGE_TIMEOUT_MS, displayErrors: true });
  } catch (e) {
    return errored(problem, `Your code threw before any test ran: ${(e as Error).message}`, Date.now() - started, logs);
  }

  (ctx as Record<string, unknown>).solution = moduleObj.exports;

  const results: TestResult[] = [];
  for (const t of problem.tests) {
    try {
      const value = await vm.runInContext(`(async () => (${t.assertion}))()`, ctx, {
        timeout: env.JUDGE_TIMEOUT_MS,
      });
      results.push({
        name: t.name,
        passed: value === true,
        hidden: t.hidden,
        points: t.points || 1,
        message: value === true ? undefined : `expected true, got ${stringify(value)}`,
      });
    } catch (e) {
      results.push({
        name: t.name,
        passed: false,
        hidden: t.hidden,
        points: t.points || 1,
        message: (e as Error).message,
      });
    }
  }
  return summarise(results, problem.tests, Date.now() - started, logs);
}

/* -------------------------------------------------------------------- html */

async function judgeHtml(problem: JudgeProblem, code: string): Promise<JudgeResult> {
  const started = Date.now();
  const logs: string[] = [];
  // The API tsconfig has no DOM lib on purpose — linkedom's Document is
  // structurally typed here so the sandbox contract stays explicit.
  interface ParsedDoc {
    querySelector(sel: string): unknown;
    querySelectorAll(sel: string): ArrayLike<{ textContent: string | null }>;
  }
  let document: ParsedDoc;
  try {
    const { parseHTML } = await import('linkedom');
    ({ document } = parseHTML(
      `<!doctype html><html><head></head><body>${code}</body></html>`,
    ) as unknown as { document: ParsedDoc });
  } catch (e) {
    return errored(problem, `Could not parse your markup: ${(e as Error).message}`, Date.now() - started);
  }

  const styleText = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent || '')
    .join('\n');

  const css = createCssShim(document as never, styleText);

  const ctx = vm.createContext({
    ...baseGlobals(logs),
    doc: document,
    document,
    css,
    styleText,
    html: code,
  });

  const results: TestResult[] = [];
  for (const t of problem.tests) {
    try {
      const value = vm.runInContext(`(${t.assertion})`, ctx, { timeout: env.JUDGE_TIMEOUT_MS });
      results.push({
        name: t.name,
        passed: value === true,
        hidden: t.hidden,
        points: t.points || 1,
        message: value === true ? undefined : `expected true, got ${stringify(value)}`,
      });
    } catch (e) {
      results.push({
        name: t.name,
        passed: false,
        hidden: t.hidden,
        points: t.points || 1,
        message: (e as Error).message,
      });
    }
  }
  return summarise(results, problem.tests, Date.now() - started, logs);
}

/* --------------------------------------------------------------------- sql */

let sqlJs: Promise<any> | null = null;
function getSqlJs() {
  if (!sqlJs) {
    sqlJs = import('sql.js').then((m) => (m.default as any)());
  }
  return sqlJs;
}

function normaliseRows(rows: Record<string, unknown>[]) {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

async function judgeSql(problem: JudgeProblem, code: string): Promise<JudgeResult> {
  const started = Date.now();
  let SQL: any;
  try {
    SQL = await getSqlJs();
  } catch (e) {
    return errored(problem, `SQL engine unavailable: ${(e as Error).message}`, Date.now() - started);
  }

  const db = new SQL.Database();
  try {
    if (problem.sqlSetup) db.run(problem.sqlSetup);
  } catch (e) {
    db.close();
    return errored(problem, `Problem setup failed: ${(e as Error).message}`, Date.now() - started);
  }

  const forbidden = /\b(attach|pragma|vacuum)\b/i;
  if (forbidden.test(code)) {
    db.close();
    return errored(problem, 'ATTACH, PRAGMA and VACUUM are not allowed.', Date.now() - started);
  }

  let rows: Record<string, unknown>[] = [];
  try {
    const res = db.exec(code);
    rows = res.length
      ? res[0].values.map((v: unknown[]) =>
          Object.fromEntries(res[0].columns.map((c: string, i: number) => [c, v[i]])),
        )
      : [];
  } catch (e) {
    db.close();
    return errored(problem, `Query error: ${(e as Error).message}`, Date.now() - started);
  }
  db.close();

  const ordered = /order\s+by/i.test(code);
  const results: TestResult[] = problem.tests.map((t) => {
    let expected: Record<string, unknown>[];
    try {
      expected = JSON.parse(t.assertion);
    } catch {
      return {
        name: t.name,
        passed: false,
        hidden: t.hidden,
        points: t.points || 1,
        message: 'Malformed expected result set in the problem definition.',
      };
    }
    const ok = ordered
      ? deepEqual(rows, expected)
      : deepEqual(normaliseRows(rows), normaliseRows(expected));
    return {
      name: t.name,
      passed: ok,
      hidden: t.hidden,
      points: t.points || 1,
      message: ok
        ? undefined
        : `got ${JSON.stringify(rows).slice(0, 400)} — expected ${JSON.stringify(expected).slice(0, 400)}`,
    };
  });

  return summarise(results, problem.tests, Date.now() - started, []);
}

/* ------------------------------------------------------------------ remote */

async function judgeRemote(problem: JudgeProblem, code: string): Promise<JudgeResult> {
  const started = Date.now();
  if (!env.REMOTE_EXECUTOR_URL) {
    return errored(
      problem,
      `Running ${problem.language ?? 'this language'} needs a remote executor. ` +
        'Set REMOTE_EXECUTOR_URL (a Piston-compatible endpoint) in your .env to enable it.',
      Date.now() - started,
    );
  }

  const results: TestResult[] = [];
  for (const t of problem.tests) {
    try {
      const res = await fetch(`${env.REMOTE_EXECUTOR_URL.replace(/\/$/, '')}/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          language: problem.language,
          version: '*',
          files: [{ content: code }],
          stdin: t.name,
          run_timeout: env.JUDGE_TIMEOUT_MS,
        }),
      });
      const data = (await res.json()) as { run?: { stdout?: string; stderr?: string } };
      const stdout = (data.run?.stdout ?? '').trim();
      const passed = stdout === t.assertion.trim();
      results.push({
        name: t.name,
        passed,
        hidden: t.hidden,
        points: t.points || 1,
        message: passed ? undefined : `stdout was ${JSON.stringify(stdout)}, expected ${JSON.stringify(t.assertion.trim())}${data.run?.stderr ? `\n${data.run.stderr}` : ''}`,
      });
    } catch (e) {
      results.push({
        name: t.name,
        passed: false,
        hidden: t.hidden,
        points: t.points || 1,
        message: `Executor error: ${(e as Error).message}`,
      });
    }
  }
  return summarise(results, problem.tests, Date.now() - started, []);
}

/* -------------------------------------------------------------------- main */

export async function judge(problem: JudgeProblem, code: string): Promise<JudgeResult> {
  if (typeof code !== 'string' || !code.trim()) {
    return errored(problem, 'No code submitted.', 0);
  }
  if (code.length > 100_000) {
    return errored(problem, 'Submission too large (100 KB limit).', 0);
  }
  switch (problem.runtime) {
    case 'javascript':
      return judgeJavascript(problem, code);
    case 'html':
      return judgeHtml(problem, code);
    case 'sql':
      return judgeSql(problem, code);
    case 'remote':
      return judgeRemote(problem, code);
    default:
      return errored(problem, `Unknown runtime "${problem.runtime}".`, 0);
  }
}
