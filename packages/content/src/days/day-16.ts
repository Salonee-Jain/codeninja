import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 16,
  week: 3,
  pillar: 'BACKEND',
  title: 'Node.js & Express — REST APIs, Middleware & Validation',
  summary:
    'Learn what Node actually is, then build an HTTP API with Express that other teams can use without reading your source.',
  estimatedMinutes: 360,
  objectives: [
    'Explain what Node.js is made of and order the phases of the event loop',
    'Predict the output of mixed timer, I/O, nextTick and promise code, and keep the loop unblocked',
    'Use streams, Buffers and the core modules without loading whole files into memory',
    'Write Express middleware, routers and a four-argument error handler, and propagate async errors',
    'Model a domain as resources with clean URIs and pick the correct status code every time',
    'Implement offset and cursor pagination, filtering, sorting and versioning that survive real clients',
    'Validate params, query and body with Zod and return one consistent error envelope',
    'Harden an API with helmet, CORS and rate limiting, and publish it as OpenAPI',
  ],
  technologies: ['Node.js', 'Express.js', 'RESTful APIs', 'Zod', 'TypeScript'],
  lessons: [
    {
      slug: 'the-node-runtime',
      title: 'The Node Runtime: V8, libuv & the Event Loop',
      estimatedMinutes: 95,
      body: `# The Node Runtime: V8, libuv & the Event Loop

Node.js is not a language and not a framework. It is a **runtime**: Chrome's V8 JavaScript engine, plus **libuv** (a C library providing the event loop, a thread pool and cross-platform async I/O), plus a layer of native bindings that expose OS capabilities — files, sockets, processes — to JavaScript.

\`\`\`
   your JS  ──►  Node core modules (fs, http, net…)
                        │
                 native bindings
                 ┌──────┴───────┐
                V8            libuv
             (executes JS)  (event loop + threadpool + epoll/kqueue/IOCP)
\`\`\`

That picture explains the two facts people find surprising:

1. **JavaScript runs on one thread, but Node is not single-threaded.** libuv keeps a thread pool (4 threads by default, \`UV_THREADPOOL_SIZE\`) for things the OS cannot do asynchronously — file system calls, DNS lookups, \`crypto.pbkdf2\`, zlib.
2. **Network I/O does not use that pool at all.** Sockets are genuinely non-blocking at the kernel level (\`epoll\` on Linux, \`kqueue\` on macOS, IOCP on Windows), which is why one Node process can hold tens of thousands of open connections.

## Blocking is the only real sin

There is exactly one way to make a Node server fall over under light load: occupy the single JS thread.

\`\`\`js
// ❌ blocks every other request for the duration
const data = fs.readFileSync('./huge.json', 'utf8');

// ✅ hands the work to the threadpool, thread free to serve others
const data = await fs.promises.readFile('./huge.json', 'utf8');
\`\`\`

The same applies to CPU work. A 200 ms JSON transform in a request handler adds 200 ms of latency to **every** other in-flight request. Push that work to \`worker_threads\`, a child process, or a queue.

> Synchronous APIs are fine exactly once: at boot, before you start listening. \`readFileSync\` for a config file costs nobody anything.

If you must stay on the main thread, chunk the work so the loop can breathe:

\`\`\`js
function processInChunks(items, work, size = 500) {
  return new Promise((resolve) => {
    let i = 0;
    (function step() {
      const end = Math.min(i + size, items.length);
      for (; i < end; i++) work(items[i]);
      if (i < items.length) setImmediate(step);
      else resolve();
    })();
  });
}
\`\`\`

Each \`setImmediate\` returns control to the loop, so pending requests get served between chunks.

## The phases of the loop

Each turn ("tick") of the libuv loop walks a fixed sequence of phases:

| Phase | Runs |
| --- | --- |
| **timers** | callbacks from \`setTimeout\` / \`setInterval\` whose time has come |
| **pending callbacks** | some deferred system callbacks (e.g. certain TCP errors) |
| **idle, prepare** | internal |
| **poll** | retrieve new I/O events; execute I/O callbacks; may block here waiting |
| **check** | \`setImmediate\` callbacks |
| **close callbacks** | \`socket.on('close', …)\` |

Between **every** phase — and between every individual callback — Node drains two extra queues, in this order: the \`process.nextTick\` queue, then the microtask queue (resolved promises, \`queueMicrotask\`, \`await\` continuations). Both drain **completely**, which is why an infinitely recursive \`process.nextTick\` starves the loop and freezes the process at 100% CPU.

\`\`\`js
const fs = require('node:fs');

console.log('1 sync');
setTimeout(() => console.log('2 timeout 0'), 0);
setImmediate(() => console.log('3 immediate'));

fs.readFile(__filename, () => {
  console.log('4 io callback');
  setTimeout(() => console.log('5 timeout inside io'), 0);
  setImmediate(() => console.log('6 immediate inside io'));
});

Promise.resolve().then(() => console.log('7 promise'));
process.nextTick(() => console.log('8 nextTick'));
console.log('9 sync end');
\`\`\`

Output order: \`1\`, \`9\`, then \`8\` (the nextTick queue drains first), then \`7\` (microtasks), then \`2\`/\`3\` **in either order**, then \`4\`, \`6\`, \`5\`. Two rules to memorise:

- At the **top level**, \`setTimeout(fn, 0)\` vs \`setImmediate(fn)\` is a race that depends on how long the process took to boot. Never rely on it.
- **Inside an I/O callback** the order is deterministic: \`setImmediate\` always wins, because the loop is in the poll phase and \`check\` is the very next phase, while timers wait for the following turn.

\`process.nextTick\` does **not** yield to I/O — it jumps the queue. \`setImmediate\` yields.

## CommonJS vs ESM

| | CommonJS | ESM |
| --- | --- | --- |
| Import / export | \`require\` / \`module.exports\` | \`import\` / \`export\` |
| Resolution | synchronous, at call time | async, statically analysed |
| Extension in relative paths | optional | **required** |
| \`__dirname\` / \`__filename\` | built in | absent — derive them |

\`package.json\` decides which one a \`.js\` file is. With \`"type": "module"\`, every \`.js\` file is ESM and \`.cjs\` opts one file back; without it, \`.js\` is CommonJS and \`.mjs\` opts into ESM.

\`\`\`js
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Node 20.11+ also exposes import.meta.dirname directly
\`\`\`

> Prefix core modules with \`node:\` — \`import fs from 'node:fs'\`. Unambiguous, immune to a malicious npm package named \`fs\`, and faster to resolve.

## The core modules you actually reach for

\`path\` — never concatenate path strings. The security-relevant use:

\`\`\`js
const root = path.resolve('./public');
const target = path.resolve(root, userSuppliedPath);
if (!target.startsWith(root + path.sep)) throw new Error('Path traversal');
\`\`\`

Without that check, a request for \`../../etc/passwd\` reads whatever the process can read.

\`fs\` — use the promise API (\`node:fs/promises\`), pass \`{ recursive: true }\` to \`mkdir\` so an existing directory is not an error, and remember that omitting the encoding gives you a **Buffer** instead of a string.

A \`Buffer\` is a fixed-length chunk of raw bytes outside the V8 heap. \`Buffer.from('héllo').length\` is **6**, not 5 — bytes, not characters. That distinction is why \`Content-Length\` must come from \`Buffer.byteLength(body)\`; a short \`Content-Length\` truncates the response client-side.

## Streams and backpressure

Reading a 2 GB file with \`readFile\` allocates 2 GB. Streaming it allocates one chunk at a time (64 KB by default). The four types: **Readable**, **Writable**, **Duplex** (a socket), **Transform** (a duplex that changes data, e.g. gzip).

\`\`\`js
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

await pipeline(createReadStream('big.log'), createGzip(), createWriteStream('big.log.gz'));
\`\`\`

\`pipeline\` is the correct tool: it propagates errors and destroys every stream in the chain on failure. Chained \`.pipe()\` calls leak file descriptors when something breaks midway. Readable streams are also async-iterable, so \`for await (const chunk of createReadStream(file))\` is often the most readable form.

**Backpressure** is why streams matter: \`writable.write()\` returns \`false\` when its internal buffer is full, and a naive loop that ignores that return value buffers the whole source in RAM. \`pipeline\` and \`pipe\` handle it; hand-rolled loops do not.

HTTP requests and responses are exactly these streams — \`req\` is a Readable, \`res\` is a Writable — which is where the next lesson starts.`,
    },
    {
      slug: 'express-from-first-principles',
      title: 'Express From First Principles',
      estimatedMinutes: 95,
      body: `# Express From First Principles

An \`http.createServer\` handler receives \`req\` (a Readable stream, \`IncomingMessage\`) and \`res\` (a Writable stream, \`ServerResponse\`). Everything else — routing, JSON parsing, cookies, static files — is code that you or a framework write on top of those two streams. Express is that code, minus the bugs.

## The whole mental model in one sentence

An Express app is an **ordered array of functions** \`(req, res, next)\`; a request walks the array from top to bottom until one of them ends the response.

\`\`\`js
import express from 'express';

const app = express();

app.use(express.json({ limit: '100kb' }));       // parses application/json bodies
app.use(express.urlencoded({ extended: true })); // parses HTML form posts
app.use(express.static('public'));               // serves ./public/*

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(3000, () => console.log('http://localhost:3000'));
\`\`\`

Order is behaviour, not style. \`express.json()\` registered *after* your routes means \`req.body\` is \`undefined\` inside them. And that \`limit\` is not decoration: without a byte cap, a single client can push gigabytes of request body into your process memory.

## Middleware

\`\`\`js
function requestTimer(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(req.method + ' ' + req.originalUrl + ' ' + res.statusCode + ' ' + ms.toFixed(1) + 'ms');
  });
  next();
}
app.use(requestTimer);
\`\`\`

Three rules that cover every bug you will hit:

1. **Call \`next()\` exactly once**, or end the response. Doing neither hangs the request until the client times out; doing both throws \`ERR_HTTP_HEADERS_SENT\`.
2. \`next(err)\` with any argument **skips all remaining normal middleware** and jumps to the error handlers.
3. Mount path scoping: \`app.use('/admin', requireAdmin)\` runs for every path under \`/admin\` only.

\`ERR_HTTP_HEADERS_SENT\` deserves its own paragraph, because it is the most common Node server crash. Headers must be written before the first body byte; once \`res.writeHead\` or the first \`res.write\` has run, \`res.headersSent\` is \`true\` and any further header write throws. The usual cause is a handler that sends twice because a branch forgot to \`return\`.

## Routers keep the app file small

\`\`\`js
// routes/movies.js
import { Router } from 'express';
const router = Router();

router.get('/', listMovies);
router.post('/', createMovie);
router.get('/:id', getMovie);

export default router;
\`\`\`

\`\`\`js
// app.js
import moviesRouter from './routes/movies.js';
app.use('/api/movies', moviesRouter);   // paths inside the router are relative
\`\`\`

A router is itself a middleware, so it carries its own stack — \`router.use(requireAuth)\` protects that resource and nothing else.

## Where the data lives

| Source | Access | Example | Always a string? |
| --- | --- | --- | --- |
| Path segment | \`req.params.id\` | \`/movies/42\` | yes |
| Query string | \`req.query.page\` | \`?page=2&genre=sci-fi\` | string or array |
| JSON body | \`req.body\` | \`{"title":"Dune"}\` | parsed types |
| Header | \`req.get('authorization')\` | | yes |

\`\`\`js
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id must be an integer' });
  // …
});
\`\`\`

Params and query values are **always strings** — \`req.query.page > 5\` is a string comparison, and \`'10' > '5'\` is \`false\`. Coerce, then validate. Note also that \`?tag=a&tag=b\` makes \`req.query.tag\` an *array*, so code assuming a string breaks on a duplicated parameter. Lesson 4 replaces all of this hand-coercion with a schema.

## The response object

\`\`\`js
res.status(201).location('/movies/7').json({ id: 7 });
res.status(204).end();                        // no body
res.set('Cache-Control', 'no-store');
res.redirect(302, '/login');
res.sendFile(path.join(__dirname, 'a.pdf'));
\`\`\`

\`res.json\` sets \`Content-Type\` and serialises for you. Always write \`return res.status(400).json(...)\` so execution cannot fall through and send twice.

For static assets, \`express.static('public')\` streams files rather than buffering them, sets \`Content-Type\` from the extension, handles \`ETag\`/\`Last-Modified\` and range requests, and refuses to escape the root directory. Write that by hand once to understand it, then never again.

## Async handlers and the error trap

Express 4 does **not** catch rejected promises. An \`async\` handler that throws leaves the request hanging forever:

\`\`\`js
// ❌ hangs on failure in Express 4
app.get('/movies', async (req, res) => {
  const movies = await db.findAll();  // rejects → unhandled rejection, no response
  res.json(movies);
});

// ✅ wrap it
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/movies', asyncHandler(async (req, res) => {
  res.json(await db.findAll());
}));
\`\`\`

Express 5 forwards rejections automatically, but the wrapper is harmless there and keeps the code portable.

## Error-handling middleware

An error handler is identified **purely by arity** — four declared parameters:

\`\`\`js
// 404: reached only if no route matched
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such route' } });
});

// error handler: MUST be last, MUST declare four params
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);   // delegate to Express's default closer
  const status = err.status ?? 500;

  if (status >= 500) console.error(err);
  res.status(status).json({
    error: {
      code: err.code ?? 'INTERNAL',
      message: status >= 500 ? 'Internal server error' : err.message,
    },
  });
});
\`\`\`

Dropping the unused \`next\` parameter turns your error handler into an ordinary middleware that never runs. This one detail causes more confusion than anything else in Express.

## Configuration and the dev loop

\`\`\`js
// config.js
import 'dotenv/config';

const required = (key) => {
  const v = process.env[key];
  if (!v) throw new Error('Missing env var ' + key);
  return v;
};

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  isProd: process.env.NODE_ENV === 'production',
};
\`\`\`

Fail at boot when a variable is missing — not at 3 a.m. on the first request that needs it. Commit a \`.env.example\` listing every key with dummy values; never commit \`.env\`.

\`\`\`json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js"
  }
}
\`\`\`

\`tsx watch\` runs TypeScript directly and restarts on change, with no build step in the loop.

Finally, keep \`app\` and \`server\` in **separate files**: \`app.ts\` exports the configured Express app, \`server.ts\` calls \`listen\`. Tests then import \`app\` and drive it with supertest without ever binding a port — and your graceful-shutdown code has one obvious home:

\`\`\`js
const shutdown = (signal) => {
  console.log('received ' + signal + ', closing');
  server.close(() => process.exit(0));                // stop accepting, drain in-flight
  setTimeout(() => process.exit(1), 10_000).unref();  // hard cap
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
\`\`\``,
    },
    {
      slug: 'rest-that-survives-clients',
      title: 'REST That Survives Contact With Clients',
      estimatedMinutes: 90,
      body: `# REST That Survives Contact With Clients

REST is an architectural style, not "JSON over HTTP". The constraint people break first is **statelessness**: storing a login in server memory means request two must land on the same instance, which kills horizontal scaling and breaks on every deploy. Put the state in a token or a shared store.

## Model nouns, not procedures

\`\`\`
❌ POST /getMovieById?id=42     ❌ POST /movies/42/delete   ❌ GET /moviesByGenre?genre=scifi
✅ GET  /movies/42              ✅ DELETE /movies/42        ✅ GET /movies?genre=sci-fi
\`\`\`

URI conventions worth being rigid about:

- **Plural collection nouns**, then identifier: \`/movies/42/reviews/7\`.
- **Nest at most one level.** Past \`/a/1/b/2\` the URI is a database join in disguise — expose \`/reviews?movieId=42\`.
- **kebab-case** for multi-word segments (\`/watch-lists\`), never snake or camel.
- **No file extensions and no verbs.** Content type is negotiated by header, not by \`.json\`.
- **No trailing slash** — pick one form and 301 the other.

Some operations are not nouns. Model them as a sub-resource representing the *outcome*: \`POST /movies/42/publications\`. A controller-style \`POST /orders/9/cancel\` is an accepted escape hatch; do not let it become the default.

## Safety, idempotency and retries

| Method | Safe | Idempotent | Body |
| --- | --- | --- | --- |
| GET / HEAD | yes | yes | no |
| PUT | no | **yes** | yes |
| DELETE | no | **yes** | no |
| PATCH / POST | no | no | yes |

Idempotency decides what a client may retry after a timeout. \`PUT /movies/42\` replaces the whole representation, so retrying is harmless. \`POST /payments\` creates something new each time, so a retry after a lost response charges twice. The fix is an **idempotency key**: the client sends a UUID as \`Idempotency-Key\`; the server stores the response against that key and replays it on a retry.

\`\`\`js
app.post('/payments', asyncHandler(async (req, res, next) => {
  const key = req.get('Idempotency-Key');
  if (!key) return next({ status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' });

  const existing = await store.get(key);
  if (existing) return res.status(existing.status).json(existing.body);

  const payment = await createPayment(req.body);
  await store.set(key, { status: 201, body: payment }, { ttlSeconds: 86_400 });
  res.status(201).location('/payments/' + payment.id).json(payment);
}));
\`\`\`


Mind the two update verbs too: \`PUT\` sends the **complete** representation and missing fields are cleared; \`PATCH\` sends a partial change. If clients keep sending partial \`PUT\`s, you have implemented \`PATCH\` with the wrong verb.

## The status-code decision ladder

Evaluate in this order and the answer is never ambiguous.

| # | Question | Status |
| --- | --- | --- |
| 1 | Method supported on this path? | no → **405** + \`Allow\` |
| 2 | Over the rate limit? | yes → **429** + \`Retry-After\` |
| 3 | Do I know who they are? | no → **401** + \`WWW-Authenticate\` |
| 4 | Are they allowed? | no → **403** |
| 5 | Does the payload validate? | no → **422** (or 400) |
| 6 | Does the resource exist? | no → **404** |
| 7 | Conflicts with current state? | yes → **409** |
| 8 | Did a POST create something? | yes → **201** + \`Location\` |
| 9 | Nothing to return? | yes → **204** |
| 10 | Otherwise | **200** |

Also worth knowing: **202** (queued, return a status URL), **304 Not Modified**, **410 Gone**, **415 Unsupported Media Type**, **503** (temporarily unavailable).

The two most misused: **200 with \`{"error": …}\`** — clients cannot detect failure without parsing the body, and caches store it as a success — and **401 vs 403**, where 401 means "I do not know who you are" and 403 means "I know, and no".

## Never return an unbounded list

Apply a default limit (20) and a hard maximum (100). A client asking for \`limit=100000\` gets 100 items, not an error and not a dead database.

**Offset pagination** — \`?limit=20&offset=40\` becomes \`LIMIT 20 OFFSET 40\`. Simple, jumps to page 7, gives a total count. Two real problems: \`OFFSET 500000\` makes the database read and discard half a million rows, and concurrent inserts shift rows between pages so an item is shown twice or skipped. Fine for admin tables with page numbers; bad for infinite scroll and bad at scale.

**Cursor (keyset) pagination** — instead of "skip 40", say "everything after this exact row":

\`\`\`sql
SELECT * FROM movies
WHERE (created_at, id) < ($1, $2)   -- the cursor
ORDER BY created_at DESC, id DESC
LIMIT 20;
\`\`\`

Constant time at any depth and immune to inserts; the trade-off is no page numbers and no cheap total count. Always include the primary key as a tie-breaker — sorting by \`created_at\` alone means two rows sharing a timestamp can be duplicated or skipped at a boundary.

Make the cursor **opaque**: \`Buffer.from(JSON.stringify(payload)).toString('base64url')\` on the way out, a \`try\`/\`catch\` answering 400 \`INVALID_CURSOR\` on the way in.

> Envelope the collection from day one — \`{ "data": [...], "page": { "limit": 20, "nextCursor": "…", "hasMore": true } }\`. A bare JSON array leaves you nowhere to add pagination metadata later without a breaking change.

## Filtering and sorting

\`\`\`
GET /movies?genre=sci-fi,drama&rating_gte=7&sort=-rating,title&fields=id,title
\`\`\`

Comma lists or repeated keys — pick one and document it. Range filters get explicit suffixes (\`rating_gte\`, \`created_before\`); \`sort\` uses \`-\` for descending.

Two non-negotiables: **allow-list** the sortable and filterable fields against a \`Set\` before they reach the query builder, and never interpolate them into SQL. An unchecked \`sort\` parameter is both an injection vector and an accidental full table scan on an unindexed column.

## Conditional requests and ETags

\`\`\`js
app.get('/movies/:id', asyncHandler(async (req, res) => {
  const movie = await repo.find(req.params.id);
  if (!movie) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

  const etag = 'W/"' + movie.version + '"';
  res.set('ETag', etag).set('Cache-Control', 'private, max-age=60');

  if (req.get('If-None-Match') === etag) return res.status(304).end();
  res.json(movie);
}));
\`\`\`

The same ETag prevents lost updates on writes: require \`If-Match\` on \`PUT\` and answer **412 Precondition Failed** when it does not match — optimistic concurrency control for free.

## Versioning

URI path versioning (\`/v1/movies\`) is ugly but greppable in logs, cacheable by CDNs, and works from a browser address bar. Header versioning keeps URLs clean but is invisible; media-type versioning is the purest REST and the worst developer experience. Pick the path.

Better still: version rarely. Adding a response field or an optional query parameter is **non-breaking** — clients must ignore unknown fields. Renaming or removing a field, tightening validation, or changing a status code is **breaking**. When you must break, send \`Deprecation\` and \`Sunset\` headers and log which clients still call the old version.`,
    },
    {
      slug: 'validation-and-hardening',
      title: 'Validation, Error Envelopes & Hardening',
      estimatedMinutes: 80,
      body: `# Validation, Error Envelopes & Hardening

Everything crossing your API boundary is hostile until proven otherwise. Validate at the edge, once; the rest of the code then assumes clean, typed data.

## Why Zod

Zod infers the **TypeScript type from the runtime schema**, so the two can never drift:

\`\`\`ts
import { z } from 'zod';

export const createMovieSchema = z.object({
  title: z.string().min(1).max(200),
  year: z.number().int().gte(1888).lte(2100),
  genres: z.array(z.string()).min(1).max(5),
  isPublished: z.boolean().default(false),
});

export type CreateMovieInput = z.infer<typeof createMovieSchema>;
\`\`\`

One declaration gives you the runtime check *and* \`CreateMovieInput\`. A hand-written interface plus an \`if\` chain gives you two things that quietly disagree six months later. \`schema.parse(input)\` throws a \`ZodError\`; \`schema.safeParse(input)\` returns \`{ success, data | error }\`.

## Query strings are strings

\`req.query.limit\` is \`'20'\`, never \`20\`. Coerce explicitly:

\`\`\`ts
export const listMoviesQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
  sort: z.enum(['title', '-title', 'year', '-year', 'rating', '-rating']).default('-rating'),
  genre: z.string().optional().transform((v) => (v ? v.split(',') : [])),
});
\`\`\`

\`z.coerce.number()\` runs \`Number()\` first. \`z.enum\` does double duty: validation **and** the allow-list that stops \`sort\` becoming an injection point.

## One validation middleware for everything

\`\`\`ts
import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

export const validate = (schemas: Schemas): RequestHandler => (req, res, next) => {
  try {
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.query) res.locals.query = schemas.query.parse(req.query);
    if (schemas.body) req.body = schemas.body.parse(req.body);
    next();
  } catch (err) {
    next(err);   // a ZodError — the error handler formats it
  }
};
\`\`\`

Two details that bite: on Express 5 \`req.query\` is a getter, so write the parsed result to \`res.locals\` instead of assigning back to it; and validation must run **after** \`express.json()\`, or \`req.body\` is undefined and everything fails as "Required". Validation also strips unknown keys, blocking mass assignment: a client posting \`{"role":"admin"}\` cannot smuggle it into an ORM write.

## One error envelope

Pick a shape on day one and never deviate. Every non-2xx response carries \`{ error: { code, message, details?, requestId } }\` and nothing else. \`code\` is a **stable machine string** clients branch on — never make them regex your prose. \`details\` is a per-field array, only for validation failures. \`requestId\` comes from your logging middleware so a user can quote it in a support ticket. RFC 9457 *Problem Details* is a fine alternative; inventing three shapes in one API is not.

\`\`\`ts
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof ZodError) {
    return res.status(422).json({ error: {
      code: 'VALIDATION_FAILED',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      requestId: req.id,
    } });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  req.log.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
});
\`\`\`

Three rules encoded there: **never leak a stack trace or a driver message to a client** (it is reconnaissance), always log the original error server-side, and check \`headersSent\` before writing. Throwing \`new ApiError(409, 'EMAIL_TAKEN', '…')\` from the service layer now yields a correctly shaped 409 with no per-route plumbing.

## Helmet, CORS, rate limiting

\`app.use(helmet({ contentSecurityPolicy: false }))\` — CSP does nothing for a JSON API. That one line sets \`X-Content-Type-Options: nosniff\`, \`X-Frame-Options\`, \`Strict-Transport-Security\` and \`Referrer-Policy\`, and removes \`X-Powered-By: Express\`, which tells an attacker exactly what you run.

CORS is a **browser** mechanism: it protects users, not your server. curl ignores it entirely.

\`\`\`js
const allowed = new Set(['https://app.ninja.dev', 'http://localhost:5173']);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),  // no Origin = server-side call
  credentials: true,
  maxAge: 86_400,
}));
\`\`\`

> \`origin: '*'\` and \`credentials: true\` are mutually exclusive — the browser rejects the combination. If you send cookies, echo an explicit origin.

Anything beyond a "simple" request (a \`PUT\`, an \`Authorization\` header) triggers a preflight \`OPTIONS\`; \`maxAge\` caches that answer instead of doubling your request count.

\`\`\`js
app.use('/api/', rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: 'draft-7',   // RateLimit-Limit / -Remaining / -Reset
  keyGenerator: (req) => req.user?.id ?? req.ip,
}));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, limit: 5 }));
\`\`\`

Answer **429** with \`Retry-After\` and back the limiter with Redis — an in-memory counter is per process, so three replicas mean triple the intended limit. Also expose \`GET /health\` and \`GET /ready\`.

## Structured logging

\`console.log\` produces text no aggregator can query. Emit JSON with a request id:

\`\`\`js
app.use(pinoHttp({
  genReqId: (req, res) => {
    const id = req.headers['x-request-id'] ?? randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
}));
\`\`\`

Two rules: **redact secrets** — tokens and passwords in logs are a breach waiting to happen — and propagate the request id downstream so one identifier traces a request across services.

## OpenAPI

An OpenAPI document is a machine-readable contract: interactive docs, generated typed clients, contract tests. Hand-written YAML always drifts — generate it from the Zod schemas you already wrote:

\`\`\`ts
import { extendZodWithOpenApi, OpenApiGeneratorV3, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);
const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'post',
  path: '/movies',
  request: { body: { content: { 'application/json': { schema: createMovieSchema } } } },
  responses: { 201: { description: 'Created' } },
});

const document = new OpenApiGeneratorV3(registry.definitions)
  .generateDocument({ openapi: '3.0.0', info: { title: 'Ninja API', version: '1.0.0' } });

app.use('/docs', swaggerUi.serve, swaggerUi.setup(document));
\`\`\`

One source of truth — the Zod schema — drives validation, types and the published docs.

## Express vs Fastify vs NestJS — and when you graduate

| | Express 5 | Fastify | NestJS |
| --- | --- | --- | --- |
| Model | ordered middleware array | plugins, hooks, encapsulated scopes | DI container, decorators, modules |
| Validation | bring your own (Zod) | JSON Schema, compiled per route | pipes (Zod or class-validator) |
| Throughput | the baseline | roughly 2x, from compiled serialisation | whichever adapter it runs on |
| Docs | swagger-ui-express + generator | \`@fastify/swagger\` from schemas | \`@nestjs/swagger\` from decorators |
| Reach for it when | small service, maximum control | throughput matters, contracts are schemas | many modules and people, testable boundaries |

Express is the right default today, and every concept transfers: each framework still has a request pipeline, a validation boundary and an error envelope. **Day 19** rebuilds this API in NestJS with dependency injection, guards and modules; **Day 20** deletes the hand-written contract entirely with tRPC and Zod on Fastify. You graduate when the middleware array stops being the clearest way to say what your app does — not before.`,
    },
  ],
  quiz: [
    {
      prompt: 'Which statement about Node.js concurrency is correct?',
      options: [
        'Every asynchronous operation runs on the libuv thread pool',
        'Network socket I/O is non-blocking at the kernel level and does not use the thread pool; file system and crypto work does',
        'Node spawns one thread per incoming connection',
        'The thread pool has one thread per CPU core and cannot be resized',
      ],
      correctIndex: 1,
      explanation:
        'libuv uses epoll/kqueue/IOCP for sockets, so network I/O needs no extra threads. The pool (4 threads by default, tunable with UV_THREADPOOL_SIZE) exists for fs, DNS, zlib and some crypto calls that have no async OS API.',
      difficulty: 'MEDIUM',
    },
    {
      prompt:
        'Inside an fs.readFile callback you schedule both setTimeout(fn, 0) and setImmediate(fn). Which runs first?',
      options: [
        'setTimeout, because 0 ms has already elapsed',
        'The order is random',
        'setImmediate, because the check phase follows the poll phase in the same loop turn',
        'They run simultaneously on two threads',
      ],
      correctIndex: 2,
      explanation:
        'Inside an I/O callback the loop is in the poll phase, and check (setImmediate) is the very next phase, while timers only come around on the next turn. At the top level the same pair is a genuine race.',
      difficulty: 'HARD',
    },
    {
      prompt: 'In Express, what makes a function an error-handling middleware?',
      options: [
        'Registering it with app.error()',
        'Naming it errorHandler',
        'Declaring exactly four parameters: (err, req, res, next)',
        'Calling next(err) from inside it',
      ],
      correctIndex: 2,
      explanation:
        'Express inspects fn.length. Four declared parameters means error handler; drop the unused next and it silently becomes an ordinary middleware that never receives errors. It must also be registered last.',
      difficulty: 'EASY',
    },
    {
      prompt:
        'In Express 4, an async route handler awaits a query that rejects and nothing else is done. What happens?',
      options: [
        'Express catches it and returns 500 automatically',
        'The error handler receives it because async functions return promises',
        'Node crashes the process immediately',
        'The rejection is unhandled, the response is never sent, and the request hangs until the client times out',
      ],
      correctIndex: 3,
      explanation:
        'Express 4 never inspects a handler return value, so a rejected promise goes nowhere. Wrap handlers in an asyncHandler that calls .catch(next), or move to Express 5, which forwards rejections itself.',
      difficulty: 'HARD',
    },
    {
      prompt: 'A client sends POST /payments, times out, and retries. Why is that dangerous, and what fixes it?',
      options: [
        'POST is not idempotent, so a retry can create a duplicate; an Idempotency-Key that the server stores and replays fixes it',
        'Nothing is wrong — POST is idempotent by definition',
        'Switch to GET, which is safe',
        'Add Cache-Control: no-store so the retry is not cached',
      ],
      correctIndex: 0,
      explanation:
        'POST is neither safe nor idempotent, so the first request may have succeeded before the timeout. A client-generated Idempotency-Key lets the server recognise the retry and replay the original response rather than charging twice.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why does deep offset pagination behave badly?',
      options: [
        'It cannot be combined with sorting',
        'The database must scan and discard every skipped row, and concurrent inserts shift rows between pages',
        'Offsets are not URL-safe',
        'It always returns duplicate primary keys',
      ],
      correctIndex: 1,
      explanation:
        'OFFSET 500000 reads and throws away half a million rows, and because the window is positional, an insert during browsing pushes an item from one page to the next — showing it twice or skipping it. Keyset/cursor paging fixes both.',
      difficulty: 'HARD',
    },
    {
      prompt: 'A request is authenticated and well-formed JSON, but `year` is 1600 and your Zod rule is >= 1888. Best status code?',
      options: ['400 Bad Request', '403 Forbidden', '422 Unprocessable Content', '409 Conflict'],
      correctIndex: 2,
      explanation:
        '422 is for a syntactically valid request that fails semantic rules — exactly a validation failure. 400 is for a request that could not be parsed, 403 is authorisation, 409 is a state conflict such as a duplicate.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'You set `cors({ origin: "*", credentials: true })` and the browser still blocks the request. Why?',
      options: [
        'The wildcard origin is invalid whenever credentials are allowed — you must echo a specific origin',
        'CORS does not support the credentials option',
        'helmet strips the CORS headers',
        'Preflight requests ignore the origin option',
      ],
      correctIndex: 0,
      explanation:
        'The CORS spec forbids Access-Control-Allow-Origin: * together with Access-Control-Allow-Credentials: true. Validate the incoming Origin against an allow-list and reflect that exact value back instead.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'middleware-pipeline',
      title: 'The Express Middleware Pipeline',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Rebuild Express's dispatcher. \`createApp()\` returns an object with \`use(fn)\` and \`handle(req, res, done)\`.

**Registration.** \`use(fn)\` appends to the stack and returns the app (so calls chain). A function declaring **four** parameters (\`fn.length === 4\`) is an *error* middleware \`(err, req, res, next)\`; anything else is a normal middleware \`(req, res, next)\`.

**Dispatch.** Starting at the top of the stack:

- While there is **no** current error, run normal middleware and skip error middleware.
- While there **is** a current error, skip normal middleware and run error middleware, passing the error as the first argument.
- \`next()\` with no argument advances and **clears** any current error.
- \`next(err)\` sets the current error and advances.
- A synchronously thrown error is caught and behaves exactly like \`next(thrownError)\`.
- Extra \`next()\` calls from the same middleware are **ignored** (first call wins).
- If a middleware neither calls \`next\` nor throws, dispatch stops there and \`done\` is never called.
- When the stack is exhausted, call \`done(currentError)\` — with \`undefined\` when there is no error.

\`\`\`js
const app = createApp();
app.use((req, res, next) => { req.log.push('a'); next(); });
app.use((req, res, next) => { next(new Error('boom')); });
app.use((req, res, next) => { req.log.push('never'); next(); });
app.use((err, req, res, next) => { req.log.push('caught:' + err.message); next(); });

const req = { log: [] };
app.handle(req, {}, (err) => req.log.push('done:' + err));
// req.log === ['a', 'caught:boom', 'done:undefined']
\`\`\`

Everything here is synchronous — do not use timers or promises.`,
      starterCode: `function createApp() {
  // your code here
}

module.exports = { createApp };`,
      solutionCode: `function createApp() {
  const stack = [];

  function use(fn) {
    stack.push(fn);
    return app;
  }

  function handle(req, res, done) {
    let index = 0;

    function dispatch(err) {
      while (index < stack.length) {
        const layer = stack[index];
        index += 1;

        const isErrorHandler = layer.length === 4;
        if (err && !isErrorHandler) continue;
        if (!err && isErrorHandler) continue;

        let called = false;
        const next = function (nextErr) {
          if (called) return;
          called = true;
          dispatch(nextErr);
        };

        try {
          if (isErrorHandler) layer(err, req, res, next);
          else layer(req, res, next);
        } catch (thrown) {
          if (!called) {
            called = true;
            dispatch(thrown);
          }
        }
        return;
      }

      if (typeof done === 'function') done(err);
    }

    dispatch(undefined);
  }

  const app = { use: use, handle: handle };
  return app;
}

module.exports = { createApp };`,
      hints: [
        'Keep a single index in closure so recursive next() calls always move forward, never backwards.',
        'Use fn.length === 4 to tell an error handler from a normal middleware.',
        'Guard each layer with its own "called" boolean so a second next() from the same layer is ignored.',
        'Wrap the layer invocation in try/catch and route the thrown value through the same dispatch path as next(err).',
        'next() with no argument passes undefined, which is exactly how the error gets cleared.',
      ],
      tests: [
        {
          name: 'runs middleware in registration order then calls done',
          assertion:
            "(function(){var app=solution.createApp();var log=[];app.use(function(req,res,next){log.push(1);next();});app.use(function(req,res,next){log.push(2);next();});var seen='unset';app.handle({},{},function(err){seen=err;log.push('done');});return deepEqual(log,[1,2,'done'])&&seen===undefined;})()",
        },
        {
          name: 'next(err) skips normal middleware and reaches the error handler',
          assertion:
            "(function(){var app=solution.createApp();var log=[];app.use(function(req,res,next){log.push('a');next(new Error('boom'));});app.use(function(req,res,next){log.push('never');next();});app.use(function(err,req,res,next){log.push('caught:'+err.message);next();});app.handle({},{},function(err){log.push('done:'+err);});return deepEqual(log,['a','caught:boom','done:undefined']);})()",
        },
        {
          name: 'a thrown error is routed like next(err)',
          assertion:
            "(function(){var app=solution.createApp();var msg=null;app.use(function(req,res,next){throw new Error('kaboom');});app.use(function(err,req,res,next){msg=err.message;next(err);});app.handle({},{},function(err){});return msg==='kaboom';})()",
        },
        {
          name: 'an unhandled error reaches done',
          assertion:
            "(function(){var app=solution.createApp();var got=null;app.use(function(req,res,next){next(new Error('nope'));});app.handle({},{},function(err){got=err;});return !!got&&got.message==='nope';})()",
        },
        {
          name: 'error handlers are skipped when there is no error',
          assertion:
            "(function(){var app=solution.createApp();var log=[];app.use(function(err,req,res,next){log.push('err');next(err);});app.use(function(req,res,next){log.push('ok');next();});app.handle({},{},function(){log.push('done');});return deepEqual(log,['ok','done']);})()",
        },
        {
          name: 'stops when a middleware never calls next',
          assertion:
            "(function(){var app=solution.createApp();var doneCalls=0;var reached=false;app.use(function(req,res,next){});app.use(function(req,res,next){reached=true;next();});app.handle({},{},function(){doneCalls++;});return doneCalls===0&&reached===false;})()",
        },
        {
          name: 'calling next twice runs the rest of the chain once',
          assertion:
            "(function(){var app=solution.createApp();var count=0;app.use(function(req,res,next){next();next();});app.use(function(req,res,next){count++;next();});app.handle({},{},function(){});return count===1;})()",
          hidden: true,
        },
        {
          name: 'an error handler calling next() clears the error',
          assertion:
            "(function(){var app=solution.createApp();var log=[];app.use(function(req,res,next){next(new Error('x'));});app.use(function(err,req,res,next){log.push('handled');next();});app.use(function(req,res,next){log.push('recovered');next();});app.handle({},{},function(err){log.push('done:'+err);});return deepEqual(log,['handled','recovered','done:undefined']);})()",
          hidden: true,
        },
        {
          name: 'use() is chainable and req/res are passed through',
          assertion:
            "(function(){var app=solution.createApp();var req={hits:0};var res={tag:'r'};var seenRes=null;app.use(function(q,s,next){q.hits++;seenRes=s;next();}).use(function(q,s,next){q.hits++;next();});app.handle(req,res,function(){});return req.hits===2&&seenRes===res;})()",
          hidden: true,
        },
      ],
      xp: 80,
    },
    {
      slug: 'route-matcher',
      title: 'Route Matcher with Params and Wildcards',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Build the routing layer. Export two things.

### \`matchPath(pattern, pathname)\`

Returns a params object, or \`null\` when the pattern does not match. Leading/trailing slashes and empty segments are ignored on both sides.

| Pattern segment | Meaning |
| --- | --- |
| \`users\` | must equal that literal segment |
| \`:id\` | matches exactly one segment, captured as \`params.id\`, URI-decoded |
| \`:id?\` | same, but the segment may be absent |
| \`*\` | matches the rest of the path (possibly empty), joined and captured as \`params['*']\` |

Anything after \`?\` in \`pathname\` is a query string and must be ignored.

\`\`\`js
matchPath('/movies/:id', '/movies/42');        // { id: '42' }
matchPath('/movies/:id', '/movies/42/cast');   // null
matchPath('/users/:id?', '/users');            // {}
matchPath('/files/*', '/files/a/b.txt');       // { '*': 'a/b.txt' }
matchPath('/movies/:id', '/movies/a%20b?x=1'); // { id: 'a b' }
\`\`\`

### \`createRouter()\`

- \`add(method, pattern, handler)\` — registers a route, uppercasing the method, and returns the router.
- \`find(method, pathname)\` — walks the routes **in registration order** and returns:
  - \`{ handler, params }\` for the first route whose pattern **and** method both match;
  - \`{ status: 405, allow }\` if at least one route matched the path but none matched the method — \`allow\` is the unique matching methods, sorted alphabetically;
  - \`{ status: 404 }\` if no route matched the path at all.`,
      starterCode: `function matchPath(pattern, pathname) {
  // your code here
}

function createRouter() {
  // your code here
}

module.exports = { matchPath, createRouter };`,
      solutionCode: `function segments(value) {
  return String(value)
    .split('/')
    .filter(function (s) { return s.length > 0; });
}

function matchPath(pattern, pathname) {
  const rawPath = String(pathname).split('?')[0];
  const patternSegs = segments(pattern);
  const pathSegs = segments(rawPath);
  const params = {};

  for (let i = 0; i < patternSegs.length; i++) {
    const seg = patternSegs[i];

    if (seg === '*') {
      params['*'] = pathSegs.slice(i).map(decodeURIComponent).join('/');
      return params;
    }

    if (seg.charAt(0) === ':') {
      const optional = seg.charAt(seg.length - 1) === '?';
      const name = optional ? seg.slice(1, -1) : seg.slice(1);

      if (i >= pathSegs.length) {
        if (optional) continue;
        return null;
      }

      params[name] = decodeURIComponent(pathSegs[i]);
      continue;
    }

    if (pathSegs[i] !== seg) return null;
  }

  if (pathSegs.length > patternSegs.length) return null;
  return params;
}

function createRouter() {
  const routes = [];

  const router = {
    add: function (method, pattern, handler) {
      routes.push({ method: String(method).toUpperCase(), pattern: pattern, handler: handler });
      return router;
    },

    find: function (method, pathname) {
      const wanted = String(method).toUpperCase();
      const allow = [];

      for (let i = 0; i < routes.length; i++) {
        const params = matchPath(routes[i].pattern, pathname);
        if (params === null) continue;

        if (routes[i].method === wanted) return { handler: routes[i].handler, params: params };
        if (allow.indexOf(routes[i].method) === -1) allow.push(routes[i].method);
      }

      if (allow.length > 0) return { status: 405, allow: allow.sort() };
      return { status: 404 };
    },
  };

  return router;
}

module.exports = { matchPath, createRouter };`,
      hints: [
        'Split both sides on "/" and drop empty strings — that handles leading and trailing slashes for free.',
        'Strip the query string with pathname.split("?")[0] before matching.',
        'A wildcard returns immediately: everything from the current index onwards is the capture, joined with "/".',
        'An optional param that has no corresponding path segment simply adds no key to params.',
        'After the loop, a path with more segments than the pattern is not a match.',
        'For 405, collect matching-path methods while scanning and only use them if no method matched exactly.',
      ],
      tests: [
        {
          name: 'captures a named param',
          assertion: "deepEqual(solution.matchPath('/movies/:id', '/movies/42'), {id:'42'})",
        },
        {
          name: 'rejects an extra segment',
          assertion: "solution.matchPath('/movies/:id', '/movies/42/cast') === null",
        },
        {
          name: 'ignores leading and trailing slashes',
          assertion:
            "deepEqual(solution.matchPath('movies/:id/', '/movies/7'), {id:'7'}) && deepEqual(solution.matchPath('/health', '/health/'), {})",
        },
        {
          name: 'optional param may be absent',
          assertion:
            "deepEqual(solution.matchPath('/users/:id?', '/users'), {}) && deepEqual(solution.matchPath('/users/:id?', '/users/9'), {id:'9'})",
        },
        {
          name: 'wildcard captures the remainder',
          assertion:
            "deepEqual(solution.matchPath('/files/*', '/files/a/b.txt'), {'*':'a/b.txt'}) && deepEqual(solution.matchPath('/files/*', '/files'), {'*':''})",
        },
        {
          name: 'strips the query string and decodes params',
          assertion: "deepEqual(solution.matchPath('/movies/:id', '/movies/a%20b?x=1'), {id:'a b'})",
        },
        {
          name: 'literal mismatch returns null',
          assertion:
            "solution.matchPath('/movies/:id', '/shows/42') === null && solution.matchPath('/a/b', '/a') === null",
          hidden: true,
        },
        {
          name: 'router returns the first matching handler with params',
          assertion:
            "(function(){var r=solution.createRouter();var h=function(){return 'detail';};r.add('get','/movies',function(){}).add('GET','/movies/:id',h);var m=r.find('GET','/movies/12');return m.handler===h&&deepEqual(m.params,{id:'12'});})()",
        },
        {
          name: 'router reports 405 with a sorted allow list',
          assertion:
            "(function(){var r=solution.createRouter();r.add('POST','/movies',function(){});r.add('GET','/movies',function(){});var m=r.find('DELETE','/movies');return m.status===405&&deepEqual(m.allow,['GET','POST']);})()",
          hidden: true,
        },
        {
          name: 'router reports 404 when nothing matches the path',
          assertion:
            "(function(){var r=solution.createRouter();r.add('GET','/movies/:id',function(){});return deepEqual(r.find('GET','/actors/1'), {status:404});})()",
          hidden: true,
        },
        {
          name: 'registration order decides between overlapping routes',
          assertion:
            "(function(){var r=solution.createRouter();var first=function(){};var second=function(){};r.add('GET','/movies/*',first);r.add('GET','/movies/:id',second);return r.find('GET','/movies/3').handler===first;})()",
          hidden: true,
        },
      ],
      xp: 110,
    },
    {
      slug: 'status-code-decision',
      title: 'Pick the Right Status Code',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Centralise the status-code decision so no handler has to guess. Implement \`statusFor(ctx)\`.

\`ctx\` may contain: \`method\`, \`rateLimited\`, \`authenticated\`, \`authorized\`, \`valid\`, \`exists\`, \`conflict\`.

Evaluate the rules **strictly in this order** and return the first match:

| # | Condition | Status |
| --- | --- | --- |
| 1 | \`method\` (case-insensitive) is not one of GET, HEAD, POST, PUT, PATCH, DELETE | 405 |
| 2 | \`rateLimited === true\` | 429 |
| 3 | \`authenticated === false\` | 401 |
| 4 | \`authorized === false\` | 403 |
| 5 | \`valid === false\` | 422 |
| 6 | \`exists === false\` | 404 |
| 7 | \`conflict === true\` | 409 |
| 8 | method is POST | 201 |
| 9 | method is DELETE | 204 |
| 10 | otherwise | 200 |

Any flag that is missing counts as "fine": an absent \`exists\` means the resource exists, an absent \`conflict\` means there is none.

\`\`\`js
statusFor({ method: 'post' });                              // 201
statusFor({ method: 'GET', exists: false });                // 404
statusFor({ method: 'DELETE', authenticated: false });      // 401
statusFor({ method: 'PATCH', valid: false, exists: false });// 422 (rule 5 wins)
\`\`\``,
      starterCode: `function statusFor(ctx) {
  // your code here
}

module.exports = { statusFor };`,
      solutionCode: `const SUPPORTED = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'];

function statusFor(ctx) {
  const context = ctx || {};
  const method = String(context.method || '').toUpperCase();

  if (SUPPORTED.indexOf(method) === -1) return 405;
  if (context.rateLimited === true) return 429;
  if (context.authenticated === false) return 401;
  if (context.authorized === false) return 403;
  if (context.valid === false) return 422;
  if (context.exists === false) return 404;
  if (context.conflict === true) return 409;
  if (method === 'POST') return 201;
  if (method === 'DELETE') return 204;
  return 200;
}

module.exports = { statusFor };`,
      hints: [
        'Uppercase the method once at the top so the rest of the function can compare against constants.',
        'Order matters: a single if-chain with early returns reads exactly like the table.',
        'Compare with === false / === true so that a missing flag (undefined) does not trigger the rule.',
      ],
      tests: [
        { name: 'POST creates', assertion: "solution.statusFor({method:'post'}) === 201" },
        { name: 'DELETE returns no content', assertion: "solution.statusFor({method:'DELETE'}) === 204" },
        { name: 'GET is 200 by default', assertion: "solution.statusFor({method:'GET'}) === 200" },
        {
          name: 'unknown method is 405',
          assertion: "solution.statusFor({method:'TRACE'}) === 405 && solution.statusFor({}) === 405",
        },
        {
          name: 'auth beats validation and existence',
          assertion:
            "solution.statusFor({method:'PUT',authenticated:false,valid:false,exists:false}) === 401",
        },
        {
          name: 'authorization beats validation',
          assertion: "solution.statusFor({method:'PUT',authorized:false,valid:false}) === 403",
        },
        {
          name: 'validation beats not-found',
          assertion: "solution.statusFor({method:'PATCH',valid:false,exists:false}) === 422",
        },
        {
          name: 'rate limiting beats everything else',
          assertion:
            "solution.statusFor({method:'GET',rateLimited:true,authenticated:false,exists:false}) === 429",
          hidden: true,
        },
        {
          name: 'conflict on an existing resource',
          assertion:
            "solution.statusFor({method:'POST',conflict:true}) === 409 && solution.statusFor({method:'POST',exists:false,conflict:true}) === 404",
          hidden: true,
        },
      ],
      xp: 40,
    },
  ],
  flashcards: [
    {
      front: 'What is Node.js made of?',
      back: 'V8 (executes JavaScript) + libuv (event loop, thread pool, cross-platform async I/O) + native bindings exposing OS features as core modules like fs, net and http.',
      tags: ['node', 'runtime'],
    },
    {
      front: 'Which operations use the libuv thread pool?',
      back: 'File system calls, DNS lookups, zlib and some crypto — things with no async OS API. Network sockets do not: they use epoll/kqueue/IOCP directly.',
      tags: ['node', 'event-loop'],
    },
    {
      front: 'Name the event loop phases in order',
      back: 'timers → pending callbacks → idle/prepare → poll → check (setImmediate) → close callbacks. The nextTick queue then the microtask queue drain fully between every phase and every callback.',
      tags: ['node', 'event-loop'],
    },
    {
      front: 'setTimeout(fn, 0) vs setImmediate(fn)',
      back: 'At the top level the order is a race. Inside an I/O callback setImmediate always wins, because check is the phase right after poll while timers wait for the next turn.',
      tags: ['node', 'event-loop'],
    },
    {
      front: 'What breaks when you set `"type": "module"`?',
      back: 'require, __dirname and __filename disappear from .js files and relative imports need file extensions. Derive dirname from import.meta.url, or use a .cjs file for CommonJS.',
      tags: ['node', 'modules'],
    },
    {
      front: 'Why pipeline() instead of a .pipe() chain?',
      back: 'pipeline forwards errors and destroys every stream in the chain on failure; a broken .pipe() chain leaves the others open and leaks descriptors. Both respect backpressure — hand-rolled write loops do not.',
      tags: ['node', 'streams'],
    },
    {
      front: 'The three rules of Express middleware',
      back: 'Call next() exactly once or end the response; next(err) jumps straight to the error handlers; registration order is execution order.',
      tags: ['express', 'middleware'],
    },
    {
      front: 'How does Express recognise an error handler?',
      back: 'By arity — the function must declare four parameters (err, req, res, next) and be registered after all routes. Dropping the unused next silently turns it into ordinary middleware.',
      tags: ['express', 'errors'],
    },
    {
      front: 'req.params vs req.query vs req.body',
      back: 'params comes from path segments (/movies/:id), query from the query string (both always strings, repeated keys become arrays), body from a parser like express.json().',
      tags: ['express', 'http'],
    },
    {
      front: 'Why wrap async Express 4 handlers?',
      back: 'Express 4 ignores returned promises, so a rejection is never forwarded and the request hangs. Use asyncHandler = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next).',
      tags: ['express', 'async'],
    },
    {
      front: 'Safe vs idempotent',
      back: 'Safe = no side effects (GET, HEAD). Idempotent = N identical calls have the same effect as one (GET, HEAD, PUT, DELETE). POST is neither, which is why retries need an Idempotency-Key.',
      tags: ['rest', 'http'],
    },
    {
      front: 'Why must a keyset cursor include the primary key?',
      back: 'The sort column alone is not a total order. Two rows with the same timestamp cannot be distinguished at a page boundary, so one gets shown twice or skipped. The id is the tie-breaker.',
      tags: ['api-design', 'pagination'],
    },
  ],
  resources: [
    {
      label: 'Node.js — The Node.js Event Loop',
      url: 'https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick',
      kind: 'DOCS',
    },
    { label: 'Express — Error handling', url: 'https://expressjs.com/en/guide/error-handling.html', kind: 'DOCS' },
    {
      label: 'MDN — HTTP response status codes',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status',
      kind: 'DOCS',
    },
    { label: 'Zod documentation', url: 'https://zod.dev/', kind: 'DOCS' },
    { label: 'RFC 9457 — Problem Details for HTTP APIs', url: 'https://www.rfc-editor.org/rfc/rfc9457.html', kind: 'SPEC' },
  ],
};

export default day;
