import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 13,
  week: 2,
  pillar: 'FRONTEND',
  title: 'Next.js II — Server Actions, Route Handlers & Caching',
  summary: 'Read and write data from the server: async components, Server Actions, Route Handlers, and the four caches that make it fast.',
  estimatedMinutes: 340,
  objectives: [
    'Fetch data inside async Server Components and eliminate waterfalls with Promise.all and the preload pattern',
    'Explain request memoization and use React cache() for non-fetch data sources',
    'Write Server Actions with "use server", and wire them up with useActionState, useFormStatus and useOptimistic',
    'Invalidate correctly with revalidatePath and revalidateTag, and redirect after a mutation',
    'Treat every Server Action as a public HTTP endpoint and authorise it accordingly',
    'Build Route Handlers with the Web Request/Response API, including streaming and runtime selection',
    'Validate a form with React Hook Form and a Zod schema shared by client and server',
    'Describe the four Next.js caching layers and what invalidates each',
    'Decide when TanStack Query still earns its place in an App Router app',
  ],
  technologies: ['Next.js', 'React Hook Form', 'Zod', 'TanStack Query'],
  lessons: [
    {
      slug: 'data-fetching-in-server-components',
      title: 'Data Fetching in Server Components: Memoization, Waterfalls & Preload',
      estimatedMinutes: 80,
      body: `# Data Fetching in Server Components: Memoization, Waterfalls & Preload

## The component *is* the data layer

A Server Component can be \`async\`, so fetching is just awaiting. There is no hook, no loading flag, and no separate endpoint to maintain:

\`\`\`tsx
// app/posts/page.tsx
export default async function PostsPage() {
  const res = await fetch('https://api.example.com/posts', { next: { revalidate: 60 } });
  if (!res.ok) throw new Error('Failed to load posts');
  const posts: Post[] = await res.json();

  return (
    <ul>
      {posts.map((p) => (
        <li key={p.id}>{p.title}</li>
      ))}
    </ul>
  );
}
\`\`\`

The thrown error is caught by the nearest \`error.tsx\`. The waiting is covered by the nearest \`loading.tsx\` or \`<Suspense>\`. You have written the happy path and got the other two for free.

You do not have to use \`fetch\`. Calling an ORM, reading a file, or hitting an internal gRPC service all work the same way. \`fetch\` is only special because Next patches it to participate in caching.

## Request memoization

Here is the thing that makes "fetch where you need it" workable. Within **a single render pass**, identical \`fetch\` calls — same URL, same options — are deduplicated. Only one request goes out; every caller gets the same promise.

\`\`\`tsx
// Called by the layout, by generateMetadata, and by the page itself.
// One HTTP request, not three.
async function getUser(id: string) {
  const res = await fetch(\`https://api.example.com/users/\${id}\`);
  return res.json();
}
\`\`\`

This is why prop-drilling data down from the layout is an anti-pattern in the App Router: just call \`getUser(id)\` again in the component that needs it. The memo cache lives for the duration of one server render and is thrown away afterwards — it is *not* a cache between requests, and it is not shared between users.

For anything that is not \`fetch\` — a database query, a filesystem read — wrap it in React's \`cache()\` to get the same behaviour:

\`\`\`tsx
import { cache } from 'react';
import { db } from '@/lib/db';

export const getUser = cache(async (id: string) => {
  return db.user.findUnique({ where: { id } });
});
\`\`\`

\`cache()\` keys on the arguments, so \`getUser('1')\` and \`getUser('2')\` are separate entries while two calls to \`getUser('1')\` share one. Pass primitives; an object argument is compared by reference and will miss every time.

> Request memoization is layer one of four. It is per-render and automatic. The *Data Cache*, which persists across requests, is a different thing entirely — lesson four.

## Waterfalls, and how to not create them

The most common performance bug in a Server Component is an accidental sequential await:

\`\`\`tsx
// BAD: 300 ms + 250 ms = 550 ms
const user = await getUser(id);
const posts = await getPosts(id);
const stats = await getStats(id);
\`\`\`

Nothing here depends on the previous result, so nothing should wait:

\`\`\`tsx
// GOOD: max(300, 250, 180) = 300 ms
const [user, posts, stats] = await Promise.all([getUser(id), getPosts(id), getStats(id)]);
\`\`\`

Use \`Promise.allSettled\` when one of them is allowed to fail without taking the page down.

A genuine dependency — you need the user before you can fetch their team — is a *necessary* waterfall. Two mitigations exist.

**Move the independent branch into its own Suspense boundary** so it fetches in parallel with the rest of the page and streams in when ready:

\`\`\`tsx
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile params={params} />
      </Suspense>
      <Suspense fallback={<FeedSkeleton />}>
        <Feed params={params} />
      </Suspense>
    </>
  );
}
\`\`\`

Note that the page itself is **not** async. If it awaited anything, the shell would block and neither boundary would stream.

**Or preload**: start the request before you need the result, then await it later. Because of request memoization the second call is free.

\`\`\`tsx
// app/_data/user.ts
import { cache } from 'react';

export const getUser = cache(async (id: string) => db.user.findUnique({ where: { id } }));

export const preloadUser = (id: string) => {
  void getUser(id); // fire, do not await
};
\`\`\`

\`\`\`tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  preloadUser(id);              // kick off early
  const team = await getTeam(id); // runs concurrently with the user query
  return <Profile id={id} team={team} />;   // getUser(id) is already in flight
}
\`\`\`

## Sequential by necessity: passing promises down

React 19's \`use\` hook lets a Server Component start a fetch and hand the **unresolved promise** to a Client Component, which suspends on it. That keeps the request starting on the server while the rendering happens on the client:

\`\`\`tsx
// server
export default function Page() {
  const commentsPromise = getComments(); // not awaited
  return (
    <Suspense fallback={<p>Loading comments…</p>}>
      <Comments promise={commentsPromise} />
    </Suspense>
  );
}

// client
'use client';
import { use } from 'react';

export function Comments({ promise }: { promise: Promise<Comment[]> }) {
  const comments = use(promise);
  return <ul>{comments.map((c) => <li key={c.id}>{c.body}</li>)}</ul>;
}
\`\`\`

Promises are one of the few non-plain values that *can* cross the serialisation boundary, precisely to enable this.

## A checklist for any new page

1. Is any await sequential without needing to be? Wrap in \`Promise.all\`.
2. Is the slow part inside a \`<Suspense>\` boundary, or is it blocking the shell?
3. Are you passing data down as props when you could just call the memoized function again?
4. Does each \`fetch\` say what it wants from the cache — \`no-store\`, \`force-cache\`, or \`next: { revalidate, tags }\`? In Next 15 the default is \`no-store\`, so silence means "hit the origin every time".`,
    },
    {
      slug: 'server-actions',
      title: 'Server Actions: Mutations, Progressive Enhancement & Security',
      estimatedMinutes: 90,
      body: `# Server Actions: Mutations, Progressive Enhancement & Security

Reading data got simple. Server Actions do the same for writing it: an async function that runs on the server but is *called* from the client, with no endpoint, no fetch call and no client/server type drift.

## The basics

\`'use server'\` at the top of a file marks every export as a Server Action. It can also go at the top of an individual async function body.

\`\`\`ts
// app/posts/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const CreatePost = z.object({
  title: z.string().min(3, 'Title is too short'),
  body: z.string().min(10, 'Body is too short'),
});

export type FormState = { errors?: Record<string, string[]>; message?: string };

export async function createPost(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session) return { message: 'You must be signed in.' };

  const parsed = CreatePost.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const post = await db.post.create({
    data: { ...parsed.data, authorId: session.user.id },
  });

  revalidatePath('/posts');
  redirect(\`/posts/\${post.id}\`);
}
\`\`\`

Under the hood Next compiles this into a POST endpoint with a generated action ID, and \`<form action={createPost}>\` becomes a form that posts to the current URL with that ID attached. The function reference you import on the client is a stub; the body never ships.

## Progressive enhancement

\`\`\`tsx
<form action={createPost}>
  <input name="title" />
  <button>Save</button>
</form>
\`\`\`

This form **works with JavaScript disabled**, and it works before hydration finishes. That is not a party trick: on a slow connection, the window between HTML arriving and JS becoming interactive is where real users click buttons that do nothing. Native form submission covers that window.

You keep progressive enhancement as long as the action is attached to \`<form action={...}>\`. You lose it the moment you switch to \`onClick={() => createPost(...)}\`, which is sometimes the right call — just make it knowingly.

## useActionState

\`\`\`tsx
'use client';
import { useActionState } from 'react';
import { createPost, type FormState } from './actions';

const initialState: FormState = {};

export function PostForm() {
  const [state, formAction, isPending] = useActionState(createPost, initialState);

  return (
    <form action={formAction}>
      <label htmlFor="title">Title</label>
      <input id="title" name="title" aria-describedby="title-error" />
      {state.errors?.title && (
        <p id="title-error" role="alert">{state.errors.title[0]}</p>
      )}

      <button disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</button>
      {state.message && <p role="alert">{state.message}</p>}
    </form>
  );
}
\`\`\`

\`useActionState(action, initialState)\` returns \`[state, wrappedAction, isPending]\`. The action's first parameter becomes the previous state, and its return value becomes the new state — which is why server-side validation errors can be rendered without any client validation at all. It was called \`useFormState\` and lived in \`react-dom\` before React 19; if you see that name, the code is older.

## useFormStatus

\`useFormStatus\` reads the status of the **nearest enclosing form** and must therefore be called from a *child* component, not the component that renders the \`<form>\`:

\`\`\`tsx
'use client';
import { useFormStatus } from 'react-dom';

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending}>{pending ? 'Working…' : label}</button>;
}
\`\`\`

That constraint trips everyone once. If \`pending\` is always \`false\`, you called the hook in the wrong component.

## useOptimistic

Show the result before the server confirms it, and let React roll back automatically if the action throws:

\`\`\`tsx
'use client';
import { useOptimistic, useRef } from 'react';
import { addTodo } from './actions';

export function TodoList({ todos }: { todos: Todo[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [optimisticTodos, addOptimistic] = useOptimistic(
    todos,
    (state: Todo[], title: string) => [...state, { id: 'temp', title, pending: true }],
  );

  return (
    <>
      <ul>
        {optimisticTodos.map((t) => (
          <li key={t.id} style={{ opacity: t.pending ? 0.5 : 1 }}>{t.title}</li>
        ))}
      </ul>
      <form
        ref={formRef}
        action={async (formData) => {
          const title = String(formData.get('title'));
          formRef.current?.reset();
          addOptimistic(title);
          await addTodo(formData);
        }}
      >
        <input name="title" required />
        <SubmitButton label="Add" />
      </form>
    </>
  );
}
\`\`\`

The mental model matters more than the API: the optimistic value is **derived**, not stored. React keeps a list of pending optimistic updates and recomputes \`reducer\` over the *current* base state each render. When the action settles and the base state updates, the pending entry is dropped and the recomputation naturally reconciles. If the action throws, the entry is dropped with no new base state — an automatic rollback. Today's medium problem asks you to implement exactly this.

## Revalidation and redirect

A mutation is only half done when the write succeeds; the cached reads still show the old data.

\`\`\`ts
import { revalidatePath, revalidateTag } from 'next/cache';

revalidatePath('/posts');            // this route
revalidatePath('/posts/[id]', 'page'); // a dynamic route's pages
revalidatePath('/blog', 'layout');   // the layout and everything nested under it
revalidateTag('posts');              // every fetch tagged 'posts', anywhere
\`\`\`

Tags are the better default because they follow the *data*, not the URL. Tag your reads and invalidate by tag:

\`\`\`ts
await fetch('https://api.example.com/posts', { next: { tags: ['posts'] } });
\`\`\`

\`redirect()\` works by throwing a special error that Next catches, so **it must be called outside any \`try\`/\`catch\`** — a bare \`catch\` will swallow it and your redirect silently disappears. Call it after the try block, never inside it.

## The security rule

> **A Server Action is a public HTTP endpoint.** Anyone can POST to it with any payload, from curl, forever.

The action ID is generated, but it is present in the HTML shipped to every visitor. It is obfuscation, not authorisation. Every action must therefore, in its own body:

1. **Authenticate** — get the session; do not accept a \`userId\` from the form.
2. **Authorise** — confirm *this* user may act on *this* record.
3. **Validate** — parse the input with Zod before touching the database.

\`\`\`ts
'use server';

export async function deletePost(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error('Unauthorised');

  const id = z.string().uuid().parse(formData.get('id'));

  // Ownership check in the query itself — not a separate read-then-write.
  const { count } = await db.post.deleteMany({
    where: { id, authorId: session.user.id },
  });
  if (count === 0) throw new Error('Not found');

  revalidateTag('posts');
}
\`\`\`

Two more things worth knowing. Next verifies the \`Origin\`/\`Host\` headers on action requests, which gives you CSRF protection for free — configure \`serverActions.allowedOrigins\` if you proxy through another domain. And a \`'use server'\` file must export *only* async functions; exporting a constant from it is a build error, because every export becomes a callable endpoint.`,
    },
    {
      slug: 'route-handlers-and-forms',
      title: 'Route Handlers, and Forms Done Properly with React Hook Form + Zod',
      estimatedMinutes: 85,
      body: `# Route Handlers, and Forms Done Properly with React Hook Form + Zod

## Route Handlers

Server Actions cover mutations from your own UI. A **Route Handler** is what you reach for when something else needs to talk to you: a mobile app, a webhook, a cron job, an OAuth callback, an RSS feed.

\`app/api/posts/route.ts\` becomes \`/api/posts\`. You export one function per HTTP method, and you work with the standard Web \`Request\` and \`Response\`:

\`\`\`ts
// app/api/posts/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { CreatePost } from '@/lib/schemas';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  const posts = await db.post.findMany({ where: { title: { contains: q } }, take: 20 });
  return NextResponse.json(posts);
}

export async function POST(request: Request) {
  const parsed = CreatePost.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const post = await db.post.create({ data: parsed.data });
  return NextResponse.json(post, { status: 201 });
}
\`\`\`

Dynamic segments arrive the same way pages get them, and in Next 15 they are a **Promise**:

\`\`\`ts
// app/api/posts/[id]/route.ts
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.post.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
\`\`\`

Rules and gotchas:

- \`route.ts\` and \`page.tsx\` **cannot** live in the same folder — one URL, one handler.
- In Next 15 \`GET\` handlers are **not cached by default**. Opt in with \`export const dynamic = 'force-static'\` or per-fetch options.
- \`export const runtime = 'edge'\` picks the edge runtime: fast cold starts, global placement, but no Node APIs and no TCP database drivers. \`'nodejs'\` is the default and usually the right answer for anything touching a database.
- Use \`export const revalidate = 3600\` for a cacheable feed.

Streaming works because \`Response\` accepts a \`ReadableStream\`:

\`\`\`ts
export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const line of ['first', 'second', 'third']) {
        controller.enqueue(encoder.encode(line + '\\n'));
        await new Promise((r) => setTimeout(r, 500));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
\`\`\`

That is the same shape you use to proxy an LLM token stream or a server-sent-events feed.

**Choosing between the two:** if the caller is your own React tree, use a Server Action. If the caller is anything else — or you need a specific status code, custom headers, or a stable public contract — use a Route Handler.

## One schema, two places

The best thing Zod does for a Next app is let the *same* schema validate on the client for instant feedback and on the server for actual safety. Put it in a shared module with no server imports:

\`\`\`ts
// lib/schemas.ts
import { z } from 'zod';

export const SignUp = z
  .object({
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'At least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords must match',
    path: ['confirm'],
  });

export type SignUpInput = z.infer<typeof SignUp>;
\`\`\`

\`z.infer\` means the TypeScript type is *derived from* the validator. There is exactly one definition of what a valid sign-up is, and it cannot drift.

> Client validation is a UX feature. Server validation is the security control. You need both, and sharing the schema is what makes having both cheap.

## React Hook Form

RHF keeps inputs **uncontrolled**: it holds refs to the DOM nodes and does not re-render on every keystroke. A ten-field form re-renders when an error appears, not sixty times while you type.

\`\`\`bash
npm i react-hook-form zod @hookform/resolvers
\`\`\`

\`\`\`tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SignUp, type SignUpInput } from '@/lib/schemas';
import { signUp } from './actions';

export function SignUpForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(SignUp),
    defaultValues: { email: '', password: '', confirm: '' },
    mode: 'onTouched',
  });

  async function onValid(values: SignUpInput) {
    const result = await signUp(values); // a Server Action taking a plain object
    if (result?.errors) {
      for (const [field, messages] of Object.entries(result.errors)) {
        setError(field as keyof SignUpInput, { message: messages[0] });
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" {...register('email')} aria-invalid={!!errors.email} />
      {errors.email && <p role="alert">{errors.email.message}</p>}

      <label htmlFor="password">Password</label>
      <input id="password" type="password" {...register('password')} />
      {errors.password && <p role="alert">{errors.password.message}</p>}

      <label htmlFor="confirm">Confirm password</label>
      <input id="confirm" type="password" {...register('confirm')} />
      {errors.confirm && <p role="alert">{errors.confirm.message}</p>}

      <button disabled={isSubmitting}>Create account</button>
    </form>
  );
}
\`\`\`

Three details that matter:

- \`register('email')\` returns \`{ name, onChange, onBlur, ref }\`. Spreading it wires the input up.
- Always set \`defaultValues\`, or a field is \`undefined\` until first typed and React warns about switching from uncontrolled to controlled.
- \`setError\` is how you surface server-side failures — a duplicate email, say — on the right field instead of in a toast.

## What a resolver actually is

A resolver is just a function. RHF hands it the current values and expects one shape back:

\`\`\`ts
type Resolver = (values: unknown) => Promise<{
  values: Record<string, unknown>;              // {} when invalid
  errors: Record<string, { type: string; message: string }>; // {} when valid
}>;
\`\`\`

\`zodResolver\` is a thin adapter that runs \`schema.safeParse\` and maps Zod issues onto that contract. Knowing this is what lets you write a resolver for any validator — Valibot, Yup, or a hand-rolled one. Today's medium problem is exactly that: a miniature schema library plus the resolver adapter.

## Which form approach when

| Situation | Use |
| --- | --- |
| Simple create/delete, wants to work without JS | \`<form action={serverAction}>\` + \`useActionState\` |
| Rich client validation, many fields, conditional UI | React Hook Form + \`zodResolver\`, submitting to a Server Action |
| Both | RHF for UX, and re-parse with the same schema inside the action |

Whatever you pick, the server re-validates. Client validation you can bypass with devtools in four seconds.`,
    },
    {
      slug: 'caching-layers-and-mutations',
      title: 'The Four Caches, TanStack Query, and an End-to-End Mutation',
      estimatedMinutes: 85,
      body: `# The Four Caches, TanStack Query, and an End-to-End Mutation

Most "Next.js is confusing" complaints are really "Next.js caching is confusing". There are four layers, they have different lifetimes, and they live on different machines. Once you can name them, the behaviour stops being mysterious.

## The four layers

| Layer | Where | Stores | Lifetime | Invalidated by |
| --- | --- | --- | --- | --- |
| **Request Memoization** | server, in React | return values of \`fetch\` / \`cache()\` | **one render pass** | nothing — it evaporates when the render ends |
| **Data Cache** | server, persistent store | \`fetch\` response bodies | across requests *and* deployments | \`revalidateTag\`, \`revalidatePath\`, time-based \`revalidate\`, \`cache: 'no-store'\` |
| **Full Route Cache** | server, build output | the rendered HTML + RSC payload of a static route | until revalidated or redeployed | \`revalidatePath\`, \`revalidateTag\` on data the route used, a new deployment |
| **Router Cache** | **client**, in memory | RSC payloads of visited/prefetched routes | the session (or a tab reload) | \`router.refresh()\`, a Server Action that revalidates, \`revalidate*\` responses, a hard navigation |

Read the "where" column twice. Request Memoization and the Data Cache both sit on the server but answer different questions: *"did I already ask this during this render?"* versus *"did anyone ask this recently?"* The Router Cache surprises people, because clearing a server cache does nothing about a payload already in a user's browser.

## Next 15 defaults you must know

- \`fetch\` is **not** cached unless you ask. \`cache: 'force-cache'\` or \`next: { revalidate: n }\` opts in.
- \`GET\` Route Handlers are **not** cached by default.
- The client Router Cache has \`staleTimes.dynamic = 0\`: page segments are re-fetched on navigation, while layouts and \`loading.tsx\` are still reused. Tune it in \`next.config.ts\`:

\`\`\`ts
const config = {
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
};
\`\`\`

If you are on Next 14, invert almost all of the above: everything was cached by default and you opted out. That difference explains most contradictory blog posts.

## Tagging is the good pattern

\`\`\`ts
// read
const res = await fetch('https://api.example.com/posts', {
  next: { revalidate: 3600, tags: ['posts'] },
});

// a single post also carries a specific tag
const one = await fetch(\`https://api.example.com/posts/\${id}\`, {
  next: { tags: ['posts', \`post:\${id}\`] },
});
\`\`\`

\`\`\`ts
// write
revalidateTag('posts');       // list pages, search pages, sidebars — all of them
revalidateTag(\`post:\${id}\`);  // just this one detail page
\`\`\`

That fan-out is the point: one tag on many entries, many tags on one entry. You invalidate by *what changed*, not by guessing which URLs happened to render it. Today's hard problem is a cache with exactly this behaviour, plus the \`'page'\` versus \`'layout'\` path semantics.

For non-\`fetch\` data sources, \`unstable_cache\` gives you tags around an arbitrary async function:

\`\`\`ts
import { unstable_cache } from 'next/cache';

export const getPosts = unstable_cache(
  async () => db.post.findMany(),
  ['posts-list'],                       // key parts
  { tags: ['posts'], revalidate: 3600 },
);
\`\`\`

## Debugging

Set \`logging: { fetches: { fullUrl: true } }\` in \`next.config.ts\` and the dev server logs every \`fetch\` with \`(cache skip)\`, \`(cache hit)\` or \`(cache miss)\` and the reason. Before theorising about why data is stale, read that log.

## Do you still want TanStack Query?

Often, no. Initial page data belongs in a Server Component, and mutations belong in a Server Action with \`revalidateTag\`. Adding a client cache on top of that is duplicated state and duplicated bytes.

**Reach for TanStack Query when the interaction is client-driven and high-frequency:**

- infinite scroll and cursor pagination with \`useInfiniteQuery\`
- polling or websocket-backed dashboards (\`refetchInterval\`)
- search-as-you-type, where the query key changes on every keystroke
- offline support, retry/backoff, window-focus refetching
- long-lived client views where a full server round trip per interaction feels heavy

**Do not reach for it when:** you just need the data for first paint, or the mutation is a form submit followed by a revalidate. That is what the framework already does.

The two coexist cleanly — prefetch on the server, hydrate on the client:

\`\`\`tsx
// app/posts/page.tsx — Server Component
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { getPosts } from '@/lib/api';
import { PostsClient } from './posts-client';

export default async function Page() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({ queryKey: ['posts'], queryFn: getPosts });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PostsClient />
    </HydrationBoundary>
  );
}
\`\`\`

\`PostsClient\` calls \`useQuery({ queryKey: ['posts'], queryFn: getPosts })\` and finds the data already in its cache — no loading flash, and infinite scroll from there onwards works entirely client-side.

## Error and loading UI, one more time

- \`loading.tsx\` — a Suspense fallback for the whole segment. Free streaming.
- \`error.tsx\` — a Client Component error boundary; gets \`error\` and \`reset\`. Catches errors *below* it, never in its own layout.
- \`global-error.tsx\` — catches errors in the root layout. It must render its own \`<html>\` and \`<body>\`.
- \`notFound()\` from \`next/navigation\` — renders the nearest \`not-found.tsx\` with a 404 status.
- In production, error messages from the server are redacted and replaced with a \`digest\` hash you can match against your server logs. Do not build user-facing copy from \`error.message\`.

## An end-to-end mutation

Putting the whole day together:

\`\`\`ts
// app/posts/actions.ts
'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { CreatePost } from '@/lib/schemas';

export async function createPost(_prev: unknown, formData: FormData) {
  const session = await auth();                                  // 1. authenticate
  if (!session) return { message: 'Sign in first.' };

  const parsed = CreatePost.safeParse(Object.fromEntries(formData)); // 2. validate
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const post = await db.post.create({                            // 3. authorised write
    data: { ...parsed.data, authorId: session.user.id },
  });

  revalidateTag('posts');                                        // 4. invalidate
  redirect(\`/posts/\${post.id}\`);                                 // 5. navigate (outside try/catch)
}
\`\`\`

1. The client submits through \`<form action={formAction}>\`, so it works pre-hydration.
2. \`useOptimistic\` shows the post instantly; if the action throws, the optimistic entry is dropped.
3. The action authenticates, authorises and validates *server-side*, because it is a public endpoint.
4. \`revalidateTag('posts')\` clears the Data Cache entries and the Full Route Cache for routes that used them.
5. The action response also refreshes the client Router Cache, so the redirect lands on fresh data rather than a stale payload.

Five steps, one language, no API layer in between. That is what the App Router buys you — and the price is knowing which of four caches you are looking at when something is stale.`,
    },
  ],
  quiz: [
    {
      prompt: 'Three components in one render call `fetch("/api/user/1")` with identical options. How many HTTP requests leave the server?',
      options: [
        'Three — each component fetches independently',
        'One — identical fetches are memoized within a single render pass',
        'One, and it is reused by every future request too',
        'Three, unless you wrap them in React.cache()',
      ],
      correctIndex: 1,
      explanation:
        'Request Memoization deduplicates identical `fetch` calls for the duration of one server render, which is why you can call a data function wherever you need it instead of prop-drilling. It is per-render only — persisting across requests is the separate Data Cache.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Which statement about Server Action security is correct?',
      options: [
        'Server Actions can only be invoked by the page that imports them',
        'The generated action ID acts as a bearer token, so an unauthenticated call fails automatically',
        'Next.js validates FormData against your TypeScript types before the action runs',
        'A Server Action is a public POST endpoint, so it must authenticate, authorise and validate in its own body',
      ],
      correctIndex: 3,
      explanation:
        'Actions compile to real HTTP endpoints whose IDs ship in the HTML. Anyone can POST arbitrary payloads to them. TypeScript types are erased at runtime, so every action needs its own session check, ownership check and Zod parse.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why does `useFormStatus()` return `pending: false` when called in the same component that renders the `<form>`?',
      options: [
        'It reads the nearest *parent* form, so it must be called from a child of the form',
        'It only works with Route Handlers, not Server Actions',
        'You must pass the form ref to it explicitly',
        'It requires the form to have method="post"',
      ],
      correctIndex: 0,
      explanation:
        '`useFormStatus` reads context provided by an ancestor `<form>`. Calling it in the component that renders the form finds no ancestor form, so the status is always idle. Extract a `<SubmitButton />` child instead — or use the `isPending` value from `useActionState`.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What does `revalidatePath("/blog", "layout")` invalidate?',
      options: [
        'Only the file app/blog/layout.tsx',
        'Every route in the application',
        'The /blog layout and every route nested beneath it',
        'The client Router Cache only, leaving server caches untouched',
      ],
      correctIndex: 2,
      explanation:
        'The `"layout"` type invalidates that segment and all nested segments; `"page"` invalidates only the exact page. `revalidatePath("/", "layout")` is the nuclear option that does hit every route.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'In Next 15, what happens to `const res = await fetch(url)` inside a Server Component with no options?',
      options: [
        'It is cached indefinitely until you call revalidateTag',
        'It is cached for 60 seconds by default',
        'It throws unless you specify a cache option explicitly',
        'It is not cached — the default became `no-store`, so it hits the origin every request',
      ],
      correctIndex: 3,
      explanation:
        'Next 14 cached bare fetches forever and you opted out. Next 15 inverted that: the default is `no-store` and you opt in with `cache: "force-cache"` or `next: { revalidate }`. This single change makes a lot of older tutorials wrong.',
      difficulty: 'HARD',
    },
    {
      prompt: 'What is a React Hook Form resolver?',
      options: [
        'A function receiving the current values and returning `{ values, errors }`, where one of the two is empty',
        'A React context provider that supplies default values to nested fields',
        'A Next.js middleware that validates form posts before they reach the action',
        'A hook that resolves the form submission promise',
      ],
      correctIndex: 0,
      explanation:
        'A resolver is a plain adapter function: it validates and returns `{ values, errors }` — populated values with empty errors on success, empty values with a field-keyed error map on failure. `zodResolver` just wraps `safeParse` in that contract, which is why writing your own is trivial.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Which situation still justifies TanStack Query inside an App Router app?',
      options: [
        'Loading the data a page needs for its first paint',
        'A dashboard that polls every five seconds and uses cursor-based infinite scroll',
        'Submitting a create form and refreshing the list afterwards',
        'Sharing a single fetched user object between a layout and a page',
      ],
      correctIndex: 1,
      explanation:
        'Client-driven, high-frequency interactions — polling, infinite scroll, search-as-you-type, offline retry — are what TanStack Query is uniquely good at. First-paint data belongs in a Server Component, form mutations belong in a Server Action with `revalidateTag`, and sharing one fetch across a render is handled by request memoization.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why must `redirect()` be called outside a `try`/`catch` block in a Server Action?',
      options: [
        'It is async and cannot be awaited inside a try block',
        'It mutates the response headers, which is illegal inside a try block',
        'It signals the redirect by throwing, so a catch block would swallow it',
        'It only works before any database write has occurred',
      ],
      correctIndex: 2,
      explanation:
        '`redirect()` throws a special `NEXT_REDIRECT` error that the framework catches higher up. A surrounding `catch` intercepts it first and the navigation silently never happens. Do the work in the try block, then redirect after it.',
      difficulty: 'HARD',
    },
  ],
  problems: [
    {
      slug: 'request-memoization',
      title: 'Request Memoization for One Render Pass',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Next.js deduplicates identical data requests **within a single render pass**, so calling \`getUser(id)\` in a layout, in \`generateMetadata\` and in the page produces one request, not three. At the end of the render the memo cache is thrown away.

Implement \`createRequestCache(loader)\`.

It returns an object with:

- \`get(url, options)\` — returns a Promise. If \`(url, options)\` has already been requested since the last reset, return the **exact same promise** without invoking \`loader\` again. Otherwise invoke \`loader(url, options)\`, store the promise, and return it.
- \`reset()\` — clears the cache. This models the end of a render pass.
- \`calls()\` — how many times \`loader\` has been invoked in total (it is **not** reset by \`reset()\`).

Rules:

- Two option objects with the same contents dedupe even if their keys are in a different order. Compare structurally, not by reference.
- A rejected request is memoized too — a failing loader must not be retried within the same pass.
- \`get(url)\` with no options is a distinct key from \`get(url, { cache: 'no-store' })\`.

\`\`\`js
const c = createRequestCache(async (url) => url.toUpperCase());
const [a, b] = await Promise.all([c.get('/x'), c.get('/x')]);
// a === '/X', b === '/X', c.calls() === 1
c.reset();
await c.get('/x');  // c.calls() === 2
\`\`\``,
      starterCode: `function createRequestCache(loader) {
  // Build a stable string key from (url, options), then memoize the promise.
  return {
    get(url, options) {},
    reset() {},
    calls() {
      return 0;
    },
  };
}

module.exports = { createRequestCache };`,
      solutionCode: `function stableStringify(value) {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  const body = keys
    .map(function (k) {
      return JSON.stringify(k) + ':' + stableStringify(value[k]);
    })
    .join(',');
  return '{' + body + '}';
}

function createRequestCache(loader) {
  let entries = new Map();
  let calls = 0;

  function get(url, options) {
    const key = String(url) + '::' + stableStringify(options);

    if (entries.has(key)) return entries.get(key);

    calls++;
    let promise;
    try {
      promise = Promise.resolve(loader(url, options));
    } catch (err) {
      promise = Promise.reject(err);
    }

    entries.set(key, promise);
    return promise;
  }

  function reset() {
    entries = new Map();
  }

  return {
    get: get,
    reset: reset,
    calls: function () {
      return calls;
    },
  };
}

module.exports = { createRequestCache };`,
      hints: [
        'JSON.stringify is not enough: {a:1,b:2} and {b:2,a:1} produce different strings. Sort the keys before serialising.',
        'Store the promise itself in the Map, not the resolved value — that is what makes two concurrent callers share one request.',
        'Increment the call counter before invoking the loader, and do not reset it inside reset().',
        'Wrap the loader call in try/catch so a synchronous throw still produces a memoized rejected promise.',
      ],
      tests: [
        {
          name: 'identical requests share one loader call',
          assertion:
            "await (async function () { const c = solution.createRequestCache(async function (u) { return u.toUpperCase(); }); const r = await Promise.all([c.get('/x'), c.get('/x')]); return r[0] === '/X' && r[1] === '/X' && c.calls() === 1; })()",
        },
        {
          name: 'the same promise object is returned',
          assertion:
            "(function () { const c = solution.createRequestCache(async function (u) { return u; }); return c.get('/x') === c.get('/x'); })()",
        },
        {
          name: 'different urls are separate entries',
          assertion:
            "await (async function () { const c = solution.createRequestCache(async function (u) { return u; }); await Promise.all([c.get('/a'), c.get('/b')]); return c.calls() === 2; })()",
        },
        {
          name: 'option key order does not matter',
          assertion:
            "await (async function () { const c = solution.createRequestCache(async function (u) { return u; }); await Promise.all([c.get('/a', { cache: 'no-store', tags: ['x'] }), c.get('/a', { tags: ['x'], cache: 'no-store' })]); return c.calls() === 1; })()",
        },
        {
          name: 'different options are separate entries',
          assertion:
            "await (async function () { const c = solution.createRequestCache(async function (u) { return u; }); await Promise.all([c.get('/a'), c.get('/a', { cache: 'no-store' })]); return c.calls() === 2; })()",
        },
        {
          name: 'reset starts a new pass',
          assertion:
            "await (async function () { const c = solution.createRequestCache(async function (u) { return u; }); await c.get('/a'); c.reset(); await c.get('/a'); return c.calls() === 2; })()",
        },
        {
          name: 'calls() is cumulative across resets',
          assertion:
            "await (async function () { const c = solution.createRequestCache(async function (u) { return u; }); await c.get('/a'); await c.get('/a'); c.reset(); await c.get('/a'); return c.calls() === 2; })()",
          hidden: true,
        },
        {
          name: 'a rejected request is memoized, not retried',
          assertion:
            "await (async function () { const c = solution.createRequestCache(async function () { throw new Error('boom'); }); let failures = 0; await c.get('/a').catch(function () { failures++; }); await c.get('/a').catch(function () { failures++; }); return failures === 2 && c.calls() === 1; })()",
          hidden: true,
        },
        {
          name: 'nested option objects are compared structurally',
          assertion:
            "await (async function () { const c = solution.createRequestCache(async function (u) { return u; }); await Promise.all([c.get('/a', { next: { revalidate: 60, tags: ['p'] } }), c.get('/a', { next: { tags: ['p'], revalidate: 60 } })]); return c.calls() === 1; })()",
          hidden: true,
        },
      ],
      xp: 60,
    },
    {
      slug: 'shared-schema-resolver',
      title: 'A Shared Schema and a React Hook Form Resolver',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `A React Hook Form *resolver* is just a function: give it the current values, get back \`{ values, errors }\`. On success \`values\` holds the parsed data and \`errors\` is \`{}\`; on failure \`values\` is \`{}\` and \`errors\` is keyed by field name.

Build a miniature Zod-like validator plus that adapter, so one schema can run on the client and on the server.

### \`string()\`

Returns a chainable string schema:

- \`.min(n, message?)\` — default message \`'Must be at least N characters'\`
- \`.max(n, message?)\` — default message \`'Must be at most N characters'\`
- \`.email(message?)\` — default message \`'Invalid email'\`
- \`.optional()\` — a missing value is allowed

A value counts as **missing** when it is \`undefined\`, \`null\` or \`''\`. A missing non-optional field produces the message \`'Required'\`. A present non-string value produces \`'Expected string'\`. Otherwise run the chained checks **in the order they were added** and stop at the first failure.

Treat a string as an email when it has exactly one \`@\`, a non-empty part before it, a part after it containing a \`.\` that is not the first character, does not end with \`.\`, and contains no spaces.

### \`object(shape)\`

- \`.safeParse(input)\` returns \`{ success: true, data }\` or \`{ success: false, issues }\`, where \`issues\` is an array of \`{ path, message }\` in shape-key order. \`data\` contains only keys declared in the shape (unknown keys are stripped) and omits absent optional fields.
- \`.refine(check, { message, path })\` adds a cross-field rule. Refinements run **only when every field check passed**.

### \`createResolver(schema)\`

Returns \`(values) => ({ values, errors })\`. Each error is \`{ type: 'validation', message }\`, and the **first** issue for a field wins.

\`\`\`js
const SignUp = object({ email: string().email(), password: string().min(8) })
  .refine((v) => v.password !== v.email, { message: 'Too obvious', path: 'password' });

createResolver(SignUp)({ email: 'nope', password: 'hunter2000' });
// { values: {}, errors: { email: { type: 'validation', message: 'Invalid email' } } }
\`\`\``,
      starterCode: `function string() {
  // chainable: .min(n, msg) .max(n, msg) .email(msg) .optional()
}

function object(shape) {
  // .safeParse(input) -> { success, data } | { success, issues }
  // .refine(check, { message, path })
}

function createResolver(schema) {
  // (values) => ({ values, errors })
}

module.exports = { string, object, createResolver };`,
      solutionCode: `function looksLikeEmail(v) {
  if (v.indexOf(' ') !== -1) return false;
  const parts = v.split('@');
  if (parts.length !== 2) return false;
  const user = parts[0];
  const host = parts[1];
  if (user.length === 0 || host.length === 0) return false;
  if (host.indexOf('.') < 1) return false;
  if (host[host.length - 1] === '.') return false;
  return true;
}

function string() {
  const checks = [];
  const api = {
    _kind: 'string',
    _optional: false,
    _checks: checks,
    min: function (n, message) {
      checks.push({ kind: 'min', n: n, message: message || 'Must be at least ' + n + ' characters' });
      return api;
    },
    max: function (n, message) {
      checks.push({ kind: 'max', n: n, message: message || 'Must be at most ' + n + ' characters' });
      return api;
    },
    email: function (message) {
      checks.push({ kind: 'email', message: message || 'Invalid email' });
      return api;
    },
    optional: function () {
      api._optional = true;
      return api;
    },
  };
  return api;
}

function checkField(field, value) {
  if (value === undefined || value === null || value === '') {
    if (field._optional) return { present: false };
    return { issue: 'Required' };
  }
  if (typeof value !== 'string') return { issue: 'Expected string' };

  for (let i = 0; i < field._checks.length; i++) {
    const c = field._checks[i];
    if (c.kind === 'min' && value.length < c.n) return { issue: c.message };
    if (c.kind === 'max' && value.length > c.n) return { issue: c.message };
    if (c.kind === 'email' && !looksLikeEmail(value)) return { issue: c.message };
  }

  return { present: true, value: value };
}

function object(shape) {
  const refinements = [];

  const api = {
    _shape: shape,
    refine: function (check, opts) {
      refinements.push({
        check: check,
        message: (opts && opts.message) || 'Invalid input',
        path: (opts && opts.path) || '',
      });
      return api;
    },
    safeParse: function (input) {
      const source = input || {};
      const issues = [];
      const data = {};

      Object.keys(shape).forEach(function (key) {
        const result = checkField(shape[key], source[key]);
        if (result.issue) {
          issues.push({ path: key, message: result.issue });
          return;
        }
        if (result.present) data[key] = result.value;
      });

      if (issues.length === 0) {
        refinements.forEach(function (r) {
          if (!r.check(data)) issues.push({ path: r.path, message: r.message });
        });
      }

      if (issues.length > 0) return { success: false, issues: issues };
      return { success: true, data: data };
    },
  };

  return api;
}

function createResolver(schema) {
  return function resolver(values) {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };

    const errors = {};
    result.issues.forEach(function (issue) {
      if (!errors[issue.path]) {
        errors[issue.path] = { type: 'validation', message: issue.message };
      }
    });
    return { values: {}, errors: errors };
  };
}

module.exports = { string: string, object: object, createResolver: createResolver };`,
      hints: [
        'Each chain method should push a descriptor onto a shared array and return the same object, so calls can chain in any order.',
        'Handle missing-and-optional before the type check, and the type check before the chained checks.',
        'safeParse should iterate Object.keys(shape) so issues come out in declaration order — that also strips unknown keys for free.',
        'Run refinements only when issues.length === 0, otherwise a cross-field check will read undefined values.',
        'In createResolver, guard with `if (!errors[path])` so the first issue for a field wins.',
      ],
      tests: [
        {
          name: 'valid input returns values and no errors',
          assertion:
            "(function () { const s = solution.object({ email: solution.string().email(), password: solution.string().min(8) }); return deepEqual(solution.createResolver(s)({ email: 'ada@example.com', password: 'hunter2000' }), { values: { email: 'ada@example.com', password: 'hunter2000' }, errors: {} }); })()",
        },
        {
          name: 'a missing required field reports Required',
          assertion:
            "(function () { const s = solution.object({ email: solution.string() }); return deepEqual(solution.createResolver(s)({}), { values: {}, errors: { email: { type: 'validation', message: 'Required' } } }); })()",
        },
        {
          name: 'an empty string counts as missing',
          assertion:
            "(function () { const s = solution.object({ email: solution.string() }); return solution.createResolver(s)({ email: '' }).errors.email.message === 'Required'; })()",
        },
        {
          name: 'min uses the custom message',
          assertion:
            "(function () { const s = solution.object({ password: solution.string().min(8, 'Too short') }); return solution.createResolver(s)({ password: 'abc' }).errors.password.message === 'Too short'; })()",
        },
        {
          name: 'min has a sensible default message',
          assertion:
            "(function () { const s = solution.object({ password: solution.string().min(8) }); return solution.createResolver(s)({ password: 'abc' }).errors.password.message === 'Must be at least 8 characters'; })()",
        },
        {
          name: 'email rejects a malformed address',
          assertion:
            "(function () { const s = solution.object({ email: solution.string().email() }); return solution.createResolver(s)({ email: 'nope' }).errors.email.message === 'Invalid email'; })()",
        },
        {
          name: 'unknown keys are stripped from values',
          assertion:
            "(function () { const s = solution.object({ email: solution.string() }); return deepEqual(solution.createResolver(s)({ email: 'a@b.co', role: 'admin' }).values, { email: 'a@b.co' }); })()",
        },
        {
          name: 'an absent optional field is allowed and omitted',
          assertion:
            "(function () { const s = solution.object({ name: solution.string(), nickname: solution.string().optional() }); return deepEqual(solution.createResolver(s)({ name: 'Ada' }), { values: { name: 'Ada' }, errors: {} }); })()",
        },
        {
          name: 'safeParse reports issues in declaration order',
          assertion:
            "(function () { const s = solution.object({ a: solution.string(), b: solution.string() }); return deepEqual(s.safeParse({}).issues, [{ path: 'a', message: 'Required' }, { path: 'b', message: 'Required' }]); })()",
        },
        {
          name: 'a refine failure is reported on its path',
          assertion:
            "(function () { const s = solution.object({ password: solution.string().min(8), confirm: solution.string().min(8) }).refine(function (v) { return v.password === v.confirm; }, { message: 'Passwords must match', path: 'confirm' }); const r = solution.createResolver(s)({ password: 'abcdefgh', confirm: 'abcdefgz' }); return r.errors.confirm.message === 'Passwords must match' && deepEqual(r.values, {}); })()",
        },
        {
          name: 'refinements are skipped when a field check already failed',
          assertion:
            "(function () { const s = solution.object({ password: solution.string().min(8), confirm: solution.string().min(8) }).refine(function (v) { return v.password === v.confirm; }, { message: 'Passwords must match', path: 'confirm' }); const r = solution.createResolver(s)({ password: 'abc', confirm: 'abc' }); return r.errors.confirm.message === 'Must be at least 8 characters'; })()",
          hidden: true,
        },
        {
          name: 'checks run in chain order and stop at the first failure',
          assertion:
            "(function () { const s = solution.object({ email: solution.string().min(5, 'too short').email('bad email') }); return solution.createResolver(s)({ email: 'a@b' }).errors.email.message === 'too short'; })()",
          hidden: true,
        },
        {
          name: 'a non-string value is rejected',
          assertion:
            "(function () { const s = solution.object({ name: solution.string() }); return solution.createResolver(s)({ name: 42 }).errors.name.message === 'Expected string'; })()",
          hidden: true,
        },
        {
          name: 'safeParse returns the success shape',
          assertion:
            "(function () { const s = solution.object({ a: solution.string() }); return deepEqual(s.safeParse({ a: 'x' }), { success: true, data: { a: 'x' } }); })()",
          hidden: true,
        },
      ],
      xp: 95,
    },
    {
      slug: 'tagged-data-cache',
      title: 'A Data Cache with Tag and Path Invalidation',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Next.js invalidates cached data by **tag** (\`revalidateTag('posts')\`) or by **path** (\`revalidatePath('/blog', 'layout')\`). Build that cache.

Implement \`createDataCache()\`, returning:

| method | behaviour |
| --- | --- |
| \`set(key, value, options)\` | store \`value\`. \`options\` may be \`{ tags: string[], paths: string[] }\`, both optional. Re-setting an existing key **replaces** its value, tags and paths — the old tags must no longer match it. |
| \`get(key)\` | the value, or \`undefined\` if absent |
| \`has(key)\` | boolean |
| \`revalidateTag(tag)\` | evict every entry carrying \`tag\`; return the number evicted |
| \`revalidatePath(path, type)\` | evict by path; \`type\` defaults to \`'page'\`; return the number evicted |
| \`keys()\` | remaining keys in insertion order |
| \`size()\` | number of entries |

**Path semantics** — this is the part that matters:

- \`type === 'page'\` (the default) evicts entries whose \`paths\` contain **exactly** \`path\`.
- \`type === 'layout'\` also evicts entries whose path is **nested beneath** \`path\` — that is, it equals \`path\` or starts with \`path + '/'\`. So \`revalidatePath('/blog', 'layout')\` hits \`/blog\` and \`/blog/hello\` but never \`/blogger\`.
- \`revalidatePath('/', 'layout')\` therefore evicts everything.

**Tag fan-out:** one tag can match many entries, and one entry can carry many tags. Evicting via any one of an entry's tags removes it, and its other tags must stop matching it afterwards.

\`\`\`js
const cache = createDataCache();
cache.set('posts:list', [1, 2], { tags: ['posts'], paths: ['/blog'] });
cache.set('posts:1', { id: 1 }, { tags: ['posts', 'post:1'], paths: ['/blog/1'] });

cache.revalidateTag('posts'); // 2
cache.size();                 // 0
\`\`\``,
      starterCode: `function createDataCache() {
  // Keep a Map of key -> { value, tags, paths }, plus a tag index for fast fan-out.
  // Remember to un-index an entry's old tags when it is replaced or evicted.
  return {
    set(key, value, options) {},
    get(key) {},
    has(key) {
      return false;
    },
    revalidateTag(tag) {
      return 0;
    },
    revalidatePath(path, type) {
      return 0;
    },
    keys() {
      return [];
    },
    size() {
      return 0;
    },
  };
}

module.exports = { createDataCache };`,
      solutionCode: `function createDataCache() {
  const entries = new Map(); // key -> { value, tags: Set, paths: Set }
  const tagIndex = new Map(); // tag -> Set of keys

  function unindex(key) {
    const entry = entries.get(key);
    if (!entry) return;
    entry.tags.forEach(function (tag) {
      const keys = tagIndex.get(tag);
      if (!keys) return;
      keys.delete(key);
      if (keys.size === 0) tagIndex.delete(tag);
    });
  }

  function evict(key) {
    unindex(key);
    entries.delete(key);
  }

  function set(key, value, options) {
    const opts = options || {};
    unindex(key);

    const tags = new Set(opts.tags || []);
    const paths = new Set(opts.paths || []);
    entries.set(key, { value: value, tags: tags, paths: paths });

    tags.forEach(function (tag) {
      if (!tagIndex.has(tag)) tagIndex.set(tag, new Set());
      tagIndex.get(tag).add(key);
    });

    return key;
  }

  function get(key) {
    const entry = entries.get(key);
    return entry ? entry.value : undefined;
  }

  function has(key) {
    return entries.has(key);
  }

  function revalidateTag(tag) {
    const keys = tagIndex.get(tag);
    if (!keys) return 0;
    const doomed = Array.from(keys);
    doomed.forEach(evict);
    return doomed.length;
  }

  function matchesPath(entryPaths, path, layout) {
    const prefix = path === '/' ? '/' : path + '/';
    let hit = false;
    entryPaths.forEach(function (p) {
      if (hit) return;
      if (p === path) hit = true;
      else if (layout && p.slice(0, prefix.length) === prefix) hit = true;
    });
    return hit;
  }

  function revalidatePath(path, type) {
    const layout = type === 'layout';
    const doomed = [];

    entries.forEach(function (entry, key) {
      if (matchesPath(entry.paths, path, layout)) doomed.push(key);
    });

    doomed.forEach(evict);
    return doomed.length;
  }

  return {
    set: set,
    get: get,
    has: has,
    revalidateTag: revalidateTag,
    revalidatePath: revalidatePath,
    keys: function () {
      return Array.from(entries.keys());
    },
    size: function () {
      return entries.size;
    },
  };
}

module.exports = { createDataCache };`,
      hints: [
        'Two structures: a Map of key -> entry for insertion order, and a Map of tag -> Set<key> so revalidateTag does not scan every entry.',
        'Factor out an unindex(key) helper and call it from both set() and evict() — that is what makes re-setting a key drop its old tags.',
        'Snapshot the tag index Set into an array before evicting, or you will mutate the Set while iterating it.',
        "For layout invalidation compare against path + '/', not just path, so '/blog' does not match '/blogger'. Special-case '/' so the prefix does not become '//'.",
        'Both revalidate functions return a count of entries removed, not a count of matching tags or paths.',
      ],
      tests: [
        {
          name: 'get returns the stored value and undefined for a miss',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1); return c.get('a') === 1 && c.get('b') === undefined && c.has('a') === true; })()",
        },
        {
          name: 'set replaces the value for an existing key',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1); c.set('a', 2); return c.get('a') === 2 && c.size() === 1; })()",
        },
        {
          name: 'revalidateTag fans out to every entry with the tag',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1, { tags: ['posts'] }); c.set('b', 2, { tags: ['posts'] }); c.set('c', 3, { tags: ['users'] }); return c.revalidateTag('posts') === 2 && c.size() === 1 && c.get('c') === 3; })()",
        },
        {
          name: 'an entry with several tags is evicted by any one of them',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1, { tags: ['posts', 'post:1'] }); return c.revalidateTag('post:1') === 1 && c.size() === 0; })()",
        },
        {
          name: 'an unknown tag evicts nothing',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1, { tags: ['posts'] }); return c.revalidateTag('nope') === 0 && c.size() === 1; })()",
        },
        {
          name: 'the tag index is cleaned up after eviction',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1, { tags: ['posts', 'post:1'] }); c.revalidateTag('posts'); return c.revalidateTag('post:1') === 0; })()",
        },
        {
          name: 're-setting a key drops its old tags',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1, { tags: ['old'] }); c.set('a', 2, { tags: ['new'] }); return c.revalidateTag('old') === 0 && c.get('a') === 2 && c.revalidateTag('new') === 1; })()",
        },
        {
          name: 'revalidatePath defaults to page and matches exactly',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1, { paths: ['/blog'] }); c.set('b', 2, { paths: ['/blog/hello'] }); return c.revalidatePath('/blog') === 1 && c.has('b') === true; })()",
        },
        {
          name: 'layout invalidation includes nested paths',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1, { paths: ['/blog'] }); c.set('b', 2, { paths: ['/blog/hello'] }); c.set('c', 3, { paths: ['/blogger'] }); return c.revalidatePath('/blog', 'layout') === 2 && deepEqual(c.keys(), ['c']); })()",
        },
        {
          name: 'revalidatePath on the root layout clears everything',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1, { paths: ['/'] }); c.set('b', 2, { paths: ['/blog/hello'] }); return c.revalidatePath('/', 'layout') === 2 && c.size() === 0; })()",
        },
        {
          name: 'keys() preserves insertion order',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1); c.set('b', 2); c.set('c', 3); c.set('b', 9); return deepEqual(c.keys(), ['a', 'b', 'c']); })()",
          hidden: true,
        },
        {
          name: 'an entry with several paths is evicted by any one of them',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1, { paths: ['/blog', '/feed'] }); return c.revalidatePath('/feed') === 1 && c.size() === 0; })()",
          hidden: true,
        },
        {
          name: 'entries with no tags or paths survive invalidation',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1); return c.revalidateTag('posts') === 0 && c.revalidatePath('/blog', 'layout') === 0 && c.size() === 1; })()",
          hidden: true,
        },
        {
          name: 'evicting by tag also removes the entry from path lookups',
          assertion:
            "(function () { const c = solution.createDataCache(); c.set('a', 1, { tags: ['posts'], paths: ['/blog'] }); c.revalidateTag('posts'); return c.revalidatePath('/blog') === 0 && c.get('a') === undefined; })()",
          hidden: true,
        },
      ],
      xp: 140,
    },
  ],
  flashcards: [
    {
      front: 'What is Request Memoization, and how long does it last?',
      back: 'Automatic deduplication of identical `fetch` calls (or `cache()`-wrapped functions) within one server render pass. It is discarded when the render ends and is never shared between requests or users.',
      tags: ['nextjs', 'caching'],
    },
    {
      front: 'How do you memoize a database query the way `fetch` is memoized?',
      back: 'Wrap it in React `cache()`: `export const getUser = cache(async (id) => db.user.findUnique(...))`. It keys on the arguments, so pass primitives — object args are compared by reference and always miss.',
      tags: ['nextjs', 'react', 'caching'],
    },
    {
      front: 'How do you turn a sequential await into a parallel fetch?',
      back: '`const [a, b] = await Promise.all([getA(), getB()])` when neither depends on the other, or the preload pattern (`void getUser(id)` early, await later) when they do.',
      tags: ['nextjs', 'performance'],
    },
    {
      front: "What does `'use server'` mark?",
      back: 'Server Actions. At the top of a file every export becomes one; inside an async function body, just that function. Each one compiles to a real POST endpoint with a generated action ID.',
      tags: ['nextjs', 'server-actions'],
    },
    {
      front: 'What does `useActionState` return?',
      back: '`[state, formAction, isPending]`. Your action receives the previous state as its first argument and its return value becomes the next state — which is how server validation errors reach the UI.',
      tags: ['react19', 'server-actions'],
    },
    {
      front: 'Why must `useFormStatus` be called in a child of the form?',
      back: 'It reads context provided by an ancestor `<form>`. Called in the component that renders the form, it finds no ancestor and reports `pending: false` forever. Extract a `<SubmitButton />`.',
      tags: ['react19', 'forms'],
    },
    {
      front: 'How does `useOptimistic` roll back?',
      back: 'The optimistic value is derived, not stored: React re-runs your reducer over the base state for each pending update. When an action settles or throws, its entry is dropped, so the value reconciles or reverts automatically.',
      tags: ['react19', 'optimistic'],
    },
    {
      front: 'The security rule for Server Actions',
      back: 'An action is a public HTTP endpoint — the action ID ships in the HTML. Every action must authenticate, authorise the specific record, and validate its input server-side. Never trust a userId from FormData.',
      tags: ['nextjs', 'security'],
    },
    {
      front: '`revalidatePath(path, "page")` vs `("layout")` vs `revalidateTag`',
      back: '`page` invalidates that exact route; `layout` invalidates it and everything nested beneath it; `revalidateTag` invalidates every cache entry carrying the tag, wherever it was fetched.',
      tags: ['nextjs', 'caching'],
    },
    {
      front: 'Name the four Next.js caching layers.',
      back: 'Request Memoization (per render, server), Data Cache (persistent, server), Full Route Cache (rendered HTML/RSC, server), Router Cache (visited routes, in the browser).',
      tags: ['nextjs', 'caching'],
    },
    {
      front: 'What changed about `fetch` caching in Next 15?',
      back: 'The default flipped from cached-forever to `no-store`. You now opt in with `cache: "force-cache"` or `next: { revalidate }`. GET Route Handlers are likewise uncached by default.',
      tags: ['nextjs', 'next15'],
    },
    {
      front: 'When is TanStack Query still worth adding to an App Router app?',
      back: 'Client-driven, high-frequency data: infinite scroll, polling dashboards, search-as-you-type, offline retry. Not for first-paint data (Server Components) or simple form mutations (Server Actions + revalidateTag).',
      tags: ['tanstack-query', 'nextjs'],
    },
  ],
  resources: [
    {
      label: 'Next.js — Server Actions and Mutations',
      url: 'https://nextjs.org/docs/app/getting-started/updating-data',
      kind: 'DOCS',
    },
    {
      label: 'Next.js — Caching in Next.js',
      url: 'https://nextjs.org/docs/app/deep-dive/caching',
      kind: 'DOCS',
    },
    {
      label: 'Next.js — Route Handlers',
      url: 'https://nextjs.org/docs/app/api-reference/file-conventions/route',
      kind: 'DOCS',
    },
    { label: 'React — useOptimistic', url: 'https://react.dev/reference/react/useOptimistic', kind: 'DOCS' },
    {
      label: 'TanStack Query — Advanced Server Rendering',
      url: 'https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr',
      kind: 'DOCS',
    },
  ],
};

export default day;
