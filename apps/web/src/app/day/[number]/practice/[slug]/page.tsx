'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import clsx from 'clsx';
import { RequireAuth } from '@/components/RequireAuth';
import { CodePlayground } from '@/components/CodePlayground';
import { PageLoader } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { useDay } from '@/lib/useDay';

export default function PracticePage() {
  return (
    <RequireAuth>
      <PracticeInner />
    </RequireAuth>
  );
}

function PracticeInner() {
  const params = useParams<{ number: string; slug: string }>();
  const { day, loading, error, reload } = useDay(params.number);
  const { refreshUser } = useAuth();

  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (loading || !day) return <PageLoader label="Loading problem" />;

  const problem = day.problems.find((p) => p.slug === params.slug);
  if (!problem) return <p className="text-sm text-rose-400">That problem doesn&apos;t exist.</p>;

  return (
    <div className="animate-fade-up space-y-3">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link href={`/day/${day.number}`} className="hover:text-slate-700 dark:hover:text-slate-300">
          Day {day.number} · {day.title}
        </Link>
        <span className="ml-auto flex gap-1.5">
          {day.problems.map((p) => (
            <Link
              key={p.id}
              href={`/day/${day.number}/practice/${p.slug}`}
              className={clsx(
                'rounded-md px-2 py-1 transition-colors',
                p.slug === problem.slug
                  ? 'bg-slate-100 dark:bg-ink-800 text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-850 hover:text-slate-700 dark:hover:text-slate-300',
              )}
            >
              {p.solved ? '✓ ' : ''}
              {p.title}
            </Link>
          ))}
        </span>
      </nav>

      <CodePlayground
        key={problem.id}
        problem={problem}
        onSolved={() => {
          void reload();
          void refreshUser();
        }}
      />
    </div>
  );
}
