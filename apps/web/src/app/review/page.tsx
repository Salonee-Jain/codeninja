'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { RequireAuth } from '@/components/RequireAuth';
import { Markdown } from '@/components/Markdown';
import { EmptyState, PageLoader, ProgressBar } from '@/components/ui';
import { get, post } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

interface Card {
  id: string;
  front: string;
  back: string;
  tags: string[];
  day: { number: number; title: string };
  isNew: boolean;
  state: { repetitions: number; intervalDays: number };
}

const GRADES = [
  { grade: 1, label: 'Again', hint: '<10 min', tone: 'bg-rose-600 hover:bg-rose-500' },
  { grade: 3, label: 'Hard', hint: 'shorter', tone: 'bg-amber-600 hover:bg-amber-500' },
  { grade: 4, label: 'Good', hint: 'on track', tone: 'bg-blade hover:bg-blade-deep' },
  { grade: 5, label: 'Easy', hint: 'longer', tone: 'bg-emerald-600 hover:bg-emerald-500' },
];

export default function ReviewPage() {
  return (
    <RequireAuth>
      <ReviewInner />
    </RequireAuth>
  );
}

function ReviewInner() {
  const { refreshUser } = useAuth();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await get<{ cards: Card[]; totalDue: number }>('/api/learn/flashcards/due?limit=25');
      setCards(data.cards);
      setIndex(0);
      setRevealed(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const card = cards?.[index];

  const grade = useCallback(
    async (g: number) => {
      if (!card) return;
      setRevealed(false);
      setDone((d) => d + 1);
      setIndex((i) => i + 1);
      await post(`/api/learn/flashcards/${card.id}/review`, { grade: g });
      void refreshUser();
    },
    [card, refreshUser],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        void grade(GRADES[Number(e.key) - 1].grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, revealed, grade]);

  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (!cards) return <PageLoader label="Fetching due cards" />;

  if (!card) {
    return (
      <div className="mx-auto max-w-lg pt-16">
        <EmptyState
          title={done > 0 ? `${done} cards reviewed` : 'Nothing due right now'}
          body={
            done > 0
              ? 'That is the queue cleared. Cards will resurface on their own schedule — come back tomorrow.'
              : 'Finish a lesson and its flashcards will enter the rotation. Spaced repetition only works if there is something to space.'
          }
          action={
            <div className="flex gap-2">
              <button onClick={() => void load()} className="btn-ghost">
                Check again
              </button>
              <Link href="/roadmap" className="btn-primary">
                Back to roadmap
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-up space-y-5 pt-6">
      <header className="flex items-center gap-3 text-xs text-slate-500">
        <span>
          Card {index + 1} of {cards.length}
        </span>
        <ProgressBar value={(index / cards.length) * 100} className="max-w-xs" />
        <span className="ml-auto">
          Day {card.day.number}
          {card.isNew && <span className="ml-2 text-blade dark:text-blade-soft">new</span>}
        </span>
      </header>

      <div className="card min-h-[280px] p-8">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {card.tags.map((t) => (
            <span key={t} className="chip border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-850 text-slate-500">
              {t}
            </span>
          ))}
        </div>
        <div className="text-lg font-medium text-slate-900 dark:text-white">
          <Markdown>{card.front}</Markdown>
        </div>

        {revealed ? (
          <div className="mt-6 border-t border-slate-200 dark:border-ink-800 pt-5 text-slate-700 dark:text-slate-300">
            <Markdown>{card.back}</Markdown>
          </div>
        ) : (
          <button onClick={() => setRevealed(true)} className="btn-ghost mt-8 w-full">
            Show answer <kbd className="ml-2 text-[10px] text-slate-500">space</kbd>
          </button>
        )}
      </div>

      {revealed && (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((g, i) => (
            <button
              key={g.grade}
              onClick={() => void grade(g.grade)}
              className={clsx('btn flex-col !gap-0 py-2.5 text-slate-900 dark:text-white', g.tone)}
            >
              <span className="text-sm font-medium">{g.label}</span>
              <span className="text-[10px] opacity-70">
                {g.hint} · {i + 1}
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-slate-600">
        Graded with SM-2. &ldquo;Again&rdquo; drops the interval to minutes; &ldquo;Easy&rdquo; stretches
        it and raises the ease factor.
      </p>
    </div>
  );
}
