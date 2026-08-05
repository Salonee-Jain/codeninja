import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 12,
  week: 2,
  pillar: 'FRONTEND',
  title: 'Next.js I — App Router, Server Components & Rendering',
  summary: 'Move from a React SPA to a framework: file-based routing, Server Components, and four ways to render a page.',
  estimatedMinutes: 330,
  objectives: [
    'Explain what a framework adds on top of React: routing, data location, bundling and rendering strategy',
    'Use every App Router file convention — page, layout, template, loading, error, not-found, route groups, parallel and intercepting routes',
    'Build nested layouts and dynamic segments, and pre-render them with generateStaticParams',
    'Reason correctly about the Server/Client boundary, what can be serialised across it, and where to put "use client"',
    'Compose Server Components inside Client Components using the children pattern',
    'Choose between static, dynamic, ISR and streaming rendering for a given route',
    'Apply the Metadata API and the next/image, next/font and next/link primitives',
  ],
  technologies: ['Next.js', 'React.js', 'TypeScript'],
  lessons: [
    {
      slug: 'why-a-framework',
      title: 'Why a Framework: What React Deliberately Leaves Out',
      estimatedMinutes: 70,
      body: `# Why a Framework: What React Deliberately Leaves Out

React describes itself as a library for building user interfaces, and it means it literally. \`react\` gives you components, state and a reconciler. It does not give you a router, a data-fetching strategy, a build pipeline, or an opinion about where your HTML comes from. For over a decade everyone assembled those four things by hand, and everyone assembled them slightly differently.

## The four gaps

**1. Routing.** React has no concept of a URL. You install React Router, hand-write a route config, and keep it in sync with your folder structure forever.

**2. Where data is fetched.** In a pure SPA every fetch happens in the browser, *after* the bundle has downloaded and executed. That produces the classic client waterfall:

\`\`\`text
HTML shell (empty)  ->  JS bundle (300 kB)  ->  React mounts  ->  fetch /api/user
                                                                     -> fetch /api/user/orders
                                                                          -> first useful paint
\`\`\`

Four sequential round trips before the user sees anything, and the last two only *start* once the JavaScript has run. On a mid-range Android on 4G that is comfortably three seconds of blank screen.

**3. Bundling and code splitting.** \`React.lazy\` exists, but deciding *what* to split, generating the chunks, preloading them on hover and inlining the critical CSS is build-tool work, not library work.

**4. Rendering strategy.** Should this page be a file on a CDN, rendered per request, or rebuilt every sixty seconds? React has no answer, because React never sees the request.

Next.js answers all four, and the answer to each has the same shape: **a convention instead of a configuration file**.

## The mental shift

The important idea is not "Next.js has server-side rendering" — Rails had that in 2005. It is that in the App Router **your components run on the server by default**, and only the ones you explicitly opt in also run in the browser. That inverts the SPA default. Data fetching moves next to the component that needs it, on the machine that sits next to your database:

\`\`\`tsx
// app/orders/page.tsx  — a Server Component. This code never ships to the browser.
import { db } from '@/lib/db';

export default async function OrdersPage() {
  const orders = await db.order.findMany({ take: 20 });
  return (
    <ul>
      {orders.map((o) => (
        <li key={o.id}>{o.reference}</li>
      ))}
    </ul>
  );
}
\`\`\`

No \`useEffect\`, no loading boolean, no \`/api/orders\` endpoint, and no client-side waterfall. The query happens 2 ms from the database instead of 200 ms away, and the browser receives markup rather than a promise of markup.

## Creating a project

\`\`\`bash
npx create-next-app@latest codeninja --typescript --tailwind --eslint --app
cd codeninja
npm run dev
\`\`\`

The layout you get:

\`\`\`text
app/
  layout.tsx        # root layout — required, must render <html> and <body>
  page.tsx          # route "/"
  globals.css
public/             # served from "/" as-is
next.config.ts
\`\`\`

Everything that maps to a URL lives under \`app/\`. A folder is a URL segment; a \`page.tsx\` inside it makes that segment routable. That is the entire routing API. There is no route table to maintain, and it is *impossible* for the router config to drift from the file system, because they are the same thing.

## What is new in Next 15 / React 19

You will find plenty of tutorials that are subtly wrong. Three changes matter on day one.

**Request APIs are async.** \`params\`, \`searchParams\`, \`cookies()\`, \`headers()\` and \`draftMode()\` all return Promises now. You await them.

\`\`\`tsx
// app/blog/[slug]/page.tsx — the Next 15 signature
export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <h1>{slug}</h1>;
}
\`\`\`

**\`fetch\` is no longer cached by default.** In Next 14 a bare \`fetch\` in a Server Component was cached indefinitely unless you opted out. In 15 the default is \`no-store\`; you opt *in* with \`next: { revalidate: 60 }\` or \`cache: 'force-cache'\`. This single change invalidates a large amount of older blog advice.

**React 19** ships Server Actions, \`useActionState\`, \`useOptimistic\` and the \`use\` hook as stable APIs — the whole subject of tomorrow.

> If a tutorial writes \`params.slug\` without awaiting, it was written for Next 14 or earlier. Property access still works in 15 behind a deprecation warning, and is removed in 16.

## What you give up

Honesty matters here. A framework is a set of constraints, and the App Router's constraints are real.

- You need a **Node-compatible runtime** to deploy. A pure SPA is a folder of static files you can drop on any CDN. A Next app with dynamic routes needs a server — Vercel, a container, or \`output: 'export'\` if you truly only need static files.
- The **Server/Client boundary is a new thing to get wrong**, and its error messages take about a week to become legible.
- **Caching became the hard part.** In an SPA the cache was TanStack Query and you could watch it in devtools. In Next there are four cache layers with different lifetimes, which is why tomorrow spends a whole lesson on them.

The trade is worth it when your app has content, shared data, SEO pressure, or a first paint you care about. It is not obviously worth it for an internal dashboard behind a login that nobody ever deep-links — that is still a perfectly good Vite SPA, and picking the boring option there is engineering, not laziness.`,
    },
    {
      slug: 'app-router-file-conventions',
      title: 'App Router File Conventions, Nested Layouts & Dynamic Segments',
      estimatedMinutes: 85,
      body: `# App Router File Conventions, Nested Layouts & Dynamic Segments

Every routing feature in the App Router is a **file with a reserved name**. Learn the eight names and you know the router.

## The special files

| File | Renders | Notes |
| --- | --- | --- |
| \`page.tsx\` | the route's UI | a segment is only routable if it has one |
| \`layout.tsx\` | a shell around \`children\` | **persists across navigation, keeping state** |
| \`template.tsx\` | like a layout, but re-mounted every navigation | enter animations, per-visit effects |
| \`loading.tsx\` | Suspense fallback for the segment | wraps \`page\` in \`<Suspense>\` for you |
| \`error.tsx\` | error boundary for the segment | must be a Client Component |
| \`not-found.tsx\` | UI for \`notFound()\` and unmatched URLs | |
| \`route.ts\` | an HTTP endpoint, not UI | cannot coexist with \`page.tsx\` in one folder |
| \`default.tsx\` | fallback for an unmatched parallel slot | |

\`\`\`text
app/
  layout.tsx                 # wraps everything
  page.tsx                   # /
  dashboard/
    layout.tsx               # wraps everything under /dashboard
    loading.tsx
    error.tsx
    page.tsx                 # /dashboard
    settings/
      page.tsx               # /dashboard/settings
\`\`\`

\`error.tsx\` has a fixed signature, and it must be a Client Component because it needs an error boundary and a reset handler:

\`\`\`tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert">
      <p>Could not load the dashboard.</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
\`\`\`

It catches errors thrown *below* it, so it never catches an error in its own layout — for that you need \`error.tsx\` one level up, or \`global-error.tsx\` at the root.

## Layouts nest, and that is the point

Navigating from \`/dashboard\` to \`/dashboard/settings\` re-renders **only the changed segment**. The root layout and the dashboard layout are not re-executed, their state is not reset, and their DOM is not thrown away. A sidebar with a scroll position, an open accordion or a playing video keeps all of it.

\`\`\`tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[240px_1fr]">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
\`\`\`

Two rules people trip on:

1. **The root layout must render \`<html>\` and \`<body>\`.** It is the only layout that may.
2. **A layout cannot read the current pathname.** It does not re-render on navigation, so a \`pathname\` prop would go stale immediately. Active-link highlighting belongs in a small Client Component that calls \`usePathname()\`.

\`template.tsx\` is the escape hatch: same signature as a layout, but React creates a **new instance on every navigation**, so state resets and effects re-fire. Use it deliberately; the default should be \`layout.tsx\`.

## Route groups: folders that do not appear in the URL

Wrap a folder name in parentheses and it is stripped from the path.

\`\`\`text
app/
  (marketing)/
    layout.tsx          # marketing shell
    about/page.tsx      # -> /about
    pricing/page.tsx    # -> /pricing
  (app)/
    layout.tsx          # authenticated shell
    dashboard/page.tsx  # -> /dashboard
\`\`\`

This is how two sections get **completely different layouts** without adding a segment to the URL. Note the consequence: \`app/(a)/x/page.tsx\` and \`app/(b)/x/page.tsx\` both resolve to \`/x\`, and Next fails the build with a duplicate-route error.

A folder prefixed with an underscore — \`_components\`, \`_lib\` — is **private**: excluded from routing entirely. That is how you colocate code next to the route that uses it without accidentally publishing a URL.

## Dynamic segments

\`\`\`text
app/blog/[slug]/page.tsx          -> /blog/hello        params: { slug: 'hello' }
app/docs/[...path]/page.tsx       -> /docs/a/b/c        params: { path: ['a','b','c'] }
app/shop/[[...filters]]/page.tsx  -> /shop  AND  /shop/red/small
\`\`\`

- \`[slug]\` matches exactly one segment and gives you a string.
- \`[...path]\` is a catch-all: **one or more** segments, as an array.
- \`[[...filters]]\` is an optional catch-all: **zero or more**, so it also matches the parent path itself. When zero, the key is simply absent from \`params\`.

Matching is ranked, most specific first: a literal segment beats \`[slug]\`, which beats \`[...all]\`, which beats \`[[...all]]\`. So \`/blog/new\` hits \`app/blog/new/page.tsx\` even though \`app/blog/[slug]/page.tsx\` would also match. You will implement exactly this ranking in today's hard problem.

## generateStaticParams

By default a dynamic route renders on demand. \`generateStaticParams\` tells the build which values to pre-render:

\`\`\`tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  const posts: { slug: string }[] = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

// Any slug NOT returned above 404s instead of rendering on demand.
export const dynamicParams = false;

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  return <article>{post.title}</article>;
}
\`\`\`

Return \`[]\` to pre-render nothing at build time and generate everything on first request instead. In a nested dynamic route such as \`[lang]/[slug]\`, the child's \`generateStaticParams\` receives the parent's params, so you can fan out per language.

## Parallel routes

Slots are folders named \`@name\`. They render **simultaneously** inside one layout, each with its own loading and error state.

\`\`\`text
app/dashboard/
  layout.tsx
  page.tsx
  @team/page.tsx
  @analytics/page.tsx
  @analytics/loading.tsx
\`\`\`

\`\`\`tsx
export default function Layout({
  children,
  team,
  analytics,
}: {
  children: React.ReactNode;
  team: React.ReactNode;
  analytics: React.ReactNode;
}) {
  return (
    <>
      {children}
      <div className="grid grid-cols-2">
        {team}
        {analytics}
      </div>
    </>
  );
}
\`\`\`

A slow \`@analytics\` no longer blocks \`@team\`. Add \`default.tsx\` to a slot so a hard refresh on a sub-route still has something to render there.

## Intercepting routes

\`(.)\` matches the same level, \`(..)\` one level up, \`(...)\` from the app root. The classic use is a photo that opens as a **modal** when clicked in-app but as a **full page** on a direct link or refresh:

\`\`\`text
app/feed/page.tsx
app/photo/[id]/page.tsx           # full page (direct visit / refresh)
app/feed/(..)photo/[id]/page.tsx  # modal (soft navigation from the feed)
\`\`\`

Pair it with a parallel slot \`@modal\` so the feed stays mounted underneath. This is one of the few App Router features that is genuinely painful to hand-roll, and it is worth reading the docs example once you have the basics down.`,
    },
    {
      slug: 'react-server-components',
      title: 'React Server Components and the Serialisation Boundary',
      estimatedMinutes: 90,
      body: `# React Server Components and the Serialisation Boundary

This is the concept everything else hangs off. Get it wrong and every error message for a week will be confusing.

## Two kinds of component

In the App Router, **every component is a Server Component unless something marks it otherwise**.

A **Server Component** runs once, on the server, during the render of a request (or at build time). It can be \`async\`. It can read the file system, query a database, use a private API key. Its code is *never sent to the browser* — it contributes zero bytes to your bundle. In exchange it cannot use state, effects or browser APIs, because it has already finished running by the time the HTML arrives.

A **Client Component** is a normal React component. It is server-rendered once for the initial HTML *and* shipped to the browser, where it hydrates and becomes interactive. It can use \`useState\`, \`useEffect\`, \`onClick\`, \`window\`, \`localStorage\`.

\`\`\`tsx
// app/_components/Counter.tsx
'use client';
import { useState } from 'react';

export function Counter() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>{n}</button>;
}
\`\`\`

## What 'use client' actually means

It does **not** mean "this component only runs on the client" — it is still server-rendered for the initial HTML. It means: *this file is the boundary; everything it imports, transitively, becomes part of the client bundle.*

That last clause is why placement matters so much. \`'use client'\` at the top of \`app/layout.tsx\` does not make one component interactive; it drags your entire component tree into the browser bundle, and you have re-created a client-side SPA with extra build steps.

**Push \`'use client'\` as far toward the leaves as you can.** A page that is 95% static content with one interactive dropdown should have exactly one \`'use client'\` file: the dropdown.

\`\`\`text
BAD   app/page.tsx  ('use client')     -> the whole page ships
        Article     (could be server, now client)
          Dropdown

GOOD  app/page.tsx  (server)
        Article     (server)
          Dropdown  ('use client')     -> only the dropdown ships
\`\`\`

You do not need \`'use client'\` in every file below the boundary. Once a module is in the client graph, everything it imports is too. Repeating the directive is harmless but redundant.

## The serialisation boundary

Props passed from a Server Component to a Client Component are **serialised** into the streamed response and deserialised in the browser. So they have to be things that survive the trip.

| Can cross | Cannot cross |
| --- | --- |
| \`string\`, \`number\`, \`boolean\`, \`null\`, \`undefined\`, \`bigint\` | functions and arrow functions |
| plain objects and arrays, recursively | class instances (an ORM row, your own \`User\` class) |
| \`Date\`, \`Map\`, \`Set\`, typed arrays | \`Symbol\` (except registered \`Symbol.for\`) |
| Promises, and JSX elements | anything closing over server state |
| Server Actions (functions marked \`'use server'\`) | \`Error\` instances, DOM nodes, streams |

\`\`\`tsx
// Error: Functions cannot be passed directly to Client Components
<Chart format={(v) => v.toFixed(2)} />

// Fix 1 — pass data, decide behaviour on the client
<Chart precision={2} />

// Fix 2 — pass a Server Action, which the runtime encodes as a reference
<DeleteButton action={deletePost} />
\`\`\`

The class-instance rule bites in real code. An ORM row often *looks* like a plain object but is an instance with getters and a prototype chain. Map it to a plain shape before it crosses:

\`\`\`tsx
const rows = await db.user.findMany();
const users = rows.map((u) => ({
  id: u.id,
  name: u.name,
  joined: u.createdAt.toISOString(),
}));
return <UserTable users={users} />;
\`\`\`

Rule of thumb: **if \`structuredClone\` would refuse it, so will the boundary** — plus functions, which \`structuredClone\` also refuses. Today's first problem is a linter for exactly this rule.

## Composition: Server Components inside Client Components

The most common misconception is that a Client Component can never contain a Server Component. It can — as long as the Server Component is *rendered by a server parent and passed in as a prop*, usually \`children\`.

The reason is timing. A Client Component cannot **import** a Server Component, because the import statement would pull server-only code into the client bundle. It can, however, receive already-rendered output.

\`\`\`tsx
// app/_components/Accordion.tsx
'use client';
import { useState } from 'react';

export function Accordion({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button onClick={() => setOpen(!open)}>Toggle</button>
      {open && children}
    </section>
  );
}
\`\`\`

\`\`\`tsx
// app/page.tsx — still a Server Component
import { Accordion } from './_components/Accordion';
import { db } from '@/lib/db';

export default async function Page() {
  const notes = await db.note.findMany();
  return (
    <Accordion>
      {/* rendered on the server, handed to the client component as a slot */}
      <ul>
        {notes.map((n) => (
          <li key={n.id}>{n.body}</li>
        ))}
      </ul>
    </Accordion>
  );
}
\`\`\`

The \`<ul>\` never enters the client bundle. \`Accordion\` receives it as an opaque, already-rendered node and only decides *whether* to place it. This "server content in a client shell" pattern covers modals, tabs, drawers, carousels and theme providers.

One caveat worth knowing: \`{open && children}\` still streams the children down even while closed. The payload is sent; the client just does not mount it. If the hidden content is genuinely expensive to produce, gate it on the server instead.

## Practical guardrails

- Put \`import 'server-only'\` at the top of any module that must never reach the browser. Importing it from a client file then becomes a **build error** instead of a leaked API key.
- The mirror image is \`import 'client-only'\` for modules that touch \`window\`.
- Environment variables without the \`NEXT_PUBLIC_\` prefix are unavailable in client code. That is a feature. Do not "fix" it by prefixing your secrets.
- Context providers must be Client Components. Wrap them in a tiny \`'use client'\` \`Providers\` component and render it inside the server root layout — the layout itself stays a Server Component:

\`\`\`tsx
// app/providers.tsx
'use client';
export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

// app/layout.tsx — still a Server Component
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
\`\`\``,
    },
    {
      slug: 'rendering-strategies-and-primitives',
      title: 'Four Rendering Strategies, Metadata & the Built-in Primitives',
      estimatedMinutes: 80,
      body: `# Four Rendering Strategies, Metadata & the Built-in Primitives

## The four strategies

The App Router has no \`getStaticProps\`-style switch. **The strategy is inferred from what your code does.**

**1. Static — the default.** If a route uses no request-specific data, it is rendered once at build time and served from the CDN. Zero server work per request.

**2. Dynamic.** Reading \`cookies()\`, \`headers()\` or \`searchParams\`, or fetching with \`cache: 'no-store'\`, makes the route dynamic: it renders on every request. You can also force it:

\`\`\`tsx
export const dynamic = 'force-dynamic'; // or 'force-static'
export const revalidate = 0;
\`\`\`

**3. ISR — Incremental Static Regeneration.** Static, but with an expiry. The first request after the window serves the stale page and triggers a background rebuild.

\`\`\`tsx
export const revalidate = 3600; // the whole route, once an hour

// or per fetch:
const res = await fetch('https://api.example.com/prices', { next: { revalidate: 60 } });
\`\`\`

This is the strategy most content sites should default to: CDN latency, with data never more than N seconds old.

**4. Streaming.** The shell is sent immediately and slow parts arrive later, each replacing its fallback in place. \`loading.tsx\` gives you this for a whole segment; \`<Suspense>\` gives it to you per component.

\`\`\`tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';

export default function Dashboard() {
  return (
    <>
      <h1>Dashboard</h1>
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>
      <Suspense fallback={<FeedSkeleton />}>
        <Feed />
      </Suspense>
    </>
  );
}
\`\`\`

If \`Stats\` takes 800 ms and \`Feed\` takes 2 s, the heading paints at ~100 ms, stats fill in at 800 ms, and the feed at 2 s. Time-to-first-byte is decoupled from your slowest query, and the two async components fetch **in parallel** because neither awaits the other.

> Streaming only helps if the slow work is *inside* a Suspense boundary. An \`await\` in the page component itself blocks the shell — move it down into the child.

The four are not exclusive: a route is commonly static at the shell with one streamed dynamic island inside it.

## Metadata

Two forms, both exported from a \`layout.tsx\` or \`page.tsx\`. Static:

\`\`\`tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'CodeNinja', template: '%s — CodeNinja' },
  description: 'Full-stack TypeScript in 30 days.',
  openGraph: { type: 'website', images: ['/og.png'] },
};
\`\`\`

Dynamic, when the title depends on data:

\`\`\`tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug); // deduped with the page's own call
  return { title: post.title, description: post.excerpt };
}
\`\`\`

Metadata from nested layouts merges, child wins. The \`template\` turns a page's \`title: 'Day 12'\` into \`Day 12 — CodeNinja\`. The files \`opengraph-image.tsx\`, \`icon.png\`, \`sitemap.ts\` and \`robots.ts\` are picked up automatically — no \`<head>\` wrangling.

## next/link and prefetching

\`\`\`tsx
import Link from 'next/link';

<Link href="/blog/hello">Read</Link>
<Link href="/heavy" prefetch={false}>Heavy page</Link>
\`\`\`

\`<Link>\` performs a **soft navigation**: no document reload, and layouts above the changed segment stay mounted. In production it prefetches routes as they enter the viewport, so most in-app navigations are already in memory by the time they are clicked. Use a plain \`<a>\` only when you genuinely want a full page load, such as leaving for a different app.

For programmatic navigation use \`useRouter()\` from \`next/navigation\` — never \`next/router\`, which is the Pages Router and will throw.

## next/image

\`\`\`tsx
import Image from 'next/image';

<Image src="/hero.jpg" alt="Learners pairing" width={1200} height={630} priority />

<div className="relative h-64">
  <Image src={post.cover} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" />
</div>
\`\`\`

It resizes and re-encodes to AVIF/WebP on demand, emits a \`srcset\`, lazy-loads below the fold, and reserves the box so CLS stays at zero. \`priority\` on your LCP image opts out of lazy loading and adds a preload hint. \`fill\` needs a positioned parent and a \`sizes\` value — without \`sizes\` the browser assumes \`100vw\` and downloads the largest variant, which quietly undoes the whole optimisation.

Remote images need an allowlist in \`next.config.ts\`:

\`\`\`ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com' }] },
};

export default config;
\`\`\`

## next/font

\`\`\`tsx
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
\`\`\`

The font is downloaded **at build time** and self-hosted: no request to \`fonts.googleapis.com\`, no extra DNS lookup, no third-party privacy footgun. Next also generates a size-adjusted fallback, so swapping in the real font barely shifts layout.

## App Router vs Pages Router vs React Router SPA

| | App Router | Pages Router | React Router SPA |
| --- | --- | --- | --- |
| Route definition | folders + \`page.tsx\` | files in \`pages/\` | JS route objects |
| Default component | **Server** | Client | Client |
| Data fetching | \`await\` inside the component | \`getServerSideProps\` / \`getStaticProps\`, page level only | \`useEffect\` or a loader |
| Nested layouts | native, state-preserving | manual \`getLayout\` pattern | \`<Outlet />\` |
| Streaming / Suspense | native, per component | not supported | client-side only |
| Bundle cost of a page | server parts cost 0 kB | the whole page ships | the whole app ships |
| Mutations | Server Actions | API routes + fetch | fetch + manual cache update |
| SEO / first paint | HTML on the first byte | HTML on the first byte | an empty shell |
| Caching | four framework layers | \`revalidate\` in \`getStaticProps\` | your own, e.g. TanStack Query |
| Deploy target | Node or edge server | Node server | any static host |

React Router is not obsolete. It is right when there is no server, when the app sits behind a login and SEO is irrelevant, or when you are embedding a UI inside an existing backend. React Router 7 — the Remix merge — also offers a framework mode with loaders, actions and SSR, landing close to the App Router while keeping route-object config.

The genuine difference is the **default**. In an SPA everything is client-side until you work to make it otherwise; in the App Router everything is server-side until you work to make it otherwise. Most pages want the second default — but "most" is not "all", and knowing why you picked one is the actual skill.`,
    },
  ],
  quiz: [
    {
      prompt: 'In the App Router, which is true of a component whose file has no directive at the top?',
      options: [
        'It is a Server Component: it runs on the server, may be async, and ships no JavaScript to the browser',
        'It is a Client Component, because React components are always client-side',
        'It runs on both the server and the client and can use useState',
        'It only renders at build time and cannot read a database',
      ],
      correctIndex: 0,
      explanation:
        'Server Components are the default in the App Router. They may be `async`, run only on the server, and contribute nothing to the client bundle — which is exactly why they cannot use `useState`, `useEffect` or event handlers.',
      difficulty: 'EASY',
    },
    {
      prompt: "What does putting `'use client'` at the top of `app/layout.tsx` do?",
      options: [
        'Nothing — layouts are always Server Components',
        'Makes only the layout interactive while its children stay server-rendered',
        'Marks the layout and everything it transitively imports as part of the client bundle',
        'Disables server-side rendering for the whole application',
      ],
      correctIndex: 2,
      explanation:
        "`'use client'` declares a boundary, not a single component. Every module reachable by import from that file joins the client graph, so putting it on the root layout pulls the whole tree into the browser bundle. Push the directive toward the leaves.",
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which prop throws when passed from a Server Component to a Client Component?',
      options: [
        'createdAt={new Date()}',
        'formatValue={(v) => v.toFixed(2)}',
        'user={{ id: 1, name: "Ada" }}',
        'tags={["next", "react"]}',
      ],
      correctIndex: 1,
      explanation:
        'Arbitrary functions cannot be serialised across the boundary — a closure has no wire representation. Dates, plain objects and arrays serialise fine. The one function-shaped exception is a Server Action, which the runtime encodes as a reference to a server endpoint.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'You have both `app/blog/[slug]/page.tsx` and `app/blog/new/page.tsx`. What renders for `/blog/new`?',
      options: [
        'Whichever file the build happens to register first',
        'Both of them, in a parallel route slot',
        'The dynamic segment, because it was declared with a parameter',
        'app/blog/new/page.tsx — a literal segment outranks a dynamic one',
      ],
      correctIndex: 3,
      explanation:
        'Route matching is ranked by specificity: static segment > dynamic `[slug]` > catch-all `[...all]` > optional catch-all `[[...all]]`. The literal `new` folder always wins.',
      difficulty: 'EASY',
    },
    {
      prompt: 'What is the difference between `layout.tsx` and `template.tsx`?',
      options: [
        'A template can be async; a layout cannot',
        'A layout persists across navigations and keeps its state; a template is re-mounted on every navigation',
        'A template can render `<html>`; a layout cannot',
        'They are aliases — `template.tsx` is the deprecated name',
      ],
      correctIndex: 1,
      explanation:
        'Layouts are preserved across navigation, which is why a sidebar keeps its scroll position. Templates create a fresh instance per navigation, resetting state and re-running effects — useful for enter animations or per-visit logging.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'A Client Component needs to display a list loaded from the database. What is the correct App Router pattern?',
      options: [
        'Import the async Server Component directly inside the Client Component',
        'Make the Client Component async and await the database call inside it',
        'Render the list in a Server Component and pass it into the Client Component as `children` or another node prop',
        'Move the database query into a useEffect inside the Client Component',
      ],
      correctIndex: 2,
      explanation:
        'A Client Component cannot import a Server Component — the import would drag server code into the bundle. It can, however, receive already-rendered server output as a prop. That "server content in a client shell" slot pattern is how modals, tabs and accordions are built.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Which change makes an otherwise static route render on every request?',
      options: [
        'Awaiting `cookies()` inside the page',
        'Exporting `generateStaticParams`',
        'Adding a `<Suspense>` boundary',
        'Using `next/image` with a remote src',
      ],
      correctIndex: 0,
      explanation:
        'Reading request-scoped APIs — `cookies()`, `headers()`, `searchParams`, or fetching with `cache: "no-store"` — opts the route into dynamic rendering. Suspense only changes *how* the response is streamed, and `generateStaticParams` pushes a route further toward static.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What is the effect of a route group such as `app/(marketing)/about/page.tsx`?',
      options: [
        'The route becomes `/marketing/about` with a shared layout',
        'The folder is excluded from the build output entirely',
        'The route resolves to `/about`; the group exists only to scope a layout',
        'The group creates a parallel route slot named "marketing"',
      ],
      correctIndex: 2,
      explanation:
        'Parenthesised folders are stripped from the URL. They exist so two sections can have entirely different layouts without adding a path segment — with the caveat that two groups must not produce the same resolved path, or the build fails.',
      difficulty: 'EASY',
    },
  ],
  problems: [
    {
      slug: 'rsc-serialisation-checker',
      title: 'RSC Serialisation Boundary Checker',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `When a Server Component passes props to a Client Component, React has to serialise them. Some values simply cannot make the trip, and the runtime error names the prop but not always the reason.

Write \`checkProps(props)\` — a linter for that boundary. It walks the props object and reports every value that cannot cross.

**Allowed to cross**

- primitives: \`string\`, \`number\`, \`boolean\`, \`null\`, \`undefined\`
- plain objects (prototype is \`Object.prototype\` or \`null\`) — walk into them
- arrays — walk into them
- \`Date\` instances

**Cannot cross** — record a violation and do *not* walk into it:

| value | \`reason\` |
| --- | --- |
| any function | \`'function'\` |
| any symbol | \`'symbol'\` |
| any other non-plain object (a class instance, a \`Map\`, a \`RegExp\`) | \`'class-instance'\` |

**Return shape**

\`\`\`js
{ ok: boolean, violations: [{ path: string, reason: string }] }
\`\`\`

\`ok\` is \`true\` when there are no violations. Paths use dots for object keys and \`[i]\` for array indices, with no leading dot:

\`\`\`js
checkProps({ title: 'Hi', onSave: () => {} });
// { ok: false, violations: [{ path: 'onSave', reason: 'function' }] }

checkProps({ rows: [{ id: 1 }, { id: 2, render: () => {} }] });
// { ok: false, violations: [{ path: 'rows[1].render', reason: 'function' }] }
\`\`\`

Violations must appear in depth-first \`Object.keys\` order. Assume there are no circular references.`,
      starterCode: `function checkProps(props) {
  // Walk every prop. Push { path, reason } for anything that cannot be serialised.
  return { ok: true, violations: [] };
}

module.exports = { checkProps };`,
      solutionCode: `function classify(value) {
  const t = typeof value;
  if (t === 'function') return 'function';
  if (t === 'symbol') return 'symbol';
  if (value === null) return 'ok';
  if (t !== 'object') return 'ok';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'ok';
  const proto = Object.getPrototypeOf(value);
  if (proto === Object.prototype || proto === null) return 'plain';
  return 'class-instance';
}

function checkProps(props) {
  const violations = [];

  function join(base, key) {
    return base ? base + '.' + key : key;
  }

  function walk(value, path) {
    const kind = classify(value);

    if (kind === 'function' || kind === 'symbol' || kind === 'class-instance') {
      violations.push({ path: path, reason: kind });
      return;
    }

    if (kind === 'array') {
      value.forEach(function (item, i) {
        walk(item, path + '[' + i + ']');
      });
      return;
    }

    if (kind === 'plain') {
      Object.keys(value).forEach(function (key) {
        walk(value[key], join(path, key));
      });
    }
  }

  Object.keys(props || {}).forEach(function (key) {
    walk(props[key], key);
  });

  return { ok: violations.length === 0, violations: violations };
}

module.exports = { checkProps };`,
      hints: [
        'Write a classify(value) helper first — it turns a value into one of: ok, plain, array, function, symbol, class-instance.',
        'A plain object is one whose Object.getPrototypeOf is Object.prototype or null. Everything else object-shaped is a class instance.',
        'typeof null is "object", so check for null before you look at the prototype.',
        'Do not recurse into a value you have already reported. One violation per offending node.',
      ],
      tests: [
        {
          name: 'clean props pass',
          assertion:
            "deepEqual(solution.checkProps({ title: 'Hi', count: 3, live: true, note: null, missing: undefined }), { ok: true, violations: [] })",
        },
        {
          name: 'a top-level function is reported',
          assertion:
            "deepEqual(solution.checkProps({ onSave: function () {} }).violations, [{ path: 'onSave', reason: 'function' }])",
        },
        {
          name: 'ok is false when there is a violation',
          assertion: 'solution.checkProps({ onSave: function () {} }).ok === false',
        },
        {
          name: 'nested object paths use dots',
          assertion:
            "deepEqual(solution.checkProps({ user: { name: 'Ada', greet: function () {} } }).violations, [{ path: 'user.greet', reason: 'function' }])",
        },
        {
          name: 'array paths use brackets',
          assertion:
            "deepEqual(solution.checkProps({ rows: [{ id: 1 }, { id: 2, render: function () {} }] }).violations, [{ path: 'rows[1].render', reason: 'function' }])",
        },
        {
          name: 'symbols cannot cross',
          assertion:
            "deepEqual(solution.checkProps({ tag: Symbol('brand') }).violations, [{ path: 'tag', reason: 'symbol' }])",
        },
        {
          name: 'class instances cannot cross',
          assertion:
            "(function () { class Repo {} return deepEqual(solution.checkProps({ repo: new Repo() }).violations, [{ path: 'repo', reason: 'class-instance' }]); })()",
        },
        {
          name: 'Date is allowed through',
          assertion: 'solution.checkProps({ createdAt: new Date(0) }).ok === true',
        },
        {
          name: 'does not walk into a class instance',
          assertion:
            "(function () { class Row { constructor() { this.fn = function () {}; } } return solution.checkProps({ row: new Row() }).violations.length === 1; })()",
          hidden: true,
        },
        {
          name: 'reports in depth-first key order',
          assertion:
            "deepEqual(solution.checkProps({ a: function () {}, b: 1, c: Symbol('s'), d: { e: new Map() } }).violations.map(function (v) { return v.path; }), ['a', 'c', 'd.e'])",
          hidden: true,
        },
      ],
      xp: 50,
    },
    {
      slug: 'layout-chain-resolver',
      title: 'Resolve the Nested Layout Chain',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Next.js wraps a page in every \`layout\` that sits on its path *in the file tree*. Route groups are stripped from the URL but still count as folders, so \`app/(marketing)/layout.tsx\` wraps \`/about\` but not \`/cart\`.

Write \`resolveLayouts(files, pathname)\`.

- \`files\` is an array of project paths, e.g. \`'app/(marketing)/about/page.tsx'\`.
- A file is a page if its basename (extension removed) is \`page\`, and a layout if it is \`layout\`. Ignore everything else.
- A folder wrapped in parentheses is a **route group**: part of the file tree, removed from the URL.
- \`pathname\` may have a trailing slash. \`'/'\` is the root.

Return \`{ page, layouts }\` where \`page\` is the matching page's file path and \`layouts\` is every layout whose folder is an ancestor of — or equal to — the page's folder, **outermost first**.

Return \`null\` when no page matches. If two pages resolve to the same URL, which Next.js rejects at build time, **throw** an \`Error\`.

\`\`\`js
const files = [
  'app/layout.tsx',
  'app/(marketing)/layout.tsx',
  'app/(marketing)/about/page.tsx',
];

resolveLayouts(files, '/about');
// { page: 'app/(marketing)/about/page.tsx',
//   layouts: ['app/layout.tsx', 'app/(marketing)/layout.tsx'] }

resolveLayouts(files, '/nope'); // null
\`\`\``,
      starterCode: `function resolveLayouts(files, pathname) {
  // 1. split each file into folder segments + basename
  // 2. a route group segment looks like "(name)" and is dropped from the URL
  // 3. find the page whose URL === pathname
  // 4. collect every layout whose folder segments are a prefix of the page's
  return null;
}

module.exports = { resolveLayouts };`,
      solutionCode: `function basename(name) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}

function isGroup(segment) {
  return segment.length > 1 && segment[0] === '(' && segment[segment.length - 1] === ')';
}

function parse(file) {
  const parts = file.split('/');
  const name = basename(parts.pop());
  if (parts[0] === 'app') parts.shift();
  return { file: file, name: name, dir: parts };
}

function urlOf(dir) {
  return (
    '/' +
    dir
      .filter(function (s) {
        return !isGroup(s);
      })
      .join('/')
  );
}

function normalise(pathname) {
  let p = pathname || '/';
  while (p.length > 1 && p[p.length - 1] === '/') p = p.slice(0, -1);
  return p;
}

function isAncestor(dir, pageDir) {
  if (dir.length > pageDir.length) return false;
  for (let i = 0; i < dir.length; i++) {
    if (dir[i] !== pageDir[i]) return false;
  }
  return true;
}

function resolveLayouts(files, pathname) {
  const target = normalise(pathname);
  const nodes = files.map(parse);

  const pages = nodes.filter(function (n) {
    return n.name === 'page' && urlOf(n.dir) === target;
  });

  if (pages.length === 0) return null;
  if (pages.length > 1) {
    throw new Error('Duplicate route: ' + target + ' is produced by ' + pages.length + ' pages');
  }

  const page = pages[0];

  const layouts = nodes
    .filter(function (n) {
      return n.name === 'layout' && isAncestor(n.dir, page.dir);
    })
    .sort(function (a, b) {
      return a.dir.length - b.dir.length;
    })
    .map(function (n) {
      return n.file;
    });

  return { page: page.file, layouts: layouts };
}

module.exports = { resolveLayouts };`,
      hints: [
        "Strip the leading 'app' segment once, then work purely with the remaining folder segments.",
        "urlOf(dir) is just '/' + dir.filter(notAGroup).join('/') — that already produces '/' for the root.",
        'A layout applies when its folder segment array is a prefix of the page folder segment array. Compare the raw segments, groups included.',
        'Sort the matching layouts by folder depth so the root layout comes first.',
      ],
      tests: [
        {
          name: 'root page and root layout',
          assertion:
            "deepEqual(solution.resolveLayouts(['app/layout.tsx', 'app/page.tsx'], '/'), { page: 'app/page.tsx', layouts: ['app/layout.tsx'] })",
        },
        {
          name: 'a route group is stripped from the URL but still wraps the page',
          assertion:
            "deepEqual(solution.resolveLayouts(['app/layout.tsx', 'app/(marketing)/layout.tsx', 'app/(marketing)/about/page.tsx'], '/about'), { page: 'app/(marketing)/about/page.tsx', layouts: ['app/layout.tsx', 'app/(marketing)/layout.tsx'] })",
        },
        {
          name: 'a sibling group layout does not apply',
          assertion:
            "deepEqual(solution.resolveLayouts(['app/layout.tsx', 'app/(marketing)/layout.tsx', 'app/(shop)/layout.tsx', 'app/(shop)/cart/page.tsx'], '/cart').layouts, ['app/layout.tsx', 'app/(shop)/layout.tsx'])",
        },
        {
          name: 'three levels of nesting, outermost first',
          assertion:
            "deepEqual(solution.resolveLayouts(['app/layout.tsx', 'app/dashboard/layout.tsx', 'app/dashboard/settings/layout.tsx', 'app/dashboard/settings/page.tsx'], '/dashboard/settings').layouts, ['app/layout.tsx', 'app/dashboard/layout.tsx', 'app/dashboard/settings/layout.tsx'])",
        },
        {
          name: 'an unmatched path returns null',
          assertion: "solution.resolveLayouts(['app/layout.tsx', 'app/page.tsx'], '/nope') === null",
        },
        {
          name: 'a trailing slash is tolerated',
          assertion:
            "solution.resolveLayouts(['app/layout.tsx', 'app/(marketing)/about/page.tsx'], '/about/').page === 'app/(marketing)/about/page.tsx'",
        },
        {
          name: 'files that are neither page nor layout are ignored',
          assertion:
            "deepEqual(solution.resolveLayouts(['app/layout.tsx', 'app/loading.tsx', 'app/error.tsx', 'app/blog/page.tsx'], '/blog'), { page: 'app/blog/page.tsx', layouts: ['app/layout.tsx'] })",
          hidden: true,
        },
        {
          name: 'two groups resolving to the same URL throw',
          assertion:
            "throws(function () { return solution.resolveLayouts(['app/(a)/x/page.tsx', 'app/(b)/x/page.tsx'], '/x'); })",
          hidden: true,
        },
        {
          name: 'a group name is not addressable as a URL segment',
          assertion:
            "solution.resolveLayouts(['app/(marketing)/about/page.tsx'], '/marketing/about') === null",
          hidden: true,
        },
      ],
      xp: 80,
    },
    {
      slug: 'file-convention-router',
      title: 'Build the File-Convention Router',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Time to build the router itself. Two functions.

### \`buildRoutes(files)\`

Turn a list of project file paths into a route table, **sorted most specific first**.

Only \`page\` files produce routes. Skip anything else, and skip any file under a **private folder** — a segment starting with \`_\`. Route group segments \`(name)\` are removed from the URL.

Each route is \`{ file, pattern, segments }\`, where \`pattern\` is the URL pattern (\`'/'\` for the root) and \`segments\` is the parsed segment list:

| folder | \`kind\` | captures |
| --- | --- | --- |
| \`blog\` | \`'static'\` | – |
| \`[slug]\` | \`'dynamic'\` | one segment, as a string |
| \`[...slug]\` | \`'catchall'\` | one **or more** segments, as an array |
| \`[[...slug]]\` | \`'optional'\` | **zero** or more segments; the key is absent when zero |

Each parsed segment is \`{ kind, name }\`, where \`name\` is the folder text for a static segment and the param name otherwise.

Sort order: compare segment kinds position by position using \`static < dynamic < catchall < optional\`; the first difference decides. If one pattern is a prefix of the other, the **shorter** one comes first. Break remaining ties with \`localeCompare\` on the pattern.

### \`matchRoute(routes, url)\`

Return \`{ file, pattern, params }\` for the first route that matches, or \`null\`.

- Strip any \`?query\` and \`#hash\` before matching.
- \`decodeURIComponent\` every captured value.
- A catch-all or optional catch-all must be the last segment and consumes the rest of the URL.

\`\`\`js
const routes = buildRoutes(['app/page.tsx', 'app/blog/[slug]/page.tsx', 'app/blog/new/page.tsx']);
routes.map((r) => r.pattern);            // ['/', '/blog/new', '/blog/[slug]']
matchRoute(routes, '/blog/new').pattern; // '/blog/new'
matchRoute(routes, '/blog/hi').params;   // { slug: 'hi' }
matchRoute(routes, '/nope');             // null
\`\`\``,
      starterCode: `function buildRoutes(files) {
  // keep only page files, drop private folders, strip route groups,
  // parse each remaining folder into a segment, then sort by specificity
  return [];
}

function matchRoute(routes, url) {
  // walk the sorted routes and return the first that consumes the whole URL
  return null;
}

module.exports = { buildRoutes, matchRoute };`,
      solutionCode: `const RANK = { static: 0, dynamic: 1, catchall: 2, optional: 3 };

function basename(name) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}

function isGroup(s) {
  return s.length > 1 && s[0] === '(' && s[s.length - 1] === ')';
}

function parseSegment(seg) {
  if (seg.slice(0, 5) === '[[...' && seg.slice(-2) === ']]') {
    return { kind: 'optional', name: seg.slice(5, -2) };
  }
  if (seg.slice(0, 4) === '[...' && seg.slice(-1) === ']') {
    return { kind: 'catchall', name: seg.slice(4, -1) };
  }
  if (seg[0] === '[' && seg.slice(-1) === ']') {
    return { kind: 'dynamic', name: seg.slice(1, -1) };
  }
  return { kind: 'static', name: seg };
}

function compareRoutes(a, b) {
  const n = Math.min(a.segments.length, b.segments.length);
  for (let i = 0; i < n; i++) {
    const d = RANK[a.segments[i].kind] - RANK[b.segments[i].kind];
    if (d !== 0) return d;
  }
  if (a.segments.length !== b.segments.length) return a.segments.length - b.segments.length;
  return a.pattern.localeCompare(b.pattern);
}

function buildRoutes(files) {
  const routes = [];

  files.forEach(function (file) {
    const parts = file.split('/');
    const name = basename(parts.pop());
    if (name !== 'page') return;
    if (parts[0] === 'app') parts.shift();
    const isPrivate = parts.some(function (s) {
      return s[0] === '_';
    });
    if (isPrivate) return;

    const kept = parts.filter(function (s) {
      return !isGroup(s);
    });

    routes.push({
      file: file,
      pattern: '/' + kept.join('/'),
      segments: kept.map(parseSegment),
    });
  });

  routes.sort(compareRoutes);
  return routes;
}

function matchSegments(route, urlSegments) {
  const pattern = route.segments;
  const params = {};
  let i = 0;

  for (let j = 0; j < pattern.length; j++) {
    const seg = pattern[j];
    const last = j === pattern.length - 1;

    if (seg.kind === 'catchall' || seg.kind === 'optional') {
      if (!last) return null;
      const rest = urlSegments.slice(i);
      if (rest.length === 0 && seg.kind === 'catchall') return null;
      if (rest.length > 0) params[seg.name] = rest.map(decodeURIComponent);
      return params;
    }

    if (i >= urlSegments.length) return null;

    if (seg.kind === 'dynamic') {
      params[seg.name] = decodeURIComponent(urlSegments[i]);
      i++;
      continue;
    }

    if (urlSegments[i] !== seg.name) return null;
    i++;
  }

  return i === urlSegments.length ? params : null;
}

function matchRoute(routes, url) {
  const clean = String(url).split('?')[0].split('#')[0];
  const urlSegments = clean.split('/').filter(Boolean);

  for (let k = 0; k < routes.length; k++) {
    const params = matchSegments(routes[k], urlSegments);
    if (params) {
      return { file: routes[k].file, pattern: routes[k].pattern, params: params };
    }
  }
  return null;
}

module.exports = { buildRoutes, matchRoute };`,
      hints: [
        "Parse the longest bracket form first: test '[[...' before '[...' before '['.",
        "'/' + [].join('/') is already '/', so the root route needs no special case.",
        'For sorting, compare the segment kind ranks position by position; when one route runs out of segments, the shorter one wins.',
        'A catch-all only matches when it is the last segment. An optional catch-all with nothing left still matches — just leave the key off params.',
        'Split the URL with .split("/").filter(Boolean) so leading and trailing slashes disappear for free.',
      ],
      tests: [
        {
          name: 'only page files become routes',
          assertion:
            "deepEqual(solution.buildRoutes(['app/layout.tsx', 'app/page.tsx', 'app/lib/util.ts']).map(function (r) { return r.pattern; }), ['/'])",
        },
        {
          name: 'route groups are stripped from the pattern',
          assertion: "solution.buildRoutes(['app/(marketing)/about/page.tsx'])[0].pattern === '/about'",
        },
        {
          name: 'private folders are excluded',
          assertion:
            "deepEqual(solution.buildRoutes(['app/_internal/page.tsx', 'app/_lib/thing/page.tsx']), [])",
        },
        {
          name: 'segments are parsed into kind and name',
          assertion:
            "deepEqual(solution.buildRoutes(['app/blog/[slug]/page.tsx'])[0].segments, [{ kind: 'static', name: 'blog' }, { kind: 'dynamic', name: 'slug' }])",
        },
        {
          name: 'routes are sorted most specific first',
          assertion:
            "deepEqual(solution.buildRoutes('app/page.tsx app/(marketing)/about/page.tsx app/blog/page.tsx app/blog/[slug]/page.tsx app/blog/new/page.tsx app/docs/[...path]/page.tsx app/shop/[[...filters]]/page.tsx app/(shop)/cart/page.tsx'.split(' ')).map(function (r) { return r.pattern; }), ['/', '/about', '/blog', '/cart', '/blog/new', '/blog/[slug]', '/docs/[...path]', '/shop/[[...filters]]'])",
        },
        {
          name: 'a static segment beats a dynamic one',
          assertion:
            "solution.matchRoute(solution.buildRoutes('app/blog/[slug]/page.tsx app/blog/new/page.tsx'.split(' ')), '/blog/new').pattern === '/blog/new'",
        },
        {
          name: 'a dynamic segment captures a param',
          assertion:
            "deepEqual(solution.matchRoute(solution.buildRoutes(['app/blog/[slug]/page.tsx']), '/blog/hello-world').params, { slug: 'hello-world' })",
        },
        {
          name: 'the root route matches /',
          assertion:
            "deepEqual(solution.matchRoute(solution.buildRoutes(['app/page.tsx']), '/'), { file: 'app/page.tsx', pattern: '/', params: {} })",
        },
        {
          name: 'a catch-all collects the rest as an array',
          assertion:
            "deepEqual(solution.matchRoute(solution.buildRoutes(['app/docs/[...path]/page.tsx']), '/docs/a/b/c').params, { path: ['a', 'b', 'c'] })",
        },
        {
          name: 'a catch-all requires at least one segment',
          assertion:
            "solution.matchRoute(solution.buildRoutes(['app/docs/[...path]/page.tsx']), '/docs') === null",
        },
        {
          name: 'an optional catch-all matches the bare parent with no param',
          assertion:
            "deepEqual(solution.matchRoute(solution.buildRoutes(['app/shop/[[...filters]]/page.tsx']), '/shop'), { file: 'app/shop/[[...filters]]/page.tsx', pattern: '/shop/[[...filters]]', params: {} })",
        },
        {
          name: 'an optional catch-all also collects segments',
          assertion:
            "deepEqual(solution.matchRoute(solution.buildRoutes(['app/shop/[[...filters]]/page.tsx']), '/shop/red/small').params, { filters: ['red', 'small'] })",
          hidden: true,
        },
        {
          name: 'params are URL-decoded',
          assertion:
            "solution.matchRoute(solution.buildRoutes(['app/blog/[slug]/page.tsx']), '/blog/hello%20world').params.slug === 'hello world'",
          hidden: true,
        },
        {
          name: 'query strings and hashes are ignored',
          assertion:
            "solution.matchRoute(solution.buildRoutes(['app/blog/page.tsx']), '/blog?page=2#top').pattern === '/blog'",
          hidden: true,
        },
        {
          name: 'a group name is not a real URL segment',
          assertion:
            "solution.matchRoute(solution.buildRoutes(['app/(marketing)/about/page.tsx']), '/marketing/about') === null",
          hidden: true,
        },
        {
          name: 'an unmatched URL returns null',
          assertion:
            "solution.matchRoute(solution.buildRoutes(['app/page.tsx', 'app/blog/page.tsx']), '/blog/extra/deep') === null",
          hidden: true,
        },
      ],
      xp: 130,
    },
  ],
  flashcards: [
    {
      front: 'What is the default component type in the App Router?',
      back: "A Server Component. It runs only on the server, may be `async`, and ships zero JavaScript to the browser. You opt into the client with `'use client'`.",
      tags: ['nextjs', 'rsc'],
    },
    {
      front: "What does `'use client'` actually mark?",
      back: 'A boundary, not a single component. That file and everything it transitively imports joins the client bundle, so keep the directive as close to the leaves as possible.',
      tags: ['nextjs', 'rsc'],
    },
    {
      front: 'Name four things that cannot cross from a Server to a Client Component.',
      back: 'Plain functions, class instances (e.g. an ORM row), Symbols, and anything closing over server state. Serialisable: primitives, plain objects and arrays, Date, Map/Set, Promises, JSX, and Server Actions.',
      tags: ['nextjs', 'rsc', 'serialisation'],
    },
    {
      front: 'How does a Client Component render a Server Component?',
      back: 'It cannot import one. The Server Component must be rendered by a server parent and passed in as `children` or another node prop — the slot pattern behind modals, tabs and accordions.',
      tags: ['nextjs', 'rsc', 'composition'],
    },
    {
      front: '`layout.tsx` vs `template.tsx`',
      back: 'A layout persists across navigation and keeps its state and DOM. A template is re-mounted on every navigation, so state resets and effects re-run. Default to layout.',
      tags: ['nextjs', 'routing'],
    },
    {
      front: 'What does a route group `(marketing)` do?',
      back: 'It is a folder stripped from the URL. It exists to scope a layout to a section without adding a path segment. Two groups must not resolve to the same URL or the build fails.',
      tags: ['nextjs', 'routing'],
    },
    {
      front: '`[slug]` vs `[...slug]` vs `[[...slug]]`',
      back: 'Exactly one segment as a string / one or more segments as an array / zero or more segments as an array, which also matches the bare parent path.',
      tags: ['nextjs', 'routing'],
    },
    {
      front: 'What is `generateStaticParams` for?',
      back: 'It returns the param values to pre-render for a dynamic route at build time. Pair it with `export const dynamicParams = false` to 404 anything not in the list.',
      tags: ['nextjs', 'rendering'],
    },
    {
      front: 'What makes a route dynamic instead of static?',
      back: 'Awaiting `cookies()`, `headers()` or `searchParams`, fetching with `cache: "no-store"`, or exporting `dynamic = "force-dynamic"`. Otherwise Next renders it once at build time.',
      tags: ['nextjs', 'rendering'],
    },
    {
      front: 'What does a `<Suspense>` boundary change about a Server Component render?',
      back: 'The shell streams immediately and the boundary fills in when its async child resolves, so TTFB stops depending on your slowest query — but only for work placed *inside* the boundary.',
      tags: ['nextjs', 'streaming'],
    },
    {
      front: 'Which request APIs became async in Next 15?',
      back: '`params`, `searchParams`, `cookies()`, `headers()` and `draftMode()` all return Promises and must be awaited.',
      tags: ['nextjs', 'next15'],
    },
    {
      front: 'Why use `next/font` instead of a Google Fonts `<link>`?',
      back: 'The font is fetched at build time and self-hosted: no third-party request, no extra DNS/TLS handshake, no privacy leak, plus a size-adjusted fallback that minimises layout shift.',
      tags: ['nextjs', 'performance'],
    },
  ],
  resources: [
    {
      label: 'Next.js — Routing fundamentals (App Router)',
      url: 'https://nextjs.org/docs/app/building-your-application/routing',
      kind: 'DOCS',
    },
    {
      label: 'Next.js — Server and Client Components',
      url: 'https://nextjs.org/docs/app/getting-started/server-and-client-components',
      kind: 'DOCS',
    },
    {
      label: 'React — Server Components reference',
      url: 'https://react.dev/reference/rsc/server-components',
      kind: 'DOCS',
    },
    {
      label: 'Next.js — File-system conventions',
      url: 'https://nextjs.org/docs/app/api-reference/file-conventions',
      kind: 'DOCS',
    },
    { label: 'Next.js 15 release notes', url: 'https://nextjs.org/blog/next-15', kind: 'ARTICLE' },
  ],
};

export default day;
