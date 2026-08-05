/**
 * Content schema for the CodeNinja 30-day Full-Stack track.
 * Every day file in `src/days/day-XX.ts` must default-export a `DaySpec`.
 * The seeder validates every field, so keep the shapes exact.
 */

export type Pillar = 'FOUNDATIONS' | 'FRONTEND' | 'BACKEND' | 'DATABASE' | 'DEVOPS';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

/** Which sandbox executes a coding problem. */
export type Runtime =
  | 'javascript' // Web Worker sandbox + assertion harness
  | 'sql' // SQLite (sql.js) in-browser, result-set comparison
  | 'html' // iframe preview + DOM assertions
  | 'remote'; // proxied to Piston/Judge0 for python | java | go | php | etc.

export interface Lesson {
  slug: string;
  title: string;
  estimatedMinutes: number;
  /** Markdown. Fenced code blocks encouraged. */
  body: string;
}

export interface QuizQuestion {
  prompt: string;
  /** Exactly 4 options. */
  options: [string, string, string, string];
  /** 0-based index into `options`. */
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  difficulty: Difficulty;
}

export interface TestCase {
  name: string;
  /**
   * JS expression evaluated inside the sandbox after the learner's code runs.
   * Must evaluate to a boolean. Learner exports are available on `solution`.
   * e.g. "deepEqual(solution.chunk([1,2,3],2), [[1,2],[3]])"
   * For `sql` runtime this is the expected result set as JSON instead.
   */
  assertion: string;
  /** Hidden tests still run but their assertion text is not shown pre-submit. */
  hidden?: boolean;
  points?: number;
}

export interface CodeProblem {
  slug: string;
  title: string;
  difficulty: Difficulty;
  runtime: Runtime;
  /** Only for runtime === 'remote'. e.g. 'python', 'go', 'java', 'php'. */
  language?: string;
  /** Markdown problem statement, incl. examples + constraints. */
  statement: string;
  starterCode: string;
  solutionCode: string;
  hints: string[];
  tests: TestCase[];
  /** Seed schema + rows for `sql` runtime problems. */
  sqlSetup?: string;
  xp: number;
}

export interface Flashcard {
  front: string;
  back: string;
  tags: string[];
}

export interface ProjectMilestone {
  slug: string;
  title: string;
  /** Markdown brief. */
  brief: string;
  estimatedHours: number;
  checklist: string[];
  stretchGoals: string[];
  repoStarter?: string;
}

export interface Resource {
  label: string;
  url: string;
  kind: 'DOCS' | 'ARTICLE' | 'VIDEO' | 'SPEC' | 'TOOL';
}

export interface DaySpec {
  day: number; // 1..30
  week: number; // 1..5
  pillar: Pillar;
  title: string;
  /** One-line pitch shown on the roadmap card. */
  summary: string;
  estimatedMinutes: number; // target 240-360 (4-6 hrs)
  objectives: string[];
  /** Canonical technology names, matching the roadmap poster. */
  technologies: string[];
  lessons: Lesson[]; // 3-4
  quiz: QuizQuestion[]; // 6-8
  problems: CodeProblem[]; // 1-3
  flashcards: Flashcard[]; // 8-12
  resources: Resource[]; // 3-5
  /** Present only on milestone days (7, 14, 21, 26, 30). */
  project?: ProjectMilestone;
}
