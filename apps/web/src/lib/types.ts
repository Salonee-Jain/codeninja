export type Pillar = 'FOUNDATIONS' | 'FRONTEND' | 'BACKEND' | 'DATABASE' | 'DEVOPS';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type Runtime = 'javascript' | 'sql' | 'html' | 'remote';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  xp: number;
  streak: number;
  longestStreak: number;
  dailyGoalMinutes: number;
  level: number;
  intoLevel: number;
  nextLevelAt: number;
}

export interface RoadmapDay {
  id: string;
  number: number;
  week: number;
  pillar: Pillar;
  title: string;
  summary: string;
  estimatedMinutes: number;
  technologies: string[];
  objectives: string[];
  lessons: { id: string; slug: string; title: string; estimatedMinutes: number; completed: boolean }[];
  problems: {
    id: string;
    slug: string;
    title: string;
    difficulty: Difficulty;
    runtime: Runtime;
    xp: number;
    solved: boolean;
  }[];
  quizCount: number;
  flashcardCount: number;
  quizPassed: boolean;
  project: { id: string; slug: string; title: string; estimatedHours: number } | null;
  progressPct: number;
}

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  estimatedMinutes: number;
  body: string;
  completed: boolean;
  scrollPct: number;
  note: string;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  runtime: Runtime;
  language: string | null;
  statement: string;
  starterCode: string;
  hints: string[];
  sqlSetup: string | null;
  xp: number;
  visibleTests: { id: string; name: string; assertion: string; points: number }[];
  testCount: number;
  solved: boolean;
  lastCode: string | null;
  lastStatus: string | null;
}

export interface DayDetail {
  id: string;
  number: number;
  week: number;
  pillar: Pillar;
  title: string;
  summary: string;
  estimatedMinutes: number;
  objectives: string[];
  technologies: string[];
  quizCount: number;
  quizAttempt: { score: number; total: number; passed: boolean } | null;
  lessons: Lesson[];
  problems: Problem[];
  flashcards: { id: string; front: string; back: string; tags: string[] }[];
  resources: { id: string; label: string; url: string; kind: string }[];
  project: {
    id: string;
    slug: string;
    title: string;
    brief: string;
    estimatedHours: number;
    stretchGoals: string[];
    repoStarter: string | null;
    tasks: { id: string; label: string; order: number }[];
  } | null;
}

export interface TestResult {
  name: string;
  passed: boolean;
  hidden: boolean;
  message?: string;
  points: number;
}

export interface JudgeResult {
  status: 'PASSED' | 'FAILED' | 'ERROR';
  passedCount: number;
  totalCount: number;
  results: TestResult[];
  runtimeMs: number;
  stderr?: string;
  xpAwarded?: number;
  firstSolve?: boolean;
  dryRun?: boolean;
}

export interface Dashboard {
  user: User;
  enrollment: { currentDay: number; startedAt: string; targetEndAt: string | null } | null;
  today: { minutes: number; xp: number; goalMinutes: number; goalPct: number };
  totals: {
    lessons: { done: number; total: number };
    problems: { done: number; total: number };
    quizzes: { done: number; total: number };
    dueCards: number;
  };
  nextDay: { number: number; title: string } | null;
  heatmap: { date: string; minutes: number; xp: number }[];
}

export const PILLAR_COLOR: Record<Pillar, string> = {
  FOUNDATIONS: 'text-slate-400 border-slate-500/40 bg-slate-500/10',
  FRONTEND: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  BACKEND: 'text-green-400 border-green-500/40 bg-green-500/10',
  DATABASE: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
  DEVOPS: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
};

export const PILLAR_DOT: Record<Pillar, string> = {
  FOUNDATIONS: 'bg-slate-400',
  FRONTEND: 'bg-blue-500',
  BACKEND: 'bg-green-500',
  DATABASE: 'bg-purple-500',
  DEVOPS: 'bg-orange-500',
};

export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  EASY: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  HARD: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
};
