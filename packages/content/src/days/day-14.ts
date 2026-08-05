import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 14,
  week: 2,
  pillar: 'FRONTEND',
  title: 'Project 2 — Full-Stack Next.js App',
  summary: 'Ship a real full-stack Next.js app: Server Components for reads, Server Actions for writes, and a deploy URL.',
  estimatedMinutes: 360,
  objectives: [
    'Lay out an App Router codebase that still makes sense at forty routes',
    'Decide for every piece of state whether it belongs in the URL, on the server, or in a client store',
    'Validate one Zod schema on the client and on the server without duplicating it',
    'Implement optimistic writes with useOptimistic and a correct rollback path',
    'Test components with Vitest and flows with Playwright, mocking only at the network boundary',
    'Read the `next build` output and fix whatever the First Load JS column is telling you',
    'Deploy to Vercel with working loading states, error boundaries and dark mode',
  ],
  technologies: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Zustand', 'Zod'],
  lessons: [
    {
      slug: 'architecting-a-nextjs-app',
      title: 'Architecting a Next.js App',
      estimatedMinutes: 55,
      body: `# Architecting a Next.js App

The App Router makes one architectural decision for you — the URL is the folder tree — and leaves every other one open. That freedom is why two Next.js codebases of the same size can look nothing alike, and why the second one is usually the one nobody wants to touch.

## \`app/\` is routing, not your application

The single most useful rule: **\`app/\` holds routing artefacts and composition. Everything else lives outside it.**

\`\`\`
src/
  app/
    (marketing)/            # route group: no URL segment
      layout.tsx
      page.tsx              # /
      pricing/page.tsx      # /pricing
    (app)/
      layout.tsx            # authed shell: sidebar, nav
      bookmarks/
        page.tsx            # /bookmarks
        loading.tsx
        error.tsx
        [id]/page.tsx       # /bookmarks/42
        _components/        # private folder: never a route
          BookmarkRow.tsx
    api/
      revalidate/route.ts
    layout.tsx              # root layout: <html>, fonts, providers
    global-error.tsx
  features/
    bookmarks/
      schema.ts             # Zod schemas, shared client + server
      queries.ts            # 'server-only' reads
      actions.ts            # 'use server' writes
      types.ts
  lib/
    db.ts
    session.ts
  components/ui/            # dumb, app-agnostic
\`\`\`

Only a handful of filenames in \`app/\` are special: \`layout\`, \`page\`, \`loading\`, \`error\`, \`not-found\`, \`route\`, \`template\` and \`default\`. Anything else you put there is inert — which is exactly why **colocation works**. A folder prefixed with \`_\` is *private*: \`_components\` will never become \`/bookmarks/_components\`, no matter what you put in it.

## Route groups are the tool people forget

\`(name)\` folders group routes without adding a URL segment. Two things they buy you:

1. **Different shells for different sections.** \`(marketing)/layout.tsx\` gets the landing-page header; \`(app)/layout.tsx\` gets the authenticated sidebar. Navigating between the two groups remounts the shell, which is what you want.
2. **A place to hang segment config.** \`export const dynamic = 'force-dynamic'\` in \`(app)/layout.tsx\` applies to every route beneath it.

> Two \`page.tsx\` files that resolve to the same URL — \`(a)/about/page.tsx\` and \`(b)/about/page.tsx\` — is a build error. Route groups hide the folder from the URL, they do not namespace it.

## Where server code lives, and how you keep it there

Every component under \`app/\` is a **Server Component** until a file in its import chain says \`'use client'\`. That directive is not a per-component switch — it is a **boundary**. The file it appears in, and everything that file imports, is compiled into the client bundle.

\`\`\`ts
// features/bookmarks/queries.ts
import 'server-only';
import { db } from '@/lib/db';

export async function listBookmarks(userId: string) {
  return db.bookmark.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}
\`\`\`

\`import 'server-only'\` is a two-line package whose only job is to **fail the build** if the module ends up in a client bundle. It is the cheapest insurance you will ever buy: without it, a stray \`import { listBookmarks }\` in a \`'use client'\` file ships your database client — and possibly a connection string — to the browser. \`client-only\` is the mirror image, for modules that touch \`window\` or \`localStorage\`.

\`\`\`bash
npm i server-only client-only
\`\`\`

## Push the client boundary down, not up

The instinct is to mark a page \`'use client'\` because one button needs \`onClick\`. Do the opposite: keep the page on the server and make the *button* the client component.

\`\`\`tsx
// app/(app)/bookmarks/page.tsx — Server Component
import { listBookmarks } from '@/features/bookmarks/queries';
import { CopyLinkButton } from './_components/CopyLinkButton'; // 'use client'

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;          // Next 15: params & searchParams are Promises
  const bookmarks = await listBookmarks(q);

  return (
    <ul>
      {bookmarks.map((b) => (
        <li key={b.id}>
          <a href={b.url}>{b.title}</a>
          <CopyLinkButton url={b.url} />
        </li>
      ))}
    </ul>
  );
}
\`\`\`

Server Components can render client components and pass them props. Client components **cannot import** a Server Component — but they can render one passed as \`children\`. That is the escape hatch for "I need a client provider around server-rendered content":

\`\`\`tsx
// app/layout.tsx (server)
<ThemeProvider>            {/* 'use client' */}
  <Dashboard />            {/* still a Server Component */}
</ThemeProvider>
\`\`\`

Props crossing the boundary must be **serialisable**. Functions, class instances and a \`Date\` buried in a \`Map\` do not survive; the exception is a Server Action, which serialises to a reference the client is allowed to call.

## Dependency direction

The same rule as any layered codebase, adapted:

| Layer | May import |
| --- | --- |
| \`components/ui\` | nothing app-specific |
| \`features/x\` | \`lib\`, \`components/ui\`, its own folder |
| \`app/**\` | \`features\`, \`lib\`, \`components/ui\` |
| \`lib\` | nothing but \`lib\` |

Nothing in \`features/\` imports from \`app/\`. If it needs a route path, it takes it as an argument. That is what lets you move a page between route groups without a refactor. Enforce it with \`eslint-plugin-boundaries\` rather than good intentions — a cross-layer import is a five-second mistake and a two-hour untangle.

## The schema is the seam

One Zod schema, imported by the client form and by the Server Action, is the highest-leverage file in the project:

\`\`\`ts
// features/bookmarks/schema.ts
import { z } from 'zod';

export const bookmarkInput = z.object({
  url: z.string().url('Must be a valid URL'),
  title: z.string().min(1, 'Title is required').max(120),
  tags: z.array(z.string().min(1)).max(5).default([]),
});

export type BookmarkInput = z.infer<typeof bookmarkInput>;
\`\`\`

The client uses it through \`zodResolver\` for instant feedback. The Server Action re-parses it because **client validation is a UX feature, not a security boundary** — anyone can POST to a Server Action endpoint directly with curl. Same file, two calls, zero drift, and \`z.infer\` means the type follows the validation instead of being maintained beside it.

## What good looks like

Hand the repo to another developer. They should be able to answer, from the tree alone: which routes exist, which shell each one renders in, where a new feature's data access goes, and which files can never reach the browser. If \`server-only\` appears in every query module and \`app/\` contains no business logic, you are there.`,
    },
    {
      slug: 'state-strategy-app-router',
      title: 'Choosing Your State Strategy in an App Router World',
      estimatedMinutes: 55,
      body: `# Choosing Your State Strategy in an App Router World

In a client-only SPA, "state management" means "which store library". In the App Router, most of what you used to put in a store is not client state at all.

## The four buckets, re-sorted

| Kind | Example | Lives in |
| --- | --- | --- |
| **Server data** | the bookmark list, the current user's profile | fetched in a Server Component, cached by Next |
| **URL / navigation** | search text, active tag filter, sort, page | \`searchParams\` |
| **Transient UI** | is the modal open, is this row hovered | \`useState\` in the nearest client component |
| **Persistent client UI** | sidebar collapsed, theme, table density, draft text | a small Zustand store |

Note what fell off the list: there is no "server cache" bucket that you own. A Server Component that \`await\`s a query *is* the read path — no loading flag, no \`useEffect\`, no store slice, no client-side waterfall. The data arrives with the HTML.

## The URL is your best store

Filters, search, sort and pagination belong in the query string, and in the App Router this is not merely "nice for sharing" — changing \`searchParams\` is **how you re-run the server query**.

\`\`\`tsx
'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export function FilterBar() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');                       // any filter change resets paging
    startTransition(() => {
      router.replace(pathname + '?' + next.toString(), { scroll: false });
    });
  }

  return (
    <input
      type="search"
      defaultValue={params.get('q') ?? ''}
      onChange={(e) => setParam('q', e.target.value || null)}
      aria-label="Search bookmarks"
      data-pending={isPending}
    />
  );
}
\`\`\`

Three details separate a good implementation from a janky one. **\`useTransition\`** keeps the old list on screen while the new one streams in, and \`isPending\` *is* your loading state. **\`router.replace\`** rather than \`push\` means Back leaves the page instead of walking through twelve keystrokes. **\`{ scroll: false }\`** stops the viewport jumping to the top on every change.

Debounce the *input*, not the navigation. And note that \`useSearchParams()\` in an otherwise static route forces client rendering unless it sits inside \`<Suspense>\`.

## The shrinking client store

Zustand is still worth having, but the list of things it holds is now short. Ask one question: **would a hard refresh of the same URL reproduce this value?** If yes, it belongs on the server or in the URL.

\`\`\`ts
// features/ui/uiStore.ts
'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UiState = {
  sidebarOpen: boolean;
  density: 'comfortable' | 'compact';
  toggleSidebar: () => void;
};

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      density: 'comfortable',
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    { name: 'ui' },
  ),
);
\`\`\`

Two rules carry over unchanged: **always select a slice** (\`useUi((s) => s.density)\`, never \`useUi()\`), and never return a freshly built array or object from a selector — the default equality check is \`Object.is\`, so a new allocation re-renders every time. Use \`useShallow\` when you need several fields.

> **The hydration trap.** \`persist\` reads \`localStorage\`, which does not exist during SSR: the server renders the default, the client renders the stored value, and React logs a hydration mismatch. Gate on a mounted flag — \`const [hydrated, setHydrated] = useState(false)\` plus \`useEffect(() => setHydrated(true), [])\` — and render the default until it flips. For theme specifically, do what \`next-themes\` does: a tiny blocking inline script sets \`class="dark"\` on \`<html>\` before first paint, so there is nothing to mismatch and no flash.

## Writes: Server Actions and \`useActionState\`

Mutations do not need a store either. A Server Action is an async function that runs on the server and can be handed straight to a form's \`action\`.

\`\`\`ts
// features/bookmarks/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { bookmarkInput } from './schema';

export async function createBookmark(_prev: unknown, formData: FormData) {
  const parsed = bookmarkInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const session = await requireSession();          // authorise inside the action
  await db.bookmark.create({ data: { ...parsed.data, userId: session.userId } });

  revalidatePath('/bookmarks');
  return { errors: {} };
}
\`\`\`

\`\`\`tsx
'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

export function NewBookmarkForm() {
  const [state, formAction] = useActionState(createBookmark, { errors: {} });
  return (
    <form action={formAction}>
      <label htmlFor="url">URL</label>
      <input id="url" name="url" aria-describedby="url-error" />
      <p id="url-error" role="alert">{state.errors.url?.[0]}</p>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();           // must be inside the <form>
  return <button disabled={pending}>{pending ? 'Saving...' : 'Save'}</button>;
}
\`\`\`

\`useActionState\` (React 19; it was \`useFormState\` in 18) gives you the action's return value plus a pending flag. \`useFormStatus\` reads the *nearest ancestor form*, which is why \`SubmitButton\` has to be its own component rather than inline JSX. A form wired this way is also progressively enhanced: \`action\` is a real form action, so it works before any JavaScript has loaded.

## Optimistic UI, correctly

\`useOptimistic\` shows the change instantly and — this is the part people miss — **rolls back automatically** when the transition settles and the real state comes back different.

\`\`\`tsx
'use client';
import { useOptimistic } from 'react';

export function BookmarkList({ items }: { items: Bookmark[] }) {
  const [optimistic, addOptimistic] = useOptimistic(
    items,
    (state: Bookmark[], removedId: string) => state.filter((b) => b.id !== removedId),
  );

  return optimistic.map((b) => (
    <form
      key={b.id}
      action={async (fd) => {
        addOptimistic(b.id);                      // instant
        await deleteBookmark(fd);                 // Server Action revalidates
      }}
    >
      <input type="hidden" name="id" value={b.id} />
      <button>Delete</button>
    </form>
  ));
}
\`\`\`

There is no manual rollback because there is no second copy of the truth: the optimistic value is a *projection* over the server value, discarded the moment the transition finishes. If the delete fails, the revalidated list still contains the row and it simply reappears. Show the failure with a toast; do not "undo" by re-adding it, because a concurrent mutation makes that wrong.

The one thing you must get right: \`addOptimistic\` has to be called **inside** the action or transition, never just before it. Called outside, React has no transition to attach the optimistic state to and drops it on the next render — which looks exactly like "my optimistic update does nothing". Under the hood this is a queue: a confirmed base plus the pending mutations replayed over it, which is today's hardest problem.`,
    },
    {
      slug: 'testing-a-nextjs-app',
      title: 'Testing a Next.js App',
      estimatedMinutes: 55,
      body: `# Testing a Next.js App

A Next.js app contains three kinds of code with three different testing stories, and conflating them is why so many teams end up with a slow suite that catches nothing.

| Code | Test with | Why |
| --- | --- | --- |
| Pure logic — schemas, serialisers, permission checks | Vitest, no DOM | Fast, exhaustive, zero setup |
| Client components | Vitest + Testing Library | Behaviour a user can perceive |
| Server Components, Server Actions, middleware, routing | Playwright | Needs a real Next runtime |

## Vitest setup that actually works with Next

\`\`\`bash
npm i -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \\
  @testing-library/react @testing-library/user-event @testing-library/jest-dom
\`\`\`

\`\`\`ts
// vitest.config.mts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],   // Playwright owns e2e/
  },
});
\`\`\`

\`\`\`ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

// next/navigation has no router outside a Next render tree.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/bookmarks',
  useSearchParams: () => new URLSearchParams('q=react'),
  redirect: vi.fn(),
}));
\`\`\`

\`vite-tsconfig-paths\` is what makes \`@/\` imports resolve. Without it every test fails on its first import, and the error reads like a missing dependency rather than a misconfiguration.

> **Async Server Components are not unit-testable today.** \`render(await Page())\` sometimes works and sometimes explodes, and Vitest has no RSC renderer. Do not fight it. Extract the data function, unit-test *that*, and cover the rendered page in Playwright.

## Test the seams, not the framework

The high-value unit tests in a Next.js app are almost never components:

\`\`\`ts
import { bookmarkInput } from '@/features/bookmarks/schema';

test('rejects a non-URL', () => {
  const r = bookmarkInput.safeParse({ url: 'nope', title: 'x' });
  expect(r.success).toBe(false);
  expect(r.error!.flatten().fieldErrors.url?.[0]).toMatch(/valid URL/i);
});

test('defaults tags to an empty array', () => {
  expect(bookmarkInput.parse({ url: 'https://a.dev', title: 'x' }).tags).toEqual([]);
});
\`\`\`

Your searchParams parser, your permission resolver and your Zod schemas sit on the boundary between HTTP and your domain. That is where the bugs are, and they cost nothing to test.

## Client component tests

The same Testing Library discipline as always: query by role, interact with \`userEvent\`, assert on what a user would see.

\`\`\`tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('typing narrows the visible list', async () => {
  const user = userEvent.setup();
  render(<BookmarkList items={[bm('Zustand docs'), bm('Prisma docs')]} />);

  await user.type(screen.getByRole('searchbox', { name: /search/i }), 'zus');

  expect(screen.getByRole('link', { name: /zustand docs/i })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /prisma docs/i })).not.toBeInTheDocument();
});
\`\`\`

\`getBy*\` throws when missing, \`queryBy*\` returns \`null\` (the only way to assert absence), \`findBy*\` retries (the only correct choice for anything async). Every \`userEvent\` call is async — a missing \`await\` is the number one source of tests that pass locally and flake in CI.

A component that invokes a Server Action should take it as a prop; in a unit test, pass a \`vi.fn()\` and assert on the FormData it received:

\`\`\`tsx
const action = vi.fn();
render(<NewBookmarkForm action={action} />);
await user.type(screen.getByLabelText(/url/i), 'https://a.dev');
await user.click(screen.getByRole('button', { name: /save/i }));
expect(action.mock.calls[0][0].get('url')).toBe('https://a.dev');
\`\`\`

## Playwright for the flows that matter

Everything the App Router does that a jsdom render cannot see — streaming, \`loading.tsx\`, \`error.tsx\`, redirects, cookies, Server Actions round-tripping — needs a browser against a real build.

\`\`\`ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
\`\`\`

Run against \`next build && next start\`, not \`next dev\`. Dev mode compiles on demand, disables some caching and has completely different timing; a suite that only passes in dev is testing a build you never ship.

\`\`\`ts
import { test, expect } from '@playwright/test';

test('create -> appears -> filter -> delete', async ({ page }) => {
  await page.goto('/bookmarks');

  await page.getByRole('link', { name: 'New bookmark' }).click();
  await page.getByLabel('URL').fill('https://nextjs.org');
  await page.getByLabel('Title').fill('Next.js docs');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('link', { name: 'Next.js docs' })).toBeVisible();

  await page.getByRole('searchbox').fill('next');
  await expect(page).toHaveURL(/q=next/);                 // the URL is the state

  await page.getByRole('button', { name: /delete/i }).first().click();
  await expect(page.getByRole('link', { name: 'Next.js docs' })).toHaveCount(0);
});
\`\`\`

Four or five specs like this are worth more than two hundred shallow component tests. Pick the flows whose breakage would wake you up: sign in, the primary create path, the primary destructive path, and one error path.

Authentication is the one thing worth automating up front — log in through the UI once, save the storage state, reuse it everywhere:

\`\`\`ts
// e2e/auth.setup.ts
await page.goto('/login');
await page.getByLabel('Email').fill('demo@example.com');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.context().storageState({ path: 'e2e/.auth/user.json' });
\`\`\`

## What is worth mocking

| Thing | Mock it? |
| --- | --- |
| Third-party HTTP APIs | **Yes** — MSW in unit tests, \`page.route\` in Playwright |
| \`next/navigation\` in unit tests | **Yes** — there is no router to provide |
| Time, randomness, \`crypto.randomUUID\` | **Yes** — \`vi.useFakeTimers()\`, seeded ids |
| Your own \`queries.ts\` / \`actions.ts\` | **No** — that is the code under test |
| Your database in end-to-end runs | **No** — run a real one, seed and truncate per spec |
| React or Next internals | **Never** |

Mocking your own modules is the anti-pattern that produces a green suite over a broken app: you assert that a function you wrote calls another function you wrote, and the mapping between them — the only part likely to be wrong — is never executed.

For the database in end-to-end runs, use a throwaway Postgres (a Docker container, or a branch on a hosted provider) with a global setup that truncates and seeds. Deterministic data beats clever mocking every time, and it is the only way to test that a Server Action actually wrote something.

## A realistic target for this project

- Zod schemas and pure helpers: near-total coverage, they are free.
- Client components: the happy path plus one error path each for the three or four that carry real logic.
- Playwright: one authenticated create/filter/delete flow, one unauthenticated redirect check.

That suite runs in under a minute and fails for real reasons. Anything larger tends to fail for fake ones.`,
    },
    {
      slug: 'nextjs-performance-and-build-output',
      title: 'Performance: Bundles, Vitals and Reading `next build`',
      estimatedMinutes: 50,
      body: `# Performance: Bundles, Vitals and Reading \`next build\`

Next.js prints a performance report on every build and almost nobody reads it. Start there — it is free, it is accurate, and it points straight at the route that is going to be slow.

## Reading the build output

\`\`\`
Route (app)                              Size     First Load JS
- /                                      1.2 kB          96.4 kB    (Static)
- /pricing                               184 B           95.4 kB    (Static)
- /bookmarks                             4.8 kB           142 kB    (Dynamic)
- /blog/[slug]                           1.1 kB          96.3 kB    (SSG)
- /api/revalidate                        0 B                0 B     (Dynamic)
+ First Load JS shared by all            95.2 kB
  - chunks/framework-8f2a.js             45.1 kB
  - chunks/main-app-1c4d.js              31.0 kB
  - other shared chunks (total)          19.1 kB
\`\`\`

Next marks each route with a symbol: a circle for **Static** (prerendered at build time), a filled circle for **SSG** (prerendered with generated params), and an *f* for **Dynamic** (rendered per request). Three columns, three different questions:

- **Size** — JavaScript unique to that route. Rarely the problem.
- **First Load JS** — everything the browser must download and execute before the page is interactive. **This is the number.** Under about 130 kB is comfortable; over 200 kB and mobile users feel it.
- **Shared by all** — the floor under every route. If this grows, every page got slower. A shared chunk creeping past 110 kB almost always means something large leaked into the root layout.

The symbols matter as much as the numbers. A route you *expected* to be static showing up as Dynamic means something opted it out — usually \`cookies()\`, \`headers()\`, \`searchParams\`, or a \`fetch\` with \`cache: 'no-store'\`. In Next 15, \`fetch\` is **uncached by default**, so this bites more often than it used to. Opt back in explicitly:

\`\`\`ts
const res = await fetch(url, { next: { revalidate: 3600, tags: ['bookmarks'] } });
\`\`\`

## Bundle analysis

\`\`\`bash
npm i -D @next/bundle-analyzer
\`\`\`

\`\`\`ts
// next.config.ts
import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const nextConfig: NextConfig = {
  experimental: { optimizePackageImports: ['lucide-react', 'date-fns'] },
};

export default withAnalyzer(nextConfig);
\`\`\`

\`\`\`bash
ANALYZE=true npm run build
\`\`\`

Read the **client** treemap, and read gzip sizes rather than raw. The offenders repeat across every project:

| Offender | Fix |
| --- | --- |
| \`moment\` with all locales (~70 kB gz) | \`date-fns\` or \`Intl.DateTimeFormat\` |
| \`import { Icon } from 'some-icon-pack'\` | \`optimizePackageImports\`, or import the single icon path |
| A markdown, chart or editor library on a rarely-visited route | \`next/dynamic\` |
| A provider in the root layout that drags in a whole SDK | move it into the layout of the group that needs it |
| A \`'use client'\` file importing a server util that pulls in the ORM | \`server-only\` would have caught this at build time |

## Dynamic imports

\`next/dynamic\` splits a component out of its parent's chunk:

\`\`\`tsx
import dynamic from 'next/dynamic';

const RichEditor = dynamic(() => import('./RichEditor'), {
  loading: () => <EditorSkeleton />,
});

// Browser-only libraries (charts reading window, map SDKs) must skip SSR.
// ssr: false is only allowed inside a Client Component.
const Map = dynamic(() => import('./Map'), { ssr: false });
\`\`\`

Split on **routes first** — the App Router already does this for you — then on heavy-but-conditional components: modals, editors, charts, anything behind a tab. Do not split a 3 kB component; you trade 3 kB for a network round trip.

## Streaming boundaries

\`loading.tsx\` wraps the segment in a \`<Suspense>\` boundary automatically: the shell ships immediately and the slow part streams in. That converts a 900 ms blank screen into a 100 ms skeleton.

\`\`\`tsx
// app/(app)/bookmarks/loading.tsx
export default function Loading() {
  return <BookmarkListSkeleton rows={8} />;
}
\`\`\`

For finer control, put \`<Suspense>\` around the *slow child* instead of the whole page, so fast content is not held hostage by one aggregate query:

\`\`\`tsx
export default function Page() {
  return (
    <>
      <Header />                              {/* instant */}
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />                             {/* 400 ms aggregate query */}
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <BookmarkList />                      {/* 80 ms */}
      </Suspense>
    </>
  );
}
\`\`\`

Two boundaries, two independent streams. Also: start both fetches before awaiting either — \`const [a, b] = await Promise.all([getA(), getB()])\` — or you have simply moved the waterfall from the client to the server.

> Skeletons must match the size of the real content. A skeleton 40 px shorter than the row it replaces is a guaranteed layout shift, and CLS is the one vital you can fail without ever noticing.

## Core Web Vitals in Next

| Vital | Good | Next-specific lever |
| --- | --- | --- |
| **LCP** | ≤ 2.5 s | \`next/image\` with \`priority\` on the LCP image; never lazy-load it |
| **CLS** | ≤ 0.1 | \`next/image\` reserves the box from \`width\`/\`height\`; \`next/font\` removes the font swap |
| **INP** | ≤ 200 ms | less client JS; \`useTransition\` around navigations |

\`\`\`tsx
import Image from 'next/image';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

<Image src="/hero.avif" alt="" width={1200} height={630} priority sizes="100vw" />;
\`\`\`

\`next/font\` self-hosts the font at build time and computes a size-adjusted fallback, which removes both the third-party request and the swap shift. One import, two vitals.

Measure real users, not just Lighthouse:

\`\`\`tsx
'use client';
import { useReportWebVitals } from 'next/web-vitals';

export function Vitals() {
  useReportWebVitals((metric) => {
    navigator.sendBeacon('/api/vitals', JSON.stringify(metric));
  });
  return null;
}
\`\`\`

Lighthouse is a lab test on one machine with one network profile. \`useReportWebVitals\` gives you the 75th percentile of people actually using the app, which is what the thresholds are graded against.

## The pre-ship pass

1. \`npm run build\` — read every unexpectedly Dynamic route and every First Load JS over 150 kB.
2. \`ANALYZE=true npm run build\` — open the client treemap and fix the top two blocks.
3. \`npm run start\`, then Lighthouse on the **mobile** preset against the production build.
4. Throttle to Slow 4G and click through the three main flows. Watch for blank screens (missing \`loading.tsx\`) and jumps (mismatched skeletons).
5. Record the before and after numbers in the README.

"I made it faster" is an opinion. "First Load JS on /bookmarks: 214 kB to 128 kB after moving the chart behind \`next/dynamic\`" is engineering. Today's second problem asks you to automate exactly this check so a regression fails CI instead of shipping.`,
    },
  ],
  quiz: [
    {
      prompt: 'What does adding `import "server-only"` to a module actually do?',
      options: [
        'It strips the module from the client bundle at build time',
        'It fails the build if the module ends up in a Client Component import chain',
        'It marks every export as a Server Action',
        'It forces the route that imports it to render dynamically',
      ],
      correctIndex: 1,
      explanation:
        'server-only is a guard, not a transform. It throws at build time when the module is pulled into a client bundle, so a stray import of your database layer from a "use client" file becomes a build error instead of a leaked connection string.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'In Next 15, what is the type of `searchParams` in a page component?',
      options: [
        'A plain object, available synchronously',
        'A URLSearchParams instance',
        'A Promise that must be awaited',
        'A ReadonlyMap provided by next/navigation',
      ],
      correctIndex: 2,
      explanation:
        'Next 15 made params, searchParams, cookies(), headers() and draftMode() asynchronous so rendering can start before request data is needed. You await them inside the Server Component.',
      difficulty: 'EASY',
    },
    {
      prompt: 'A page needs one button with an onClick handler. What is the correct boundary?',
      options: [
        'Add "use client" to the page so the handler works',
        'Keep the page a Server Component and extract the button into its own "use client" component',
        'Add "use client" to the root layout so it applies everywhere',
        'Use a Server Action instead — onClick is not supported in Next.js',
      ],
      correctIndex: 1,
      explanation:
        '"use client" is a boundary, not a per-component switch: the file and its entire import graph go into the client bundle. Pushing the boundary down to the smallest interactive leaf keeps the data-fetching page on the server.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Where should the active search term, tag filter and page number live in this project?',
      options: [
        'In searchParams, so the Server Component re-queries and the view is shareable',
        'In a Zustand store persisted to localStorage',
        'In React context provided by the root layout',
        'In useState in the page, lifted to the nearest common parent',
      ],
      correctIndex: 0,
      explanation:
        'Filters are navigation state. In the App Router they are also the mechanism that re-runs the server query — changing searchParams re-renders the Server Component with fresh data. A store gives you none of that, plus an unshareable URL.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Why must `addOptimistic()` from `useOptimistic` be called inside the action rather than just before it?',
      options: [
        'Because React batches state updates outside of actions',
        'Because the optimistic value only exists for the duration of a transition, so outside one it is discarded immediately',
        'Because Server Actions cannot read state set before they are invoked',
        'Because it needs the FormData argument to compute the next state',
      ],
      correctIndex: 1,
      explanation:
        'useOptimistic renders a projection over the real value for the lifetime of the surrounding transition. Outside a transition there is nothing to attach it to, so React reverts on the next render and the UI appears not to update at all.',
      difficulty: 'HARD',
    },
    {
      prompt: 'A persisted Zustand store causes a React hydration mismatch warning. Why?',
      options: [
        'Zustand stores cannot be used in the App Router',
        'The persist middleware must be wrapped in a Server Component',
        'The server renders the default value because localStorage does not exist there, while the client renders the stored value',
        'localStorage writes are asynchronous and race with hydration',
      ],
      correctIndex: 2,
      explanation:
        'SSR has no localStorage, so the server HTML contains the initial state while the first client render contains the rehydrated state. Gate on a mounted flag, or set the value with a blocking inline script before paint the way next-themes does.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which column of the `next build` output should drive your optimisation work?',
      options: [
        'Size — the JavaScript unique to that route',
        'The number of routes rendered dynamically',
        'The count of emitted chunks',
        'First Load JS — everything the browser downloads and executes before the route is interactive',
      ],
      correctIndex: 3,
      explanation:
        'Size only reports the route-specific delta. First Load JS includes the shared chunks the user must also download, which is what determines time to interactive. Watch the "shared by all" line too: growth there slows every page at once.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which of these is the WRONG thing to mock in this project’s test suite?',
      options: [
        'A third-party HTTP API, intercepted with MSW',
        '`next/navigation` in a Vitest component test',
        'Your own `features/bookmarks/queries.ts` module in an integration test',
        '`crypto.randomUUID` so generated ids are deterministic',
      ],
      correctIndex: 2,
      explanation:
        'Mocking your own data-access module removes the code most likely to be wrong from the test. Mock only at boundaries you do not own — the network, the clock, randomness, and the router that Next provides only at runtime.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'search-params-state',
      title: 'searchParams as State: Parse and Serialise',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `The list page keeps its filters in the URL. Write the two pure functions that convert between a query string and a state object, and make sure they round-trip.

State shape and defaults:

\`\`\`js
{ q: '', tags: [], sort: 'newest', page: 1 }
\`\`\`

Valid sorts are \`'newest'\`, \`'oldest'\` and \`'title'\`.

### \`toSearchParams(state)\` -> string (no leading \`?\`)

Emit keys in this exact order: \`q\`, \`tags\`, \`sort\`, \`page\`. **Omit any key that is at its default**, so a pristine state serialises to \`''\`.

- \`q\` is trimmed; omit it when empty.
- \`tags\` are trimmed, de-duplicated, encoded individually and joined with a literal \`,\`; omit when nothing is left.
- \`sort\` is omitted when it is \`'newest'\` or not one of the three valid values.
- \`page\` is omitted unless it is an integer greater than 1.
- Values are encoded with \`encodeURIComponent\` (the \`,\` between tags stays literal).

### \`parseSearchParams(input)\` -> state

- A leading \`?\` is allowed. An empty string returns the defaults.
- Split on \`&\`, then on the **first** \`=\`. Decode keys and values, and decode \`+\` as a space.
- \`q\` is trimmed. \`tags\` splits on \`,\`, trims each, drops empties and **de-duplicates** preserving order.
- \`sort\` falls back to \`'newest'\` unless it is one of the three valid values.
- \`page\` is \`Math.floor(Number(value))\`; anything not finite or below 1 becomes \`1\`.
- Unknown keys are ignored.

\`\`\`js
toSearchParams({ q: 'dark mode', tags: ['css', 'ui'], sort: 'title', page: 3 });
// 'q=dark%20mode&tags=css,ui&sort=title&page=3'

parseSearchParams('?sort=bogus&page=0');
// { q: '', tags: [], sort: 'newest', page: 1 }
\`\`\`

> Tags may not contain a comma — the comma is the separator.`,
      starterCode: `const SORTS = ['newest', 'oldest', 'title'];

function toSearchParams(state) {
  // your code here
}

function parseSearchParams(input) {
  // your code here
}

module.exports = { toSearchParams, parseSearchParams };`,
      solutionCode: `const SORTS = ['newest', 'oldest', 'title'];

function decode(raw) {
  var withSpaces = String(raw).split('+').join(' ');
  try {
    return decodeURIComponent(withSpaces);
  } catch (e) {
    return withSpaces;
  }
}

function toSearchParams(state) {
  var s = state || {};
  var parts = [];

  var q = String(s.q == null ? '' : s.q).trim();
  if (q) parts.push('q=' + encodeURIComponent(q));

  var tags = Array.isArray(s.tags) ? s.tags : [];
  var cleanTags = [];
  for (var i = 0; i < tags.length; i++) {
    var t = String(tags[i]).trim();
    if (t && cleanTags.indexOf(t) === -1) cleanTags.push(t);
  }
  if (cleanTags.length) {
    parts.push('tags=' + cleanTags.map(encodeURIComponent).join(','));
  }

  var sort = s.sort;
  if (SORTS.indexOf(sort) !== -1 && sort !== 'newest') {
    parts.push('sort=' + encodeURIComponent(sort));
  }

  var page = Math.floor(Number(s.page));
  if (isFinite(page) && page > 1) parts.push('page=' + page);

  return parts.join('&');
}

function parseSearchParams(input) {
  var state = { q: '', tags: [], sort: 'newest', page: 1 };
  var raw = String(input == null ? '' : input);
  if (raw.charAt(0) === '?') raw = raw.slice(1);
  if (!raw) return state;

  var pairs = raw.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i];
    if (!pair) continue;

    var eq = pair.indexOf('=');
    var key = decode(eq === -1 ? pair : pair.slice(0, eq));
    var value = eq === -1 ? '' : decode(pair.slice(eq + 1));

    if (key === 'q') {
      state.q = value.trim();
    } else if (key === 'tags') {
      var out = [];
      var chunks = value.split(',');
      for (var j = 0; j < chunks.length; j++) {
        var tag = chunks[j].trim();
        if (tag && out.indexOf(tag) === -1) out.push(tag);
      }
      state.tags = out;
    } else if (key === 'sort') {
      state.sort = SORTS.indexOf(value) !== -1 ? value : 'newest';
    } else if (key === 'page') {
      var n = Math.floor(Number(value));
      state.page = isFinite(n) && n >= 1 ? n : 1;
    }
  }

  return state;
}

module.exports = { toSearchParams, parseSearchParams };`,
      hints: [
        'Build an array of "key=value" strings and join with & — that keeps the key order fixed.',
        'Split each pair on the FIRST "=" only, using indexOf, so an encoded "=" inside a value survives.',
        'Replace "+" with a space before calling decodeURIComponent, and wrap the decode in try/catch.',
        'Number("") is 0 and Number("abc") is NaN — both must fall back to page 1.',
        'De-duplicate tags with indexOf while building the array, so the original order is preserved.',
      ],
      tests: [
        {
          name: 'empty input returns the defaults',
          assertion:
            "deepEqual(solution.parseSearchParams(''), { q: '', tags: [], sort: 'newest', page: 1 })",
        },
        {
          name: 'a pristine state serialises to an empty string',
          assertion: "solution.toSearchParams({ q: '', tags: [], sort: 'newest', page: 1 }) === ''",
        },
        {
          name: 'serialises every non-default key in order',
          assertion:
            "solution.toSearchParams({ q: 'dark mode', tags: ['css','ui'], sort: 'title', page: 3 }) === 'q=dark%20mode&tags=css,ui&sort=title&page=3'",
        },
        {
          name: 'parses a full query string',
          assertion:
            "deepEqual(solution.parseSearchParams('?q=dark%20mode&tags=css,ui&sort=title&page=3'), { q: 'dark mode', tags: ['css','ui'], sort: 'title', page: 3 })",
        },
        {
          name: 'invalid sort and page fall back to defaults',
          assertion:
            "deepEqual(solution.parseSearchParams('sort=bogus&page=0'), { q: '', tags: [], sort: 'newest', page: 1 })",
        },
        {
          name: 'tags are trimmed and de-duplicated',
          assertion: "deepEqual(solution.parseSearchParams('tags=a,,b,%20a%20').tags, ['a','b'])",
        },
        {
          name: 'unknown keys are ignored',
          assertion:
            "deepEqual(solution.parseSearchParams('foo=1&q=x&utm_source=twitter'), { q: 'x', tags: [], sort: 'newest', page: 1 })",
          hidden: true,
        },
        {
          name: 'a plus sign decodes to a space',
          assertion: "solution.parseSearchParams('q=dark+mode').q === 'dark mode'",
          hidden: true,
        },
        {
          name: 'round-trips a state containing reserved characters',
          assertion:
            "(function(){var s={q:'a & b',tags:['x y','z'],sort:'oldest',page:12};return deepEqual(solution.parseSearchParams(solution.toSearchParams(s)), s);})()",
          hidden: true,
        },
      ],
      xp: 40,
    },
    {
      slug: 'bundle-budget-checker',
      title: 'Bundle Budget Checker',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Wire a performance budget into CI. Given a build manifest, work out the First Load JS of every route and grade it against its budget.

\`\`\`js
{
  budgets: { default: 100000, routes: { '/dashboard': 250000 } },  // gzip bytes
  sharedChunks: ['framework', 'main'],       // downloaded on every route
  chunks: { framework: 45000, main: 25000, home: 10000 },          // id -> gzip bytes
  routes: { '/': ['home'] }                  // route -> route-specific chunk ids
}
\`\`\`

Write \`checkBudgets(manifest)\` returning:

\`\`\`js
{ ok: true, results: [ { route, firstLoadJs, budget, over, status } ] }
\`\`\`

Rules:

1. **\`firstLoadJs\`** is the sum of the sizes of the route's chunks **unioned** with \`sharedChunks\` — a chunk listed in both is counted once.
2. **\`budget\`** is \`budgets.routes[route]\` when that key is present, otherwise \`budgets.default\`.
3. **\`status\`** is \`'fail'\` when \`firstLoadJs > budget\`, \`'warn'\` when it is over 90% of the budget but not over it, and \`'pass'\` otherwise.
4. **\`over\`** is \`Math.max(0, firstLoadJs - budget)\`.
5. \`results\` is sorted by \`firstLoadJs\` **descending**, ties broken by \`route\` ascending with \`localeCompare\`.
6. \`ok\` is \`true\` only when no route has status \`'fail'\`.
7. If a route or \`sharedChunks\` references a chunk id missing from \`chunks\`, **throw an \`Error\`** — silently counting it as zero would hide a broken manifest.

\`\`\`js
checkBudgets({
  budgets: { default: 100000, routes: {} },
  sharedChunks: [], chunks: { a: 150000 }, routes: { '/heavy': ['a'] },
});
// { ok: false, results: [{ route: '/heavy', firstLoadJs: 150000, budget: 100000, over: 50000, status: 'fail' }] }
\`\`\``,
      starterCode: `function checkBudgets(manifest) {
  // your code here
}

module.exports = { checkBudgets };`,
      solutionCode: `function checkBudgets(manifest) {
  var m = manifest || {};
  var chunks = m.chunks || {};
  var shared = m.sharedChunks || [];
  var routes = m.routes || {};
  var budgets = m.budgets || {};
  var defaultBudget = budgets.default;
  var routeBudgets = budgets.routes || {};

  function sizeOf(id) {
    if (!Object.prototype.hasOwnProperty.call(chunks, id)) {
      throw new Error('Unknown chunk: ' + id);
    }
    return Number(chunks[id]) || 0;
  }

  var results = Object.keys(routes).map(function (route) {
    var ids = [];
    shared.concat(routes[route] || []).forEach(function (id) {
      if (ids.indexOf(id) === -1) ids.push(id);
    });

    var firstLoadJs = ids.reduce(function (sum, id) {
      return sum + sizeOf(id);
    }, 0);

    var budget = Object.prototype.hasOwnProperty.call(routeBudgets, route)
      ? routeBudgets[route]
      : defaultBudget;

    var status;
    if (firstLoadJs > budget) status = 'fail';
    else if (firstLoadJs > budget * 0.9) status = 'warn';
    else status = 'pass';

    return {
      route: route,
      firstLoadJs: firstLoadJs,
      budget: budget,
      over: Math.max(0, firstLoadJs - budget),
      status: status,
    };
  });

  results.sort(function (a, b) {
    if (b.firstLoadJs !== a.firstLoadJs) return b.firstLoadJs - a.firstLoadJs;
    return a.route.localeCompare(b.route);
  });

  var ok = results.every(function (r) {
    return r.status !== 'fail';
  });

  return { ok: ok, results: results };
}

module.exports = { checkBudgets };`,
      hints: [
        'Union the chunk ids first, then sum — de-duplicating after summing is too late.',
        'Use Object.prototype.hasOwnProperty.call to distinguish a missing route budget from a budget of 0.',
        'Check "fail" before "warn": a route over budget is also over 90% of it.',
        'Throw from inside the size lookup so both shared and route-specific chunks are validated.',
      ],
      tests: [
        {
          name: 'sums shared plus route chunks, de-duplicated',
          assertion:
            "(function(){var m={budgets:{default:300000,routes:{}},sharedChunks:['framework','main'],chunks:{framework:45000,main:25000,dash:60000,charts:100000},routes:{'/dashboard':['dash','charts','framework']}};return solution.checkBudgets(m).results[0].firstLoadJs === 230000;})()",
        },
        {
          name: 'uses a per-route budget override',
          assertion:
            "(function(){var m={budgets:{default:100000,routes:{'/dashboard':250000}},sharedChunks:['framework'],chunks:{framework:45000,dash:60000},routes:{'/dashboard':['dash']}};var r=solution.checkBudgets(m).results[0];return r.budget===250000&&r.status==='pass'&&r.over===0;})()",
        },
        {
          name: 'flags a route over 90% of its budget as warn',
          assertion:
            "(function(){var m={budgets:{default:100000,routes:{}},sharedChunks:[],chunks:{a:95000},routes:{'/':['a']}};var r=solution.checkBudgets(m).results[0];return r.status==='warn'&&r.over===0;})()",
        },
        {
          name: 'exactly 90% of the budget still passes',
          assertion:
            "(function(){var m={budgets:{default:100000,routes:{}},sharedChunks:[],chunks:{a:90000},routes:{'/':['a']}};return solution.checkBudgets(m).results[0].status==='pass';})()",
        },
        {
          name: 'fails and reports the overage',
          assertion:
            "(function(){var m={budgets:{default:100000,routes:{}},sharedChunks:[],chunks:{a:150000},routes:{'/heavy':['a']}};var out=solution.checkBudgets(m);return out.ok===false&&out.results[0].status==='fail'&&out.results[0].over===50000;})()",
        },
        {
          name: 'sorts by First Load JS descending',
          assertion:
            "(function(){var m={budgets:{default:500000,routes:{}},sharedChunks:['s'],chunks:{s:10000,a:5000,b:50000,c:5000},routes:{'/a':['a'],'/b':['b'],'/c':['c']}};return deepEqual(solution.checkBudgets(m).results.map(function(r){return r.route;}), ['/b','/a','/c']);})()",
        },
        {
          name: 'ok is true when every route passes or warns',
          assertion:
            "(function(){var m={budgets:{default:100000,routes:{}},sharedChunks:[],chunks:{a:95000,b:10000},routes:{'/a':['a'],'/b':['b']}};var out=solution.checkBudgets(m);return out.ok===true&&out.results[0].status==='warn';})()",
          hidden: true,
        },
        {
          name: 'throws on a chunk id missing from the manifest',
          assertion:
            "throws(function(){solution.checkBudgets({budgets:{default:1000,routes:{}},sharedChunks:[],chunks:{a:10},routes:{'/':['ghost']}});})",
          hidden: true,
        },
        {
          name: 'an empty routes map is ok with no results',
          assertion:
            "(function(){var out=solution.checkBudgets({budgets:{default:1000,routes:{}},sharedChunks:[],chunks:{},routes:{}});return out.ok===true&&deepEqual(out.results,[]);})()",
          hidden: true,
        },
      ],
      xp: 70,
    },
    {
      slug: 'optimistic-mutation-queue',
      title: 'Optimistic Mutation Queue with Rollback',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `\`useOptimistic\` works by keeping a **confirmed base** and replaying the still-pending mutations over it. Build that engine.

\`createOptimisticQueue(initialItems)\` returns an object with:

| Method | Behaviour |
| --- | --- |
| \`getItems()\` | a **fresh array**: the base with every pending mutation replayed, in enqueue order |
| \`getPending()\` | the ids of unsettled mutations, in enqueue order |
| \`getErrors()\` | messages from rejected mutations, in rejection order |
| \`enqueue(mutation)\` | applies it optimistically and returns an id — \`'m1'\`, \`'m2'\`, ... |
| \`confirm(id, serverItem)\` | commits the mutation into the base and removes it from pending |
| \`reject(id, message)\` | drops the mutation without committing, and records \`message\` |

Items look like \`{ id, title, done }\`. A mutation is one of:

\`\`\`js
{ type: 'add',    item: { id, title, done } }   // appended
{ type: 'update', id, patch: { done: true } }   // merged; unknown id is a no-op
{ type: 'remove', id }                          // filtered out; unknown id is a no-op
\`\`\`

Rules:

1. Never mutate the arrays or item objects you were given — every update produces a new object.
2. On \`confirm\`, an optional \`serverItem\` **replaces** the optimistic item for \`add\` and \`update\` mutations (this is how a temporary id becomes the real database id). It is ignored for \`remove\`.
3. Rejecting a mutation in the middle of the queue must leave the *other* pending mutations applied — that is the replay.
4. \`confirm\` or \`reject\` with an unknown or already-settled id throws an \`Error\`.

\`\`\`js
const q = createOptimisticQueue([{ id: '1', title: 'A', done: false }]);
const m = q.enqueue({ type: 'update', id: '1', patch: { done: true } });
q.getItems()[0].done;  // true — immediately
q.reject(m, 'offline');
q.getItems()[0].done;  // false — rolled back
q.getErrors();         // ['offline']
\`\`\``,
      starterCode: `function createOptimisticQueue(initialItems) {
  // your code here
}

module.exports = { createOptimisticQueue };`,
      solutionCode: `function applyMutation(items, mutation, serverItem) {
  if (!mutation) return items;

  if (mutation.type === 'add') {
    return items.concat([serverItem || mutation.item]);
  }

  if (mutation.type === 'update') {
    return items.map(function (item) {
      if (item.id !== mutation.id) return item;
      if (serverItem) return serverItem;
      return Object.assign({}, item, mutation.patch || {});
    });
  }

  if (mutation.type === 'remove') {
    return items.filter(function (item) {
      return item.id !== mutation.id;
    });
  }

  return items;
}

function createOptimisticQueue(initialItems) {
  var base = (initialItems || []).slice();
  var pending = [];
  var errors = [];
  var counter = 0;

  function take(id) {
    for (var i = 0; i < pending.length; i++) {
      if (pending[i].id === id) return pending.splice(i, 1)[0];
    }
    throw new Error('Unknown or already settled mutation: ' + id);
  }

  function derive() {
    return pending.reduce(function (items, entry) {
      return applyMutation(items, entry.mutation, null);
    }, base.slice());
  }

  return {
    getItems: derive,
    getPending: function () {
      return pending.map(function (entry) {
        return entry.id;
      });
    },
    getErrors: function () {
      return errors.slice();
    },
    enqueue: function (mutation) {
      counter += 1;
      var id = 'm' + counter;
      pending.push({ id: id, mutation: mutation });
      return id;
    },
    confirm: function (id, serverItem) {
      var entry = take(id);
      base = applyMutation(base, entry.mutation, serverItem);
      return derive();
    },
    reject: function (id, message) {
      take(id);
      errors.push(message);
      return derive();
    },
  };
}

module.exports = { createOptimisticQueue };`,
      hints: [
        'Keep two things: a confirmed base array, and an ordered list of pending { id, mutation } entries.',
        'getItems() is derived, never stored — reduce the pending list over a copy of the base.',
        'Rollback is not an inverse operation. Remove the entry from the queue and re-derive.',
        'confirm() applies the mutation to the base; reject() throws it away. Both remove it from pending.',
        'Use Object.assign({}, item, patch) so the original item object is left untouched.',
      ],
      tests: [
        {
          name: 'an added item appears immediately',
          assertion:
            "(function(){var q=solution.createOptimisticQueue([]);q.enqueue({type:'add',item:{id:'1',title:'A',done:false}});return q.getItems().length===1&&q.getItems()[0].title==='A';})()",
        },
        {
          name: 'enqueue returns sequential ids and tracks pending',
          assertion:
            "(function(){var q=solution.createOptimisticQueue([]);var a=q.enqueue({type:'add',item:{id:'1',title:'A',done:false}});var b=q.enqueue({type:'add',item:{id:'2',title:'B',done:false}});return a==='m1'&&b==='m2'&&deepEqual(q.getPending(),['m1','m2']);})()",
        },
        {
          name: 'confirm commits the change and clears pending',
          assertion:
            "(function(){var q=solution.createOptimisticQueue([]);var id=q.enqueue({type:'add',item:{id:'1',title:'A',done:false}});q.confirm(id);return q.getItems().length===1&&deepEqual(q.getPending(),[]);})()",
        },
        {
          name: 'reject rolls the change back and records the error',
          assertion:
            "(function(){var q=solution.createOptimisticQueue([{id:'1',title:'A',done:false}]);var id=q.enqueue({type:'update',id:'1',patch:{done:true}});var mid=q.getItems()[0].done===true;q.reject(id,'offline');return mid&&q.getItems()[0].done===false&&deepEqual(q.getErrors(),['offline']);})()",
        },
        {
          name: 'rejecting one mutation replays the others',
          assertion:
            "(function(){var q=solution.createOptimisticQueue([{id:'1',title:'A',done:false},{id:'2',title:'B',done:false}]);var a=q.enqueue({type:'update',id:'1',patch:{done:true}});q.enqueue({type:'update',id:'2',patch:{done:true}});q.reject(a,'boom');var items=q.getItems();return items[0].done===false&&items[1].done===true;})()",
        },
        {
          name: 'confirm can swap a temporary id for the server id',
          assertion:
            "(function(){var q=solution.createOptimisticQueue([]);var id=q.enqueue({type:'add',item:{id:'tmp-1',title:'A',done:false}});q.confirm(id,{id:'42',title:'A',done:false});return q.getItems()[0].id==='42';})()",
        },
        {
          name: 'does not mutate the items it was given',
          assertion:
            "(function(){var seed=[{id:'1',title:'A',done:false}];var q=solution.createOptimisticQueue(seed);q.enqueue({type:'update',id:'1',patch:{done:true}});q.enqueue({type:'remove',id:'1'});q.getItems();return seed.length===1&&seed[0].done===false;})()",
          hidden: true,
        },
        {
          name: 'getItems returns a fresh array each call',
          assertion:
            "(function(){var q=solution.createOptimisticQueue([{id:'1',title:'A',done:false}]);return q.getItems()!==q.getItems()&&deepEqual(q.getItems(),q.getItems());})()",
          hidden: true,
        },
        {
          name: 'settling an unknown or already-settled id throws',
          assertion:
            "(function(){var q=solution.createOptimisticQueue([]);var id=q.enqueue({type:'add',item:{id:'1',title:'A',done:false}});q.confirm(id);return throws(function(){q.confirm(id);})&&throws(function(){q.reject('nope','x');});})()",
          hidden: true,
        },
        {
          name: 'a remove of an unknown id is a no-op',
          assertion:
            "(function(){var q=solution.createOptimisticQueue([{id:'1',title:'A',done:false}]);q.enqueue({type:'remove',id:'ghost'});return q.getItems().length===1;})()",
          hidden: true,
        },
      ],
      xp: 100,
    },
  ],
  flashcards: [
    {
      front: 'What is the difference between `app/` and the rest of your source tree?',
      back: 'app/ holds routing artefacts and composition only — layout, page, loading, error, not-found, route. Business logic, queries, actions and schemas live in features/ or lib/, so pages stay thin and movable.',
      tags: ['nextjs', 'architecture'],
    },
    {
      front: 'What do route groups `(name)` and private folders `_name` do?',
      back: '(name) groups routes under a shared layout without adding a URL segment. _name marks a folder as private so it never becomes a route, which is what makes colocating components inside app/ safe.',
      tags: ['nextjs', 'app-router'],
    },
    {
      front: 'Why is `"use client"` a boundary rather than a switch?',
      back: 'The file it appears in and its entire import graph are compiled into the client bundle. Push it down to the smallest interactive leaf; a page marked "use client" drags its data layer into the browser.',
      tags: ['nextjs', 'rsc'],
    },
    {
      front: 'What are the `server-only` and `client-only` packages for?',
      back: 'Build-time guards. server-only fails the build if a module reaches a client bundle (protecting DB clients and secrets); client-only fails if a browser-API module is rendered on the server.',
      tags: ['nextjs', 'security'],
    },
    {
      front: 'How does a Client Component render a Server Component?',
      back: 'Only by receiving it as children (or any prop) from a Server Component higher up — it can never import one. Props crossing the boundary must be serialisable.',
      tags: ['nextjs', 'rsc'],
    },
    {
      front: 'Which state belongs in searchParams?',
      back: 'Search text, filters, sort and pagination. In the App Router this is not only shareable and refresh-safe: changing searchParams is what re-runs the Server Component query.',
      tags: ['nextjs', 'state'],
    },
    {
      front: 'Why wrap a filter navigation in `useTransition`?',
      back: 'The current UI stays on screen while the new server render streams in, and isPending gives you the loading signal for free instead of a spinner flash on every keystroke.',
      tags: ['nextjs', 'react'],
    },
    {
      front: 'Why does a persisted Zustand store cause a hydration mismatch?',
      back: 'localStorage does not exist during SSR, so the server renders defaults and the client renders the rehydrated value. Gate on a mounted flag, or set it with a blocking inline script before paint.',
      tags: ['zustand', 'ssr'],
    },
    {
      front: '`useActionState` vs `useFormStatus`',
      back: 'useActionState (React 19) wraps a Server Action and returns its state plus a pending flag. useFormStatus reads the nearest ancestor <form>, so it must be called from a child component, not inline.',
      tags: ['react', 'server-actions'],
    },
    {
      front: 'Why is there no manual rollback with `useOptimistic`?',
      back: 'The optimistic value is a projection over the real value for the duration of a transition. When the action settles React discards it and re-renders from the revalidated server state — which is the rollback.',
      tags: ['react', 'optimistic-ui'],
    },
    {
      front: 'Why re-validate a Zod schema inside a Server Action?',
      back: 'Client validation is UX. A Server Action is a network endpoint anyone can POST to, so the same schema must parse the input again on the server before it touches the database.',
      tags: ['zod', 'security'],
    },
    {
      front: 'Which `next build` number should you act on, and what makes a route Dynamic?',
      back: 'First Load JS — everything downloaded before a route is interactive (Size is only the route delta). A route becomes Dynamic when cookies(), headers(), searchParams or an uncached fetch opts it out of static rendering.',
      tags: ['nextjs', 'performance'],
    },
  ],
  resources: [
    {
      label: 'Next.js — Project structure and organisation',
      url: 'https://nextjs.org/docs/app/getting-started/project-structure',
      kind: 'DOCS',
    },
    {
      label: 'Next.js — Updating data with Server Actions',
      url: 'https://nextjs.org/docs/app/getting-started/updating-data',
      kind: 'DOCS',
    },
    {
      label: 'React — useOptimistic reference',
      url: 'https://react.dev/reference/react/useOptimistic',
      kind: 'DOCS',
    },
    {
      label: 'Next.js — Testing with Vitest and Playwright',
      url: 'https://nextjs.org/docs/app/guides/testing',
      kind: 'DOCS',
    },
    {
      label: 'Next.js — Package bundling and bundle analysis',
      url: 'https://nextjs.org/docs/app/guides/package-bundling',
      kind: 'DOCS',
    },
  ],
  project: {
    slug: 'fullstack-nextjs-app',
    title: 'Stash — a Full-Stack Next.js Bookmarking App',
    estimatedHours: 12,
    brief: `# Stash

Build and deploy a **full-stack Next.js application** where reads happen in Server Components, writes happen through Server Actions, and the URL holds the view state.

The reference domain is a personal **bookmarking app**: save links, tag them, search and filter them, mark favourites, delete them. Swap in a recipe box or an issue tracker if you prefer — the mechanics are identical, and the mechanics are what is being assessed.

## User stories

1. As a visitor I land on \`/\` and see my saved items rendered on the server, with a skeleton while the list streams in.
2. As a user I type in the search box and the list narrows; the URL becomes \`/?q=zustand&tag=react\` so I can bookmark my own filter.
3. As a user I add an item through a form that validates as I type and re-validates on the server, showing per-field errors that come from the same Zod schema.
4. As a user I delete an item and it disappears **instantly**; if the server rejects it the row comes back and I see a toast.
5. As a user I open an item at \`/items/:id\`, and a hard refresh on that URL works.
6. As a user I collapse the sidebar, switch to compact density and turn on dark mode — all three survive a refresh, with no flash of the wrong theme.
7. As a user, a slow query shows a skeleton rather than a blank page, and a thrown error shows a recoverable panel with a Try again button rather than a stack trace.
8. As a visitor, an unknown URL shows a styled 404 with a link home.

## Required tech

- **Next.js 15 App Router** with TypeScript in strict mode
- **Server Components** for every read; **Server Actions** for every write — no client-side fetch to your own API for CRUD
- **Zod** schema shared by the React Hook Form client form (\`zodResolver\`) and by the Server Action
- **React Hook Form** for the create/edit form, with per-field errors and a disabled busy state
- **\`useOptimistic\`** (or an equivalent optimistic pattern) on at least one mutation
- **Zustand** with \`persist\` for genuinely client-side UI state — sidebar, density, view mode
- **Tailwind CSS** with a working dark mode and no flash on first paint
- A real datastore — Postgres via Prisma or Drizzle, SQLite, or a hosted KV/Postgres. A JSON file is acceptable for local dev only.
- \`loading.tsx\` and \`error.tsx\` on at least one route segment, plus \`not-found.tsx\`
- **Vitest + Testing Library** for units, **Playwright** for one end-to-end flow
- Deployed to **Vercel** with environment variables configured

## Acceptance criteria

- Every route is reachable by direct URL entry and survives a hard refresh on the deployed site.
- Search, tag filter, sort and page live in \`searchParams\` and repopulate the controls on load.
- No secret and no database client is reachable from a Client Component — every query module imports \`server-only\`.
- Submitting the create form with JavaScript disabled still works (progressive enhancement via the form \`action\`).
- Posting invalid data directly to the Server Action is rejected by the server-side Zod parse, not only by the client.
- The optimistic delete rolls back correctly — verify it by throwing inside the action on purpose.
- No hydration mismatch warnings in the console, including for the persisted store and the theme.
- \`next build\` succeeds with no route unexpectedly rendered dynamically, and First Load JS under 150 kB on the main route.
- Lighthouse mobile on the **production** build: Performance at least 90, Accessibility 100.
- The README records the state-strategy decision, First Load JS before and after your optimisation pass, and the live URL.`,
    checklist: [
      'Next.js 15 App Router project in TypeScript strict mode, with at least one route group and one private `_components` folder',
      'Every data-access module imports `server-only`, and importing one from a Client Component fails the build',
      'All list and detail reads happen in async Server Components with awaited `params`/`searchParams` — no client fetch for CRUD',
      'Search, tag filter, sort and page are stored in searchParams and drive the server query; changing a filter resets page to 1',
      'Filter navigation is wrapped in useTransition and uses router.replace(..., { scroll: false })',
      'One Zod schema in `features/*/schema.ts` is used by zodResolver on the client and re-parsed inside the Server Action',
      'Create and edit forms surface per-field errors from the action via useActionState, with a disabled busy button using useFormStatus',
      'At least one mutation uses useOptimistic and visibly rolls back when the action throws',
      'A Zustand store with `persist` holds sidebar, density and view-mode state and produces zero hydration warnings',
      'Tailwind dark mode toggles, persists, and is applied by a blocking inline script so there is no flash of the wrong theme',
      '`loading.tsx`, `error.tsx` (with a working reset button) and `not-found.tsx` are implemented and demonstrably reachable',
      'At least six Vitest tests covering the Zod schema, the searchParams serialiser and two client components',
      'One Playwright spec covering create, filter and optimistic delete, run against `next build && next start`',
      'Deployed to Vercel with env vars set, and the README records First Load JS before/after plus a mobile Lighthouse screenshot',
    ],
    stretchGoals: [
      'Add full-text search with a debounced input and highlight the matching substring in the results',
      'Add on-demand revalidation: a Route Handler that calls revalidateTag when an external webhook fires',
      'Implement infinite scroll with an IntersectionObserver sentinel plus cursor paging, keeping the cursor in the URL',
      'Add a public read-only share link for a collection, statically generated with generateStaticParams and revalidated hourly',
      'Enable Partial Prerendering on the list route and screenshot the streamed shell in the network waterfall',
    ],
    repoStarter: 'https://github.com/vercel/next.js/tree/canary/examples/with-vitest',
  },
};

export default day;
