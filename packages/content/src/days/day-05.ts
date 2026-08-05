import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 5,
  week: 1,
  pillar: 'FRONTEND',
  title: 'Styling Systems: Tailwind, Bootstrap & Sass',
  summary: 'Stop hand-rolling CSS architecture — learn the three systems the industry actually ships.',
  estimatedMinutes: 320,
  objectives: [
    'Explain the utility-first model and name the situations where it beats hand-written CSS',
    'Configure a Tailwind theme, dark mode, responsive variants and arbitrary values',
    'Build a responsive layout with the Bootstrap grid and customise it through Sass variables',
    'Write maintainable Sass with @use, partials, mixins, maps and functions',
    'Choose a styling system for a given project and defend the choice',
  ],
  technologies: ['Tailwind CSS', 'Bootstrap', 'Sass/SCSS'],
  lessons: [
    {
      slug: 'utility-first-philosophy',
      title: 'The Utility-First Argument (and Where It Loses)',
      estimatedMinutes: 70,
      body: `# The Utility-First Argument (and Where It Loses)

Every CSS methodology of the last fifteen years — OOCSS, SMACSS, BEM, CSS Modules — exists to answer one question: **what do I name this thing, and where does the rule live?** Utility-first answers it by refusing to play. You do not name anything. You compose from a fixed vocabulary of single-purpose classes.

## The problem being solved

Write CSS the classic way for six months and you accumulate three specific pathologies.

**1. Append-only stylesheets.** Nobody deletes CSS, because nobody can prove a rule is unused. \`main.css\` only grows. On a mature product it is routine to find that 60–80% of shipped CSS is dead.

**2. Naming fatigue and leaky abstractions.** You write \`.card\`, then \`.card--featured\`, then \`.card--featured-compact\`, then \`.card--featured-compact-dark\`. Each modifier is a guess about the future. The moment a designer wants "this card, but with 4px more padding on the pricing page", the abstraction breaks and someone writes an override.

**3. Action at a distance.** You change \`.btn\` to fix the checkout page and break the newsletter modal you have never opened. The coupling is invisible because the relationship lives in a selector, not in the markup.

Utility-first kills all three. Utilities are a **closed set** — \`p-4\` exists whether or not you use it, so the stylesheet stops growing with your app. There is nothing to name. And a class only affects the element it is written on, so nothing changes at a distance.

## What it looks like

\`\`\`html
<article class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm
                transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
  <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Pro</h3>
  <p class="mt-1 text-3xl font-bold tracking-tight">$29<span class="text-base font-normal text-slate-500">/mo</span></p>
</article>
\`\`\`

The honest reaction on first sight is that this is ugly. It is. The trade you are being offered is: **ugly markup in exchange for a CSS file that never surprises you.** For product UI, that trade is usually worth taking.

## The constraint system is the real feature

A utility framework is not really a bag of classes; it is a **design system compiler**. \`p-4\` is not "16 pixels" — it is "step 4 on the spacing scale". You physically cannot write \`padding: 13px\` without going out of your way. That constraint is what makes twelve engineers produce a UI that looks like one person built it.

| Axis | Hand-written CSS | Utility-first |
| --- | --- | --- |
| Spacing | any value, any time | fixed scale |
| Colour | whatever is in the Figma clipboard | named palette |
| Type | ad-hoc \`font-size\` | type scale with matched line-height |
| Breakpoints | invented per component | one shared set |

## Where utility-first loses

Be honest about the failure modes; interviewers ask about them.

- **Long-form editorial content.** You do not want to put classes on every \`<p>\` of a CMS-rendered article. Use a typography plugin or plain CSS on a container. Tailwind's own answer is \`@tailwindcss/typography\` and a single \`prose\` class.
- **Markup you do not control.** Third-party embeds, email templates, server-rendered HTML from a legacy system. No place to put the classes.
- **Genuinely complex, stateful CSS.** Multi-step keyframe choreography, \`@supports\` trees, print stylesheets. Write real CSS.
- **Teams with a dedicated design-system package.** If you already ship components as a library, the consumer wants \`<Button variant="primary">\`, not eleven utilities.
- **Duplication in raw HTML.** Utilities rely on a component boundary to stay DRY. In React, Vue or a templating engine you get that for free. In hand-written static HTML with fourteen identical cards, you are copy-pasting.

> The rule: utilities compose *within* a component; components compose *within* a page. If you find yourself copying a 12-class string more than twice, you needed a component, not a CSS class.

## The three systems on this day

- **Tailwind** — utility-first, build-time, zero opinions about what your UI looks like. Maximum control, you build every component.
- **Bootstrap** — component-first. Ships a grid, a nav, modals, dropdowns, form controls and a JS layer. Fastest path to a competent-looking app; everything looks a bit like Bootstrap unless you invest in theming.
- **Sass** — not a framework at all. A CSS *preprocessor*: variables, nesting, mixins, functions, module system. It is the layer underneath the other two (Bootstrap is written in it) and the tool you reach for when you are writing real CSS.

They are not mutually exclusive. A very common production stack is Tailwind for layout and spacing, plus a small hand-written Sass layer for the two or three genuinely complex components. Knowing when to reach for which is the point of today.`,
    },
    {
      slug: 'tailwind-in-depth',
      title: 'Tailwind in Depth: Theme, Variants, Dark Mode, Escape Hatches',
      estimatedMinutes: 85,
      body: `# Tailwind in Depth

Tailwind is a build step. It scans your source files for strings that look like class names, generates exactly the CSS for the ones it finds, and emits nothing else. Understanding that one sentence explains almost every gotcha in the framework.

## Configuration: two eras

**Tailwind v3** configures in JavaScript:

\`\`\`js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef2ff', 500: '#6366f1', 600: '#4f46e5', 900: '#312e81' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      spacing: { 18: '4.5rem' },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
\`\`\`

**Tailwind v4** moved configuration into CSS itself:

\`\`\`css
@import "tailwindcss";

@theme {
  --color-brand-500: oklch(0.62 0.19 275);
  --color-brand-600: oklch(0.55 0.20 275);
  --font-sans: "Inter", system-ui, sans-serif;
  --spacing-18: 4.5rem;
}

/* class-based dark mode is opt-in in v4 */
@custom-variant dark (&:where(.dark, .dark *));
\`\`\`

The mental model is identical in both: **the theme defines a scale, and utilities are generated from that scale.** Adding \`--color-brand-500\` does not just create \`bg-brand-500\`; it creates \`text-brand-500\`, \`border-brand-500\`, \`ring-brand-500\`, \`from-brand-500\` and every other colour-consuming utility, plus their variants. That leverage is the reason you extend the theme instead of writing one-off CSS.

> \`theme.extend\` **adds** to the defaults. A bare \`theme.colors\` **replaces** them — every default colour disappears. This catches everyone exactly once.

## The scanner is a text search, not a compiler

Tailwind does not evaluate your JavaScript. It regex-scans files for candidate strings. So this **silently produces no CSS**:

\`\`\`jsx
// BROKEN — "text-red-500" never appears as a literal
const color = 'red';
<p className={'text-' + color + '-500'}>Danger</p>
\`\`\`

The fix is to make every possible class a complete literal in the source:

\`\`\`jsx
const TONE = {
  danger: 'bg-red-50 text-red-700 ring-red-600/20',
  success: 'bg-green-50 text-green-700 ring-green-600/20',
};
<p className={TONE[tone]}>…</p>
\`\`\`

This is also why \`content\` (v3) or the automatic source detection (v4) matters: a file the scanner never opens contributes no classes, and your component ships unstyled in production while working perfectly in dev.

## Variants: the prefix grammar

A variant is a prefix that wraps the generated rule in a selector or at-rule. They stack, left to right, outermost first.

\`\`\`html
<button class="bg-brand-500 hover:bg-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500
               disabled:opacity-50 md:px-6 dark:bg-brand-600 dark:hover:bg-brand-500">
  Save
</button>
\`\`\`

| Variant | Generates |
| --- | --- |
| \`hover:\`, \`focus-visible:\`, \`active:\`, \`disabled:\` | pseudo-class |
| \`sm:\` \`md:\` \`lg:\` \`xl:\` \`2xl:\` | \`@media (min-width: …)\` |
| \`dark:\` | media query or \`.dark\` ancestor |
| \`group-hover:\` / \`peer-checked:\` | parent / sibling state |
| \`first:\` \`last:\` \`odd:\` \`[&>li]:\` | structural / arbitrary selector |
| \`motion-reduce:\` \`print:\` | other at-rules |

**Breakpoints are min-width, always.** \`md:grid-cols-3\` means "3 columns at md **and above**". Unprefixed utilities are the mobile base case. Writing \`grid-cols-3 md:grid-cols-1\` is legal and almost always a bug.

\`group\` and \`peer\` are the two that unlock real interactivity without JS:

\`\`\`html
<a href="#" class="group block rounded-lg p-4 hover:bg-slate-50">
  <h3 class="font-medium group-hover:text-brand-600">Read the docs</h3>
  <span class="opacity-0 transition group-hover:opacity-100">→</span>
</a>

<input id="terms" type="checkbox" class="peer" />
<label for="terms" class="peer-checked:font-semibold peer-checked:text-brand-600">I agree</label>
\`\`\`

## Dark mode

Two strategies, and the choice is a product decision, not a technical one.

\`\`\`js
darkMode: 'media'  // follows prefers-color-scheme. Zero JS. No user override.
darkMode: 'class'  // .dark on an ancestor. You control it. Needs a toggle + persistence.
\`\`\`

Pick \`class\` if users get a toggle. The toggle must run **before first paint** or you ship a flash of the wrong theme:

\`\`\`html
<script>
  // inline in <head>, before any stylesheet-dependent render
  const stored = localStorage.getItem('theme');
  const dark = stored ? stored === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
</script>
\`\`\`

Then every colour utility gets a \`dark:\` partner: \`bg-white dark:bg-slate-900\`, \`text-slate-900 dark:text-slate-100\`, \`border-slate-200 dark:border-slate-700\`.

## Arbitrary values — the escape hatch

When the design genuinely needs a value off the scale, square brackets generate a one-off utility at build time:

\`\`\`html
<div class="top-[117px] grid-cols-[240px_1fr] w-[calc(100%-2rem)] bg-[#bada55]
            text-[clamp(1rem,2.5vw,1.5rem)] [mask-image:linear-gradient(black,transparent)]">
\`\`\`

Underscores become spaces. The final form — \`[property:value]\` — writes an arbitrary *declaration* and is your bail-out for anything Tailwind has no utility for.

> Arbitrary values are a smell in bulk. One or two per project is craft; thirty means your theme does not match your design.

## @apply, and why to use it sparingly

\`\`\`css
.btn-primary {
  @apply inline-flex items-center rounded-lg bg-brand-500 px-4 py-2
         font-medium text-white hover:bg-brand-600
         focus-visible:ring-2 focus-visible:ring-brand-500;
}
\`\`\`

This works. It is also the thing that re-introduces everything utility-first removed: an invented name, action at a distance, and a stylesheet that grows. Reach for \`@apply\` in exactly two cases — you do not control the markup (third-party widget, Markdown output), or you are wrapping a genuinely global primitive like a focus ring. Otherwise make a component.

The composition problem — merging conditional class strings without conflicts — is solved by \`clsx\` plus \`tailwind-merge\`:

\`\`\`js
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';
export const cn = (...inputs) => twMerge(clsx(inputs));

cn('px-2 py-1', 'px-4');            // -> 'py-1 px-4'  (later wins, correctly)
cn('text-sm', isLarge && 'text-lg'); // -> 'text-lg' when isLarge
\`\`\`

Plain string concatenation cannot do this: \`"px-2 px-4"\` leaves the browser to pick by source order in the stylesheet, which is not the order you wrote them in.`,
    },
    {
      slug: 'bootstrap-grid-and-theming',
      title: 'Bootstrap: Grid, Components, Utility API & Sass Theming',
      estimatedMinutes: 75,
      body: `# Bootstrap: Grid, Components, Utility API & Sass Theming

Bootstrap answers a different question from Tailwind. Tailwind asks "how do I write CSS at scale?" Bootstrap asks "how do I have a working, accessible modal by lunchtime?" On internal tools, admin panels, and any project where nobody is paid to have opinions about button radii, it is still the right answer.

## The grid

Bootstrap's grid is a 12-column flexbox system with six breakpoints.

| Infix | Min width | Container max |
| --- | --- | --- |
| *(none)* | 0 | 100% |
| \`sm\` | 576px | 540px |
| \`md\` | 768px | 720px |
| \`lg\` | 992px | 960px |
| \`xl\` | 1200px | 1140px |
| \`xxl\` | 1400px | 1320px |

Three nesting levels are mandatory: **container → row → col**.

\`\`\`html
<div class="container">
  <div class="row g-4">
    <div class="col-12 col-md-6 col-lg-4">
      <div class="card h-100">
        <div class="card-body">
          <h5 class="card-title">Starter</h5>
          <p class="card-text">Everything you need to ship a first version.</p>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-6 col-lg-4">…</div>
    <div class="col-12 col-md-6 col-lg-4">…</div>
  </div>
</div>
\`\`\`

Read \`col-12 col-md-6 col-lg-4\` as three statements: full width by default, half from 768px, one third from 992px. Like Tailwind, **the infix is min-width**, and the unprefixed class is the mobile case.

Things worth knowing:

- \`.row\` applies negative horizontal margins; \`.col-*\` applies matching padding. A \`.col\` outside a \`.row\` will be misaligned. A \`.row\` outside a container will overflow horizontally.
- **Gutters are \`g-*\`, not margins.** \`g-4\`, \`gx-3\` (horizontal only), \`gy-5\` (vertical only). Never add \`margin\` to a column; it breaks the 12-unit maths.
- \`.col\` with no number means "share the remaining space equally". \`.col-auto\` sizes to content.
- \`.row-cols-1 .row-cols-md-3\` sets the column count on the *row*, so children need no col classes at all.
- \`h-100\` on cards is how you get equal-height cards — the column is already a flex item.

Offsets and ordering are declarative too: \`offset-md-2\`, \`order-first\`, \`order-md-2\`.

## The components you get for free

\`\`\`html
<nav class="navbar navbar-expand-lg bg-body-tertiary">
  <div class="container">
    <a class="navbar-brand" href="#">CodeNinja</a>
    <button class="navbar-toggler" type="button"
            data-bs-toggle="collapse" data-bs-target="#mainNav"
            aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="mainNav">
      <ul class="navbar-nav ms-auto">
        <li class="nav-item"><a class="nav-link active" aria-current="page" href="#">Home</a></li>
        <li class="nav-item"><a class="nav-link" href="#pricing">Pricing</a></li>
      </ul>
    </div>
  </div>
</nav>
\`\`\`

The \`data-bs-*\` attributes are the declarative JS API. \`data-bs-toggle="collapse"\` plus \`data-bs-target="#mainNav"\` wires the hamburger to the menu with no JavaScript from you — but only if you load \`bootstrap.bundle.min.js\`. The ARIA attributes are not decoration; Bootstrap's JS updates \`aria-expanded\` for you, and screen-reader users depend on it.

The same pattern drives modals, dropdowns, tabs, tooltips, offcanvas and accordions. Every one of them also has an imperative API:

\`\`\`js
const modal = bootstrap.Modal.getOrCreateInstance('#confirmModal');
modal.show();
document.querySelector('#confirmModal')
  .addEventListener('hidden.bs.modal', () => form.reset());
\`\`\`

## Utilities and the utility API

Bootstrap 5 ships a real utility layer: \`d-flex\`, \`justify-content-between\`, \`align-items-center\`, \`gap-3\`, \`text-truncate\`, \`p-4\`, \`mt-auto\`, \`border-0\`, \`rounded-pill\`, \`shadow-sm\`, \`visually-hidden\`. They are responsive too — \`d-none d-lg-block\`.

You can also generate your own from a Sass map, which is how you extend Bootstrap without leaving its idioms:

\`\`\`scss
@use "bootstrap/scss/bootstrap" as bs;

$utilities: map-merge(
  $utilities,
  (
    "cursor": (
      property: cursor,
      class: cursor,
      responsive: false,
      values: pointer not-allowed grab,
    ),
  )
);
\`\`\`

That emits \`.cursor-pointer\`, \`.cursor-not-allowed\` and \`.cursor-grab\`.

## Theming through Sass — the only correct way

Do **not** override \`.btn-primary\` in a later stylesheet, and never edit files in \`node_modules\`. Bootstrap declares its variables with \`!default\`, which means "use this unless already set". So you set them *first*, then import:

\`\`\`scss
// 1. Your overrides come BEFORE the import
$primary:        #6366f1;
$border-radius:  0.75rem;
$font-family-sans-serif: "Inter", system-ui, sans-serif;
$enable-shadows: true;

// 2. Extend the theme map, do not replace it
$custom-colors: ("brand": #6366f1, "accent": #f59e0b);

// 3. Now pull Bootstrap in
@import "bootstrap/scss/functions";
@import "bootstrap/scss/variables";
@import "bootstrap/scss/maps";
@import "bootstrap/scss/mixins";

$theme-colors: map-merge($theme-colors, $custom-colors);

@import "bootstrap/scss/bootstrap";
\`\`\`

Because \`$theme-colors\` is a map that Bootstrap loops over, adding \`"brand"\` generates \`.btn-brand\`, \`.text-brand\`, \`.bg-brand\`, \`.border-brand\` and \`.alert-brand\` automatically. That is the payoff for theming *inside* the system.

If you only need a few components, import only those partials — \`grid\`, \`buttons\`, \`forms\` — and drop 150 KB off the bundle.

## Colour modes

Bootstrap 5.3 added first-class dark mode driven by a data attribute rather than a class:

\`\`\`html
<html data-bs-theme="dark">
\`\`\`

Set it on any subtree to scope it. Component colours are CSS custom properties (\`--bs-body-bg\`, \`--bs-emphasis-color\`), so the switch is instant and requires no re-compilation.

> The eternal Bootstrap critique — "everything looks the same" — is a symptom of teams using default variables, not of the framework. Ten minutes in \`_variables\` overrides changes the entire feel.`,
    },
    {
      slug: 'sass-and-choosing',
      title: 'Sass Fundamentals and a Decision Framework',
      estimatedMinutes: 80,
      body: `# Sass Fundamentals and a Decision Framework

Sass is a preprocessor: SCSS in, plain CSS out. CSS has since absorbed several of its ideas — custom properties, native nesting, \`color-mix()\` — but Sass still owns the things that need to happen at *build* time: loops, maps, functions, and a real module system.

## Variables: Sass vs CSS custom properties

\`\`\`scss
$brand: #6366f1;              // compile-time. Vanishes from the output.
:root { --brand: #6366f1; }   // runtime. Live in the browser, themeable, inspectable.
\`\`\`

The rule of thumb: **Sass variables for values the build needs to compute with** (breakpoints, spacing scales, values you pass to \`math.div\` or \`color.adjust\`). **CSS custom properties for values that change at runtime** (themes, per-component overrides, anything a JS toggle touches). A media query cannot read a custom property, so breakpoints must be Sass.

## Nesting, and the depth limit

\`\`\`scss
.card {
  padding: 1.5rem;
  border-radius: 0.75rem;

  &__title {            // -> .card__title
    font-size: 1.125rem;
  }

  &--featured {         // -> .card--featured
    border-color: $brand;
  }

  &:hover { box-shadow: 0 10px 30px rgb(0 0 0 / 0.08); }

  .dark-mode & { background: #0f172a; }  // -> .dark-mode .card
}
\`\`\`

\`&\` is the parent selector, and \`.dark-mode &\` shows it can be *prefixed* as well as suffixed.

> Never nest more than three levels. Nesting is not free — each level adds specificity you will later have to out-shout, and \`.page .content .card .title a\` is a selector nobody can safely change.

## Mixins vs functions vs @extend

A **mixin** emits declarations and can take arguments (including a content block).

\`\`\`scss
@use "sass:map";

$breakpoints: (sm: 576px, md: 768px, lg: 992px, xl: 1200px);

@mixin mq($key) {
  $size: map.get($breakpoints, $key);
  @if not $size {
    @error "Unknown breakpoint: #{$key}";
  }
  @media (min-width: $size) { @content; }
}

@mixin truncate($lines: 1) {
  @if $lines == 1 {
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  } @else {
    display: -webkit-box; -webkit-line-clamp: $lines;
    -webkit-box-orient: vertical; overflow: hidden;
  }
}

.hero__title {
  font-size: 1.75rem;
  @include truncate(2);
  @include mq(md) { font-size: 3rem; }
}
\`\`\`

A **function** returns a value.

\`\`\`scss
@use "sass:math";

@function rem($px, $base: 16px) { @return math.div($px, $base) * 1rem; }

.btn { padding: rem(12px) rem(20px); }   // 0.75rem 1.25rem
\`\`\`

\`@extend\` makes one selector inherit another's rules by merging selector lists. It saves bytes but reorders your CSS in ways that are hard to predict, and it cannot cross \`@media\` boundaries. **Prefer mixins.** If you want the byte savings, use a placeholder so nothing is emitted unless used:

\`\`\`scss
%visually-hidden {
  position: absolute; width: 1px; height: 1px;
  clip-path: inset(50%); overflow: hidden; white-space: nowrap;
}
.skip-link:not(:focus) { @extend %visually-hidden; }
\`\`\`

## Loops and maps generate your utility layer

\`\`\`scss
$space: (0: 0, 1: 0.25rem, 2: 0.5rem, 3: 1rem, 4: 1.5rem, 5: 3rem);

@each $key, $value in $space {
  .p-#{$key} { padding: $value; }
  .mt-#{$key} { margin-top: $value; }
}

$tones: (primary: #6366f1, danger: #ef4444, success: #22c55e);
@each $name, $color in $tones {
  .badge--#{$name} {
    background: color.scale($color, $lightness: 90%);
    color: color.scale($color, $lightness: -30%);
  }
}
\`\`\`

\`#{...}\` is interpolation — the only way to build a selector or property name from a variable. Note \`color.scale\` and \`color.adjust\` from the \`sass:color\` module: the old global \`lighten()\` / \`darken()\` functions are deprecated because they operate on HSL lightness and produce muddy results.

## Partials and the module system

A file starting with an underscore is a **partial** — it compiles to no CSS of its own and exists to be loaded.

\`\`\`
styles/
  abstracts/  _variables.scss  _mixins.scss  _functions.scss
  base/       _reset.scss      _typography.scss
  components/ _button.scss     _card.scss
  layout/     _header.scss     _grid.scss
  main.scss
\`\`\`

\`@import\` is **deprecated and being removed from Dart Sass.** Use \`@use\` and \`@forward\`.

\`\`\`scss
// abstracts/_index.scss  — the public surface of the folder
@forward "variables";
@forward "mixins";

// components/_button.scss
@use "../abstracts" as a;         // namespaced
.btn { padding: a.rem(12px); background: a.$brand; }

// or drop the namespace deliberately
@use "../abstracts" as *;
.btn { padding: rem(12px); background: $brand; }
\`\`\`

| | \`@import\` | \`@use\` |
| --- | --- | --- |
| Loads a file twice? | yes, duplicating output | no, once per compilation |
| Scope | everything global | namespaced by default |
| Overriding variables | order-dependent guesswork | explicit \`with (...)\` |
| Status | deprecated | current |

Configuration is explicit, which kills a whole class of "why did my variable not apply" bugs:

\`\`\`scss
// _theme.scss
$radius: 0.5rem !default;
$brand: #6366f1 !default;

// main.scss
@use "theme" with ($radius: 1rem, $brand: #0ea5e9);
\`\`\`

## Choosing a system

Ask four questions, in order.

**1. Who owns the design?** A designer with a Figma system and opinions → Tailwind (or hand-written CSS + Sass). No designer, ship it Friday → Bootstrap.

**2. Do you control the markup?** If large parts of the HTML come from a CMS, a mail template or a legacy backend, utilities have nowhere to live → Sass.

**3. Do you have a component boundary?** React/Vue/Svelte/templating gives you one, so utility duplication is a non-issue. Thousands of lines of hand-authored static HTML do not.

**4. What is the team's next hire going to know?** Bootstrap is the lowest-common-denominator skill. Tailwind is now close behind. A bespoke Sass architecture is only as good as its documentation.

| Scenario | Pick | Why |
| --- | --- | --- |
| Startup product UI, React, designer-led | **Tailwind** | fast iteration, enforced scale, no dead CSS |
| Internal admin tool, small team, no designer | **Bootstrap** | components and a11y out of the box |
| Marketing site rendered by a CMS | **Sass** | markup is not yours to annotate |
| Design system published as a package | **Sass or CSS Modules** | consumers want an API, not utilities |
| Legacy Bootstrap app that needs a facelift | **Bootstrap + Sass overrides** | retheme in place, do not rewrite |
| Email templates | none of them | inline styles and tables, sadly |

The wrong answer is picking one because it is fashionable and then fighting it for a year. Pick against the four questions and you will be able to defend the choice in a design review — which, on a real team, is most of the job.`,
    },
  ],
  quiz: [
    {
      prompt: 'What problem does Tailwind’s `content` configuration (or v4 source detection) solve?',
      options: [
        'It lists the CSS files to import into the bundle',
        'It defines the theme scale for spacing and colour',
        'It tells the compiler which files to scan, so only the utilities you actually use are generated',
        'It sets the output path for the compiled stylesheet',
      ],
      correctIndex: 2,
      explanation:
        'Tailwind generates CSS from the class-name strings it finds by scanning source files. Files outside that scan contribute nothing, which is why a component can look fine in dev and ship unstyled if its path is missing.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which class list gives a single column on mobile and three columns from the `md` breakpoint up?',
      options: [
        'grid grid-cols-1 md:grid-cols-3',
        'grid grid-cols-3 md:grid-cols-1',
        'flex md:grid-cols-3',
        'grid sm:grid-cols-1 grid-cols-3',
      ],
      correctIndex: 0,
      explanation:
        'Tailwind breakpoints are min-width. The unprefixed utility is the mobile base case and `md:` overrides it at 768px and above. Option 1 inverts it; option 2 never sets `display: grid`.',
      difficulty: 'EASY',
    },
    {
      prompt: 'With `darkMode: \'class\'`, what makes `dark:bg-slate-900` take effect?',
      options: [
        'The operating system must be set to dark mode',
        'A `prefers-color-scheme: dark` media query must match',
        'The element must carry `data-theme="dark"`',
        'An ancestor element — usually `<html>` — must have the `dark` class',
      ],
      correctIndex: 3,
      explanation:
        'The `class` strategy compiles `dark:` variants to a `.dark` ancestor selector, so you control the switch in JS. The `media` strategy is the one driven by `prefers-color-scheme`.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Why is heavy use of `@apply` considered an anti-pattern in Tailwind?',
      options: [
        'It was removed in Tailwind v4',
        'It re-introduces invented class names and action-at-a-distance — the exact problems utility-first exists to remove',
        'It cannot be combined with any responsive or state variant',
        'It doubles the size of the production bundle',
      ],
      correctIndex: 1,
      explanation:
        '`@apply` still works and is fine for markup you do not control. But used broadly it recreates a growing, name-based stylesheet whose effects are invisible from the markup — which was the original problem.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'In Bootstrap 5, how do you read `class="col-12 col-md-6 col-lg-4"`?',
      options: [
        'Full width at every breakpoint',
        'One third below md and full width above lg',
        'Full width below md, half from md up, one third from lg up',
        'Invalid — only one `col-*` class is allowed per element',
      ],
      correctIndex: 2,
      explanation:
        'Bootstrap infixes are min-width, and stacking them is the intended usage. The unprefixed `col-12` is the mobile default; each larger infix overrides it from that breakpoint upward.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Which Sass at-rule replaces the deprecated `@import` and namespaces what it loads?',
      options: ['@use', '@forward', '@include', '@extend'],
      correctIndex: 0,
      explanation:
        '`@use` loads a module once and namespaces its members. `@forward` re-exports another module’s members (for building an index file), `@include` invokes a mixin and `@extend` merges selectors.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What is the correct way to change Bootstrap’s primary colour?',
      options: [
        'Override `.btn-primary` in a stylesheet loaded after Bootstrap',
        'Edit `node_modules/bootstrap/scss/_variables.scss`',
        'Add `!important` to your own `.btn-primary` rule',
        'Set `$primary` before importing Bootstrap’s Sass, so its `!default` value is overridden',
      ],
      correctIndex: 3,
      explanation:
        'Bootstrap declares variables with `!default`, meaning "use this only if not already set". Assigning `$primary` first re-generates every derived rule — buttons, links, alerts, borders — instead of patching one selector.',
      difficulty: 'HARD',
    },
    {
      prompt: 'What does the Tailwind class `top-[117px]` do?',
      options: [
        'Nothing — arbitrary values are invalid class names',
        'Generates a one-off utility with exactly that value at build time',
        'Declares a CSS custom property named `top`',
        'Applies an inline style attribute to the element',
      ],
      correctIndex: 1,
      explanation:
        'Square-bracket syntax is Tailwind’s escape hatch: the compiler emits a single rule with the literal value. Useful occasionally; dozens of them mean your theme scale does not match the design.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'tailwind-pricing-grid',
      title: 'Responsive Pricing Grid with Tailwind',
      difficulty: 'MEDIUM',
      runtime: 'html',
      statement: `Build the markup for a pricing section using Tailwind utility classes. Only the **classes and structure** are checked — the Tailwind stylesheet is not compiled in this sandbox, so nothing will look styled in the preview. That is expected.

Requirements:

1. A \`<section>\` with \`id="pricing"\` containing an \`<h2>\`.
2. Inside it, a \`<div>\` whose classes include \`grid\`, \`grid-cols-1\`, \`md:grid-cols-3\` and a \`gap-*\` utility.
3. Exactly **three** \`<article>\` elements as direct children of that grid.
4. Each card contains an \`<h3>\` and a \`<button>\`.
5. Every \`<button>\` includes a \`focus-visible:\` variant class (visible keyboard focus is not optional).
6. At least one element uses a \`dark:\` variant class.
7. The middle card is highlighted with a \`ring-\` utility.

Read the class strings as three separate statements: base (mobile), \`md:\` (tablet up), state variants.`,
      starterCode: `<section id="pricing">
  <h2>Pricing</h2>

  <div class="">
    <!-- three <article> cards go here -->
  </div>
</section>`,
      solutionCode: `<section id="pricing" class="mx-auto max-w-5xl px-4 py-16">
  <h2 class="text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
    Simple, honest pricing
  </h2>

  <div class="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
    <article class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Starter</h3>
      <p class="mt-2 text-3xl font-bold">$0</p>
      <ul class="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <li>1 project</li>
        <li>Community support</li>
      </ul>
      <button type="button" class="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:bg-slate-100 dark:text-slate-900">
        Get started
      </button>
    </article>

    <article class="rounded-xl border border-indigo-300 bg-white p-6 shadow-md ring-2 ring-indigo-500 dark:border-indigo-500 dark:bg-slate-800">
      <h3 class="text-lg font-semibold text-indigo-700 dark:text-indigo-300">Pro</h3>
      <p class="mt-2 text-3xl font-bold">$29<span class="text-base font-normal text-slate-500">/mo</span></p>
      <ul class="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <li>Unlimited projects</li>
        <li>Priority support</li>
      </ul>
      <button type="button" class="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        Start free trial
      </button>
    </article>

    <article class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Team</h3>
      <p class="mt-2 text-3xl font-bold">$99<span class="text-base font-normal text-slate-500">/mo</span></p>
      <ul class="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <li>SSO and audit log</li>
        <li>Dedicated success manager</li>
      </ul>
      <button type="button" class="mt-6 w-full rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:border-slate-600 dark:text-slate-100">
        Contact sales
      </button>
    </article>
  </div>
</section>`,
      hints: [
        'The grid container needs display: grid too — that is the bare `grid` class, alongside `grid-cols-1`.',
        'Breakpoints are min-width. `grid-cols-1` is the mobile case; `md:grid-cols-3` takes over at 768px.',
        'Gutters in Tailwind grid come from `gap-*`, not from margins on the children.',
        'Pair every colour utility with a `dark:` partner: `bg-white dark:bg-slate-800`.',
        'Use `focus-visible:ring-2` rather than removing the outline with nothing to replace it.',
      ],
      tests: [
        {
          name: 'has a <section id="pricing"> with an h2',
          assertion: "!!doc.querySelector('section#pricing') && !!doc.querySelector('section#pricing h2')",
        },
        {
          name: 'grid container declares grid + grid-cols-1 + md:grid-cols-3',
          assertion:
            "(() => { const g = doc.querySelector('.grid'); return !!g && g.classList.contains('grid-cols-1') && g.classList.contains('md:grid-cols-3'); })()",
        },
        {
          name: 'grid container has a gap-* utility',
          assertion:
            "(() => { const g = doc.querySelector('.grid'); return !!g && Array.from(g.classList).some(c => c.startsWith('gap-')); })()",
        },
        {
          name: 'exactly three <article> cards inside the grid',
          assertion: "doc.querySelectorAll('.grid > article').length === 3",
        },
        {
          name: 'every card has an h3 and a button',
          assertion:
            "Array.from(doc.querySelectorAll('.grid > article')).every(a => !!a.querySelector('h3') && !!a.querySelector('button')) && doc.querySelectorAll('.grid > article').length === 3",
        },
        {
          name: 'every button has a focus-visible: variant',
          assertion:
            "doc.querySelectorAll('button').length > 0 && Array.from(doc.querySelectorAll('button')).every(b => Array.from(b.classList).some(c => c.startsWith('focus-visible:')))",
        },
        {
          name: 'at least one dark: variant is used',
          assertion:
            "Array.from(doc.querySelectorAll('*')).some(el => Array.from(el.classList || []).some(c => c.startsWith('dark:')))",
          hidden: true,
        },
        {
          name: 'the featured card uses a ring-* utility',
          assertion:
            "Array.from(doc.querySelectorAll('.grid > article')).some(a => Array.from(a.classList).some(c => c.startsWith('ring-')))",
          hidden: true,
        },
      ],
      xp: 60,
    },
    {
      slug: 'bootstrap-responsive-layout',
      title: 'Bootstrap Grid, Navbar & Utility Classes',
      difficulty: 'MEDIUM',
      runtime: 'html',
      statement: `Rebuild a marketing page header and feature row using Bootstrap 5 conventions. Bootstrap's CSS is not loaded in this sandbox, so the preview will look unstyled — the tests check that you used the right structure and class names.

Requirements:

1. A \`<nav>\` with classes \`navbar\` and \`navbar-expand-lg\`, containing a \`.navbar-brand\`.
2. A \`<button class="navbar-toggler">\` with \`data-bs-toggle="collapse"\`, \`data-bs-target="#mainNav"\`, \`aria-controls="mainNav"\`, \`aria-expanded="false"\` and an \`aria-label\`.
3. A \`<div id="mainNav">\` with classes \`collapse\` and \`navbar-collapse\`, holding a \`ul.navbar-nav\` with at least two \`li.nav-item > a.nav-link\`.
4. A \`.container\` wrapping a \`.row\` that has a gutter class (\`g-*\`).
5. Exactly **three** columns, each with \`col-12\` plus at least one responsive column class (\`col-md-*\` or \`col-lg-*\`).
6. Each column contains a \`.card\` with a \`.card-body\`, a \`.card-title\` and a \`.card-text\`.
7. Somewhere in the markup, use the utility trio \`d-flex\`, \`justify-content-between\` and \`align-items-center\` on one element.`,
      starterCode: `<nav class="navbar navbar-expand-lg">
  <!-- brand, toggler, collapsible menu -->
</nav>

<div class="container">
  <!-- .row with three responsive columns of cards -->
</div>`,
      solutionCode: `<nav class="navbar navbar-expand-lg bg-body-tertiary">
  <div class="container d-flex justify-content-between align-items-center">
    <a class="navbar-brand" href="/">CodeNinja</a>

    <button class="navbar-toggler" type="button"
            data-bs-toggle="collapse" data-bs-target="#mainNav"
            aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>

    <div class="collapse navbar-collapse" id="mainNav">
      <ul class="navbar-nav ms-auto">
        <li class="nav-item"><a class="nav-link active" aria-current="page" href="/">Home</a></li>
        <li class="nav-item"><a class="nav-link" href="/pricing">Pricing</a></li>
        <li class="nav-item"><a class="nav-link" href="/docs">Docs</a></li>
      </ul>
    </div>
  </div>
</nav>

<div class="container py-5">
  <div class="row g-4">
    <div class="col-12 col-md-6 col-lg-4">
      <div class="card h-100">
        <div class="card-body">
          <h5 class="card-title">Ship faster</h5>
          <p class="card-text">Prebuilt, accessible components so you are not rebuilding a modal again.</p>
        </div>
      </div>
    </div>

    <div class="col-12 col-md-6 col-lg-4">
      <div class="card h-100">
        <div class="card-body">
          <h5 class="card-title">Responsive by default</h5>
          <p class="card-text">A twelve column grid with six breakpoints and gutter utilities.</p>
        </div>
      </div>
    </div>

    <div class="col-12 col-md-6 col-lg-4">
      <div class="card h-100">
        <div class="card-body">
          <h5 class="card-title">Themeable</h5>
          <p class="card-text">Override Sass variables before the import and the whole system re-themes.</p>
        </div>
      </div>
    </div>
  </div>
</div>`,
      hints: [
        'The toggler needs both data-bs-target and aria-controls, and they must point at the id of the collapsible div.',
        'Bootstrap requires the container -> row -> col nesting. A column outside a row will be misaligned.',
        'Gutters come from g-*, gx-* or gy-* on the row — never add margins to the columns.',
        'col-12 is the mobile base; col-md-6 and col-lg-4 override it upward.',
        'h-100 on the card is what makes all three cards the same height.',
      ],
      tests: [
        {
          name: 'navbar has navbar-expand-lg and a brand',
          assertion:
            "!!doc.querySelector('nav.navbar.navbar-expand-lg') && !!doc.querySelector('.navbar-brand')",
        },
        {
          name: 'toggler is wired to #mainNav',
          assertion:
            "(() => { const t = doc.querySelector('button.navbar-toggler'); return !!t && t.getAttribute('data-bs-toggle') === 'collapse' && t.getAttribute('data-bs-target') === '#mainNav' && t.getAttribute('aria-controls') === 'mainNav'; })()",
        },
        {
          name: 'toggler is accessible (aria-expanded + a name)',
          assertion:
            "(() => { const t = doc.querySelector('button.navbar-toggler'); return !!t && t.getAttribute('aria-expanded') === 'false' && (t.hasAttribute('aria-label') || t.textContent.trim().length > 0); })()",
        },
        {
          name: 'collapse target exists and holds a navbar-nav',
          assertion:
            "!!doc.querySelector('#mainNav.collapse.navbar-collapse') && doc.querySelectorAll('#mainNav ul.navbar-nav li.nav-item a.nav-link').length >= 2",
        },
        {
          name: 'container > row with a gutter class',
          assertion:
            "(() => { const r = doc.querySelector('.container .row'); return !!r && Array.from(r.classList).some(c => /^g[xy]?-\\d$/.test(c)); })()",
        },
        {
          name: 'exactly three responsive columns',
          assertion:
            "(() => { const cols = Array.from(doc.querySelectorAll('.row > .col-12')); return cols.length === 3 && cols.every(c => Array.from(c.classList).some(x => x.startsWith('col-md-') || x.startsWith('col-lg-'))); })()",
        },
        {
          name: 'each column holds a card with title and text',
          assertion:
            "Array.from(doc.querySelectorAll('.row > .col-12')).every(c => !!c.querySelector('.card .card-body .card-title') && !!c.querySelector('.card .card-body .card-text'))",
          hidden: true,
        },
        {
          name: 'uses the d-flex / justify-content-between / align-items-center trio',
          assertion:
            "!!doc.querySelector('.d-flex.justify-content-between.align-items-center')",
          hidden: true,
        },
      ],
      xp: 65,
    },
  ],
  flashcards: [
    {
      front: 'Why does Tailwind not generate CSS for `` `text-${color}-500` ``?',
      back: 'The compiler text-scans source files for complete class strings; it never evaluates your JS. Map states to full literal class strings instead.',
      tags: ['tailwind', 'gotcha'],
    },
    {
      front: '`theme.colors` vs `theme.extend.colors` in a Tailwind config',
      back: '`extend` adds to the defaults. A bare `theme.colors` **replaces** the entire default palette — every built-in colour utility disappears.',
      tags: ['tailwind', 'config'],
    },
    {
      front: 'Tailwind `darkMode: \'media\'` vs `\'class\'`',
      back: '`media` follows `prefers-color-scheme` with zero JS and no user override. `class` compiles `dark:` to a `.dark` ancestor so you can ship a toggle — set it before first paint to avoid a flash.',
      tags: ['tailwind', 'dark-mode'],
    },
    {
      front: 'What does `md:grid-cols-3` actually mean?',
      back: 'Three columns at 768px **and above**. All Tailwind and Bootstrap breakpoints are min-width, so unprefixed utilities are the mobile base case.',
      tags: ['tailwind', 'responsive'],
    },
    {
      front: 'When is `@apply` justified?',
      back: 'When you do not control the markup (Markdown output, third-party widgets) or for one global primitive like a focus ring. Otherwise make a component — `@apply` re-creates the naming and action-at-a-distance problems.',
      tags: ['tailwind', 'architecture'],
    },
    {
      front: 'Why `twMerge` instead of string concatenation?',
      back: 'Concatenating leaves `"px-2 px-4"` in the class list and the browser resolves it by stylesheet source order, not your intent. `tailwind-merge` removes the losing conflict so the later class wins.',
      tags: ['tailwind', 'tooling'],
    },
    {
      front: 'Bootstrap: what does `g-4` on a `.row` do?',
      back: 'Sets the gutter (spacing between columns) via padding and negative margins. Use `gx-*` / `gy-*` for one axis. Never add margin to `.col-*` — it breaks the 12-unit maths.',
      tags: ['bootstrap', 'grid'],
    },
    {
      front: 'The correct way to retheme Bootstrap',
      back: 'Assign the Sass variables (`$primary`, `$border-radius`) *before* importing Bootstrap. Its variables are declared `!default`, so yours win and every derived rule regenerates.',
      tags: ['bootstrap', 'sass', 'theming'],
    },
    {
      front: 'What do `data-bs-toggle` and `data-bs-target` do?',
      back: 'They are Bootstrap’s declarative JS API — collapse, modal, dropdown and tabs wire themselves up from these attributes, provided `bootstrap.bundle.js` is loaded.',
      tags: ['bootstrap', 'components'],
    },
    {
      front: 'Sass variable vs CSS custom property — how to choose',
      back: 'Sass (`$x`) for build-time values the compiler computes with (breakpoints, scales, colour maths). CSS custom properties (`--x`) for anything that changes at runtime, e.g. themes. Media queries cannot read custom properties.',
      tags: ['sass', 'css'],
    },
    {
      front: '`@use` vs `@import` in Sass',
      back: '`@import` is deprecated: global scope, duplicated output when a file is loaded twice. `@use` loads once, namespaces members, and supports explicit `with (...)` configuration.',
      tags: ['sass', 'modules'],
    },
    {
      front: 'Why prefer a mixin over `@extend`?',
      back: '`@extend` merges selector lists, which reorders your CSS unpredictably and cannot cross `@media` boundaries. Mixins emit exactly where you call them. Use `%placeholder` + `@extend` only for genuinely shared, media-free chunks.',
      tags: ['sass', 'architecture'],
    },
  ],
  resources: [
    { label: 'Tailwind CSS — Documentation', url: 'https://tailwindcss.com/docs', kind: 'DOCS' },
    {
      label: 'Bootstrap 5.3 — Layout & Grid',
      url: 'https://getbootstrap.com/docs/5.3/layout/grid/',
      kind: 'DOCS',
    },
    {
      label: 'Bootstrap 5.3 — Utility API',
      url: 'https://getbootstrap.com/docs/5.3/utilities/api/',
      kind: 'DOCS',
    },
    { label: 'Sass — Documentation', url: 'https://sass-lang.com/documentation/', kind: 'DOCS' },
    {
      label: 'Sass — The Module System (@use / @forward)',
      url: 'https://sass-lang.com/documentation/at-rules/use/',
      kind: 'DOCS',
    },
  ],
};

export default day;
