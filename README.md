# CodeNinja

A full-stack learning platform for the **Full-Stack TypeScript in 30 Days** track — one
language for the whole stack, turned into a day-by-day curriculum with lessons, an in-browser
IDE, server-graded quizzes, spaced-repetition flashcards and milestone projects.

```
30 days · 118 lessons · 83 coding problems · 240 quiz questions
360 flashcards · 5 projects · 60 technologies · ~167 hours
```

React and **Next.js** on the front, Node/Express, **NestJS** and **tRPC** on the back, real
databases underneath, Docker/Kubernetes/CI to ship it. Python and Go get one deliberate day.

---

## What's in the box

| Piece | Stack |
| --- | --- |
| **Web** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Monaco Editor |
| **API** | Node.js, Express, TypeScript, Zod, JWT (access + rotating refresh), bcrypt |
| **Data** | PostgreSQL via Prisma — 20 models covering content, progress, submissions and SRS |
| **Judge** | `node:vm` for JavaScript, linkedom + a CSS-cascade shim for HTML, sql.js (SQLite) for SQL, optional Piston proxy for Python and Go |
| **Content** | A typed `@codeninja/content` package — 1.6 MB of authored curriculum, validated in CI |

### The learning loop

- **Read** — 3–4 lessons per day, rendered from markdown with syntax highlighting, tables and callouts. Progress, scroll position and per-lesson notes are saved.
- **Practise** — Monaco IDE with `Run` (instant, in a Web Worker) and `Submit` (authoritative, server-side). Hidden tests, progressive hints, and a solution that unlocks after a pass or three honest attempts.
- **Prove** — an 8-question quiz gate per day, 70% to pass, with an explanation for every option. The answer key never leaves the server.
- **Retain** — SM-2 spaced repetition over 360 flashcards, with Again / Hard / Good / Easy grading.
- **Build** — five milestone projects (days 7, 14, 21, 26, 30) with acceptance checklists and a submission form.
- **Track** — XP, levels, streaks, a daily-goal ring and a contribution heatmap.

---

## Quick start

You need **Node 22+** and **PostgreSQL 16** (or Docker).

```bash
git clone <your-fork> codeninja && cd codeninja
cp .env.example .env          # then edit the JWT secrets

docker compose up -d postgres # or point DATABASE_URL at your own Postgres
npm install
npm run db:migrate
npm run db:seed               # ~15s: loads all 30 days
npm run dev                   # api :4000, web :3000
```

Open <http://localhost:3000> and sign in with the seeded account:

```
demo@codeninja.dev / ninja1234
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API and web together, both watching |
| `npm run build` | Builds content → api → web |
| `npm run db:migrate` | Generates the Prisma client and applies migrations |
| `npm run db:seed` | Rebuilds the course catalogue from `@codeninja/content` |
| `npm run db:reset` | Drops, re-migrates and re-seeds |
| `npm run content:validate` | Schema-checks all content **and executes every reference solution against its own tests** |
| `npm run typecheck` | `tsc --noEmit` across all workspaces |
| `node scripts/smoke.mjs` | 60+ end-to-end API assertions against a running server |
| `node scripts/ui-smoke.mjs` | 34 browser assertions (Playwright), with screenshots to `/tmp/shots`
| `npm run plan` | Regenerates the standalone HTML study plan |

---

## Architecture

```
codeninja/
├─ packages/content/          @codeninja/content — the curriculum as typed data
│  ├─ src/types.ts            DaySpec: the schema every day must satisfy
│  ├─ src/days/day-01..30.ts  one file per day
│  ├─ scripts/validate.ts     runs every solution against every assertion
│  └─ AUTHORING.md            how to write or extend a day
├─ apps/api/
│  ├─ prisma/schema.prisma    20 models
│  ├─ prisma/seed.ts          content → database
│  └─ src/
│     ├─ lib/judge.ts         the four sandboxes
│     ├─ lib/cssShim.ts       a teaching-grade CSS cascade resolver
│     ├─ lib/srs.ts           SM-2
│     ├─ lib/gamify.ts        XP, levels, streaks, activity
│     └─ routes/              auth · track · learn
└─ apps/web/
   ├─ src/app/                landing · dashboard · roadmap · day · lesson · practice · quiz · project · review · leaderboard
   └─ src/components/         CodePlayground · Editor · Markdown · AuthProvider · ui
```

### How grading works

`Run` grades in the browser: JavaScript executes in a **Web Worker** that is terminated on
timeout, so an infinite loop costs you a click rather than the tab. HTML is parsed with
`DOMParser` and asserted against.

`Submit` always goes to the server. The API re-runs **every** test — including hidden ones —
in `node:vm` with `require` removed and a hard timeout, and only a server-side pass moves the
XP counter. Nothing in devtools can fake a solve.

SQL problems run against real SQLite compiled to WebAssembly, so `EXPLAIN`, CTEs and window
functions behave as they should. The two Python and Go problems on day 25 proxy to a
Piston-compatible executor when `REMOTE_EXECUTOR_URL` is set:

```bash
docker compose --profile executor up -d piston
# then set REMOTE_EXECUTOR_URL=http://localhost:2000/api/v2
```

Without it, those two problems report a clear "needs an executor" message and the day's
JavaScript problem still works.

### Sandbox realms — a note for anyone extending the judge

The vm context is created *without* host intrinsics (`Object`, `Array`, `JSON`, `Map`, …).
Injecting them shadows the context's own, so an object literal written inside the sandbox
would carry the context's `Object.prototype` while the identifier `Object` resolved to the
host's — making `Object.getPrototypeOf(x) === Object.prototype` false for a plain object.
For the same reason, assertions run in the *same* context as the solution, and `deepEqual`
type-tests with `Object.prototype.toString` rather than `instanceof`.

### The CSS shim

`apps/api/src/lib/cssShim.ts` implements just enough cascade to grade CSS exercises honestly:
selector matching, source order, inline-style precedence, custom-property **inheritance**,
`var()` resolution, and shorthand expansion (`padding` → `padding-top`, `flex` → `flex-grow`,
`gap` → `column-gap`, `place-items` → `align-items`…). At-rule blocks are skipped rather than
flattened, so a `@media (max-width: …)` override can't silently defeat the base rule it is
meant to replace. The identical file ships to the browser sandbox, so `Run` and `Submit`
always agree.

---

## Theme

The app ships with both **dark** and **light** themes. A toggle button (sun/moon icon) in the
top-right of the navigation bar switches between them. The choice is saved to `localStorage`
(key `cn_theme`) and persists across sessions.

Dark mode is the default. The implementation uses Tailwind's `darkMode: 'class'` strategy — a
`.dark` class on `<html>` activates all `dark:` utility variants. The `ThemeProvider` React
context (`src/components/ThemeProvider.tsx`) manages the class and exposes `useTheme()` for any
component that needs to read or toggle the current theme.

The Monaco code editor has matching custom themes (`ninja-dark` and `ninja-light`) that switch
automatically with the rest of the UI.

---

## The 30 days

See [CURRICULUM.md](./CURRICULUM.md) for the full day-by-day plan and a coverage matrix
mapping every box on the roadmap poster to the day that teaches it.

| Week | Days | Focus |
| --- | --- | --- |
| 1 | 1–7 | HTML5, CSS3, JavaScript ES6+, Tailwind/Bootstrap/Sass, TypeScript & Git, **Project 1** |
| 2 | 8–14 | React fundamentals & hooks, Redux Toolkit/Zustand/Pinia, Vue 3, **Next.js I & II**, **Project 2** |
| 3 | 15–21 | **Next.js III**, Node & Express REST, auth (JWT/OAuth), GraphQL, **NestJS**, **tRPC + Zod**, **Project 3** |
| 4 | 22–26 | SQL & Postgres/MySQL/SQL Server, Prisma/Drizzle/TypeORM/Mongoose, MongoDB/Cassandra/DynamoDB, Python & Go, **Project 4 (Redis)** |
| 5 | 27–30 | Docker, Kubernetes, CI/CD & cloud, **Capstone** with Prometheus/Grafana/ELK |

Every day is 4–6 hours: roughly 3.5 hours of lessons, an hour of problems, and the quiz plus
flashcard review.

---

## Extending the curriculum

Days are data, not code. To add or change one, edit `packages/content/src/days/day-NN.ts`
against the `DaySpec` type, then:

```bash
npm run content:validate   # proves every assertion passes against your own solution
npm run db:seed            # reload the catalogue
```

`packages/content/AUTHORING.md` documents the runtime contracts, the escaping rules for
template literals, and the quality bar. The validator is not a formality — it executes every
reference solution against every test case, so a broken exercise cannot reach a learner.

---

## Deployment

```bash
docker build -f apps/api/Dockerfile -t codeninja-api .
docker build -f apps/web/Dockerfile -t codeninja-web \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
```

Both images are multi-stage, run as a non-root user and ship a healthcheck.
`.github/workflows/ci.yml` runs content validation, typechecks, migrations, both builds and
both smoke suites on every push.

---

## Licence

MIT.
