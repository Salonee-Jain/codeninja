'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { RequireAuth } from '@/components/RequireAuth';
import { PageLoader } from '@/components/ui';
import { get } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

interface Row {
  rank: number;
  id: string;
  name: string;
  avatarUrl: string | null;
  xp: number;
  streak: number;
  level: number;
}

export default function LeaderboardPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

function Inner() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    get<{ leaderboard: Row[] }>('/api/learn/leaderboard').then((d) => setRows(d.leaderboard));
  }, []);

  if (!rows) return <PageLoader label="Loading leaderboard" />;

  return (
    <div className="mx-auto max-w-2xl animate-fade-up space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leaderboard</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Ranked by lifetime XP across the track.</p>
      </header>

      <div className="card divide-y divide-slate-200 dark:divide-ink-800">
        {rows.map((r) => (
          <div
            key={r.id}
            className={clsx(
              'flex items-center gap-4 px-5 py-3',
              r.id === user?.id && 'bg-blade/[.07]',
            )}
          >
            <span
              className={clsx(
                'w-6 text-center font-mono text-sm',
                r.rank === 1
                  ? 'text-amber-400'
                  : r.rank === 2
                    ? 'text-slate-700 dark:text-slate-300'
                    : r.rank === 3
                      ? 'text-orange-400'
                      : 'text-slate-600',
              )}
            >
              {r.rank}
            </span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 dark:bg-ink-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {r.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-200">
              {r.name}
              {r.id === user?.id && <span className="ml-2 text-xs text-blade dark:text-blade-soft">you</span>}
            </span>
            <span className="text-xs text-orange-400">🔥 {r.streak}</span>
            <span className="w-16 text-right text-xs text-slate-500">Lv {r.level}</span>
            <span className="w-20 text-right font-mono text-sm text-blade dark:text-blade-soft">
              {r.xp.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
