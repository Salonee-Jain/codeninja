'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import clsx from 'clsx';
import { RequireAuth } from '@/components/RequireAuth';
import { PageLoader, ProgressBar } from '@/components/ui';
import { useDay } from '@/lib/useDay';
import { DIFFICULTY_COLOR, PILLAR_COLOR, PILLAR_DOT } from '@/lib/types';

export default function DayPage() {
  return (
    <RequireAuth>
      <DayInner />
    </RequireAuth>
  );
}

function DayInner() {
  const params = useParams<{ number: string }>();
  const n = Number(params.number);
  const { day, loading, error } = useDay(params.number);

  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (loading || !day) return <PageLoader label={`Loading day ${n}`} />;

  const lessonsDone = day.lessons.filter((l) => l.completed).length;
  const problemsDone = day.problems.filter((p) => p.solved).length;
  const units = day.lessons.length + day.problems.length + (day.quizCount ? 1 : 0);
  const done = lessonsDone + problemsDone + (day.quizAttempt?.passed ? 1 : 0);
  const pct = units ? Math.round((done / units) * 100) : 0;

  return (
    <div className="animate-fade-up space-y-6">
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/roadmap" className="hover:text-slate-700 dark:hover:text-slate-300">
          Roadmap
        </Link>
        <span>/</span>
        <span className="text-slate-600 dark:text-slate-400">Week {day.week}</span>
        <span>/</span>
        <span className="text-slate-700 dark:text-slate-300">Day {day.number}</span>
        <div className="ml-auto flex gap-2">
          {n > 1 && (
            <Link href={`/day/${n - 1}`} className="btn-ghost !px-2.5 !py-1 text-xs">
              ← Day {n - 1}
            </Link>
          )}
          {n < 30 && (
            <Link href={`/day/${n + 1}`} className="btn-ghost !px-2.5 !py-1 text-xs">
              Day {n + 1} →
            </Link>
          )}
        </div>
      </nav>

      <header className="card p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-slate-200 dark:bg-ink-800 text-xl font-bold text-slate-700 dark:text-slate-300">
            {day.number}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{day.title}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{day.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className={clsx('chip', PILLAR_COLOR[day.pillar])}>
                <span className={clsx('mr-1.5 h-1.5 w-1.5 rounded-full', PILLAR_DOT[day.pillar])} />
                {day.pillar.toLowerCase()}
              </span>
              {day.technologies.map((t) => (
                <span key={t} className="chip border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-850 text-slate-600 dark:text-slate-400">
                  {t}
                </span>
              ))}
              <span className="chip border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-850 text-slate-500">
                ~{Math.round(day.estimatedMinutes / 60)}h
              </span>
            </div>
          </div>
          <div className="w-full sm:w-48">
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Progress</span>
              <span className="font-mono text-slate-500">{pct}%</span>
            </div>
            <ProgressBar value={pct} tone={pct === 100 ? 'emerald' : 'blade'} />
          </div>
        </div>

        {day.objectives.length > 0 && (
          <div className="mt-5 border-t border-slate-200 dark:border-ink-800 pt-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              By the end of today you can
            </h2>
            <ul className="grid gap-1.5 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-2">
              {day.objectives.map((o) => (
                <li key={o} className="flex gap-2">
                  <span className="text-blade">▸</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Lessons</h2>
          <ol className="space-y-2">
            {day.lessons.map((l, i) => (
              <li key={l.id}>
                <Link
                  href={`/day/${n}/lesson/${l.slug}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-850 px-3 py-2.5 transition-colors hover:border-slate-300 dark:hover:border-ink-600"
                >
                  <span
                    className={clsx(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-semibold',
                      l.completed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-200 dark:bg-ink-800 text-slate-500',
                    )}
                  >
                    {l.completed ? '✓' : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-200">{l.title}</span>
                  <span className="text-xs text-slate-500">{l.estimatedMinutes}m</span>
                </Link>
              </li>
            ))}
          </ol>

          <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900 dark:text-white">Practice</h2>
          <ul className="space-y-2">
            {day.problems.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/day/${n}/practice/${p.slug}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-850 px-3 py-2.5 transition-colors hover:border-slate-300 dark:hover:border-ink-600"
                >
                  <span
                    className={clsx(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs',
                      p.solved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-200 dark:bg-ink-800 text-slate-500',
                    )}
                  >
                    {p.solved ? '✓' : '⌨'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-200">{p.title}</span>
                  <span className={clsx('chip', DIFFICULTY_COLOR[p.difficulty])}>
                    {p.difficulty.toLowerCase()}
                  </span>
                  <span className="w-14 text-right text-xs text-slate-500">+{p.xp} XP</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Link
              href={`/day/${n}/quiz`}
              className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-850 px-3 py-3 transition-colors hover:border-slate-300 dark:hover:border-ink-600"
            >
              <span className="text-lg">🧠</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-800 dark:text-slate-200">Day quiz</div>
                <div className="text-xs text-slate-500">
                  {day.quizCount} questions · 70% to pass
                  {day.quizAttempt && ` · best ${day.quizAttempt.score}/${day.quizAttempt.total}`}
                </div>
              </div>
              {day.quizAttempt?.passed && <span className="text-emerald-400">✓</span>}
            </Link>

            {day.project ? (
              <Link
                href={`/day/${n}/project`}
                className="flex items-center gap-3 rounded-lg border border-amber-600/30 bg-amber-500/[.06] px-3 py-3 transition-colors hover:border-amber-500/50"
              >
                <span className="text-lg">🏗</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-amber-200">{day.project.title}</div>
                  <div className="text-xs text-amber-500/70">
                    Milestone project · ~{day.project.estimatedHours}h
                  </div>
                </div>
              </Link>
            ) : (
              <Link
                href="/review"
                className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-850 px-3 py-3 transition-colors hover:border-slate-300 dark:hover:border-ink-600"
              >
                <span className="text-lg">🎴</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-800 dark:text-slate-200">Flashcards</div>
                  <div className="text-xs text-slate-500">
                    {day.flashcards.length} cards from today
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Today&apos;s flashcards</h2>
            <ul className="space-y-2 text-sm">
              {day.flashcards.slice(0, 6).map((f) => (
                <li key={f.id} className="rounded-lg border border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-850 px-3 py-2 text-slate-700 dark:text-slate-300">
                  {f.front}
                </li>
              ))}
            </ul>
            <Link href="/review" className="btn-ghost mt-3 w-full !py-1.5 text-xs">
              Review all {day.flashcards.length} →
            </Link>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Further reading</h2>
            <ul className="space-y-2 text-sm">
              {day.resources.map((r) => (
                <li key={r.id}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-start gap-2 text-slate-600 dark:text-slate-400 hover:text-blade dark:hover:text-blade-soft"
                  >
                    <span className="mt-0.5 shrink-0 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-600">
                      {r.kind}
                    </span>
                    <span className="leading-snug">{r.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
