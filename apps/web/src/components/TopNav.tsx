'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useAuth } from './AuthProvider';
import { useTheme } from './ThemeProvider';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/roadmap', label: 'Roadmap' },
  { href: '/review', label: 'Review' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export function TopNav() {
  const { user, logout, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <Link href={user ? '/dashboard' : '/'} className="flex shrink-0 items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-blade to-violet-500 font-mono text-xs font-bold text-white">
            {'</>'}
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">CodeNinja</span>
        </Link>

        {user && (
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  pathname === l.href || pathname.startsWith(l.href + '/')
                    ? 'bg-slate-100 text-slate-900 dark:bg-ink-800 dark:text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-ink-850 dark:hover:text-slate-200',
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={toggle}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-ink-850 dark:hover:text-slate-200"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.06 1.06l1.06 1.06z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 1110.239 1.87a.75.75 0 01-.784.136z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          {loading ? null : user ? (
            <>
              <div className="hidden items-center gap-3 text-xs sm:flex">
                <span
                  className="chip border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-300"
                  title="Day streak"
                >
                  🔥 {user.streak}
                </span>
                <span className="chip border-blade/40 bg-blade/10 text-blade dark:text-blade-soft" title="Total XP">
                  ⚡ {user.xp.toLocaleString()} XP
                </span>
                <span className="chip border-slate-200 bg-slate-50 text-slate-600 dark:border-ink-600 dark:bg-ink-850 dark:text-slate-300">Lv {user.level}</span>
              </div>
              <button onClick={() => void logout()} className="btn-ghost !px-3 !py-1.5 text-xs">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost !px-3 !py-1.5 text-xs">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary !px-3 !py-1.5 text-xs">
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
