'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { RequireAuth } from '@/components/RequireAuth';
import { PageLoader, ProgressBar } from '@/components/ui';
import { get } from '@/lib/api';
import { PILLAR_COLOR, PILLAR_DOT, type RoadmapDay } from '@/lib/types';

interface TrackResponse {
  track: { title: string; tagline: string };
  days: RoadmapDay[];
  weeks: { week: number; title: string }[];
}

export default function RoadmapPage() {
  return (
    <RequireAuth>
      <RoadmapInner />
    </RequireAuth>
  );
}

function RoadmapInner() {
  const [data, setData] = useState<TrackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<TrackResponse>('/api/tracks/full-stack-30').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (!data) return <PageLoader label="Loading the roadmap" />;

  const totalPct = Math.round(data.days.reduce((n, d) => n + d.progressPct, 0) / data.days.length);

  return (
    <div className="animate-fade-up space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{data.track.title}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{data.track.tagline}</p>
        <div className="mt-4 flex items-center gap-3">
          <ProgressBar value={totalPct} className="max-w-md" />
          <span className="font-mono text-xs text-slate-500">{totalPct}%</span>
        </div>
      </header>

      {data.weeks.map((w) => {
        const days = data.days.filter((d) => d.week === w.week);
        if (!days.length) return null;
        return (
          <section key={w.week}>
            <h2 className="mb-3 flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Week {w.week}
              <span className="text-slate-600">·</span>
              <span className="text-slate-700 dark:text-slate-300">{w.title}</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-ink-800" />
              <span className="font-mono text-xs normal-case text-slate-400 dark:text-slate-600">
                days {days[0].number}–{days[days.length - 1].number}
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {days.map((d) => (
                <DayCard key={d.id} day={d} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DayCard({ day }: { day: RoadmapDay }) {
  const done = day.progressPct === 100;
  return (
    <Link
      href={`/day/${day.number}`}
      className={clsx(
        'card group relative flex flex-col gap-3 p-4 transition-colors hover:border-slate-300 dark:hover:border-ink-600',
        done && 'border-emerald-600/40',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold',
            done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-200 dark:bg-ink-800 text-slate-600 dark:text-slate-400',
          )}
        >
          {done ? '✓' : day.number}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blade dark:group-hover:text-blade-soft">
            {day.title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{day.summary}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className={clsx('chip', PILLAR_COLOR[day.pillar])}>
          <span className={clsx('mr-1.5 h-1.5 w-1.5 rounded-full', PILLAR_DOT[day.pillar])} />
          {day.pillar.toLowerCase()}
        </span>
        {day.technologies.slice(0, 3).map((t) => (
          <span key={t} className="chip border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-850 text-slate-600 dark:text-slate-400">
            {t}
          </span>
        ))}
        {day.technologies.length > 3 && (
          <span className="chip border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-850 text-slate-500">
            +{day.technologies.length - 3}
          </span>
        )}
      </div>

      <div className="mt-auto space-y-2">
        <ProgressBar value={day.progressPct} tone={done ? 'emerald' : 'blade'} />
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span>{day.lessons.length} lessons</span>
          <span>{day.problems.length} problems</span>
          <span>{day.quizCount} quiz</span>
          {day.project && <span className="text-amber-400">project</span>}
          <span className="ml-auto">{Math.round(day.estimatedMinutes / 60)}h</span>
        </div>
      </div>
    </Link>
  );
}
