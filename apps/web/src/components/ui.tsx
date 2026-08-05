'use client';

import clsx from 'clsx';

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner className="h-6 w-6" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function ProgressBar({
  value,
  className = '',
  tone = 'blade',
}: {
  value: number;
  className?: string;
  tone?: 'blade' | 'emerald' | 'orange';
}) {
  const bg = { blade: 'bg-blade', emerald: 'bg-emerald-500', orange: 'bg-orange-500' }[tone];
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-ink-800', className)}>
      <div
        className={clsx('h-full rounded-full transition-all duration-500', bg)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Ring({
  value,
  size = 72,
  stroke = 7,
  label,
  sub,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-slate-200 dark:stroke-ink-800" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-blade transition-all duration-700"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-tight">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{label ?? `${Math.round(pct)}%`}</div>
          {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{body}</p>
      {action}
    </div>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'info' | 'success'; children: React.ReactNode }) {
  const tone = {
    error: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    info: 'border-blade/40 bg-blade/10 text-blade dark:text-blade-soft',
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  }[kind];
  return <div className={clsx('rounded-lg border px-3 py-2 text-sm', tone)}>{children}</div>;
}
