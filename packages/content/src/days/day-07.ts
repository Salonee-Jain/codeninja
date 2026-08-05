import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 7,
  week: 1,
  pillar: 'FRONTEND',
  title: 'Project 1 — Responsive Multi-Page Site',
  summary: 'Take everything from week one and ship a real, fast, accessible three-page site.',
  estimatedMinutes: 360,
  objectives: [
    'Turn a design into a component inventory and a token set before writing markup',
    'Build a layout that is fluid by default and only uses breakpoints where it must',
    'Set and defend a performance budget against Core Web Vitals thresholds',
    'Run an accessibility and Lighthouse audit and fix what it finds',
    'Ship a three-page site with a working contact form, mobile nav and dark mode',
  ],
  technologies: ['HTML5', 'CSS3', 'JavaScript (ES6+)', 'Tailwind CSS'],
  lessons: [
    {
      slug: 'design-to-code-workflow',
      title: 'From Design to Code Without Guessing',
      estimatedMinutes: 55,
      body: `# From Design to Code Without Guessing

The gap between "here is the Figma" and "here is the site" is where junior and senior work diverge most visibly. A junior opens the design and starts at the top left. A senior spends twenty minutes not writing code, and finishes faster.

## Step 1: inventory before implementation

Open every screen and list what actually exists. Not sections — **repeated things**.

\`\`\`
Components:  Button (primary / secondary / ghost), Card, NavBar, Footer,
             FormField (text / email / textarea), Badge, Avatar
Layouts:     PageShell, TwoColumn, CardGrid, HeroSplit
Pages:       Home, Work, Contact
\`\`\`

Two useful things fall out immediately. First, the button appears in three visual forms, not eleven — so you build one component with three variants rather than styling six buttons. Second, you find the inconsistencies now: the designer used a 12px radius on two cards and 16px on a third. Ask. It is nearly always an accident, and finding it in the audit phase costs an hour instead of five minutes.

## Step 2: extract tokens, then build

Before any component, pull the design's decisions into named values. In Tailwind that is the theme; in plain CSS, custom properties.

\`\`\`css
:root {
  /* colour — semantic names, not "blue" */
  --color-bg: #ffffff;
  --color-surface: #f8fafc;
  --color-text: #0f172a;
  --color-muted: #64748b;
  --color-brand: #4f46e5;
  --color-border: #e2e8f0;

  /* type scale — fluid, so you need fewer breakpoints */
  --step--1: clamp(0.83rem, 0.8rem + 0.15vw, 0.9rem);
  --step-0:  clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --step-1:  clamp(1.25rem, 1.1rem + 0.7vw, 1.6rem);
  --step-3:  clamp(2.2rem, 1.7rem + 2.4vw, 3.8rem);

  /* spacing — one scale, no magic numbers */
  --space-1: 0.25rem;  --space-2: 0.5rem;  --space-3: 1rem;
  --space-4: 1.5rem;   --space-5: 2.5rem;  --space-6: 4rem;

  --radius: 0.75rem;
  --shadow: 0 1px 2px rgb(15 23 42 / 0.06), 0 8px 24px rgb(15 23 42 / 0.06);
}

[data-theme='dark'] {
  --color-bg: #0b1120;
  --color-surface: #111827;
  --color-text: #e2e8f0;
  --color-muted: #94a3b8;
  --color-border: #1f2937;
}
\`\`\`

Notice the names are **semantic** (\`--color-surface\`) not literal (\`--color-slate-50\`). That is what makes dark mode a fifteen-line override instead of a rewrite: the meaning stays constant, only the value flips.

> Name colours by role, not by appearance. The day a designer makes the brand green, \`--color-brand: green\` is a one-line change and \`--color-indigo\` is a lie in 400 places.

## Step 3: build outside-in, mobile-first

Order of work that consistently goes fastest:

1. **Page shell** — header, main, footer, skip link, and the container that constrains width.
2. **One real component**, fully done: all states (default, hover, focus-visible, active, disabled), both themes, and the smallest and largest viewport.
3. **Everything else**, reusing the patterns you just established.
4. **Content** last, because real content breaks your layout and you want to know early — long German words, a name with no spaces, an empty state, twelve items instead of three.

Start at 360px wide, not 1440. It is far easier to add space than to take it away, and mobile-first CSS reads as progressive enhancement (\`min-width\` queries) rather than a series of corrections.

## Step 4: the states nobody designs

Every design shows the happy path. You have to build the other five yourself, and reviewers will look for exactly these:

| State | What it needs |
| --- | --- |
| Loading | skeleton or spinner, and an \`aria-busy\` / live region |
| Empty | a sentence and a next action, never a blank box |
| Error | what failed, and what the user can do |
| Long content | truncation or wrapping that does not overflow |
| Offline / slow | the layout must not shift when the image finally lands |
| Keyboard | a visible focus ring on every interactive element |

## Step 5: commit as you go

This is a portfolio piece. The git history is part of it.

\`\`\`bash
git switch -c feat/page-shell
git add -p
git commit -m "feat(layout): add page shell with skip link and container"
git commit -m "feat(nav): add accessible mobile navigation"
git commit -m "feat(theme): add dark mode toggle with no-flash init"
git commit -m "perf(images): serve AVIF/WebP with explicit dimensions"
git commit -m "fix(a11y): restore visible focus ring on nav links"
\`\`\`

A reviewer who can read your commits can review your thinking. One commit called "site" tells them nothing except that you do not use git seriously yet.`,
    },
    {
      slug: 'responsive-layout-strategy',
      title: 'Responsive Layout Strategy — Fewer Breakpoints, Better Layouts',
      estimatedMinutes: 60,
      body: `# Responsive Layout Strategy

Most "responsive" CSS is a pile of breakpoints patching a layout that was never fluid. Modern CSS lets you write layouts that adapt continuously, and reserve media queries for the two or three moments the structure genuinely changes.

## Fluid first, breakpoints second

\`clamp(MIN, PREFERRED, MAX)\` is the single most useful function here. It gives you a value that scales with the viewport but never escapes sane bounds.

\`\`\`css
.container {
  width: min(100% - 2rem, 72rem);  /* padding built in, no media query */
  margin-inline: auto;
}

h1 { font-size: clamp(2rem, 1.2rem + 4vw, 4rem); }

section { padding-block: clamp(3rem, 8vw, 8rem); }
\`\`\`

That \`min(100% - 2rem, 72rem)\` idiom replaces a container with three breakpoints. Read it as: take the full width minus gutters, but never exceed 72rem.

## Intrinsic grids: responsive with zero media queries

\`\`\`css
.card-grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
}
\`\`\`

This grid reflows from one column to two to four purely on available space. The \`min(18rem, 100%)\` guard is essential — without it, a 288px-wide phone gets a column wider than the screen and a horizontal scrollbar.

- \`auto-fill\` keeps empty tracks; \`auto-fit\` collapses them so items stretch. For a card grid you almost always want \`auto-fit\`.
- Because it responds to the **container**, this works identically in a sidebar and a full-width page.

The sidebar pattern, also without media queries:

\`\`\`css
.with-sidebar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}
.with-sidebar > .sidebar { flex: 1 1 16rem; }         /* ideal 16rem */
.with-sidebar > .content { flex: 999 1 30rem; }       /* takes the rest, wraps below 30rem */
\`\`\`

The huge \`flex-grow\` on the content means it wins all the free space, and the \`flex-basis\` on each item decides when they wrap onto separate lines.

## Container queries

Media queries ask about the viewport. That is the wrong question for a component that appears in three different-width slots.

\`\`\`css
.card-host { container-type: inline-size; container-name: card; }

.card { display: grid; gap: var(--space-2); }

@container card (min-width: 30rem) {
  .card { grid-template-columns: 12rem 1fr; align-items: center; }
}
\`\`\`

The card now goes horizontal when *its own box* is wide enough, whether that is because the viewport grew or because it moved out of the sidebar. This is the correct primitive for component libraries.

## When you do need a media query

Structural changes — the ones where the DOM order or the number of regions changes:

\`\`\`css
/* mobile: stacked nav in a drawer */
.nav-menu {
  position: fixed; inset: 4rem 0 0; display: grid;
  transform: translateX(100%); transition: transform 200ms ease;
}
.nav-menu[data-open='true'] { transform: none; }

/* desktop: inline nav, drawer machinery off */
@media (min-width: 48em) {
  .nav-toggle { display: none; }
  .nav-menu { position: static; transform: none; display: flex; gap: var(--space-3); }
}
\`\`\`

Use \`em\` in media queries, not \`px\`. \`em\` respects the user's browser font-size setting, so a user at 24px base gets the mobile layout at a viewport where it actually reads better.

**Pick breakpoints from your content, not from device names.** Resize until the layout looks bad; that is a breakpoint. "iPad" is not a width, it is a marketing term with nine different resolutions.

## The other axes of "responsive"

\`\`\`css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

@media (prefers-color-scheme: dark) { /* default theme when the user has no stored choice */ }
@media (prefers-contrast: more)     { :root { --color-border: #000; } }
@media print                        { nav, .no-print { display: none; } }
\`\`\`

\`prefers-reduced-motion\` is not optional politeness — for users with vestibular disorders, a parallax hero can cause actual nausea. It is two minutes of work.

## Touch targets and viewport hygiene

\`\`\`html
<meta name="viewport" content="width=device-width, initial-scale=1" />
\`\`\`

Never add \`maximum-scale=1\` or \`user-scalable=no\`. Blocking zoom is a WCAG failure and locks out anyone with low vision.

Minimum interactive target: **44×44 CSS pixels** (WCAG 2.5.5 / Apple HIG). A 16px icon in a 44px padded button is fine; a bare 16px icon is not.

\`\`\`css
.icon-btn {
  min-width: 44px; min-height: 44px;
  display: inline-grid; place-items: center;
}
\`\`\`

Finally, hunt horizontal overflow before you ship — it is the most common mobile bug and it is invisible on desktop:

\`\`\`js
// paste in the console at 360px wide
[...document.querySelectorAll('*')]
  .filter((el) => el.scrollWidth > document.documentElement.clientWidth)
  .forEach((el) => console.log(el));
\`\`\``,
    },
    {
      slug: 'performance-budget-and-web-vitals',
      title: 'Performance Budgets and Core Web Vitals',
      estimatedMinutes: 60,
      body: `# Performance Budgets and Core Web Vitals

"Make it fast" is not actionable. A **budget** is: numbers agreed before the work starts, enforced in CI, and violated only on purpose.

## The three metrics that count

| Metric | Measures | Good | Poor |
| --- | --- | --- | --- |
| **LCP** — Largest Contentful Paint | when the main content appears | ≤ 2.5s | > 4.0s |
| **INP** — Interaction to Next Paint | responsiveness to every interaction | ≤ 200ms | > 500ms |
| **CLS** — Cumulative Layout Shift | visual stability | ≤ 0.1 | > 0.25 |

Google grades the **75th percentile of real users**, not your laptop. A metric between the two thresholds is "needs improvement", and the page's overall rating is the worst of the three.

INP replaced FID in 2024. FID measured only the delay before the first handler started; INP measures the full duration from input to the next painted frame, for every interaction. It is a much harder and much more honest metric — it exposes the long tasks that make an app feel sticky.

## A starting budget

\`\`\`json
{
  "budgets": {
    "html":   { "maxKb": 15 },
    "css":    { "maxKb": 60 },
    "js":     { "maxKb": 170, "note": "compressed, above-the-fold bundle" },
    "images": { "maxKb": 400, "note": "per page, LCP image under 150kb" },
    "fonts":  { "maxKb": 100, "note": "two weights, woff2, subset" },
    "totalRequests": 50
  },
  "vitals": { "lcp": 2500, "inp": 200, "cls": 0.1 }
}
\`\`\`

The 170 KB JS figure is not arbitrary: on a median mobile device over 4G that is roughly the point where parse plus execute starts pushing interactivity past a second.

## Fixing LCP

Your LCP element is almost always the hero image or the headline. Two rules cover most of it.

\`\`\`html
<!-- 1. Never lazy-load the LCP image. Prioritise it. -->
<link rel="preload" as="image" href="/hero-1200.avif" type="image/avif" fetchpriority="high" />

<picture>
  <source type="image/avif" srcset="/hero-600.avif 600w, /hero-1200.avif 1200w" sizes="100vw" />
  <source type="image/webp" srcset="/hero-600.webp 600w, /hero-1200.webp 1200w" sizes="100vw" />
  <img src="/hero-1200.jpg" alt="Studio team reviewing a prototype"
       width="1200" height="675" fetchpriority="high" decoding="async" />
</picture>

<!-- 2. Below the fold, always lazy. -->
<img src="/case-2.jpg" alt="…" width="800" height="600" loading="lazy" decoding="async" />
\`\`\`

Then the render-blocking chain:

\`\`\`html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preload" as="font" type="font/woff2" href="/fonts/inter-var.woff2" crossorigin />
<script type="module" src="/src/main.js" defer></script>
\`\`\`

\`crossorigin\` on a font preload is mandatory — fonts are fetched in CORS mode, and without it the browser downloads the file **twice** and your preload made things worse.

## Fixing CLS

CLS is caused by content that arrives late and pushes things down. Three sources, three fixes:

\`\`\`css
/* 1. Images and video: reserve the box */
img, video { height: auto; }            /* with width/height attributes present */
.hero { aspect-ratio: 16 / 9; }

/* 2. Fonts: swap without a size jump */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-display: swap;
  size-adjust: 107%;        /* match the fallback's x-height */
  ascent-override: 90%;
}

/* 3. Injected banners: reserve space or use an overlay, never insert above content */
.cookie-bar { position: fixed; inset-block-end: 0; }
\`\`\`

\`font-display: swap\` avoids invisible text but causes a reflow when the webfont lands; \`size-adjust\` and the override descriptors are what make that swap shift-free.

## Fixing INP

INP is a main-thread problem. Anything over 50ms is a "long task" and blocks input.

\`\`\`js
// Bad: 5000 DOM writes in one task, input is dead for ~400ms
items.forEach((item) => list.append(renderRow(item)));

// Better: build off-DOM, insert once
const frag = document.createDocumentFragment();
for (const item of items) frag.append(renderRow(item));
list.append(frag);

// Better still: yield so pending input can be handled
async function processAll(items) {
  for (let i = 0; i < items.length; i++) {
    handle(items[i]);
    if (i % 50 === 0) await new Promise((r) => setTimeout(r, 0));
  }
}
\`\`\`

Also: debounce expensive handlers, keep animations on \`transform\` and \`opacity\` (compositor-only, no layout), and use \`content-visibility: auto\` on long off-screen sections to skip their rendering work entirely.

## Measuring

- **Lab**: Lighthouse in Chrome DevTools, or \`npx unlighthouse --site https://example.com\`. Deterministic, good for CI, does **not** reflect real users.
- **Field**: the \`web-vitals\` library reporting to your analytics; or CrUX data in PageSpeed Insights.

\`\`\`js
import { onLCP, onINP, onCLS } from 'web-vitals';
const send = (metric) =>
  navigator.sendBeacon('/rum', JSON.stringify({ name: metric.name, value: metric.value, id: metric.id }));
onLCP(send); onINP(send); onCLS(send);
\`\`\`

Enforce it in CI with Lighthouse CI so a regression fails the PR instead of being discovered a month later:

\`\`\`json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    }
  }
}
\`\`\`

> Test on a throttled connection and 4× CPU slowdown. Your machine is not your user's machine, and a site that is fast on a MacBook on fibre can be unusable on a mid-range Android on 4G.`,
    },
    {
      slug: 'accessibility-and-lighthouse-audit',
      title: 'The Pre-Ship Audit: Accessibility and Lighthouse',
      estimatedMinutes: 55,
      body: `# The Pre-Ship Audit

Audit last, but never optional. This is a repeatable 45-minute pass you should run on every project before you call it done.

## Pass 1 — keyboard only

Put the mouse down. \`Tab\` from the top of the page to the bottom.

- [ ] Is there a **skip link** as the first focusable element?
- [ ] Can you reach every interactive element?
- [ ] Is focus **always visible**? (If you see nothing, someone wrote \`outline: none\`.)
- [ ] Does tab order follow visual order? (No positive \`tabindex\`.)
- [ ] Does \`Enter\` / \`Space\` activate buttons, \`Enter\` activate links?
- [ ] When the mobile menu opens, does focus move into it — and does \`Escape\` close it and return focus to the toggle?
- [ ] Can you tab to something you cannot see? (Off-screen menus need \`visibility: hidden\` or \`display: none\`, not just \`transform\`.)

The skip link, done properly:

\`\`\`css
.skip-link {
  position: absolute; top: 0; left: 0;
  padding: 0.75rem 1rem; background: var(--color-brand); color: #fff;
  transform: translateY(-120%);
  transition: transform 150ms ease;
}
.skip-link:focus { transform: translateY(0); }
\`\`\`

Hide it with \`transform\`, not \`display: none\` — a display-none element is not focusable at all.

## Pass 2 — structure and semantics

\`\`\`js
// headings outline, straight from the console
[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
  .forEach((h) => console.log(' '.repeat(+h.tagName[1] * 2) + h.tagName + ' ' + h.textContent.trim()));
\`\`\`

- [ ] Exactly one \`<h1>\` per page, and it describes the page
- [ ] No skipped levels (\`h2 → h4\`)
- [ ] Landmarks present: \`header\`, \`nav\`, \`main\` (one), \`footer\`
- [ ] Multiple \`<nav>\`s are distinguished with \`aria-label\`
- [ ] Every \`<img>\` has \`alt\`; decorative images have \`alt=""\`
- [ ] Every form control has a real \`<label>\` — a placeholder is not a label
- [ ] Link text makes sense out of context ("Read the 2026 report", not "click here")
- [ ] \`<html lang="en">\` is set, and \`<title>\` is unique per page

## Pass 3 — colour and motion

- [ ] Body text ≥ **4.5:1** contrast; large text (24px, or 19px bold) ≥ **3:1**
- [ ] UI borders, icons and focus rings ≥ **3:1** against their background
- [ ] Colour is never the only signal (add an icon or text to error states)
- [ ] Check **both** themes — dark mode contrast fails constantly
- [ ] \`prefers-reduced-motion\` is honoured
- [ ] The page still works at 200% browser zoom and at 320px width

## Pass 4 — the mobile nav and the theme toggle

These two are where portfolio sites lose accessibility points, so build them correctly from the start.

\`\`\`html
<button type="button" id="nav-toggle" class="nav-toggle"
        aria-expanded="false" aria-controls="primary-menu" aria-label="Open menu">
  <span class="nav-toggle__bars" aria-hidden="true"></span>
</button>

<ul id="primary-menu" class="nav-menu" data-open="false">
  <li><a href="/">Home</a></li>
  <li><a href="/work">Work</a></li>
  <li><a href="/contact">Contact</a></li>
</ul>
\`\`\`

\`\`\`js
const toggle = document.querySelector('#nav-toggle');
const menu = document.querySelector('#primary-menu');

function setMenu(open) {
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  menu.dataset.open = String(open);
  if (open) menu.querySelector('a').focus();
}

toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    toggle.focus();
  }
});
\`\`\`

\`aria-expanded\` is the whole contract: it is how a screen-reader user knows the menu opened. A hamburger that only toggles a CSS class is silent.

The theme toggle needs a no-flash initialiser inline in \`<head>\`, before any paint:

\`\`\`html
<script>
  (() => {
    const stored = localStorage.getItem('theme');
    const dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  })();
</script>
\`\`\`

\`\`\`js
const themeBtn = document.querySelector('#theme-toggle');
const isDark = () => document.documentElement.dataset.theme === 'dark';
themeBtn.setAttribute('aria-pressed', String(isDark()));
themeBtn.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
  themeBtn.setAttribute('aria-pressed', String(next === 'dark'));
});
\`\`\`

## Pass 5 — automated tools

Run them, but know their ceiling: **automated testing catches roughly 30% of accessibility issues.** It will never tell you that your alt text is wrong or that your tab order makes no sense.

\`\`\`bash
npx lighthouse https://example.com --view --preset=desktop
npx @axe-core/cli https://example.com
npx pa11y https://example.com
\`\`\`

Lighthouse scores five categories. Aim ≥ 90 on Performance, Accessibility, Best Practices and SEO. Common cheap wins:

| Audit failure | Fix |
| --- | --- |
| "Image elements do not have explicit width and height" | add the attributes |
| "Links do not have a discernible name" | icon-only link needs \`aria-label\` |
| "Background and foreground colors do not have sufficient ratio" | darken the muted grey |
| "Document does not have a meta description" | add one, unique per page |
| "Serve images in next-gen formats" | \`<picture>\` with AVIF/WebP |
| "Avoid enormous network payloads" | subset the font, compress the hero |
| "Buttons do not have an accessible name" | text, or \`aria-label\` |

> A perfect Lighthouse score on an inaccessible site is entirely achievable. The keyboard pass in the first five minutes of this audit is worth more than the tool.

## Pass 6 — the boring ship checklist

- [ ] Every page has a unique \`<title>\` and \`meta description\`
- [ ] Open Graph tags so shared links render a card
- [ ] \`favicon\`, \`apple-touch-icon\`, and a \`404\` page that links home
- [ ] No console errors, no 404s in the network tab
- [ ] Works with JavaScript disabled at least well enough to read
- [ ] Deployed over HTTPS with a real \`robots.txt\` and \`sitemap.xml\``,
    },
  ],
  quiz: [
    {
      prompt: 'What does `grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr))` achieve?',
      options: [
        'A fixed four-column grid that hides overflow',
        'A grid that reflows to fit as many columns as the space allows, without any media query and without overflowing narrow screens',
        'A grid that always keeps one empty track for spacing',
        'Nothing — `min()` is not valid inside `minmax()`',
      ],
      correctIndex: 1,
      explanation:
        '`auto-fit` collapses empty tracks so items stretch, `minmax` sets the ideal minimum, and the inner `min(18rem, 100%)` stops the track exceeding a narrow viewport, which is what would otherwise cause horizontal scroll.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which set of Core Web Vitals thresholds is correct for a "good" rating?',
      options: [
        'LCP ≤ 4.0s, INP ≤ 500ms, CLS ≤ 0.25',
        'LCP ≤ 1.0s, INP ≤ 50ms, CLS ≤ 0.01',
        'LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1',
        'LCP ≤ 2.5s, FID ≤ 100ms, TTFB ≤ 200ms',
      ],
      correctIndex: 2,
      explanation:
        'Good is LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1, measured at the 75th percentile of real users. The first option lists the *poor* thresholds; INP replaced FID as a Core Web Vital in 2024.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why must a font preload include the `crossorigin` attribute?',
      options: [
        'Fonts are always fetched in CORS mode, so without it the browser downloads the file a second time and the preload is wasted',
        'It is required for `font-display: swap` to work',
        'It compresses the woff2 file',
        'It is optional — it only silences a console warning',
      ],
      correctIndex: 0,
      explanation:
        'Font requests are anonymous-CORS by default. A preload without `crossorigin` creates a different cache key from the real request, so the file is fetched twice and the preload actively harms LCP.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Your hamburger button toggles a CSS class and nothing else. What is the accessibility bug?',
      options: [
        'The button needs `role="menu"`',
        'The menu should use `<select>` on mobile',
        'The button needs a positive `tabindex`',
        'Without `aria-expanded` on the toggle, a screen-reader user gets no signal that the menu opened',
      ],
      correctIndex: 3,
      explanation:
        '`aria-expanded="true|false"` plus `aria-controls` pointing at the menu id is the contract. Positive `tabindex` is an anti-pattern, and `role="menu"` is for application menus, not site navigation.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why should a theme initialiser run inline in `<head>` rather than in your main bundle?',
      options: [
        'Because localStorage is unavailable after DOMContentLoaded',
        'Because it must set the theme before first paint, otherwise the user sees a flash of the wrong theme',
        'Because module scripts cannot access the document element',
        'Because CSS custom properties are only readable during parsing',
      ],
      correctIndex: 1,
      explanation:
        'A deferred or bundled script runs after the initial paint, so the page renders light and then snaps to dark. A tiny blocking inline script in `<head>` sets the attribute before anything is painted.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What is the minimum contrast ratio for normal body text under WCAG AA?',
      options: ['3:1', '4.5:1', '7:1', '2:1'],
      correctIndex: 1,
      explanation:
        '4.5:1 for normal text, 3:1 for large text (about 24px, or 19px bold) and for non-text UI elements like borders and focus indicators. 7:1 is the stricter AAA level.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Roughly what proportion of accessibility issues can automated tools such as axe or Lighthouse detect?',
      options: [
        'Close to 100% — a passing score means the site is accessible',
        'About 70%, leaving only colour choices to review manually',
        'About 30% — they cannot judge alt-text quality, tab order or whether an interaction makes sense',
        '0% — they only check performance',
      ],
      correctIndex: 2,
      explanation:
        'Automated checks find machine-detectable failures (missing alt, low contrast, missing labels). Whether the alt text is *correct*, whether focus order is logical, and whether a custom widget is usable all require a human with a keyboard.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which change most directly improves INP?',
      options: [
        'Preloading the hero image',
        'Adding `width` and `height` attributes to images',
        'Serving images as AVIF',
        'Breaking a long synchronous loop into chunks that yield to the main thread',
      ],
      correctIndex: 3,
      explanation:
        'INP measures how long the main thread takes to respond to interaction and paint. Yielding breaks up long tasks so pending input can be handled. The other three options improve LCP or CLS.',
      difficulty: 'HARD',
    },
  ],
  problems: [
    {
      slug: 'accessible-site-shell',
      title: 'The Accessible Page Shell',
      difficulty: 'MEDIUM',
      runtime: 'html',
      statement: `Build the shell every page of your project will use. The tests check structure and ARIA wiring, not styling.

Requirements:

1. The **first \`<a>\` in the document** is a skip link with \`href="#main"\`.
2. A \`<header>\` containing a \`<nav>\` that has an \`aria-label\`.
3. A menu toggle \`<button>\` with \`aria-expanded="false"\` and \`aria-controls\` pointing at the id of the menu element.
4. A menu with that id, containing at least three \`<li><a>\` links.
5. A \`<button id="theme-toggle">\` carrying an \`aria-pressed\` attribute.
6. A \`<main id="main">\` containing exactly one \`<h1>\`.
7. A \`<footer>\`.
8. Every \`<button>\` has an accessible name — visible text or \`aria-label\`.

> The skip link must be first in the DOM so it is the first thing a keyboard user reaches.`,
      starterCode: `<!-- skip link first -->

<header>
  <nav>
    <!-- brand, toggle button, menu -->
  </nav>
</header>

<main>
  <!-- exactly one h1 -->
</main>

<!-- footer -->`,
      solutionCode: `<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header">
  <nav aria-label="Primary">
    <a class="brand" href="/">Ninja Studio</a>

    <button type="button" id="nav-toggle" class="nav-toggle"
            aria-expanded="false" aria-controls="primary-menu" aria-label="Open menu">
      <span class="nav-toggle__bars" aria-hidden="true"></span>
    </button>

    <ul id="primary-menu" class="nav-menu" data-open="false">
      <li><a href="/">Home</a></li>
      <li><a href="/work">Work</a></li>
      <li><a href="/contact">Contact</a></li>
    </ul>
  </nav>

  <button type="button" id="theme-toggle" aria-pressed="false">
    Dark mode
  </button>
</header>

<main id="main">
  <h1>We design and build fast, accessible websites</h1>
  <p>Three pages, one performance budget, zero layout shift.</p>
</main>

<footer>
  <p>2026 Ninja Studio</p>
</footer>`,
      hints: [
        'Put the skip link before the header — it must be the first focusable element on the page.',
        'aria-controls takes the raw id, with no # prefix; the href of the skip link does need the #.',
        'A button whose only content is a decorative span has no accessible name — give it aria-label.',
        'One <h1> per page. The nav brand is a link, not a heading.',
      ],
      tests: [
        {
          name: 'the first link is a skip link to #main',
          assertion:
            "(() => { const links = doc.querySelectorAll('a'); return links.length > 0 && links[0].getAttribute('href') === '#main'; })()",
        },
        {
          name: '#main exists and is a <main> element',
          assertion:
            "(() => { const m = doc.querySelector('#main'); return !!m && m.tagName.toLowerCase() === 'main'; })()",
        },
        {
          name: 'header contains a labelled nav',
          assertion: "!!doc.querySelector('header nav[aria-label]')",
        },
        {
          name: 'menu toggle is wired with aria-expanded and aria-controls',
          assertion:
            "(() => { const b = doc.querySelector('button[aria-controls]'); return !!b && b.getAttribute('aria-expanded') === 'false' && !!doc.getElementById(b.getAttribute('aria-controls')); })()",
        },
        {
          name: 'the controlled menu has at least three links',
          assertion:
            "(() => { const b = doc.querySelector('button[aria-controls]'); if (!b) return false; const menu = doc.getElementById(b.getAttribute('aria-controls')); return !!menu && menu.querySelectorAll('li a').length >= 3; })()",
        },
        {
          name: 'theme toggle is a button with aria-pressed',
          assertion:
            "(() => { const t = doc.querySelector('button#theme-toggle'); return !!t && t.hasAttribute('aria-pressed'); })()",
        },
        {
          name: 'exactly one h1, and a footer is present',
          assertion: "doc.querySelectorAll('h1').length === 1 && !!doc.querySelector('footer')",
          hidden: true,
        },
        {
          name: 'every button has an accessible name',
          assertion:
            "doc.querySelectorAll('button').length > 0 && Array.from(doc.querySelectorAll('button')).every(b => (b.textContent || '').trim().length > 0 || (b.getAttribute('aria-label') || '').trim().length > 0)",
          hidden: true,
        },
      ],
      xp: 70,
    },
    {
      slug: 'web-vitals-budget-checker',
      title: 'Web Vitals Rater & Budget Checker',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Build the little tool that turns raw measurements into a pass/fail your CI can act on.

### Export

**\`rate(metric, value)\`** — rate a single metric against the Core Web Vitals thresholds:

| metric | good (≤) | needs-improvement (≤) |
| --- | --- | --- |
| \`lcp\` | 2500 | 4000 |
| \`inp\` | 200 | 500 |
| \`cls\` | 0.1 | 0.25 |

Return \`'good'\`, \`'needs-improvement'\` or \`'poor'\`. Boundaries are inclusive: \`rate('lcp', 2500)\` is \`'good'\`.
Throw a \`RangeError\` for an unknown metric name, and a \`TypeError\` if \`value\` is not a finite non-negative number.

**\`rateVitals(sample)\`** — given \`{ lcp, inp, cls }\`, return
\`{ lcp, inp, cls, overall }\` where each metric holds its rating and \`overall\` is the **worst** of the three
(\`good\` < \`needs-improvement\` < \`poor\`). A missing metric should propagate the \`TypeError\` from \`rate\`.

**\`overBudget(budgets, actuals)\`** — both are objects of \`{ assetType: kilobytes }\`. Return an array of
\`{ type, overBy }\` for every budgeted type whose actual **exceeds** its budget (equal is fine).
A type missing from \`actuals\` counts as \`0\`. Sort by \`overBy\` descending, then by \`type\` alphabetically.
Return \`[]\` when everything fits.

### Examples

\`\`\`js
rate('cls', 0.3);                                   // 'poor'
rateVitals({ lcp: 1800, inp: 400, cls: 0.05 }).overall; // 'needs-improvement'
overBudget({ js: 170, css: 60 }, { js: 210, css: 40 }); // [{ type: 'js', overBy: 40 }]
\`\`\``,
      starterCode: `const THRESHOLDS = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [0.1, 0.25],
};

function rate(metric, value) {
  // 'good' | 'needs-improvement' | 'poor'
}

function rateVitals(sample) {
  // per-metric ratings plus the worst one as "overall"
}

function overBudget(budgets, actuals) {
  // [{ type, overBy }], worst first
}

module.exports = { rate, rateVitals, overBudget };`,
      solutionCode: `const THRESHOLDS = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [0.1, 0.25],
};

const SEVERITY = ['good', 'needs-improvement', 'poor'];

function rate(metric, value) {
  const bounds = THRESHOLDS[metric];
  if (!bounds) {
    throw new RangeError('Unknown metric: ' + String(metric));
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError('Invalid value for ' + metric + ': ' + String(value));
  }

  if (value <= bounds[0]) return 'good';
  if (value <= bounds[1]) return 'needs-improvement';
  return 'poor';
}

function rateVitals(sample) {
  const source = sample === null || typeof sample !== 'object' ? {} : sample;
  const result = {};
  let worst = 0;

  for (const metric of Object.keys(THRESHOLDS)) {
    const rating = rate(metric, source[metric]);
    result[metric] = rating;
    worst = Math.max(worst, SEVERITY.indexOf(rating));
  }

  result.overall = SEVERITY[worst];
  return result;
}

function overBudget(budgets, actuals) {
  const used = actuals === null || typeof actuals !== 'object' ? {} : actuals;

  return Object.keys(budgets)
    .map((type) => {
      const actual = typeof used[type] === 'number' ? used[type] : 0;
      return { type, overBy: Number((actual - budgets[type]).toFixed(3)) };
    })
    .filter((entry) => entry.overBy > 0)
    .sort((a, b) => {
      if (b.overBy !== a.overBy) return b.overBy - a.overBy;
      if (a.type < b.type) return -1;
      if (a.type > b.type) return 1;
      return 0;
    });
}

module.exports = { rate, rateVitals, overBudget };`,
      hints: [
        'Store the two thresholds per metric in one table so `rate` is three lines of comparison.',
        'Boundaries are inclusive on the good side: use <= for both comparisons.',
        'For `overall`, map each rating to an index in a severity array and take the maximum.',
        'Do not special-case a missing metric in rateVitals — letting `rate` throw is the required behaviour.',
        'Filter after computing overBy, and remember that exactly on budget is a pass.',
      ],
      tests: [
        {
          name: 'rates single metrics at the boundaries',
          assertion:
            "solution.rate('lcp', 2500) === 'good' && solution.rate('lcp', 2501) === 'needs-improvement' && solution.rate('lcp', 4001) === 'poor'",
        },
        {
          name: 'handles inp and cls scales',
          assertion:
            "solution.rate('inp', 200) === 'good' && solution.rate('inp', 500) === 'needs-improvement' && solution.rate('cls', 0.1) === 'good' && solution.rate('cls', 0.3) === 'poor'",
        },
        {
          name: 'throws RangeError on an unknown metric',
          assertion:
            "throws(() => solution.rate('fps', 60)) && (() => { try { solution.rate('fps', 60); return false; } catch (e) { return e instanceof RangeError; } })()",
        },
        {
          name: 'throws TypeError on a bad value',
          assertion:
            "(() => { try { solution.rate('lcp', '2500'); return false; } catch (e) { return e instanceof TypeError; } })() && throws(() => solution.rate('cls', -1))",
        },
        {
          name: 'rates a whole sample',
          assertion:
            "deepEqual(solution.rateVitals({ lcp: 1800, inp: 120, cls: 0.05 }), { lcp: 'good', inp: 'good', cls: 'good', overall: 'good' })",
        },
        {
          name: 'overall is the worst of the three',
          assertion:
            "solution.rateVitals({ lcp: 1800, inp: 400, cls: 0.05 }).overall === 'needs-improvement' && solution.rateVitals({ lcp: 5000, inp: 100, cls: 0.05 }).overall === 'poor'",
        },
        {
          name: 'a missing metric propagates the TypeError',
          assertion: 'throws(() => solution.rateVitals({ lcp: 1000, inp: 100 }))',
          hidden: true,
        },
        {
          name: 'reports overages and treats exactly-on-budget as a pass',
          assertion:
            "deepEqual(solution.overBudget({ js: 170, css: 60 }, { js: 210, css: 40 }), [{ type: 'js', overBy: 40 }]) && deepEqual(solution.overBudget({ js: 170 }, { js: 170 }), [])",
        },
        {
          name: 'sorts by overage then alphabetically, and missing actuals count as zero',
          assertion:
            "deepEqual(solution.overBudget({ js: 100, css: 50, img: 200 }, { js: 130, css: 120, img: 210 }).map(e => e.type), ['css', 'js', 'img']) && deepEqual(solution.overBudget({ a: 10, b: 10 }, { a: 20, b: 20 }).map(e => e.type), ['a', 'b']) && deepEqual(solution.overBudget({ js: 100 }, {}), [])",
          hidden: true,
        },
      ],
      xp: 80,
    },
  ],
  project: {
    slug: 'responsive-multi-page-site',
    title: 'Project 1 — Responsive Multi-Page Marketing Site',
    estimatedHours: 6,
    brief: `## Goal

Ship a **three-page responsive site** — a studio/portfolio or a product marketing site — using only what week one covered: semantic HTML, modern CSS (or Tailwind), vanilla ES6+ JavaScript, and git.

No framework. No component library beyond a styling system. This is the project that proves you can build the fundamentals without React hiding the details.

## Pages

1. **Home** — hero with a single clear call to action, a feature or service grid (3–6 cards), a testimonial or stats strip, and a footer.
2. **Work / Features** — a filterable or at least well-structured grid of case studies or features, each with an image, a heading and a summary.
3. **Contact** — a real form (name, email, subject, message) with client-side validation and visible success and error states.

Every page shares one header and footer. Since there is no framework, keep them byte-identical across files (or build them with a tiny \`<template>\` + JS include) so a change is a change in one place.

## User stories

- As a phone user, I can open the menu, navigate to any page, and never scroll horizontally.
- As a keyboard user, I can skip to content, reach every control, and always see where focus is.
- As a screen-reader user, I hear landmarks, a sensible heading outline, and I am told when the menu opens.
- As a returning visitor, the site remembers my light/dark preference and never flashes the wrong theme.
- As someone on a slow 4G connection, the hero appears in under 2.5 seconds and nothing jumps around while it loads.
- As a visitor with a question, I can submit the contact form, see a clear success message, and get useful inline errors when I get something wrong.

## Required tech

- Semantic HTML5 with correct landmarks and one \`<h1>\` per page
- Tailwind CSS **or** hand-written CSS with custom properties and a token layer
- Vanilla JavaScript (ES modules) — no jQuery, no framework
- Responsive images: \`<picture>\` or \`srcset\`/\`sizes\`, with \`width\`/\`height\` on every \`<img>\`
- Dark mode driven by a \`data-theme\` attribute (or Tailwind's \`dark\` class) with a no-flash inline initialiser
- Git with conventional commits and at least one feature branch merged via a PR
- Deployed to a public URL (Netlify, Vercel, GitHub Pages, Cloudflare Pages — all free)

## Contact form

The form must **work**, not just look like it does:

- Labels wired with \`for\`/\`id\`; \`autocomplete\` on name and email
- Client validation using the Constraint Validation API (\`checkValidity()\`, \`ValidityState\`), with messages announced via \`aria-describedby\` and \`role="alert"\`
- Submission handled with \`fetch\` to a free endpoint (Formspree, Web3Forms, Netlify Forms) or a mocked promise; disable the submit button and show a busy state while in flight
- A visible, focusable success message on completion, and a recoverable error state on failure

## Acceptance criteria

- Lighthouse **≥ 90** on Performance, Accessibility, Best Practices and SEO — for **all three pages**, mobile preset
- Zero horizontal scroll from 320px to 1920px
- Zero console errors and zero 404s in the network tab
- CLS effectively 0 on load (no jump when the hero image or webfont arrives)
- The full site is usable with the keyboard alone
- README with a screenshot, the live URL, the stack, and a short note on what you would do next`,
    checklist: [
      'Three pages (Home, Work/Features, Contact) with a shared header and footer and correct relative links between them',
      'Every page has one <h1>, a unique <title>, a unique meta description and Open Graph tags',
      'Landmarks present on every page: header, nav with aria-label, exactly one main, footer',
      'A skip link is the first focusable element and becomes visible on focus',
      'Mobile nav toggle updates aria-expanded, closes on Escape, and returns focus to the toggle',
      'Dark mode toggle persists to localStorage and is applied by an inline script before first paint',
      'Layout has zero horizontal overflow from 320px to 1920px, verified by resizing',
      'All images use <picture> or srcset/sizes, carry explicit width and height, and only below-the-fold images use loading="lazy"',
      'Contact form has labelled inputs, autocomplete attributes, inline validation messages wired with aria-describedby, and a role="alert" error region',
      'Contact form submits via fetch with a busy state, a visible success message and a recoverable error state',
      'Lighthouse mobile scores >= 90 for Performance, Accessibility, Best Practices and SEO on all three pages (screenshots in the README)',
      'Keyboard-only pass completed: every control reachable, focus always visible, tab order matches visual order',
      'prefers-reduced-motion is honoured and no animation is required to understand the page',
      'Git history uses conventional commits, with at least one feature branch merged through a pull request',
    ],
    stretchGoals: [
      'Add a fourth page generated from a JSON data file, rendering the cards with a <template> element and vanilla JS',
      'Wire Lighthouse CI into a GitHub Action that fails the PR when performance or accessibility drops below 90',
      'Implement a filter/search on the Work page that updates the URL query string and restores state on reload',
      'Add a view transition between pages using the View Transitions API, disabled under prefers-reduced-motion',
      'Report real user LCP, INP and CLS with the web-vitals library to a free analytics endpoint and screenshot the field data',
    ],
    repoStarter: 'https://github.com/vitejs/vite/tree/main/packages/create-vite/template-vanilla',
  },
  flashcards: [
    {
      front: 'Why extract design tokens before building components?',
      back: 'Tokens turn the design’s decisions into named values in one place. Semantic names (--color-surface, not --color-slate-50) make dark mode a short override instead of a rewrite.',
      tags: ['workflow', 'design-systems'],
    },
    {
      front: 'What does `width: min(100% - 2rem, 72rem)` replace?',
      back: 'A container with several breakpoints. It is full width minus gutters on small screens and capped at 72rem on large ones, with no media query.',
      tags: ['css', 'responsive'],
    },
    {
      front: 'Why the inner `min()` in `minmax(min(18rem, 100%), 1fr)`?',
      back: 'Without it, a track can be wider than a narrow viewport and cause horizontal scroll. `min(18rem, 100%)` caps the minimum at the available width.',
      tags: ['css', 'grid'],
    },
    {
      front: 'Media query vs container query',
      back: 'Media queries ask about the viewport; container queries ask about the component’s own box. A card that must adapt in both a sidebar and a full-width page needs a container query.',
      tags: ['css', 'responsive'],
    },
    {
      front: 'Core Web Vitals "good" thresholds',
      back: 'LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 — graded at the 75th percentile of real users. The page’s rating is the worst of the three.',
      tags: ['performance', 'web-vitals'],
    },
    {
      front: 'Three causes of layout shift, and their fixes',
      back: 'Images without dimensions (set width/height or aspect-ratio); webfonts swapping (font-display: swap plus size-adjust/ascent-override); content injected above existing content (reserve space or overlay it).',
      tags: ['performance', 'cls'],
    },
    {
      front: 'What improves INP?',
      back: 'Shorter main-thread tasks: yield with `await new Promise(r => setTimeout(r, 0))` inside long loops, batch DOM writes into a fragment, animate only transform/opacity, and use content-visibility on off-screen sections.',
      tags: ['performance', 'inp'],
    },
    {
      front: 'Why must a font preload carry `crossorigin`?',
      back: 'Fonts are fetched in CORS mode. Without `crossorigin` the preload has a different cache key from the real request, so the file downloads twice and LCP gets worse, not better.',
      tags: ['performance', 'fonts'],
    },
    {
      front: 'The ARIA contract for a hamburger menu',
      back: '`aria-expanded="true|false"` on the toggle plus `aria-controls` pointing at the menu id. Escape closes and returns focus to the toggle. A CSS class alone announces nothing.',
      tags: ['a11y', 'navigation'],
    },
    {
      front: 'Why hide a skip link with `transform`, not `display: none`?',
      back: 'A `display: none` element cannot receive focus at all, so the skip link would be unreachable. Translate it off-screen and bring it back on `:focus`.',
      tags: ['a11y', 'css'],
    },
    {
      front: 'How much do automated a11y tools catch?',
      back: 'Roughly 30%. They find missing alt, missing labels and low contrast; they cannot judge whether alt text is correct, whether tab order is logical, or whether a widget makes sense.',
      tags: ['a11y', 'testing'],
    },
    {
      front: 'Why must the theme initialiser be inline in `<head>`?',
      back: 'A deferred or bundled script runs after first paint, so the user sees a flash of the wrong theme. A tiny blocking inline script sets the attribute before anything renders.',
      tags: ['dark-mode', 'ux'],
    },
  ],
  resources: [
    { label: 'web.dev — Core Web Vitals', url: 'https://web.dev/articles/vitals', kind: 'DOCS' },
    { label: 'Lighthouse — Documentation', url: 'https://developer.chrome.com/docs/lighthouse/overview', kind: 'TOOL' },
    { label: 'WCAG 2.2 — Quick Reference', url: 'https://www.w3.org/WAI/WCAG22/quickref/', kind: 'SPEC' },
    { label: 'MDN — CSS container queries', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries', kind: 'DOCS' },
    { label: 'Every Layout — resilient layout primitives', url: 'https://every-layout.dev/', kind: 'ARTICLE' },
  ],
};

export default day;
