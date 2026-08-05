'use client';

import { useCallback, useEffect, useState } from 'react';
import { get } from './api';
import type { DayDetail } from './types';

export function useDay(number: number | string | undefined) {
  const [day, setDay] = useState<DayDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (number === undefined) return;
    setLoading(true);
    try {
      const data = await get<{ day: DayDetail }>(`/api/tracks/full-stack-30/days/${number}`);
      setDay(data.day);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [number]);

  useEffect(() => {
    void load();
  }, [load]);

  return { day, error, loading, reload: load };
}
