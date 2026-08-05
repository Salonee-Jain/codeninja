import { prisma } from '../prisma';

/** UTC calendar day for the given instant, as a Date at midnight. */
export function dayKey(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const DAY_MS = 86_400_000;

export interface ActivityDelta {
  xp?: number;
  minutes?: number;
  lessons?: number;
  problems?: number;
  cards?: number;
}

/**
 * Records activity for today, bumps lifetime XP, and recomputes the streak.
 * Streak rules: any activity today keeps it alive; a gap of one full day resets it.
 */
export async function recordActivity(userId: string, delta: ActivityDelta) {
  const today = dayKey();

  await prisma.activity.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      date: today,
      xp: delta.xp ?? 0,
      minutes: delta.minutes ?? 0,
      lessons: delta.lessons ?? 0,
      problems: delta.problems ?? 0,
      cards: delta.cards ?? 0,
    },
    update: {
      xp: { increment: delta.xp ?? 0 },
      minutes: { increment: delta.minutes ?? 0 },
      lessons: { increment: delta.lessons ?? 0 },
      problems: { increment: delta.problems ?? 0 },
      cards: { increment: delta.cards ?? 0 },
    },
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { streak: true, longestStreak: true, lastActiveOn: true },
  });

  let streak = user.streak;
  const last = user.lastActiveOn ? dayKey(user.lastActiveOn) : null;
  if (!last) streak = 1;
  else {
    const gap = Math.round((today.getTime() - last.getTime()) / DAY_MS);
    if (gap === 0) streak = Math.max(1, streak);
    else if (gap === 1) streak = streak + 1;
    else streak = 1;
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      xp: { increment: delta.xp ?? 0 },
      streak,
      longestStreak: Math.max(user.longestStreak, streak),
      lastActiveOn: new Date(),
    },
    select: { xp: true, streak: true, longestStreak: true },
  });
}

/** 100 XP for level 1, growing ~1.35× per level. */
export function levelFor(xp: number) {
  let level = 1;
  let need = 100;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    level += 1;
    need = Math.round(need * 1.35);
  }
  return { level, intoLevel: xp - acc, nextLevelAt: need, floor: acc };
}
