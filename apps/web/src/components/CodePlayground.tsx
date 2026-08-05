'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import clsx from 'clsx';
import { get, post } from '@/lib/api';
import { runHtmlInBrowser, runJavascriptInBrowser } from '@/lib/sandbox';
import { DIFFICULTY_COLOR, type JudgeResult, type Problem } from '@/lib/types';
import { Markdown } from './Markdown';
import { Alert, Spinner } from './ui';

const Editor = dynamic(() => import('./Editor').then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-slate-500">Loading editor…</div>
  ),
});

const LANGUAGE: Record<string, string> = {
  javascript: 'javascript',
  html: 'html',
  sql: 'sql',
  python: 'python',
  go: 'go',
  java: 'java',
  php: 'php',
};

function storageKey(problemId: string) {
  return `cn_code_${problemId}`;
}

export function CodePlayground({
  problem,
  onSolved,
}: {
  problem: Problem;
  onSolved?: (xp: number) => void;
}) {
  const [code, setCode] = useState(problem.lastCode ?? problem.starterCode);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [running, setRunning] = useState<false | 'run' | 'submit'>(false);
  const [tab, setTab] = useState<'tests' | 'preview' | 'hints' | 'solution'>('tests');
  const [hintsShown, setHintsShown] = useState(0);
  const [solution, setSolution] = useState<string | null>(null);
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(problem.solved);
  const savedRef = useRef<number | undefined>(undefined);

  const language = LANGUAGE[problem.language ?? problem.runtime] ?? 'javascript';

  useEffect(() => {
    const draft = window.localStorage.getItem(storageKey(problem.id));
    if (draft) setCode(draft);
  }, [problem.id]);

  useEffect(() => {
    window.clearTimeout(savedRef.current);
    savedRef.current = window.setTimeout(() => {
      window.localStorage.setItem(storageKey(problem.id), code);
    }, 600);
    return () => window.clearTimeout(savedRef.current);
  }, [code, problem.id]);

  const visibleTests = useMemo(
    () => problem.visibleTests.map((t) => ({ name: t.name, assertion: t.assertion, points: t.points })),
    [problem.visibleTests],
  );

  const run = useCallback(async () => {
    setRunning('run');
    setTab(problem.runtime === 'html' ? 'preview' : 'tests');
    try {
      if (problem.runtime === 'javascript') {
        setResult(await runJavascriptInBrowser(code, visibleTests));
      } else if (problem.runtime === 'html') {
        setResult(runHtmlInBrowser(code, visibleTests));
        setTab('tests');
      } else {
        setResult(await post<JudgeResult>(`/api/learn/problems/${problem.id}/run`, { code }));
      }
    } catch (e) {
      setResult({
        status: 'ERROR',
        passedCount: 0,
        totalCount: visibleTests.length,
        results: [],
        runtimeMs: 0,
        stderr: (e as Error).message,
      });
    } finally {
      setRunning(false);
    }
  }, [code, problem.id, problem.runtime, visibleTests]);

  const submit = useCallback(async () => {
    setRunning('submit');
    setTab('tests');
    try {
      const res = await post<JudgeResult>(`/api/learn/problems/${problem.id}/submit`, { code });
      setResult(res);
      setAttempts((a) => a + 1);
      if (res.status === 'PASSED') {
        setSolved(true);
        if (res.xpAwarded) onSolved?.(res.xpAwarded);
      }
    } catch (e) {
      setResult({
        status: 'ERROR',
        passedCount: 0,
        totalCount: problem.testCount,
        results: [],
        runtimeMs: 0,
        stderr: (e as Error).message,
      });
    } finally {
      setRunning(false);
    }
  }, [code, onSolved, problem.id, problem.testCount]);

  const loadSolution = useCallback(async () => {
    setSolutionError(null);
    try {
      const data = await get<{ solutionCode: string }>(`/api/learn/problems/${problem.id}/solution`);
      setSolution(data.solutionCode);
    } catch (e) {
      setSolutionError((e as Error).message);
    }
  }, [problem.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void (e.shiftKey ? submit() : run());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, submit]);

  const previewSrc =
    problem.runtime === 'html'
      ? `<!doctype html><html><head><meta charset="utf-8">
         <style>body{font-family:system-ui,sans-serif;color:#e2e8f0;background:#0f1219;padding:16px}
         a{color:#60a5fa} button{cursor:pointer}</style></head><body>${code}</body></html>`
      : '';

  return (
    <div className="grid h-[calc(100vh-11rem)] min-h-[560px] grid-cols-1 gap-4 lg:grid-cols-[minmax(340px,38%)_1fr]">
      {/* ── statement ─────────────────────────────────────────────── */}
      <section className="card flex min-h-0 flex-col overflow-hidden">
        <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-ink-700">
          <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{problem.title}</h2>
          <span className={clsx('chip', DIFFICULTY_COLOR[problem.difficulty])}>
            {problem.difficulty.toLowerCase()}
          </span>
          {solved && (
            <span className="chip border-emerald-500/40 bg-emerald-500/10 text-emerald-400">solved</span>
          )}
          <span className="ml-auto text-xs text-slate-500">+{problem.xp} XP</span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <Markdown>{problem.statement}</Markdown>
          {problem.sqlSetup && (
            <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-ink-700 dark:bg-ink-850">
              <summary className="cursor-pointer text-xs font-medium text-slate-600 dark:text-slate-300">
                Schema &amp; sample data
              </summary>
              <pre className="mt-2 overflow-x-auto text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                {problem.sqlSetup}
              </pre>
            </details>
          )}
        </div>
      </section>

      {/* ── editor + results ──────────────────────────────────────── */}
      <section className="flex min-h-0 flex-col gap-3">
        <div className="card min-h-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-ink-700">
            <span className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
              {problem.language ?? problem.runtime}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => {
                  setCode(problem.starterCode);
                  setResult(null);
                }}
                className="btn-ghost !px-2.5 !py-1 text-xs"
              >
                Reset
              </button>
              <button onClick={() => void run()} disabled={!!running} className="btn-ghost !px-3 !py-1 text-xs">
                {running === 'run' ? <Spinner /> : '▷'} Run
                <kbd className="ml-1 hidden text-[10px] text-slate-500 sm:inline">⌘⏎</kbd>
              </button>
              <button onClick={() => void submit()} disabled={!!running} className="btn-primary !px-3 !py-1 text-xs">
                {running === 'submit' ? <Spinner /> : '✓'} Submit
              </button>
            </div>
          </div>
          <div className="h-[calc(100%-2.5rem)]">
            <Editor language={language} value={code} onChange={setCode} />
          </div>
        </div>

        <div className="card flex h-[38%] min-h-[190px] flex-col overflow-hidden">
          <div className="flex items-center gap-1 border-b border-slate-200 px-2 dark:border-ink-700">
            {(['tests', problem.runtime === 'html' ? 'preview' : null, 'hints', 'solution'].filter(
              Boolean,
            ) as ('tests' | 'preview' | 'hints' | 'solution')[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  if (t === 'solution' && !solution) void loadSolution();
                }}
                className={clsx(
                  'border-b-2 px-3 py-2 text-xs capitalize transition-colors',
                  tab === t
                    ? 'border-blade text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300',
                )}
              >
                {t}
                {t === 'tests' && result ? (
                  <span
                    className={clsx(
                      'ml-1.5 font-mono',
                      result.status === 'PASSED' ? 'text-emerald-400' : 'text-rose-400',
                    )}
                  >
                    {result.passedCount}/{result.totalCount}
                  </span>
                ) : null}
              </button>
            ))}
            {result && (
              <span className="ml-auto pr-3 text-[11px] text-slate-400 dark:text-slate-600">
                {result.dryRun ? 'sample tests' : 'all tests'} · {result.runtimeMs}ms
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === 'tests' && (
              <TestPanel result={result} testCount={problem.testCount} visible={problem.visibleTests.length} />
            )}

            {tab === 'preview' && (
              <iframe
                title="Preview"
                sandbox="allow-scripts"
                srcDoc={previewSrc}
                className="h-full min-h-[160px] w-full rounded-md border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-950"
              />
            )}

            {tab === 'hints' && (
              <div className="space-y-2">
                {problem.hints.slice(0, hintsShown).map((h, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-ink-700 dark:bg-ink-850 dark:text-slate-300">
                    <span className="mr-2 font-mono text-xs text-slate-400 dark:text-slate-500">{i + 1}</span>
                    {h}
                  </div>
                ))}
                {hintsShown < problem.hints.length ? (
                  <button onClick={() => setHintsShown((n) => n + 1)} className="btn-ghost !py-1.5 text-xs">
                    Reveal hint {hintsShown + 1} of {problem.hints.length}
                  </button>
                ) : (
                  <p className="text-xs text-slate-500">That&apos;s every hint for this one.</p>
                )}
              </div>
            )}

            {tab === 'solution' && (
              <div className="space-y-2">
                {solution ? (
                  <>
                    <Markdown>{`\`\`\`${language}\n${solution}\n\`\`\``}</Markdown>
                    <button
                      onClick={() => setCode(solution)}
                      className="btn-ghost !py-1.5 text-xs"
                    >
                      Load into editor
                    </button>
                  </>
                ) : solutionError ? (
                  <Alert kind="info">
                    {solutionError} ({attempts} attempt{attempts === 1 ? '' : 's'} this session)
                  </Alert>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Spinner /> Checking whether the solution is unlocked…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function TestPanel({
  result,
  testCount,
  visible,
}: {
  result: JudgeResult | null;
  testCount: number;
  visible: number;
}) {
  if (!result) {
    return (
      <p className="text-sm text-slate-500">
        Press <span className="font-mono text-slate-600 dark:text-slate-400">Run</span> to check against the {visible} sample
        test{visible === 1 ? '' : 's'}, or <span className="font-mono text-slate-600 dark:text-slate-400">Submit</span> to run
        all {testCount} and bank the XP.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {result.status === 'ERROR' && result.results.length === 0 && (
        <Alert kind="error">{result.stderr ?? 'Something went wrong.'}</Alert>
      )}
      {result.results.map((r, i) => (
        <div
          key={i}
          className={clsx(
            'rounded-lg border px-3 py-2 text-sm',
            r.passed
              ? 'border-emerald-500/30 bg-emerald-500/[.06]'
              : 'border-rose-500/30 bg-rose-500/[.06]',
          )}
        >
          <div className="flex items-center gap-2">
            <span className={r.passed ? 'text-emerald-400' : 'text-rose-400'}>{r.passed ? '✓' : '✕'}</span>
            <span className="text-slate-700 dark:text-slate-200">{r.name}</span>
            {r.hidden && <span className="chip border-slate-200 bg-slate-50 text-slate-500 dark:border-ink-600 dark:bg-ink-850">hidden</span>}
          </div>
          {!r.passed && r.message && (
            <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words pl-6 font-mono text-[11px] leading-5 text-rose-300/80">
              {r.message}
            </pre>
          )}
        </div>
      ))}
      {result.stderr && result.results.length > 0 && (
        <details className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-ink-700 dark:bg-ink-850">
          <summary className="cursor-pointer text-xs text-slate-500 dark:text-slate-400">console output</summary>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {result.stderr}
          </pre>
        </details>
      )}
      {result.status === 'PASSED' && !result.dryRun && (
        <Alert kind="success">
          All {result.totalCount} tests pass.{' '}
          {result.xpAwarded ? `+${result.xpAwarded} XP banked.` : 'Already solved — no extra XP.'}
        </Alert>
      )}
      {result.status === 'PASSED' && result.dryRun && (
        <Alert kind="info">Sample tests pass. Hit Submit to run the hidden tests and bank the XP.</Alert>
      )}
    </div>
  );
}
