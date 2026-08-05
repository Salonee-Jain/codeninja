import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { asyncHandler, notFound, optionalAuth, requireAuth } from '../middleware';

export const trackRouter = Router();

/** Roadmap view: every day with the learner's completion state folded in. */
trackRouter.get(
  '/full-stack-30',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const track = await prisma.track.findUnique({
      where: { slug: 'full-stack-30' },
      include: {
        days: {
          orderBy: { number: 'asc' },
          include: {
            lessons: { select: { id: true, slug: true, title: true, estimatedMinutes: true }, orderBy: { order: 'asc' } },
            problems: { select: { id: true, slug: true, title: true, difficulty: true, runtime: true, xp: true }, orderBy: { order: 'asc' } },
            project: { select: { id: true, slug: true, title: true, estimatedHours: true } },
            _count: { select: { quiz: true, flashcards: true } },
          },
        },
      },
    });
    if (!track) throw notFound('Track not found');

    const userId = req.user?.sub;
    let completedLessons = new Set<string>();
    let solvedProblems = new Set<string>();
    let passedQuizDays = new Set<string>();

    if (userId) {
      const [lp, subs, quizzes] = await Promise.all([
        prisma.lessonProgress.findMany({
          where: { userId, completedAt: { not: null } },
          select: { lessonId: true },
        }),
        prisma.submission.findMany({
          where: { userId, status: 'PASSED' },
          select: { problemId: true },
          distinct: ['problemId'],
        }),
        prisma.quizAttempt.findMany({
          where: { userId, passed: true },
          select: { dayId: true },
          distinct: ['dayId'],
        }),
      ]);
      completedLessons = new Set(lp.map((r) => r.lessonId));
      solvedProblems = new Set(subs.map((r) => r.problemId));
      passedQuizDays = new Set(quizzes.map((r) => r.dayId));
    }

    const days = track.days.map((d) => {
      const lessonsDone = d.lessons.filter((l) => completedLessons.has(l.id)).length;
      const problemsDone = d.problems.filter((p) => solvedProblems.has(p.id)).length;
      const quizDone = passedQuizDays.has(d.id);
      const units = d.lessons.length + d.problems.length + (d._count.quiz ? 1 : 0);
      const done = lessonsDone + problemsDone + (quizDone ? 1 : 0);
      return {
        id: d.id,
        number: d.number,
        week: d.week,
        pillar: d.pillar,
        title: d.title,
        summary: d.summary,
        estimatedMinutes: d.estimatedMinutes,
        technologies: d.technologies,
        objectives: d.objectives,
        lessons: d.lessons.map((l) => ({ ...l, completed: completedLessons.has(l.id) })),
        problems: d.problems.map((p) => ({ ...p, solved: solvedProblems.has(p.id) })),
        quizCount: d._count.quiz,
        flashcardCount: d._count.flashcards,
        quizPassed: quizDone,
        project: d.project,
        progressPct: units ? Math.round((done / units) * 100) : 0,
      };
    });

    res.json({
      track: {
        id: track.id,
        slug: track.slug,
        title: track.title,
        tagline: track.tagline,
        description: track.description,
      },
      days,
      weeks: [
        { week: 1, title: 'Frontend Core' },
        { week: 2, title: 'Frameworks & State' },
        { week: 3, title: 'Backend & APIs' },
        { week: 4, title: 'Data Layer' },
        { week: 5, title: 'DevOps & Capstone' },
      ],
    });
  }),
);

/** Everything needed to render one day, minus solution code. */
trackRouter.get(
  '/full-stack-30/days/:number',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const number = z.coerce.number().int().min(1).max(30).parse(req.params.number);
    const day = await prisma.day.findFirst({
      where: { number, track: { slug: 'full-stack-30' } },
      include: {
        lessons: { orderBy: { order: 'asc' } },
        problems: {
          orderBy: { order: 'asc' },
          include: {
            tests: {
              where: { hidden: false },
              orderBy: { order: 'asc' },
              select: { id: true, name: true, assertion: true, points: true },
            },
            _count: { select: { tests: true } },
          },
        },
        flashcards: { orderBy: { order: 'asc' } },
        resources: { orderBy: { order: 'asc' } },
        project: { include: { tasks: { orderBy: { order: 'asc' } } } },
        _count: { select: { quiz: true } },
      },
    });
    if (!day) throw notFound(`Day ${number} not found`);

    const userId = req.user?.sub;
    const [progress, subs, attempt, notes] = userId
      ? await Promise.all([
          prisma.lessonProgress.findMany({
            where: { userId, lessonId: { in: day.lessons.map((l) => l.id) } },
          }),
          prisma.submission.findMany({
            where: { userId, problemId: { in: day.problems.map((p) => p.id) } },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.quizAttempt.findFirst({
            where: { userId, dayId: day.id },
            orderBy: { startedAt: 'desc' },
          }),
          prisma.note.findMany({ where: { userId, lessonId: { in: day.lessons.map((l) => l.id) } } }),
        ])
      : [[], [], null, []];

    const progressByLesson = new Map(progress.map((p) => [p.lessonId, p]));
    const notesByLesson = new Map(notes.map((n) => [n.lessonId, n.body]));
    const latestByProblem = new Map<string, (typeof subs)[number]>();
    const solved = new Set<string>();
    for (const s of subs) {
      if (!latestByProblem.has(s.problemId)) latestByProblem.set(s.problemId, s);
      if (s.status === 'PASSED') solved.add(s.problemId);
    }

    res.json({
      day: {
        id: day.id,
        number: day.number,
        week: day.week,
        pillar: day.pillar,
        title: day.title,
        summary: day.summary,
        estimatedMinutes: day.estimatedMinutes,
        objectives: day.objectives,
        technologies: day.technologies,
        quizCount: day._count.quiz,
        quizAttempt: attempt
          ? { score: attempt.score, total: attempt.total, passed: attempt.passed }
          : null,
        lessons: day.lessons.map((l) => ({
          id: l.id,
          slug: l.slug,
          title: l.title,
          estimatedMinutes: l.estimatedMinutes,
          body: l.body,
          completed: Boolean(progressByLesson.get(l.id)?.completedAt),
          scrollPct: progressByLesson.get(l.id)?.scrollPct ?? 0,
          note: notesByLesson.get(l.id) ?? '',
        })),
        problems: day.problems.map((p) => {
          const last = latestByProblem.get(p.id);
          return {
            id: p.id,
            slug: p.slug,
            title: p.title,
            difficulty: p.difficulty,
            runtime: p.runtime,
            language: p.language,
            statement: p.statement,
            starterCode: p.starterCode,
            hints: p.hints,
            sqlSetup: p.sqlSetup,
            xp: p.xp,
            visibleTests: p.tests,
            testCount: p._count.tests,
            solved: solved.has(p.id),
            lastCode: last?.code ?? null,
            lastStatus: last?.status ?? null,
          };
        }),
        flashcards: day.flashcards,
        resources: day.resources,
        project: day.project,
      },
    });
  }),
);

/** Quiz questions for a day, with the answer key withheld. */
trackRouter.get(
  '/full-stack-30/days/:number/quiz',
  requireAuth,
  asyncHandler(async (req, res) => {
    const number = z.coerce.number().int().min(1).max(30).parse(req.params.number);
    const day = await prisma.day.findFirst({
      where: { number, track: { slug: 'full-stack-30' } },
      include: { quiz: { orderBy: { order: 'asc' } } },
    });
    if (!day) throw notFound(`Day ${number} not found`);
    res.json({
      dayId: day.id,
      dayNumber: day.number,
      title: day.title,
      questions: day.quiz.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        difficulty: q.difficulty,
      })),
    });
  }),
);
