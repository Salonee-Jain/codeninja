import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { judge } from '../lib/judge';
import { NEW_CARD, schedule } from '../lib/srs';
import { dayKey, levelFor, recordActivity } from '../lib/gamify';
import { asyncHandler, badRequest, notFound, requireAuth } from '../middleware';

export const learnRouter = Router();
learnRouter.use(requireAuth);

const XP_LESSON = 20;
const XP_QUIZ_PASS = 50;
const XP_CARD = 2;
const QUIZ_PASS_PCT = 70;

/* ------------------------------------------------------------------ lessons */

learnRouter.post(
  '/lessons/:lessonId/progress',
  asyncHandler(async (req, res) => {
    const { lessonId } = req.params;
    const body = z
      .object({
        completed: z.boolean().optional(),
        secondsSpent: z.number().int().min(0).max(7200).optional(),
        scrollPct: z.number().int().min(0).max(100).optional(),
      })
      .parse(req.body);

    const userId = req.user!.sub;
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw notFound('Lesson not found');

    const existing = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
    const firstCompletion = body.completed && !existing?.completedAt;

    const progress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        completedAt: body.completed ? new Date() : null,
        secondsSpent: body.secondsSpent ?? 0,
        scrollPct: body.scrollPct ?? 0,
      },
      update: {
        completedAt: body.completed ? (existing?.completedAt ?? new Date()) : existing?.completedAt ?? null,
        secondsSpent: { increment: body.secondsSpent ?? 0 },
        scrollPct: Math.max(existing?.scrollPct ?? 0, body.scrollPct ?? 0),
      },
    });

    const totals = await recordActivity(userId, {
      xp: firstCompletion ? XP_LESSON : 0,
      minutes: Math.round((body.secondsSpent ?? 0) / 60),
      lessons: firstCompletion ? 1 : 0,
    });

    res.json({ progress, xpAwarded: firstCompletion ? XP_LESSON : 0, totals: { ...totals, ...levelFor(totals.xp) } });
  }),
);

learnRouter.put(
  '/lessons/:lessonId/note',
  asyncHandler(async (req, res) => {
    const { body } = z.object({ body: z.string().max(20_000) }).parse(req.body);
    const userId = req.user!.sub;
    const note = await prisma.note.upsert({
      where: { userId_lessonId: { userId, lessonId: req.params.lessonId } },
      create: { userId, lessonId: req.params.lessonId, body },
      update: { body },
    });
    res.json({ note });
  }),
);

/* --------------------------------------------------------------------- quiz */

learnRouter.post(
  '/days/:dayId/quiz/submit',
  asyncHandler(async (req, res) => {
    const { answers } = z
      .object({
        answers: z
          .array(z.object({ questionId: z.string(), selectedIndex: z.number().int().min(0).max(3) }))
          .min(1),
      })
      .parse(req.body);

    const userId = req.user!.sub;
    const questions = await prisma.quizQuestion.findMany({
      where: { dayId: req.params.dayId },
      orderBy: { order: 'asc' },
    });
    if (!questions.length) throw notFound('No quiz for this day');

    const byId = new Map(questions.map((q: (typeof questions)[number]) => [q.id, q]));
    let score = 0;
    const graded = answers
      .filter((a) => byId.has(a.questionId))
      .map((a) => {
        const q = byId.get(a.questionId)!;
        const correct = q.correctIndex === a.selectedIndex;
        if (correct) score += 1;
        return { ...a, correct, question: q };
      });

    const total = questions.length;
    const pct = Math.round((score / total) * 100);
    const passed = pct >= QUIZ_PASS_PCT;

    const alreadyPassed = await prisma.quizAttempt.findFirst({
      where: { userId, dayId: req.params.dayId, passed: true },
    });

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        dayId: req.params.dayId,
        score,
        total,
        passed,
        completedAt: new Date(),
        answers: {
          create: graded.map((g) => ({
            questionId: g.questionId,
            selectedIndex: g.selectedIndex,
            correct: g.correct,
          })),
        },
      },
    });

    const xpAwarded = passed && !alreadyPassed ? XP_QUIZ_PASS : 0;
    const totals = await recordActivity(userId, { xp: xpAwarded });

    res.json({
      attemptId: attempt.id,
      score,
      total,
      pct,
      passed,
      passMark: QUIZ_PASS_PCT,
      xpAwarded,
      totals: { ...totals, ...levelFor(totals.xp) },
      review: graded.map((g) => ({
        questionId: g.questionId,
        selectedIndex: g.selectedIndex,
        correctIndex: g.question.correctIndex,
        correct: g.correct,
        explanation: g.question.explanation,
      })),
    });
  }),
);

/* ----------------------------------------------------------------- problems */

/** Dry run — grades against visible tests only, never awards XP, never stored. */
learnRouter.post(
  '/problems/:problemId/run',
  asyncHandler(async (req, res) => {
    const { code } = z.object({ code: z.string().max(100_000) }).parse(req.body);
    const problem = await prisma.codeProblem.findUnique({
      where: { id: req.params.problemId },
      include: { tests: { where: { hidden: false }, orderBy: { order: 'asc' } } },
    });
    if (!problem) throw notFound('Problem not found');
    const result = await judge(
      {
        runtime: problem.runtime,
        language: problem.language,
        sqlSetup: problem.sqlSetup,
        tests: problem.tests.map((t) => ({
          name: t.name,
          assertion: t.assertion,
          hidden: t.hidden,
          points: t.points,
        })),
      },
      code,
    );
    res.json({ ...result, dryRun: true });
  }),
);

/** Real submission — all tests, persisted, XP on first pass. */
learnRouter.post(
  '/problems/:problemId/submit',
  asyncHandler(async (req, res) => {
    const { code } = z.object({ code: z.string().min(1).max(100_000) }).parse(req.body);
    const userId = req.user!.sub;
    const problem = await prisma.codeProblem.findUnique({
      where: { id: req.params.problemId },
      include: { tests: { orderBy: { order: 'asc' } } },
    });
    if (!problem) throw notFound('Problem not found');

    const result = await judge(
      {
        runtime: problem.runtime,
        language: problem.language,
        sqlSetup: problem.sqlSetup,
        tests: problem.tests.map((t) => ({
          name: t.name,
          assertion: t.assertion,
          hidden: t.hidden,
          points: t.points,
        })),
      },
      code,
    );

    const previouslySolved = await prisma.submission.findFirst({
      where: { userId, problemId: problem.id, status: 'PASSED' },
    });
    const xpAwarded = result.status === 'PASSED' && !previouslySolved ? problem.xp : 0;

    const submission = await prisma.submission.create({
      data: {
        userId,
        problemId: problem.id,
        code,
        status: result.status,
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        results: result.results as unknown as object,
        runtimeMs: result.runtimeMs,
        xpAwarded,
      },
    });

    const totals = await recordActivity(userId, {
      xp: xpAwarded,
      problems: xpAwarded ? 1 : 0,
    });

    res.json({
      submissionId: submission.id,
      ...result,
      // Hidden test details stay hidden; the learner sees pass/fail only.
      results: result.results.map((r) =>
        r.hidden ? { ...r, message: r.passed ? undefined : 'Hidden test failed' } : r,
      ),
      xpAwarded,
      firstSolve: Boolean(xpAwarded),
      totals: { ...totals, ...levelFor(totals.xp) },
    });
  }),
);

learnRouter.get(
  '/problems/:problemId/solution',
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub;
    const solved = await prisma.submission.findFirst({
      where: { userId, problemId: req.params.problemId, status: 'PASSED' },
    });
    const attempts = await prisma.submission.count({
      where: { userId, problemId: req.params.problemId },
    });
    // Unlock after a pass, or after three honest attempts.
    if (!solved && attempts < 3) {
      throw badRequest('Solve it, or make at least 3 attempts, to unlock the solution.');
    }
    const problem = await prisma.codeProblem.findUnique({
      where: { id: req.params.problemId },
      select: { solutionCode: true, hints: true },
    });
    if (!problem) throw notFound('Problem not found');
    res.json(problem);
  }),
);

learnRouter.get(
  '/problems/:problemId/submissions',
  asyncHandler(async (req, res) => {
    const submissions = await prisma.submission.findMany({
      where: { userId: req.user!.sub, problemId: req.params.problemId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ submissions });
  }),
);

/* --------------------------------------------------------------- flashcards */

/** Cards due now, oldest-due first, plus new cards from unlocked days. */
learnRouter.get(
  '/flashcards/due',
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub;
    const limit = z.coerce.number().int().min(1).max(100).default(20).parse(req.query.limit ?? 20);
    const upToDay = z.coerce.number().int().min(1).max(30).optional().parse(req.query.upToDay);

    const due = await prisma.flashcardReview.findMany({
      where: { userId, dueAt: { lte: new Date() } },
      orderBy: { dueAt: 'asc' },
      take: limit,
      include: { flashcard: { include: { day: { select: { number: true, title: true } } } } },
    });

    const remaining = limit - due.length;
    let fresh: Awaited<ReturnType<typeof prisma.flashcard.findMany>> = [];
    if (remaining > 0) {
      fresh = await prisma.flashcard.findMany({
        where: {
          reviews: { none: { userId } },
          ...(upToDay ? { day: { number: { lte: upToDay } } } : {}),
        },
        orderBy: [{ day: { number: 'asc' } }, { order: 'asc' }],
        take: remaining,
        include: { day: { select: { number: true, title: true } } },
      });
    }

    const totalDue = await prisma.flashcardReview.count({
      where: { userId, dueAt: { lte: new Date() } },
    });

    res.json({
      totalDue,
      cards: [
        ...due.map((r) => ({
          id: r.flashcard.id,
          front: r.flashcard.front,
          back: r.flashcard.back,
          tags: r.flashcard.tags,
          day: (r.flashcard as unknown as { day: { number: number; title: string } }).day,
          state: {
            repetitions: r.repetitions,
            intervalDays: r.intervalDays,
            easeFactor: r.easeFactor,
            lapses: r.lapses,
          },
          isNew: false,
        })),
        ...fresh.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
          tags: c.tags,
          day: (c as unknown as { day: { number: number; title: string } }).day,
          state: NEW_CARD,
          isNew: true,
        })),
      ],
    });
  }),
);

learnRouter.post(
  '/flashcards/:flashcardId/review',
  asyncHandler(async (req, res) => {
    const { grade } = z.object({ grade: z.number().int().min(0).max(5) }).parse(req.body);
    const userId = req.user!.sub;
    const existing = await prisma.flashcardReview.findUnique({
      where: { userId_flashcardId: { userId, flashcardId: req.params.flashcardId } },
    });

    const next = schedule(
      existing
        ? {
            easeFactor: existing.easeFactor,
            intervalDays: existing.intervalDays,
            repetitions: existing.repetitions,
            lapses: existing.lapses,
          }
        : NEW_CARD,
      grade,
    );

    const review = await prisma.flashcardReview.upsert({
      where: { userId_flashcardId: { userId, flashcardId: req.params.flashcardId } },
      create: {
        userId,
        flashcardId: req.params.flashcardId,
        ...next,
        lastGrade: grade,
        reviewedAt: new Date(),
      },
      update: { ...next, lastGrade: grade, reviewedAt: new Date() },
    });

    const totals = await recordActivity(userId, { xp: grade >= 3 ? XP_CARD : 0, cards: 1 });
    res.json({ review, totals: { ...totals, ...levelFor(totals.xp) } });
  }),
);

/* ----------------------------------------------------------------- projects */

learnRouter.get(
  '/projects/:projectId',
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub;
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { tasks: { orderBy: { order: 'asc' } }, day: { select: { number: true, title: true } } },
    });
    if (!project) throw notFound('Project not found');

    const [states, progress] = await Promise.all([
      prisma.projectTaskState.findMany({
        where: { userId, taskId: { in: project.tasks.map((t) => t.id) } },
      }),
      prisma.projectProgress.findUnique({
        where: { userId_projectId: { userId, projectId: project.id } },
      }),
    ]);
    const doneIds = new Set(states.filter((s) => s.done).map((s) => s.taskId));

    res.json({
      project: {
        ...project,
        tasks: project.tasks.map((t) => ({ ...t, done: doneIds.has(t.id) })),
      },
      progress,
      completionPct: project.tasks.length
        ? Math.round((doneIds.size / project.tasks.length) * 100)
        : 0,
    });
  }),
);

learnRouter.post(
  '/projects/tasks/:taskId/toggle',
  asyncHandler(async (req, res) => {
    const { done } = z.object({ done: z.boolean() }).parse(req.body);
    const userId = req.user!.sub;
    const state = await prisma.projectTaskState.upsert({
      where: { userId_taskId: { userId, taskId: req.params.taskId } },
      create: { userId, taskId: req.params.taskId, done, doneAt: done ? new Date() : null },
      update: { done, doneAt: done ? new Date() : null },
    });
    if (done) await recordActivity(userId, { xp: 5 });
    res.json({ state });
  }),
);

learnRouter.put(
  '/projects/:projectId/submission',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        repoUrl: z.string().url().nullable().optional(),
        liveUrl: z.string().url().nullable().optional(),
        notes: z.string().max(5000).nullable().optional(),
        submitted: z.boolean().optional(),
      })
      .parse(req.body);
    const userId = req.user!.sub;
    const progress = await prisma.projectProgress.upsert({
      where: { userId_projectId: { userId, projectId: req.params.projectId } },
      create: {
        userId,
        projectId: req.params.projectId,
        repoUrl: body.repoUrl ?? null,
        liveUrl: body.liveUrl ?? null,
        notes: body.notes ?? null,
        submittedAt: body.submitted ? new Date() : null,
      },
      update: {
        ...(body.repoUrl !== undefined ? { repoUrl: body.repoUrl } : {}),
        ...(body.liveUrl !== undefined ? { liveUrl: body.liveUrl } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.submitted !== undefined ? { submittedAt: body.submitted ? new Date() : null } : {}),
      },
    });
    res.json({ progress });
  }),
);

/* ---------------------------------------------------------------- dashboard */

learnRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub;
    const [user, enrollment, totalLessons, doneLessons, totalProblems, solvedProblems, quizPasses, dueCards, activity] =
      await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        prisma.enrollment.findFirst({
          where: { userId, track: { slug: 'full-stack-30' } },
          include: { track: true },
        }),
        prisma.lesson.count(),
        prisma.lessonProgress.count({ where: { userId, completedAt: { not: null } } }),
        prisma.codeProblem.count(),
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
        prisma.flashcardReview.count({ where: { userId, dueAt: { lte: new Date() } } }),
        prisma.activity.findMany({
          where: { userId, date: { gte: new Date(Date.now() - 120 * 86_400_000) } },
          orderBy: { date: 'asc' },
        }),
      ]);

    const today = await prisma.activity.findUnique({
      where: { userId_date: { userId, date: dayKey() } },
    });

    // Next unfinished day.
    const days = await prisma.day.findMany({
      where: { track: { slug: 'full-stack-30' } },
      orderBy: { number: 'asc' },
      include: { lessons: { select: { id: true } } },
    });
    const completedLessonIds = new Set(
      (
        await prisma.lessonProgress.findMany({
          where: { userId, completedAt: { not: null } },
          select: { lessonId: true },
        })
      ).map((r) => r.lessonId),
    );
    const nextDay =
      days.find((d) => d.lessons.some((l) => !completedLessonIds.has(l.id))) ?? days[days.length - 1];

    res.json({
      user: { ...user, passwordHash: undefined, ...levelFor(user.xp) },
      enrollment,
      today: {
        minutes: today?.minutes ?? 0,
        xp: today?.xp ?? 0,
        goalMinutes: user.dailyGoalMinutes,
        goalPct: Math.min(100, Math.round(((today?.minutes ?? 0) / user.dailyGoalMinutes) * 100)),
      },
      totals: {
        lessons: { done: doneLessons, total: totalLessons },
        problems: { done: solvedProblems.length, total: totalProblems },
        quizzes: { done: quizPasses.length, total: 30 },
        dueCards,
      },
      nextDay: nextDay ? { number: nextDay.number, title: nextDay.title } : null,
      heatmap: activity.map((a) => ({
        date: a.date.toISOString().slice(0, 10),
        minutes: a.minutes,
        xp: a.xp,
      })),
    });
  }),
);

learnRouter.get(
  '/leaderboard',
  asyncHandler(async (_req, res) => {
    const top = await prisma.user.findMany({
      orderBy: { xp: 'desc' },
      take: 20,
      select: { id: true, name: true, avatarUrl: true, xp: true, streak: true },
    });
    res.json({ leaderboard: top.map((u, i) => ({ rank: i + 1, ...u, ...levelFor(u.xp) })) });
  }),
);
