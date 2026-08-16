// CodeNinja — the "Ask Sensei" tutor.
//
// ⚠ REDACTION RULE — read before editing.
// The tutor answers the learner directly, so anything that reaches its context is one question
// away from being read out loud. Reference solutions, quiz answer keys and hidden test assertions
// must never enter it. Two layers enforce that and both must stay:
//   1. loadContext() reads problems with a narrow `select` that simply does not list solutionCode,
//      and filters tests to `hidden: false`. Quiz rows are never queried at all.
//   2. toProblemContext() whitelists fields into ProblemContext, which has no solutionCode field.
// The system prompt refusing to hand out answers is the second line of defence, not the first.

import { prisma } from '../prisma';
import { callModel, resolveTutor } from './tutorProviders';

const LESSON_BODY_LIMIT = 7000;
const CODE_LIMIT = 4000;

export { resolveTutor } from './tutorProviders';
export const tutorEnabled = () => resolveTutor() !== null;

/** Where in the course the learner is standing, as derived from the route. */
export type TutorRef = {
  dayNumber?: number;
  lessonSlug?: string;
  problemSlug?: string;
};

type ProblemContext = {
  title: string;
  difficulty: string;
  runtime: string;
  statement: string;
  starterCode: string;
  hints: string[];
  visibleTests: { name: string; assertion: string }[];
};

type TutorContext = {
  day?: { number: number; title: string; summary: string; objectives: string[]; technologies: string[] };
  lesson?: { title: string; body: string };
  problem?: ProblemContext;
};

/** Whitelists fields into the shape the model sees. Adding solutionCode here is the only way to leak it. */
function toProblemContext(p: {
  title: string;
  difficulty: string;
  runtime: string;
  statement: string;
  starterCode: string;
  hints: string[];
  tests: { name: string; assertion: string }[];
}): ProblemContext {
  return {
    title: p.title,
    difficulty: p.difficulty,
    runtime: p.runtime,
    statement: p.statement,
    starterCode: p.starterCode,
    hints: p.hints,
    visibleTests: p.tests.map((t) => ({ name: t.name, assertion: t.assertion })),
  };
}

export async function loadContext(ref: TutorRef): Promise<TutorContext> {
  if (!ref.dayNumber) return {};

  const day = await prisma.day.findFirst({
    where: { number: ref.dayNumber, track: { slug: 'full-stack-30' } },
    select: { id: true, number: true, title: true, summary: true, objectives: true, technologies: true },
  });
  if (!day) return {};

  const context: TutorContext = {
    day: {
      number: day.number,
      title: day.title,
      summary: day.summary,
      objectives: day.objectives,
      technologies: day.technologies,
    },
  };

  if (ref.lessonSlug) {
    const lesson = await prisma.lesson.findFirst({
      where: { dayId: day.id, slug: ref.lessonSlug },
      select: { title: true, body: true },
    });
    if (lesson) {
      context.lesson = { title: lesson.title, body: lesson.body.slice(0, LESSON_BODY_LIMIT) };
    }
  }

  if (ref.problemSlug) {
    // The select below is the first redaction layer — solutionCode is deliberately absent.
    const problem = await prisma.codeProblem.findFirst({
      where: { dayId: day.id, slug: ref.problemSlug },
      select: {
        title: true,
        difficulty: true,
        runtime: true,
        statement: true,
        starterCode: true,
        hints: true,
        tests: {
          where: { hidden: false },
          orderBy: { order: 'asc' },
          select: { name: true, assertion: true },
        },
      },
    });
    if (problem) context.problem = toProblemContext(problem);
  }

  return context;
}

const PERSONA = `You are Sensei, the in-app tutor for CodeNinja — a 30-day full-stack TypeScript course.
You are talking to a learner who is working through the material right now.

How you answer:
- Explain the concept and point at the specific line or idea that is wrong. Be concrete.
- Prefer a small illustrative snippet over a wall of code.
- Keep it short: a few sentences for a quick question, a couple of paragraphs at most.
- Use markdown. Use fenced code blocks for code.

What you never do:
- Never write out a complete working solution to the exercise the learner is on, even if asked
  directly, and even if they say they have already solved it or are stuck. Give the next step or
  the missing idea instead.
- If they want the full answer, tell them the platform unlocks it for them once they pass the
  problem or after three attempts.
- Never invent course content. If something is not in the context below, say you are not sure.`;

function renderContext(context: TutorContext, code?: string): string {
  const parts: string[] = [];

  if (context.day) {
    const d = context.day;
    parts.push(
      `## Where the learner is\nDay ${d.number} — ${d.title}\n${d.summary}\n` +
        `Objectives: ${d.objectives.join('; ')}\nTechnologies: ${d.technologies.join(', ')}`,
    );
  }
  if (context.lesson) {
    parts.push(`## Lesson they are reading: ${context.lesson.title}\n${context.lesson.body}`);
  }
  if (context.problem) {
    const p = context.problem;
    const tests = p.visibleTests.length
      ? p.visibleTests.map((t) => `- ${t.name}: ${t.assertion}`).join('\n')
      : '(none visible)';
    parts.push(
      `## Exercise they are on: ${p.title} (${p.difficulty}, ${p.runtime})\n${p.statement}\n\n` +
        `### Starter code\n\`\`\`\n${p.starterCode}\n\`\`\`\n\n` +
        `### Author's hints\n${p.hints.map((h) => `- ${h}`).join('\n')}\n\n` +
        `### Visible tests\n${tests}\n\n` +
        `You have not been given the reference solution or the hidden tests. Do not guess at them ` +
        `and do not claim to know what the hidden tests check.`,
    );
  }
  if (code?.trim()) {
    parts.push(`## The learner's current code\n\`\`\`\n${code.slice(0, CODE_LIMIT)}\n\`\`\``);
  }

  return parts.length ? parts.join('\n\n') : 'The learner is not on a specific lesson or exercise.';
}

export type TutorReply = { reply: string; provider: string; model: string; refused: boolean };

export async function askTutor(opts: {
  message: string;
  ref: TutorRef;
  code?: string;
}): Promise<TutorReply> {
  const cfg = resolveTutor();
  if (!cfg) throw new Error('askTutor called with no provider configured');

  const context = await loadContext(opts.ref);
  const reply = await callModel(cfg, {
    persona: PERSONA,
    context: renderContext(context, opts.code),
    message: opts.message,
  });

  return {
    reply: reply.text,
    provider: cfg.provider,
    model: reply.model,
    refused: reply.refused,
  };
}
