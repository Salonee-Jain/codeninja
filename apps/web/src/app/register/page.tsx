'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Alert, Spinner } from '@/components/ui';

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(name, email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm animate-fade-up">
      <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Start the 30-day track</h1>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">Free, and you begin on day 1 immediately.</p>

      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        {error && <Alert>{error}</Alert>}
        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Name
          </label>
          <input
            id="name"
            required
            autoComplete="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="pw-help"
          />
          <p id="pw-help" className="mt-1.5 text-[11px] text-slate-500">
            At least 8 characters.
          </p>
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy && <Spinner />} Create account
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        Already enrolled?{' '}
        <Link href="/login" className="text-blade dark:text-blade-soft hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
