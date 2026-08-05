import type { DaySpec } from './types';
import day01 from './days/day-01';
import day02 from './days/day-02';
import day03 from './days/day-03';
import day04 from './days/day-04';
import day05 from './days/day-05';
import day06 from './days/day-06';
import day07 from './days/day-07';
import day08 from './days/day-08';
import day09 from './days/day-09';
import day10 from './days/day-10';
import day11 from './days/day-11';
import day12 from './days/day-12';
import day13 from './days/day-13';
import day14 from './days/day-14';
import day15 from './days/day-15';
import day16 from './days/day-16';
import day17 from './days/day-17';
import day18 from './days/day-18';
import day19 from './days/day-19';
import day20 from './days/day-20';
import day21 from './days/day-21';
import day22 from './days/day-22';
import day23 from './days/day-23';
import day24 from './days/day-24';
import day25 from './days/day-25';
import day26 from './days/day-26';
import day27 from './days/day-27';
import day28 from './days/day-28';
import day29 from './days/day-29';
import day30 from './days/day-30';

export * from './types';

export const days: DaySpec[] = [
  day01,
  day02,
  day03,
  day04,
  day05,
  day06,
  day07,
  day08,
  day09,
  day10,
  day11,
  day12,
  day13,
  day14,
  day15,
  day16,
  day17,
  day18,
  day19,
  day20,
  day21,
  day22,
  day23,
  day24,
  day25,
  day26,
  day27,
  day28,
  day29,
  day30,
];

export const track = {
  slug: 'full-stack-30',
  title: 'Full-Stack TypeScript in 30 Days',
  tagline: 'One language, the whole stack — frontend, backend, data and the pipeline that ships it.',
  description:
    'A day-by-day sprint through the full-stack roadmap, JavaScript and TypeScript first: HTML/CSS/JS foundations, React and Next.js, Node, NestJS and tRPC, relational and NoSQL data layers, caching, and the DevOps chain that ships it all. Python and Go get one day as a deliberate look over the fence. Every day pairs lessons with a code playground, a quiz, flashcards and a milestone project.',
  weeks: [
    { week: 1, title: 'Frontend Core', days: [1, 2, 3, 4, 5, 6, 7] },
    { week: 2, title: 'React, State & Next.js', days: [8, 9, 10, 11, 12, 13, 14] },
    { week: 3, title: 'Full-Stack TypeScript', days: [15, 16, 17, 18, 19, 20, 21] },
    { week: 4, title: 'Data Layer & Beyond JS', days: [22, 23, 24, 25, 26] },
    { week: 5, title: 'DevOps & Capstone', days: [27, 28, 29, 30] },
  ],
};

export function getDay(n: number): DaySpec | undefined {
  return days.find((d) => d.day === n);
}

export const stats = {
  days: days.length,
  lessons: days.reduce((n, d) => n + d.lessons.length, 0),
  quizQuestions: days.reduce((n, d) => n + d.quiz.length, 0),
  problems: days.reduce((n, d) => n + d.problems.length, 0),
  flashcards: days.reduce((n, d) => n + d.flashcards.length, 0),
  projects: days.filter((d) => d.project).length,
  totalMinutes: days.reduce((n, d) => n + d.estimatedMinutes, 0),
  technologies: Array.from(new Set(days.flatMap((d) => d.technologies))).sort(),
};
