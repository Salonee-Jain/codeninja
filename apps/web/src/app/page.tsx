'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

const PILLARS = [
  {
    name: 'Frontend',
    dot: 'bg-blue-500',
    items: [
      'HTML5, CSS3, JavaScript ES6+',
      'TypeScript everywhere',
      'React 19 · Next.js 15 App Router',
      'Vue 3 Composition API',
      'Tailwind · Bootstrap · Sass',
      'Redux Toolkit · Zustand · Pinia',
    ],
  },
  {
    name: 'Backend',
    dot: 'bg-green-500',
    items: [
      'Node.js · Express · Fastify',
      'NestJS — DI, guards, testing',
      'REST · GraphQL · tRPC',
      'Zod end-to-end typesafety',
      'JWT · OAuth 2.0 · bcrypt',
      'One day of Python & Go',
    ],
  },
  {
    name: 'Database',
    dot: 'bg-purple-500',
    items: [
      'PostgreSQL · MySQL · SQL Server',
      'MongoDB · Cassandra · DynamoDB',
      'Redis · Memcached',
      'Prisma · Drizzle · TypeORM · Mongoose',
    ],
  },
  {
    name: 'DevOps',
    dot: 'bg-orange-500',
    items: [
      'Docker · Kubernetes',
      'GitHub Actions · GitLab CI · Jenkins',
      'AWS · Google Cloud · Azure',
      'Prometheus · Grafana · ELK',
    ],
  },
];

const FEATURES = [
  { title: 'Read', body: '118 lessons written like a senior engineer explaining it properly — not a bullet-point summary.' },
  { title: 'Practise', body: 'An in-browser IDE with real test cases. JavaScript and HTML run instantly in a worker; SQL runs on a real SQLite engine.' },
  { title: 'Prove', body: 'A quiz gate on every day, graded server-side. 70% to pass, with an explanation for every answer.' },
  { title: 'Retain', body: 'SM-2 spaced repetition over 360 flashcards, so day 3 is still there on day 30.' },
  { title: 'Build', body: 'Five milestone projects with acceptance checklists, ending in a deployed, monitored capstone.' },
  { title: 'Track', body: 'XP, levels, streaks and a contribution heatmap — because a 30-day plan lives or dies on showing up.' },
];

export default function Landing() {
  const { user, loading, loginDemo } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  return (
    <div className="animate-fade-up space-y-20 py-10">
      <section className="mx-auto max-w-3xl text-center">
        <span className="chip border-blade/40 bg-blade/10 text-blade dark:text-blade-soft">30 days · 4–6 hrs/day</span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
          Become a{' '}
          <span className="bg-gradient-to-r from-blade to-violet-400 bg-clip-text text-transparent">
            full-stack TypeScript developer
          </span>
        </h1>
        <p className="mt-5 text-lg text-slate-600 dark:text-slate-400">
          One language for the whole stack. React and Next.js on the front, Node, NestJS and tRPC on
          the back, real databases underneath, and the pipeline that ships it — turned into a
          day-by-day track you can actually finish. Learn it, code it in the browser, get it marked.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-2.5">
            Start day 1
          </Link>
          <button onClick={() => void loginDemo()} className="btn-ghost px-6 py-2.5">
            Try the demo account
          </button>
        </div>
        <dl className="mt-12 grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
          {[
            ['30', 'days'],
            ['118', 'lessons'],
            ['83', 'coding problems'],
            ['5', 'projects'],
          ].map(([n, l]) => (
            <div key={l}>
              <dt className="text-2xl font-bold text-slate-900 dark:text-white">{n}</dt>
              <dd className="text-xs uppercase tracking-wide text-slate-500">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-6 text-center text-xl font-semibold text-slate-900 dark:text-white">
          JavaScript and TypeScript, end to end
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.name} className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${p.dot}`} />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-white">{p.name}</h3>
              </div>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {p.items.map((i) => (
                  <li key={i} className="leading-snug">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-center text-xl font-semibold text-slate-900 dark:text-white">How a day works</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card mx-auto max-w-2xl p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">One month. Show up daily.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
          The plan assumes 4–6 focused hours a day. Miss a day and the streak resets — but the
          roadmap waits for you.
        </p>
        <Link href="/register" className="btn-primary mt-6 px-6 py-2.5">
          Create your account
        </Link>
      </section>
    </div>
  );
}
