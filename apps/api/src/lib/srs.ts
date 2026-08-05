/**
 * SM-2 spaced repetition.
 *
 * Grade scale (SuperMemo 2):
 *   0 blackout · 1 wrong, remembered on seeing · 2 wrong but felt close
 *   3 correct with serious difficulty · 4 correct after hesitation · 5 perfect
 *
 * The UI collapses this to four buttons: Again(1) Hard(3) Good(4) Easy(5).
 */
export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export interface SrsNext extends SrsState {
  dueAt: Date;
}

export function schedule(state: SrsState, grade: number, now = new Date()): SrsNext {
  const g = Math.max(0, Math.min(5, Math.round(grade)));
  let { easeFactor, intervalDays, repetitions, lapses } = state;

  if (g < 3) {
    // Lapse: back to the start of the ladder, but keep some of the ease.
    repetitions = 0;
    intervalDays = 0;
    lapses += 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
    // Show it again in 10 minutes rather than tomorrow.
    return { easeFactor, intervalDays, repetitions, lapses, dueAt: new Date(now.getTime() + 10 * 60_000) };
  }

  repetitions += 1;
  if (repetitions === 1) intervalDays = 1;
  else if (repetitions === 2) intervalDays = 6;
  else intervalDays = Math.round(intervalDays * easeFactor);

  easeFactor = easeFactor + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02));
  easeFactor = Math.max(1.3, Math.min(2.8, easeFactor));

  // Fuzz ±10% so big decks don't clump on one day.
  const fuzz = intervalDays > 3 ? 1 + (Math.random() * 0.2 - 0.1) : 1;
  const days = Math.max(1, Math.round(intervalDays * fuzz));

  return {
    easeFactor,
    intervalDays,
    repetitions,
    lapses,
    dueAt: new Date(now.getTime() + days * 86_400_000),
  };
}

export const NEW_CARD: SrsState = {
  easeFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
  lapses: 0,
};
