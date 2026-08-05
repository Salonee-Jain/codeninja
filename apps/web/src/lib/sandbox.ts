'use client';

import { createCssShim } from './cssShim';
import type { JudgeResult, TestResult } from './types';

/**
 * Instant-feedback sandbox.
 *
 * `Run` grades in the browser where it safely can — JavaScript in a Web Worker
 * (terminated on timeout so an infinite loop can't lock the tab) and HTML via
 * DOMParser. SQL and remote languages round-trip to the API.
 *
 * `Submit` ALWAYS goes to the API. The server judge is the only source of truth
 * for XP, so nothing here can be gamed from devtools.
 */

export interface SandboxTest {
  name: string;
  assertion: string;
  points?: number;
}

const WORKER_SOURCE = `
// Kept structurally identical to the server judge so Run and Submit never disagree.
function tag(v) { return Object.prototype.toString.call(v); }
function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  var ta = tag(a);
  if (ta !== tag(b)) return false;
  if (ta === '[object Date]') return a.getTime() === b.getTime();
  if (ta === '[object RegExp]') return String(a) === String(b);
  if (ta === '[object Map]') {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
    return true;
  }
  if (ta === '[object Set]') {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(function (k) {
    return Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]);
  });
}
function close(a, b, eps) { return Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps); }
function throws(fn) { try { fn(); return false; } catch (e) { return true; } }

var __logs = [];
var __console = {
  log: function () { if (__logs.length < 200) __logs.push(Array.prototype.slice.call(arguments).map(fmt).join(' ')); }
};
__console.info = __console.warn = __console.error = __console.debug = __console.log;
function fmt(v) {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}

self.onmessage = async function (e) {
  var code = e.data.code, tests = e.data.tests;
  var module = { exports: {} };
  var results = [];
  var started = Date.now();
  try {
    var run = new Function('module', 'exports', 'console', 'deepEqual', 'close', 'throws', code);
    run(module, module.exports, __console, deepEqual, close, throws);
  } catch (err) {
    self.postMessage({ fatal: 'Your code threw before any test ran: ' + err.message, logs: __logs });
    return;
  }
  var solution = module.exports;
  for (var i = 0; i < tests.length; i++) {
    var t = tests[i];
    try {
      var fn = new Function('solution', 'deepEqual', 'close', 'throws', 'console',
        'return (async () => (' + t.assertion + '))()');
      var value = await fn(solution, deepEqual, close, throws, __console);
      results.push({
        name: t.name, passed: value === true, hidden: false, points: t.points || 1,
        message: value === true ? undefined : 'expected true, got ' + fmt(value)
      });
    } catch (err) {
      results.push({ name: t.name, passed: false, hidden: false, points: t.points || 1, message: err.message });
    }
  }
  self.postMessage({ results: results, runtimeMs: Date.now() - started, logs: __logs });
};
`;

export function runJavascriptInBrowser(
  code: string,
  tests: SandboxTest[],
  timeoutMs = 6000,
): Promise<JudgeResult> {
  return new Promise((resolve) => {
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    const finish = (result: JudgeResult) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        status: 'ERROR',
        passedCount: 0,
        totalCount: tests.length,
        results: tests.map((t) => ({
          name: t.name,
          passed: false,
          hidden: false,
          points: t.points ?? 1,
          message: 'Timed out — is there an infinite loop?',
        })),
        runtimeMs: timeoutMs,
        stderr: `Execution exceeded ${timeoutMs}ms and was terminated.`,
        dryRun: true,
      });
    }, timeoutMs);

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data as {
        fatal?: string;
        results?: TestResult[];
        runtimeMs?: number;
        logs?: string[];
      };
      if (data.fatal) {
        finish({
          status: 'ERROR',
          passedCount: 0,
          totalCount: tests.length,
          results: tests.map((t) => ({
            name: t.name,
            passed: false,
            hidden: false,
            points: t.points ?? 1,
            message: data.fatal,
          })),
          runtimeMs: 0,
          stderr: [data.fatal, ...(data.logs ?? [])].join('\n'),
          dryRun: true,
        });
        return;
      }
      const results = data.results ?? [];
      finish({
        status: results.length && results.every((r) => r.passed) ? 'PASSED' : 'FAILED',
        passedCount: results.filter((r) => r.passed).length,
        totalCount: results.length,
        results,
        runtimeMs: data.runtimeMs ?? 0,
        stderr: data.logs?.length ? data.logs.join('\n') : undefined,
        dryRun: true,
      });
    };

    worker.onerror = (err) => {
      finish({
        status: 'ERROR',
        passedCount: 0,
        totalCount: tests.length,
        results: tests.map((t) => ({
          name: t.name,
          passed: false,
          hidden: false,
          points: t.points ?? 1,
          message: err.message,
        })),
        runtimeMs: 0,
        stderr: err.message,
        dryRun: true,
      });
    };

    worker.postMessage({ code, tests });
  });
}

export function runHtmlInBrowser(code: string, tests: SandboxTest[]): JudgeResult {
  const started = Date.now();
  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><head></head><body>${code}</body></html>`,
    'text/html',
  );
  const styleText = Array.from(doc.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n');

  const css = createCssShim(doc as never, styleText);

  const results: TestResult[] = tests.map((t) => {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('doc', 'document', 'css', 'styleText', `return (${t.assertion});`);
      const value = fn(doc, doc, css, styleText);
      return {
        name: t.name,
        passed: value === true,
        hidden: false,
        points: t.points ?? 1,
        message: value === true ? undefined : `expected true, got ${JSON.stringify(value)}`,
      };
    } catch (e) {
      return {
        name: t.name,
        passed: false,
        hidden: false,
        points: t.points ?? 1,
        message: (e as Error).message,
      };
    }
  });

  return {
    status: results.length && results.every((r) => r.passed) ? 'PASSED' : 'FAILED',
    passedCount: results.filter((r) => r.passed).length,
    totalCount: results.length,
    results,
    runtimeMs: Date.now() - started,
    dryRun: true,
  };
}
