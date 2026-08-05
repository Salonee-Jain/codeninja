import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 1,
  week: 1,
  pillar: 'FRONTEND',
  title: 'HTML5: Structure, Semantics & Forms',
  summary: 'Build documents browsers, screen readers and search engines all understand.',
  estimatedMinutes: 300,
  objectives: [
    'Explain how the browser turns bytes into a DOM tree',
    'Choose the semantically correct element instead of reaching for <div>',
    'Build an accessible form with native validation',
    'Embed media and images responsively with correct fallbacks',
    'Audit a page for accessibility violations and fix them',
  ],
  technologies: ['HTML5'],
  lessons: [
    {
      slug: 'how-the-browser-reads-html',
      title: 'How the Browser Reads Your HTML',
      estimatedMinutes: 60,
      body: `# How the Browser Reads Your HTML

Before you write a single tag, it helps to know what the browser actually *does* with it.

## The critical rendering path

1. **Bytes → characters** — the response body is decoded using the charset you declare.
2. **Characters → tokens** — the HTML tokenizer emits \`StartTag\`, \`EndTag\`, \`Character\` and \`Comment\` tokens.
3. **Tokens → nodes → DOM** — the tree builder turns tokens into a **DOM tree**.
4. **CSS → CSSOM** — stylesheets are parsed into a parallel tree.
5. **DOM + CSSOM → render tree → layout → paint**.

This is why \`<meta charset="utf-8">\` must be within the first 1024 bytes of the document: if the browser guesses wrong it has to throw away and re-parse everything.

\`\`\`html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ninja Notes</title>
  </head>
  <body>
    <h1>Hello</h1>
  </body>
</html>
\`\`\`

## The doctype is not decoration

\`<!doctype html>\` switches the browser into **standards mode**. Omit it and you get *quirks mode*, where the box model reverts to a pre-2001 interpretation (padding and border counted *inside* \`width\`) and a decade of CSS advice stops applying.

## Parser blocking

A plain \`<script src>\` in \`<head>\` **blocks** HTML parsing: the parser stops, fetches, executes, and only then continues.

| Attribute | Download | Execute |
| --- | --- | --- |
| *(none)* | blocks parser | immediately, blocking |
| \`defer\` | parallel | after parsing, in order |
| \`async\` | parallel | as soon as it lands, out of order |

Rule of thumb: **\`defer\` for your app code, \`async\` for independent third-party scripts.**

## Void elements and implicit closing

\`<img>\`, \`<br>\`, \`<input>\`, \`<meta>\`, \`<link>\` are *void* — they never have a closing tag. And the parser silently closes some elements for you: a \`<p>\` is auto-closed by a following block element. That's why this:

\`\`\`html
<p>One <div>Two</div></p>
\`\`\`

produces a \`<p>\`, then a \`<div>\`, then an *empty* \`<p>\`. Nesting rules are not suggestions — validate with the [W3C validator](https://validator.w3.org/).

## What to take away

Your HTML is a **data structure**, not a formatting language. Every decision you make here shows up later in CSS selectors, JS queries, screen-reader output and SEO.`,
    },
    {
      slug: 'semantic-elements',
      title: 'Semantic Elements & Document Outline',
      estimatedMinutes: 70,
      body: `# Semantic Elements & Document Outline

A \`<div>\` says nothing. A \`<nav>\` says "this is the navigation" to the browser, to assistive tech, to search crawlers and to the next developer.

## The landmark elements

\`\`\`html
<body>
  <header>       <!-- banner: logo, site title -->
    <nav>…</nav> <!-- navigation landmark -->
  </header>

  <main>         <!-- exactly ONE per page -->
    <article>    <!-- self-contained, syndicatable -->
      <h1>Mastering Flexbox</h1>
      <section>  <!-- thematic grouping, needs a heading -->
        <h2>The main axis</h2>
      </section>
    </article>
    <aside>…</aside> <!-- tangential: related links -->
  </main>

  <footer>…</footer>
</body>
\`\`\`

Screen-reader users navigate by landmark. In VoiceOver, \`VO + U\` lists them. A page built entirely from \`<div>\`s produces an empty landmark list — the user has to arrow through every line.

## section vs div vs article

- **\`<article>\`** — would still make sense pasted somewhere else. A blog post, a product card, a comment.
- **\`<section>\`** — a thematic chunk *of* something, and it should have a heading.
- **\`<div>\`** — no meaning. Perfect for a pure styling wrapper. Using it is not a sin; using it *instead of* a meaningful element is.

## Headings are an outline, not font sizes

\`\`\`html
<!-- ❌ skips a level to get smaller text -->
<h1>Course</h1>
<h4>Module 1</h4>

<!-- ✅ correct outline; size it with CSS -->
<h1>Course</h1>
<h2>Module 1</h2>
\`\`\`

Never skip levels going down. \`h2 → h4\` reads to a screen reader as "there is a missing section here."

## Text-level semantics that people get wrong

| Use | Not | Because |
| --- | --- | --- |
| \`<strong>\` | \`<b>\` | importance vs. stylistic bold |
| \`<em>\` | \`<i>\` | stress emphasis vs. alternate voice |
| \`<time datetime="2026-08-05">\` | \`<span>\` | machine-readable date |
| \`<button>\` | \`<div onclick>\` | keyboard + focus + role for free |

That last row matters more than any other line in this lesson. A \`<div onclick>\` cannot be tabbed to, does not fire on \`Enter\`, and announces as nothing. \`<button>\` gives you all of it, free.

## Tables are for data

\`\`\`html
<table>
  <caption>Q3 enrolments</caption>
  <thead>
    <tr><th scope="col">Track</th><th scope="col">Learners</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">Full-Stack</th><td>1,204</td></tr>
  </tbody>
</table>
\`\`\`

\`scope\` is what lets a screen reader announce "Full-Stack, Learners, 1204" when the user lands on that cell.`,
    },
    {
      slug: 'forms-and-validation',
      title: 'Forms, Native Validation & Accessibility',
      estimatedMinutes: 80,
      body: `# Forms, Native Validation & Accessibility

Forms are where most of your app's real interaction happens, and where most accessibility bugs live.

## Every input needs a label

\`\`\`html
<!-- explicit: for === id. Best. -->
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="email" required />

<!-- implicit wrapping also works -->
<label>Email <input name="email" type="email" /></label>
\`\`\`

A \`placeholder\` is **not** a label — it disappears on focus, fails contrast checks, and is not reliably announced.

## Input types do real work

\`type\` changes the mobile keyboard, the validation rule, and the native UI:

\`\`\`html
<input type="email" />                    <!-- @ keyboard + format check -->
<input type="tel" inputmode="numeric" />  <!-- number pad -->
<input type="url" />
<input type="date" />
<input type="number" min="1" max="10" step="1" />
<input type="search" />
\`\`\`

## Constraint validation, for free

\`\`\`html
<form novalidate id="signup">
  <label for="pw">Password</label>
  <input id="pw" type="password" required minlength="8"
         pattern="(?=.*\\d).{8,}"
         aria-describedby="pw-help pw-error" />
  <p id="pw-help">At least 8 characters and one digit.</p>
  <p id="pw-error" role="alert"></p>
</form>
\`\`\`

\`\`\`js
const form = document.querySelector('#signup');
form.addEventListener('submit', (e) => {
  if (!form.checkValidity()) {
    e.preventDefault();
    const pw = form.pw;
    document.querySelector('#pw-error').textContent =
      pw.validity.valueMissing ? 'Password is required'
      : pw.validity.tooShort   ? 'Too short'
      : pw.validity.patternMismatch ? 'Needs a digit'
      : '';
  }
});
\`\`\`

The \`ValidityState\` object (\`valueMissing\`, \`typeMismatch\`, \`tooShort\`, \`rangeOverflow\`, \`patternMismatch\`) is what lets you write your own messages without re-implementing validation.

> \`novalidate\` suppresses the browser's built-in bubbles while **keeping** the API. That's usually what you want in a real app.

## Grouping and structure

\`\`\`html
<fieldset>
  <legend>Preferred stack</legend>
  <label><input type="radio" name="stack" value="mern" /> MERN</label>
  <label><input type="radio" name="stack" value="pern" /> PERN</label>
</fieldset>
\`\`\`

\`<fieldset>/<legend>\` is the only accessible way to give a radio group a collective name.

## Autocomplete is an accessibility feature

\`autocomplete="name | email | street-address | cc-number | one-time-code"\` — WCAG 1.3.5 requires it, and it dramatically reduces input effort for users with motor or cognitive impairments.

## The accessibility checklist

- [ ] Every control has a programmatic label
- [ ] Focus is visible (never \`outline: none\` without a replacement)
- [ ] Errors use \`aria-describedby\` + \`role="alert"\`
- [ ] Tab order follows visual order (no positive \`tabindex\`)
- [ ] Colour is never the only signal
- [ ] Images have \`alt\` (\`alt=""\` for decorative)`,
    },
    {
      slug: 'media-and-metadata',
      title: 'Responsive Media, Metadata & SEO',
      estimatedMinutes: 50,
      body: `# Responsive Media, Metadata & SEO

## Images that don't waste 3 MB on a phone

\`\`\`html
<img
  src="hero-800.jpg"
  srcset="hero-400.jpg 400w, hero-800.jpg 800w, hero-1600.jpg 1600w"
  sizes="(max-width: 600px) 100vw, 50vw"
  width="800" height="450"
  alt="Students pair-programming at a bootcamp"
  loading="lazy" decoding="async" />
\`\`\`

- **\`srcset\` + \`sizes\`** let the browser pick the right file *before* layout.
- **\`width\`/\`height\`** reserve space and kill Cumulative Layout Shift.
- **\`loading="lazy"\`** for below-the-fold images only — never for your LCP image.

Art direction (a genuinely different crop, not just a different size) needs \`<picture>\`:

\`\`\`html
<picture>
  <source media="(max-width: 600px)" srcset="hero-square.avif" type="image/avif" />
  <source srcset="hero-wide.avif" type="image/avif" />
  <img src="hero-wide.jpg" alt="…" />
</picture>
\`\`\`

## Writing good alt text

| Situation | alt |
| --- | --- |
| Meaningful image | describe the *information*, not the pixels |
| Decorative | \`alt=""\` (empty, but present) |
| Image inside a link | describe the **destination** |
| Text in image | reproduce the text |

## Metadata that actually gets used

\`\`\`html
<title>Flexbox in 20 Minutes — CodeNinja</title>
<meta name="description" content="A practical tour of the flex container and its items." />
<link rel="canonical" href="https://example.com/flexbox" />

<meta property="og:title" content="Flexbox in 20 Minutes" />
<meta property="og:description" content="A practical tour…" />
<meta property="og:image" content="https://example.com/og/flexbox.png" />
<meta name="twitter:card" content="summary_large_image" />
\`\`\`

\`og:*\` tags are what Slack, WhatsApp, LinkedIn and iMessage read to build a preview card. Missing them is the difference between a rich card and a bare URL.

## Structured data

\`\`\`html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "Full-Stack in 30 Days",
  "provider": { "@type": "Organization", "name": "CodeNinja" }
}
</script>
\`\`\`

JSON-LD is how you earn rich results in search. It is inert to the page and trivially testable.`,
    },
  ],
  quiz: [
    {
      prompt: 'Why must `<meta charset="utf-8">` appear in the first 1024 bytes of a document?',
      options: [
        'It is required for the doctype to be recognised',
        'The browser may otherwise guess an encoding and have to discard and re-parse the document',
        'Search engines ignore documents without it',
        'It enables standards mode',
      ],
      correctIndex: 1,
      explanation:
        'The encoding sniffing algorithm only inspects the first 1024 bytes. A late declaration means the browser may have already decoded bytes with the wrong charset and must restart the parse. Standards mode comes from the doctype, not the charset.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What does `<script defer src="app.js"></script>` guarantee?',
      options: [
        'The script downloads and executes immediately, blocking the parser',
        'The script downloads in parallel and executes after parsing, preserving document order',
        'The script downloads in parallel and executes the moment it arrives',
        'The script only runs if the user interacts with the page',
      ],
      correctIndex: 1,
      explanation:
        '`defer` downloads in parallel but defers execution until the DOM is parsed, and multiple deferred scripts run in document order. `async` is the one that executes on arrival, out of order.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Which element should wrap a blog post that could sensibly be republished on its own?',
      options: ['<section>', '<div>', '<article>', '<aside>'],
      correctIndex: 2,
      explanation:
        '`<article>` is for self-contained, independently distributable content. `<section>` is a thematic chunk of a larger whole and expects a heading; `<aside>` is tangential content.',
      difficulty: 'EASY',
    },
    {
      prompt: 'A designer asks for a clickable card. Why is `<div onclick>` the wrong answer?',
      options: [
        'It is slower than a button',
        'It cannot receive keyboard focus, does not activate on Enter/Space, and exposes no role to assistive tech',
        'React does not support onClick on div elements',
        'It breaks CSS specificity',
      ],
      correctIndex: 1,
      explanation:
        'Interactive semantics are not automatic. `<button>` gives focusability, keyboard activation and a `button` role for free; replicating that on a div takes `tabindex="0"`, `role="button"` and manual key handlers.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What is the effect of the `novalidate` attribute on a `<form>`?',
      options: [
        'It disables the constraint validation API entirely',
        'It suppresses the browser’s native error bubbles while leaving checkValidity() and ValidityState usable',
        'It makes all fields optional',
        'It prevents the form from submitting',
      ],
      correctIndex: 1,
      explanation:
        '`novalidate` only stops the browser from blocking submission and showing its own UI. `form.checkValidity()` and each control’s `validity` object still work, which is exactly how you build custom messages.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which markup correctly serves different image *crops* for phone and desktop?',
      options: [
        '<img srcset="a.jpg 400w, b.jpg 1600w" sizes="100vw">',
        '<picture><source media="(max-width:600px)" srcset="square.jpg"><img src="wide.jpg" alt=""></picture>',
        '<img src="a.jpg" loading="lazy">',
        '<img src="a.jpg" width="400" height="300">',
      ],
      correctIndex: 1,
      explanation:
        '`srcset`/`sizes` solve *resolution* switching of the same image. Genuinely different crops (art direction) require `<picture>` with `media` conditions on `<source>`.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'How should a purely decorative image be marked up?',
      options: [
        'Omit the alt attribute',
        'alt="decorative image"',
        'alt="" (present but empty)',
        'Wrap it in <aside>',
      ],
      correctIndex: 2,
      explanation:
        'An empty `alt` tells assistive tech to skip the image. Omitting `alt` entirely makes some screen readers read the filename aloud, which is worse than either alternative.',
      difficulty: 'EASY',
    },
    {
      prompt: 'What is the purpose of `scope="row"` on a `<th>`?',
      options: [
        'It bolds and centres the cell',
        'It associates the header with the cells in that row so screen readers can announce context',
        'It freezes the row when scrolling',
        'It is required for CSS table-layout: fixed',
      ],
      correctIndex: 1,
      explanation:
        '`scope` builds the header/data association in the accessibility tree. Without it, a user landing on a cell hears only the raw value with no idea which row or column it belongs to.',
      difficulty: 'HARD',
    },
  ],
  problems: [
    {
      slug: 'semantic-audit',
      title: 'Fix the Unsemantic Page',
      difficulty: 'EASY',
      runtime: 'html',
      statement: `A junior dev shipped this page using nothing but \`<div>\` and \`<span>\`. Rewrite it with correct semantics.

Your markup must contain:

- exactly one \`<main>\`
- a \`<header>\` containing a \`<nav>\`
- an \`<article>\` whose heading is an \`<h1>\`
- a \`<footer>\`
- a real \`<button>\` with the text \`Enrol\`
- an \`<img>\` that has an \`alt\` attribute

Only the tags matter — style it however you like.`,
      starterCode: `<div class="top">
  <div class="menu"><span>Home</span> <span>Courses</span></div>
</div>
<div class="content">
  <div class="post">
    <div class="title">Full-Stack in 30 Days</div>
    <div>Learn the whole stack, one day at a time.</div>
    <img src="/hero.jpg">
    <div class="btn" onclick="enrol()">Enrol</div>
  </div>
</div>
<div class="bottom">© 2026 CodeNinja</div>`,
      solutionCode: `<header>
  <nav aria-label="Primary">
    <a href="/">Home</a>
    <a href="/courses">Courses</a>
  </nav>
</header>

<main>
  <article>
    <h1>Full-Stack in 30 Days</h1>
    <p>Learn the whole stack, one day at a time.</p>
    <img src="/hero.jpg" alt="Developers pair-programming" width="800" height="450">
    <button type="button" onclick="enrol()">Enrol</button>
  </article>
</main>

<footer>© 2026 CodeNinja</footer>`,
      hints: [
        'Landmarks first: header, nav, main, footer.',
        'The card title is the page heading — that is an <h1>, not a styled div.',
        'A div with onclick is not a button. Swap it for <button type="button">.',
        'Every <img> needs an alt attribute, even if it is empty.',
      ],
      tests: [
        { name: 'has exactly one <main>', assertion: "doc.querySelectorAll('main').length === 1" },
        {
          name: '<header> contains a <nav>',
          assertion: "!!doc.querySelector('header nav')",
        },
        {
          name: 'article has an h1',
          assertion: "!!doc.querySelector('article h1')",
        },
        { name: 'has a <footer>', assertion: "!!doc.querySelector('footer')" },
        {
          name: 'Enrol is a real <button>',
          assertion:
            "Array.from(doc.querySelectorAll('button')).some(b => b.textContent.trim().toLowerCase() === 'enrol')",
        },
        {
          name: 'every image has alt',
          assertion:
            "Array.from(doc.querySelectorAll('img')).every(i => i.hasAttribute('alt')) && doc.querySelectorAll('img').length > 0",
          hidden: true,
        },
        {
          name: 'no leftover onclick divs',
          assertion: "doc.querySelectorAll('div[onclick]').length === 0",
          hidden: true,
        },
      ],
      xp: 40,
    },
    {
      slug: 'accessible-signup-form',
      title: 'Build an Accessible Signup Form',
      difficulty: 'MEDIUM',
      runtime: 'html',
      statement: `Build a signup form that a screen-reader user can complete without guessing.

Requirements:

1. A \`<form>\` element.
2. Three inputs — \`email\` (\`type="email"\`), \`password\` (\`type="password"\`, \`minlength="8"\`), and \`plan\` — each with an associated \`<label>\` (use \`for\`/\`id\`).
3. Email and password are \`required\`; email has \`autocomplete="email"\`.
4. A \`<fieldset>\` with a \`<legend>\` grouping two radio buttons named \`plan\`.
5. A submit \`<button>\`.`,
      starterCode: `<form>
  <!-- your markup here -->
</form>`,
      solutionCode: `<form id="signup" novalidate>
  <div>
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="email" required>
  </div>

  <div>
    <label for="password">Password</label>
    <input id="password" name="password" type="password"
           autocomplete="new-password" minlength="8" required
           aria-describedby="pw-help">
    <p id="pw-help">Minimum 8 characters.</p>
  </div>

  <fieldset>
    <legend>Choose a plan</legend>
    <label for="plan-free">Free</label>
    <input id="plan-free" type="radio" name="plan" value="free" checked>
    <label for="plan-pro">Pro</label>
    <input id="plan-pro" type="radio" name="plan" value="pro">
  </fieldset>

  <button type="submit">Create account</button>
</form>`,
      hints: [
        'label[for] must match input[id] exactly — they are case sensitive.',
        'Radio buttons only form a group when they share the same name attribute.',
        'A fieldset without a legend gives the group no accessible name.',
      ],
      tests: [
        { name: 'renders a <form>', assertion: "!!doc.querySelector('form')" },
        {
          name: 'email input is type=email and required',
          assertion:
            "!!doc.querySelector('input[type=email][required]')",
        },
        {
          name: 'email has autocomplete=\"email\"',
          assertion: "!!doc.querySelector('input[type=email][autocomplete=email]')",
        },
        {
          name: 'password has minlength 8',
          assertion:
            "(() => { const p = doc.querySelector('input[type=password]'); return !!p && p.getAttribute('minlength') === '8'; })()",
        },
        {
          name: 'every input is labelled',
          assertion:
            "Array.from(doc.querySelectorAll('input')).every(i => (i.id && doc.querySelector(`label[for=\"${i.id}\"]`)) || i.closest('label'))",
        },
        {
          name: 'fieldset has a legend',
          assertion: "!!doc.querySelector('fieldset legend')",
        },
        {
          name: 'two radios share name=plan',
          assertion: "doc.querySelectorAll('input[type=radio][name=plan]').length === 2",
          hidden: true,
        },
        {
          name: 'has a submit button',
          assertion:
            "!!doc.querySelector('button[type=submit], button:not([type])')",
          hidden: true,
        },
      ],
      xp: 60,
    },
  ],
  flashcards: [
    { front: 'What does `<!doctype html>` actually do?', back: 'Switches the browser into standards mode. Without it you get quirks mode, where `width` includes padding and border.', tags: ['html', 'parsing'] },
    { front: '`defer` vs `async` on a script tag', back: '`defer`: parallel download, executes after parsing, in document order. `async`: parallel download, executes on arrival, out of order.', tags: ['html', 'performance'] },
    { front: 'When do you use `<section>` instead of `<div>`?', back: 'When the content is a thematic grouping that has its own heading. A `<div>` carries no meaning and is for styling only.', tags: ['html', 'semantics'] },
    { front: 'Why is `<div onclick>` an accessibility bug?', back: 'No focusability, no Enter/Space activation, no role announced. `<button>` provides all three natively.', tags: ['html', 'a11y'] },
    { front: 'How many `<main>` elements per page?', back: 'Exactly one visible `<main>`. It marks the primary content landmark.', tags: ['html', 'a11y'] },
    { front: 'What is `alt=""` for?', back: 'A decorative image. Present-but-empty tells assistive tech to skip it; omitting `alt` makes some readers announce the filename.', tags: ['html', 'a11y'] },
    { front: '`srcset`/`sizes` vs `<picture>`', back: '`srcset`+`sizes` = same image at different resolutions. `<picture>` + `media` = art direction, genuinely different crops or formats.', tags: ['html', 'images'] },
    { front: 'What does `novalidate` keep working?', back: 'The constraint validation API: `checkValidity()`, `reportValidity()` and each control’s `validity` (ValidityState) object. It only hides the native bubbles.', tags: ['html', 'forms'] },
    { front: 'Purpose of `<fieldset>` + `<legend>`', back: 'Gives a group of related controls (usually radios/checkboxes) a single accessible name announced with each option.', tags: ['html', 'forms'] },
    { front: 'Why set `width` and `height` on `<img>`?', back: 'The browser reserves the correct aspect-ratio box before the image loads, eliminating Cumulative Layout Shift.', tags: ['html', 'performance'] },
    { front: 'Which meta tags build a Slack/iMessage link preview?', back: 'Open Graph: `og:title`, `og:description`, `og:image`, plus `twitter:card` for X.', tags: ['html', 'seo'] },
    { front: 'What is `scope` on a `<th>`?', back: '`scope="col"` / `scope="row"` associates the header with its cells so screen readers can announce the cell’s context.', tags: ['html', 'a11y', 'tables'] },
  ],
  resources: [
    { label: 'MDN — HTML elements reference', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element', kind: 'DOCS' },
    { label: 'HTML Living Standard', url: 'https://html.spec.whatwg.org/multipage/', kind: 'SPEC' },
    { label: 'W3C Markup Validator', url: 'https://validator.w3.org/', kind: 'TOOL' },
    { label: 'WebAIM — Creating Accessible Forms', url: 'https://webaim.org/techniques/forms/', kind: 'ARTICLE' },
    { label: 'web.dev — Learn HTML', url: 'https://web.dev/learn/html', kind: 'DOCS' },
  ],
};

export default day;
