'use client';

import { get, post } from './api';

export type TutorRef = {
  dayNumber?: number;
  lessonSlug?: string;
  problemSlug?: string;
};

export type TutorStatus = {
  enabled: boolean;
  provider: 'gemini' | 'anthropic' | 'openai' | null;
  model: string | null;
};

export const tutorStatus = () => get<TutorStatus>('/api/tutor/status');

export const askTutor = (body: { message: string; context?: TutorRef; code?: string }) =>
  post<{ reply: string; provider: string; model: string }>('/api/tutor/ask', body);

/**
 * Derives the tutor's context from the route. Add a case here if you add a route shape;
 * anything unrecognised just falls through to no context, which is fine.
 */
export function refFromPathname(pathname: string): TutorRef {
  const day = pathname.match(/^\/day\/(\d+)/);
  if (!day) return {};
  const dayNumber = Number(day[1]);

  const lesson = pathname.match(/^\/day\/\d+\/lesson\/([^/]+)/);
  if (lesson) return { dayNumber, lessonSlug: decodeURIComponent(lesson[1]) };

  const practice = pathname.match(/^\/day\/\d+\/practice\/([^/]+)/);
  if (practice) return { dayNumber, problemSlug: decodeURIComponent(practice[1]) };

  return { dayNumber };
}
