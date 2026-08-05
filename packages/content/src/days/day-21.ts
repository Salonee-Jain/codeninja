import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 21,
  week: 3,
  pillar: 'BACKEND',
  title: 'Project 3 — Production TypeScript API',
  summary: 'Assemble everything from week 3 into one deployable, tested, documented TypeScript API.',
  estimatedMinutes: 360,
  objectives: [
    'Structure a NestJS or Express app in layers — routes/controllers, services, repositories — and justify each boundary',
    'Write unit tests against fakes and integration tests against a real throwaway Postgres',
    'Move slow work off the request path with a job queue that retries with exponential backoff',
    'Apply 12-factor configuration and ship the API as a Docker image with health checks',
    'Expose the same domain over REST, GraphQL and a typesafe tRPC layer without duplicating business logic',
  ],
  technologies: ['NestJS', 'tRPC', 'Express.js', 'RESTful APIs', 'GraphQL', 'JWT', 'PostgreSQL'],
  lessons: [
    {
      slug: 'layered-architecture',
      title: 'Layered Architecture: Routes, Controllers, Services, Repositories',
      estimatedMinutes: 85,
      body: `# Layered Architecture: Routes, Controllers, Services, Repositories

Every Express tutorial ends with a 400-line \`app.js\` where SQL, validation, auth and HTTP status codes are braided together. It works right up until you need to call the same logic from a GraphQL resolver, a cron job and a test.

## The four layers and their one job each

| Layer | Knows about | Must **not** know about |
| --- | --- | --- |
| **Route** | HTTP verbs, paths, which middleware runs | business rules |
| **Controller** | \`req\`/\`res\`, status codes, request shape | SQL, other services' internals |
| **Service** | business rules, orchestration, transactions | \`req\`, \`res\`, HTTP status codes |
| **Repository** | SQL / the ORM, table names | business rules, HTTP |

The rule that makes this work: **dependencies point inward, and the service layer never imports \`express\`.** If your service takes \`(req, res)\` you have a controller with extra steps.

\`\`\`
src/
  routes/tasks.routes.js
  controllers/tasks.controller.js
  services/tasks.service.js
  repositories/tasks.repo.js
  db/pool.js
  middleware/{auth,validate,error}.js
  graphql/{schema,resolvers}.js
  app.js         <- builds the express app, no listen()
  server.js      <- reads config, calls app.listen()
\`\`\`

Splitting \`app.js\` from \`server.js\` is not fussiness — it is what lets Supertest import the app without binding a port.

## Routes

\`\`\`js
// src/routes/tasks.routes.js
import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/tasks.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const createTask = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    dueAt: z.coerce.date().optional(),
  }),
});

export const tasksRouter = Router();

tasksRouter.use(requireAuth);
tasksRouter.get('/', controller.list);
tasksRouter.post('/', validate(createTask), controller.create);
tasksRouter.delete('/:id', requireRole('admin'), controller.remove);
\`\`\`

The route file is a **table of contents**. You should be able to read it and know the entire surface area of the resource, including who is allowed to call what.

## Controllers translate HTTP to the domain

\`\`\`js
// src/controllers/tasks.controller.js
import * as tasks from '../services/tasks.service.js';

export async function list(req, res, next) {
  try {
    const { items, nextCursor } = await tasks.listForUser(req.user.id, {
      limit: Number(req.query.limit ?? 20),
      cursor: req.query.cursor,
    });
    res.json({ data: items, nextCursor });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const task = await tasks.create(req.user.id, req.body);
    res.status(201).location(\`/api/tasks/\${task.id}\`).json(task);
  } catch (err) {
    next(err);
  }
}
\`\`\`

A controller that is more than ten lines is usually hiding a service.

## Services own the rules

\`\`\`js
// src/services/tasks.service.js
import * as repo from '../repositories/tasks.repo.js';
import { queue } from '../jobs/queue.js';
import { AppError } from '../errors.js';

export async function create(userId, input) {
  const open = await repo.countOpen(userId);
  if (open >= 100) {
    throw new AppError('TASK_LIMIT', 'You already have 100 open tasks', 409);
  }

  const task = await repo.insert({ userId, title: input.title.trim(), dueAt: input.dueAt });
  await queue.add('task.created', { taskId: task.id });
  return task;
}

export async function listForUser(userId, { limit, cursor }) {
  const rows = await repo.findByUser(userId, { limit: limit + 1, cursor });
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? items.at(-1).id : null };
}
\`\`\`

Notice what is *not* here: no \`res.status\`, no SQL. That is exactly why the GraphQL resolver can be three lines:

\`\`\`js
// src/graphql/resolvers.js
export const resolvers = {
  Query: {
    tasks: (_p, args, ctx) => tasks.listForUser(ctx.user.id, args),
  },
  Mutation: {
    createTask: (_p, { input }, ctx) => tasks.create(ctx.user.id, input),
  },
};
\`\`\`

**One domain, two transports.** If you had put the logic in the controller you would now be copy-pasting it, and the two copies would drift within a sprint.

## Repositories hide the database

\`\`\`js
// src/repositories/tasks.repo.js
import { pool } from '../db/pool.js';

export async function insert({ userId, title, dueAt }) {
  const { rows } = await pool.query(
    'INSERT INTO tasks (user_id, title, due_at) VALUES ($1, $2, $3) RETURNING *',
    [userId, title, dueAt ?? null],
  );
  return rows[0];
}

export async function findByUser(userId, { limit, cursor }) {
  const { rows } = await pool.query(
    \`SELECT * FROM tasks
       WHERE user_id = $1 AND ($2::bigint IS NULL OR id < $2)
       ORDER BY id DESC
       LIMIT $3\`,
    [userId, cursor ?? null, limit],
  );
  return rows;
}
\`\`\`

Parameterised queries only — string-concatenating user input into SQL is how you get owned. And keyset pagination (\`id < cursor\`) beats \`OFFSET\` once the table is large, because \`OFFSET 100000\` still makes Postgres walk 100,000 rows.

## One error handler, at the end

\`\`\`js
// src/middleware/error.js
export function errorHandler(err, req, res, _next) {
  const status = err.status ?? 500;
  if (status >= 500) req.log?.error({ err }, 'unhandled');
  res.status(status).json({
    error: { code: err.code ?? 'INTERNAL', message: status >= 500 ? 'Internal error' : err.message },
  });
}
\`\`\`

Register it **after** all routes. Never leak a stack trace or a Postgres constraint name to the client — \`duplicate key value violates unique constraint "users_email_key"\` tells an attacker that the email exists.

## When *not* to do this

For a 3-endpoint internal tool, four layers is theatre. The signal that you need them: a second transport, a second caller, or a test you cannot write without a running server. Project 3 has all three.`,
    },
    {
      slug: 'testing-apis',
      title: 'Testing APIs: Unit, Integration, Test Databases & Fixtures',
      estimatedMinutes: 85,
      body: `# Testing APIs: Unit, Integration, Test Databases & Fixtures

An API test suite that mocks the database proves your mocks work. One that hits production proves you are brave. The useful middle is a real, disposable Postgres.

## The two kinds of test you actually need

| | Unit | Integration |
| --- | --- | --- |
| **Under test** | one service/function | route → controller → service → repo → DB |
| **Dependencies** | fakes passed in | real, in a container |
| **Speed** | ~1 ms | ~50–300 ms |
| **Catches** | branch logic, edge cases, error mapping | SQL bugs, migrations, middleware order, serialization |
| **Count** | many | enough to cover each endpoint's happy + auth + validation path |

Skip the middle layer of "controller tests with mocked services" — they mostly assert that you wrote the code you wrote.

## Unit tests need injectable dependencies

The layered design pays off here. Make the service take its repository:

\`\`\`js
// src/services/tasks.service.js
export function makeTaskService({ repo, queue, clock = () => new Date() }) {
  return {
    async create(userId, input) {
      if (await repo.countOpen(userId) >= 100) {
        throw new AppError('TASK_LIMIT', 'Too many open tasks', 409);
      }
      const task = await repo.insert({ userId, title: input.title.trim(), createdAt: clock() });
      await queue.add('task.created', { taskId: task.id });
      return task;
    },
  };
}
\`\`\`

\`\`\`js
// tests/unit/tasks.service.test.js
import { describe, it, expect, vi } from 'vitest';
import { makeTaskService } from '../../src/services/tasks.service.js';

const fakeRepo = (overrides = {}) => ({
  countOpen: vi.fn().mockResolvedValue(0),
  insert: vi.fn(async (row) => ({ id: 1, ...row })),
  ...overrides,
});

describe('taskService.create', () => {
  it('trims the title and enqueues a job', async () => {
    const repo = fakeRepo();
    const queue = { add: vi.fn() };
    const svc = makeTaskService({ repo, queue, clock: () => new Date('2026-01-01') });

    const task = await svc.create('u1', { title: '  Ship it  ' });

    expect(task.title).toBe('Ship it');
    expect(queue.add).toHaveBeenCalledWith('task.created', { taskId: 1 });
  });

  it('rejects past the open-task limit', async () => {
    const svc = makeTaskService({ repo: fakeRepo({ countOpen: async () => 100 }), queue: { add: vi.fn() } });
    await expect(svc.create('u1', { title: 'x' })).rejects.toMatchObject({ status: 409 });
  });
});
\`\`\`

Injecting \`clock\` looks pedantic until you write a test about due dates. **Time and randomness are dependencies.**

## Integration tests need a real database

Use Testcontainers so the database is created and destroyed by the test run — no shared staging DB, no "works on my machine".

\`\`\`js
// tests/integration/setup.js
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { migrate } from '../../src/db/migrate.js';

let container;

export async function setup() {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env.DATABASE_URL = container.getConnectionUri();
  await migrate();
}

export async function teardown() {
  await container.stop();
}
\`\`\`

Running your **real migrations** against the test DB is half the value: a migration that fails on an empty database fails here, in CI, and not at 2 a.m.

> If you cannot run Docker in CI, the fallback order is: a dedicated Postgres service container → a per-worker schema in one shared Postgres → SQLite. SQLite is last because it silently accepts SQL that Postgres rejects, so it hides exactly the bugs integration tests exist to find.

## Isolation between tests

Pick one strategy and stick to it:

1. **Truncate between tests** — simple and fast enough.
2. **Wrap each test in a transaction and roll back** — fastest, but breaks if the code under test manages its own transactions.

\`\`\`js
beforeEach(async () => {
  await pool.query('TRUNCATE tasks, users RESTART IDENTITY CASCADE');
});
\`\`\`

Never let tests depend on each other's leftovers. A suite that only passes in one order is not a suite.

## Fixtures: factories, not JSON dumps

\`\`\`js
// tests/factories.js
let seq = 0;

export async function makeUser(overrides = {}) {
  seq++;
  const { rows } = await pool.query(
    'INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3) RETURNING *',
    [\`user\${seq}@test.dev\`, await hash('pw'), overrides.role ?? 'user'],
  );
  return rows[0];
}
\`\`\`

A factory generates only what the test cares about and randomises the rest. A giant \`seed.json\` becomes a shared global that every test secretly depends on, and nobody can ever delete a row from it.

## The endpoint test

\`\`\`js
import request from 'supertest';
import { app } from '../../src/app.js';

describe('POST /api/tasks', () => {
  it('creates a task for the authenticated user', async () => {
    const user = await makeUser();
    const token = signToken(user);

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', \`Bearer \${token}\`)
      .send({ title: 'Write the report' })
      .expect(201);

    expect(res.body).toMatchObject({ title: 'Write the report', done: false });
    expect(res.headers.location).toMatch(/^\\/api\\/tasks\\/\\d+$/);
  });

  it('401s without a token', async () => {
    await request(app).post('/api/tasks').send({ title: 'x' }).expect(401);
  });

  it('422s on an empty title', async () => {
    const token = signToken(await makeUser());
    await request(app).post('/api/tasks').set('Authorization', \`Bearer \${token}\`).send({ title: '' }).expect(422);
  });
});
\`\`\`

Supertest binds an ephemeral port itself, which is why \`app.js\` must not call \`listen\`.

For each endpoint write **three** tests: the happy path, the unauthorised path, and the invalid-input path. That trio catches the overwhelming majority of real regressions, and it is a checklist you can finish rather than an aspiration to "get coverage up".

## Testing GraphQL

Same idea, one transport-level test per operation:

\`\`\`js
const res = await request(app)
  .post('/graphql')
  .set('Authorization', \`Bearer \${token}\`)
  .send({ query: '{ tasks(limit: 2) { id title } }' })
  .expect(200);

expect(res.body.errors).toBeUndefined();
expect(res.body.data.tasks).toHaveLength(2);
\`\`\`

Note GraphQL returns **200 with an \`errors\` array** for field-level failures, so \`.expect(200)\` proves nothing on its own — always assert on \`body.errors\`.`,
    },
    {
      slug: 'background-jobs-and-queues',
      title: 'Background Jobs, Queues, Retries & Idempotency',
      estimatedMinutes: 70,
      body: `# Background Jobs, Queues, Retries & Idempotency

If a request handler sends an email, generates a PDF or calls a flaky third party, your API's latency and uptime are now that vendor's latency and uptime.

## What belongs on a queue

- Anything slow (> ~200 ms) that the caller does not need the result of.
- Anything that talks to an external system that can be down.
- Anything fan-out shaped: one action, N notifications.
- Anything scheduled or recurring.

What does *not*: anything the response body depends on. Do not make the client poll for something you could have computed in 5 ms.

## The shape of a queue

A producer pushes a **job** (a name plus a JSON payload) to a broker — Redis via BullMQ, Postgres via pg-boss, or SQS. A separate **worker process** pulls jobs and runs a handler. Crucially the worker is a *different process*: it crashes without taking your API with it, and it scales independently.

\`\`\`js
// src/jobs/queue.js
import { Queue } from 'bullmq';

export const queue = new Queue('tasks', {
  connection: { url: process.env.REDIS_URL },
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
\`\`\`

\`\`\`js
// src/jobs/worker.js
import { Worker } from 'bullmq';
import { sendTaskCreatedEmail } from '../services/notifications.service.js';

const worker = new Worker(
  'tasks',
  async (job) => {
    if (job.name === 'task.created') {
      await sendTaskCreatedEmail(job.data.taskId);
    }
  },
  { connection: { url: process.env.REDIS_URL }, concurrency: 10 },
);

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, attempts: job?.attemptsMade, err }, 'job failed');
});

process.on('SIGTERM', async () => { await worker.close(); process.exit(0); });
\`\`\`

That SIGTERM handler is what makes deploys safe: \`worker.close()\` stops accepting new jobs and lets in-flight ones finish instead of being killed mid-write.

## Retries and exponential backoff

Retrying immediately on failure is how you turn a brief downstream blip into a self-inflicted DDoS. Exponential backoff spreads the retries out:

\`\`\`
delay = base * 2 ** (attempt - 1)     // 1s, 2s, 4s, 8s, 16s
\`\`\`

Add **jitter** — a random factor — or every client that failed during the same outage retries in lockstep and hammers the service the instant it recovers:

\`\`\`js
export function backoffMs(attempt, { base = 1000, factor = 2, max = 30000, jitter = true } = {}) {
  const raw = Math.min(max, base * factor ** (attempt - 1));
  return jitter ? Math.round(raw * (0.5 + Math.random() * 0.5)) : raw;
}
\`\`\`

And retry only what is **retryable**. A 500 or a timeout: retry. A 400 or a validation error: retrying is pointless, so fail the job immediately and move it to the dead-letter queue.

## Idempotency is not optional

At-least-once delivery is the norm. Your handler *will* run twice for the same job — the worker dies after sending the email but before acknowledging, and the job comes back. Design for it:

- Derive a stable key from the payload (\`email:task-created:\${taskId}\`), record it, and no-op if it exists.
- Prefer \`INSERT ... ON CONFLICT DO NOTHING\` over \`SELECT then INSERT\`.
- Pass an idempotency key to any provider that supports one (Stripe does).

\`\`\`js
async function once(key, fn) {
  const { rowCount } = await pool.query(
    'INSERT INTO job_dedupe (key) VALUES ($1) ON CONFLICT DO NOTHING',
    [key],
  );
  if (rowCount === 0) return;   // already handled
  await fn();
}
\`\`\`

> Never put a whole entity in the job payload. Put the **id**. By the time the job runs the row may have changed, and a stale snapshot in Redis is a bug waiting to happen. The payload should be small, serialisable, and free of secrets.

## Dead-letter queues and visibility

After the final attempt a job should land somewhere a human can see it. Minimum viable ops:

- A failed-jobs list you can inspect and replay.
- A metric: jobs processed, jobs failed, queue depth, oldest-job age.
- An alert on queue depth growing monotonically — that means the workers are down or a poison job is looping.

## The transactional outbox

The subtle bug: you commit the row, then push to Redis, and the process dies between the two. The job is lost forever. The fix is to write the job into a Postgres table **in the same transaction** as the business data, and have a separate poller move rows from that table onto the queue:

\`\`\`sql
BEGIN;
INSERT INTO tasks (...) VALUES (...);
INSERT INTO outbox (topic, payload) VALUES ('task.created', '{"taskId": 42}');
COMMIT;
\`\`\`

Now either both happened or neither did. This is overkill for a side project and essential for payments — know that it exists and why.`,
    },
    {
      slug: 'deployment-and-12-factor',
      title: 'Deployment: 12-Factor Config, Docker & Observability',
      estimatedMinutes: 60,
      body: `# Deployment: 12-Factor Config, Docker & Observability

An API that only runs on your laptop is a prototype. Making it deployable is a small, mechanical set of changes.

## Config comes from the environment

Factor III of the [12-factor app](https://12factor.net/config): **strict separation of config from code**. Anything that differs between dev, staging and production is an environment variable — never a file committed to the repo, never an \`if (env === 'production')\` branch buried in a module.

Validate it once, at boot, and crash loudly if it is wrong:

\`\`\`js
// src/config.js
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
\`\`\`

Failing at boot beats a \`JWT_SECRET\` of \`undefined\` silently signing tokens that anyone can forge. Commit a \`.env.example\` with every key and no values; put \`.env\` in \`.gitignore\`.

## One artefact, promoted

Factor V: build once, run anywhere. The **same image** goes to staging and production; only the environment differs. If you rebuild per environment you are not testing what you ship.

\`\`\`dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
\`\`\`

Points that matter:

- \`npm ci\`, not \`npm install\` — it installs exactly the lockfile.
- Copy \`package*.json\` before the source so the dependency layer stays cached across code changes.
- \`USER node\` — do not run as root inside the container.
- A \`.dockerignore\` with \`node_modules\`, \`.git\`, \`.env\`, \`coverage\`.
- \`CMD ["node", ...]\`, not \`npm start\` — npm swallows signals, and your SIGTERM handler never fires.

## Graceful shutdown

Factor IX: fast startup, graceful shutdown. On SIGTERM, stop accepting connections, drain what is in flight, close the pool, exit.

\`\`\`js
// src/server.js
import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';

const server = app.listen(config.PORT, () => logger.info({ port: config.PORT }, 'listening'));

async function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();   // hard cap
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
\`\`\`

Without this, every deploy 502s whoever was mid-request.

## Health checks that mean something

\`\`\`js
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));   // liveness: am I running?

app.get('/readyz', async (_req, res) => {                          // readiness: can I serve?
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'degraded' });
  }
});
\`\`\`

Keep them distinct. If liveness checks the database, one slow query gets your container **restarted** instead of merely pulled out of the load-balancer rotation.

## Logs are a stream

Factor XI: write structured JSON to stdout and let the platform handle collection. Never write to a log file inside a container.

\`\`\`js
import pino from 'pino';
import pinoHttp from 'pino-http';

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: ['req.headers.authorization', 'req.body.password', '*.token'],
});

app.use(pinoHttp({ logger, genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID() }));
\`\`\`

That \`redact\` list is the difference between a log aggregator and a credential store. And a request id propagated through logs and downstream calls is what turns "the API was slow" into a trace you can actually read.

## Migrations on deploy

Run migrations as a **separate step before** the new containers start, never at app boot — otherwise ten replicas race to apply the same migration. In practice: a CI job, an init container, or a one-off task.

Make migrations backward compatible so the old and new versions can run side by side during a rolling deploy: add a nullable column, deploy code that writes it, backfill, *then* add the NOT NULL in a later release. Never rename a column in a single release.

## Before you call it done

- [ ] Config validated at boot; no secrets in the image or repo
- [ ] Image built once, tagged with the commit SHA
- [ ] \`/healthz\` and \`/readyz\` wired to the platform
- [ ] SIGTERM drains in-flight requests
- [ ] Structured logs with a request id, secrets redacted
- [ ] Migrations run as a discrete, idempotent step
- [ ] Rate limiting, \`helmet\`, and a CORS allow-list on the edge`,
    },
  ],
  quiz: [
    {
      prompt: 'Why must the service layer avoid importing anything from Express?',
      options: [
        'So the same business logic can be called from a GraphQL resolver, a queue worker or a unit test without fabricating req/res objects',
        'Express modules are too large to bundle',
        'Because Express is not compatible with ES modules',
        'To avoid circular imports with the router',
      ],
      correctIndex: 0,
      explanation:
        'The service layer models the domain, not HTTP. Once it depends on `req`/`res` every other caller has to fake an HTTP request, and you end up duplicating the logic for GraphQL.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Why is `app.js` (which builds the Express app) kept separate from `server.js` (which calls `listen`)?',
      options: [
        'It halves the cold-start time',
        'Express requires it since version 5',
        'So tests can import the app and let Supertest bind an ephemeral port, instead of racing a fixed port',
        'So the router can be lazy-loaded',
      ],
      correctIndex: 2,
      explanation:
        'If importing the module starts a server on port 3000, parallel test workers collide and CI flakes. Exporting the app and letting Supertest handle the socket removes the whole class of problem.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'A GraphQL mutation returns HTTP 200 with `{"data": null, "errors": [...]}`. What does that mean for your test?',
      options: [
        'The request failed at the transport layer and should be retried',
        'GraphQL never returns errors with a 200 status',
        'The assertion `.expect(200)` alone is insufficient — you must also assert `body.errors` is undefined',
        'The server is misconfigured; field errors should be 4xx',
      ],
      correctIndex: 2,
      explanation:
        'GraphQL puts field-level and resolver errors in the `errors` array with a 200 transport status by design (partial data is legal). A test that only checks the status code will pass while the operation is failing.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why add random jitter to exponential backoff?',
      options: [
        'It makes the average retry delay shorter',
        'It prevents every client that failed during the same outage from retrying in lockstep and stampeding the recovering service',
        'It is required by the HTTP spec for 429 responses',
        'It stops the queue from reordering jobs',
      ],
      correctIndex: 1,
      explanation:
        'Pure exponential backoff is deterministic, so N clients that failed at the same instant all retry at the same instant. Jitter spreads them across the window and is what actually lets the downstream recover.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'A job handler sends an email, then the worker crashes before acknowledging. The broker redelivers the job. What is the correct defence?',
      options: [
        'Set attempts to 1 so jobs are never redelivered',
        'Acknowledge the job before doing the work',
        'Store the entire entity in the payload so the handler can detect staleness',
        'Make the handler idempotent — dedupe on a stable key, e.g. INSERT ... ON CONFLICT DO NOTHING before sending',
      ],
      correctIndex: 3,
      explanation:
        'Queues give at-least-once delivery, so double execution is a normal event, not an anomaly. Acking early converts it into silent data loss; only an idempotent handler is safe.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Why should a liveness probe (`/healthz`) NOT query the database?',
      options: [
        'Because the database driver is not thread-safe',
        'A database blip would make the orchestrator restart healthy containers instead of just removing them from rotation — that is the readiness probe’s job',
        'Because liveness probes cannot perform async work',
        'It would leak the connection string in the response',
      ],
      correctIndex: 1,
      explanation:
        'Liveness answers "is this process wedged?" and failing it triggers a restart. Dependency health belongs in readiness, which only removes the pod from the load balancer until the dependency recovers.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Why `CMD ["node", "src/server.js"]` rather than `CMD ["npm", "start"]`?',
      options: [
        'npm start is slower to parse',
        'npm is not installed in alpine images',
        'npm start cannot read environment variables',
        'npm runs your process as a child and does not forward SIGTERM, so graceful shutdown never runs',
      ],
      correctIndex: 3,
      explanation:
        'With npm as PID 1 the signal stops at npm, your handler never fires, and the container is SIGKILLed after the grace period — dropping in-flight requests on every deploy.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'You need to add a NOT NULL column during a rolling deploy where old and new code run simultaneously. What is the safe sequence?',
      options: [
        'Add the column as NOT NULL with a default in one migration and deploy at the same time',
        'Add it nullable, deploy code that writes it, backfill existing rows, then add the NOT NULL constraint in a later release',
        'Take the API down, migrate, bring it back up',
        'Add the column only in the ORM model and let it sync automatically',
      ],
      correctIndex: 1,
      explanation:
        'Expand-then-contract keeps every intermediate state readable and writable by both code versions. A single-step NOT NULL breaks the old replicas, which do not populate the column, the moment the migration lands.',
      difficulty: 'HARD',
    },
  ],
  problems: [
    {
      slug: 'layered-task-service',
      title: 'A Layered Service over a Repository Interface',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Build the service layer you will use in the project, with the repository injected so it can be unit tested.

Export \`makeTaskService({ repo, queue, now })\`:

- \`repo\` implements \`countOpen(userId)\`, \`insert(row)\` (returns the row with an \`id\`), \`findByUser(userId, { limit, cursor })\` (returns rows sorted by \`id\` **descending**).
- \`queue\` implements \`add(name, payload)\`.
- \`now\` is a function returning a \`Date\` (default \`() => new Date()\`).

The returned object has:

**\`create(userId, input)\`**
1. Throw \`Error('title is required')\` if \`input.title\` is missing or blank after trimming.
2. Throw \`Error('title too long')\` if the trimmed title exceeds 200 characters.
3. Throw an error with \`.status === 409\` and \`.code === 'TASK_LIMIT'\` if \`repo.countOpen(userId)\` is \`>= 100\`.
4. Otherwise insert \`{ userId, title: <trimmed>, done: false, createdAt: now() }\`, then call \`queue.add('task.created', { taskId: task.id })\`, and return the inserted task.

**\`list(userId, { limit = 20, cursor })\`**
- Ask the repo for \`limit + 1\` rows, return \`{ items, nextCursor }\` where \`items\` is at most \`limit\` rows and \`nextCursor\` is the \`id\` of the last returned item when more rows exist, otherwise \`null\`.

Clamp \`limit\` into the range 1–100.

The queue must **not** be called when validation or the limit check fails.`,
      starterCode: `function makeTaskService({ repo, queue, now = () => new Date() }) {
  return {
    async create(userId, input) {
      // your code here
    },
    async list(userId, options = {}) {
      // your code here
    },
  };
}

module.exports = { makeTaskService };`,
      solutionCode: `function makeTaskService({ repo, queue, now = () => new Date() }) {
  return {
    async create(userId, input) {
      const raw = input && typeof input.title === 'string' ? input.title.trim() : '';
      if (!raw) throw new Error('title is required');
      if (raw.length > 200) throw new Error('title too long');

      const open = await repo.countOpen(userId);
      if (open >= 100) {
        const err = new Error('Too many open tasks');
        err.status = 409;
        err.code = 'TASK_LIMIT';
        throw err;
      }

      const task = await repo.insert({
        userId,
        title: raw,
        done: false,
        createdAt: now(),
      });

      await queue.add('task.created', { taskId: task.id });
      return task;
    },

    async list(userId, options = {}) {
      const requested = Number(options.limit ?? 20);
      const limit = Number.isFinite(requested) ? Math.min(100, Math.max(1, Math.trunc(requested))) : 20;

      const rows = await repo.findByUser(userId, { limit: limit + 1, cursor: options.cursor ?? null });
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      return {
        items,
        nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
      };
    },
  };
}

module.exports = { makeTaskService };`,
      hints: [
        'Trim once into a local variable and validate that, not input.title.',
        'Validation must run before repo.countOpen so a blank title never touches the database.',
        'Over-fetch by one row: if you get limit + 1 back, there is another page.',
        'nextCursor is the id of the LAST item you are actually returning, not of the extra row you discarded.',
      ],
      tests: [
        {
          name: 'creates a task, trims the title and enqueues',
          assertion:
            "await (async () => { const added = []; const repo = { countOpen: async () => 0, insert: async (r) => ({ id: 7, ...r }), findByUser: async () => [] }; const svc = solution.makeTaskService({ repo, queue: { add: async (n, p) => added.push([n, p]) }, now: () => new Date('2026-01-01T00:00:00Z') }); const t = await svc.create('u1', { title: '  Ship it  ' }); return t.id === 7 && t.title === 'Ship it' && t.done === false && deepEqual(added, [['task.created', { taskId: 7 }]]); })()",
        },
        {
          name: 'uses the injected clock for createdAt',
          assertion:
            "await (async () => { const repo = { countOpen: async () => 0, insert: async (r) => ({ id: 1, ...r }), findByUser: async () => [] }; const svc = solution.makeTaskService({ repo, queue: { add: async () => {} }, now: () => new Date('2030-06-01T12:00:00Z') }); const t = await svc.create('u1', { title: 'x' }); return t.createdAt.toISOString() === '2030-06-01T12:00:00.000Z'; })()",
        },
        {
          name: 'rejects a blank title without touching the queue',
          assertion:
            "await (async () => { let calls = 0; const repo = { countOpen: async () => 0, insert: async (r) => ({ id: 1, ...r }), findByUser: async () => [] }; const svc = solution.makeTaskService({ repo, queue: { add: async () => { calls++; } } }); try { await svc.create('u1', { title: '   ' }); return false; } catch (e) { return e.message === 'title is required' && calls === 0; } })()",
        },
        {
          name: 'rejects a title longer than 200 characters',
          assertion:
            "await (async () => { const repo = { countOpen: async () => 0, insert: async (r) => ({ id: 1, ...r }), findByUser: async () => [] }; const svc = solution.makeTaskService({ repo, queue: { add: async () => {} } }); try { await svc.create('u1', { title: 'a'.repeat(201) }); return false; } catch (e) { return e.message === 'title too long'; } })()",
        },
        {
          name: '409 TASK_LIMIT at 100 open tasks',
          assertion:
            "await (async () => { let calls = 0; const repo = { countOpen: async () => 100, insert: async (r) => ({ id: 1, ...r }), findByUser: async () => [] }; const svc = solution.makeTaskService({ repo, queue: { add: async () => { calls++; } } }); try { await svc.create('u1', { title: 'ok' }); return false; } catch (e) { return e.status === 409 && e.code === 'TASK_LIMIT' && calls === 0; } })()",
        },
        {
          name: 'list over-fetches by one and returns a cursor',
          assertion:
            "await (async () => { let asked = null; const rows = [{ id: 10 }, { id: 9 }, { id: 8 }]; const repo = { countOpen: async () => 0, insert: async (r) => r, findByUser: async (u, o) => { asked = o; return rows.slice(0, o.limit); } }; const svc = solution.makeTaskService({ repo, queue: { add: async () => {} } }); const page = await svc.list('u1', { limit: 2 }); return asked.limit === 3 && deepEqual(page.items, [{ id: 10 }, { id: 9 }]) && page.nextCursor === 9; })()",
        },
        {
          name: 'nextCursor is null on the last page',
          assertion:
            "await (async () => { const repo = { countOpen: async () => 0, insert: async (r) => r, findByUser: async () => [{ id: 3 }, { id: 2 }] }; const svc = solution.makeTaskService({ repo, queue: { add: async () => {} } }); const page = await svc.list('u1', { limit: 5 }); return page.items.length === 2 && page.nextCursor === null; })()",
          hidden: true,
        },
        {
          name: 'limit is clamped to 100',
          assertion:
            "await (async () => { let asked = null; const repo = { countOpen: async () => 0, insert: async (r) => r, findByUser: async (u, o) => { asked = o; return []; } }; const svc = solution.makeTaskService({ repo, queue: { add: async () => {} } }); await svc.list('u1', { limit: 5000 }); return asked.limit === 101; })()",
          hidden: true,
        },
        {
          name: 'cursor is passed through to the repository',
          assertion:
            "await (async () => { let asked = null; const repo = { countOpen: async () => 0, insert: async (r) => r, findByUser: async (u, o) => { asked = o; return []; } }; const svc = solution.makeTaskService({ repo, queue: { add: async () => {} } }); await svc.list('u1', { limit: 10, cursor: 42 }); return asked.cursor === 42; })()",
          hidden: true,
        },
      ],
      xp: 80,
    },
    {
      slug: 'job-queue-retries',
      title: 'A Job Queue with Retries and Exponential Backoff',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Implement the retry core of a job queue — no Redis, just the logic.

Export two things.

**\`backoffMs(attempt, options)\`** — pure function.
\`options\` = \`{ base = 1000, factor = 2, max = 30000 }\`. Returns \`Math.min(max, base * factor ** (attempt - 1))\` for \`attempt >= 1\`. Attempt 1 is the delay *before the first retry*.

**\`createQueue({ attempts = 3, backoff = backoffMs, sleep })\`** — returns \`{ register, run, failed }\`:

- \`register(name, handler)\` — \`handler(payload)\` may be async and may throw.
- \`run(name, payload)\` — runs the handler. On success resolves with \`{ ok: true, result, attempts: n }\`.
  On failure it retries, awaiting \`sleep(backoff(attempt))\` between attempts, up to \`attempts\` **total** executions. If they all fail it resolves with \`{ ok: false, error: <the last error message>, attempts: n }\` and pushes \`{ name, payload, error }\` onto the dead-letter array.
- An error with \`err.retryable === false\` is **not** retried: fail immediately after one execution.
- \`run\` on an unregistered name rejects (throws) with \`Error('no handler: <name>')\`.
- \`failed()\` returns the dead-letter array.

\`\`\`js
const slept = [];
const q = createQueue({ attempts: 3, sleep: async (ms) => { slept.push(ms); } });
q.register('flaky', async () => { throw new Error('boom'); });
await q.run('flaky', { id: 1 });
// -> { ok: false, error: 'boom', attempts: 3 }
// slept -> [1000, 2000]
\`\`\``,
      starterCode: `function backoffMs(attempt, { base = 1000, factor = 2, max = 30000 } = {}) {
  // your code here
}

function createQueue({ attempts = 3, backoff = backoffMs, sleep } = {}) {
  // your code here
}

module.exports = { backoffMs, createQueue };`,
      solutionCode: `function backoffMs(attempt, { base = 1000, factor = 2, max = 30000 } = {}) {
  const n = Math.max(1, attempt);
  return Math.min(max, base * factor ** (n - 1));
}

function createQueue({ attempts = 3, backoff = backoffMs, sleep = async () => {} } = {}) {
  const handlers = new Map();
  const dead = [];

  return {
    register(name, handler) {
      handlers.set(name, handler);
      return this;
    },

    failed() {
      return dead;
    },

    async run(name, payload) {
      const handler = handlers.get(name);
      if (!handler) throw new Error('no handler: ' + name);

      let lastError;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          const result = await handler(payload);
          return { ok: true, result, attempts: attempt };
        } catch (err) {
          lastError = err;
          const permanent = err && err.retryable === false;
          if (permanent || attempt === attempts) {
            dead.push({ name, payload, error: err.message });
            return { ok: false, error: err.message, attempts: attempt };
          }
          await sleep(backoff(attempt));
        }
      }

      dead.push({ name, payload, error: lastError.message });
      return { ok: false, error: lastError.message, attempts };
    },
  };
}

module.exports = { backoffMs, createQueue };`,
      hints: [
        'backoffMs is pure — no randomness, so the tests can assert exact numbers.',
        'A for loop from 1 to attempts with try/catch inside is clearer than recursion here.',
        'Only sleep BETWEEN attempts: after the final failure there is nothing left to wait for.',
        'Check err.retryable === false explicitly — undefined must still be retried.',
      ],
      tests: [
        {
          name: 'backoff doubles from the base',
          assertion:
            'solution.backoffMs(1) === 1000 && solution.backoffMs(2) === 2000 && solution.backoffMs(3) === 4000',
        },
        {
          name: 'backoff respects max and custom options',
          assertion:
            'solution.backoffMs(10) === 30000 && solution.backoffMs(3, { base: 100, factor: 3, max: 10000 }) === 900',
        },
        {
          name: 'succeeds on the first try',
          assertion:
            "await (async () => { const q = solution.createQueue({ sleep: async () => {} }); q.register('ok', async (p) => p.n * 2); const r = await q.run('ok', { n: 21 }); return r.ok === true && r.result === 42 && r.attempts === 1; })()",
        },
        {
          name: 'retries then succeeds, sleeping with backoff',
          assertion:
            "await (async () => { const slept = []; const q = solution.createQueue({ attempts: 4, sleep: async (ms) => { slept.push(ms); } }); let n = 0; q.register('flaky', async () => { n++; if (n < 3) throw new Error('nope'); return 'done'; }); const r = await q.run('flaky', {}); return r.ok === true && r.attempts === 3 && r.result === 'done' && deepEqual(slept, [1000, 2000]); })()",
        },
        {
          name: 'exhausts attempts and dead-letters',
          assertion:
            "await (async () => { const slept = []; const q = solution.createQueue({ attempts: 3, sleep: async (ms) => { slept.push(ms); } }); q.register('bad', async () => { throw new Error('boom'); }); const r = await q.run('bad', { id: 1 }); return r.ok === false && r.error === 'boom' && r.attempts === 3 && deepEqual(slept, [1000, 2000]) && deepEqual(q.failed(), [{ name: 'bad', payload: { id: 1 }, error: 'boom' }]); })()",
        },
        {
          name: 'non-retryable errors fail immediately',
          assertion:
            "await (async () => { const slept = []; const q = solution.createQueue({ attempts: 5, sleep: async (ms) => { slept.push(ms); } }); q.register('bad', async () => { const e = new Error('invalid'); e.retryable = false; throw e; }); const r = await q.run('bad', {}); return r.ok === false && r.attempts === 1 && r.error === 'invalid' && slept.length === 0 && q.failed().length === 1; })()",
        },
        {
          name: 'unknown job name throws',
          assertion:
            "await (async () => { const q = solution.createQueue({ sleep: async () => {} }); try { await q.run('ghost', {}); return false; } catch (e) { return e.message === 'no handler: ghost'; } })()",
          hidden: true,
        },
        {
          name: 'a custom backoff function is used',
          assertion:
            "await (async () => { const slept = []; const q = solution.createQueue({ attempts: 3, backoff: (a) => a * 7, sleep: async (ms) => { slept.push(ms); } }); q.register('bad', async () => { throw new Error('x'); }); await q.run('bad', {}); return deepEqual(slept, [7, 14]); })()",
          hidden: true,
        },
      ],
      xp: 100,
    },
  ],
  project: {
    slug: 'project-3-production-api',
    title: 'Project 3 — TaskFlow: a Production TypeScript API',
    estimatedHours: 14,
    brief: `# TaskFlow API

Build and ship the backend for a small team task tracker. Everything from week 3 lands here: NestJS (or Express), REST design, validation, JWT auth, GraphQL, a tRPC layer, Postgres, tests, docs and a container.

## Goal

One TypeScript service that exposes the **same domain** over a REST API, a GraphQL endpoint and a tRPC router, persists to PostgreSQL, authenticates with JWT, authorises with roles, and runs from a Docker image with nothing but environment variables.

## Domain

\`\`\`
User    (id, email, password_hash, role, created_at)
Project (id, owner_id -> User, name, created_at)
Task    (id, project_id -> Project, assignee_id -> User NULL,
         title, description, status, priority, due_at, created_at, updated_at)
Comment (id, task_id -> Task, author_id -> User, body, created_at)
\`\`\`

\`status\` is one of \`todo | in_progress | done\`. \`role\` is \`member | admin\`.

## User stories

1. As a visitor I can register and log in, and I receive a short-lived access token and a refresh token.
2. As a member I can create a project and add tasks to it.
3. As a member I can list tasks in a project, filtered by \`status\` and \`assigneeId\`, sorted by \`dueAt\` or \`priority\`, paginated.
4. As a member I can update a task's status and assign it to a teammate.
5. As a member I can comment on a task.
6. As an admin I can delete any task or project; as a member I can only delete my own.
7. As a client I can fetch a project with its tasks and each task's assignee in **one** GraphQL query.
8. As the first-party web client I can call \`trpc.task.list.useQuery(...)\` and have the response fully typed, with no hand-written interface and no code generation.
9. As an operator I can hit \`/healthz\` and \`/readyz\` and read the OpenAPI spec at \`/docs\`.

## Required tech

- **TypeScript, Node.js 20+** — **NestJS 10+** (recommended) or **Express 5** if you prefer to wire the layers yourself
- **PostgreSQL 15+** — Prisma or TypeORM, or \`pg\` with raw SQL
- **JWT** — access token (15 min) + refresh token (7 days, rotated); \`bcrypt\` or \`argon2\` for password hashing
- **Zod** for request validation — one schema per input, shared with the tRPC layer (a \`ZodValidationPipe\` if you are on Nest, or \`class-validator\` DTOs consistently instead)
- **GraphQL** — Apollo Server, graphql-yoga or \`@nestjs/graphql\`, mounted at \`/graphql\`
- **tRPC** — an \`appRouter\` mounted at \`/api/trpc\` and an exported \`AppRouter\` type, plus a caller-based test that proves the types
- **Vitest or Jest + Supertest** (or \`Test.createTestingModule\` on Nest); integration tests against a real Postgres (Testcontainers or a CI service container)
- **Docker** + \`docker-compose.yml\` for api + postgres (+ redis if you add the queue)
- **OpenAPI 3** document served at \`/docs\`

## Required structure

Layers, enforced. On Nest: one module per domain concept, and a service that never imports \`@nestjs/common\`'s HTTP decorators. On Express: \`services/\` must not import \`express\`, and \`routes/\` must not import \`pg\`.

**All three transports are thin.** REST controllers, GraphQL resolvers and tRPC procedures must call the **same service functions**. If any business rule exists twice, the project is not done.

## REST surface (minimum)

\`\`\`
POST   /api/auth/register        201 -> { user, accessToken, refreshToken }
POST   /api/auth/login           200 | 401
POST   /api/auth/refresh         200 | 401
GET    /api/projects             200   ?limit&cursor
POST   /api/projects             201
GET    /api/projects/:id         200 | 404
GET    /api/projects/:id/tasks   200   ?status&assigneeId&sort&limit&cursor
POST   /api/projects/:id/tasks   201
PATCH  /api/tasks/:id            200 | 403 | 404
DELETE /api/tasks/:id            204 | 403
POST   /api/tasks/:id/comments   201
GET    /healthz  /readyz  /docs
\`\`\`

## GraphQL surface (minimum)

\`\`\`graphql
type Query {
  me: User!
  project(id: ID!): Project
  tasks(projectId: ID!, status: TaskStatus, limit: Int = 20, cursor: ID): TaskPage!
}

type Mutation {
  createTask(input: CreateTaskInput!): Task!
  updateTaskStatus(id: ID!, status: TaskStatus!): Task!
}

type Task {
  id: ID!
  title: String!
  status: TaskStatus!
  assignee: User          # must be batched with DataLoader, not N+1
  comments: [Comment!]!
}
\`\`\`

## tRPC surface (minimum)

Mounted at \`/api/trpc\`, sharing the same Zod schemas and the same service layer:

\`\`\`ts
export const appRouter = router({
  task: router({
    list: protectedProcedure
      .input(listTasksSchema)                       // the same schema the REST route validates with
      .query(({ ctx, input }) => taskService.list(ctx.user, input)),
    create: protectedProcedure
      .input(createTaskSchema)
      .mutation(({ ctx, input }) => taskService.create(ctx.user, input)),
    updateStatus: protectedProcedure
      .input(updateStatusSchema)
      .mutation(({ ctx, input }) => taskService.updateStatus(ctx.user, input)),
  }),
});

export type AppRouter = typeof appRouter;
\`\`\`

The context is built from the same JWT verification the REST middleware uses, and \`protectedProcedure\` narrows \`ctx.user\` to non-nullable exactly once.

## Acceptance criteria

- Every mutating endpoint validates its body and returns **422** with per-field messages on failure.
- Unauthenticated requests to protected routes return **401**; authenticated-but-forbidden returns **403**. These are never confused.
- Passwords are never returned by any endpoint or resolver, and never appear in logs.
- List endpoints are paginated. An unbounded \`SELECT *\` anywhere is a fail.
- Resolving 20 tasks with their assignees issues **at most 3** SQL queries (prove it with a query log or a test).
- Renaming a field on a service return type breaks the tRPC consumer at **compile time**, not at runtime. No hand-written response interfaces anywhere in the client.
- The whole suite runs green from a clean checkout with \`docker compose up -d db && npm test\`.
- \`docker build\` produces an image that boots with only environment variables supplied.
- \`README.md\` documents setup, env vars, how to run tests, and one example request per transport.`,
    checklist: [
      'Repo runs with `docker compose up` and serves GET /healthz returning 200 with no manual setup beyond a .env file',
      'Migrations create all five tables with foreign keys, NOT NULL constraints and an index on (project_id, status)',
      'POST /api/auth/register hashes the password with bcrypt/argon2 (cost >= 10) and returns 201 without the hash in the body',
      'Access tokens expire in 15 minutes; POST /api/auth/refresh rotates the refresh token and rejects a reused one with 401',
      'Every request body is validated with Zod and invalid input returns 422 with a per-field error map',
      'A member gets 403 (not 404 or 500) when deleting another user\'s task; an admin gets 204',
      'GET /api/projects/:id/tasks supports status and assigneeId filters, sort, and cursor pagination with a nextCursor in the response',
      'The GraphQL endpoint at /graphql serves the schema above, its resolvers call the same service functions as the REST controllers, and Task.assignee is batched through DataLoader so 20 tasks cost at most 3 SQL statements',
      'A tRPC router is mounted at /api/trpc, exports an `AppRouter` type, validates input with the same Zod schemas as REST, and calls the same service functions — proved by a createCaller test',
      'A centralised error handler returns { error: { code, message } } and never leaks a stack trace or a Postgres constraint name',
      'Unit tests cover the task service with a fake repository, including the 403 and validation branches',
      'Integration tests run against a real Postgres and cover, per endpoint, the happy path, the 401 path and the 422 path',
      'An OpenAPI 3 document is served at /docs and matches the implemented routes',
      'The Dockerfile is multi-stage, runs as a non-root user, uses `npm ci --omit=dev`, and the image starts from environment variables alone',
    ],
    stretchGoals: [
      'Move email notifications onto a BullMQ + Redis queue with exponential backoff, a dead-letter list, and an idempotent handler',
      'Add rate limiting (per-IP on auth routes, per-user elsewhere) plus helmet and a CORS allow-list',
      'Add GraphQL subscriptions over WebSockets so a client sees task status changes live',
      'Add structured logging with pino, a propagated x-request-id, and an OpenTelemetry trace across HTTP and SQL',
      'Ship a GitHub Actions pipeline that lints, tests against a Postgres service container, builds the image and pushes it tagged with the commit SHA',
    ],
    repoStarter: 'https://github.com/codeninja-track/project-3-taskflow-starter',
  },
  flashcards: [
    {
      front: 'What are the four layers of a typical Express API and the one rule that holds them together?',
      back: 'Route → controller → service → repository. Dependencies point inward: the service never imports express, the repository never knows about HTTP.',
      tags: ['architecture', 'express'],
    },
    {
      front: 'Why export the Express app separately from server.js?',
      back: 'So tests can import the app and let Supertest bind an ephemeral port. If importing starts a listener, parallel test workers collide on the port.',
      tags: ['testing', 'express'],
    },
    {
      front: 'Unit test vs integration test for an API',
      back: 'Unit: one service with fakes injected, ~1 ms, covers branches. Integration: route through the real DB via Supertest, catches SQL, migration and middleware-order bugs.',
      tags: ['testing'],
    },
    {
      front: 'Why factories instead of a shared seed.json?',
      back: 'A factory creates only what one test needs and randomises the rest. A shared seed becomes a global that every test secretly depends on and nobody can change.',
      tags: ['testing', 'fixtures'],
    },
    {
      front: 'Which three tests should every endpoint have?',
      back: 'Happy path, unauthorised (401/403), and invalid input (422). That trio catches most real regressions and is a finishable checklist.',
      tags: ['testing', 'rest'],
    },
    {
      front: 'Why does a GraphQL error still return HTTP 200?',
      back: 'Field-level errors go in the `errors` array so partial data can be returned. Tests must assert `body.errors` is undefined — a 200 alone proves nothing.',
      tags: ['graphql', 'testing'],
    },
    {
      front: 'Exponential backoff formula, and why jitter?',
      back: 'delay = min(max, base * factor ** (attempt - 1)). Jitter randomises it so clients that failed together do not retry in lockstep and stampede the recovering service.',
      tags: ['queues', 'reliability'],
    },
    {
      front: 'Why must a job handler be idempotent?',
      back: 'Queues deliver at-least-once: a worker can crash after doing the work but before acking. Dedupe on a stable key (INSERT ... ON CONFLICT DO NOTHING) so a rerun is a no-op.',
      tags: ['queues', 'reliability'],
    },
    {
      front: 'Liveness vs readiness probe',
      back: 'Liveness = "is the process wedged?" — failing it restarts the container, so never check dependencies there. Readiness = "can I serve?" — checks the DB and only pulls the pod out of rotation.',
      tags: ['devops', '12-factor'],
    },
    {
      front: 'Why CMD ["node","server.js"] instead of npm start?',
      back: 'npm becomes PID 1 and does not forward SIGTERM, so your graceful-shutdown handler never runs and in-flight requests are killed on every deploy.',
      tags: ['docker', 'devops'],
    },
    {
      front: 'Safe way to add a NOT NULL column during a rolling deploy',
      back: 'Expand then contract: add nullable → deploy code that writes it → backfill → add NOT NULL in a later release. Both code versions stay valid at every step.',
      tags: ['postgres', 'migrations'],
    },
    {
      front: 'Why validate environment variables at boot?',
      back: 'A missing JWT_SECRET otherwise signs tokens with `undefined`. Parse process.env with Zod in config.js and process.exit(1) on failure — fail loudly, at start, not at 3 a.m.',
      tags: ['12-factor', 'security'],
    },
  ],
  resources: [
    { label: 'The Twelve-Factor App', url: 'https://12factor.net/', kind: 'ARTICLE' },
    { label: 'Express — Production best practices', url: 'https://expressjs.com/en/advanced/best-practice-performance.html', kind: 'DOCS' },
    { label: 'BullMQ Documentation', url: 'https://docs.bullmq.io/', kind: 'DOCS' },
    { label: 'Testcontainers for Node.js', url: 'https://node.testcontainers.org/', kind: 'DOCS' },
    { label: 'OpenAPI Specification 3.1', url: 'https://spec.openapis.org/oas/v3.1.0.html', kind: 'SPEC' },
  ],
};

export default day;
