'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Alert, Spinner } from '@/components/ui';

export default function LoginPage() {
  const { login, loginDemo } = useAuth();
  const [email, setEmail] = useState('demo@codeninja.dev');
  const [password, setPassword] = useState('ninja1234');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm animate-fade-up">
      <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h1>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">Pick up where you left off.</p>

      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        {error && <Alert>{error}</Alert>}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
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
            autoComplete="current-password"
            required
            minLength={8}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy && <Spinner />} Sign in
        </button>
        <button
          type="button"
          onClick={() => void loginDemo()}
          className="btn-ghost w-full text-xs"
        >
          Use the demo account
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        No account?{' '}
        <Link href="/register" className="text-blade dark:text-blade-soft hover:underline">
          Start the track
        </Link>
      </p>
    </div>
  );
}
