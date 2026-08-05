'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { RequireAuth } from '@/components/RequireAuth';
import { Markdown } from '@/components/Markdown';
import { PageLoader, ProgressBar, Spinner } from '@/components/ui';
import { get, post, put } from '@/lib/api';
import { useDay } from '@/lib/useDay';

interface ProjectResponse {
  project: {
    id: string;
    title: string;
    brief: string;
    estimatedHours: number;
    stretchGoals: string[];
    repoStarter: string | null;
    tasks: { id: string; label: string; done: boolean }[];
  };
  progress: { repoUrl: string | null; liveUrl: string | null; notes: string | null; submittedAt: string | null } | null;
  completionPct: number;
}

export default function ProjectPage() {
  return (
    <RequireAuth>
      <ProjectInner />
    </RequireAuth>
  );
}

function ProjectInner() {
  const params = useParams<{ number: string }>();
  const { day } = useDay(params.number);
  const [data, setData] = useState<ProjectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const projectId = day?.project?.id;

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await get<ProjectResponse>(`/api/learn/projects/${projectId}`);
      setData(res);
      setRepoUrl(res.progress?.repoUrl ?? '');
      setLiveUrl(res.progress?.liveUrl ?? '');
      setNotes(res.progress?.notes ?? '');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (day && !day.project) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Day {params.number} has no milestone project.{' '}
        <Link href={`/day/${params.number}`} className="text-blade dark:text-blade-soft hover:underline">
          Back to the day
        </Link>
      </p>
    );
  }
  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (!data) return <PageLoader label="Loading project" />;

  const { project } = data;

  /** Optimistic: flip the box immediately, roll back if the write fails. */
  async function toggle(taskId: string, done: boolean) {
    const snapshot = data;
    setData((d) => {
      if (!d) return d;
      const tasks = d.project.tasks.map((t) => (t.id === taskId ? { ...t, done } : t));
      const doneCount = tasks.filter((t) => t.done).length;
      return {
        ...d,
        project: { ...d.project, tasks },
        completionPct: tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0,
      };
    });
    try {
      await post(`/api/learn/projects/tasks/${taskId}/toggle`, { done });
    } catch {
      setData(snapshot);
      return;
    }
    await load();
  }

  async function saveSubmission(submitted?: boolean) {
    setSaving(true);
    try {
      await put(`/api/learn/projects/${project.id}/submission`, {
        repoUrl: repoUrl || null,
        liveUrl: liveUrl || null,
        notes: notes || null,
        ...(submitted !== undefined ? { submitted } : {}),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-up grid gap-6 lg:grid-cols-[1fr_360px]">
      <article className="min-w-0">
        <nav className="mb-4 flex items-center gap-2 text-xs text-slate-500">
          <Link href={`/day/${params.number}`} className="hover:text-slate-700 dark:hover:text-slate-300">
            Day {params.number}
          </Link>
          <span>/</span>
          <span className="text-slate-600 dark:text-slate-400">Milestone project</span>
        </nav>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{project.title}</h1>
          <span className="chip border-amber-500/40 bg-amber-500/10 text-amber-300">
            ~{project.estimatedHours}h
          </span>
        </div>

        <div className="card p-6">
          <Markdown>{project.brief}</Markdown>
        </div>

        {project.stretchGoals.length > 0 && (
          <div className="card mt-4 p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Stretch goals</h2>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {project.stretchGoals.map((g) => (
                <li key={g} className="flex gap-2">
                  <span className="text-amber-500">★</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      <aside className="space-y-4">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Acceptance checklist</h2>
            <span className="font-mono text-xs text-slate-500">{data.completionPct}%</span>
          </div>
          <ProgressBar value={data.completionPct} tone={data.completionPct === 100 ? 'emerald' : 'blade'} />
          <ul className="mt-4 space-y-1.5">
            {project.tasks.map((t) => (
              <li key={t.id}>
                <label
                  className={clsx(
                    'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors',
                    t.done
                      ? 'border-emerald-600/30 bg-emerald-500/[.06] text-slate-600 dark:text-slate-400 line-through'
                      : 'border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-850 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-ink-600',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={(e) => void toggle(t.id, e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
                  />
                  <span className="leading-snug">{t.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Submit your build</h2>
          <div className="space-y-3">
            <div>
              <label htmlFor="repo" className="mb-1 block text-xs text-slate-600 dark:text-slate-400">
                Repository URL
              </label>
              <input
                id="repo"
                className="input"
                placeholder="https://github.com/you/project"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="live" className="mb-1 block text-xs text-slate-600 dark:text-slate-400">
                Live URL
              </label>
              <input
                id="live"
                className="input"
                placeholder="https://your-project.vercel.app"
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="pnotes" className="mb-1 block text-xs text-slate-600 dark:text-slate-400">
                Notes
              </label>
              <textarea
                id="pnotes"
                rows={3}
                className="input"
                placeholder="What did you choose to do differently, and why?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => void saveSubmission()} disabled={saving} className="btn-ghost flex-1 !py-1.5 text-xs">
                {saving && <Spinner />} Save
              </button>
              <button
                onClick={() => void saveSubmission(true)}
                disabled={saving || data.completionPct < 100}
                className="btn-success flex-1 !py-1.5 text-xs"
                title={data.completionPct < 100 ? 'Finish the checklist first' : undefined}
              >
                Mark shipped
              </button>
            </div>
            {data.progress?.submittedAt && (
              <p className="text-xs text-emerald-400">
                Shipped {new Date(data.progress.submittedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {project.repoStarter && (
          <a href={project.repoStarter} target="_blank" rel="noreferrer noopener" className="btn-ghost w-full text-xs">
            Starter template ↗
          </a>
        )}
      </aside>
    </div>
  );
}
