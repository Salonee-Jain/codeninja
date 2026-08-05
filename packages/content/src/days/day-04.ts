import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 4,
  week: 1,
  pillar: 'FRONTEND',
  title: 'JavaScript ES6+ II — Async, DOM & Fetch',
  summary: 'One thread, no blocking: promises, the event loop, and a DOM that stays responsive.',
  estimatedMinutes: 330,
  objectives: [
    'Trace the event loop and predict the order of sync code, microtasks and timers',
    'Convert callback APIs to promises and consume them with async/await',
    'Pick the right combinator: Promise.all, allSettled, race or any',
    'Call an HTTP API with fetch, cancel it with AbortController, and retry it with backoff',
    'Query, create and update DOM nodes without clobbering the page',
    'Use event delegation, and know when to stop propagation and when not to',
    'Rate-limit handlers with debounce and throttle, and lazy-load with IntersectionObserver',
  ],
  technologies: ['JavaScript (ES6+)'],
  lessons: [
    {
      slug: 'event-loop-and-task-queues',
      title: 'The Event Loop: Tasks, Microtasks & Rendering',
      estimatedMinutes: 70,
      body: `# The Event Loop: Tasks, Microtasks & Rendering

JavaScript runs on **one thread**. Everything you know about async behaviour follows from that single constraint plus one scheduling rule.

## The runtime is more than the engine

The engine (V8, JavaScriptCore) has a **call stack** and a **heap**. It does not have timers, HTTP or the DOM — those are **host APIs** provided by the browser or Node. When you call \`setTimeout\` or \`fetch\`, the host takes the job, and the callback comes back later through a queue.

The event loop is the referee:

1. Run the current task (a script, an event handler, a timer callback) **to completion**. Nothing can interrupt it.
2. When the stack is empty, drain the **microtask queue** completely — including microtasks queued *by* microtasks.
3. Then, roughly once per frame, do style/layout/paint.
4. Then take the next **macrotask**.

## Microtasks vs macrotasks

| Macrotasks (task queue) | Microtasks |
| --- | --- |
| \`setTimeout\`, \`setInterval\` | promise \`.then\` / \`catch\` / \`finally\` |
| DOM events, \`fetch\` completion dispatch | \`await\` continuations |
| \`MessageChannel\`, \`requestIdleCallback\` | \`queueMicrotask\` |
| I/O callbacks (Node) | \`MutationObserver\` |

The key asymmetry: **the entire microtask queue is drained between macrotasks**, so microtasks always run before the next timer, and before the next paint.

\`\`\`js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
queueMicrotask(() => console.log('4'));
console.log('5');
// 1, 5, 3, 4, 2
\`\`\`

Walk it: sync logs 1 and 5. Stack empties. Microtasks drain in order → 3, 4. Only then the timer task → 2. Note \`setTimeout(..., 0)\` is not "now" — it is "after this task and every microtask it spawned", with a 4ms clamp after five nested levels.

## \`await\` is \`.then\` in disguise

\`\`\`js
async function run() {
  console.log('a');
  await null;          // suspends here; the rest becomes a microtask
  console.log('b');
}
run();
console.log('c');
// a, c, b
\`\`\`

Everything before the first \`await\` runs **synchronously**. Everything after resumes as a microtask. That is why an \`async\` function that never awaits still returns a promise, and why moving an \`await\` earlier can change your ordering.

## Starving the loop

Because microtasks are drained *fully*, a microtask that queues another microtask forever will freeze the page — no rendering, no input:

\`\`\`js
function starve() { queueMicrotask(starve); } // do NOT run this
\`\`\`

The same applies to any long synchronous loop. If you must do heavy work, either chunk it across macrotasks or hand it to a Web Worker, which runs on a real second thread and communicates via \`postMessage\`.

\`\`\`js
async function processInChunks(items, work, chunk = 500) {
  for (let i = 0; i < items.length; i += chunk) {
    items.slice(i, i + chunk).forEach(work);
    await new Promise((resolve) => setTimeout(resolve, 0)); // yield to the loop
  }
}
\`\`\`

## Timers, frames and idle time

- \`setTimeout(fn, ms)\` — *at least* \`ms\` later; a busy task delays it arbitrarily.
- \`setInterval\` — drifts and can pile up if the callback is slower than the interval. Prefer a self-scheduling \`setTimeout\`.
- \`requestAnimationFrame(fn)\` — runs immediately **before** the next paint. The correct place for anything visual: animations, DOM reads/writes that must not tear.
- \`requestIdleCallback(fn)\` — runs when the browser has spare time. Good for analytics and prefetching; never for anything the user is waiting on.

\`\`\`js
// smooth, frame-aligned, and pauses automatically in a background tab
let x = 0;
function step() {
  x += 2;
  box.style.transform = 'translateX(' + x + 'px)';
  if (x < 300) requestAnimationFrame(step);
}
requestAnimationFrame(step);
\`\`\`

## Node's extra wrinkle

Node adds \`process.nextTick\`, which drains **before** the promise microtask queue, and \`setImmediate\`, which runs in the check phase after I/O. Rule of thumb for application code: use promises, and reserve \`nextTick\` for library internals.

Once you can predict the output of a mixed sync / promise / timer snippet, you can debug almost any "why did this run in the wrong order?" bug — and those are the ones that eat afternoons.`,
    },
    {
      slug: 'promises-and-async-await',
      title: 'Callbacks → Promises → async/await',
      estimatedMinutes: 80,
      body: `# Callbacks → Promises → async/await

## Why callbacks stopped being enough

\`\`\`js
getUser(id, (err, user) => {
  if (err) return done(err);
  getOrders(user.id, (err, orders) => {
    if (err) return done(err);
    getItems(orders[0].id, (err, items) => { /* ...and so on */ });
  });
});
\`\`\`

Three problems: the pyramid, error handling repeated at every level, and no way to compose. Worse, a callback API has no contract — it may call you twice, or synchronously, or never.

## The promise contract

A promise is a placeholder for a future value in one of three states: **pending → fulfilled** or **pending → rejected**. It settles **once**, and handlers always run asynchronously (as microtasks), even if the promise is already settled.

\`\`\`js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const readFilePromise = (path) =>
  new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => (err ? reject(err) : resolve(data)));
  });
\`\`\`

That \`new Promise\` wrapper is the only place you should write it — wrap a legacy callback API once, at the boundary, then never again. In Node, \`util.promisify\` does it for you.

## Chaining rules worth memorising

\`\`\`js
fetchUser(1)
  .then((user) => fetchOrders(user.id))   // returning a promise flattens it
  .then((orders) => orders.length)        // returning a value fulfils the next link
  .catch((err) => { log(err); return []; }) // catch RECOVERS: the chain continues fulfilled
  .finally(() => spinner.hide());          // no arguments, passes through
\`\`\`

- \`.then\` returns a **new** promise; the chain is not a mutation of the original.
- Throwing inside a handler rejects the returned promise — that is how errors propagate.
- \`.catch\` returning a value **resolves** the chain. If you want the error to keep travelling, re-throw.
- \`.finally\` ignores its return value (unless it throws).

## async/await is the readable form

\`\`\`js
async function loadDashboard(userId) {
  try {
    const user = await fetchUser(userId);
    const [orders, prefs] = await Promise.all([
      fetchOrders(user.id),
      fetchPrefs(user.id),
    ]);
    return { user, orders, prefs };
  } catch (err) {
    throw new Error('Dashboard failed to load', { cause: err });
  } finally {
    spinner.hide();
  }
}
\`\`\`

An \`async\` function **always** returns a promise; \`return x\` fulfils it and \`throw\` rejects it. \`try/catch\` now works across async boundaries, which plain callbacks could never do.

> The number one async performance bug is awaiting in a loop when the calls are independent:
>
> \`\`\`js
> for (const id of ids) results.push(await fetchUser(id)); // serial: N x latency
> const results = await Promise.all(ids.map(fetchUser));   // parallel: 1 x latency
> \`\`\`
>
> Awaiting in a loop is correct when each step *depends* on the previous one, or when you must not hammer the server — otherwise it is just slow.

## The four combinators

| Combinator | Fulfils when | Rejects when | Result |
| --- | --- | --- | --- |
| \`Promise.all\` | **all** fulfil | **first** rejection | array of values, input order |
| \`Promise.allSettled\` | all **settle** | never | array of \`{status, value \\| reason}\` |
| \`Promise.race\` | first to **settle** | if that first one rejected | that single outcome |
| \`Promise.any\` | first to **fulfil** | **all** reject → \`AggregateError\` | that single value |

\`\`\`js
// Fail fast — one bad request kills the batch:
const [a, b] = await Promise.all([fetchA(), fetchB()]);

// Partial success — render what you got:
const results = await Promise.allSettled(urls.map((u) => fetch(u)));
const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);

// Timeout pattern:
const withTimeout = (p, ms) =>
  Promise.race([p, delay(ms).then(() => { throw new Error('timeout'); })]);

// First mirror that answers:
const fastest = await Promise.any(mirrors.map((m) => fetch(m)));
\`\`\`

Note that \`Promise.all\` does not *cancel* the other promises when one rejects — they keep running, their results are discarded, and any later rejection among them can become an unhandled rejection. Cancellation is \`AbortController\`'s job, which is tomorrow's lesson topic and today's third problem.

## Error handling that does not lose information

\`\`\`js
class HttpError extends Error {
  constructor(response) {
    super('HTTP ' + response.status + ' for ' + response.url);
    this.name = 'HttpError';
    this.status = response.status;
  }
}

try {
  await save();
} catch (err) {
  if (err instanceof HttpError && err.status === 409) return retryMerge();
  throw new Error('Save failed', { cause: err }); // keep the original in .cause
}
\`\`\`

Two habits pay for themselves: **subclass \`Error\`** so callers can branch on type instead of parsing message strings, and use the \`cause\` option so wrapping an error does not destroy the stack that produced it. And always attach a global net during development:

\`\`\`js
window.addEventListener('unhandledrejection', (e) => report(e.reason));
\`\`\``,
    },
    {
      slug: 'fetch-abort-retry',
      title: 'fetch, AbortController, Timeouts & Retries',
      estimatedMinutes: 80,
      body: `# fetch, AbortController, Timeouts & Retries

## fetch does not throw on 404

This is the single most common \`fetch\` bug. The promise rejects only on a **network** failure (DNS, offline, CORS block, abort). A 500 response is a perfectly successful fetch.

\`\`\`js
async function getJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', ...options.headers },
    ...options,
  });

  if (!response.ok) {                       // ok === status in 200-299
    const body = await response.text();     // read it before throwing — for logs
    const error = new Error('HTTP ' + response.status);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  if (response.status === 204) return null; // no content, .json() would throw
  return response.json();
}
\`\`\`

A response body is a **stream and can only be read once**. Calling \`.json()\` after \`.text()\` throws \`TypeError: body stream already read\`. If you need it twice, \`response.clone()\` first.

## Sending data

\`\`\`js
await fetch('/api/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title, body }),
  credentials: 'same-origin',   // 'include' to send cookies cross-origin
});

// For file uploads, do NOT set Content-Type — the browser must add the boundary:
const form = new FormData();
form.append('avatar', fileInput.files[0]);
await fetch('/api/avatar', { method: 'POST', body: form });
\`\`\`

## AbortController: cancellation done properly

\`\`\`js
const controller = new AbortController();
const promise = fetch('/api/search?q=ninja', { signal: controller.signal });
controller.abort();   // promise rejects with a DOMException named 'AbortError'
\`\`\`

This is how you kill an in-flight request when the user types the next character, or navigates away. Handle the abort separately so it is not reported as a real failure:

\`\`\`js
let inFlight = null;

async function search(query) {
  inFlight?.abort();                       // cancel the previous keystroke
  inFlight = new AbortController();
  try {
    return await getJSON('/api/search?q=' + encodeURIComponent(query), {
      signal: inFlight.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') return null;  // expected, not an error
    throw err;
  }
}
\`\`\`

For a timeout, \`AbortSignal.timeout(ms)\` is the modern one-liner; \`AbortSignal.any([a, b])\` combines a user cancellation with a timeout:

\`\`\`js
const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
\`\`\`

The signal is not fetch-specific — \`addEventListener(..., { signal })\` removes the listener when the signal aborts, which is the tidiest teardown mechanism in the platform.

## Retries with exponential backoff and jitter

Networks fail transiently. Retrying immediately just adds load; retrying in lockstep across thousands of clients creates a thundering herd. The fix is exponential backoff **plus jitter**.

\`\`\`js
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retry(fn, { retries = 3, baseDelay = 200, factor = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      const backoff = baseDelay * factor ** attempt;
      const jitter = Math.random() * backoff * 0.3;
      await sleep(backoff + jitter);
    }
  }
}

const isRetryable = (err) =>
  err.name === 'TypeError' ||                    // network-level failure
  [408, 429, 500, 502, 503, 504].includes(err.status);
\`\`\`

Two rules people get wrong:

1. **Only retry idempotent operations.** \`GET\`, \`PUT\` and \`DELETE\` are safe. Retrying a \`POST\` can charge a card twice — send an idempotency key instead.
2. **Never retry a 4xx you caused.** A 400 or 401 will fail identically every time; you are just burning battery.

## Limiting concurrency

Firing 500 requests with \`Promise.all\` will have the browser queue them (six per host over HTTP/1.1) and may get you rate-limited. A **pool** keeps N in flight at a time:

\`\`\`js
async function pool(tasks, limit = 5) {
  const results = new Array(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const i = next++;             // claim an index synchronously
      results[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return results;
}
\`\`\`

The trick is that \`next++\` happens synchronously before any \`await\`, so two workers can never claim the same index. You will implement this yourself in today's second problem.`,
    },
    {
      slug: 'dom-events-and-observers',
      title: 'The DOM: Querying, Events, Delegation & Observers',
      estimatedMinutes: 90,
      body: `# The DOM: Querying, Events, Delegation & Observers

## Querying

\`\`\`js
document.querySelector('.card');            // first match, or null
document.querySelectorAll('.card');          // STATIC NodeList
document.getElementById('main');             // fastest, id only
el.closest('[data-id]');                     // walk UP the tree
el.matches('.active');                       // boolean test
container.querySelectorAll(':scope > li');   // direct children only
\`\`\`

\`querySelectorAll\` returns a **static** NodeList — a snapshot. \`getElementsByClassName\` returns a **live** HTMLCollection that updates as the DOM changes, which will surprise you inside a loop that removes elements. A NodeList has \`forEach\` but not \`map\`; spread it or use \`Array.from\` when you need real array methods.

## Creating and inserting nodes

\`\`\`js
const li = document.createElement('li');
li.className = 'item';
li.textContent = user.name;                  // safe: never parses HTML
li.dataset.userId = user.id;                 // <li data-user-id="7">
list.append(li);                             // append accepts nodes AND strings
\`\`\`

Use \`textContent\` for user-supplied data. \`innerHTML\` parses markup and is an XSS vector the moment the string contains anything a user typed. When you must build markup, use \`insertAdjacentHTML\` with strings you control, or \`setHTML\`/a sanitiser.

Batch inserts with a fragment so layout runs once, not N times:

\`\`\`js
const fragment = document.createDocumentFragment();
for (const user of users) {
  const li = document.createElement('li');
  li.textContent = user.name;
  fragment.append(li);
}
list.replaceChildren(fragment);   // clears and inserts in one operation
\`\`\`

> **Layout thrashing:** reading \`offsetHeight\` right after a write forces a synchronous reflow. Batch all your reads, then all your writes.

## Events: capture, target, bubble

Every dispatched event travels **down** through the ancestors (capture phase), reaches the target, then travels back **up** (bubble phase). Listeners run in the bubble phase unless you pass \`{ capture: true }\`.

\`\`\`js
el.addEventListener('click', handler, {
  once: true,       // auto-removes after the first call
  passive: true,    // promises not to preventDefault — required for smooth scroll
  capture: false,
  signal: controller.signal,  // removal without keeping the handler reference
});
\`\`\`

- \`event.target\` — what was actually clicked.
- \`event.currentTarget\` — the element the listener is attached to.
- \`event.preventDefault()\` — cancel the default action (form submit, link navigation).
- \`event.stopPropagation()\` — stop the journey. Use it rarely; it breaks other people's delegated listeners, including analytics.

## Delegation

Attaching a listener to every row does not scale, and it does not work for rows added later. Attach **one** listener to a stable ancestor and use \`closest\`:

\`\`\`js
list.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || !list.contains(button)) return;

  const { action } = button.dataset;
  const id = Number(button.closest('li').dataset.id);

  if (action === 'delete') remove(id);
  if (action === 'edit') edit(id);
});
\`\`\`

One listener, works for elements that do not exist yet, nothing to clean up. Note that \`focus\`, \`blur\`, \`mouseenter\` and \`mouseleave\` do **not** bubble — use \`focusin\`/\`focusout\`/\`mouseover\`/\`mouseout\` when delegating those.

## Debounce and throttle

Both limit how often a handler runs; they answer different questions.

- **Debounce** — "wait until it stops." Fire once, \`wait\` ms after the *last* call. For search-as-you-type, resize-then-recalculate, autosave.
- **Throttle** — "at most once per interval." For scroll position, mousemove, drag.

\`\`\`js
function debounce(fn, wait) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

function throttle(fn, interval) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= interval) { last = now; fn(...args); }
  };
}
\`\`\`

## Storage

\`\`\`js
localStorage.setItem('prefs', JSON.stringify({ theme: 'dark' }));
const prefs = JSON.parse(localStorage.getItem('prefs') ?? '{}');
\`\`\`

\`localStorage\` is **synchronous, string-only, origin-scoped and ~5MB**. It blocks the main thread, so never put it in a scroll handler, and never put tokens in it — any XSS can read it. \`sessionStorage\` clears with the tab. For structured or large data use IndexedDB. Always wrap access in \`try/catch\`: private mode and quota-exceeded both throw.

## IntersectionObserver

Scroll handlers to detect visibility are expensive and jittery. The observer does it off the main thread:

\`\`\`js
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.src = entry.target.dataset.src;   // lazy-load
      observer.unobserve(entry.target);              // one-shot
    }
  },
  { root: null, rootMargin: '200px', threshold: 0.1 }
);

document.querySelectorAll('img[data-src]').forEach((img) => observer.observe(img));
\`\`\`

\`rootMargin\` grows the detection box so images start loading *before* they scroll into view. The same API powers infinite scroll (observe a sentinel at the bottom of the list) and scroll-spy navigation. Its siblings — \`MutationObserver\` and \`ResizeObserver\` — follow exactly the same shape.

## Modules in the browser

\`\`\`html
<script type="module" src="/js/app.js"></script>
<script type="module">
  import { mount } from '/js/app.js';
  mount(document.querySelector('#root'));
</script>
\`\`\`

\`type="module"\` scripts are deferred by default, run in strict mode, get their own top-level scope (no accidental globals), and are fetched with CORS. Specifiers must be real URLs or paths — bare \`import 'lodash'\` needs a bundler or an import map.`,
    },
  ],
  quiz: [
    {
      prompt:
        'What does this print?\n```js\nconsole.log(1);\nsetTimeout(() => console.log(2), 0);\nPromise.resolve().then(() => console.log(3));\nconsole.log(4);\n```',
      options: ['1 2 3 4', '1 4 3 2', '1 3 4 2', '1 4 2 3'],
      correctIndex: 1,
      explanation:
        'Synchronous code runs first (1, 4). The stack then empties and the microtask queue drains, so the promise callback logs 3. The timer is a macrotask and runs last, logging 2 — `setTimeout(fn, 0)` never beats a pending microtask.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'A `fetch()` receives a 404 response. What happens to the returned promise?',
      options: [
        'It rejects with an HttpError',
        'It rejects with a TypeError',
        'It never settles',
        'It fulfils with a Response whose `ok` is false and `status` is 404',
      ],
      correctIndex: 3,
      explanation:
        '`fetch` only rejects on network-level failures — offline, DNS, CORS block, abort. Any HTTP response, including 4xx and 5xx, is a successful fetch. You must check `response.ok` yourself and throw.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Which combinator lets you render partial results when some of five requests fail?',
      options: [
        '`Promise.allSettled` — it never rejects and reports each outcome as fulfilled or rejected',
        '`Promise.all` with a try/catch around it',
        '`Promise.race`',
        '`Promise.any`',
      ],
      correctIndex: 0,
      explanation:
        '`all` rejects on the first failure and discards the successful values. `race` and `any` return a single outcome. `allSettled` waits for every promise and gives you an array of `{status, value}` / `{status, reason}` objects, which is exactly what partial rendering needs.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why is `for (const id of ids) { results.push(await fetchUser(id)); }` often a bug?',
      options: [
        '`await` is not allowed inside a for...of loop',
        '`push` inside an async function loses the values',
        'It runs the requests serially, so total latency is the sum of all of them — use `Promise.all(ids.map(fetchUser))` when the calls are independent',
        'It creates a memory leak because each await allocates a new promise',
      ],
      correctIndex: 2,
      explanation:
        'Each iteration waits for the previous request to finish. With 20 independent calls at 100ms you spend 2s instead of 100ms. Serial awaiting is only correct when a step depends on the previous result or you must rate-limit deliberately.',
      difficulty: 'EASY',
    },
    {
      prompt: 'A list re-renders and its rows are replaced. Why do delegated listeners keep working?',
      options: [
        'The browser copies listeners onto new nodes',
        'The listener is on a stable ancestor and inspects `event.target.closest(...)` as events bubble up, so it applies to nodes that did not exist when it was attached',
        'Because `querySelectorAll` returns a live collection',
        'Because delegated listeners run in the capture phase',
      ],
      correctIndex: 1,
      explanation:
        'Delegation relies on bubbling: the event travels from the target up through its ancestors, so a single listener on the container sees clicks from any descendant, present or future. It also means one listener instead of N and nothing to clean up.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'You want to cancel the previous search request when the user types another character. What do you use?',
      options: [
        '`clearTimeout` on the fetch',
        '`Promise.race` against a timeout',
        '`response.body.cancel()` after the fact',
        'An `AbortController`: pass `controller.signal` to fetch and call `controller.abort()` before starting the next request',
      ],
      correctIndex: 3,
      explanation:
        'Promises have no cancellation of their own. `AbortController` is the platform mechanism: the signal makes fetch reject with an `AbortError` DOMException and actually tears down the request. The same signal also auto-removes event listeners.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Debounce or throttle — you must recalculate a layout while the user drags a slider, at most 4 times a second?',
      options: [
        'Throttle: it guarantees the handler runs at a fixed maximum rate during a continuous stream of events',
        'Debounce: it delays the handler until the drag stops',
        'Neither — use requestIdleCallback',
        'Both behave identically for continuous events',
      ],
      correctIndex: 0,
      explanation:
        'Debounce fires only once the events stop, so nothing would update during the drag. Throttle fires at a bounded rate throughout, which is what continuous feedback needs. Debounce is the right tool for search-as-you-type or autosave.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why prefer IntersectionObserver over a scroll handler for lazy-loading images?',
      options: [
        'It supports older browsers better',
        'It can load images that are outside the DOM',
        'Visibility is computed by the browser asynchronously off the main thread, avoiding the forced reflows a scroll handler causes with getBoundingClientRect',
        'It automatically sets the `loading="lazy"` attribute',
      ],
      correctIndex: 2,
      explanation:
        'A scroll handler fires far more often than needed and typically calls `getBoundingClientRect()`, forcing synchronous layout on every event. IntersectionObserver batches visibility computation in the browser and hands you only the entries that crossed a threshold — plus `rootMargin` lets you preload before the element is on screen.',
      difficulty: 'HARD',
    },
  ],
  problems: [
    {
      slug: 'retry-with-backoff',
      title: 'retryWithBackoff',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Transient failures are normal. Write \`retryWithBackoff(fn, options)\` that calls \`fn\` and retries it with an exponentially growing delay.

\`\`\`js
const value = await retryWithBackoff(flakyFetch, {
  retries: 3,       // number of RETRIES after the first attempt (default 3)
  baseDelay: 100,   // ms before the first retry (default 100)
  factor: 2,        // multiplier per attempt (default 2)
  onRetry: (err, attempt) => log(attempt),  // optional, called before each wait
});
\`\`\`

Requirements:

1. \`fn\` is called with the zero-based attempt number: \`fn(0)\`, then \`fn(1)\`, …
2. Resolve with the first successful result. \`fn\` may be sync or async; both a thrown error and a rejected promise count as failure.
3. After a failure, if \`attempt < retries\`, call \`onRetry(err, attempt)\` (when provided), wait \`baseDelay * factor ** attempt\` ms, then try again.
4. Once \`retries\` retries are exhausted, **re-throw the last error** unchanged.
5. So \`retries: 2\` means at most **three** calls in total.

Keep the delays honest — the tests use tiny values, but the waiting must actually happen.`,
      starterCode: `const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryWithBackoff(fn, options = {}) {
  // your code here
}

module.exports = { retryWithBackoff };`,
      solutionCode: `const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryWithBackoff(fn, options = {}) {
  const { retries = 3, baseDelay = 100, factor = 2, onRetry } = options;

  let attempt = 0;
  for (;;) {
    try {
      // await handles both a sync return and a promise, and turns a
      // synchronous throw inside fn into a catchable rejection.
      return await fn(attempt);
    } catch (err) {
      if (attempt >= retries) throw err;
      if (typeof onRetry === 'function') onRetry(err, attempt);
      await sleep(baseDelay * Math.pow(factor, attempt));
      attempt += 1;
    }
  }
}

module.exports = { retryWithBackoff };`,
      hints: [
        'An infinite `for (;;)` with a try/catch inside is cleaner here than recursion — you cannot blow the stack.',
        '`return await fn(attempt)` inside the try is deliberate: without the `await`, a rejected promise escapes your catch block.',
        'The stop condition is `attempt >= retries`. Check it BEFORE sleeping so the final failure re-throws immediately.',
        'Delay for attempt n is `baseDelay * factor ** n`, so attempt 0 waits baseDelay, attempt 1 waits baseDelay * factor.',
      ],
      tests: [
        {
          name: 'returns immediately when the first call succeeds',
          assertion:
            "await (async () => { let calls = 0; const v = await solution.retryWithBackoff(async () => { calls++; return 'ok'; }, { retries: 3, baseDelay: 1 }); return v === 'ok' && calls === 1; })()",
        },
        {
          name: 'retries until it succeeds',
          assertion:
            "await (async () => { let n = 0; const v = await solution.retryWithBackoff(async () => { n++; if (n < 3) throw new Error('boom'); return n; }, { retries: 5, baseDelay: 1 }); return v === 3 && n === 3; })()",
        },
        {
          name: 'passes the zero-based attempt number to fn',
          assertion:
            "await (async () => { const seen = []; await solution.retryWithBackoff(async (attempt) => { seen.push(attempt); if (seen.length < 3) throw new Error('again'); return 'done'; }, { retries: 5, baseDelay: 1 }); return seen.length === 3 && seen[0] === 0 && seen[1] === 1 && seen[2] === 2; })()",
        },
        {
          name: 'retries: 2 means at most three calls, then rethrows the last error',
          assertion:
            "await (async () => { let n = 0; try { await solution.retryWithBackoff(async () => { n++; throw new Error('fail-' + n); }, { retries: 2, baseDelay: 1 }); return false; } catch (err) { return n === 3 && err.message === 'fail-3'; } })()",
        },
        {
          name: 'handles a synchronously throwing fn',
          assertion:
            "await (async () => { let n = 0; const v = await solution.retryWithBackoff(() => { n++; if (n === 1) throw new Error('sync'); return 'v'; }, { retries: 2, baseDelay: 1 }); return v === 'v' && n === 2; })()",
        },
        {
          name: 'calls onRetry once per retry with (error, attempt)',
          assertion:
            "await (async () => { const log = []; await solution.retryWithBackoff(async () => { if (log.length < 2) throw new Error('e'); return 'done'; }, { retries: 3, baseDelay: 1, onRetry: (err, attempt) => log.push(attempt + ':' + err.message) }); return log.length === 2 && log[0] === '0:e' && log[1] === '1:e'; })()",
        },
        {
          name: 'the backoff actually grows',
          assertion:
            "await (async () => { const started = Date.now(); let n = 0; await solution.retryWithBackoff(async () => { n++; if (n < 3) throw new Error('x'); return 1; }, { retries: 5, baseDelay: 8, factor: 2 }); return Date.now() - started >= 20; })()",
          hidden: true,
        },
        {
          name: 'works with default options',
          assertion:
            "await (async () => { let n = 0; const v = await solution.retryWithBackoff(async () => { n++; if (n < 2) throw new Error('x'); return 'ok'; }, { baseDelay: 1 }); return v === 'ok' && n === 2; })()",
          hidden: true,
        },
      ],
      xp: 70,
    },
    {
      slug: 'promise-pool',
      title: 'promisePool — Bounded Concurrency',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `\`Promise.all\` starts everything at once. When "everything" is 500 API calls, you need a pool.

Write \`promisePool(tasks, limit)\` where \`tasks\` is an array of **functions** that each return a promise.

\`\`\`js
const tasks = urls.map((url) => () => fetch(url));
const results = await promisePool(tasks, 3);   // never more than 3 in flight
\`\`\`

Requirements:

1. Never run more than \`limit\` tasks concurrently (default \`4\`).
2. Resolve with an array of results **in the same order as \`tasks\`**, regardless of completion order.
3. Start the next task as soon as any slot frees up — do **not** process in fixed batches of \`limit\`.
4. An empty \`tasks\` array resolves to \`[]\`.
5. If a task rejects, the returned promise rejects with that error.

The classic implementation spawns \`min(limit, tasks.length)\` worker loops that pull the next index off a shared cursor.`,
      starterCode: `async function promisePool(tasks, limit = 4) {
  // your code here
}

module.exports = { promisePool };`,
      solutionCode: `async function promisePool(tasks, limit = 4) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  // Each worker loops: claim an index, run it, repeat until the queue is empty.
  const worker = async () => {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;              // claimed synchronously, before any await
      results[index] = await tasks[index]();
    }
  };

  const workerCount = Math.min(limit, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
}

module.exports = { promisePool };`,
      hints: [
        'Do not think "batches". Think "N workers sharing one queue" — that is what keeps every slot busy.',
        'Claim the index with `const i = nextIndex; nextIndex += 1;` BEFORE any await, so two workers can never take the same task.',
        'Write results into a pre-sized array by index (`new Array(tasks.length)`) — pushing gives you completion order, not input order.',
        'Spawn `Math.min(limit, tasks.length)` workers, then `await Promise.all(workers)`.',
      ],
      tests: [
        {
          name: 'results come back in input order, not completion order',
          assertion:
            "await (async () => { const tasks = [30, 5, 15].map((ms, i) => () => new Promise(r => setTimeout(() => r(i), ms))); const out = await solution.promisePool(tasks, 3); return deepEqual(out, [0, 1, 2]); })()",
        },
        {
          name: 'never exceeds the concurrency limit',
          assertion:
            "await (async () => { let active = 0, peak = 0; const tasks = Array.from({ length: 6 }, () => async () => { active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 10)); active--; return 1; }); await solution.promisePool(tasks, 2); return peak === 2; })()",
        },
        {
          name: 'runs the full limit concurrently, not one at a time',
          assertion:
            "await (async () => { const started = Date.now(); const tasks = Array.from({ length: 4 }, () => () => new Promise(r => setTimeout(r, 20))); await solution.promisePool(tasks, 4); return Date.now() - started < 60; })()",
        },
        {
          name: 'an empty task list resolves to an empty array',
          assertion:
            "await (async () => { const out = await solution.promisePool([], 3); return Array.isArray(out) && out.length === 0; })()",
        },
        {
          name: 'a limit larger than the task count is fine',
          assertion:
            "await (async () => { const out = await solution.promisePool([async () => 1, async () => 2], 10); return deepEqual(out, [1, 2]); })()",
        },
        {
          name: 'runs every task exactly once',
          assertion:
            "await (async () => { let runs = 0; const tasks = Array.from({ length: 7 }, (_, i) => async () => { runs++; return i * 2; }); const out = await solution.promisePool(tasks, 3); return runs === 7 && deepEqual(out, [0, 2, 4, 6, 8, 10, 12]); })()",
        },
        {
          name: 'a rejecting task rejects the pool',
          assertion:
            "await (async () => { try { await solution.promisePool([async () => { throw new Error('nope'); }], 1); return false; } catch (err) { return err.message === 'nope'; } })()",
          hidden: true,
        },
        {
          name: 'refills a free slot immediately instead of waiting for the batch',
          assertion:
            "await (async () => { const order = []; const make = (ms, tag) => () => new Promise(r => setTimeout(() => { order.push(tag); r(tag); }, ms)); await solution.promisePool([make(40, 'slow'), make(5, 'a'), make(5, 'b')], 2); return deepEqual(order, ['a', 'b', 'slow']); })()",
          hidden: true,
        },
      ],
      xp: 100,
    },
    {
      slug: 'debounce-with-controls',
      title: 'debounce with cancel, flush and a leading edge',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Search-as-you-type should not fire a request per keystroke. Write \`debounce(fn, wait, options)\`.

The returned function:

1. Delays calling \`fn\` until \`wait\` ms have passed with no further calls.
2. Calls \`fn\` with the **most recent** arguments.
3. Exposes \`.cancel()\` — discards any pending call.
4. Exposes \`.flush()\` — if a call is pending, run it now (synchronously) and clear the timer.
5. Supports \`{ leading: true }\` — fire immediately on the first call of a burst, and then only fire again on the trailing edge if there *were* further calls during the wait.

\`\`\`js
const save = debounce(persist, 300);
save('a'); save('b'); save('c');   // persist('c') runs once, 300ms after the last call
\`\`\`

> The tests use real timers with very short waits, so keep your implementation free of busy loops.`,
      starterCode: `function debounce(fn, wait = 0, options = {}) {
  // your code here
}

module.exports = { debounce };`,
      solutionCode: `function debounce(fn, wait = 0, options = {}) {
  const { leading = false } = options;

  let timer = null;
  let pendingArgs = null;
  let pendingThis = null;

  function invoke() {
    timer = null;
    if (pendingArgs === null) return;   // leading-only burst: nothing to flush
    const args = pendingArgs;
    const context = pendingThis;
    pendingArgs = null;
    pendingThis = null;
    fn.apply(context, args);
  }

  function debounced(...args) {
    const isFirstOfBurst = timer === null;

    pendingArgs = args;
    pendingThis = this;

    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(invoke, wait);

    if (leading && isFirstOfBurst) {
      const immediateArgs = pendingArgs;
      pendingArgs = null;
      pendingThis = null;
      fn.apply(this, immediateArgs);
    }
  }

  debounced.cancel = function cancel() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pendingArgs = null;
    pendingThis = null;
  };

  debounced.flush = function flush() {
    if (timer !== null) {
      clearTimeout(timer);
      invoke();
    }
  };

  return debounced;
}

module.exports = { debounce };`,
      hints: [
        'Keep three pieces of closure state: the timer id, the last arguments, and the last `this`.',
        'Every call clears the previous timer and starts a new one — that is the whole debounce.',
        '`flush` should clear the timer and then run the same code the timer would have run; factor that into a shared `invoke()`.',
        'For `leading`, detect "first call of a burst" by checking whether the timer was null BEFORE you set the new one, then clear the pending args so the trailing edge does not double-fire.',
      ],
      tests: [
        {
          name: 'collapses a burst into a single call',
          assertion:
            "await (async () => { let calls = 0; const d = solution.debounce(() => { calls++; }, 20); d(); d(); d(); await new Promise(r => setTimeout(r, 60)); return calls === 1; })()",
        },
        {
          name: 'uses the most recent arguments',
          assertion:
            "await (async () => { let got = null; const d = solution.debounce((v) => { got = v; }, 15); d('a'); d('b'); d('c'); await new Promise(r => setTimeout(r, 50)); return got === 'c'; })()",
        },
        {
          name: 'does not fire before the wait has elapsed',
          assertion:
            "await (async () => { let calls = 0; const d = solution.debounce(() => { calls++; }, 40); d(); await new Promise(r => setTimeout(r, 5)); const early = calls; d.cancel(); return early === 0; })()",
        },
        {
          name: 'separate bursts each fire once',
          assertion:
            "await (async () => { let calls = 0; const d = solution.debounce(() => { calls++; }, 10); d(); await new Promise(r => setTimeout(r, 35)); d(); await new Promise(r => setTimeout(r, 35)); return calls === 2; })()",
        },
        {
          name: 'cancel discards a pending call',
          assertion:
            "await (async () => { let calls = 0; const d = solution.debounce(() => { calls++; }, 15); d(); d.cancel(); await new Promise(r => setTimeout(r, 45)); return calls === 0; })()",
        },
        {
          name: 'flush runs the pending call immediately',
          assertion:
            "await (async () => { let got = null; const d = solution.debounce((v) => { got = v; }, 40); d('x'); d.flush(); return got === 'x'; })()",
        },
        {
          name: 'flush on an idle debouncer does nothing',
          assertion:
            "await (async () => { let calls = 0; const d = solution.debounce(() => { calls++; }, 20); d.flush(); await new Promise(r => setTimeout(r, 40)); return calls === 0; })()",
          hidden: true,
        },
        {
          name: 'leading:true fires once immediately and not again for a single call',
          assertion:
            "await (async () => { let calls = 0; const d = solution.debounce(() => { calls++; }, 20, { leading: true }); d(); const immediate = calls; await new Promise(r => setTimeout(r, 50)); return immediate === 1 && calls === 1; })()",
          hidden: true,
        },
        {
          name: 'leading:true still fires a trailing call for later keystrokes',
          assertion:
            "await (async () => { const seen = []; const d = solution.debounce((v) => seen.push(v), 20, { leading: true }); d('a'); d('b'); d('c'); await new Promise(r => setTimeout(r, 60)); return deepEqual(seen, ['a', 'c']); })()",
          hidden: true,
        },
      ],
      xp: 80,
    },
  ],
  flashcards: [
    {
      front: 'What is the event loop’s scheduling rule?',
      back: 'Run one macrotask to completion, then drain the ENTIRE microtask queue (including microtasks queued by microtasks), then optionally render, then take the next macrotask.',
      tags: ['javascript', 'event-loop'],
    },
    {
      front: 'Microtask or macrotask: `setTimeout`, `.then`, `queueMicrotask`, DOM events?',
      back: 'Macrotasks: `setTimeout`, `setInterval`, DOM events, I/O. Microtasks: promise callbacks, `await` continuations, `queueMicrotask`, `MutationObserver`.',
      tags: ['javascript', 'event-loop'],
    },
    {
      front: 'What runs synchronously inside an `async` function?',
      back: 'Everything up to the first `await`. The remainder is scheduled as a microtask when the awaited value settles. The function itself always returns a promise.',
      tags: ['javascript', 'async'],
    },
    {
      front: 'When does a `fetch()` promise reject?',
      back: 'Only on network-level failure: offline, DNS, CORS block, or abort. A 404 or 500 fulfils — check `response.ok` and throw yourself.',
      tags: ['javascript', 'fetch'],
    },
    {
      front: 'Promise.all vs allSettled vs race vs any',
      back: '`all`: all fulfil, rejects on the first failure. `allSettled`: never rejects, reports every outcome. `race`: first to settle, win or lose. `any`: first to fulfil, rejects with AggregateError only if all reject.',
      tags: ['javascript', 'promises'],
    },
    {
      front: 'How do you cancel an in-flight fetch?',
      back: '`const c = new AbortController()`, pass `c.signal` in the options, call `c.abort()`. The fetch rejects with a DOMException whose `name` is `AbortError`. `AbortSignal.timeout(ms)` does the timeout case.',
      tags: ['javascript', 'fetch'],
    },
    {
      front: 'Why add jitter to exponential backoff?',
      back: 'Without random jitter, every client that failed at the same moment retries at the same moment — a thundering herd that re-breaks the recovering server.',
      tags: ['javascript', 'networking'],
    },
    {
      front: 'Debounce vs throttle',
      back: 'Debounce: run once, `wait` ms after the LAST call (search-as-you-type, autosave). Throttle: run at most once per interval during a continuous stream (scroll, mousemove, drag).',
      tags: ['javascript', 'performance'],
    },
    {
      front: 'What is event delegation and why use it?',
      back: 'One listener on a stable ancestor plus `event.target.closest(selector)`, relying on bubbling. It works for elements added later, uses one listener instead of N, and needs no cleanup.',
      tags: ['javascript', 'dom'],
    },
    {
      front: 'Which common events do NOT bubble?',
      back: '`focus`, `blur`, `mouseenter`, `mouseleave`, `load`, `scroll` (on elements). Delegate with `focusin`/`focusout`/`mouseover`/`mouseout` instead.',
      tags: ['javascript', 'dom'],
    },
    {
      front: '`textContent` vs `innerHTML`',
      back: '`textContent` sets text with no parsing — always safe. `innerHTML` parses markup and executes injected attributes, so it is an XSS vector for any user-supplied string.',
      tags: ['javascript', 'dom', 'security'],
    },
    {
      front: 'Why use IntersectionObserver instead of a scroll listener?',
      back: 'Visibility is computed asynchronously by the browser, avoiding the forced synchronous layout of `getBoundingClientRect()` per scroll event. `rootMargin` also lets you trigger before the element is on screen.',
      tags: ['javascript', 'dom', 'performance'],
    },
  ],
  resources: [
    {
      label: 'MDN — Using Promises',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises',
      kind: 'DOCS',
    },
    {
      label: 'MDN — Using the Fetch API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch',
      kind: 'DOCS',
    },
    {
      label: 'HTML Standard — Event loops',
      url: 'https://html.spec.whatwg.org/multipage/webappapis.html#event-loops',
      kind: 'SPEC',
    },
    {
      label: 'Jake Archibald — In The Loop (tasks, microtasks, queues)',
      url: 'https://www.youtube.com/watch?v=cCOL7MC4Pl0',
      kind: 'VIDEO',
    },
    {
      label: 'MDN — Intersection Observer API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API',
      kind: 'DOCS',
    },
  ],
};

export default day;
