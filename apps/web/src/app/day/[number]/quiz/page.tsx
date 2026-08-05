'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { RequireAuth } from '@/components/RequireAuth';
import { Alert, PageLoader, ProgressBar, Ring, Spinner } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { useAuth } from '@/components/AuthProvider';
import { get, post } from '@/lib/api';

interface Question {
  id: string;
  prompt: string;
  options: string[];
  difficulty: string;
}
interface QuizData {
  dayId: string;
  dayNumber: number;
  title: string;
  questions: Question[];
}
interface Review {
  questionId: string;
  selectedIndex: number;
  correctIndex: number;
  correct: boolean;
  explanation: string;
}
interface Result {
  score: number;
  total: number;
  pct: number;
  passed: boolean;
  passMark: number;
  xpAwarded: number;
  review: Review[];
}

export default function QuizPage() {
  return (
    <RequireAuth>
      <QuizInner />
    </RequireAuth>
  );
}

function QuizInner() {
  const params = useParams<{ number: string }>();
  const { refreshUser } = useAuth();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<QuizData>(`/api/tracks/full-stack-30/days/${params.number}/quiz`)
      .then(setQuiz)
      .catch((e) => setError(e.message));
  }, [params.number]);

  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (!quiz) return <PageLoader label="Loading quiz" />;

  const q = quiz.questions[current];
  const answeredCount = Object.keys(answers).length;

  async function submit() {
    setBusy(true);
    try {
      const res = await post<Result>(`/api/learn/days/${quiz!.dayId}/quiz/submit`, {
        answers: Object.entries(answers).map(([questionId, selectedIndex]) => ({
          questionId,
          selectedIndex,
        })),
      });
      setResult(res);
      await refreshUser();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const byQuestion = new Map(result.review.map((r) => [r.questionId, r]));
    return (
      <div className="animate-fade-up mx-auto max-w-3xl space-y-6">
        <div className="card flex flex-wrap items-center gap-6 p-6">
          <Ring value={result.pct} size={92} label={`${result.pct}%`} sub={`${result.score}/${result.total}`} />
          <div className="min-w-0 flex-1">
            <h1 className={clsx('text-xl font-bold', result.passed ? 'text-emerald-400' : 'text-amber-400')}>
              {result.passed ? 'Passed' : 'Not yet'}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {result.passed
                ? `You cleared the ${result.passMark}% gate for day ${quiz.dayNumber}.`
                : `You need ${result.passMark}% to pass. Review the explanations and try again.`}
              {result.xpAwarded > 0 && ` +${result.xpAwarded} XP.`}
            </p>
            <div className="mt-4 flex gap-2">
              <Link href={`/day/${params.number}`} className="btn-ghost !py-1.5 text-xs">
                Back to day {params.number}
              </Link>
              <button
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                  setCurrent(0);
                }}
                className="btn-primary !py-1.5 text-xs"
              >
                Retake
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {quiz.questions.map((question, i) => {
            const r = byQuestion.get(question.id);
            return (
              <div
                key={question.id}
                className={clsx(
                  'card p-5',
                  r?.correct ? 'border-emerald-600/30' : 'border-rose-600/30',
                )}
              >
                <div className="mb-3 flex gap-3">
                  <span className="font-mono text-xs text-slate-600">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <Markdown>{question.prompt}</Markdown>
                  </div>
                  <span className={r?.correct ? 'text-emerald-400' : 'text-rose-400'}>
                    {r?.correct ? '✓' : '✕'}
                  </span>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {question.options.map((opt, oi) => (
                    <li
                      key={oi}
                      className={clsx(
                        'rounded-lg border px-3 py-2',
                        oi === r?.correctIndex
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                          : oi === r?.selectedIndex
                            ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200'
                            : 'border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-850 text-slate-600 dark:text-slate-400',
                      )}
                    >
                      {opt}
                    </li>
                  ))}
                </ul>
                {r && (
                  <div className="mt-3 rounded-lg border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-850 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                    <Markdown>{r.explanation}</Markdown>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up mx-auto max-w-3xl space-y-5">
      <header>
        <nav className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <Link href={`/day/${params.number}`} className="hover:text-slate-700 dark:hover:text-slate-300">
            Day {quiz.dayNumber} · {quiz.title}
          </Link>
          <span className="ml-auto font-mono">
            {answeredCount}/{quiz.questions.length} answered
          </span>
        </nav>
        <ProgressBar value={(answeredCount / quiz.questions.length) * 100} />
      </header>

      <div className="card p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-xs text-slate-600">
            Q{current + 1} of {quiz.questions.length}
          </span>
          <span className="chip border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-850 text-slate-500">
            {q.difficulty.toLowerCase()}
          </span>
        </div>
        <div className="text-base font-medium text-slate-900 dark:text-white">
          <Markdown>{q.prompt}</Markdown>
        </div>
        <ul className="mt-5 space-y-2">
          {q.options.map((opt, i) => {
            const selected = answers[q.id] === i;
            return (
              <li key={i}>
                <button
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                  className={clsx(
                    'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                    selected
                      ? 'border-blade bg-blade/10 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-850 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-ink-600',
                  )}
                >
                  <span
                    className={clsx(
                      'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold',
                      selected ? 'border-blade bg-blade text-slate-900 dark:text-white' : 'border-slate-300 dark:border-ink-600 text-slate-500',
                    )}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="btn-ghost"
        >
          ← Previous
        </button>
        {current < quiz.questions.length - 1 ? (
          <button onClick={() => setCurrent((c) => c + 1)} className="btn-ghost">
            Next →
          </button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {answeredCount < quiz.questions.length && (
            <span className="text-xs text-slate-500">
              {quiz.questions.length - answeredCount} unanswered
            </span>
          )}
          <button onClick={() => void submit()} disabled={busy || answeredCount === 0} className="btn-primary">
            {busy && <Spinner />} Submit quiz
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {quiz.questions.map((question, i) => (
          <button
            key={question.id}
            onClick={() => setCurrent(i)}
            className={clsx(
              'h-7 w-7 rounded-md text-xs font-medium transition-colors',
              i === current
                ? 'bg-blade text-slate-900 dark:text-white'
                : answers[question.id] !== undefined
                  ? 'bg-slate-200 dark:bg-ink-700 text-slate-800 dark:text-slate-200'
                  : 'bg-slate-50 dark:bg-ink-850 text-slate-500 hover:bg-slate-200 dark:hover:bg-ink-800',
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {answeredCount === 0 && <Alert kind="info">Answer at least one question to submit.</Alert>}
    </div>
  );
}
