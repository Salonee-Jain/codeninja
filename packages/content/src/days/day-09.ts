import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 9,
  week: 2,
  pillar: 'FRONTEND',
  title: 'React Hooks in Depth',
  summary: 'Effects, refs, memoisation and reducers — what each hook is actually for, and when it is the wrong tool.',
  estimatedMinutes: 330,
  objectives: [
    'State the rules of hooks and explain why call order makes them non-negotiable',
    'Write effects with correct dependencies and cleanup, and recognise the cases where no effect is needed',
    'Diagnose and fix the three common infinite-render loops',
    'Use useRef for mutable values and DOM access without triggering renders',
    'Decide when useMemo/useCallback pay for themselves and when they are pure overhead',
    'Model complex state with useReducer and share it with useContext without over-rendering',
    'Extract reusable stateful logic into custom hooks',
    'Explain useId, useTransition, useDeferredValue and the basics of Suspense',
  ],
  technologies: ['React.js'],
  lessons: [
    {
      slug: 'rules-of-hooks-and-custom-hooks',
      title: 'The Rules of Hooks, How They Work, and Custom Hooks',
      estimatedMinutes: 75,
      body: `# The Rules of Hooks, How They Work, and Custom Hooks

## Two rules, one reason

1. **Only call hooks at the top level.** Never inside a condition, loop, nested function, or after an early \`return\`.
2. **Only call hooks from React function components or from other hooks.** Not from a click handler, not from a plain utility function.

Both rules come from a single implementation fact: **React identifies your hooks by call order, not by name.**

A component's hooks live on its fiber as an ordered list. On the first render React appends a slot per hook call. On every render after that, it walks the same list in the same order and hands back slot 1 to the first hook call, slot 2 to the second, and so on. There is no key, no label, no map from \`'count'\` to a value. Position *is* the identity.

\`\`\`jsx
function Profile({ userId }) {
  const [name, setName] = useState('');          // slot 0
  if (!userId) return null;                       // ⛔ early return before a hook
  const [posts, setPosts] = useState([]);         // slot 1 — only sometimes
  useEffect(() => { /* ... */ }, [userId]);       // slot 2 — only sometimes
}
\`\`\`

Render once with a \`userId\` and slots are \`[name, posts, effect]\`. Render again without one and React only sees the first call — the list is now misaligned. On the next render with a \`userId\`, \`posts\` reads the slot that used to hold something else. React throws "Rendered fewer hooks than expected" if it can detect it; if it cannot, you get silent state corruption, which is worse.

The fix is never to move the hook — it is to move the condition **inside** the hook, or to split the component:

\`\`\`jsx
function Profile({ userId }) {
  const [name, setName] = useState('');
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    if (!userId) return;      // ✅ condition inside the effect
    loadPosts(userId).then(setPosts);
  }, [userId]);
  if (!userId) return null;   // ✅ early return AFTER all hooks
  return <Details name={name} posts={posts} />;
}
\`\`\`

Install \`eslint-plugin-react-hooks\` and turn \`rules-of-hooks\` on as an **error**, not a warning. It catches every instance of this statically, and it is the reason the second rule exists: the linter can only verify call order if hooks are called from things it can recognise as components or hooks — hence the naming convention.

## The naming convention is load-bearing

A function whose name starts with \`use\` is treated by the linter as a hook: it may call other hooks, and every rule applies to its call sites. A function *not* named \`use...\` is treated as an ordinary function and may not call hooks. Name a custom hook \`getUser\` and the linter stops protecting you.

## The complete hook inventory

| Hook | Purpose |
| --- | --- |
| \`useState\` | local state, replace-style updates |
| \`useReducer\` | local state, action-style updates |
| \`useEffect\` | synchronise with an external system after commit |
| \`useLayoutEffect\` | same, but before the browser paints (measure/adjust) |
| \`useRef\` | mutable box that survives renders, does not trigger them |
| \`useMemo\` | cache an expensive computed value between renders |
| \`useCallback\` | cache a function identity between renders |
| \`useContext\` | read the nearest provider's value |
| \`useId\` | generate a stable unique id for a11y attributes |
| \`useTransition\` | mark an update as non-urgent, get an \`isPending\` flag |
| \`useDeferredValue\` | render a stale copy of a value while a new one is prepared |
| \`useSyncExternalStore\` | subscribe safely to a store outside React |
| \`useImperativeHandle\` | customise what a parent's ref sees |
| \`useDebugValue\` | label a custom hook in DevTools |

Most days you will use the first six.

## Custom hooks: the real reuse primitive

A custom hook is just a function that calls hooks. It shares **logic**, not state — every component that calls it gets its own independent slots.

\`\`\`jsx
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const raw = localStorage.getItem(key);
    return raw === null ? initialValue : JSON.parse(raw);
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
\`\`\`

Two components calling \`useLocalStorage('theme', 'dark')\` have two separate \`useState\` slots. They happen to converge because they read and write the same storage key — that is a property of localStorage, not of the hook.

Note the lazy initialiser: \`useState(() => ...)\` runs the reader once on mount instead of on every render. Reading localStorage is synchronous and slow enough to matter in a list.

A second example, this time wrapping a browser API with proper cleanup:

\`\`\`jsx
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);            // resync in case it changed before subscribing
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

const isWide = useMediaQuery('(min-width: 900px)');
\`\`\`

### What makes a good custom hook

- **It has a job, not a grab-bag.** \`useAuth\` is a hook; \`useEverything\` is a module.
- **Its return shape is stable.** Return an array for a value/setter pair (callers rename freely), an object once you have three or more values (callers destructure what they need).
- **It does not lie about its dependencies.** If it takes a callback prop, that callback belongs in the effect's dependency array — or gets stabilised deliberately.
- **It is testable without a component** when possible: pull the pure part out into a plain function and let the hook be thin glue. That is exactly what today's coding problems do.

> A component that does nothing but call three custom hooks and render markup is usually a well-factored component. A custom hook that exists only to hide a single \`useState\` is usually indirection for its own sake.`,
    },
    {
      slug: 'useeffect-in-depth',
      title: 'useEffect: Dependencies, Cleanup, and When Not to Use It',
      estimatedMinutes: 90,
      body: `# useEffect: Dependencies, Cleanup, and When Not to Use It

\`useEffect\` is the most used and most misused hook in React. Its purpose is narrow: **synchronise your component with a system outside React**. Not "run code after render". Not "respond to a click". Synchronise with a subscription, a browser API, a timer, a network connection, a third-party widget.

\`\`\`jsx
useEffect(setup, dependencies?);
\`\`\`

React runs \`setup\` after the commit is painted. If \`setup\` returns a function, that is the **cleanup**, and React runs it before the next \`setup\` and once more on unmount.

## The dependency array is a comparison, not a schedule

| Second argument | Behaviour |
| --- | --- |
| omitted | run setup after **every** commit |
| \`[]\` | run once after mount, cleanup on unmount |
| \`[a, b]\` | run again whenever \`a\` or \`b\` changes by \`Object.is\` |

That last row is the whole story: React stores the previous array and compares it element-by-element with \`Object.is\`. It does not diff deeply. Two structurally identical objects are different dependencies.

\`\`\`jsx
useEffect(() => {
  fetchResults(options).then(setResults);
}, [options]); // ⛔ if options = { page: 1 } is built inline in the parent, this runs every render
\`\`\`

Fixes, in order of preference: pass primitives (\`[options.page, options.sort]\`), build the object inside the effect, or \`useMemo\` the object in the parent.

**Never lie to the linter.** \`react-hooks/exhaustive-deps\` lists every reactive value your effect reads. Deleting a dependency to stop a loop does not fix the loop, it hides a stale closure — the effect will keep using a value from a render that ended long ago. If the effect should not re-run when a value changes, that value is telling you it belongs in a ref, or the effect is doing too much.

## Cleanup is not optional

\`\`\`jsx
useEffect(() => {
  const id = setInterval(() => setTick((t) => t + 1), 1000);
  return () => clearInterval(id);
}, []);
\`\`\`

Without the cleanup, every remount leaks another interval. Under StrictMode, React mounts, unmounts and remounts every component in development precisely to make this leak visible immediately: your counter jumps by two, and you go fix the cleanup.

The subtler case is a **race condition** in data fetching. Two requests in flight, the slower one started first, and it resolves last:

\`\`\`jsx
useEffect(() => {
  let cancelled = false;
  setStatus('loading');
  fetch('/api/users/' + userId)
    .then((r) => r.json())
    .then((data) => {
      if (cancelled) return;      // a newer effect has already run
      setUser(data);
      setStatus('done');
    });
  return () => { cancelled = true; };
}, [userId]);
\`\`\`

The \`AbortController\` variant actually cancels the request:

\`\`\`jsx
useEffect(() => {
  const controller = new AbortController();
  fetch('/api/users/' + userId, { signal: controller.signal })
    .then((r) => r.json())
    .then(setUser)
    .catch((err) => { if (err.name !== 'AbortError') setError(err); });
  return () => controller.abort();
}, [userId]);
\`\`\`

## The three infinite loops

**1. Setting state the effect depends on.**

\`\`\`jsx
useEffect(() => { setCount(count + 1); }, [count]); // render → effect → state → render → ...
\`\`\`

**2. Omitting the array entirely while setting state.**

\`\`\`jsx
useEffect(() => { setData(transform(raw)); }); // no deps → runs every commit → sets state → commit → ...
\`\`\`

**3. A non-primitive dependency recreated every render.**

\`\`\`jsx
const config = { limit: 10 };                     // new object each render
useEffect(() => { load(config); }, [config]);     // Object.is fails → runs forever
\`\`\`

React's guard eventually throws "Too many re-renders", but often the loop is slow enough to just melt the tab. The tell is a component whose render count climbs while the user does nothing.

## When NOT to use an effect

This is the section that separates competent React from cargo-culted React. Ask: *is there an external system here?* If not, you probably do not need an effect.

**Do not use an effect to derive state.** Compute it during render.

\`\`\`jsx
// ❌ two renders, one of them showing a stale total
const [total, setTotal] = useState(0);
useEffect(() => { setTotal(items.reduce((s, i) => s + i.price, 0)); }, [items]);

// ✅ one render, never stale
const total = items.reduce((s, i) => s + i.price, 0);
\`\`\`

If the computation is genuinely expensive, wrap it in \`useMemo\` — still not an effect.

**Do not use an effect to reset state when a prop changes.** Change the key.

\`\`\`jsx
// ❌ renders once with the old comment, then again empty
useEffect(() => { setDraft(''); }, [postId]);

// ✅ in the parent — remount instead
<CommentBox key={postId} postId={postId} />
\`\`\`

**Do not use an effect to respond to an event.** Put the code in the handler.

\`\`\`jsx
// ❌ fires on any render where submitted happens to be true
useEffect(() => { if (submitted) postOrder(cart); }, [submitted]);

// ✅ the user clicking is the cause; the handler is the place
function handleSubmit() { postOrder(cart); }
\`\`\`

The heuristic: an effect runs because something is *displayed*; a handler runs because the user *did something*. Buying a product is not caused by the page being displayed.

**Do not use an effect to transform props for children.** Pass the derived value down directly.

**Do not use an effect to fetch data in a real app.** Day 10 replaces this with TanStack Query — effects give you no caching, no deduplication, no retry, and a race condition per request.

## useEffect vs useLayoutEffect

\`useLayoutEffect\` runs synchronously after the DOM mutation but **before the browser paints**. Use it only when you must measure the DOM and adjust before the user sees anything — positioning a tooltip that would otherwise flicker in the wrong place. Because it blocks paint, everything else belongs in \`useEffect\`.

\`\`\`jsx
useLayoutEffect(() => {
  const { height } = ref.current.getBoundingClientRect();
  setTooltipTop(height > 200 ? -200 : -height);
}, [content]);
\`\`\`

> Rule of thumb: reach for \`useEffect\` when you are talking to something React does not control. If both sides of the interaction are React state, there is almost always a better answer.`,
    },
    {
      slug: 'refs-memo-and-callback',
      title: 'useRef, useMemo, useCallback — Identity and Escape Hatches',
      estimatedMinutes: 80,
      body: `# useRef, useMemo, useCallback — Identity and Escape Hatches

## useRef: a box that does not re-render

\`\`\`jsx
const ref = useRef(initialValue); // → { current: initialValue }
\`\`\`

\`useRef\` returns the **same object** on every render. Writing \`ref.current = x\` mutates that object and triggers nothing. That is the point, and it gives the hook two distinct uses.

**1. A handle on a DOM node.**

\`\`\`jsx
function SearchBox() {
  const inputRef = useRef(null);
  return (
    <>
      <input ref={inputRef} />
      <button onClick={() => inputRef.current.focus()}>Focus</button>
    </>
  );
}
\`\`\`

React assigns the node to \`.current\` during commit and sets it back to \`null\` on unmount. During the first render \`inputRef.current\` is still \`null\` — never read it in the render body.

**2. A mutable value that must survive renders but must not cause them.** Timer ids, previous values, "has this already run" flags, third-party instances:

\`\`\`jsx
function useInterval(callback, delay) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
\`\`\`

The ref is what lets the interval always call the *latest* callback without being torn down and recreated whenever the parent re-renders with a new function. That pattern — read the latest value without depending on it — is the main legitimate reason to reach for a ref.

> Refs are an escape hatch from React's data flow. Anything that should appear on screen belongs in state. If you find yourself writing a ref and then forcing a re-render to display it, you wanted state.

**Never write to a ref during render.** Render must be pure; ref writes belong in effects or event handlers.

## Identity: why anything needs memoising

Every render creates new objects, arrays and functions:

\`\`\`jsx
function Parent() {
  const handleClick = () => {};     // brand-new function every render
  const config = { size: 'lg' };    // brand-new object every render
  return <Child onClick={handleClick} config={config} />;
}
\`\`\`

Normally this is free — allocating a closure is cheap and \`Child\` re-renders anyway because its parent did. It becomes expensive in exactly three situations:

1. \`Child\` is wrapped in \`React.memo\`, which skips re-rendering when props are shallow-equal. New identities defeat it entirely.
2. The value is in a **dependency array** (\`useEffect\`, \`useMemo\`, another \`useCallback\`). New identity means the effect re-fires.
3. The computation itself is genuinely expensive — parsing, sorting 50 000 rows, building an index.

\`useMemo\` and \`useCallback\` exist for those three cases and no others.

\`\`\`jsx
const visible = useMemo(
  () => rows.filter((r) => r.status === status).sort(byDate),
  [rows, status],
);

const handleSelect = useCallback((id) => setSelected(id), []);
\`\`\`

\`useCallback(fn, deps)\` is literally \`useMemo(() => fn, deps)\`.

## When memoising is a pessimisation

Memoisation is not free. Every \`useMemo\` costs:

- an extra hook slot and a stored dependency array,
- a dependency comparison on **every single render**,
- the closure allocation you were trying to avoid — the arrow function passed to \`useMemo\` is created every render regardless,
- and, most expensively, reader time. A file where every value is wrapped is meaningfully harder to change.

\`\`\`jsx
const doubled = useMemo(() => count * 2, [count]);   // ❌ the comparison costs more than the multiply
const fullName = useMemo(() => a + ' ' + b, [a, b]); // ❌ same
\`\`\`

The failure mode people miss is **memoising the wrong link in the chain**:

\`\`\`jsx
function Parent({ rows }) {
  const handleSelect = useCallback((id) => select(id), []);
  const columns = [{ key: 'name' }, { key: 'email' }];  // ← still new every render
  return <MemoTable rows={rows} columns={columns} onSelect={handleSelect} />;
}
\`\`\`

\`MemoTable\` re-renders anyway because \`columns\` changed. The \`useCallback\` bought nothing. \`React.memo\` is all-or-nothing on props: **one** unstable prop defeats the whole thing. Hoist \`columns\` to module scope — a constant that never changes needs no hook at all.

The other trap: \`React.memo\` compares props shallowly on every render of the parent. For a component that is cheap to render, the comparison can cost more than the render it skips.

### A decision procedure

1. Measure first. React DevTools Profiler, "Record why each component rendered".
2. Is the render actually slow (say > 5 ms) or does it fire absurdly often? If not, stop.
3. Prefer structural fixes: move state down so fewer components re-render; pass \`children\` through instead of re-creating a subtree; hoist constants out of the component.
4. Only then memoise — and memoise the *whole* chain of props feeding the memoised component.
5. Re-measure. If the number did not move, delete the memoisation.

> The React Compiler (React 19+) automates most of this by inserting memoisation for you at build time. It does not change the analysis above; it changes who writes it. Code that is already pure and follows the rules of hooks is what the compiler can optimise.

## Referential integrity in custom hooks

If your custom hook returns an object or a function, callers will put it in dependency arrays. Return stable identities:

\`\`\`jsx
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return [on, toggle];   // toggle is stable forever
}
\`\`\`

Note the updater form inside \`toggle\`: it lets the dependency array be empty, because the callback never needs to read \`on\`. That trick — updater functions to shrink dependency arrays — removes more memoisation problems than \`useCallback\` ever will.`,
    },
    {
      slug: 'reducer-context-and-concurrent-hooks',
      title: 'useReducer, useContext & the Concurrent Hooks',
      estimatedMinutes: 85,
      body: `# useReducer, useContext & the Concurrent Hooks

## useReducer: state transitions as data

\`useState\` is fine until several pieces of state must change together, or until the same update is triggered from five places. Then you want a reducer.

\`\`\`jsx
const [state, dispatch] = useReducer(reducer, initialArg, init?);
\`\`\`

\`\`\`jsx
const initialState = { items: [], filter: 'all', editingId: null };

function todosReducer(state, action) {
  switch (action.type) {
    case 'added':
      return { ...state, items: [...state.items, { id: action.id, text: action.text, done: false }] };
    case 'toggled':
      return {
        ...state,
        items: state.items.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)),
      };
    case 'cleared_completed':
      return { ...state, items: state.items.filter((t) => !t.done), editingId: null };
    case 'filter_changed':
      return { ...state, filter: action.filter };
    default:
      return state;                    // unknown action: same reference, no re-render
  }
}

function Todos() {
  const [state, dispatch] = useReducer(todosReducer, initialState);
  return <button onClick={() => dispatch({ type: 'cleared_completed' })}>Clear done</button>;
}
\`\`\`

A reducer must be a **pure function**: \`(state, action) => newState\`, no fetching, no \`Date.now()\`, no mutation. That purity is what makes it trivially unit-testable — as today's second problem shows, you can test every transition with plain JavaScript and no React at all. It also means StrictMode can double-invoke it safely.

The third argument is a lazy initialiser: \`useReducer(reducer, todoStrings, init)\` calls \`init(todoStrings)\` once on mount. Use it when building the initial state is expensive or needs transforming.

Reach for \`useReducer\` when: several fields change in one logical step; the next state depends on the previous in non-trivial ways; the same transitions are dispatched from many components; or you want an action log you can print when debugging. Stay with \`useState\` for independent, simple values — three booleans do not need a reducer.

Naming: actions describe **what happened** (\`'added'\`, \`'filter_changed'\`), not what to do (\`'setItems'\`). A reducer full of \`set*\` actions is \`useState\` with extra steps.

## useContext: pass values without drilling

Context solves exactly one problem: getting a value from an ancestor to a deep descendant without threading it through every component in between.

\`\`\`jsx
import { createContext, useContext, useReducer, useMemo } from 'react';

const TodosContext = createContext(null);

export function TodosProvider({ children }) {
  const [state, dispatch] = useReducer(todosReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>;
}

export function useTodos() {
  const ctx = useContext(TodosContext);
  if (ctx === null) throw new Error('useTodos must be used inside a TodosProvider');
  return ctx;
}
\`\`\`

Three patterns worth copying from that snippet:

1. **Export a custom hook, not the context.** Consumers call \`useTodos()\`; they never import \`TodosContext\`. You can change the implementation later without touching a single consumer.
2. **Throw on a missing provider.** A default of \`null\` plus an explicit error turns "why is everything undefined" into a one-line stack trace.
3. **Memoise the value object.** \`value={{ state, dispatch }}\` written inline creates a new object every render of the provider, so every consumer re-renders even when nothing changed.

### The re-render trap

Every consumer of a context re-renders when the context **value** changes — \`React.memo\` does not stop it, because the read happens inside the component. If your value bundles frequently-changing state with a stable dispatcher, split it into two contexts:

\`\`\`jsx
<TodosStateContext.Provider value={state}>
  <TodosDispatchContext.Provider value={dispatch}>
    {children}
  </TodosDispatchContext.Provider>
</TodosStateContext.Provider>
\`\`\`

\`dispatch\` is guaranteed stable by React, so components that only dispatch never re-render when the state changes. This "reducer + two contexts" shape is a genuinely good global-state solution for small and mid-sized apps — and it is why days 11 and 12 exist, for when it stops scaling.

> Context is a transport mechanism, not a state manager. It does not memoise, batch or select. For high-frequency updates (mouse position, form keystrokes) it will re-render half your tree.

## The concurrent hooks

**\`useId\`** generates an id that is stable across server and client rendering — the only correct way to link labels and inputs in a reusable component:

\`\`\`jsx
function Field({ label, ...props }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-describedby={id + '-hint'} {...props} />
    </>
  );
}
\`\`\`

Never use it as a list key — it identifies a component instance, not a data item.

**\`useTransition\`** marks an update as non-urgent so React can keep the UI responsive:

\`\`\`jsx
const [isPending, startTransition] = useTransition();

function handleChange(e) {
  setQuery(e.target.value);                        // urgent: the input must feel instant
  startTransition(() => setResults(search(e.target.value))); // non-urgent: can be interrupted
}
\`\`\`

React renders the urgent update immediately and may abandon an in-progress transition render if a newer urgent update arrives. \`isPending\` lets you dim the stale list instead of showing a spinner.

**\`useDeferredValue\`** is the same idea when you only have a value, not a setter — useful when the slow part is a child you do not control:

\`\`\`jsx
const deferredQuery = useDeferredValue(query);
return <SlowResults query={deferredQuery} style={{ opacity: query === deferredQuery ? 1 : 0.6 }} />;
\`\`\`

Neither hook makes rendering faster. They change **priority**, so a slow render stops blocking typing. If the render is slow because of an O(n²) loop, fix the loop.

## Suspense, briefly

\`<Suspense>\` declares a loading boundary for children that are not ready yet:

\`\`\`jsx
<Suspense fallback={<Skeleton />}>
  <Comments postId={id} />
</Suspense>
\`\`\`

It works with \`React.lazy()\` for code splitting today, and with data libraries that integrate with it (TanStack Query's \`useSuspenseQuery\`, React Router's data APIs, framework loaders). It replaces \`{isLoading ? <Spinner/> : ...}\` scattered through your tree with one declarative boundary — and it composes with error boundaries, which catch the failure case. Day 10 puts both to work.`,
    },
  ],
  quiz: [
    {
      prompt: 'Why may hooks not be called inside an `if` block?',
      options: [
        'Because React would not know which component the hook belongs to',
        'Because React identifies hook state by call order, so a skipped call shifts every later hook onto the wrong slot',
        'Because conditionals are not allowed inside function components at all',
        'Because the JSX compiler cannot statically analyse conditionals',
      ],
      correctIndex: 1,
      explanation:
        'Hook state lives in an ordered list on the fiber with no names or keys. A conditional call changes the order between renders, so slots misalign — hence "Rendered fewer hooks than expected" or, worse, silent state corruption.',
      difficulty: 'EASY',
    },
    {
      prompt: 'An effect with `[options]` in its deps re-runs on every render. `options` is `{ page: 1 }` created inline in the parent. What is the cleanest fix?',
      options: [
        'Remove `options` from the dependency array',
        'Use `useLayoutEffect` instead',
        'Compare the dependency with JSON.stringify inside the effect',
        'Depend on primitives such as `[options.page]`, or build the object inside the effect / memoise it in the parent',
      ],
      correctIndex: 3,
      explanation:
        'Dependencies are compared with `Object.is`, so a fresh object is always "changed". Removing it from the array silences the linter but leaves a stale closure. Depend on primitive fields, or stabilise the object.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which of these genuinely needs a `useEffect`?',
      options: [
        'Subscribing to a `matchMedia` change event and unsubscribing on unmount',
        'Computing a cart total from the items array',
        'Clearing a draft when the selected post changes',
        'Sending an analytics event when the user clicks Buy',
      ],
      correctIndex: 0,
      explanation:
        'Only the subscription talks to an external system. Totals are derived during render, resetting state on a prop change is done with `key`, and click-driven work belongs in the event handler.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What does the cleanup function returned from `useEffect` do?',
      options: [
        'It runs only when the component unmounts',
        'It runs before every re-render of the component',
        'It runs before the next setup (when dependencies change) and once on unmount',
        'It runs immediately after setup, in the same commit',
      ],
      correctIndex: 2,
      explanation:
        'Cleanup runs before each subsequent setup and at unmount — that is what makes an effect a *synchronisation*: tear down the old connection, then set up the new one.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Why does writing `ref.current = value` not re-render the component?',
      options: [
        'It does re-render, but React batches it away',
        'Refs are frozen objects, so the write is ignored',
        'React re-renders only when a ref is attached to a DOM node',
        '`useRef` returns the same mutable object each render; React does not track writes to it, which is precisely why it is used for values that must not trigger renders',
      ],
      correctIndex: 3,
      explanation:
        'A ref is a plain mutable box that survives renders. Nothing observes `.current`. Anything that should appear on screen belongs in state instead.',
      difficulty: 'EASY',
    },
    {
      prompt: 'A `React.memo` child still re-renders every time even though its `onSelect` prop is wrapped in `useCallback`. What is the most likely cause?',
      options: [
        'Another prop — such as an inline `columns` array — is recreated each render, and memo is all-or-nothing on props',
        '`useCallback` does not work on props passed to memoised components',
        '`React.memo` compares props deeply and always finds a difference',
        'The child calls `useState`, which disables memoisation',
      ],
      correctIndex: 0,
      explanation:
        '`React.memo` does a shallow comparison of every prop. A single unstable prop defeats the whole optimisation, so memoisation must cover the entire chain of props — or the constant should be hoisted out of the component.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Every consumer of a context re-renders even when only `dispatch` is used. Why, and what is the standard fix?',
      options: [
        'Because the provider is not memoised; wrap the provider component in React.memo',
        'Because context reads happen inside the component and React.memo cannot block them; split state and dispatch into two contexts, since dispatch is stable',
        'Because useContext always re-renders on every parent render regardless of value',
        'Because dispatch changes identity on every render; wrap it in useCallback',
      ],
      correctIndex: 1,
      explanation:
        'Consumers re-render when the context *value* changes, and memo cannot prevent it. `dispatch` from `useReducer` is guaranteed stable, so putting it in its own context lets dispatch-only components skip state updates entirely.',
      difficulty: 'HARD',
    },
    {
      prompt: 'What does `useTransition` actually do to a slow update?',
      options: [
        'It makes the update render faster by memoising the result',
        'It moves the work to a Web Worker',
        'It marks the update as non-urgent so React can interrupt it for urgent updates, and exposes an isPending flag',
        'It debounces the update by 300 ms',
      ],
      correctIndex: 2,
      explanation:
        'Transitions change priority, not speed. Urgent updates (typing) render immediately while the transition render can be interrupted and restarted. A genuinely slow computation still needs to be made faster.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'effect-dependency-engine',
      title: 'Dependency Comparison & the Effect Slot',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Reimplement the machinery behind \`useEffect\`.

**\`depsChanged(prevDeps, nextDeps)\`** returns \`true\` when React would re-run the effect:

- either array is \`undefined\` (no dependency argument) → always \`true\`
- different lengths → \`true\`
- otherwise compare element by element with \`Object.is\`

**\`createEffectSlot()\`** returns an object with:

- \`run(effect, deps)\` — runs \`effect()\` if this is the first run or the deps changed, storing whatever it returns as the cleanup. **The previous cleanup runs first.** Returns \`true\` if the effect ran, \`false\` if it was skipped.
- \`unmount()\` — runs the stored cleanup one last time and forgets it.

\`\`\`js
const slot = createEffectSlot();
slot.run(() => console.log('a'), [1]); // true  → logs a
slot.run(() => console.log('b'), [1]); // false → skipped
slot.run(() => console.log('c'), [2]); // true  → logs c
\`\`\`

Remember: \`Object.is\` treats \`NaN\` as equal to \`NaN\`, and \`+0\` as different from \`-0\`.`,
      starterCode: `function depsChanged(prevDeps, nextDeps) {
  // your code
}

function createEffectSlot() {
  let prevDeps;
  let cleanup;
  let hasRun = false;

  return {
    run(effect, deps) {
      // skip when it has run before and the deps are unchanged
      // otherwise: cleanup, run, remember the new cleanup and deps
    },
    unmount() {
      // run the last cleanup, if there is one
    },
  };
}

module.exports = { depsChanged, createEffectSlot };`,
      solutionCode: `function depsChanged(prevDeps, nextDeps) {
  if (prevDeps === undefined || nextDeps === undefined) return true;
  if (prevDeps.length !== nextDeps.length) return true;
  for (let i = 0; i < nextDeps.length; i++) {
    if (!Object.is(prevDeps[i], nextDeps[i])) return true;
  }
  return false;
}

function createEffectSlot() {
  let prevDeps;
  let cleanup;
  let hasRun = false;

  return {
    run(effect, deps) {
      if (hasRun && !depsChanged(prevDeps, deps)) return false;

      if (typeof cleanup === 'function') cleanup();

      const returned = effect();
      cleanup = typeof returned === 'function' ? returned : undefined;
      prevDeps = deps;
      hasRun = true;
      return true;
    },
    unmount() {
      if (typeof cleanup === 'function') cleanup();
      cleanup = undefined;
    },
  };
}

module.exports = { depsChanged, createEffectSlot };`,
      hints: [
        'Handle the undefined cases before touching .length, or you will throw on the first render.',
        'Object.is, not === — that is what makes [NaN] equal to [NaN].',
        'Track hasRun separately from prevDeps: an effect with deps `[]` has run, but prevDeps is an empty array.',
        'Cleanup runs BEFORE the new effect, and only if the previous effect actually returned a function.',
      ],
      tests: [
        {
          name: 'no dependency array always re-runs',
          assertion:
            "solution.depsChanged(undefined, undefined) === true && solution.depsChanged([1], undefined) === true",
        },
        {
          name: 'empty arrays never change',
          assertion: "solution.depsChanged([], []) === false",
        },
        {
          name: 'equal primitives do not change',
          assertion: "solution.depsChanged([1, 'a', true], [1, 'a', true]) === false",
        },
        {
          name: 'Object.is semantics: NaN equals NaN, +0 differs from -0',
          assertion:
            "solution.depsChanged([NaN], [NaN]) === false && solution.depsChanged([0], [-0]) === true",
        },
        {
          name: 'a fresh object literal is always a change',
          assertion: "solution.depsChanged([{ a: 1 }], [{ a: 1 }]) === true",
        },
        {
          name: 'different lengths change',
          assertion: "solution.depsChanged([1], [1, 2]) === true",
          hidden: true,
        },
        {
          name: 'effect runs on first use and skips when deps are equal',
          assertion:
            "(() => { const s = solution.createEffectSlot(); let n = 0; const e = () => { n += 1; }; const first = s.run(e, [1]); const second = s.run(e, [1]); return first === true && second === false && n === 1; })()",
        },
        {
          name: 'changed deps clean up the old effect before running the new one',
          assertion:
            "(() => { const s = solution.createEffectSlot(); const log = []; const make = (id) => () => { log.push('run' + id); return () => log.push('clean' + id); }; s.run(make(1), [1]); s.run(make(2), [2]); return log.join(',') === 'run1,clean1,run2'; })()",
        },
        {
          name: 'unmount runs the final cleanup exactly once',
          assertion:
            "(() => { const s = solution.createEffectSlot(); const log = []; s.run(() => { log.push('run'); return () => log.push('clean'); }, []); s.unmount(); s.unmount(); return log.join(',') === 'run,clean'; })()",
          hidden: true,
        },
        {
          name: 'omitting deps runs the effect every time',
          assertion:
            "(() => { const s = solution.createEffectSlot(); let n = 0; s.run(() => { n += 1; }); s.run(() => { n += 1; }); return n === 2; })()",
          hidden: true,
        },
      ],
      xp: 40,
    },
    {
      slug: 'todos-reducer-hook',
      title: 'A Reducer and the Hook Around It',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Reducers are pure functions, which is why they are the most testable part of a React app.

**\`todosReducer(state, action)\`** where state is \`{ items, filter }\` and \`items\` are \`{ id, text, done }\`:

| action | result |
| --- | --- |
| \`{ type: 'added', id, text }\` | append \`{ id, text, done: false }\` |
| \`{ type: 'toggled', id }\` | flip \`done\` on that item only |
| \`{ type: 'removed', id }\` | drop that item |
| \`{ type: 'filter_changed', filter }\` | replace \`filter\` |
| \`{ type: 'cleared_completed' }\` | keep only items where \`done\` is false |
| anything else | return the **same state reference** |

Never mutate \`state\`.

**\`createReducerHook(reducer, initialArg, init?)\`** mimics \`useReducer\`:

- if \`init\` is a function, the initial state is \`init(initialArg)\`; otherwise it is \`initialArg\`
- \`getState()\` returns the current state
- \`dispatch(action)\` computes the next state; if it is \`Object.is\`-equal to the current one, nothing is stored and **no listener is notified**
- \`subscribe(fn)\` registers a listener called with the new state on every real change, and returns an unsubscribe function`,
      starterCode: `function todosReducer(state, action) {
  switch (action.type) {
    // your cases
    default:
      return state;
  }
}

function createReducerHook(reducer, initialArg, init) {
  let state; // apply init if it is a function
  const listeners = new Set();

  return {
    getState() {},
    dispatch(action) {},
    subscribe(fn) {},
  };
}

module.exports = { todosReducer, createReducerHook };`,
      solutionCode: `function todosReducer(state, action) {
  switch (action.type) {
    case 'added':
      return {
        ...state,
        items: [...state.items, { id: action.id, text: action.text, done: false }],
      };
    case 'toggled':
      return {
        ...state,
        items: state.items.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)),
      };
    case 'removed':
      return { ...state, items: state.items.filter((t) => t.id !== action.id) };
    case 'filter_changed':
      return { ...state, filter: action.filter };
    case 'cleared_completed':
      return { ...state, items: state.items.filter((t) => !t.done) };
    default:
      return state;
  }
}

function createReducerHook(reducer, initialArg, init) {
  let state = typeof init === 'function' ? init(initialArg) : initialArg;
  const listeners = new Set();

  return {
    getState() {
      return state;
    },
    dispatch(action) {
      const next = reducer(state, action);
      if (Object.is(next, state)) return state;
      state = next;
      listeners.forEach((fn) => fn(state));
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

module.exports = { todosReducer, createReducerHook };`,
      hints: [
        'Each case spreads state and replaces only the slice it touches: { ...state, items: ... }.',
        'The default case must return `state` itself, not a copy — that reference equality is what lets React bail out.',
        'Compare with Object.is in dispatch so an unknown action notifies nobody.',
        'subscribe returns a function that removes the listener from the Set.',
      ],
      tests: [
        {
          name: 'added appends an undone item without mutating',
          assertion:
            "(() => { const s = { items: [], filter: 'all' }; const n = solution.todosReducer(s, { type: 'added', id: 1, text: 'a' }); return s.items.length === 0 && n.items.length === 1 && n.items[0].done === false && n.items[0].text === 'a'; })()",
        },
        {
          name: 'toggled flips only the matching item',
          assertion:
            "(() => { const s = { items: [{ id: 1, text: 'a', done: false }, { id: 2, text: 'b', done: false }], filter: 'all' }; const n = solution.todosReducer(s, { type: 'toggled', id: 1 }); return n.items[0].done === true && n.items[1].done === false && n.items[1] === s.items[1]; })()",
        },
        {
          name: 'removed drops the item and keeps the filter',
          assertion:
            "(() => { const n = solution.todosReducer({ items: [{ id: 1 }, { id: 2 }], filter: 'done' }, { type: 'removed', id: 1 }); return deepEqual(n.items.map((t) => t.id), [2]) && n.filter === 'done'; })()",
        },
        {
          name: 'cleared_completed keeps only unfinished items',
          assertion:
            "deepEqual(solution.todosReducer({ items: [{ id: 1, done: true }, { id: 2, done: false }, { id: 3, done: true }], filter: 'all' }, { type: 'cleared_completed' }).items.map((t) => t.id), [2])",
        },
        {
          name: 'unknown actions return the same reference',
          assertion:
            "(() => { const s = { items: [], filter: 'all' }; return solution.todosReducer(s, { type: 'nope' }) === s; })()",
        },
        {
          name: 'the hook stores dispatched state',
          assertion:
            "(() => { const h = solution.createReducerHook(solution.todosReducer, { items: [], filter: 'all' }); h.dispatch({ type: 'added', id: 1, text: 'x' }); h.dispatch({ type: 'filter_changed', filter: 'done' }); return h.getState().items.length === 1 && h.getState().filter === 'done'; })()",
        },
        {
          name: 'the lazy initialiser builds the initial state once',
          assertion:
            "(() => { const h = solution.createReducerHook(solution.todosReducer, ['a', 'b'], (texts) => ({ items: texts.map((t, i) => ({ id: i, text: t, done: false })), filter: 'all' })); return h.getState().items.length === 2 && h.getState().items[1].text === 'b'; })()",
        },
        {
          name: 'listeners fire only on a real change',
          assertion:
            "(() => { const h = solution.createReducerHook(solution.todosReducer, { items: [], filter: 'all' }); let n = 0; h.subscribe(() => { n += 1; }); h.dispatch({ type: 'filter_changed', filter: 'done' }); h.dispatch({ type: 'unknown' }); return n === 1; })()",
          hidden: true,
        },
        {
          name: 'unsubscribe stops the listener',
          assertion:
            "(() => { const h = solution.createReducerHook(solution.todosReducer, { items: [], filter: 'all' }); let n = 0; const off = h.subscribe(() => { n += 1; }); off(); h.dispatch({ type: 'filter_changed', filter: 'x' }); return n === 0; })()",
          hidden: true,
        },
      ],
      xp: 60,
    },
    {
      slug: 'hook-runtime-with-effects',
      title: 'A Hook Runtime with Memo, Effects and a Loop Guard',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Extend yesterday's mini renderer into a runtime that supports \`useState\`, \`useMemo\`, \`useCallback\` and \`useEffect\` — plus React's "Too many re-renders" guard.

\`createHookRuntime(component, options)\` calls \`component(props, hooks)\` where \`hooks\` has all four. It returns:

- \`render(props)\` — render, then flush effects; returns the output
- \`getOutput()\`, \`getRenderCount()\`
- \`unmount()\` — run every stored effect cleanup

Requirements:

1. Slots are assigned by call order and the index resets at the start of each render.
2. \`useMemo(factory, deps)\` recomputes only when \`deps\` change (same comparison as problem 1). \`useCallback(fn, deps)\` returns the *same function reference* while deps are unchanged.
3. \`useEffect(effect, deps)\` queues the effect when deps change; queued effects are flushed **after** the render, running the previous cleanup first.
4. Setting state re-renders synchronously with the last props, and flushes effects again. Identical values bail out.
5. **Loop guard:** if renders nest more than \`options.maxRenderDepth\` deep (default 25) — an effect setting state that re-triggers the effect — throw an \`Error\`. Nesting depth must unwind correctly so that independent sequential updates never trip the guard.

\`\`\`js
const rt = createHookRuntime((p, h) => {
  const [c, setC] = h.useState(0);
  h.useEffect(() => { setC(c + 1); });   // no deps: runs every render → infinite
  return c;
});
rt.render({}); // throws
\`\`\``,
      starterCode: `function depsChanged(prevDeps, nextDeps) {
  if (prevDeps === undefined || nextDeps === undefined) return true;
  if (prevDeps.length !== nextDeps.length) return true;
  for (let i = 0; i < nextDeps.length; i++) {
    if (!Object.is(prevDeps[i], nextDeps[i])) return true;
  }
  return false;
}

function createHookRuntime(component, options) {
  const maxRenderDepth = (options && options.maxRenderDepth) || 25;
  const slots = [];
  const pending = [];
  let index = 0;
  let lastProps = {};
  let output;
  let renderCount = 0;
  let depth = 0;

  // useState / useMemo / useCallback / useEffect go here

  function flushEffects() {
    // drain the pending queue: run each slot's previous cleanup, then the effect
  }

  function renderPass(props) {
    // guard the depth, render, flush, and always unwind the depth
  }

  return {
    render(props) {
      return renderPass(props || {});
    },
    getOutput() {
      return output;
    },
    getRenderCount() {
      return renderCount;
    },
    unmount() {},
  };
}

module.exports = { depsChanged, createHookRuntime };`,
      solutionCode: `function depsChanged(prevDeps, nextDeps) {
  if (prevDeps === undefined || nextDeps === undefined) return true;
  if (prevDeps.length !== nextDeps.length) return true;
  for (let i = 0; i < nextDeps.length; i++) {
    if (!Object.is(prevDeps[i], nextDeps[i])) return true;
  }
  return false;
}

function createHookRuntime(component, options) {
  const maxRenderDepth = (options && options.maxRenderDepth) || 25;
  const slots = [];
  const pending = [];
  let index = 0;
  let lastProps = {};
  let output;
  let renderCount = 0;
  let depth = 0;

  function nextSlot(make) {
    const i = index;
    index += 1;
    if (!slots[i]) slots[i] = make();
    return slots[i];
  }

  function useState(initial) {
    const slot = nextSlot(() => ({
      kind: 'state',
      value: typeof initial === 'function' ? initial() : initial,
    }));

    function setState(next) {
      const value = typeof next === 'function' ? next(slot.value) : next;
      if (Object.is(value, slot.value)) return;
      slot.value = value;
      renderPass(lastProps);
    }

    return [slot.value, setState];
  }

  function useMemo(factory, deps) {
    const slot = nextSlot(() => ({ kind: 'memo', deps: undefined, value: undefined, init: false }));
    if (!slot.init || depsChanged(slot.deps, deps)) {
      slot.value = factory();
      slot.deps = deps;
      slot.init = true;
    }
    return slot.value;
  }

  function useCallback(fn, deps) {
    return useMemo(() => fn, deps);
  }

  function useEffect(effect, deps) {
    const slot = nextSlot(() => ({ kind: 'effect', deps: undefined, cleanup: undefined, init: false }));
    if (!slot.init || depsChanged(slot.deps, deps)) {
      slot.deps = deps;
      slot.init = true;
      pending.push({ slot, effect });
    }
  }

  function flushEffects() {
    const queue = pending.splice(0, pending.length);
    for (const item of queue) {
      if (typeof item.slot.cleanup === 'function') item.slot.cleanup();
      const returned = item.effect();
      item.slot.cleanup = typeof returned === 'function' ? returned : undefined;
    }
  }

  function renderPass(props) {
    depth += 1;
    if (depth > maxRenderDepth) {
      depth -= 1;
      throw new Error('Too many re-renders. React limits the number of renders to prevent an infinite loop.');
    }
    try {
      lastProps = props;
      index = 0;
      renderCount += 1;
      output = component(props, { useState, useMemo, useCallback, useEffect });
      flushEffects();
    } finally {
      depth -= 1;
    }
    return output;
  }

  return {
    render(props) {
      return renderPass(props || {});
    },
    getOutput() {
      return output;
    },
    getRenderCount() {
      return renderCount;
    },
    unmount() {
      for (const slot of slots) {
        if (slot && slot.kind === 'effect' && typeof slot.cleanup === 'function') {
          slot.cleanup();
          slot.cleanup = undefined;
        }
      }
    },
  };
}

module.exports = { depsChanged, createHookRuntime };`,
      hints: [
        'A shared nextSlot(makeSlot) helper keeps the index bookkeeping in one place for all four hooks.',
        'useCallback is literally useMemo(() => fn, deps) — implement it that way.',
        'Track an `init` flag per memo/effect slot so that an initial value of undefined still counts as initialised.',
        'Increment depth before rendering and decrement it in a `finally`, so a thrown guard error still unwinds correctly.',
        'Effects queued during a nested render must be flushed by that nested render, so splice the queue at the start of flushEffects.',
      ],
      tests: [
        {
          name: 'useMemo recomputes only when deps change',
          assertion:
            "(() => { let calls = 0; const rt = solution.createHookRuntime((p, h) => h.useMemo(() => { calls += 1; return p.a * 2; }, [p.a])); rt.render({ a: 2 }); rt.render({ a: 2 }); const v = rt.render({ a: 3 }); return calls === 2 && v === 6; })()",
        },
        {
          name: 'useCallback keeps the same function reference while deps are equal',
          assertion:
            "(() => { const rt = solution.createHookRuntime((p, h) => h.useCallback(() => p.a, [p.a])); const f1 = rt.render({ a: 1 }); const f2 = rt.render({ a: 1 }); const f3 = rt.render({ a: 2 }); return f1 === f2 && f2 !== f3; })()",
        },
        {
          name: 'state persists across renders and updates apply',
          assertion:
            "(() => { const rt = solution.createHookRuntime((p, h) => { const s = h.useState(0); return { c: s[0], inc: () => s[1]((x) => x + 1) }; }); rt.render({}); rt.getOutput().inc(); rt.getOutput().inc(); return rt.getOutput().c === 2; })()",
        },
        {
          name: 'effects run after render, cleaning up before each re-run and on unmount',
          assertion:
            "(() => { const log = []; const rt = solution.createHookRuntime((p, h) => { h.useEffect(() => { log.push('run' + p.a); return () => log.push('clean' + p.a); }, [p.a]); return p.a; }); rt.render({ a: 1 }); rt.render({ a: 2 }); rt.unmount(); return log.join(',') === 'run1,clean1,run2,clean2'; })()",
        },
        {
          name: 'an effect with an empty dependency array runs once',
          assertion:
            "(() => { let n = 0; const rt = solution.createHookRuntime((p, h) => { h.useEffect(() => { n += 1; }, []); return null; }); rt.render({}); rt.render({}); rt.render({}); return n === 1; })()",
        },
        {
          name: 'setting an identical value bails out',
          assertion:
            "(() => { const rt = solution.createHookRuntime((p, h) => { const s = h.useState(0); return { set: s[1] }; }); rt.render({}); const before = rt.getRenderCount(); rt.getOutput().set(0); return rt.getRenderCount() === before; })()",
        },
        {
          name: 'an effect that sets state every render trips the loop guard',
          assertion:
            "throws(() => { const rt = solution.createHookRuntime((p, h) => { const s = h.useState(0); h.useEffect(() => { s[1](s[0] + 1); }); return s[0]; }); rt.render({}); })",
        },
        {
          name: 'the guard respects a custom maxRenderDepth',
          assertion:
            "(() => { let n = 0; const rt = solution.createHookRuntime((p, h) => { const s = h.useState(0); h.useEffect(() => { n += 1; s[1](s[0] + 1); }); return s[0]; }, { maxRenderDepth: 5 }); try { rt.render({}); return false; } catch (e) { return n === 5; } })()",
          hidden: true,
        },
        {
          name: 'sequential independent updates never trip the guard',
          assertion:
            "(() => { const rt = solution.createHookRuntime((p, h) => { const s = h.useState(0); return { c: s[0], inc: () => s[1]((x) => x + 1) }; }); rt.render({}); for (let i = 0; i < 200; i++) rt.getOutput().inc(); return rt.getOutput().c === 200; })()",
          hidden: true,
        },
      ],
      xp: 100,
    },
  ],
  flashcards: [
    {
      front: 'Why must hooks be called unconditionally at the top level?',
      back: 'React stores hook state in an ordered list per component and matches it by call order. A skipped or extra call shifts every later hook onto the wrong slot.',
      tags: ['react', 'hooks'],
    },
    {
      front: 'How does React decide whether to re-run an effect?',
      back: 'It compares the previous dependency array to the new one element-by-element with `Object.is`. No array at all means "run after every commit"; `[]` means "run once".',
      tags: ['react', 'useEffect'],
    },
    {
      front: 'When does an effect cleanup run?',
      back: 'Before the next setup when dependencies change, and once at unmount. That is what makes an effect a synchronisation rather than a one-shot callback.',
      tags: ['react', 'useEffect'],
    },
    {
      front: 'Name three things you should NOT use useEffect for.',
      back: 'Deriving state (compute during render), resetting state on a prop change (change the `key`), and reacting to user events (put it in the handler). Also data fetching in a real app.',
      tags: ['react', 'useEffect'],
    },
    {
      front: 'How do you avoid a race condition when fetching inside an effect?',
      back: 'Return a cleanup that flips a `cancelled` flag or calls `controller.abort()`, so a stale response cannot overwrite a newer one.',
      tags: ['react', 'useEffect', 'async'],
    },
    {
      front: 'The three classic infinite-render loops',
      back: '1) setState inside an effect that depends on that state. 2) setState in an effect with no dependency array. 3) a fresh object/array/function as a dependency, recreated every render.',
      tags: ['react', 'gotcha'],
    },
    {
      front: 'What is useRef for?',
      back: 'A mutable box whose writes do not re-render: DOM handles, timer ids, previous values, latest-callback refs. Anything shown on screen belongs in state instead.',
      tags: ['react', 'useRef'],
    },
    {
      front: 'When does useMemo/useCallback actually pay off?',
      back: 'Only when the value feeds a React.memo child, feeds a dependency array, or wraps a genuinely expensive computation. Otherwise the comparison and the reading cost exceed the benefit.',
      tags: ['react', 'performance'],
    },
    {
      front: 'Why does a React.memo child still re-render despite useCallback?',
      back: 'memo compares all props shallowly. One unstable prop — an inline array or object — defeats the whole optimisation. Memoise the entire chain, or hoist constants out of the component.',
      tags: ['react', 'performance', 'gotcha'],
    },
    {
      front: 'useState vs useReducer',
      back: 'useReducer when several fields change together, when transitions are dispatched from many places, or when you want testable, named transitions. useState for independent simple values.',
      tags: ['react', 'useReducer'],
    },
    {
      front: 'Why split state and dispatch into two contexts?',
      back: 'Every consumer re-renders when the context value changes and React.memo cannot stop it. `dispatch` is stable, so dispatch-only components then skip state-driven re-renders entirely.',
      tags: ['react', 'context'],
    },
    {
      front: 'useTransition vs useDeferredValue',
      back: 'Both lower the priority of an update so urgent input stays responsive. useTransition wraps the setter and gives you `isPending`; useDeferredValue wraps a value you did not create.',
      tags: ['react', 'concurrent'],
    },
  ],
  resources: [
    { label: 'React — Hooks reference', url: 'https://react.dev/reference/react/hooks', kind: 'DOCS' },
    { label: 'React — You Might Not Need an Effect', url: 'https://react.dev/learn/you-might-not-need-an-effect', kind: 'ARTICLE' },
    { label: 'React — Synchronizing with Effects', url: 'https://react.dev/learn/synchronizing-with-effects', kind: 'DOCS' },
    { label: 'React — Reusing Logic with Custom Hooks', url: 'https://react.dev/learn/reusing-logic-with-custom-hooks', kind: 'DOCS' },
    { label: 'eslint-plugin-react-hooks', url: 'https://www.npmjs.com/package/eslint-plugin-react-hooks', kind: 'TOOL' },
  ],
};

export default day;
