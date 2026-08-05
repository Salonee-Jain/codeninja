import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 15,
  week: 3,
  pillar: 'FRONTEND',
  title: 'Next.js III — Auth, Middleware, Performance & Deployment',
  summary: 'Sessions, authorisation you can defend, caching you can reason about, and a deploy that survives Monday.',
  estimatedMinutes: 340,
  objectives: [
    'Write middleware that runs on the edge and know exactly what it can and cannot do',
    'Explain why an auth check in middleware is a redirect optimisation, not an authorisation boundary',
    'Set up Auth.js v5 with an OAuth provider and edit the callbacks that matter',
    'Protect Server Components, Route Handlers and Server Actions — each with its own check',
    'Enforce role-based access in a layout without leaking data to unauthorised users',
    'Choose a caching and revalidation strategy, including ISR and on-demand invalidation',
    'Instrument the app and pick between Vercel, `next start` and a standalone Docker image',
  ],
  technologies: ['Next.js', 'JWT', 'OAuth', 'TypeScript'],
  lessons: [
    {
      slug: 'middleware-and-the-edge-runtime',
      title: 'Middleware and the Edge Runtime',
      estimatedMinutes: 75,
      body: `# Middleware and the Edge Runtime

Middleware is the one piece of your Next.js app that runs **before** routing, on every matched request, usually at a datacentre near the user. That position makes it powerful and dangerous in equal measure.

## The shape of it

One file, at the project root (or inside \`src/\`), default-exporting a function:

\`\`\`ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Redirect
  if (pathname === '/old-pricing') {
    return NextResponse.redirect(new URL('/pricing', request.url));
  }

  // 2. Rewrite — the URL stays, the served route changes
  const country = request.headers.get('x-vercel-ip-country') ?? 'AU';
  if (pathname === '/') {
    return NextResponse.rewrite(new URL('/home/' + country.toLowerCase(), request.url));
  }

  // 3. Continue, but mutate headers/cookies on the way through
  const response = NextResponse.next();
  response.headers.set('x-request-id', crypto.randomUUID());
  response.cookies.set('locale', 'en-AU', { httpOnly: false, sameSite: 'lax', path: '/' });
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
\`\`\`

Four return values are meaningful: \`NextResponse.next()\` (carry on), \`.redirect()\`, \`.rewrite()\`, and \`.json()\` / \`new Response()\` to answer the request outright. Returning nothing behaves like \`next()\`.

## The matcher

Middleware that runs on every request — including every static asset and every RSC payload — is a tax on the whole app. \`config.matcher\` narrows it, and Next compiles the patterns at **build time**, so they must be statically analysable string literals. You cannot build one from a variable.

Three forms:

\`\`\`ts
export const config = {
  matcher: [
    '/dashboard/:path*',            // named param, zero or more segments
    '/invoices/:id',                // exactly one segment
    '/((?!api|_next|.*\\\\..*).*)',    // negative lookahead: everything EXCEPT these
  ],
};
\`\`\`

The parameter syntax is path-to-regexp: \`:name\` matches one segment, \`:name*\` zero or more, \`:name+\` one or more, and \`:name?\` zero or one. The negative-lookahead form is what almost every real project ends up with, because the useful rule is "run on everything except assets and API routes".

Matchers can also be objects with conditions, which is how you avoid running middleware on prefetches and RSC navigations:

\`\`\`ts
export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
\`\`\`

\`has\` and \`missing\` accept \`header\`, \`cookie\`, \`query\` and \`host\`. Today's first problem is a small implementation of this matching logic, because the difference between "runs on 12 paths" and "runs on 12,000" is one careless pattern.

## What the edge runtime is not

By default middleware runs in the **edge runtime**: a V8 isolate with Web APIs only, not Node. That means:

| Available | Not available |
| --- | --- |
| \`fetch\`, \`Request\`, \`Response\`, \`URL\`, \`URLSearchParams\` | \`fs\`, \`net\`, \`child_process\`, \`dns\` |
| \`crypto.subtle\`, \`crypto.randomUUID\`, \`TextEncoder\` | native addons, anything with a \`.node\` binary |
| \`atob\`/\`btoa\`, \`structuredClone\` | most ORMs (Prisma's default client, TypeORM, Mongoose) |
| Cookies and headers via \`NextRequest\` | long-running work, background timers |

There is a hard code-size limit (about 1 MB on Vercel's Hobby tier, 4 MB on Pro) and an execution budget measured in milliseconds. Import a database client into middleware and you will either fail the build or blow the bundle limit.

Next 15.2 added an **experimental Node.js runtime for middleware** (\`experimental.nodeMiddleware\` plus \`export const runtime = 'nodejs'\`). It removes the API restrictions at the cost of the edge's latency profile. Treat it as a way to unblock one specific need, not as the default.

> Middleware also cannot read the request **body** in a way that reliably survives to the route, and it cannot access route params or the segment tree — routing has not happened yet. If you need either, you need a Route Handler or a layout, not middleware.

## Auth in middleware: an optimisation, not a boundary

Here is the pattern everyone writes:

\`\`\`ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
\`\`\`

This is good code. It is **not** your access control. Three reasons:

1. **It only checks presence, not validity.** Verifying a JWT signature is possible on the edge with \`jose\`, but reading a session from the database is not — the edge runtime cannot talk to your ORM. So the realistic middleware check is "is there a cookie that looks like a session", which any client can fake.
2. **Middleware is bypassable in ways your data layer is not.** In March 2025, CVE-2025-29927 let an attacker skip middleware entirely by sending a crafted \`x-middleware-subrequest\` header. Apps that treated middleware as their only auth gate were wide open; apps that also checked in the data layer were not. Patch releases fixed that specific bug — the architectural lesson stands regardless of the next one.
3. **Not every request goes through it.** Server Actions invoked from an already-loaded page, direct Route Handler calls, and anything you accidentally excluded in the matcher.

The right mental model: **middleware makes the unauthenticated case fast and pretty.** It saves a render and gives the user a clean redirect instead of a flash of an empty dashboard. The actual decision — may this user read this row — belongs next to the data. That is the next lesson.

## Practical middleware jobs

Middleware earns its keep on things that genuinely must happen before routing:

\`\`\`ts
// Locale detection and rewrite
const locale = request.cookies.get('NEXT_LOCALE')?.value ?? detectLocale(request);
if (!pathname.startsWith('/' + locale)) {
  return NextResponse.rewrite(new URL('/' + locale + pathname, request.url));
}

// A/B bucketing with a sticky cookie
let bucket = request.cookies.get('bucket')?.value;
if (!bucket) {
  bucket = Math.random() < 0.5 ? 'a' : 'b';
  const res = NextResponse.rewrite(new URL('/landing-' + bucket, request.url));
  res.cookies.set('bucket', bucket, { maxAge: 60 * 60 * 24 * 30, path: '/' });
  return res;
}

// Security headers with a per-request nonce
const nonce = btoa(crypto.randomUUID());
const res = NextResponse.next({ request: { headers: newHeaders } });
res.headers.set('Content-Security-Policy', "script-src 'nonce-" + nonce + "' 'strict-dynamic'");
\`\`\`

Note \`NextResponse.next({ request: { headers } })\` — that is how you pass a value *forward* to the route (a request id, a nonce, a resolved locale), readable there with \`await headers()\`.

Keep it fast, keep it small, and keep the security decision somewhere it cannot be skipped.`,
    },
    {
      slug: 'sessions-jwt-and-authjs',
      title: 'Sessions: Cookies, JWTs and Auth.js v5',
      estimatedMinutes: 80,
      body: `# Sessions: Cookies, JWTs and Auth.js v5

Before picking a library, pick a session strategy — because the strategy decides what you can revoke, what you can scale, and what a stolen token costs you.

## Two strategies

| | **Database session** | **Stateless JWT** |
| --- | --- | --- |
| Cookie holds | an opaque random id | a signed (often encrypted) token |
| Reading a session | one DB/Redis lookup per request | verify a signature, no I/O |
| Revoking | delete the row — instant | impossible before expiry without a denylist |
| Changing a role | next request sees it | not until the token is re-issued |
| Edge-friendly | no (needs the database) | yes |
| Size | tiny | grows with claims; 4 kB cookie limit is real |

Neither is "correct". The rule of thumb: **if you must be able to log someone out immediately, or roles change often, use database sessions.** If you need edge verification and can live with a short expiry, use JWTs. The common hybrid is a 15-minute JWT plus a revocable database-backed refresh token.

Whatever you choose, the cookie carrying it is non-negotiable:

\`\`\`ts
cookieStore.set('session', token, {
  httpOnly: true,   // JavaScript cannot read it — this is your XSS mitigation
  secure: true,     // HTTPS only (skip in local dev over http)
  sameSite: 'lax',  // sent on top-level navigations, blocked on cross-site POSTs
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
});
\`\`\`

\`httpOnly\` is the reason you never store a session token in \`localStorage\`: any injected script can read \`localStorage\`, none can read an \`httpOnly\` cookie. \`sameSite: 'lax'\` is most of your CSRF defence; \`'none'\` requires \`secure: true\`. Getting these attributes wrong is a silent security failure, which is why today's third problem is a \`Set-Cookie\` serialiser.

## Auth.js v5 (NextAuth) setup

Auth.js v5 collapsed the old \`[...nextauth]\` config into a single module that exports everything you need.

\`\`\`bash
npm i next-auth@beta
npx auth secret        # writes AUTH_SECRET to .env.local
\`\`\`

\`\`\`ts
// auth.config.ts — edge-safe: no adapter, no database driver
import type { NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';

export default {
  providers: [GitHub],
  pages: { signIn: '/login' },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = request.nextUrl.pathname.startsWith('/dashboard');
      if (isOnDashboard) return isLoggedIn;         // false triggers the redirect to pages.signIn
      return true;
    },
  },
} satisfies NextAuthConfig;
\`\`\`

\`\`\`ts
// auth.ts — the full config, runs in Node
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';
import authConfig from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
});
\`\`\`

\`\`\`ts
// app/api/auth/[...nextauth]/route.ts
export const { GET, POST } = handlers;
\`\`\`

\`\`\`ts
// middleware.ts
import NextAuth from 'next-auth';
import authConfig from './auth.config';

export const { auth: middleware } = NextAuth(authConfig);
export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
\`\`\`

The **split config** is the part that trips people up. Middleware runs on the edge, database adapters do not, so the edge-safe half lives in \`auth.config.ts\` and the adapter is added only in \`auth.ts\`. Import the wrong one into middleware and the build fails with an opaque bundling error.

## OAuth, briefly

The Authorization Code flow with PKCE, which is what every provider now uses:

1. User clicks "Continue with GitHub" — you \`signIn('github')\`.
2. Browser goes to the provider with your \`client_id\`, a \`redirect_uri\`, a \`state\` (CSRF protection) and a PKCE \`code_challenge\`.
3. User authenticates and consents at the provider. Your app never sees the password.
4. Provider redirects back to \`/api/auth/callback/github?code=...&state=...\`.
5. Your **server** exchanges the code plus the \`code_verifier\` for tokens, using the client secret.
6. You create your own session.

Auth.js does all six. What you must get right is configuration: the callback URL registered with the provider must match **exactly** (including the trailing path and the deployment domain), \`AUTH_SECRET\` must be set in every environment, and \`AUTH_URL\` must be correct behind a proxy. Preview deployments with dynamic URLs are the usual source of "redirect_uri mismatch".

## The callbacks you will actually edit

Four callbacks matter; the rest you will never touch.

\`\`\`ts
callbacks: {
  // 1. Gatekeeper at sign-in time. Return false or a URL string to reject.
  async signIn({ user, account, profile }) {
    if (account?.provider === 'github' && !profile?.email_verified) return false;
    return true;
  },

  // 2. Runs whenever a JWT is created or updated. This is where you put claims.
  async jwt({ token, user, trigger, session }) {
    if (user) {                                   // first call after sign-in
      token.id = user.id;
      token.role = await lookupRole(user.id);     // one DB hit, not one per request
    }
    if (trigger === 'update' && session?.role) token.role = session.role;
    return token;
  },

  // 3. Shapes what the client and Server Components see. Never leak the raw token.
  async session({ session, token }) {
    session.user.id = token.id as string;
    session.user.role = token.role as Role;
    return session;
  },

  // 4. Used by middleware to decide redirects (see auth.config.ts above).
  authorized({ auth, request }) { /* ... */ },
}
\`\`\`

The relationship is: **\`jwt\` writes claims into the token, \`session\` copies the safe subset onto the session object.** Anything you put in \`token\` but not in \`session\` stays server-side. Anything you put in \`session\` is visible to the browser — so no access tokens, no internal ids you would rather not expose.

Augment the types once and the rest of the codebase gets autocomplete:

\`\`\`ts
// types/next-auth.d.ts
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: { id: string; role: 'viewer' | 'member' | 'admin' | 'owner' } & DefaultSession['user'];
  }
}
\`\`\`

> **The stale-claim trap.** A role baked into a JWT does not change when you update the database. If you demote an admin, their token still says \`admin\` until it expires. Either keep the role out of the token and look it up in your data layer, or accept a bounded staleness window and keep sessions short (\`session: { maxAge: 15 * 60 }\`) with a refresh.

## Reading the session

In a Server Component, layout, Route Handler or Server Action:

\`\`\`ts
import { auth } from '@/auth';

const session = await auth();
if (!session?.user) redirect('/login');
\`\`\`

In a Client Component, wrap the tree in \`<SessionProvider>\` and use \`useSession()\` — but treat that value as **display data only**. It is a copy in the browser; it can be edited in DevTools. Anything that decides what data is returned must re-check on the server.`,
    },
    {
      slug: 'authorization-everywhere',
      title: 'Authorisation Everywhere: Components, Handlers, Actions and RBAC',
      estimatedMinutes: 80,
      body: `# Authorisation Everywhere: Components, Handlers, Actions and RBAC

There is no single door into a Next.js app. There are four, and each needs its own lock.

| Entry point | Reached by | Needs its own check? |
| --- | --- | --- |
| Server Component / page | a navigation or direct URL | **Yes** |
| Layout | rendering a child route | Yes, but not sufficient |
| Route Handler (\`route.ts\`) | any HTTP client, including curl | **Yes** |
| Server Action | a form post, or a crafted POST to the action id | **Yes** |

Middleware sits in front of some of these, some of the time — hence "optimisation, not boundary".

## Layouts do not re-render on every navigation

The most misunderstood thing about App Router authorisation:

\`\`\`tsx
// app/(app)/layout.tsx — NOT sufficient on its own
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');
  return <Shell>{children}</Shell>;
}
\`\`\`

A layout renders when the user first enters the segment. On a client-side navigation *within* it, React reuses the layout and only the page re-renders — and a client can request a child page's RSC payload directly. A layout check is a good UX gate and a bad security gate.

## The Data Access Layer

The fix that scales: put the check next to the data, in a module the UI cannot bypass.

\`\`\`ts
// lib/dal.ts
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export const getSession = cache(async () => {
  const session = await auth();
  return session?.user ? session : null;
});

export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session) redirect('/login');
  return session.user;
});

export async function requireRole(min: Role) {
  const user = await requireUser();
  if (rank(user.role) < rank(min)) redirect('/403');
  return user;
}
\`\`\`

\`react\`'s \`cache()\` memoises for one request, so calling \`requireUser()\` in a layout, a page and three components costs one verification, not five.

Then every query takes the caller into account:

\`\`\`ts
// features/invoices/queries.ts
import 'server-only';

export async function getInvoice(id: string) {
  const user = await requireUser();
  const invoice = await db.invoice.findFirst({
    where: { id, organisationId: user.organisationId },   // scoped, not just filtered
  });
  if (!invoice) notFound();
  return invoice;
}
\`\`\`

Two details worth stealing. The ownership condition is in the \`where\` clause, not an \`if\` after the fetch — you cannot forget to check something you never loaded. And someone else's invoice returns **404, not 403**: a 403 confirms the record exists, which leaks information on sequential ids.

## Route Handlers

A \`route.ts\` file is a public HTTP endpoint. Middleware may or may not have run; assume it did not.

\`\`\`ts
// app/api/invoices/[id]/route.ts
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;                     // Next 15: params is a Promise
  const invoice = await findInvoiceForUser(id, session.user);
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(invoice);
}
\`\`\`

Note the codes: **401** means "I do not know who you are", **403** means "I know, and no". Route Handlers return status codes, not redirects — the caller is often not a browser.

## Server Actions

A Server Action compiles to a POST endpoint with a generated id that is discoverable in the client bundle, so it is exactly as exposed as a Route Handler. Every action re-authenticates, validates and authorises:

\`\`\`ts
'use server';
import { requireUser } from '@/lib/dal';
import { invoiceInput } from './schema';

export async function updateInvoice(_prev: unknown, formData: FormData) {
  const user = await requireUser();                                  // 1. who

  const parsed = invoiceInput.safeParse(Object.fromEntries(formData)); // 2. what
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const owned = await db.invoice.findFirst({
    where: { id: parsed.data.id, organisationId: user.organisationId }, // 3. may they
  });
  if (!owned) return { errors: { _form: ['Not found'] } };

  await db.invoice.update({ where: { id: owned.id }, data: parsed.data });
  revalidatePath('/invoices');
  return { errors: {} };
}
\`\`\`

Three checks, in that order, in every action. A hidden \`<input name="organisationId">\` is not a check — the client controls it. Derive the tenant from the session, never from the form.

> Every export in a \`'use server'\` file is a public endpoint. Never put a helper you did not mean to expose there.

## RBAC in a layout

Roles are usually hierarchical, and a numeric rank makes the comparison trivial:

\`\`\`ts
export const ROLE_RANK = { viewer: 1, member: 2, admin: 3, owner: 4 } as const;
export type Role = keyof typeof ROLE_RANK;
export const rank = (role?: string) => ROLE_RANK[role as Role] ?? 0;
export const atLeast = (role: string | undefined, min: Role) => rank(role) >= rank(min);
\`\`\`

\`\`\`tsx
// app/(app)/admin/layout.tsx
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('admin');   // UX gate: clean redirect, no flash
  return <AdminShell user={user}>{children}</AdminShell>;
}
\`\`\`

The layout gives the good experience; the queries beneath it give the guarantee. Both, always. Today's second problem is that resolver — session plus route config in, \`allow\`, \`redirect\` or \`403\` out — a pure function you can unit-test exhaustively, which is exactly what authorisation logic should be.

Hiding a control the user cannot use (\`{atLeast(user.role, 'admin') && <DeleteButton />}\`) is courtesy. The action behind it still checks.

## Environment variables and the \`NEXT_PUBLIC_\` footgun

Next inlines any variable prefixed \`NEXT_PUBLIC_\` into the **client bundle at build time**. Two consequences:

1. **It is public, permanently.** Not "hard to find" — a literal string in a JavaScript file on a CDN. \`NEXT_PUBLIC_STRIPE_SECRET_KEY\` is a breach, and it must be rotated, not deleted.
2. **It is frozen at build time.** Changing it in your host's dashboard does nothing until you rebuild. Server-side variables are read at runtime and update on restart.

\`\`\`ts
// lib/env.ts — fail fast, in one place
import { z } from 'zod';

export const env = z
  .object({
    DATABASE_URL: z.string().url(),
    AUTH_SECRET: z.string().min(32),
    NEXT_PUBLIC_APP_URL: z.string().url(),
  })
  .parse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,   // full literal, always
  });
\`\`\`

Client variables must be referenced as **full literals** — never \`process.env[key]\` — because the inlining is a textual find-and-replace at build time. A dynamic lookup works on the server and yields \`undefined\` in the browser.

Before every deploy: \`grep -r "NEXT_PUBLIC_" src/\`, and check every hit is something you would print on a billboard.`,
    },
    {
      slug: 'caching-observability-and-deployment',
      title: 'Caching, Revalidation, Observability & Deployment',
      estimatedMinutes: 75,
      body: `# Caching, Revalidation, Observability & Deployment

The app works on your machine. Everything from here is about how it behaves under real traffic.

## The caching layers

Next 15 has four caches, and working out which one is lying to you is most of the debugging.

| Cache | Scope | Default in 15 | Invalidated by |
| --- | --- | --- | --- |
| **Request memoization** | one render pass | on | end of the request |
| **Data Cache** | across requests, server-side | **off** for \`fetch\` | \`revalidateTag\`, \`revalidatePath\`, time |
| **Full Route Cache** | rendered HTML/RSC, static routes | on at build | a deploy, or revalidation |
| **Router Cache** | client-side, in memory | 30 s static, 0 s dynamic | \`router.refresh()\`, a Server Action |

Next 15 flipped two defaults: \`fetch\` and \`GET\` Route Handlers are **no longer cached by default**. Caching is now something you ask for:

\`\`\`ts
const posts = await fetch(url, { next: { revalidate: 3600, tags: ['posts'] } });
const me = await fetch('/api/me', { cache: 'no-store' });

// Cache a non-fetch source: an ORM query, a filesystem read
export const getPopularTags = unstable_cache(
  async () => db.tag.findMany({ orderBy: { count: 'desc' }, take: 10 }),
  ['popular-tags'],
  { revalidate: 600, tags: ['tags'] },
);
\`\`\`

Segment config still applies to a whole route: \`export const revalidate = 60\`, \`dynamic = 'force-static' | 'force-dynamic'\`, and \`dynamicParams = true\` to allow params \`generateStaticParams\` did not return.

## ISR and on-demand revalidation

ISR gives static performance with fresh-enough data: prerender the known pages, serve from cache, regenerate in the background when stale.

\`\`\`tsx
// app/blog/[slug]/page.tsx
export const revalidate = 3600;

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.slice(0, 100).map((p) => ({ slug: p.slug }));   // top 100 at build
}
\`\`\`

The other 900 render on first request and are cached from then on — that is \`dynamicParams\`. The behaviour is stale-while-revalidate: after the window expires the *next* visitor still gets the cached page instantly while regeneration happens behind them.

Time-based revalidation is a guess; on-demand revalidation is the truth. Call it from your CMS webhook:

\`\`\`ts
// app/api/revalidate/route.ts
export async function POST(request: Request) {
  if (request.headers.get('x-revalidate-secret') !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { tag } = await request.json();
  revalidateTag(tag);
  return NextResponse.json({ revalidated: true, now: Date.now() });
}
\`\`\`

Tag your fetches by entity (\`['post-' + id, 'posts']\`) and you can invalidate one post or the whole index. \`revalidatePath('/blog')\` is the blunter equivalent.

> A cache bug and a data bug look identical. Before debugging the query, check whether you are looking at a cached render: render a timestamp in development and compare.

## Instrumentation and observability

\`instrumentation.ts\` runs once per server instance, before anything else — the right place to start a tracer:

\`\`\`ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node');   // OpenTelemetry SDK, Sentry, etc.
  }
}

export async function onRequestError(error, request, context) {
  await fetch(process.env.ERROR_SINK_URL!, {
    method: 'POST',
    body: JSON.stringify({ message: error.message, digest: error.digest, ...context }),
  });
}
\`\`\`

The \`digest\` matters. In production a server error is deliberately reduced to "Something went wrong" plus a digest hash — the real message never reaches the browser — and that digest is how you find the log entry. Surface it in \`error.tsx\`:

\`\`\`tsx
'use client';
export default function Error({ error, reset }) {
  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      {error.digest && <p>Reference: {error.digest}</p>}
      <button onClick={reset}>Try again</button>
    </div>
  );
}
\`\`\`

Round it out with \`useReportWebVitals\` for field performance data, and \`after(() => logAnalytics(result))\` from \`next/server\` for work that must not block the response.

## Deployment: three shapes

| Target | You get | You give up |
| --- | --- | --- |
| **Vercel** | ISR, edge middleware, image optimisation, preview URLs | portability; usage-based billing |
| **\`next start\`** on a VM or PaaS | full Node, your infra, predictable cost | you operate it: TLS, scaling, cache sharing |
| **\`output: 'standalone'\`** in Docker | a small image, identical everywhere | the same ops work, plus image plumbing |

Set \`output: 'standalone'\` in \`next.config.ts\`, build in one Docker stage, then copy three directories into a clean runner stage:

\`\`\`dockerfile
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
CMD ["node", "server.js"]
\`\`\`

\`standalone\` traces the modules the server actually needs and emits a self-contained \`server.js\`, which is why the runner copies three directories and no \`node_modules\`. Two things to remember when self-hosting:

- **Build-time variables are baked in.** \`NEXT_PUBLIC_*\` comes from the environment at build, so one image cannot serve two environments with different public URLs.
- **ISR needs shared storage across replicas.** The incremental cache defaults to local disk, so pods regenerate independently and users see different versions. Point \`cacheHandler\` at Redis or S3.

## Image optimisation is a real cost

\`next/image\` optimises on demand and caches the result. On Vercel you are billed per source-image transformation; self-hosted, each one is CPU and disk.

\`\`\`ts
images: {
  remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com', pathname: '/images/**' }],
  minimumCacheTTL: 60 * 60 * 24 * 31,   // cache hard; the default is short
  deviceSizes: [640, 828, 1080, 1920],  // fewer breakpoints, fewer transformations
}
\`\`\`

Never use an open \`remotePatterns\` wildcard: it turns your deployment into a free image-resizing service for the internet, billed to you. If your images already come from an image CDN, set \`unoptimized: true\` and skip Next's layer.

## Production readiness checklist

- [ ] Every server secret set per environment; nothing secret carries a \`NEXT_PUBLIC_\` prefix
- [ ] Env schema parsed at startup, so a missing variable fails the boot, not the first request
- [ ] Auth enforced in the data layer, not only in middleware and layouts
- [ ] Security headers set: CSP, HSTS, \`X-Content-Type-Options\`, \`Referrer-Policy\`
- [ ] Session cookies \`httpOnly\`, \`secure\`, \`sameSite=lax\`
- [ ] Every \`fetch\` either tagged and revalidated, or explicitly \`no-store\`
- [ ] An authenticated on-demand revalidation endpoint
- [ ] \`error.tsx\`, \`not-found.tsx\` and \`global-error.tsx\`, with the digest surfaced
- [ ] \`instrumentation.ts\` wired to an error sink, verified with a deliberate throw
- [ ] Rate limiting on auth and mutation endpoints
- [ ] \`next build\` clean, and a rollback you have rehearsed

The last one matters more than the rest combined. Every production system fails; the difference between an incident and an outage is how fast you can restore the version that worked.`,
    },
  ],
  quiz: [
    {
      prompt: 'Why is an authentication check in `middleware.ts` not an authorisation boundary?',
      options: [
        'Because middleware only runs in development',
        'Because it typically checks only for the presence of a cookie, cannot reach the database from the edge, and can be bypassed or excluded by the matcher',
        'Because NextResponse.redirect does not stop the request',
        'Because middleware runs after the page has already rendered',
      ],
      correctIndex: 1,
      explanation:
        'Edge middleware cannot talk to your ORM, so the realistic check is "does a session-shaped cookie exist". Add matcher gaps, Server Actions invoked from a loaded page, and the March 2025 middleware-bypass CVE, and it is clearly an optimisation. The real decision belongs in the data layer.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which of these can middleware NOT do when running on the default edge runtime?',
      options: [
        'Rewrite the request to a different route',
        'Read and set cookies on the request and response',
        'Query Postgres through Prisma to load the user record',
        'Set a Content-Security-Policy header with a per-request nonce',
      ],
      correctIndex: 2,
      explanation:
        'The edge runtime is a V8 isolate with Web APIs only — no fs, no net, no native modules, so most ORMs cannot run there. Rewrites, cookies and headers are all fine. A Node runtime for middleware exists but is experimental.',
      difficulty: 'EASY',
    },
    {
      prompt: 'A `config.matcher` entry must be a static string literal. Why?',
      options: [
        'Because Next.js compiles the patterns into the routing manifest at build time',
        'Because path-to-regexp cannot parse template literals',
        'Because the edge runtime forbids string concatenation',
        'Because dynamic matchers would break TypeScript inference',
      ],
      correctIndex: 0,
      explanation:
        'Matchers are analysed statically during the build and written into the routing manifest, so they cannot depend on a runtime value. Build the pattern by hand, or do the conditional check inside the middleware body.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'You must be able to log a compromised user out immediately. Which session strategy?',
      options: [
        'A stateless JWT with a 30-day expiry',
        'A JWT stored in localStorage so the client can delete it',
        'A database (or Redis) session with an opaque cookie id',
        'A signed cookie containing the user role',
      ],
      correctIndex: 2,
      explanation:
        'Only a server-side session record can be deleted mid-flight. A stateless JWT stays valid until it expires unless you maintain a denylist, and localStorage is readable by any injected script — the opposite of what you want.',
      difficulty: 'EASY',
    },
    {
      prompt: 'In Auth.js v5, what is the relationship between the `jwt` and `session` callbacks?',
      options: [
        'They are aliases; configuring either one is enough',
        '`session` runs first and seeds the token that `jwt` signs',
        '`jwt` writes claims into the token server-side; `session` copies the safe subset onto the object the client can see',
        '`jwt` runs only on the edge and `session` only in Node',
      ],
      correctIndex: 2,
      explanation:
        'jwt is where you add claims such as the user id and role, ideally once at sign-in. session shapes what Server Components and the browser receive. Anything left out of session never leaves the server.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'An `async` layout redirects unauthenticated users. Why is that not enough on its own?',
      options: [
        'Layouts cannot call redirect()',
        'A layout is not re-rendered on every client-side navigation within its segment, and child RSC payloads can be requested directly',
        'redirect() only works inside middleware',
        'Layouts render after their child pages',
      ],
      correctIndex: 1,
      explanation:
        'React reuses the layout across navigations inside the segment, so the check does not necessarily re-run. Keep the layout for a clean redirect, but put the enforcing check next to the data in your access layer.',
      difficulty: 'HARD',
    },
    {
      prompt: 'What happens when you rename `STRIPE_SECRET_KEY` to `NEXT_PUBLIC_STRIPE_SECRET_KEY`?',
      options: [
        'Nothing — the prefix only affects which config file the value is read from',
        'It becomes available to Server Components only',
        'It is encrypted before being sent to the browser',
        'Its value is inlined as a literal string into the client JavaScript bundle, so it is public and must be rotated',
      ],
      correctIndex: 3,
      explanation:
        'NEXT_PUBLIC_ variables are textually substituted into the client bundle at build time. The value ships to every visitor and is frozen until the next build — a secret exposed this way must be rotated, not just renamed back.',
      difficulty: 'EASY',
    },
    {
      prompt: 'You self-host Next.js on three replicas and users see different versions of an ISR page. Why?',
      options: [
        'The Router Cache is set too high on the client',
        'The incremental cache defaults to each instance’s local filesystem, so each replica regenerates independently',
        '`revalidate` is ignored outside Vercel',
        'generateStaticParams only runs on one instance',
      ],
      correctIndex: 1,
      explanation:
        'Self-hosted ISR writes to local disk by default, so every pod holds its own copy. Configure a shared `cacheHandler` backed by Redis or object storage so all replicas read and write the same regenerated pages.',
      difficulty: 'HARD',
    },
  ],
  problems: [
    {
      slug: 'middleware-matcher',
      title: 'Implement the Middleware Matcher',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Next decides whether middleware runs by matching the request path against \`config.matcher\`. Implement a small version of that engine.

### \`matchPath(source, pathname)\`

Returns a params object when the path matches, or \`null\` when it does not.

Both arguments are split into segments: a leading \`/\` is required, a trailing \`/\` is ignored, and \`'/'\` is zero segments. A source segment is either a literal or a parameter:

| Segment | Matches | Param value |
| --- | --- | --- |
| \`users\` | the literal segment \`users\` | — |
| \`:id\` | exactly one segment | the segment, as a string |
| \`:path*\` | zero or more remaining segments | an array of segments |
| \`:path+\` | one or more remaining segments | an array of segments |

\`:name*\` and \`:name+\` only ever appear as the **last** source segment and consume everything that is left. A source with no parameters matches only an identical path.

### \`createMatcher(config)\`

\`config\` is an array of entries, each either a source string or \`{ source, exclude }\` where \`exclude\` is an array of path prefixes — the simple stand-in for Next's negative-lookahead patterns. It returns \`matches(pathname)\`, which is \`true\` when **some** entry matches the path and that entry does not exclude it.

A pathname is excluded by a prefix when it equals the prefix or starts with the prefix followed by \`/\`.

\`\`\`js
matchPath('/dashboard/:id', '/dashboard/42');       // { id: '42' }
matchPath('/docs/:path*', '/docs');                 // { path: [] }
matchPath('/docs/:path+', '/docs');                 // null

const runs = createMatcher([
  { source: '/:path*', exclude: ['/api', '/_next/static', '/favicon.ico'] },
]);
runs('/about');      // true
runs('/api/users');  // false
\`\`\``,
      starterCode: `function matchPath(source, pathname) {
  // your code here
}

function createMatcher(config) {
  // your code here
}

module.exports = { matchPath, createMatcher };`,
      solutionCode: `function toSegments(path) {
  var raw = String(path == null ? '' : path);
  var qs = raw.indexOf('?');
  if (qs !== -1) raw = raw.slice(0, qs);
  if (raw.length > 1 && raw.charAt(raw.length - 1) === '/') raw = raw.slice(0, -1);
  if (raw === '' || raw === '/') return [];
  if (raw.charAt(0) === '/') raw = raw.slice(1);
  return raw.split('/');
}

function matchPath(source, pathname) {
  var pattern = toSegments(source);
  var actual = toSegments(pathname);
  var params = {};

  for (var i = 0; i < pattern.length; i++) {
    var seg = pattern[i];

    if (seg.charAt(0) === ':') {
      var last = seg.charAt(seg.length - 1);
      var star = last === '*';
      var plus = last === '+';
      var name = star || plus || last === '?' ? seg.slice(1, -1) : seg.slice(1);

      if (star || plus) {
        var rest = actual.slice(i);
        if (plus && rest.length === 0) return null;
        params[name] = rest;
        return params;
      }

      if (i >= actual.length) {
        if (last === '?') {
          params[name] = '';
          continue;
        }
        return null;
      }

      params[name] = actual[i];
      continue;
    }

    if (actual[i] !== seg) return null;
  }

  if (actual.length !== pattern.length) return null;
  return params;
}

function isExcluded(pathname, prefixes) {
  for (var i = 0; i < prefixes.length; i++) {
    var prefix = prefixes[i];
    if (pathname === prefix) return true;
    if (pathname.indexOf(prefix + '/') === 0) return true;
  }
  return false;
}

function createMatcher(config) {
  var entries = (config || []).map(function (entry) {
    if (typeof entry === 'string') return { source: entry, exclude: [] };
    return { source: entry.source, exclude: entry.exclude || [] };
  });

  return function matches(pathname) {
    var clean = String(pathname == null ? '' : pathname);
    var qs = clean.indexOf('?');
    if (qs !== -1) clean = clean.slice(0, qs);
    if (clean.length > 1 && clean.charAt(clean.length - 1) === '/') clean = clean.slice(0, -1);

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (isExcluded(clean, entry.exclude)) continue;
      if (matchPath(entry.source, clean) !== null) return true;
    }
    return false;
  };
}

module.exports = { matchPath, createMatcher };`,
      hints: [
        'Write one segment-splitting helper and use it for both the source and the path — the trailing-slash rule must be identical on both sides.',
        'A trailing * or + consumes the rest of the segments, so return as soon as you hit one.',
        'After the loop, a match is only valid if the two segment lists are the same length — otherwise /a/b matched the pattern /a.',
        'Exclusion is a segment-aware prefix test: equal, or startsWith(prefix + "/"). A plain startsWith would exclude /apixyz.',
      ],
      tests: [
        {
          name: 'captures a single named segment',
          assertion: "deepEqual(solution.matchPath('/dashboard/:id', '/dashboard/42'), { id: '42' })",
        },
        {
          name: 'a required segment must be present',
          assertion: "solution.matchPath('/dashboard/:id', '/dashboard') === null",
        },
        {
          name: 'a literal source does not match a longer path',
          assertion:
            "solution.matchPath('/dashboard', '/dashboard/settings') === null && deepEqual(solution.matchPath('/dashboard', '/dashboard'), {})",
        },
        {
          name: ':path* matches zero segments',
          assertion: "deepEqual(solution.matchPath('/docs/:path*', '/docs'), { path: [] })",
        },
        {
          name: ':path* captures the remaining segments',
          assertion: "deepEqual(solution.matchPath('/docs/:path*', '/docs/a/b'), { path: ['a','b'] })",
        },
        {
          name: ':path+ requires at least one segment',
          assertion:
            "solution.matchPath('/docs/:path+', '/docs') === null && deepEqual(solution.matchPath('/docs/:path+', '/docs/a'), { path: ['a'] })",
        },
        {
          name: 'trailing slashes are ignored',
          assertion:
            "deepEqual(solution.matchPath('/dashboard/:id', '/dashboard/42/'), { id: '42' }) && deepEqual(solution.matchPath('/', '/'), {})",
        },
        {
          name: 'createMatcher runs on a matching route',
          assertion:
            "solution.createMatcher(['/dashboard/:path*'])('/dashboard/settings') === true && solution.createMatcher(['/dashboard/:path*'])('/pricing') === false",
        },
        {
          name: 'exclude prefixes suppress the match',
          assertion:
            "(function(){var runs=solution.createMatcher([{source:'/:path*',exclude:['/api','/_next/static','/favicon.ico']}]);return runs('/about')===true&&runs('/api/users')===false&&runs('/favicon.ico')===false;})()",
          hidden: true,
        },
        {
          name: 'exclusion is segment-aware, not a naive prefix',
          assertion:
            "(function(){var runs=solution.createMatcher([{source:'/:path*',exclude:['/api']}]);return runs('/apixyz')===true&&runs('/api')===false;})()",
          hidden: true,
        },
        {
          name: 'any entry in the config can match',
          assertion:
            "(function(){var runs=solution.createMatcher(['/admin/:path*','/invoices/:id']);return runs('/invoices/7')===true&&runs('/invoices/7/edit')===false&&runs('/admin')===true;})()",
          hidden: true,
        },
      ],
      xp: 45,
    },
    {
      slug: 'rbac-route-resolver',
      title: 'RBAC Route Protection Resolver',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Authorisation logic is at its best as a pure function you can test exhaustively. Write the resolver that turns a request, a session and a route config into a decision.

\`\`\`js
resolveAccess(request, session, rules, now)
\`\`\`

- \`request\` — \`{ pathname, search }\` (\`search\` may be omitted; it includes the leading \`?\`)
- \`session\` — \`null\`, or \`{ userId, roles: string[], expiresAt: number }\` (epoch ms)
- \`rules\` — \`[{ path, access, minRole? }]\` where \`access\` is \`'public'\`, \`'authenticated'\` or \`'role'\`
- \`now\` — epoch ms

### Algorithm

1. Pick the matching rule: the one with the **longest \`path\`** that is a *segment-aware* prefix of \`pathname\` (equal to it, or followed by \`/\`; the rule \`'/'\` matches everything). No match returns \`{ decision: 'deny', status: 403, reason: 'no-matching-rule' }\`.
2. \`access === 'public'\` returns \`{ decision: 'allow' }\`, whatever the session.
3. A session is valid only when it exists **and** \`expiresAt > now\`. An invalid session returns
   \`{ decision: 'redirect', status: 307, location: '/login?next=' + encodeURIComponent(pathname + search) }\`.
4. \`access === 'authenticated'\` with a valid session returns \`{ decision: 'allow' }\`.
5. \`access === 'role'\` compares ranks — \`viewer\` 1, \`member\` 2, \`admin\` 3, \`owner\` 4. The user's rank is the **highest** of their roles; an unknown role ranks 0. Rank at least \`minRole\` returns \`{ decision: 'allow' }\`, otherwise \`{ decision: 'deny', status: 403, reason: 'insufficient-role' }\`.

An unknown \`minRole\` can never be satisfied.

\`\`\`js
const rules = [
  { path: '/', access: 'public' },
  { path: '/dashboard', access: 'authenticated' },
  { path: '/admin', access: 'role', minRole: 'admin' },
  { path: '/admin/billing', access: 'role', minRole: 'owner' },
];

resolveAccess({ pathname: '/dashboard' }, null, rules, 0);
// { decision: 'redirect', status: 307, location: '/login?next=%2Fdashboard' }
\`\`\``,
      starterCode: `const ROLE_RANK = { viewer: 1, member: 2, admin: 3, owner: 4 };

function resolveAccess(request, session, rules, now) {
  // your code here
}

module.exports = { resolveAccess, ROLE_RANK };`,
      solutionCode: `const ROLE_RANK = { viewer: 1, member: 2, admin: 3, owner: 4 };

function rankOf(role) {
  return Object.prototype.hasOwnProperty.call(ROLE_RANK, role) ? ROLE_RANK[role] : 0;
}

function covers(rulePath, pathname) {
  if (rulePath === '/') return true;
  if (pathname === rulePath) return true;
  return pathname.indexOf(rulePath + '/') === 0;
}

function resolveAccess(request, session, rules, now) {
  var req = request || {};
  var pathname = String(req.pathname || '/');
  var search = String(req.search || '');
  var list = rules || [];

  var match = null;
  for (var i = 0; i < list.length; i++) {
    var rule = list[i];
    if (!covers(rule.path, pathname)) continue;
    if (match === null || String(rule.path).length > String(match.path).length) {
      match = rule;
    }
  }

  if (match === null) {
    return { decision: 'deny', status: 403, reason: 'no-matching-rule' };
  }

  if (match.access === 'public') {
    return { decision: 'allow' };
  }

  var valid = !!session && Number(session.expiresAt) > Number(now);
  if (!valid) {
    return {
      decision: 'redirect',
      status: 307,
      location: '/login?next=' + encodeURIComponent(pathname + search),
    };
  }

  if (match.access === 'authenticated') {
    return { decision: 'allow' };
  }

  if (match.access === 'role') {
    var roles = session.roles || [];
    var userRank = 0;
    for (var j = 0; j < roles.length; j++) {
      var r = rankOf(roles[j]);
      if (r > userRank) userRank = r;
    }

    var required = rankOf(match.minRole);
    if (required === 0 || userRank < required) {
      return { decision: 'deny', status: 403, reason: 'insufficient-role' };
    }
    return { decision: 'allow' };
  }

  return { decision: 'deny', status: 403, reason: 'insufficient-role' };
}

module.exports = { resolveAccess, ROLE_RANK };`,
      hints: [
        'Scan every rule and keep the one with the longest path that covers the pathname — do not stop at the first hit.',
        'The rule "/" is a special case: it covers everything, including "/" itself.',
        'Segment-aware means "/admin" must not cover "/administrators": compare equality or startsWith(path + "/").',
        'The user rank is the maximum over their roles, so a user with ["viewer","owner"] is an owner.',
        'An unknown minRole ranks 0, and 0 must be treated as unsatisfiable rather than as "everyone passes".',
      ],
      tests: [
        {
          name: 'a public route allows an anonymous visitor',
          assertion:
            "deepEqual(solution.resolveAccess({pathname:'/about'}, null, [{path:'/',access:'public'}], 0), { decision: 'allow' })",
        },
        {
          name: 'an authenticated route redirects with a next param',
          assertion:
            "deepEqual(solution.resolveAccess({pathname:'/dashboard'}, null, [{path:'/',access:'public'},{path:'/dashboard',access:'authenticated'}], 0), { decision: 'redirect', status: 307, location: '/login?next=%2Fdashboard' })",
        },
        {
          name: 'an expired session is treated as no session',
          assertion:
            "solution.resolveAccess({pathname:'/dashboard'}, {userId:'u1',roles:['member'],expiresAt:1000}, [{path:'/dashboard',access:'authenticated'}], 2000).decision === 'redirect'",
        },
        {
          name: 'a valid session passes an authenticated route',
          assertion:
            "deepEqual(solution.resolveAccess({pathname:'/dashboard/settings'}, {userId:'u1',roles:['viewer'],expiresAt:9999}, [{path:'/dashboard',access:'authenticated'}], 0), { decision: 'allow' })",
        },
        {
          name: 'the longest matching rule wins',
          assertion:
            "(function(){var rules=[{path:'/',access:'public'},{path:'/admin',access:'role',minRole:'admin'},{path:'/admin/billing',access:'role',minRole:'owner'}];var s={userId:'u1',roles:['admin'],expiresAt:9999};return deepEqual(solution.resolveAccess({pathname:'/admin/billing'}, s, rules, 0), { decision:'deny', status:403, reason:'insufficient-role' }) && deepEqual(solution.resolveAccess({pathname:'/admin/users'}, s, rules, 0), { decision:'allow' });})()",
        },
        {
          name: 'role ranks are hierarchical',
          assertion:
            "(function(){var rules=[{path:'/admin',access:'role',minRole:'admin'}];return solution.resolveAccess({pathname:'/admin'}, {userId:'u',roles:['owner'],expiresAt:9999}, rules, 0).decision==='allow' && solution.resolveAccess({pathname:'/admin'}, {userId:'u',roles:['member'],expiresAt:9999}, rules, 0).decision==='deny';})()",
        },
        {
          name: 'prefix matching is segment-aware',
          assertion:
            "(function(){var rules=[{path:'/',access:'public'},{path:'/admin',access:'role',minRole:'owner'}];return solution.resolveAccess({pathname:'/administrators'}, null, rules, 0).decision==='allow';})()",
        },
        {
          name: 'no matching rule fails closed',
          assertion:
            "deepEqual(solution.resolveAccess({pathname:'/other'}, null, [{path:'/admin',access:'role',minRole:'admin'}], 0), { decision:'deny', status:403, reason:'no-matching-rule' })",
          hidden: true,
        },
        {
          name: 'the search string is preserved in the next param',
          assertion:
            "solution.resolveAccess({pathname:'/dashboard',search:'?tab=1'}, null, [{path:'/dashboard',access:'authenticated'}], 0).location === '/login?next=%2Fdashboard%3Ftab%3D1'",
          hidden: true,
        },
        {
          name: 'a public route allows even an expired session',
          assertion:
            "solution.resolveAccess({pathname:'/pricing'}, {userId:'u',roles:[],expiresAt:1}, [{path:'/',access:'public'}], 5000).decision === 'allow'",
          hidden: true,
        },
        {
          name: 'the highest of several roles is used, and unknown roles rank zero',
          assertion:
            "(function(){var rules=[{path:'/admin',access:'role',minRole:'admin'}];return solution.resolveAccess({pathname:'/admin'}, {userId:'u',roles:['viewer','owner'],expiresAt:9999}, rules, 0).decision==='allow' && solution.resolveAccess({pathname:'/admin'}, {userId:'u',roles:['wizard'],expiresAt:9999}, rules, 0).decision==='deny';})()",
          hidden: true,
        },
        {
          name: 'an unknown minRole can never be satisfied',
          assertion:
            "solution.resolveAccess({pathname:'/admin'}, {userId:'u',roles:['owner'],expiresAt:9999}, [{path:'/admin',access:'role',minRole:'superuser'}], 0).decision === 'deny'",
          hidden: true,
        },
      ],
      xp: 75,
    },
    {
      slug: 'cookie-parse-serialize',
      title: 'Cookie Parser and Set-Cookie Serialiser',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Session security lives or dies on cookie attributes. Implement both halves of the round trip.

### \`parseCookieHeader(header)\`

Parses a \`Cookie:\` request header into an object.

- Split on \`;\`, trim each pair, split on the **first** \`=\`.
- Names are used as-is; values are \`decodeURIComponent\`-ed, falling back to the raw value if decoding throws.
- A value wrapped in double quotes has them stripped.
- Pairs with an empty name are skipped, and the **first** occurrence of a name wins.
- An empty, missing or whitespace-only header returns \`{}\`.

### \`serializeCookie(name, value, options)\`

Builds one \`Set-Cookie\` string. Attributes appear in exactly this order, and only when supplied:

\`\`\`
name=value; Max-Age=<n>; Expires=<utc>; Path=<p>; Domain=<d>; SameSite=<S>; Secure; HttpOnly; Partitioned
\`\`\`

- \`value\` is encoded with \`encodeURIComponent\`.
- \`maxAge\` is in seconds and must be a finite **integer** — otherwise throw a \`TypeError\`.
- \`expires\` may be a \`Date\` or an epoch-ms number, and is emitted with \`toUTCString()\`.
- \`sameSite\` accepts \`'lax' | 'strict' | 'none'\` in any case and is emitted capitalised (\`Lax\`, \`Strict\`, \`None\`). Any other value throws a \`TypeError\`.
- **\`sameSite: 'none'\` without \`secure: true\` throws** — browsers reject that combination outright.
- A \`name\` containing whitespace, \`;\`, \`=\` or \`,\` throws a \`TypeError\`.
- \`httpOnly\`, \`secure\` and \`partitioned\` are valueless flags.

\`\`\`js
serializeCookie('session', 'a b', { maxAge: 3600, path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
// 'session=a%20b; Max-Age=3600; Path=/; SameSite=Lax; Secure; HttpOnly'

parseCookieHeader('theme=dark; session=abc%20def');
// { theme: 'dark', session: 'abc def' }
\`\`\``,
      starterCode: `function parseCookieHeader(header) {
  // your code here
}

function serializeCookie(name, value, options) {
  // your code here
}

module.exports = { parseCookieHeader, serializeCookie };`,
      solutionCode: `function parseCookieHeader(header) {
  var out = {};
  var raw = String(header == null ? '' : header).trim();
  if (!raw) return out;

  var pairs = raw.split(';');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].trim();
    if (!pair) continue;

    var eq = pair.indexOf('=');
    var name = (eq === -1 ? pair : pair.slice(0, eq)).trim();
    if (!name) continue;
    if (Object.prototype.hasOwnProperty.call(out, name)) continue;

    var value = eq === -1 ? '' : pair.slice(eq + 1).trim();
    if (value.length > 1 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
      value = value.slice(1, -1);
    }

    try {
      out[name] = decodeURIComponent(value);
    } catch (e) {
      out[name] = value;
    }
  }

  return out;
}

var SAME_SITE = { lax: 'Lax', strict: 'Strict', none: 'None' };

function serializeCookie(name, value, options) {
  var opts = options || {};
  var key = String(name);

  if (key === '' || /[\\s;=,]/.test(key)) {
    throw new TypeError('Invalid cookie name: ' + key);
  }

  var parts = [key + '=' + encodeURIComponent(String(value == null ? '' : value))];

  if (opts.maxAge !== undefined && opts.maxAge !== null) {
    var maxAge = Number(opts.maxAge);
    if (!isFinite(maxAge) || Math.floor(maxAge) !== maxAge) {
      throw new TypeError('maxAge must be a finite integer number of seconds');
    }
    parts.push('Max-Age=' + maxAge);
  }

  if (opts.expires !== undefined && opts.expires !== null) {
    var expires = opts.expires instanceof Date ? opts.expires : new Date(Number(opts.expires));
    if (isNaN(expires.getTime())) throw new TypeError('expires must be a valid Date or epoch ms');
    parts.push('Expires=' + expires.toUTCString());
  }

  if (opts.path) parts.push('Path=' + opts.path);
  if (opts.domain) parts.push('Domain=' + opts.domain);

  if (opts.sameSite !== undefined && opts.sameSite !== null) {
    var normalised = SAME_SITE[String(opts.sameSite).toLowerCase()];
    if (!normalised) throw new TypeError('Invalid sameSite: ' + opts.sameSite);
    if (normalised === 'None' && !opts.secure) {
      throw new TypeError('SameSite=None requires the Secure attribute');
    }
    parts.push('SameSite=' + normalised);
  }

  if (opts.secure) parts.push('Secure');
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.partitioned) parts.push('Partitioned');

  return parts.join('; ');
}

module.exports = { parseCookieHeader, serializeCookie };`,
      hints: [
        'Split each cookie pair on the FIRST "=" — base64 values end in "=" and must survive.',
        'Validate the name before you build anything; a name with a ";" would let a caller inject attributes.',
        'Math.floor(n) !== n is the cheapest integer test, but check isFinite first so NaN and Infinity are rejected.',
        'Normalise sameSite by lower-casing and looking it up in a map, then check the Secure requirement before pushing.',
        'Emit the flag attributes last and in a fixed order, so the output is deterministic and testable.',
      ],
      tests: [
        {
          name: 'parses a simple header',
          assertion: "deepEqual(solution.parseCookieHeader('a=1; b=2'), { a: '1', b: '2' })",
        },
        {
          name: 'decodes percent-encoded values',
          assertion: "solution.parseCookieHeader('session=abc%20def').session === 'abc def'",
        },
        {
          name: 'an empty or missing header returns an empty object',
          assertion:
            "deepEqual(solution.parseCookieHeader(''), {}) && deepEqual(solution.parseCookieHeader(undefined), {})",
        },
        {
          name: 'the first occurrence of a name wins and quotes are stripped',
          assertion:
            "(function(){var c=solution.parseCookieHeader('a=1; a=2; b=\"hi\"');return c.a==='1'&&c.b==='hi';})()",
        },
        {
          name: 'a value containing = survives',
          assertion: "solution.parseCookieHeader('t=eyJhbGciOiJIUzI1NiJ9==').t === 'eyJhbGciOiJIUzI1NiJ9=='",
        },
        {
          name: 'serialises a bare cookie',
          assertion: "solution.serializeCookie('session', 'abc') === 'session=abc'",
        },
        {
          name: 'serialises every attribute in order',
          assertion:
            "solution.serializeCookie('session','a b',{maxAge:3600,path:'/',httpOnly:true,secure:true,sameSite:'lax'}) === 'session=a%20b; Max-Age=3600; Path=/; SameSite=Lax; Secure; HttpOnly'",
        },
        {
          name: 'expires is emitted as a UTC string',
          assertion:
            "solution.serializeCookie('s','v',{expires:new Date(0)}) === 's=v; Expires=Thu, 01 Jan 1970 00:00:00 GMT'",
        },
        {
          name: 'SameSite=None without Secure throws',
          assertion:
            "throws(function(){solution.serializeCookie('s','v',{sameSite:'none'});}) && solution.serializeCookie('s','v',{sameSite:'None',secure:true}) === 's=v; SameSite=None; Secure'",
          hidden: true,
        },
        {
          name: 'an invalid name or sameSite throws',
          assertion:
            "throws(function(){solution.serializeCookie('a b','v');}) && throws(function(){solution.serializeCookie('a;b','v');}) && throws(function(){solution.serializeCookie('a','v',{sameSite:'sometimes'});})",
          hidden: true,
        },
        {
          name: 'a non-integer maxAge throws',
          assertion:
            "throws(function(){solution.serializeCookie('a','v',{maxAge:1.5});}) && throws(function(){solution.serializeCookie('a','v',{maxAge:'soon'});}) && solution.serializeCookie('a','v',{maxAge:0}) === 'a=v; Max-Age=0'",
          hidden: true,
        },
        {
          name: 'round-trips a value containing separators',
          assertion:
            "(function(){var header=solution.serializeCookie('s','a=b; c').split('; ')[0];return solution.parseCookieHeader(header).s === 'a=b; c';})()",
          hidden: true,
        },
      ],
      xp: 95,
    },
  ],
  flashcards: [
    {
      front: 'What can middleware NOT do on the edge runtime?',
      back: 'Use Node APIs (fs, net, child_process), native modules or most ORMs, and it cannot see route params or the segment tree because routing has not happened yet. It gets Web APIs, cookies, headers, redirects and rewrites.',
      tags: ['nextjs', 'middleware'],
    },
    {
      front: 'Why is an auth check in middleware not your authorisation boundary?',
      back: 'It can usually only check that a session-shaped cookie exists, it cannot reach the database from the edge, matcher gaps and Server Actions can skip it, and a 2025 CVE let it be bypassed with a header. It is a redirect optimisation; the real check goes next to the data.',
      tags: ['nextjs', 'security'],
    },
    {
      front: 'Why must `config.matcher` entries be static string literals?',
      back: 'Next analyses them at build time and writes them into the routing manifest, so they cannot depend on runtime values. Put any dynamic condition inside the middleware body instead.',
      tags: ['nextjs', 'middleware'],
    },
    {
      front: 'Database session vs stateless JWT',
      back: 'Database sessions cost a lookup per request but can be revoked instantly and reflect role changes immediately. JWTs need no I/O and work on the edge, but stay valid until they expire and carry stale claims.',
      tags: ['auth', 'jwt'],
    },
    {
      front: 'Why store a session token in an httpOnly cookie rather than localStorage?',
      back: 'Any injected script can read localStorage; nothing in the page can read an httpOnly cookie. Pair it with secure and sameSite=lax, which also removes most CSRF exposure.',
      tags: ['auth', 'security'],
    },
    {
      front: 'In Auth.js v5, what do the `jwt` and `session` callbacks each do?',
      back: 'jwt adds claims to the token server-side (do the role lookup once, at sign-in). session copies the safe subset onto the object Server Components and the browser can see. Anything omitted from session never leaves the server.',
      tags: ['auth', 'nextauth'],
    },
    {
      front: 'Why does Auth.js v5 need a split `auth.config.ts` and `auth.ts`?',
      back: 'Middleware runs on the edge, where database adapters cannot. The edge-safe providers and callbacks live in auth.config.ts; the adapter is added only in auth.ts, which runs in Node.',
      tags: ['auth', 'nextauth'],
    },
    {
      front: 'Why is a check in a layout not enough to protect a route?',
      back: 'Layouts are not re-rendered on every client-side navigation within their segment, and a child page’s RSC payload can be requested directly. Use the layout for the clean redirect and enforce in the data access layer.',
      tags: ['nextjs', 'authorization'],
    },
    {
      front: 'The three checks every Server Action needs',
      back: 'Authenticate (who is calling), validate (parse the input with Zod), authorise (does this user own this row — scoped in the where clause). A Server Action is a public POST endpoint with a discoverable id.',
      tags: ['nextjs', 'server-actions'],
    },
    {
      front: 'What happens to a `NEXT_PUBLIC_` variable at build time?',
      back: 'It is textually inlined into the client bundle, so it is permanently public and frozen until the next build. It must also be referenced as a full literal — process.env[key] does not get substituted.',
      tags: ['nextjs', 'env'],
    },
    {
      front: 'ISR: what does `revalidate` actually do?',
      back: 'Stale-while-revalidate. After the window expires the next visitor still gets the cached page instantly while a regeneration runs behind them. Pair it with generateStaticParams for the known pages and dynamicParams for the rest.',
      tags: ['nextjs', 'caching'],
    },
    {
      front: 'Why does self-hosted ISR serve different versions from different replicas?',
      back: 'The incremental cache defaults to each instance’s local filesystem. Configure a shared cacheHandler backed by Redis or object storage so every replica reads and writes the same regenerated pages.',
      tags: ['nextjs', 'deployment'],
    },
  ],
  resources: [
    {
      label: 'Next.js — Middleware and matchers',
      url: 'https://nextjs.org/docs/app/api-reference/file-conventions/middleware',
      kind: 'DOCS',
    },
    {
      label: 'Next.js — Authentication guide (sessions, DAL, Server Actions)',
      url: 'https://nextjs.org/docs/app/guides/authentication',
      kind: 'DOCS',
    },
    {
      label: 'Auth.js v5 — Installation and configuration',
      url: 'https://authjs.dev/getting-started/installation',
      kind: 'DOCS',
    },
    {
      label: 'Next.js — Caching and revalidating',
      url: 'https://nextjs.org/docs/app/guides/caching',
      kind: 'DOCS',
    },
    {
      label: 'Next.js — Self-hosting and standalone output',
      url: 'https://nextjs.org/docs/app/guides/self-hosting',
      kind: 'DOCS',
    },
  ],
};

export default day;
