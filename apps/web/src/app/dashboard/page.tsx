'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { RequireAuth } from '@/components/RequireAuth';
import { PageLoader, ProgressBar, Ring } from '@/components/ui';
import { get } from '@/lib/api';
import type { Dashboard } from '@/lib/types';

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}

function DashboardInner() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<Dashboard>('/api/learn/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (!data) return <PageLoader label="Loading your progress" />;

  const { user, today, totals, nextDay, heatmap } = data;
  const overall = Math.round(
    ((totals.lessons.done + totals.problems.done + totals.quizzes.done) /
      Math.max(1, totals.lessons.total + totals.problems.total + totals.quizzes.total)) *
      100,
  );

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {nextDay ? (
              <>
                Up next — <span className="text-slate-800 dark:text-slate-200">Day {nextDay.number}: {nextDay.title}</span>
              </>
            ) : (
              'You have finished the whole track. Go build something.'
            )}
          </p>
        </div>
        {nextDay && (
          <Link href={`/day/${nextDay.number}`} className="btn-primary">
            Continue day {nextDay.number} →
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Today's goal">
          <div className="flex items-center gap-4">
            <Ring value={today.goalPct} label={`${today.minutes}m`} sub={`of ${today.goalMinutes}m`} />
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <div className="text-slate-900 dark:text-white">{today.xp} XP today</div>
              <div className="mt-1 text-xs">
                {today.goalPct >= 100 ? 'Goal hit — nice.' : `${today.goalMinutes - today.minutes}m to go`}
              </div>
            </div>
          </div>
        </StatCard>

        <StatCard title="Streak">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-orange-400">{user.streak}</span>
            <span className="text-sm text-slate-600 dark:text-slate-400">days</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Best: {user.longestStreak} days</p>
        </StatCard>

        <StatCard title={`Level ${user.level}`}>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blade-soft">{user.xp.toLocaleString()}</span>
            <span className="text-sm text-slate-600 dark:text-slate-400">XP</span>
          </div>
          <ProgressBar className="mt-3" value={(user.intoLevel / user.nextLevelAt) * 100} />
          <p className="mt-1.5 text-xs text-slate-500">
            {user.nextLevelAt - user.intoLevel} XP to level {user.level + 1}
          </p>
        </StatCard>

        <StatCard title="Cards due">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-violet-400">{totals.dueCards}</span>
            <span className="text-sm text-slate-600 dark:text-slate-400">to review</span>
          </div>
          <Link href="/review" className="btn-ghost mt-3 w-full !py-1.5 text-xs">
            Start review
          </Link>
        </StatCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Track progress — {overall}%</h2>
          <div className="space-y-4">
            <Meter label="Lessons" done={totals.lessons.done} total={totals.lessons.total} tone="blade" />
            <Meter label="Coding problems" done={totals.problems.done} total={totals.problems.total} tone="emerald" />
            <Meter label="Day quizzes passed" done={totals.quizzes.done} total={totals.quizzes.total} tone="orange" />
          </div>
          <Link href="/roadmap" className="btn-ghost mt-5 w-full text-xs">
            Open the 30-day roadmap
          </Link>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Last 15 weeks</h2>
          <Heatmap data={heatmap} />
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </div>
  );
}

function Meter({
  label,
  done,
  total,
  tone,
}: {
  label: string;
  done: number;
  total: number;
  tone: 'blade' | 'emerald' | 'orange';
}) {
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-slate-700 dark:text-slate-300">{label}</span>
        <span className="font-mono text-xs text-slate-500">
          {done}/{total}
        </span>
      </div>
      <ProgressBar value={pct} tone={tone} />
    </div>
  );
}

function Heatmap({ data }: { data: { date: string; minutes: number }[] }) {
  const byDate = new Map(data.map((d) => [d.date, d.minutes]));
  const cells: { date: string; minutes: number }[] = [];
  const today = new Date();
  for (let i = 104; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: key, minutes: byDate.get(key) ?? 0 });
  }
  const level = (m: number) =>
    m === 0 ? 'bg-slate-200 dark:bg-ink-800' : m < 60 ? 'bg-blade/25' : m < 150 ? 'bg-blade/50' : m < 300 ? 'bg-blade/75' : 'bg-blade';

  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-1">
        {cells.map((c) => (
          <div
            key={c.date}
            title={`${c.date} — ${c.minutes} min`}
            className={clsx('h-3 w-3 rounded-[3px]', level(c.minutes))}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500">
        Less
        {['bg-slate-200 dark:bg-ink-800', 'bg-blade/25', 'bg-blade/50', 'bg-blade/75', 'bg-blade'].map((c) => (
          <span key={c} className={clsx('h-2.5 w-2.5 rounded-sm', c)} />
        ))}
        More
      </div>
    </div>
  );
}
