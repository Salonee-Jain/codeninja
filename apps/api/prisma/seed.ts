/**
 * Seeds the whole 30-day track from @codeninja/content, plus a demo learner
 * with a plausible amount of progress so the dashboard isn't empty on day one.
 *
 *   npm run db:seed
 */
import { PrismaClient, type Difficulty, type Pillar, type ResourceKind, type Runtime } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { days, track as trackSpec, stats } from '@codeninja/content';

const prisma = new PrismaClient();

async function main() {
  console.log('\n  Seeding CodeNinja …\n');

  // Content is idempotent: wipe and rebuild the catalogue, keep learners.
  await prisma.track.deleteMany({ where: { slug: trackSpec.slug } });

  const track = await prisma.track.create({
    data: {
      slug: trackSpec.slug,
      title: trackSpec.title,
      tagline: trackSpec.tagline,
      description: trackSpec.description,
    },
  });

  for (const spec of days) {
    const day = await prisma.day.create({
      data: {
        trackId: track.id,
        number: spec.day,
        week: spec.week,
        pillar: spec.pillar as Pillar,
        title: spec.title,
        summary: spec.summary,
        estimatedMinutes: spec.estimatedMinutes,
        objectives: spec.objectives,
        technologies: spec.technologies,
        lessons: {
          create: spec.lessons.map((l, i) => ({
            slug: l.slug,
            title: l.title,
            estimatedMinutes: l.estimatedMinutes,
            body: l.body,
            order: i,
          })),
        },
        quiz: {
          create: spec.quiz.map((q, i) => ({
            prompt: q.prompt,
            options: q.options as unknown as string[],
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            difficulty: q.difficulty as Difficulty,
            order: i,
          })),
        },
        flashcards: {
          create: spec.flashcards.map((f, i) => ({
            front: f.front,
            back: f.back,
            tags: f.tags,
            order: i,
          })),
        },
        resources: {
          create: spec.resources.map((r, i) => ({
            label: r.label,
            url: r.url,
            kind: r.kind as ResourceKind,
            order: i,
          })),
        },
      },
    });

    for (const [i, p] of spec.problems.entries()) {
      await prisma.codeProblem.create({
        data: {
          dayId: day.id,
          slug: p.slug,
          title: p.title,
          difficulty: p.difficulty as Difficulty,
          runtime: p.runtime as Runtime,
          language: p.language ?? null,
          statement: p.statement,
          starterCode: p.starterCode,
          solutionCode: p.solutionCode,
          hints: p.hints,
          sqlSetup: p.sqlSetup ?? null,
          xp: p.xp,
          order: i,
          tests: {
            create: p.tests.map((t, j) => ({
              name: t.name,
              assertion: t.assertion,
              hidden: t.hidden ?? false,
              points: t.points ?? 1,
              order: j,
            })),
          },
        },
      });
    }

    if (spec.project) {
      await prisma.project.create({
        data: {
          dayId: day.id,
          slug: spec.project.slug,
          title: spec.project.title,
          brief: spec.project.brief,
          estimatedHours: spec.project.estimatedHours,
          stretchGoals: spec.project.stretchGoals,
          repoStarter: spec.project.repoStarter ?? null,
          tasks: {
            create: spec.project.checklist.map((label, i) => ({ label, order: i })),
          },
        },
      });
    }

    process.stdout.write(`\r  day ${String(spec.day).padStart(2, '0')}/30  ${spec.title.slice(0, 48).padEnd(50)}`);
  }
  console.log('\n');

  // ── demo learner ────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('ninja1234', 12);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@codeninja.dev' },
    update: {},
    create: {
      email: 'demo@codeninja.dev',
      name: 'Demo Learner',
      passwordHash,
      timezone: 'Australia/Sydney',
      dailyGoalMinutes: 300,
    },
  });

  await prisma.enrollment.upsert({
    where: { userId_trackId: { userId: demo.id, trackId: track.id } },
    update: { currentDay: 3 },
    create: {
      userId: demo.id,
      trackId: track.id,
      currentDay: 3,
      targetEndAt: new Date(Date.now() + 28 * 86_400_000),
    },
  });

  // Complete days 1-2 so the dashboard has something to show.
  const firstTwo = await prisma.day.findMany({
    where: { trackId: track.id, number: { lte: 2 } },
    include: { lessons: true, quiz: true },
  });
  let xp = 0;
  for (const d of firstTwo) {
    for (const l of d.lessons) {
      await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: demo.id, lessonId: l.id } },
        update: { completedAt: new Date(), scrollPct: 100 },
        create: {
          userId: demo.id,
          lessonId: l.id,
          completedAt: new Date(),
          scrollPct: 100,
          secondsSpent: l.estimatedMinutes * 60,
        },
      });
      xp += 20;
    }
    if (d.quiz.length) {
      await prisma.quizAttempt.create({
        data: {
          userId: demo.id,
          dayId: d.id,
          score: d.quiz.length - 1,
          total: d.quiz.length,
          passed: true,
          completedAt: new Date(),
        },
      });
      xp += 50;
    }
  }

  const todayUtc = new Date();
  for (let i = 0; i < 5; i++) {
    const date = new Date(
      Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate() - i),
    );
    await prisma.activity.upsert({
      where: { userId_date: { userId: demo.id, date } },
      update: {},
      create: {
        userId: demo.id,
        date,
        minutes: [280, 310, 240, 300, 180][i],
        xp: [120, 140, 90, 130, 60][i],
        lessons: 3,
        problems: 2,
        cards: 12,
      },
    });
  }

  await prisma.user.update({
    where: { id: demo.id },
    data: { xp, streak: 5, longestStreak: 5, lastActiveOn: new Date() },
  });

  console.log('  ✓ seeded');
  console.log(`    ${stats.days} days · ${stats.lessons} lessons · ${stats.problems} problems`);
  console.log(`    ${stats.quizQuestions} quiz questions · ${stats.flashcards} flashcards · ${stats.projects} projects`);
  console.log(`    ${stats.technologies.length} technologies · ~${Math.round(stats.totalMinutes / 60)} h of study`);
  console.log('\n    demo login  demo@codeninja.dev / ninja1234\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
