'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { RequireAuth } from '@/components/RequireAuth';
import { Markdown } from '@/components/Markdown';
import { PageLoader, ProgressBar, Spinner } from '@/components/ui';
import { post, put } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useDay } from '@/lib/useDay';

export default function LessonPage() {
  return (
    <RequireAuth>
      <LessonInner />
    </RequireAuth>
  );
}

function LessonInner() {
  const params = useParams<{ number: string; slug: string }>();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { day, loading, error, reload } = useDay(params.number);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [scroll, setScroll] = useState(0);
  const startedAt = useRef(Date.now());
  const article = useRef<HTMLDivElement>(null);

  const lesson = day?.lessons.find((l) => l.slug === params.slug);
  const index = day?.lessons.findIndex((l) => l.slug === params.slug) ?? -1;
  const next = day && index >= 0 ? day.lessons[index + 1] : undefined;

  useEffect(() => {
    if (lesson) setNote(lesson.note ?? '');
  }, [lesson]);

  useEffect(() => {
    const onScroll = () => {
      const el = article.current;
      if (!el) return;
      const total = el.scrollHeight - window.innerHeight;
      const pct = total > 0 ? Math.min(100, Math.round((window.scrollY / total) * 100)) : 100;
      setScroll(pct);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [lesson]);

  const headings = useMemo(() => {
    if (!lesson) return [];
    return lesson.body
      .split('\n')
      .filter((l) => /^##\s+/.test(l))
      .map((l) => l.replace(/^##\s+/, '').trim());
  }, [lesson]);

  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (loading || !day) return <PageLoader label="Loading lesson" />;
  if (!lesson) return <p className="text-sm text-rose-400">That lesson doesn&apos;t exist.</p>;

  async function complete() {
    setSaving(true);
    try {
      await post(`/api/learn/lessons/${lesson!.id}/progress`, {
        completed: true,
        scrollPct: scroll,
        secondsSpent: Math.min(7200, Math.round((Date.now() - startedAt.current) / 1000)),
      });
      await Promise.all([reload(), refreshUser()]);
      if (next) router.push(`/day/${params.number}/lesson/${next.slug}`);
      else router.push(`/day/${params.number}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveNote() {
    await put(`/api/learn/lessons/${lesson!.id}/note`, { body: note });
    setNoteOpen(false);
  }

  return (
    <div className="animate-fade-up">
      <div className="fixed left-0 right-0 top-14 z-30">
        <ProgressBar value={scroll} className="!h-0.5 !rounded-none" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
        <article ref={article} className="min-w-0">
          <nav className="mb-4 flex items-center gap-2 text-xs text-slate-500">
            <Link href="/roadmap" className="hover:text-slate-700 dark:hover:text-slate-300">
              Roadmap
            </Link>
            <span>/</span>
            <Link href={`/day/${day.number}`} className="hover:text-slate-700 dark:hover:text-slate-300">
              Day {day.number}
            </Link>
            <span>/</span>
            <span className="truncate text-slate-600 dark:text-slate-400">{lesson.title}</span>
          </nav>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{lesson.title}</h1>
            <span className="chip border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-850 text-slate-600 dark:text-slate-400">
              {lesson.estimatedMinutes} min read
            </span>
            {lesson.completed && (
              <span className="chip border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                completed
              </span>
            )}
          </div>

          <Markdown>{lesson.body}</Markdown>

          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-200 dark:border-ink-800 pt-6">
            <button onClick={() => void complete()} disabled={saving} className="btn-primary">
              {saving && <Spinner />}
              {lesson.completed ? 'Marked complete' : 'Mark complete'}
              {next ? ' & continue →' : ''}
            </button>
            <button onClick={() => setNoteOpen((v) => !v)} className="btn-ghost">
              {note ? 'Edit note' : 'Add a note'}
            </button>
            {next ? (
              <Link href={`/day/${day.number}/lesson/${next.slug}`} className="btn-ghost">
                Skip to “{next.title}”
              </Link>
            ) : (
              <Link href={`/day/${day.number}`} className="btn-ghost">
                Back to day {day.number}
              </Link>
            )}
          </div>

          {noteOpen && (
            <div className="card mt-4 p-4">
              <label htmlFor="note" className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Your notes on this lesson
              </label>
              <textarea
                id="note"
                rows={5}
                className="input font-mono text-[13px]"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What surprised you? What do you want to look up later?"
              />
              <div className="mt-3 flex gap-2">
                <button onClick={() => void saveNote()} className="btn-primary !py-1.5 text-xs">
                  Save note
                </button>
                <button onClick={() => setNoteOpen(false)} className="btn-ghost !py-1.5 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="card p-4">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                In this lesson
              </h2>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                {headings.map((h) => (
                  <li key={h} className="leading-snug">
                    {h}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-4">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Day {day.number} lessons
              </h2>
              <ol className="space-y-1.5">
                {day.lessons.map((l, i) => (
                  <li key={l.id}>
                    <Link
                      href={`/day/${day.number}/lesson/${l.slug}`}
                      className={clsx(
                        'flex items-start gap-2 rounded-md px-2 py-1.5 text-xs leading-snug transition-colors',
                        l.slug === lesson.slug
                          ? 'bg-slate-100 dark:bg-ink-800 text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-850 hover:text-slate-900 dark:hover:text-slate-200',
                      )}
                    >
                      <span className={l.completed ? 'text-emerald-400' : 'text-slate-600'}>
                        {l.completed ? '✓' : i + 1}
                      </span>
                      {l.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
