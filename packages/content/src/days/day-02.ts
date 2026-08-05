import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 2,
  week: 1,
  pillar: 'FRONTEND',
  title: 'CSS3: Box Model, Flexbox & Grid',
  summary: 'Stop fighting the layout engine — learn the rules it is actually following.',
  estimatedMinutes: 300,
  objectives: [
    'Predict the size of any box from its content, padding, border and box-sizing',
    'Resolve a style conflict by walking the cascade and computing specificity by hand',
    'Choose the right unit — rem, em, ch, vw, %, clamp() — for the job',
    'Lay out a one-dimensional component with Flexbox and a page with CSS Grid',
    'Debug a z-index that "does nothing" by finding the stacking context',
    'Make a component responsive with media queries, container queries and custom properties',
  ],
  technologies: ['CSS3'],
  lessons: [
    {
      slug: 'box-model-and-units',
      title: 'The Box Model, Sizing & Units',
      estimatedMinutes: 60,
      body: `# The Box Model, Sizing & Units

Every element the browser renders is a rectangle. CSS layout is, at bottom, arithmetic on rectangles — and almost every "why is this 30px too wide?" bug comes from getting that arithmetic wrong.

## Four boxes, not one

From the inside out: **content → padding → border → margin**.

\`\`\`css
.card {
  width: 300px;
  padding: 20px;
  border: 2px solid #333;
  margin: 16px;
}
\`\`\`

Under the default \`box-sizing: content-box\`, \`width\` sizes the **content box only**. The rendered element occupies:

\`300 (content) + 40 (padding) + 4 (border) = 344px\`

...plus 32px of margin pushing neighbours away. You asked for 300 and got 344. Now add a border on hover and the layout jumps.

## The one-line fix everyone ships

\`\`\`css
*,
*::before,
*::after {
  box-sizing: border-box;
}
\`\`\`

With \`border-box\`, \`width: 300px\` means *the border box is 300px* — padding and border grow inward. Now \`width: 100%\` plus \`padding: 20px\` fits its parent instead of overflowing it. This is the single most valuable line in any CSS reset. Note it does **not** include margin: margin is always outside the box.

## Margins collapse (and that surprises people)

Adjacent **vertical** margins between block siblings collapse to the larger of the two, not the sum:

\`\`\`css
.a { margin-bottom: 30px; }
.b { margin-top: 20px; }
/* gap between .a and .b is 30px, not 50px */
\`\`\`

Worse, a child's top margin can escape its parent if the parent has no padding, border or new formatting context. Collapsing does **not** happen inside a flex or grid container — which is one more reason modern layouts use \`gap\` instead of margins.

> Rule of thumb: prefer \`gap\` on the container over \`margin\` on the children. Gap never collapses, never leaks, and never leaves a trailing margin on the last item.

## Sizing keywords worth knowing

| Property | What it does |
| --- | --- |
| \`width: 100%\` | 100% of the *containing block's* content width |
| \`max-width: 60ch\` | caps line length for readability |
| \`min-height: 100vh\` | at least a full viewport tall |
| \`width: min-content\` | as narrow as the longest unbreakable word |
| \`width: fit-content\` | shrink-to-fit, capped by available space |
| \`aspect-ratio: 16 / 9\` | derive one dimension from the other |

\`\`\`css
.prose {
  width: min(100% - 2rem, 65ch);
  margin-inline: auto;
}
\`\`\`

That is a whole responsive container in two declarations: never wider than 65 characters, never touching the viewport edge, always centred.

## Units: absolute, relative, viewport

- **\`px\`** — a CSS pixel. Predictable, but ignores the user's browser font-size setting.
- **\`rem\`** — relative to the **root** font size. Change \`html { font-size }\` and the whole system scales. Use it for font sizes, spacing, radii.
- **\`em\`** — relative to the **element's own** font size (or the parent's, for \`font-size\` itself). It compounds: nest three \`font-size: 0.9em\` elements and you are at 0.729. Useful *deliberately* — \`padding: 0.5em 1em\` on a button scales with its label.
- **\`ch\`** — the width of the "0" glyph. The correct unit for line-length limits.
- **\`%\`** — relative to a different property depending on context. \`padding-top: 50%\` resolves against the containing block's **width**, not height.
- **\`vw\`/\`vh\`/\`dvh\`** — viewport units. Prefer \`dvh\` for full-height mobile layouts; \`100vh\` ignores the collapsing mobile URL bar.

### clamp() replaces most media queries for type

\`\`\`css
h1 {
  font-size: clamp(1.75rem, 1.25rem + 2.5vw, 3rem);
}
\`\`\`

Read it as **clamp(minimum, preferred, maximum)**. The preferred value mixes a \`rem\` base with a \`vw\` term so the heading scales smoothly between breakpoints, but never below 1.75rem or above 3rem. Keeping a \`rem\` component in the middle argument is important: a pure \`vw\` value cannot be zoomed by the user, which is an accessibility failure.

## Display drives everything else

\`display\` decides which layout algorithm applies to a box's children and how the box itself participates in its parent.

\`\`\`css
.inline-el   { display: inline; }        /* width/height ignored, vertical padding overlaps */
.block-el    { display: block; }         /* full width of container, respects all box props */
.inline-blk  { display: inline-block; }  /* flows inline, but sizable */
.row         { display: flex; }
.page        { display: grid; }
.hidden      { display: none; }          /* removed from layout AND the a11y tree */
\`\`\`

Setting \`width\` on a \`display: inline\` element does nothing at all — a classic five-minute bug. And \`display: none\` is not the same as \`visibility: hidden\` (keeps its space) or \`opacity: 0\` (keeps its space *and* stays clickable and focusable).

Get these fundamentals right and the rest of CSS stops feeling random.`,
    },
    {
      slug: 'cascade-specificity-custom-properties',
      title: 'The Cascade, Specificity, Inheritance & Custom Properties',
      estimatedMinutes: 70,
      body: `# The Cascade, Specificity, Inheritance & Custom Properties

CSS is a *conflict resolution* language. Ten rules can target the same element; the cascade decides which declaration wins. If you can compute that by hand you will never write \`!important\` out of desperation again.

## The cascade, in order

For a given element and property, the browser sorts every matching declaration by:

1. **Origin and importance** — user-agent < user < author, and \`!important\` *reverses* that order.
2. **Cascade layers** (\`@layer\`) — later layers beat earlier layers.
3. **Inline style** (\`style="..."\`) — beats any selector in the same layer.
4. **Specificity** — the tie-breaker everyone actually uses.
5. **Source order** — last one wins.

Note that specificity is only step 4. An \`!important\` in a lower layer still beats a high-specificity rule in a higher one.

## Computing specificity

Specificity is a three-part tuple **(A, B, C)** compared left to right:

| Component | Counts |
| --- | --- |
| **A** — ids | \`#header\` |
| **B** — classes, attributes, pseudo-classes | \`.btn\`, \`[type="text"]\`, \`:hover\` |
| **C** — element types and pseudo-elements | \`div\`, \`::before\` |

\`\`\`css
a                          /* (0,0,1) */
.nav a                     /* (0,1,1) */
nav ul li a.active         /* (0,1,4) */
#site-nav a                /* (1,0,1)  <-- beats all of the above */
\`\`\`

A single id beats a hundred classes: (1,0,1) > (0,1,4) because A is compared first. Specificity is **not** a base-10 number, and it is **not** about how deep or long the selector looks.

Three selectors behave specially:

- \`:where(...)\` always contributes **zero** specificity.
- \`:is(...)\` and \`:not(...)\` take the specificity of their *most specific* argument.

\`\`\`css
/* easy to override later — great for defaults in a design system */
:where(.card) h2 { margin-block: 0; }

/* (0,1,1): the .promo inside :is() counts */
:is(.promo, article) h2 { color: rebeccapurple; }
\`\`\`

## Inheritance and the two magic keywords

Some properties inherit by default (\`color\`, \`font-*\`, \`line-height\`, \`visibility\`, \`cursor\`); most do not (\`border\`, \`padding\`, \`display\`, \`background\`). You can force either behaviour:

\`\`\`css
button {
  font: inherit;   /* buttons do NOT inherit font by default — always do this */
  color: inherit;
}

.reset { all: unset; }  /* inherited props -> inherit, everything else -> initial */
\`\`\`

\`inherit\`, \`initial\`, \`unset\` and \`revert\` are valid for *every* property. \`revert\` is the useful one when you want the browser's own default back rather than the spec's initial value.

## Cascade layers make override order explicit

\`\`\`css
@layer reset, base, components, utilities;

@layer components {
  #super .specific .button { background: navy; }
}

@layer utilities {
  .bg-red { background: red; }   /* wins: later layer, despite lower specificity */
}
\`\`\`

This is how utility frameworks guarantee a one-class utility can override a deeply nested component rule without \`!important\`.

## Custom properties are variables that cascade

\`\`\`css
:root {
  --brand: #4f46e5;
  --space: 8px;
  --radius: 6px;
}

.card {
  padding: calc(var(--space) * 2);
  border-radius: var(--radius);
  background: var(--surface, white); /* second arg is the fallback */
}

.card--danger {
  --brand: #dc2626;   /* re-point the variable for this subtree */
}
\`\`\`

Two things make custom properties different from Sass variables:

1. **They are live and inherited.** Redefining \`--brand\` on \`.card--danger\` changes every descendant that reads it — no recompilation, no extra class per property.
2. **They are resolved at computed-value time**, so JavaScript and media queries can change them at runtime:

\`\`\`js
document.documentElement.style.setProperty('--brand', '#059669');
\`\`\`

\`\`\`css
@media (prefers-color-scheme: dark) {
  :root { --surface: #111827; --text: #f9fafb; }
}
\`\`\`

That is an entire theming system with no JavaScript and no duplicated rules.

## Transitions: cheap polish, done correctly

\`\`\`css
.button {
  background: var(--brand);
  transform: translateY(0);
  transition: transform 150ms ease-out, background-color 150ms ease-out;
}
.button:hover { transform: translateY(-2px); }

@media (prefers-reduced-motion: reduce) {
  .button { transition: none; }
}
\`\`\`

Only animate \`transform\` and \`opacity\` when you care about frame rate — they can be handled by the compositor without re-running layout or paint. Animating \`width\`, \`top\` or \`margin\` forces layout on every frame. And never use \`transition: all\`: it silently animates properties you did not intend, including ones added later.

> A transition needs a **starting value** to interpolate from. Transitioning to or from \`auto\` (height, width) does not work — use \`max-height\`, a \`grid-template-rows: 0fr → 1fr\` trick, or the modern \`interpolate-size: allow-keywords\`.`,
    },
    {
      slug: 'flexbox',
      title: 'Flexbox — One-Dimensional Layout',
      estimatedMinutes: 80,
      body: `# Flexbox — One-Dimensional Layout

Flexbox distributes space along **one axis**. If you are lining up a row of things, or stacking a column and pushing one item to the bottom, this is the tool. If you need rows *and* columns to align with each other, that is Grid.

## Main axis and cross axis — the only concept that matters

\`flex-direction\` chooses the **main axis**; the **cross axis** is perpendicular to it.

| flex-direction | Main axis | Cross axis |
| --- | --- | --- |
| \`row\` (default) | left → right | top → bottom |
| \`column\` | top → bottom | left → right |

Every other property is named after an axis:

- \`justify-content\` — distributes free space along the **main** axis.
- \`align-items\` — aligns items on the **cross** axis.
- \`align-content\` — distributes **wrapped lines** on the cross axis (does nothing without \`flex-wrap: wrap\`).
- \`align-self\` — overrides \`align-items\` for one item.

Switch \`flex-direction\` to \`column\` and \`justify-content: center\` now centres *vertically*. That is not a special case; it is the same rule with a rotated axis.

\`\`\`css
.header {
  display: flex;
  align-items: center;          /* vertical centring, cross axis */
  justify-content: space-between; /* push brand left, actions right */
  gap: 16px;
}
\`\`\`

## The container properties

\`\`\`css
.container {
  display: flex;              /* or inline-flex */
  flex-direction: row;        /* row | row-reverse | column | column-reverse */
  flex-wrap: wrap;            /* nowrap (default) | wrap */
  gap: 16px 24px;             /* row-gap column-gap */
  justify-content: space-between;
  align-items: stretch;       /* stretch | flex-start | center | flex-end | baseline */
}
\`\`\`

\`flex-flow: row wrap\` is the shorthand for direction + wrap.

> The default \`flex-wrap: nowrap\` is why your flex row overflows instead of wrapping on mobile. Items shrink until they hit \`min-content\`, then they blow out of the container.

## The item properties, and the \`flex\` shorthand

\`\`\`css
.item {
  flex: 1 1 200px;   /* grow shrink basis */
}
\`\`\`

- **\`flex-grow\`** — share of *leftover* space this item claims. \`0\` means "never grow".
- **\`flex-shrink\`** — share of the *overflow* it absorbs. Default is \`1\`, so items shrink by default.
- **\`flex-basis\`** — the size the item starts at before growing or shrinking. \`auto\` means "use my \`width\`/\`height\`".

The single-value shorthands are worth memorising because they expand unintuitively:

| Shorthand | Expands to | Meaning |
| --- | --- | --- |
| \`flex: 1\` | \`1 1 0%\` | equal-width columns, content size ignored |
| \`flex: auto\` | \`1 1 auto\` | grow, but start from content size |
| \`flex: none\` | \`0 0 auto\` | fixed at content size, never shrink |
| \`flex: 0 1 auto\` | *(the default)* | shrink-only |

\`flex: 1\` versus \`flex: auto\` is the classic interview question. With \`flex: 1\` the basis is \`0\`, so *all* space is free space and every item ends up the same width. With \`flex: auto\` each item keeps its content width and only the surplus is shared, so a longer label yields a wider column.

## Patterns you will use constantly

**Sticky footer without extra markup:**

\`\`\`css
body { min-height: 100dvh; display: flex; flex-direction: column; }
main { flex: 1; }              /* soaks up all leftover vertical space */
\`\`\`

**Push one item to the far end:**

\`\`\`css
.nav { display: flex; gap: 16px; }
.nav .login { margin-left: auto; }   /* auto margin eats all free space */
\`\`\`

An \`auto\` margin on a flex item absorbs free space before \`justify-content\` is applied — often cleaner than restructuring the DOM.

**Responsive card row with no media query:**

\`\`\`css
.cards { display: flex; flex-wrap: wrap; gap: 16px; }
.cards > * { flex: 1 1 260px; }   /* min 260px, then wrap */
\`\`\`

**Perfect centring:**

\`\`\`css
.center { display: flex; align-items: center; justify-content: center; }
\`\`\`

## Gotchas that cost real time

1. **\`align-items: center\` kills \`stretch\`.** Equal-height cards come from the default \`stretch\`; centring them makes each card only as tall as its content.
2. **\`min-width: auto\`.** A flex item will not shrink below its content's minimum size. Long words or a \`<pre>\` block will force overflow until you add \`min-width: 0\` (or \`overflow: hidden\`) to the item. This is *the* fix for "my flex child ignores its parent's width".
3. **\`flex-basis\` beats \`width\`** when both are set on a row item.
4. **Percentage \`gap\`** resolves against the container's own size on the corresponding axis — usually not what you want. Use \`rem\`.
5. **Order is visual only.** \`order: -1\` moves an item visually but not in the DOM, so keyboard tab order and screen-reader reading order stay in source order. Use it sparingly.

Flexbox is content-driven: you describe how items should *behave*, and their content decides the final sizes. Grid is the opposite — you draw the tracks first.`,
    },
    {
      slug: 'grid-stacking-responsive',
      title: 'Grid, Stacking Contexts & Responsive Design',
      estimatedMinutes: 90,
      body: `# Grid, Stacking Contexts & Responsive Design

## Grid is two-dimensional

You define **tracks** (rows and columns) on the container, then place items into them. Unlike Flexbox, the container's structure exists independently of the items.

\`\`\`css
.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: auto 1fr auto;
  min-height: 100dvh;
  gap: 16px;
}
\`\`\`

\`fr\` is a *fraction of leftover space*, taken after fixed tracks and gaps are subtracted. \`grid-template-columns: 1fr 2fr\` splits the remainder one-third / two-thirds.

## Named areas: layout you can read

\`\`\`css
.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-areas:
    "header  header"
    "sidebar main"
    "footer  footer";
}

.layout > header  { grid-area: header; }
.layout > aside   { grid-area: sidebar; }
.layout > main    { grid-area: main; }
.layout > footer  { grid-area: footer; }
\`\`\`

The ASCII drawing *is* the layout. Rearranging the page for mobile is then a four-line media query that redefines the areas — the HTML never changes, which is exactly what you want for accessibility.

You can also place items by line number, which is what \`grid-area\` expands to:

\`\`\`css
.hero {
  grid-column: 1 / 3;      /* from line 1 to line 3, i.e. two tracks */
  grid-column: span 2;     /* same thing, relative */
  grid-row: 1 / -1;        /* first line to LAST line — negative counts backwards */
}
\`\`\`

## minmax, auto-fit and auto-fill

\`\`\`css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}
\`\`\`

Read it inside out: each column is at least 240px and at most one fraction of the free space; \`repeat(auto-fit, ...)\` creates as many such columns as fit. That is a fully responsive card grid with **zero media queries**.

The \`auto-fit\` versus \`auto-fill\` difference bites everyone exactly once:

- **\`auto-fill\`** keeps the empty tracks it created. Three cards in a 1200px container leave two empty columns, and the cards stay 240px wide.
- **\`auto-fit\`** collapses empty tracks to zero, so the three cards stretch to fill the row.

Want cards that never stretch absurdly wide on a 4K monitor? \`minmax(240px, 400px)\` — but note the maximum must be a fixed length for the row to still fill, so pair it with \`justify-content: center\` on the container.

> \`minmax(200px, 1fr)\` overflows a container narrower than 200px, because the minimum is a hard floor. Use \`minmax(min(200px, 100%), 1fr)\` to stay safe on tiny screens.

## Alignment in Grid

Grid has both axes, so alignment properties come in pairs:

| Axis | Align the **tracks** | Align **items in their cell** |
| --- | --- | --- |
| Inline (row) | \`justify-content\` | \`justify-items\` / \`justify-self\` |
| Block (column) | \`align-content\` | \`align-items\` / \`align-self\` |

\`place-items: center\` is the shorthand for both — the shortest true centring in CSS:

\`\`\`css
.hero { display: grid; place-items: center; min-height: 60dvh; }
\`\`\`

## Positioning and stacking contexts

\`position\` takes an element out of, or offsets it within, normal flow:

- \`static\` — default, ignores \`top\`/\`left\`.
- \`relative\` — offset from where it would have been; **still occupies its original space** and becomes a containing block for absolute children.
- \`absolute\` — removed from flow, positioned against the nearest *positioned* ancestor.
- \`fixed\` — positioned against the viewport (unless an ancestor has \`transform\`, \`filter\` or \`will-change\` — then it is trapped by that ancestor).
- \`sticky\` — relative until a scroll threshold, then fixed within its parent. It needs an offset (\`top: 0\`) and a parent that is not \`overflow: hidden\`.

\`\`\`css
.toolbar { position: sticky; top: 0; z-index: 10; }
.badge   { position: absolute; inset-block-start: -8px; inset-inline-end: -8px; }
\`\`\`

### Why your z-index does nothing

\`z-index\` only compares siblings **inside the same stacking context**. A new stacking context is created by, among others:

- \`position\` other than \`static\` **with** a \`z-index\` other than \`auto\`
- \`opacity\` less than 1
- \`transform\`, \`filter\`, \`perspective\`, \`backdrop-filter\`
- \`isolation: isolate\`, \`will-change\`, \`mix-blend-mode\`
- being a flex/grid item with a \`z-index\`

So a modal with \`z-index: 9999\` still hides behind a header if the modal's ancestor has \`opacity: 0.99\` and sits earlier in the DOM: the ancestor's context is painted as one unit, and 9999 only ranks the modal *within* it. The fix is never a bigger number — it is moving the element out of that context (a portal) or adding \`isolation: isolate\` to control where contexts begin.

## Media queries and container queries

\`\`\`css
/* Mobile-first: base styles, then enhance upward. */
.layout { grid-template-areas: "header" "main" "sidebar" "footer"; }

@media (min-width: 48rem) {
  .layout {
    grid-template-columns: 240px 1fr;
    grid-template-areas: "header header" "sidebar main" "footer footer";
  }
}

@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
\`\`\`

Media queries ask about the **viewport**, which is the wrong question for a reusable component — the same card may sit in a 320px sidebar and a 900px main column. Container queries ask about the **parent**:

\`\`\`css
.card-wrapper { container-type: inline-size; container-name: card; }

@container card (min-width: 400px) {
  .card { display: grid; grid-template-columns: 120px 1fr; }
}
\`\`\`

The element you query must be an ancestor, not the element itself, and \`container-type: inline-size\` makes that ancestor's block size content-driven — so never put it on something you also want to size from its children vertically.

Grid for the page, Flexbox for the components, container queries for anything reused: that is the modern layout stack.`,
    },
  ],
  quiz: [
    {
      prompt:
        'An element has `width: 200px; padding: 16px; border: 4px solid;` and the page applies `box-sizing: border-box`. How wide is its border box?',
      options: ['240px', '160px', '200px', '204px'],
      correctIndex: 2,
      explanation:
        'With `border-box`, `width` measures the border box itself, so padding and border grow inward: the element renders exactly 200px wide and the content box shrinks to 200 - 32 - 8 = 160px. Under the default `content-box` it would have been 240px.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Which selector wins for `color` on `<a class="active" id="home">`?',
      options: [
        '#home { color: red }',
        'nav ul li a.active:hover { color: blue }',
        'a.active { color: green }',
        'The last one in the stylesheet always wins',
      ],
      correctIndex: 0,
      explanation:
        'Specificity is a tuple compared left to right. `#home` is (1,0,0); `nav ul li a.active:hover` is only (0,2,4). A single id beats any number of classes and elements, so source order never gets consulted.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What is the practical difference between `flex: 1` and `flex: auto` on every child of a flex row?',
      options: [
        'They are identical aliases',
        '`flex: 1` prevents shrinking while `flex: auto` allows it',
        '`flex: auto` centres the items on the main axis',
        '`flex: 1` sets flex-basis to 0 so all items end up equal width; `flex: auto` keeps each item’s content width and shares only the surplus',
      ],
      correctIndex: 3,
      explanation:
        '`flex: 1` expands to `1 1 0%` — the basis is zero, so the entire container is free space and it is split equally. `flex: auto` expands to `1 1 auto`, so each item starts at its content size and only the leftover is distributed, making longer content wider.',
      difficulty: 'MEDIUM',
    },
    {
      prompt:
        'A card grid uses `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))`. Three cards sit in a 1200px container. What do you see?',
      options: [
        'Three cards each 400px wide, filling the row',
        'Three cards of 240px each, with the remaining tracks left empty',
        'Three cards stacked vertically',
        'A single 1200px-wide card row that overflows',
      ],
      correctIndex: 1,
      explanation:
        '`auto-fill` creates every track that fits (here, four) and keeps the empty ones, so the cards stay near their minimum. `auto-fit` collapses the empty tracks to zero width, letting the three cards stretch to 400px each. That is the whole difference between the two keywords.',
      difficulty: 'HARD',
    },
    {
      prompt: 'A modal has `z-index: 9999` but still renders behind the site header. What is the most likely cause?',
      options: [
        'The header needs `position: static`',
        'z-index only works on grid items',
        'An ancestor of the modal creates its own stacking context (via opacity, transform or filter), so 9999 only ranks the modal inside that context',
        'The z-index value exceeds the browser maximum and wraps around',
      ],
      correctIndex: 2,
      explanation:
        '`z-index` only orders siblings within a single stacking context. Properties like `opacity < 1`, `transform` and `filter` create a new context whose entire subtree is painted as one unit, so the fix is to relocate the modal or use `isolation: isolate` — never a larger number.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Why is `font-size: clamp(1.75rem, 1.25rem + 2.5vw, 3rem)` preferred over `font-size: 5vw`?',
      options: [
        'It has floor and ceiling limits, and the rem term keeps the text zoomable for users who rely on it',
        'Because `vw` is not supported in Safari',
        'Because clamp() renders faster',
        'Because `vw` units cannot be used on text',
      ],
      correctIndex: 0,
      explanation:
        'A pure viewport unit gives unbounded sizes and, critically, does not respond to browser zoom or user font-size settings — a WCAG 1.4.4 failure. Mixing a `rem` component into clamp()’s preferred value restores that behaviour while keeping fluid scaling between the bounds.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why do container queries exist when we already have media queries?',
      options: [
        'They are faster to evaluate than media queries',
        'They replace media queries entirely in modern browsers',
        'They query print and screen media separately',
        'They size a component against its parent element rather than the viewport, so the same component works in a narrow sidebar and a wide main column',
      ],
      correctIndex: 3,
      explanation:
        'A media query only knows the viewport size, which says nothing about the space a reusable component was actually given. `container-type: inline-size` on an ancestor plus `@container` lets the component adapt to its own available width.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'A flex item containing a very long unbroken string overflows its container. What is the standard fix?',
      options: [
        'Set `flex-wrap: wrap` on the container',
        'Set `min-width: 0` on the flex item, because its automatic minimum size is its content size',
        'Set `overflow: scroll` on the body',
        'Set `flex-shrink: 0` on the item',
      ],
      correctIndex: 1,
      explanation:
        'Flex items get `min-width: auto`, which resolves to the content’s minimum size and stops shrinking there. Explicitly setting `min-width: 0` (or `overflow: hidden`) lets the item shrink below that and allows text-truncation to work.',
      difficulty: 'HARD',
    },
  ],
  problems: [
    {
      slug: 'border-box-token-card',
      title: 'A Predictable Card with Design Tokens',
      difficulty: 'EASY',
      runtime: 'html',
      statement: `Build a card whose width is exactly what you asked for, driven by custom properties.

Write markup **and** a \`<style>\` block that satisfies all of the following:

1. A universal reset sets \`box-sizing: border-box\` on \`*\`, \`*::before\` and \`*::after\`.
2. \`:root\` declares at least two custom properties, one of which is named \`--card-pad\` with the value \`16px\`.
3. An element with class \`card\` that:
   - has \`box-sizing: border-box\`
   - uses \`padding: var(--card-pad)\` (do not hard-code 16px on the card)
   - has a visible \`border\`
4. Inside the card, an \`<h2>\` and a \`<p>\`.

The point: with \`border-box\`, adding padding or a border never changes the outer size.`,
      starterCode: `<style>
  /* 1. reset */

  /* 2. tokens */

  /* 3. the card */
</style>

<div class="card">
  <!-- 4. heading + paragraph -->
</div>`,
      solutionCode: `<style>
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :root {
    --card-pad: 16px;
    --card-radius: 8px;
    --card-border: #d4d4d8;
  }

  .card {
    box-sizing: border-box;
    width: 320px;
    padding: var(--card-pad);
    border: 2px solid var(--card-border);
    border-radius: var(--card-radius);
    background: white;
  }

  .card h2 {
    margin-block: 0 8px;
    font-size: 1.25rem;
  }

  .card p {
    margin: 0;
    color: #52525b;
  }
</style>

<div class="card">
  <h2>Day 2 — CSS3</h2>
  <p>Box model, flexbox and grid, without the guesswork.</p>
</div>`,
      hints: [
        'The reset selector list is `*, *::before, *::after` — pseudo-elements are not covered by `*` alone.',
        'Custom properties must be declared on an ancestor (`:root` is the usual choice) before `var()` can read them.',
        'Give the card an explicit `box-sizing: border-box` as well, so the test can see it on the element itself.',
      ],
      tests: [
        { name: 'a <style> block is present', assertion: "!!doc.querySelector('style')" },
        { name: 'a .card element exists', assertion: "!!doc.querySelector('.card')" },
        {
          name: 'the card uses border-box sizing',
          assertion: "css('.card', 'box-sizing') === 'border-box'",
        },
        {
          name: 'the universal reset covers pseudo-elements',
          assertion:
            "(() => { const s = Array.from(doc.querySelectorAll('style')).map(e => e.textContent).join(' '); return s.includes('*::before') && s.includes('*::after') && s.includes('border-box'); })()",
        },
        {
          name: '--card-pad is declared and consumed with var()',
          assertion:
            "(() => { const s = Array.from(doc.querySelectorAll('style')).map(e => e.textContent).join(' '); return s.includes('--card-pad') && s.includes('var(--card-pad)'); })()",
        },
        {
          name: 'the --card-pad token resolves to 16px on the card',
          assertion:
            "css('.card', '--card-pad').trim() === '16px' || css('.card', 'padding-top') === '16px'",
        },
        {
          name: 'the card contains an h2 and a p',
          assertion: "!!doc.querySelector('.card h2') && !!doc.querySelector('.card p')",
          hidden: true,
        },
        {
          name: 'at least two custom properties are defined',
          assertion:
            "(() => { const s = Array.from(doc.querySelectorAll('style')).map(e => e.textContent).join(' '); return (s.match(/--[a-z-]+\\s*:/g) || []).length >= 2; })()",
          hidden: true,
        },
      ],
      xp: 40,
    },
    {
      slug: 'flexbox-site-header',
      title: 'Flexbox Site Header',
      difficulty: 'MEDIUM',
      runtime: 'html',
      statement: `Build the header every site needs: a brand on the left, links in the middle-right, and a call-to-action pinned to the far right.

Requirements:

1. A \`<header>\` with class \`site-header\` that is a flex container with:
   - \`align-items: center\` (vertical centring on the cross axis)
   - \`justify-content: space-between\`
2. A \`.brand\` element (the logo/site name) as its first child.
3. A \`<nav>\` containing a \`<ul class="site-nav">\` with **at least three** \`<li><a>\` links. The \`ul\` must itself be a flex row with a \`gap\` of \`16px\` and no list bullets.
4. A \`<button class="cta">\` as the last child.
5. A media query (any breakpoint) that switches \`.site-header\` to \`flex-direction: column\` on narrow screens.

Use \`gap\`, not margins, for the spacing between links.`,
      starterCode: `<style>
  .site-header {
    /* flex container: align-items + justify-content + gap */
  }

  .site-nav {
    /* flex row of links, gap: 16px, no bullets */
  }

  /* narrow-screen media query */
</style>

<header class="site-header">
  <!-- brand, nav, cta -->
</header>`,
      solutionCode: `<style>
  *, *::before, *::after { box-sizing: border-box; }

  .site-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid #e4e4e7;
    font-family: system-ui, sans-serif;
  }

  .brand {
    font-weight: 700;
    font-size: 1.125rem;
    text-decoration: none;
    color: #18181b;
  }

  .site-nav {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style-type: none;
  }

  .site-nav a {
    text-decoration: none;
    color: #3f3f46;
  }

  .site-nav a:hover {
    color: #4f46e5;
  }

  .cta {
    font: inherit;
    padding: 8px 16px;
    border: 0;
    border-radius: 6px;
    background: #4f46e5;
    color: white;
    cursor: pointer;
  }

  @media (max-width: 40rem) {
    .site-header {
      flex-direction: column;
      align-items: stretch;
    }

    .site-nav {
      flex-wrap: wrap;
    }
  }
</style>

<header class="site-header">
  <a class="brand" href="/">CodeNinja</a>

  <nav aria-label="Primary">
    <ul class="site-nav">
      <li><a href="/roadmap">Roadmap</a></li>
      <li><a href="/tracks">Tracks</a></li>
      <li><a href="/pricing">Pricing</a></li>
    </ul>
  </nav>

  <button class="cta" type="button">Sign up</button>
</header>`,
      hints: [
        '`justify-content` works on the main axis, `align-items` on the cross axis. For a row, that is horizontal and vertical respectively.',
        'A `<ul>` has default `padding-inline-start` and `margin-block` — zero them out or the links will not line up with the brand.',
        'Bullets are removed with `list-style-type: none` on the `ul`, not on the `li`.',
        'Inside the media query, remember `align-items: center` will squash the stacked children — `stretch` usually looks better.',
      ],
      tests: [
        {
          name: '.site-header is a flex container',
          assertion: "css('.site-header', 'display') === 'flex'",
        },
        {
          name: 'header items are centred on the cross axis',
          assertion: "css('.site-header', 'align-items') === 'center'",
        },
        {
          name: 'header uses space-between on the main axis',
          assertion: "css('.site-header', 'justify-content') === 'space-between'",
        },
        { name: 'there is a .brand element', assertion: "!!doc.querySelector('.site-header .brand')" },
        {
          name: '.site-nav is a flex row',
          assertion: "css('.site-nav', 'display') === 'flex'",
        },
        {
          name: '.site-nav uses a 16px gap',
          assertion: "css('.site-nav', 'column-gap') === '16px' || css('.site-nav', 'gap') === '16px'",
        },
        {
          name: 'the nav has at least three links',
          assertion: "doc.querySelectorAll('.site-nav li a').length >= 3",
        },
        {
          name: 'list bullets are removed',
          assertion: "css('.site-nav', 'list-style-type') === 'none'",
          hidden: true,
        },
        {
          name: 'there is a .cta button',
          assertion: "!!doc.querySelector('button.cta')",
          hidden: true,
        },
        {
          name: 'a media query switches the header to a column',
          assertion:
            "(() => { const s = Array.from(doc.querySelectorAll('style')).map(e => e.textContent).join(' '); return s.includes('@media') && s.includes('flex-direction') && s.includes('column'); })()",
          hidden: true,
        },
      ],
      xp: 70,
    },
    {
      slug: 'grid-dashboard-layout',
      title: 'Grid Dashboard with Named Areas',
      difficulty: 'HARD',
      runtime: 'html',
      statement: `Lay out a full dashboard shell with CSS Grid — named areas for the page, \`auto-fit\` + \`minmax\` for the cards inside it.

Requirements:

1. A \`.layout\` grid container that:
   - uses \`grid-template-areas\` with the four area names \`header\`, \`sidebar\`, \`main\` and \`footer\`
   - has a sidebar column and a flexible main column (e.g. \`240px 1fr\`)
   - is at least a full viewport tall
   - uses \`gap\`
2. Four children — \`<header>\`, \`<aside>\`, \`<main>\`, \`<footer>\` — each placed with \`grid-area\`.
3. Inside \`<main>\`, a \`.cards\` grid using \`repeat(auto-fit, minmax(...))\` containing at least three \`.card\` elements.
4. A media query that redefines \`grid-template-areas\` so everything stacks in one column on narrow screens.

> Remember: the ASCII drawing in \`grid-template-areas\` must be rectangular — every row string needs the same number of names.`,
      starterCode: `<style>
  .layout {
    /* display + template columns + template areas + gap + min-height */
  }

  /* place each child with grid-area */

  .cards {
    /* auto-fit + minmax card grid */
  }

  /* stack everything on narrow screens */
</style>

<div class="layout">
  <header>...</header>
  <aside>...</aside>
  <main>
    <div class="cards"><!-- 3+ .card elements --></div>
  </main>
  <footer>...</footer>
</div>`,
      solutionCode: `<style>
  *, *::before, *::after { box-sizing: border-box; }

  body { margin: 0; font-family: system-ui, sans-serif; }

  .layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    grid-template-rows: auto 1fr auto;
    grid-template-areas:
      "header  header"
      "sidebar main"
      "footer  footer";
    gap: 16px;
    min-height: 100vh;
    padding: 16px;
  }

  .layout > header  { grid-area: header; }
  .layout > aside   { grid-area: sidebar; }
  .layout > main    { grid-area: main; }
  .layout > footer  { grid-area: footer; }

  .layout > header,
  .layout > aside,
  .layout > footer {
    padding: 16px;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
    gap: 16px;
  }

  .card {
    padding: 16px;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    background: #fafafa;
  }

  @media (max-width: 48rem) {
    .layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto 1fr auto;
      grid-template-areas:
        "header"
        "sidebar"
        "main"
        "footer";
    }
  }
</style>

<div class="layout">
  <header><strong>CodeNinja Dashboard</strong></header>

  <aside>
    <nav aria-label="Sections">
      <ul>
        <li><a href="#progress">Progress</a></li>
        <li><a href="#streak">Streak</a></li>
      </ul>
    </nav>
  </aside>

  <main>
    <h1>Week 1</h1>
    <div class="cards">
      <article class="card"><h2>Days done</h2><p>2 / 30</p></article>
      <article class="card"><h2>XP</h2><p>170</p></article>
      <article class="card"><h2>Streak</h2><p>2 days</p></article>
      <article class="card"><h2>Quizzes</h2><p>88%</p></article>
    </div>
  </main>

  <footer>&copy; 2026 CodeNinja</footer>
</div>`,
      hints: [
        'Every string in `grid-template-areas` must contain the same number of names, or the whole declaration is invalid and silently dropped.',
        'An area name repeated across adjacent cells spans them — that is how `header` stretches over both columns.',
        '`grid-area: header` on a child is shorthand for placing it into the named area; the name is not quoted here.',
        'For the card grid use `repeat(auto-fit, minmax(min(240px, 100%), 1fr))` so it cannot overflow on a phone.',
      ],
      tests: [
        {
          name: '.layout is a grid container',
          assertion: "css('.layout', 'display') === 'grid'",
        },
        {
          name: 'grid-template-areas is declared',
          assertion:
            "(() => { const s = Array.from(doc.querySelectorAll('style')).map(e => e.textContent).join(' '); return s.includes('grid-template-areas'); })()",
        },
        {
          name: 'all four area names are used',
          assertion:
            "(() => { const s = Array.from(doc.querySelectorAll('style')).map(e => e.textContent).join(' '); return ['header', 'sidebar', 'main', 'footer'].every(n => s.includes(n)); })()",
        },
        {
          name: 'the four landmark children exist',
          assertion:
            "['header', 'aside', 'main', 'footer'].every(t => !!doc.querySelector('.layout > ' + t))",
        },
        {
          name: 'children are placed with grid-area',
          assertion:
            "(() => { const s = Array.from(doc.querySelectorAll('style')).map(e => e.textContent).join(' '); return (s.match(/grid-area\\s*:/g) || []).length >= 4; })()",
        },
        {
          name: '.cards is a grid using auto-fit + minmax',
          assertion:
            "(() => { const s = Array.from(doc.querySelectorAll('style')).map(e => e.textContent).join(' '); return css('.cards', 'display') === 'grid' && s.includes('auto-fit') && s.includes('minmax('); })()",
        },
        {
          name: 'there are at least three cards',
          assertion: "doc.querySelectorAll('.cards .card').length >= 3",
        },
        {
          name: 'a media query re-declares the areas for narrow screens',
          assertion:
            "(() => { const s = Array.from(doc.querySelectorAll('style')).map(e => e.textContent).join(' '); return s.includes('@media') && (s.match(/grid-template-areas/g) || []).length >= 2; })()",
          hidden: true,
        },
        {
          name: 'the layout fills at least the viewport height',
          assertion:
            "(() => { const s = Array.from(doc.querySelectorAll('style')).map(e => e.textContent).join(' '); return s.includes('min-height') && (s.includes('vh') || s.includes('dvh')); })()",
          hidden: true,
        },
      ],
      xp: 90,
    },
  ],
  flashcards: [
    {
      front: 'What exactly does `box-sizing: border-box` change?',
      back: '`width`/`height` measure the **border box** (content + padding + border) instead of just the content box. Margin is still outside either way.',
      tags: ['css', 'box-model'],
    },
    {
      front: 'When do vertical margins collapse?',
      back: 'Between adjacent block-level siblings in normal flow (and between a parent and child with no padding/border between them). They take the larger value, not the sum. Never happens inside flex or grid.',
      tags: ['css', 'box-model'],
    },
    {
      front: 'How is specificity compared?',
      back: 'As the tuple (ids, classes/attributes/pseudo-classes, elements/pseudo-elements), left to right. One id (1,0,0) beats any number of classes. `:where()` contributes zero.',
      tags: ['css', 'cascade'],
    },
    {
      front: 'Order of the cascade before specificity is consulted',
      back: 'Origin + importance → cascade layers (`@layer`) → inline style → specificity → source order. `!important` reverses the origin order.',
      tags: ['css', 'cascade'],
    },
    {
      front: '`rem` vs `em`',
      back: '`rem` is relative to the root font size (stable, use for type scale and spacing). `em` is relative to the element’s own font size and compounds when nested — useful for padding that scales with its label.',
      tags: ['css', 'units'],
    },
    {
      front: 'How do you read `clamp(a, b, c)`?',
      back: 'clamp(minimum, preferred, maximum). Keep a `rem` term in the preferred value so browser zoom still works, e.g. `clamp(1.75rem, 1.25rem + 2.5vw, 3rem)`.',
      tags: ['css', 'units', 'responsive'],
    },
    {
      front: 'Main axis vs cross axis in Flexbox',
      back: '`flex-direction` sets the main axis; the cross axis is perpendicular. `justify-content` works on the main axis, `align-items` on the cross axis.',
      tags: ['css', 'flexbox'],
    },
    {
      front: 'What does `flex: 1` expand to, and why does it matter?',
      back: '`1 1 0%`. Because the basis is 0, the whole container is free space and all items become equal width. `flex: auto` (`1 1 auto`) keeps content widths and shares only the surplus.',
      tags: ['css', 'flexbox'],
    },
    {
      front: 'Why does a flex item refuse to shrink below its content?',
      back: 'Flex items default to `min-width: auto` (the automatic minimum size). Set `min-width: 0` or `overflow: hidden` on the item to allow shrinking and truncation.',
      tags: ['css', 'flexbox'],
    },
    {
      front: '`auto-fill` vs `auto-fit` in `repeat()`',
      back: '`auto-fill` keeps the empty tracks it created (items stay at their min size); `auto-fit` collapses empty tracks to zero so the existing items stretch to fill the row.',
      tags: ['css', 'grid'],
    },
    {
      front: 'What creates a new stacking context?',
      back: 'Positioned elements with a `z-index`, `opacity < 1`, `transform`, `filter`, `backdrop-filter`, `isolation: isolate`, `will-change`, `mix-blend-mode`. `z-index` only orders siblings inside one context.',
      tags: ['css', 'positioning'],
    },
    {
      front: 'Container query vs media query',
      back: 'A media query asks about the viewport; a container query (`container-type: inline-size` on an ancestor + `@container`) asks about the space the component was actually given, so the same component works in a sidebar and a full-width column.',
      tags: ['css', 'responsive'],
    },
  ],
  resources: [
    {
      label: 'MDN — CSS Reference',
      url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference',
      kind: 'DOCS',
    },
    {
      label: 'web.dev — Learn CSS',
      url: 'https://web.dev/learn/css',
      kind: 'DOCS',
    },
    {
      label: 'CSS-Tricks — A Complete Guide to Flexbox',
      url: 'https://css-tricks.com/snippets/css/a-guide-to-flexbox/',
      kind: 'ARTICLE',
    },
    {
      label: 'CSS-Tricks — A Complete Guide to Grid',
      url: 'https://css-tricks.com/snippets/css/complete-guide-grid/',
      kind: 'ARTICLE',
    },
    {
      label: 'W3C — CSS Cascading and Inheritance Level 5',
      url: 'https://www.w3.org/TR/css-cascade-5/',
      kind: 'SPEC',
    },
  ],
};

export default day;
