'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { get, post, tokens } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    if (!tokens.access) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await get<{ user: User }>('/api/auth/me');
      setUser(user);
    } catch {
      tokens.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const complete = (data: { accessToken: string; refreshToken: string; user: User }) => {
    tokens.set(data.accessToken, data.refreshToken);
    setUser(data.user);
  };

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      setUser,
      refreshUser,
      async login(email, password) {
        complete(await post('/api/auth/login', { email, password }));
        router.push('/dashboard');
      },
      async register(name, email, password) {
        complete(await post('/api/auth/register', { name, email, password }));
        router.push('/dashboard');
      },
      async loginDemo() {
        complete(await post('/api/auth/demo'));
        router.push('/dashboard');
      },
      async logout() {
        await post('/api/auth/logout', { refreshToken: tokens.refresh }).catch(() => undefined);
        tokens.clear();
        setUser(null);
        router.push('/');
      },
    }),
    [user, loading, refreshUser, router],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
