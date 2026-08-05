import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 20,
  week: 3,
  pillar: 'BACKEND',
  title: 'tRPC, Zod & End-to-End Typesafety',
  summary: 'Make the compiler, not a code generator, the thing that keeps client and server honest.',
  estimatedMinutes: 330,
  objectives: [
    'Define end-to-end typesafety precisely and explain why inference is a stronger guarantee than codegen',
    'Build a tRPC router with queries, mutations, context, middleware and a protectedProcedure',
    'Validate procedure input with Zod and read result types back out with inferRouterOutputs',
    'Consume a tRPC API from React Query and know exactly what tRPC assumes about your deployment',
    'Name the situations where tRPC is the wrong tool and reach for REST, GraphQL or OpenAPI instead',
    'Compose, refine, transform and discriminate Zod schemas, and share one schema between form and handler',
    'Use generics, conditional types, mapped types, template literal types and satisfies deliberately',
    'Build a Fastify route with JSON Schema validation and response serialisation, and explain plugin encapsulation',
  ],
  technologies: ['tRPC', 'Zod', 'Fastify', 'TypeScript'],
  lessons: [
    {
      slug: 'what-end-to-end-typesafety-means',
      title: 'What End-to-End Typesafety Actually Means',
      estimatedMinutes: 70,
      body: `# What End-to-End Typesafety Actually Means

Here is the bug that costs every team a sprint eventually. A backend engineer renames \`user.fullName\` to \`user.displayName\`. Tests pass. The build is green. Three days later a support ticket arrives: the profile page says "Welcome, undefined".

TypeScript did not catch it, because the frontend's belief about the response was a *hand-written interface* that nobody updated. The type existed. It was simply a lie.

**End-to-end typesafety means the client's type for a response is derived from the server's implementation, so that a change on one side is a compile error on the other.** Not a lint warning. Not a runtime 500. A red squiggle in the editor of the person who broke it, before they commit.

## The three ways people try to get there

**1. Hand-written types on both sides.** Zero guarantee. The two definitions are unrelated values that happen to look alike. This is where most codebases actually are.

**2. Codegen — OpenAPI, GraphQL, protobuf.** You write a schema, run a generator, and get types. This is a real improvement, and for a public or polyglot API it is the correct answer. But the guarantee is weaker than it looks, for four reasons:

- **The spec can lie.** With hand-written OpenAPI, nothing forces the YAML to match the handler. You have made the *document* the source of truth, and the document is not executed.
- **There is a step.** If a developer forgets \`npm run generate\`, or CI runs it against a stale branch, client and server disagree while everything looks green. Any guarantee that depends on a human remembering is not a guarantee.
- **The generated types are a lowest common denominator.** OpenAPI cannot express "this field is present only when \`status === 'complete'\`". Generators emit \`field?: string\` and you narrow by hand.
- **It is a whole build system.** Watchers, generated files in the repo or in \`.gitignore\`, merge conflicts in artefacts nobody reads.

**3. Inference.** The server's router *is* the schema. The client imports its **type** — not its code — and TypeScript reads the shape straight out of the implementation. No file is generated, so no file can be stale. Rename a field and the client fails to compile in the same \`tsc\` run.

\`\`\`ts
// server/router.ts
export const appRouter = router({
  user: router({
    byId: publicProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => db.user.findUnique({ where: { id: input.id } })),
  }),
});
export type AppRouter = typeof appRouter;
\`\`\`

\`\`\`ts
// client — the ONLY import is a type, erased at build time
import type { AppRouter } from '../server/router';

const user = await trpc.user.byId.query({ id }); // fully typed, inferred from the query above
\`\`\`

There is no generator, no schema file and no artefact. The guarantee comes from the same type checker that already runs on every save.

| | Hand-written | Codegen (OpenAPI/GraphQL) | Inference (tRPC) |
| --- | --- | --- | --- |
| Source of truth | two, unrelated | a schema document | the implementation |
| Can drift | always | between generator runs | no |
| Extra build step | no | yes | no |
| Non-TypeScript clients | fine | **fine** | no |
| Public API contract | no | **yes** | no |
| Expressiveness | anything | the spec's subset | the full type system |

## The catch, stated plainly

tRPC's guarantee is bought with a constraint: **client and server must share one TypeScript codebase**, or at least a published package. \`import type { AppRouter }\` has to resolve. In a monorepo — Turborepo, pnpm workspaces, a Next.js app with its API in \`app/api\` — that is free. Across two repos owned by two teams it is a versioned package dependency, which is real work and re-introduces a coordination problem.

That constraint is not a bug; it is the trade. You get the strongest guarantee available in exchange for the tightest coupling.

## When tRPC is the wrong answer

Be honest about these. Reaching for tRPC in any of them is how it gets a bad reputation:

- **A public API.** Third parties cannot \`import type\`. They need a documented, versioned, language-neutral contract: REST with OpenAPI, or GraphQL.
- **Non-TypeScript consumers.** A Python data pipeline, a Go service, a partner's PHP integration. There is nothing for them to infer from.
- **A native mobile app.** Swift and Kotlin clients get nothing. A React Native app inside the same monorepo is fine; an iOS team is not.
- **Separately deployed and versioned services.** tRPC has no versioning story because it assumes both sides ship together. If your client can be six months old, you need an explicit contract.
- **Anything that must be curl-able and cacheable by URL.** tRPC batches over \`POST\` by default and its URL shape is an implementation detail.

The mature position is that these are not competitors. A common production shape is **tRPC for your own frontend, REST or GraphQL at the edge for everyone else**, both calling the same service layer. The typesafety lives where it is cheap; the contract lives where it is needed.

> The question to ask is not "is tRPC better than REST". It is "who consumes this endpoint, and can they run \`tsc\`?"`,
    },
    {
      slug: 'trpc-routers-context-and-clients',
      title: 'tRPC: Routers, Procedures, Context and the Client',
      estimatedMinutes: 95,
      body: `# tRPC: Routers, Procedures, Context and the Client

tRPC has a small surface. Four concepts and you have seen all of it.

## Initialisation and context

**Context** is whatever every procedure gets: the session, a database handle, the request headers. It is built once per request.

\`\`\`ts
// server/context.ts
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { db } from './db';
import { verifyJwt } from './auth';

export async function createContext({ req }: CreateFastifyContextOptions) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = token ? await verifyJwt(token) : null;
  return { db, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
\`\`\`

\`Awaited<ReturnType<typeof createContext>>\` is the pattern worth stealing: the context type is *derived* from the function, so it cannot drift.

\`\`\`ts
// server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
\`\`\`

## Middleware and protectedProcedure

Middleware wraps a procedure. Its superpower is that \`next({ ctx })\` **narrows the context type** for everything downstream.

\`\`\`ts
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: { ...ctx, user: ctx.user }, // user is now non-nullable, and TS knows it
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);
\`\`\`

Inside any \`protectedProcedure\`, \`ctx.user\` is \`User\`, not \`User | null\`. You never write \`if (!ctx.user) throw\` again, and you cannot forget to. Builders are immutable — \`t.procedure.use(...)\` returns a *new* builder, so \`publicProcedure\` is untouched.

Middleware composes, and runs outermost-first:

\`\`\`ts
const timed = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  const result = await next();
  console.log(path, type, Date.now() - start, 'ms');
  return result;
});

export const adminProcedure = t.procedure.use(timed).use(isAuthed).use(isAdmin);
\`\`\`

## Procedures: query, mutation, subscription

\`\`\`ts
import { z } from 'zod';

export const postRouter = router({
  list: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20), cursor: z.string().optional() }))
    .query(({ ctx, input }) => ctx.db.post.findMany({ take: input.limit })),

  byId: publicProcedure
    .input(z.string().uuid())
    .output(z.object({ id: z.string(), title: z.string() }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.db.post.findUnique({ where: { id: input } });
      if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
      return post;
    }),

  create: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(200), body: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.post.create({ data: { ...input, authorId: ctx.user.id } }),
    ),

  onNew: publicProcedure.subscription(() =>
    observable<Post>((emit) => {
      const onNew = (p: Post) => emit.next(p);
      events.on('post:new', onNew);
      return () => events.off('post:new', onNew);
    }),
  ),
});

export const appRouter = router({ post: postRouter, health: publicProcedure.query(() => 'ok') });
export type AppRouter = typeof appRouter;
\`\`\`

- \`.query()\` — a read. Cacheable, batched into a \`GET\` when possible.
- \`.mutation()\` — a write. Always \`POST\`, never batched with reads.
- \`.subscription()\` — a stream over a WebSocket or SSE link.
- \`.input(schema)\` — anything with a \`.parse\`. It validates **and** types \`input\`.
- \`.output(schema)\` — optional, but it is how you stop a database row leaking \`passwordHash\` into a response by accident. Cheap insurance.

Routers nest by literal nesting, and the client mirrors the shape exactly: \`appRouter.post.byId\` is called as \`trpc.post.byId.query(...)\`.

## Reading the types back out

\`\`\`ts
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

type RouterOutput = inferRouterOutputs<AppRouter>;
type RouterInput = inferRouterInputs<AppRouter>;

type Post = RouterOutput['post']['byId'];        // exactly what the resolver returns
type CreateInput = RouterInput['post']['create']; // exactly what the Zod schema accepts

function PostCard({ post }: { post: Post }) { /* ... */ }
\`\`\`

This is the whole payoff. \`Post\` is not a type you maintain. Add a column, change a \`select\`, rename a field — \`PostCard\` breaks at compile time.

## The client, with React Query

\`\`\`ts
// utils/trpc.ts
import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import type { AppRouter } from '../server/router';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      headers: () => ({ authorization: token ? \`Bearer \${token}\` : '' }),
    }),
  ],
});
\`\`\`

\`\`\`tsx
function Posts() {
  const list = trpc.post.list.useQuery({ limit: 20 });
  const utils = trpc.useUtils();

  const create = trpc.post.create.useMutation({
    onSuccess: () => utils.post.list.invalidate(),
  });

  if (list.isPending) return <Spinner />;
  if (list.error) return <p>{list.error.message}</p>;

  return (
    <>
      {list.data.map((p) => <PostCard key={p.id} post={p} />)}
      <button onClick={() => create.mutate({ title: 'Hello', body: 'World' })}>
        New post
      </button>
    </>
  );
}
\`\`\`

Every identifier there is checked. Pass \`{ limt: 20 }\` and it is a compile error. Read \`p.titel\` and it is a compile error. \`utils.post.list.invalidate()\` cannot name a query that does not exist.

\`httpBatchLink\` collects calls made in the same tick into one HTTP request. Three components each firing a query on mount produce one round trip. That is a genuine, free performance win — and the reason tRPC requests do not look like tidy REST URLs.

## Mounting it

\`\`\`ts
// Fastify
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';

await app.register(fastifyTRPCPlugin, {
  prefix: '/api/trpc',
  trpcOptions: { router: appRouter, createContext },
});
\`\`\`

\`\`\`ts
// Next.js App Router — app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

const handler = (req: Request) =>
  fetchRequestHandler({ endpoint: '/api/trpc', req, router: appRouter, createContext });

export { handler as GET, handler as POST };
\`\`\`

There are adapters for Express, Fastify, the Fetch API, AWS Lambda and standalone. tRPC is transport-agnostic; what it is not is codebase-agnostic. Keep \`server/\` and \`web/\` in one workspace, import only \`type\`s across the boundary, and the whole thing costs you nothing at runtime.`,
    },
    {
      slug: 'zod-and-the-type-system',
      title: 'Zod in Depth, and the TypeScript That Makes It Work',
      estimatedMinutes: 95,
      body: `# Zod in Depth, and the TypeScript That Makes It Work

TypeScript disappears at runtime. \`req.body as CreateUser\` is a lie you tell the compiler about bytes that arrived over a socket. Zod closes that gap: **one value that is both a runtime validator and the source of a static type.**

\`\`\`ts
import { z } from 'zod';

const createUser = z.object({
  email: z.string().email(),
  age: z.number().int().min(13),
  tags: z.array(z.string()).default([]),
});

type CreateUser = z.infer<typeof createUser>;
// { email: string; age: number; tags: string[] }
\`\`\`

You wrote the schema once. The type is a derivative, so it cannot drift.

## parse vs safeParse

\`\`\`ts
const user = createUser.parse(body);              // throws ZodError on failure
const result = createUser.safeParse(body);        // never throws
if (!result.success) {
  return res.status(422).json({
    errors: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
}
result.data; // typed CreateUser, narrowed by the discriminated union on \`success\`
\`\`\`

Use \`parse\` where a failure is a bug (config at boot — crash loudly). Use \`safeParse\` on anything a user can send, so you can turn issues into a per-field error map. Note the ergonomics: \`safeParse\` returns a **discriminated union**, so checking \`result.success\` narrows \`result.data\` for you.

## Composition

Schemas are values, so they compose like values:

\`\`\`ts
const baseTask = z.object({ title: z.string().min(1), done: z.boolean() });

const taskWithId = baseTask.extend({ id: z.string().uuid() });
const taskPatch = baseTask.partial();                 // every field optional
const taskSummary = taskWithId.pick({ id: true, title: true });
const taskNoDone = taskWithId.omit({ done: true });
const merged = baseTask.merge(z.object({ dueAt: z.coerce.date() }));
const strict = baseTask.strict();                     // error on unknown keys
\`\`\`

By default \`z.object\` **strips** unknown keys — an important security property, the Zod equivalent of Nest's \`whitelist: true\`.

## Refinements, transforms and discriminated unions

\`\`\`ts
const signup = z
  .object({
    password: z.string().min(8),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],          // attach the issue to a field, not the object
  });

const trimmedSlug = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .refine((s) => /^[a-z0-9-]+$/.test(s), 'Slug may contain only a-z, 0-9 and -');
\`\`\`

\`.transform()\` changes the **output** type while leaving the input alone, which is why Zod distinguishes \`z.input<typeof s>\` from \`z.output<typeof s>\` (\`z.infer\` is an alias for the output).

\`\`\`ts
const event = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('key'), key: z.string() }),
]);

type Event = z.infer<typeof event>;

function handle(e: Event) {
  if (e.type === 'click') e.x; // narrowed — e.key is not in scope here
}
\`\`\`

\`discriminatedUnion\` beats plain \`union\` twice over: it produces one precise error instead of a wall of "no matching variant", and it is O(1) at runtime because Zod switches on the discriminator instead of trying every branch.

## One schema, both sides

This is the reason to prefer Zod over class-validator in a full-stack repo:

\`\`\`ts
// packages/shared/src/schemas.ts
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(120),
  priority: z.enum(['low', 'normal', 'high']),
  dueAt: z.coerce.date().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
\`\`\`

\`\`\`tsx
// the browser form
const form = useForm<CreateTaskInput>({ resolver: zodResolver(createTaskSchema) });
\`\`\`

\`\`\`ts
// the server handler
const parsed = createTaskSchema.safeParse(req.body);
\`\`\`

One file. The client shows "Title is required" *before* the request, and the server enforces the identical rule *after* it, because it is the same object. Note \`z.coerce.date()\` — form fields and query strings arrive as strings, and \`z.coerce.*\` is how you accept \`"2026-08-05"\` or \`"42"\` without hand-written casts.

## The TypeScript that makes all this possible

\`z.infer\` is not magic. It is four features you can learn in an afternoon.

**Generics** carry the element type through a container:

\`\`\`ts
declare class ZodString { _output: string }
declare class ZodArray<T extends { _output: unknown }> { _output: T['_output'][] }
\`\`\`

**Conditional types** branch on a type:

\`\`\`ts
type Unwrap<T> = T extends Promise<infer U> ? U : T;
type A = Unwrap<Promise<string>>; // string
\`\`\`

\`infer\` is the keyword doing the real work — it pattern-matches a type and binds a name to part of it. That is exactly how \`z.infer<typeof schema>\` reaches inside a schema and pulls out its output type.

**Mapped types** transform every property of an object type:

\`\`\`ts
type InferShape<S> = { [K in keyof S]: S[K] extends { _output: infer O } ? O : never };
type Optionalise<T> = { [K in keyof T]?: T[K] };
\`\`\`

That is \`z.object({...})\` producing \`{ email: string; age: number }\` from a shape of schema objects.

**Template literal types** compute strings at the type level:

\`\`\`ts
type Handler = \`on\${Capitalize<'click' | 'focus'>}\`; // 'onClick' | 'onFocus'
type Path = \`/api/\${string}\`;
\`\`\`

This is how a tRPC client can type \`trpc.post.byId\` — the paths are computed from the router's shape, not written down.

**\`satisfies\`** checks a value against a type *without widening it*:

\`\`\`ts
const routes = {
  home: '/',
  post: '/post/:id',
} satisfies Record<string, \`/\${string}\`>;

type RouteKey = keyof typeof routes; // 'home' | 'post' — preserved

// with ": Record<string, string>" instead, RouteKey would be plain \`string\`
\`\`\`

Use \`satisfies\` for config objects, route maps and design tokens: you get the constraint check *and* the literal types.

**Inference through builder chains** is the last piece. Each builder method returns a type parameterised by what it just learned:

\`\`\`ts
declare function procedure(): Builder<undefined, unknown>;

interface Builder<In, Out> {
  input<S extends { _output: unknown }>(s: S): Builder<S['_output'], Out>;
  query<R>(fn: (opts: { input: In }) => R): { _in: In; _out: R };
}

const p = procedure()
  .input(zodStringSchema)      // Builder<string, unknown>
  .query(({ input }) => input.length); // input is string; result is { _in: string; _out: number }
\`\`\`

Nothing was generated, nothing was annotated, and the resolver's parameter is typed by a schema declared one line earlier. Every fluent, "magically typed" TypeScript library — Zod, tRPC, Drizzle, Hono — is this trick, applied at scale.`,
    },
    {
      slug: 'fastify-schema-first',
      title: 'Fastify: Schema-First, Encapsulated and Fast',
      estimatedMinutes: 70,
      body: `# Fastify: Schema-First, Encapsulated and Fast

tRPC gives typesafety by inference. Fastify gives it by **JSON Schema** — a declared contract that validates input, serialises output and generates documentation, all from one object. It is the other good answer, and the right one when your consumers cannot run \`tsc\`.

## The core idea

\`\`\`ts
import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.post('/tasks', {
  schema: {
    body: {
      type: 'object',
      required: ['title', 'priority'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 120 },
        priority: { type: 'string', enum: ['low', 'normal', 'high'] },
      },
    },
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          priority: { type: 'string' },
        },
      },
    },
  },
  handler: async (req, reply) => {
    const task = await createTask(req.body);
    return reply.code(201).send(task);
  },
});

await app.listen({ port: 3000, host: '0.0.0.0' });
\`\`\`

Three things happened for free.

**Validation.** \`ajv\` compiled that body schema to straight-line JavaScript at boot. An invalid body never reaches the handler; the client gets a 400 with a message naming the field. \`additionalProperties: false\` is the mass-assignment defence.

**Serialisation.** The \`response\` schema is not documentation — it is executable. \`fast-json-stringify\` compiles it into a bespoke stringifier that walks exactly those properties. That is faster than generic \`JSON.stringify\`, and, far more importantly, **any property not in the schema is dropped**. If \`createTask\` returns a row with \`ownerEmail\` and \`internalNotes\`, the client never sees them. This is the single most underrated feature in Fastify: your response shape is an allow-list by construction.

> The corollary bites people once: add a field to your database row, forget to add it to the response schema, and it silently vanishes from the API. When a field "isn't coming through", check the response schema first.

**Documentation.** \`@fastify/swagger\` reads the same schemas and serves an OpenAPI document. One source of truth for validation, serialisation and docs.

## Getting types back

Raw JSON Schema gives you no TypeScript types. Two standard fixes:

\`\`\`ts
// 1. TypeBox — write JSON Schema and get the type
import { Type, type Static } from '@sinclair/typebox';

const TaskBody = Type.Object({
  title: Type.String({ minLength: 1 }),
  priority: Type.Union([Type.Literal('low'), Type.Literal('normal'), Type.Literal('high')]),
});
type TaskBody = Static<typeof TaskBody>;

app.withTypeProvider<TypeBoxTypeProvider>().post('/tasks', { schema: { body: TaskBody } }, async (req) => {
  req.body.title; // typed
});
\`\`\`

\`\`\`ts
// 2. Zod, converted to JSON Schema at boot
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
\`\`\`

## Plugins and encapsulation

This is Fastify's real architectural idea, and it is the closest thing in the Node world to Nest's modules.

Every plugin gets its **own copy of the instance**. Hooks, decorators and routes registered inside a plugin exist only inside that plugin and its children. Nothing leaks upward.

\`\`\`ts
async function adminRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAdmin);   // applies to THIS subtree only
  app.get('/admin/stats', statsHandler);
}

app.register(adminRoutes);
app.get('/health', healthHandler);          // requireAdmin does NOT run here
\`\`\`

In Express, \`app.use(requireAdmin)\` applies to everything registered after it, and route-file ordering becomes load-bearing. In Fastify the boundary is explicit and lexical.

When you *want* something shared, wrap it with \`fastify-plugin\`, which tells Fastify to skip the encapsulation:

\`\`\`ts
import fp from 'fastify-plugin';

export default fp(async (app) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  app.decorate('db', pool);                 // now visible to the whole app
  app.addHook('onClose', () => pool.end());
});
\`\`\`

\`app.decorate\` is dependency injection without a container: attach it once, read \`app.db\` or \`req.user\` anywhere in scope.

## Hooks

\`onRequest\` → \`preParsing\` → \`preValidation\` → \`preHandler\` → **handler** → \`preSerialization\` → \`onSend\` → \`onResponse\`.

Put auth in \`onRequest\` (cheapest — it runs before the body is even parsed). Put per-route authorisation in \`preHandler\`, where you have the validated params. Use \`preSerialization\` to reshape a payload before the response schema is applied.

## Fastify vs Express, benchmark-honest

| | Express 5 | Fastify 5 |
| --- | --- | --- |
| Hello-world throughput | baseline | roughly 2–3x in the project's own benchmarks |
| Validation | none; bring \`zod\`/\`joi\` | JSON Schema, compiled, built in |
| Serialisation | \`JSON.stringify\` | compiled per-schema, and it strips extra fields |
| Logging | bring \`morgan\`/\`pino\` | \`pino\` built in, with per-request child loggers |
| Encapsulation | none; \`app.use\` is global-ish | per-plugin, explicit |
| Testing HTTP | supertest, real sockets | \`app.inject()\`, no socket at all |
| Ecosystem | enormous, 15 years deep | large and healthy, smaller |
| Async errors | Express 5 handles them; Express 4 does not | handled |

Now the honest part. That 2–3x is measured on a route that returns a small JSON object and touches nothing. Add one 8 ms database query and the framework is a rounding error — you have gone from perhaps 0.15 ms to 0.05 ms of framework overhead on an 8 ms request. **If your service is I/O-bound, switching to Fastify for throughput is not a real optimisation.**

Choose Fastify for the *other* columns: schema validation and serialisation you cannot forget, structured logging out of the box, real encapsulation, and \`app.inject()\` making HTTP-level tests as fast as unit tests.

\`\`\`ts
test('rejects an empty title', async () => {
  const res = await app.inject({ method: 'POST', url: '/tasks', payload: { title: '', priority: 'low' } });
  expect(res.statusCode).toBe(400);
});
\`\`\`

No port, no socket, no teardown race. That, plus response schemas that make leaking a password hash structurally impossible, is why Fastify wins on merit even when the benchmark is a wash.`,
    },
  ],
  quiz: [
    {
      prompt: 'Why is inference-based typesafety (tRPC) a stronger guarantee than OpenAPI or GraphQL codegen?',
      options: [
        'Generated types are less precise than inferred ones in every case',
        'There is no generated artefact, so client and server cannot be out of sync between generator runs',
        'Codegen cannot express optional fields',
        'tRPC validates responses at runtime and codegen does not',
      ],
      correctIndex: 1,
      explanation:
        'Codegen inserts a step and a file. If the generator has not been run, or the spec was hand-written and does not match the handler, the types are confidently wrong. With inference the client reads the implementation type directly, so a stale artefact cannot exist.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which of these is the clearest case where tRPC is the wrong tool?',
      options: [
        'A Next.js app whose API routes live in the same repo',
        'A React Native app in the same pnpm workspace as the server',
        'A public API consumed by third-party customers in Python and Go',
        'An internal admin dashboard built by the same team as the backend',
      ],
      correctIndex: 2,
      explanation:
        'tRPC assumes the consumer can `import type` from the server. Third parties on other languages cannot. They need a language-neutral, versioned contract: REST plus OpenAPI, or GraphQL.',
      difficulty: 'EASY',
    },
    {
      prompt: 'In tRPC, what does returning `next({ ctx: { ...ctx, user: ctx.user } })` from a middleware achieve?',
      options: [
        'It restarts the procedure with a fresh context',
        'It caches the context for the rest of the request',
        'It narrows the context type downstream, so `ctx.user` is non-nullable inside protected procedures',
        'It merges the context into the response body',
      ],
      correctIndex: 2,
      explanation:
        'Middleware can replace the context, and the replacement is reflected in the type. After an `isAuthed` middleware has thrown for the null case, downstream resolvers see `user: User` rather than `User | null` — the null check is impossible to forget because it already happened.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What is the practical difference between `schema.parse(x)` and `schema.safeParse(x)`?',
      options: [
        '`parse` validates, `safeParse` only checks types without running refinements',
        '`parse` throws a ZodError; `safeParse` returns a discriminated union of `{ success: true, data }` or `{ success: false, error }`',
        '`safeParse` is asynchronous',
        '`safeParse` strips unknown keys and `parse` does not',
      ],
      correctIndex: 1,
      explanation:
        'Both run the identical validation. `parse` throws, which suits boot-time config where you want the process to die. `safeParse` returns a union you can narrow, which suits request handling where you want to build a 422 body from `error.issues`.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Why prefer `z.discriminatedUnion("type", [...])` over `z.union([...])` for tagged objects?',
      options: [
        'It is the only form that supports `z.infer`',
        'It allows the discriminator field to be optional',
        'It automatically adds the discriminator to each member',
        'It gives one precise error from the matching branch instead of every branch failing, and it dispatches in constant time',
      ],
      correctIndex: 3,
      explanation:
        'A plain union tries every option and reports the union of all failures, which is unreadable. A discriminated union switches on the tag, validates only that branch, and reports errors relative to it.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What does `satisfies` do that a type annotation does not?',
      options: [
        'It checks the value against the type while preserving the literal, narrower inferred type',
        'It performs the check at runtime',
        'It makes every property readonly',
        'It allows excess properties that an annotation would reject',
      ],
      correctIndex: 0,
      explanation:
        'Annotating `const routes: Record<string, string>` widens the value, losing the literal keys and values. `satisfies Record<string, string>` verifies the constraint but leaves the inferred type alone, so `keyof typeof routes` is still the union of actual keys.',
      difficulty: 'HARD',
    },
    {
      prompt: 'A Fastify route declares a `response` schema listing only `id` and `title`, but the handler returns an object that also has `ownerEmail`. What does the client receive?',
      options: [
        'A 500, because the payload does not match the schema',
        'All three fields; the response schema is documentation only',
        'Only `id` and `title` — the compiled serialiser walks exactly the declared properties',
        'All three, with a warning logged',
      ],
      correctIndex: 2,
      explanation:
        'Fastify compiles the response schema with fast-json-stringify. It emits only the declared properties, so extra fields are silently dropped. That is both a real security control and the reason a newly added field can "disappear" from a response.',
      difficulty: 'MEDIUM',
    },
    {
      prompt:
        'Your Express API is I/O-bound: every request makes one 8 ms Postgres query. What should you expect from migrating to Fastify purely for throughput?',
      options: [
        'Roughly 2–3x more requests per second, matching the published benchmarks',
        'Little change, because framework overhead is a tiny fraction of an 8 ms request',
        'A slowdown, because JSON Schema validation is expensive',
        'A 2–3x improvement only if you also enable HTTP/2',
      ],
      correctIndex: 1,
      explanation:
        'The published multiples come from hello-world routes where the framework *is* the workload. Behind an 8 ms query you are trading a fraction of a millisecond. Migrate for schema validation, serialisation, encapsulation, built-in logging and `app.inject()` — not for the benchmark number.',
      difficulty: 'HARD',
    },
  ],
  problems: [
    {
      slug: 'fastify-response-serializer',
      title: 'Serialise a Response Against a JSON Schema',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Fastify compiles a route's \`response\` schema into a serialiser that emits **exactly** the declared properties. Anything the handler returns that is not in the schema is dropped — which is what stops a \`passwordHash\` column reaching a client.

Implement \`serialize(schema, value)\`.

Supported schemas:

| \`schema.type\` | Behaviour |
| --- | --- |
| \`'object'\` | Return a new object. For each key of \`schema.properties\`, in that order, if the value has that key and it is not \`undefined\`, recurse. Any other key on the value is dropped. |
| \`'array'\` | Map every element through \`schema.items\`. |
| \`'string'\` | \`String(value)\` |
| \`'number'\` | \`Number(value)\` |
| \`'integer'\` | \`Math.trunc(Number(value))\` |
| \`'boolean'\` | \`Boolean(value)\` |
| anything else, or no \`type\` | return \`value\` unchanged |

If \`value\` is \`null\` or \`undefined\`, return it unchanged whatever the schema says.

\`\`\`js
const schema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
  },
};

serialize(schema, { id: '7', name: 'Ada', passwordHash: 'secret' });
// { id: 7, name: 'Ada' }
\`\`\``,
      starterCode: `function serialize(schema, value) {
  // your code here
}

module.exports = { serialize };`,
      solutionCode: `function serialize(schema, value) {
  if (value === null || value === undefined) return value;
  if (!schema || typeof schema !== 'object') return value;

  switch (schema.type) {
    case 'object': {
      const out = {};
      const properties = schema.properties || {};
      for (const key of Object.keys(properties)) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        if (value[key] === undefined) continue;
        out[key] = serialize(properties[key], value[key]);
      }
      return out;
    }
    case 'array':
      return (value || []).map((item) => serialize(schema.items, item));
    case 'string':
      return String(value);
    case 'number':
      return Number(value);
    case 'integer':
      return Math.trunc(Number(value));
    case 'boolean':
      return Boolean(value);
    default:
      return value;
  }
}

module.exports = { serialize };`,
      hints: [
        'Handle the null/undefined short-circuit before you look at schema.type at all.',
        'Drive the object case from `Object.keys(schema.properties)`, never from the keys of the value — that is what does the stripping.',
        'Use hasOwnProperty so a declared-but-absent property is omitted rather than set to undefined.',
        'The array case is one line: map each element through `schema.items` recursively.',
      ],
      tests: [
        {
          name: 'drops properties that are not in the schema',
          assertion:
            "deepEqual(solution.serialize({ type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } }, { id: 7, name: 'Ada', passwordHash: 'x' }), { id: 7, name: 'Ada' })",
        },
        {
          name: 'coerces primitives to the declared type',
          assertion:
            "deepEqual(solution.serialize({ type: 'object', properties: { id: { type: 'integer' }, score: { type: 'number' }, active: { type: 'boolean' }, name: { type: 'string' } } }, { id: '7.9', score: '1.5', active: 1, name: 42 }), { id: 7, score: 1.5, active: true, name: '42' })",
        },
        {
          name: 'omits declared properties that are absent',
          assertion:
            "deepEqual(solution.serialize({ type: 'object', properties: { id: { type: 'integer' }, nickname: { type: 'string' } } }, { id: 1 }), { id: 1 })",
        },
        {
          name: 'recurses into nested objects',
          assertion:
            "deepEqual(solution.serialize({ type: 'object', properties: { id: { type: 'integer' }, author: { type: 'object', properties: { name: { type: 'string' } } } } }, { id: 1, author: { name: 'Ada', email: 'a@b.c' }, secret: 1 }), { id: 1, author: { name: 'Ada' } })",
        },
        {
          name: 'maps arrays of objects through items',
          assertion:
            "deepEqual(solution.serialize({ type: 'array', items: { type: 'object', properties: { id: { type: 'integer' } } } }, [{ id: '1', hash: 'a' }, { id: '2', hash: 'b' }]), [{ id: 1 }, { id: 2 }])",
        },
        {
          name: 'handles an array nested inside an object',
          assertion:
            "deepEqual(solution.serialize({ type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } }, { tags: [1, 'two'], extra: true }), { tags: ['1', 'two'] })",
        },
        {
          name: 'passes null and undefined through unchanged',
          assertion:
            "solution.serialize({ type: 'string' }, null) === null && solution.serialize({ type: 'object', properties: {} }, undefined) === undefined",
          hidden: true,
        },
        {
          name: 'an unknown or missing type returns the value untouched',
          assertion:
            "(() => { const v = { a: 1 }; return solution.serialize({}, v) === v && solution.serialize({ type: 'anything' }, 5) === 5; })()",
          hidden: true,
        },
      ],
      xp: 45,
    },
    {
      slug: 'mini-zod',
      title: 'Build a Miniature Zod',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Zod is a schema *value* that validates at runtime. Build a small one.

Export an object \`z\` with \`string()\`, \`number()\`, \`boolean()\`, \`object(shape)\` and \`array(inner)\`. Every schema has:

- \`.safeParse(value)\` → \`{ success: true, data }\` or \`{ success: false, error: { issues } }\`
- \`.parse(value)\` → the data, or **throws** on failure
- \`.optional()\` → a schema that also accepts \`undefined\` (and makes the key optional inside \`z.object\`)
- \`.refine(fn, message)\` → passes only if \`fn(value)\` is truthy
- \`.transform(fn)\` → replaces the value with \`fn(value)\`

An **issue** is \`{ path, message }\`, where \`path\` is an array of keys (strings) and array indices (numbers) locating the failure. The top level has \`path: []\`.

Rules:

1. Type mismatch produces \`"Expected <expected>, received <actual>"\`. The actual type name is \`typeof value\`, except that arrays report \`'array'\` and \`null\` reports \`'null'\`.
2. \`z.object\` **strips** keys that are not in the shape. A missing (or \`undefined\`) key whose schema is not optional produces \`{ path: [key], message: 'Required' }\`.
3. \`z.object\` and \`z.array\` collect **every** issue from their children, not just the first.
4. \`.refine\` and \`.transform\` run in the order they were chained, after the base type check passes. A failed refine produces one issue at the current path.
5. Calling \`.optional()\`, \`.refine()\` or \`.transform()\` must not mutate the schema it was called on.

\`\`\`js
const user = z.object({
  name: z.string().refine((s) => s.length > 0, 'Name is required'),
  age: z.number().transform((n) => Math.trunc(n)),
  nickname: z.string().optional(),
});

user.safeParse({ name: 'Ada', age: 36.9, role: 'admin' });
// { success: true, data: { name: 'Ada', age: 36 } }

user.safeParse({ name: '', age: 'x' });
// { success: false, error: { issues: [
//     { path: ['name'], message: 'Name is required' },
//     { path: ['age'], message: 'Expected number, received string' },
//   ] } }
\`\`\``,
      starterCode: `const z = {
  // string, number, boolean, object, array
};

module.exports = { z };`,
      solutionCode: `function typeName(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function makeSchema(validate) {
  const schema = {
    _validate: validate,
    _effects: [],
    _optional: false,

    _clone(patch) {
      const next = makeSchema(validate);
      next._effects = schema._effects.slice();
      next._optional = schema._optional;
      if (patch.effect) next._effects.push(patch.effect);
      if (patch.optional) next._optional = true;
      return next;
    },

    optional() {
      return schema._clone({ optional: true });
    },

    refine(fn, message) {
      return schema._clone({
        effect: { kind: 'refine', fn, message: message || 'Invalid input' },
      });
    },

    transform(fn) {
      return schema._clone({ effect: { kind: 'transform', fn } });
    },

    _run(value, path) {
      if (value === undefined && schema._optional) {
        return { ok: true, value: undefined };
      }
      const base = validate(value, path);
      if (!base.ok) return base;

      let out = base.value;
      for (const effect of schema._effects) {
        if (effect.kind === 'refine') {
          if (!effect.fn(out)) {
            return { ok: false, issues: [{ path, message: effect.message }] };
          }
        } else {
          out = effect.fn(out);
        }
      }
      return { ok: true, value: out };
    },

    safeParse(value) {
      const result = schema._run(value, []);
      return result.ok
        ? { success: true, data: result.value }
        : { success: false, error: { issues: result.issues } };
    },

    parse(value) {
      const result = schema.safeParse(value);
      if (result.success) return result.data;
      const err = new Error(
        result.error.issues
          .map((i) => (i.path.length ? i.path.join('.') + ': ' : '') + i.message)
          .join('; '),
      );
      err.issues = result.error.issues;
      throw err;
    },
  };

  return schema;
}

function primitive(expected) {
  return makeSchema((value, path) => {
    const actual = typeName(value);
    if (actual !== expected) {
      return {
        ok: false,
        issues: [{ path, message: 'Expected ' + expected + ', received ' + actual }],
      };
    }
    return { ok: true, value };
  });
}

const z = {
  string: () => primitive('string'),
  number: () => primitive('number'),
  boolean: () => primitive('boolean'),

  object(shape) {
    return makeSchema((value, path) => {
      const actual = typeName(value);
      if (actual !== 'object') {
        return {
          ok: false,
          issues: [{ path, message: 'Expected object, received ' + actual }],
        };
      }

      const out = {};
      const issues = [];
      for (const key of Object.keys(shape)) {
        const child = shape[key];
        const childPath = path.concat([key]);
        const present =
          Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined;

        if (!present) {
          if (child._optional) continue;
          issues.push({ path: childPath, message: 'Required' });
          continue;
        }

        const result = child._run(value[key], childPath);
        if (result.ok) out[key] = result.value;
        else issues.push(...result.issues);
      }

      return issues.length ? { ok: false, issues } : { ok: true, value: out };
    });
  },

  array(inner) {
    return makeSchema((value, path) => {
      if (!Array.isArray(value)) {
        return {
          ok: false,
          issues: [{ path, message: 'Expected array, received ' + typeName(value) }],
        };
      }

      const out = [];
      const issues = [];
      value.forEach((item, index) => {
        const result = inner._run(item, path.concat([index]));
        if (result.ok) out.push(result.value);
        else issues.push(...result.issues);
      });

      return issues.length ? { ok: false, issues } : { ok: true, value: out };
    });
  },
};

module.exports = { z };`,
      hints: [
        'Give every schema one internal method — `_run(value, path)` returning `{ ok: true, value }` or `{ ok: false, issues }`. safeParse is a thin wrapper that calls `_run(value, [])`.',
        'Store effects as a list of `{ kind: "refine" | "transform", ... }` so the chain order is preserved, and apply them after the base type check.',
        'optional/refine/transform must copy the effect list rather than push onto it, or `const base = z.string()` would be polluted by every derived schema.',
        'Object and array validators build the child path with `path.concat([key])` and gather issues from every child before deciding to fail.',
        'Iterate the *shape* keys, not the value keys — that is what strips unknown properties.',
      ],
      tests: [
        {
          name: 'primitives parse and report the received type',
          assertion:
            "(() => { const z = solution.z; return deepEqual(z.string().safeParse('hi'), { success: true, data: 'hi' }) && deepEqual(z.number().safeParse('hi'), { success: false, error: { issues: [{ path: [], message: 'Expected number, received string' }] } }); })()",
        },
        {
          name: 'arrays and null report their own type names',
          assertion:
            "(() => { const z = solution.z; return deepEqual(z.string().safeParse([1]), { success: false, error: { issues: [{ path: [], message: 'Expected string, received array' }] } }) && deepEqual(z.object({}).safeParse(null), { success: false, error: { issues: [{ path: [], message: 'Expected object, received null' }] } }); })()",
        },
        {
          name: 'objects strip unknown keys',
          assertion:
            "(() => { const z = solution.z; return deepEqual(z.object({ a: z.number() }).safeParse({ a: 1, b: 2 }), { success: true, data: { a: 1 } }); })()",
        },
        {
          name: 'missing required keys produce a Required issue at the right path',
          assertion:
            "(() => { const z = solution.z; return deepEqual(z.object({ a: z.number(), b: z.string() }).safeParse({ a: 1 }), { success: false, error: { issues: [{ path: ['b'], message: 'Required' }] } }); })()",
        },
        {
          name: 'every child issue is collected',
          assertion:
            "(() => { const z = solution.z; const r = z.object({ a: z.number(), b: z.string() }).safeParse({ a: 'x', b: 2 }); return deepEqual(r, { success: false, error: { issues: [{ path: ['a'], message: 'Expected number, received string' }, { path: ['b'], message: 'Expected string, received number' }] } }); })()",
        },
        {
          name: 'array paths include the numeric index',
          assertion:
            "(() => { const z = solution.z; const r = z.object({ tags: z.array(z.string()) }).safeParse({ tags: ['a', 3] }); return deepEqual(r, { success: false, error: { issues: [{ path: ['tags', 1], message: 'Expected string, received number' }] } }); })()",
        },
        {
          name: 'optional accepts undefined and missing keys',
          assertion:
            "(() => { const z = solution.z; return deepEqual(z.string().optional().safeParse(undefined), { success: true, data: undefined }) && deepEqual(z.object({ a: z.string().optional() }).safeParse({}), { success: true, data: {} }); })()",
        },
        {
          name: 'refine reports its message, transform rewrites the value',
          assertion:
            "(() => { const z = solution.z; const s = z.number().refine((n) => n > 0, 'must be positive').transform((n) => n * 2); return deepEqual(s.safeParse(5), { success: true, data: 10 }) && deepEqual(s.safeParse(-1), { success: false, error: { issues: [{ path: [], message: 'must be positive' }] } }); })()",
        },
        {
          name: 'chaining does not mutate the schema it came from',
          assertion:
            "(() => { const z = solution.z; const base = z.number(); const positive = base.refine((n) => n > 0, 'nope'); return positive.safeParse(-1).success === false && base.safeParse(-1).success === true; })()",
          hidden: true,
        },
        {
          name: 'parse returns data or throws with the issues attached',
          assertion:
            "(() => { const z = solution.z; const s = z.object({ a: z.string() }); if (s.parse({ a: 'ok' }).a !== 'ok') return false; try { s.parse({}); return false; } catch (e) { return deepEqual(e.issues, [{ path: ['a'], message: 'Required' }]); } })()",
          hidden: true,
        },
        {
          name: 'nested objects and arrays compose',
          assertion:
            "(() => { const z = solution.z; const s = z.object({ users: z.array(z.object({ name: z.string(), age: z.number().optional() })) }); return deepEqual(s.safeParse({ users: [{ name: 'a', age: 1, x: 9 }, { name: 'b' }] }), { success: true, data: { users: [{ name: 'a', age: 1 }, { name: 'b' }] } }); })()",
        },
      ],
      xp: 85,
    },
    {
      slug: 'trpc-router-caller',
      title: 'A tRPC-Style Router and Caller',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Underneath the type magic, tRPC is a nested object of procedures plus a resolver that walks it. Build the runtime half.

Implement \`initTRPC()\`, returning \`{ procedure, router }\`.

**The procedure builder** — \`procedure\` is an immutable builder. Every method returns a **new** builder; the one you called it on is unchanged.

- \`.use(middleware)\` — append a middleware.
- \`.input(schema)\` — set the input schema. A schema is any object with a \`parse(value)\` method.
- \`.query(resolver)\` / \`.mutation(resolver)\` — finish the builder and return a procedure whose \`type\` is \`'query'\` or \`'mutation'\`.

**Middleware** is \`({ ctx, path, type, next }) => any\`. It must call \`next()\` to continue, or \`next({ ctx: newCtx })\` to replace the context for everything downstream. Middlewares run in the order they were added, outermost first, and each one's return value is what its caller receives.

**The resolver** is \`({ ctx, input, path, type }) => any\`.

**\`router(routes)\`** takes an object whose values are procedures or nested routers, and returns an object with \`createCaller(ctx)\`. The caller mirrors the route tree, with every procedure replaced by \`(input) => Promise<result>\`.

Order of operations for a call: run all middlewares, **then** validate the input with \`schema.parse(raw)\` (or pass the raw argument through when there is no schema), **then** call the resolver. \`path\` is the dot-joined route path, e.g. \`'post.byId'\`.

\`\`\`js
const t = initTRPC();

const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new Error('UNAUTHORIZED');
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const appRouter = t.router({
  health: t.procedure.query(() => 'ok'),
  post: t.router({
    byId: t.procedure
      .input({ parse: (v) => ({ id: String(v.id) }) })
      .query(({ input }) => ({ id: input.id, title: 'Hello' })),
    create: protectedProcedure.mutation(({ ctx }) => ({ authorId: ctx.user.id })),
  }),
});

const caller = appRouter.createCaller({ user: { id: 'u1' } });
await caller.health();                  // 'ok'
await caller.post.byId({ id: 7 });      // { id: '7', title: 'Hello' }
await caller.post.create();             // { authorId: 'u1' }
\`\`\``,
      starterCode: `function initTRPC() {
  // return { procedure, router }
}

module.exports = { initTRPC };`,
      solutionCode: `function initTRPC() {
  function createBuilder(def) {
    return {
      _kind: 'builder',

      use(middleware) {
        return createBuilder({
          ...def,
          middlewares: def.middlewares.concat([middleware]),
        });
      },

      input(schema) {
        return createBuilder({ ...def, inputSchema: schema });
      },

      query(resolver) {
        return { _kind: 'procedure', type: 'query', def: { ...def, resolver } };
      },

      mutation(resolver) {
        return { _kind: 'procedure', type: 'mutation', def: { ...def, resolver } };
      },
    };
  }

  const procedure = createBuilder({ middlewares: [], inputSchema: null });

  async function invoke(proc, baseCtx, path, rawInput) {
    const { middlewares, inputSchema, resolver } = proc.def;
    const type = proc.type;

    const step = async (index, ctx) => {
      if (index < middlewares.length) {
        return middlewares[index]({
          ctx,
          path,
          type,
          next: (opts) => step(index + 1, opts && 'ctx' in opts ? opts.ctx : ctx),
        });
      }
      const input = inputSchema ? inputSchema.parse(rawInput) : rawInput;
      return resolver({ ctx, input, path, type });
    };

    return step(0, baseCtx);
  }

  function buildCaller(routes, ctx, prefix) {
    const caller = {};
    for (const key of Object.keys(routes)) {
      const node = routes[key];
      const path = prefix.concat([key]);
      if (node && node._kind === 'router') {
        caller[key] = buildCaller(node.routes, ctx, path);
      } else {
        caller[key] = (input) => invoke(node, ctx, path.join('.'), input);
      }
    }
    return caller;
  }

  function router(routes) {
    return {
      _kind: 'router',
      routes,
      createCaller(ctx) {
        return buildCaller(routes, ctx, []);
      },
    };
  }

  return { procedure, router };
}

module.exports = { initTRPC };`,
      hints: [
        'Model the builder as a function over an immutable definition object: `{ middlewares, inputSchema }`. Every method spreads it into a new one.',
        '`.query()` and `.mutation()` are terminal — they stop returning builders and return a tagged procedure carrying its resolver and type.',
        'Tag routers and procedures with a marker field so createCaller can tell a nested router from a leaf.',
        'Run the middleware chain with a recursive `step(index, ctx)`; the `next` you hand each middleware calls `step(index + 1, ...)` with either the replaced ctx or the current one.',
        'Input validation belongs at the bottom of the middleware chain, immediately before the resolver.',
      ],
      tests: [
        {
          name: 'calls a top-level query',
          assertion:
            "(async () => { const t = solution.initTRPC(); const r = t.router({ health: t.procedure.query(() => 'ok') }); return (await r.createCaller({}).health()) === 'ok'; })()",
        },
        {
          name: 'resolves nested procedure paths and reports the dotted path',
          assertion:
            "(async () => { const t = solution.initTRPC(); const r = t.router({ post: t.router({ meta: t.router({ ping: t.procedure.query(({ path }) => path) }) }) }); return (await r.createCaller({}).post.meta.ping()) === 'post.meta.ping'; })()",
        },
        {
          name: 'query and mutation carry the right type',
          assertion:
            "(async () => { const t = solution.initTRPC(); const r = t.router({ a: t.procedure.query(({ type }) => type), b: t.procedure.mutation(({ type }) => type) }); const c = r.createCaller({}); return (await c.a()) === 'query' && (await c.b()) === 'mutation'; })()",
        },
        {
          name: 'input is validated and transformed by the schema',
          assertion:
            "(async () => { const t = solution.initTRPC(); const schema = { parse: (v) => ({ id: String(v.id) }) }; const r = t.router({ byId: t.procedure.input(schema).query(({ input }) => input) }); return deepEqual(await r.createCaller({}).byId({ id: 7 }), { id: '7' }); })()",
        },
        {
          name: 'a schema that throws rejects the call',
          assertion:
            "(async () => { const t = solution.initTRPC(); const schema = { parse: () => { throw new Error('BAD_INPUT'); } }; const r = t.router({ x: t.procedure.input(schema).query(() => 1) }); try { await r.createCaller({}).x({}); return false; } catch (e) { return e.message === 'BAD_INPUT'; } })()",
        },
        {
          name: 'with no input schema the raw argument is passed through',
          assertion:
            "(async () => { const t = solution.initTRPC(); const r = t.router({ echo: t.procedure.query(({ input }) => input) }); return (await r.createCaller({}).echo(42)) === 42; })()",
        },
        {
          name: 'middlewares run outermost-first and unwind in reverse',
          assertion:
            "(async () => { const t = solution.initTRPC(); const log = []; const p = t.procedure.use(async ({ next }) => { log.push('m1'); const r = await next(); log.push('m1-end'); return r; }).use(async ({ next }) => { log.push('m2'); return next(); }); const r = t.router({ x: p.query(() => { log.push('handler'); return 1; }) }); await r.createCaller({}).x(); return deepEqual(log, ['m1','m2','handler','m1-end']); })()",
        },
        {
          name: 'middleware can replace the context for everything downstream',
          assertion:
            "(async () => { const t = solution.initTRPC(); const p = t.procedure.use(({ ctx, next }) => next({ ctx: { ...ctx, extra: 42 } })); const r = t.router({ x: p.query(({ ctx }) => ctx.extra + ctx.base) }); return (await r.createCaller({ base: 1 }).x()) === 43; })()",
        },
        {
          name: 'a protectedProcedure rejects an anonymous context',
          assertion:
            "(async () => { const t = solution.initTRPC(); const prot = t.procedure.use(({ ctx, next }) => { if (!ctx.user) throw new Error('UNAUTHORIZED'); return next({ ctx: { ...ctx, user: ctx.user } }); }); const r = t.router({ me: prot.query(({ ctx }) => ctx.user.id) }); if ((await r.createCaller({ user: { id: 'u1' } }).me()) !== 'u1') return false; try { await r.createCaller({ user: null }).me(); return false; } catch (e) { return e.message === 'UNAUTHORIZED'; } })()",
        },
        {
          name: 'the builder is immutable — .use() does not affect the base procedure',
          assertion:
            "(async () => { const t = solution.initTRPC(); let ran = 0; const base = t.procedure; const guarded = base.use(({ next }) => { ran++; return next(); }); const r = t.router({ open: base.query(() => 'open'), closed: guarded.query(() => 'closed') }); const c = r.createCaller({}); await c.open(); return ran === 0 && (await c.closed()) === 'closed' && ran === 1; })()",
          hidden: true,
        },
        {
          name: 'a middleware can rewrite the downstream result',
          assertion:
            "(async () => { const t = solution.initTRPC(); const p = t.procedure.use(async ({ next }) => ({ data: await next() })); const r = t.router({ x: p.query(() => 1) }); return deepEqual(await r.createCaller({}).x(), { data: 1 }); })()",
          hidden: true,
        },
      ],
      xp: 110,
    },
  ],
  flashcards: [
    {
      front: 'Define end-to-end typesafety in one sentence.',
      back: "The client's type for a response is derived from the server's implementation, so a change on one side becomes a compile error on the other.",
      tags: ['typesafety', 'trpc'],
    },
    {
      front: 'Why is codegen a weaker guarantee than inference?',
      back: 'Codegen adds a step and an artefact. If the generator has not been re-run, or the hand-written spec does not match the handler, the types are confidently wrong. Inference has no artefact to go stale.',
      tags: ['typesafety', 'openapi', 'graphql'],
    },
    {
      front: 'What deployment constraint does tRPC impose?',
      back: '`import type { AppRouter }` must resolve, so client and server need one TypeScript codebase or a published package. No versioned wire contract, so both sides must ship together.',
      tags: ['trpc', 'architecture'],
    },
    {
      front: 'Four cases where tRPC is the wrong tool',
      back: 'Public APIs, non-TypeScript consumers, native mobile clients, and independently versioned services. All of them need a language-neutral contract: REST plus OpenAPI, or GraphQL.',
      tags: ['trpc', 'architecture'],
    },
    {
      front: 'What does a tRPC middleware calling `next({ ctx })` achieve?',
      back: 'It replaces the context downstream *and* narrows its type, which is how `protectedProcedure` makes `ctx.user` non-nullable for every resolver behind it.',
      tags: ['trpc', 'middleware'],
    },
    {
      front: '`inferRouterOutputs<AppRouter>` — what is it for?',
      back: 'It extracts the exact return type of every procedure so components can be typed from the server implementation instead of a hand-maintained interface.',
      tags: ['trpc', 'typescript'],
    },
    {
      front: 'Zod: `parse` vs `safeParse`',
      back: '`parse` throws a ZodError — right for boot-time config. `safeParse` returns a discriminated union of `{ success, data }` or `{ success, error }` — right for request bodies, where you build a 422 from `error.issues`.',
      tags: ['zod', 'validation'],
    },
    {
      front: 'Why `z.discriminatedUnion` over `z.union`?',
      back: 'It switches on the tag, so you get one precise error from the matching branch instead of every branch failing, and dispatch is constant time.',
      tags: ['zod'],
    },
    {
      front: 'What does `satisfies` give you that an annotation does not?',
      back: 'The constraint is checked but the value is not widened, so literal keys and values survive. `keyof typeof config` stays a useful union instead of collapsing to `string`.',
      tags: ['typescript'],
    },
    {
      front: 'Which TypeScript features make `z.infer` possible?',
      back: 'Generics to carry inner types, conditional types with `infer` to pattern-match them out, and mapped types to walk an object shape. Template literal types add computed string keys.',
      tags: ['typescript', 'zod'],
    },
    {
      front: 'What does a Fastify `response` schema actually do at runtime?',
      back: 'fast-json-stringify compiles it into a bespoke serialiser that emits only the declared properties. Extra fields are dropped — a free allow-list, and the reason a new field can silently vanish.',
      tags: ['fastify', 'security'],
    },
    {
      front: 'Fastify plugin encapsulation, in one line',
      back: 'Hooks, decorators and routes registered inside a plugin apply only to that plugin subtree. Wrap with `fastify-plugin` when you deliberately want them shared with the parent.',
      tags: ['fastify', 'architecture'],
    },
  ],
  resources: [
    { label: 'tRPC — Documentation', url: 'https://trpc.io/docs', kind: 'DOCS' },
    { label: 'tRPC — Middlewares & context', url: 'https://trpc.io/docs/server/middlewares', kind: 'DOCS' },
    { label: 'Zod — Documentation', url: 'https://zod.dev/', kind: 'DOCS' },
    { label: 'Fastify — Validation and Serialization', url: 'https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/', kind: 'DOCS' },
    { label: 'TypeScript Handbook — Conditional & mapped types', url: 'https://www.typescriptlang.org/docs/handbook/2/conditional-types.html', kind: 'DOCS' },
  ],
};

export default day;
