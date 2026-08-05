import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 8,
  week: 2,
  pillar: 'FRONTEND',
  title: 'React Fundamentals — JSX, Props, State',
  summary: 'Stop syncing the DOM by hand. Describe the UI you want and let React find the diff.',
  estimatedMinutes: 320,
  objectives: [
    'Explain what problem a UI library solves that vanilla DOM code does not',
    'Read JSX as the createElement calls it compiles into',
    'Design components that compose through props and children instead of inheritance',
    'Update state immutably and reason about batching and stale closures',
    'Choose correct list keys and explain exactly what index keys break',
    'Describe the render/commit split and why StrictMode double-invokes your components',
  ],
  technologies: ['React.js'],
  lessons: [
    {
      slug: 'why-a-ui-library-and-jsx',
      title: 'Why a UI Library At All, and What JSX Really Is',
      estimatedMinutes: 75,
      body: `# Why a UI Library At All, and What JSX Really Is

## The problem React was built to solve

Here is a counter with a list, written the way you learned on day 4:

\`\`\`js
const state = { count: 0, items: ['ninja'] };

function render() {
  document.querySelector('#count').textContent = state.count;
  const ul = document.querySelector('#list');
  ul.innerHTML = '';
  for (const item of state.items) {
    const li = document.createElement('li');
    li.textContent = item;
    ul.append(li);
  }
}
\`\`\`

It works. Now add a feature: each \`<li>\` gets an inline edit input, and the count must not reset when the list changes. Suddenly \`ul.innerHTML = ''\` destroys the input the user is typing into. So you stop nuking the list and start diffing by hand — track which nodes exist, which changed, which moved. That hand-written diff is the bug factory. Every real app that starts with \`querySelector\` ends up writing a bad version of React.

The insight is to stop describing **transitions** ("when this button is clicked, set that text") and start describing **states** ("given this data, the UI looks like this"). Then a library computes the transition for you:

> **UI = f(state).** You write \`f\`. React figures out the minimal DOM operations to get from the previous output to the new one.

That is the whole pitch. Everything else — hooks, keys, memoisation — is machinery in service of it.

## Your first component

\`\`\`jsx
function Counter() {
  const [count, setCount] = React.useState(0);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
\`\`\`

Nothing here touches the DOM. There is no \`textContent\`, no \`append\`. You return a *description* of the UI for the current \`count\`; React does the rest.

## JSX is not HTML — it is function calls

JSX is a syntax extension that your bundler (Vite/Babel/SWC) compiles away before the browser ever sees it. This:

\`\`\`jsx
const el = <button className="primary" onClick={handleClick}>Save</button>;
\`\`\`

compiles to roughly this (classic runtime):

\`\`\`js
const el = React.createElement(
  'button',
  { className: 'primary', onClick: handleClick },
  'Save'
);
\`\`\`

The result is a plain object — a **React element**, not a DOM node:

\`\`\`js
{ type: 'button', props: { className: 'primary', onClick: fn, children: 'Save' }, key: null }
\`\`\`

Three consequences follow immediately:

1. **Elements are cheap and immutable.** Creating them is just allocating objects. Rendering a thousand of them costs nothing like a thousand DOM writes.
2. **Capitalisation is load-bearing.** \`<button>\` compiles to \`createElement('button', ...)\` — a string type, meaning a host element. \`<Button>\` compiles to \`createElement(Button, ...)\` — the identifier, meaning your component. A lowercase component name silently renders an unknown HTML tag.
3. **JSX obeys JavaScript scoping.** If \`Button\` is not imported and in scope, the code does not compile. There is no template-string magic.

Modern setups use the **automatic runtime**, which imports \`jsx\` from \`react/jsx-runtime\` for you. That is why you no longer need \`import React from 'react'\` at the top of every file.

## The syntax rules that bite

**One root node.** A component returns one element. Wrap siblings in a \`<div>\`, or in a **Fragment** when you do not want the extra DOM node:

\`\`\`jsx
return (
  <>
    <dt>Term</dt>
    <dd>Definition</dd>
  </>
);
\`\`\`

**Reserved words are renamed.** \`class\` → \`className\`, \`for\` → \`htmlFor\`. Most other attributes become camelCase: \`tabindex\` → \`tabIndex\`, \`onclick\` → \`onClick\`. \`data-*\` and \`aria-*\` keep their dashes.

**Braces take an expression, not a statement.** You can put anything that evaluates to a value inside \`{}\`:

\`\`\`jsx
<p title={user.fullName} style={{ color: 'tomato', marginBlock: 8 }}>
  {user.isAdmin ? 'Admin' : 'Member'} — joined {new Date(user.joinedAt).getFullYear()}
</p>
\`\`\`

Note the double braces on \`style\`: the outer pair is "here comes an expression", the inner pair is an object literal. CSS properties are camelCased and unitless numbers become pixels.

You cannot write \`if\` or \`for\` inside braces — they are statements. Use a ternary, \`&&\`, or lift the logic above the \`return\`.

**Template literals still work**, and are how you build dynamic class strings before you reach for a helper:

\`\`\`jsx
<button className={\`btn btn--\${variant} \${disabled ? 'is-disabled' : ''}\`}>Go</button>
\`\`\`

## What JSX renders and what it skips

| Value in \`{}\` | Rendered output |
| --- | --- |
| \`'hi'\`, \`42\` | the text |
| \`null\`, \`undefined\`, \`true\`, \`false\` | nothing |
| \`0\` | **the character 0** |
| array | each item rendered in order |
| object | throws — objects are not valid children |

That \`0\` row is the single most common React bug in existence:

\`\`\`jsx
{items.length && <List items={items} />}   // renders "0" when the list is empty
{items.length > 0 && <List items={items} />} // correct
\`\`\`

\`&&\` returns the *left* operand when it is falsy, and \`0\` is a renderable value. Always compare explicitly.

## JSX escapes by default

\`{userComment}\` is inserted as text, never parsed as HTML, so a comment containing \`<img onerror=...>\` is harmless. The escape hatch is deliberately ugly — \`dangerouslySetInnerHTML={{ __html: html }}\` — because it hands you an XSS hole unless you sanitise first. The name is the documentation.`,
    },
    {
      slug: 'components-props-composition',
      title: 'Components, Props, Children & Composition',
      estimatedMinutes: 75,
      body: `# Components, Props, Children & Composition

A component is a function that takes props and returns React elements. That is the entire contract. There is no base class to extend, no lifecycle to implement, no registration step.

\`\`\`jsx
function Badge({ label, tone = 'neutral' }) {
  return <span className={'badge badge--' + tone}>{label}</span>;
}

<Badge label="New" tone="success" />
\`\`\`

## Props are read-only inputs

React passes a single object as the first argument, and you almost always destructure it. Destructuring gives you defaults for free (\`tone = 'neutral'\` above), which is why \`defaultProps\` is deprecated for function components.

The rule that makes the whole model work: **never mutate props.**

\`\`\`jsx
function Total({ cart }) {
  cart.items.sort((a, b) => a.price - b.price); // ❌ mutates the parent's data
  const sorted = [...cart.items].sort((a, b) => a.price - b.price); // ✅
  return <p>{sorted.length} items</p>;
}
\`\`\`

A component must behave like a pure function of its props: same props in, same JSX out, no observable side effects during render. React relies on this — it may call your function twice, throw the result away, or call it in a different order than you expect.

Data flows **one way**: parent to child. A child that needs to change something asks the parent to do it, by calling a function the parent passed down:

\`\`\`jsx
function DeleteButton({ id, onDelete }) {
  return <button onClick={() => onDelete(id)}>Delete</button>;
}
\`\`\`

The convention is \`onSomething\` for the prop, \`handleSomething\` for the function that implements it.

## children: the slot you get for free

Anything between a component's opening and closing tags arrives as \`props.children\`:

\`\`\`jsx
function Card({ children }) {
  return <section className="card">{children}</section>;
}

<Card>
  <h2>Day 8</h2>
  <p>React fundamentals.</p>
</Card>
\`\`\`

\`children\` is just a prop whose value happens to be React elements. Two things follow.

First, you can have **more than one slot** — pass elements as ordinary props:

\`\`\`jsx
function Layout({ sidebar, children, footer }) {
  return (
    <div className="layout">
      <aside>{sidebar}</aside>
      <main>{children}</main>
      <footer>{footer}</footer>
    </div>
  );
}

<Layout sidebar={<Nav />} footer={<Legal />}>
  <Dashboard />
</Layout>
\`\`\`

Second, a prop can be a **function** that returns elements — the render-prop pattern — when the parent needs to hand data down to the markup:

\`\`\`jsx
function List({ items, renderItem }) {
  return <ul>{items.map((item) => <li key={item.id}>{renderItem(item)}</li>)}</ul>;
}

<List items={users} renderItem={(u) => <strong>{u.name}</strong>} />
\`\`\`

## Composition over inheritance

Coming from Java or C#, the instinct is \`class DangerButton extends Button\`. React has no mechanism for that and does not want one. The React team's guidance is explicit: they have never found a case where inheritance beat composition for UI reuse.

Specialisation is done by **wrapping**:

\`\`\`jsx
function Button({ variant = 'default', className = '', ...rest }) {
  return <button className={'btn btn--' + variant + ' ' + className} {...rest} />;
}

function DangerButton(props) {
  return <Button variant="danger" {...props} />;
}
\`\`\`

Two techniques there are worth naming.

**Rest props + spread.** \`...rest\` collects every prop you did not explicitly name, and \`{...rest}\` forwards them to the underlying element. That is how a custom \`Button\` keeps supporting \`type\`, \`disabled\`, \`aria-label\` and \`onClick\` without enumerating them. Order matters: props spread later win, so put \`{...rest}\` last if callers should be able to override your defaults, and first if they should not.

**Containment.** A generic \`Modal\` should not know what is inside it. It takes \`children\` and owns only the overlay, focus trap and close button. A \`ConfirmDeleteModal\` is then \`<Modal><DeleteForm /></Modal>\`, not a subclass.

## Where to draw component boundaries

Split a component when one of these is true:

- A chunk of JSX is reused in two places.
- A chunk has its own state that the rest of the parent does not care about.
- The file has grown past the point where you can see the whole return statement at once.
- A part re-renders far more often than its neighbours (day 9 makes this measurable).

Do **not** split just because a function is "long". A 120-line component with one coherent job is easier to read than six 20-line components that must be held in your head simultaneously. Premature extraction produces prop drilling: passing a value through four components that do not use it, only to reach the fifth. When that happens, the fix is usually Context (day 9) or moving state closer to where it is used — not more components.

## Naming and file layout

- One primary component per file, named the same as the file: \`UserCard.jsx\` exports \`UserCard\`.
- Component names are PascalCase. Hooks are \`useSomething\`. Everything else is camelCase.
- Colocate small helpers in the same file; extract them only when a second file needs them.

## A worked example

\`\`\`jsx
function Avatar({ user, size = 40 }) {
  return (
    <img
      src={user.avatarUrl}
      alt={user.name + ' avatar'}
      width={size}
      height={size}
      style={{ borderRadius: '50%' }}
    />
  );
}

function UserCard({ user, actions }) {
  return (
    <article className="user-card">
      <Avatar user={user} />
      <div>
        <h3>{user.name}</h3>
        <p>{user.title}</p>
      </div>
      <div className="user-card__actions">{actions}</div>
    </article>
  );
}

<UserCard user={ada} actions={<><Badge label="Pro" tone="success" /><DangerButton>Remove</DangerButton></>} />
\`\`\`

\`Avatar\` knows about images. \`UserCard\` knows about layout. Neither knows about deletion. That separation is what lets you reuse both on a page you have not written yet.`,
    },
    {
      slug: 'state-events-and-lifting',
      title: 'State, Events, Immutable Updates & Lifting State Up',
      estimatedMinutes: 85,
      body: `# State, Events, Immutable Updates & Lifting State Up

Props come from above and are read-only. **State** is memory a component owns, and changing it is what triggers a re-render.

\`\`\`jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
\`\`\`

\`useState\` returns a pair: the current value for **this render**, and a setter. Each call to \`useState\` in a component creates an independent slot, identified by call order — which is why hooks must never be called conditionally (day 9 formalises this).

State is per **instance**, not per component. Render \`<Counter />\` three times and you get three independent counts.

## The setter does not mutate — it schedules

\`\`\`jsx
function handleClick() {
  setCount(count + 1);
  console.log(count); // still the OLD value
}
\`\`\`

\`count\` is a \`const\` captured by this render's closure. It cannot change. \`setCount\` tells React "the next render should use this value", then React re-runs the component and the new closure sees the new number. This is called a **state snapshot**, and it explains the classic bug:

\`\`\`jsx
setCount(count + 1);
setCount(count + 1); // both compute 0 + 1 → final value is 1, not 2
\`\`\`

The fix is the **updater function**, which receives the latest pending value:

\`\`\`jsx
setCount((c) => c + 1);
setCount((c) => c + 1); // → 2
\`\`\`

Rule: if the next state depends on the previous state, pass a function.

React **batches** all updates triggered inside the same event handler (and, since React 18, inside timeouts, promises and native handlers too) into a single re-render. Ten \`setState\` calls in one click produce one render, not ten.

There is also a **bail-out**: if you set state to a value that is \`Object.is\`-equal to the current one, React skips the re-render entirely. Setting \`count\` to \`0\` when it is already \`0\` costs nothing. Setting it to a *new object with identical contents* costs a render, because the references differ.

## Immutable updates

Because React compares by reference, mutating state is invisible to it:

\`\`\`jsx
const [user, setUser] = useState({ name: 'Ada', prefs: { theme: 'dark' } });

user.name = 'Grace';   // ❌ same reference — React sees no change, no re-render
setUser(user);         //    and the bail-out kicks in

setUser({ ...user, name: 'Grace' }); // ✅ new object
\`\`\`

Nested updates need a new object at **every level you change**:

\`\`\`jsx
setUser({
  ...user,
  prefs: { ...user.prefs, theme: 'light' },
});
\`\`\`

Everything you do not spread keeps its old reference — which is exactly what you want, because untouched subtrees can then be skipped by memoisation.

For arrays, know which methods mutate:

| Operation | ❌ Mutates | ✅ Returns new |
| --- | --- | --- |
| add | \`push\`, \`unshift\` | \`[...arr, x]\`, \`[x, ...arr]\` |
| remove | \`pop\`, \`shift\`, \`splice\` | \`arr.filter(...)\` |
| replace one | \`arr[i] = x\` | \`arr.map((v, j) => (j === i ? x : v))\` |
| sort / reverse | \`sort\`, \`reverse\` | \`[...arr].sort()\`, \`arr.toSorted()\` |

\`\`\`jsx
const toggle = (id) =>
  setTodos((todos) => todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
\`\`\`

Notice that unchanged todos keep their original object identity. That is not an accident — it is the property that makes \`React.memo\` and \`useMemo\` work later.

## Events

React attaches one listener at the root and dispatches **SyntheticEvent** objects — a cross-browser wrapper with the standard API (\`preventDefault\`, \`stopPropagation\`, \`target\`, \`currentTarget\`).

\`\`\`jsx
<button onClick={handleClick}>Save</button>      {/* ✅ pass the function */}
<button onClick={handleClick()}>Save</button>    {/* ❌ calls it during render */}
<button onClick={() => handleDelete(id)}>Del</button> {/* ✅ arrow to pass an argument */}
\`\`\`

\`\`\`jsx
function SearchForm({ onSearch }) {
  const [q, setQ] = useState('');
  function handleSubmit(e) {
    e.preventDefault();      // no full-page reload
    onSearch(q.trim());
  }
  return (
    <form onSubmit={handleSubmit}>
      <input value={q} onChange={(e) => setQ(e.target.value)} />
      <button>Search</button>
    </form>
  );
}
\`\`\`

Events bubble through the **React tree**, not just the DOM tree, so a handler on a parent component catches clicks from portal children too. Use \`onClickCapture\` for the capture phase.

## Lifting state up

Two siblings need to share a value. Neither can see the other's state, so the state moves to their closest common parent, and comes back down as props:

\`\`\`jsx
function TemperatureApp() {
  const [celsius, setCelsius] = useState(20);
  return (
    <>
      <CelsiusInput value={celsius} onChange={setCelsius} />
      <FahrenheitInput value={celsius * 9 / 5 + 32} onChange={(f) => setCelsius((f - 32) * 5 / 9)} />
      <p>{celsius >= 100 ? 'Boiling' : 'Not boiling'}</p>
    </>
  );
}
\`\`\`

There is now exactly one source of truth. The two inputs cannot disagree, because there is nothing for them to disagree about.

The counter-rule: **do not lift state you do not have to.** State that lives higher than necessary re-renders more of the tree and makes the parent harder to read. And never copy a prop into state (\`useState(props.value)\`) unless you specifically want an uncontrolled initial value — the copy will not update when the prop changes.

Also: never store in state what you can **derive** during render.

\`\`\`jsx
const [items, setItems] = useState([]);
const total = items.reduce((s, i) => s + i.price, 0); // ✅ derived, always correct
\`\`\`

A \`total\` in state is a second source of truth that will drift.

## Controlled vs uncontrolled inputs

A **controlled** input takes its value from state and reports changes back:

\`\`\`jsx
<input value={email} onChange={(e) => setEmail(e.target.value)} />
\`\`\`

React state is the single source of truth. You can format as the user types, disable submit, or validate live.

An **uncontrolled** input keeps its value in the DOM; you set only the initial value and read it when you need it:

\`\`\`jsx
const inputRef = useRef(null);
<input defaultValue="ninja" ref={inputRef} />
// later: inputRef.current.value
\`\`\`

| | Controlled | Uncontrolled |
| --- | --- | --- |
| Source of truth | React state | the DOM node |
| Initial value prop | \`value\` | \`defaultValue\` / \`defaultChecked\` |
| Re-renders per keystroke | yes | no |
| Live validation / formatting | easy | awkward |
| \`<input type="file">\` | impossible | required |

> Passing \`value\` without \`onChange\` produces a read-only field and a console warning. If you want a genuinely read-only input, say \`readOnly\`. If you want an initial value only, say \`defaultValue\`.

Controlled is the default choice; uncontrolled is the performance escape hatch and the only option for file inputs. Day 10's React Hook Form uses uncontrolled inputs deliberately, which is why it re-renders so little.`,
    },
    {
      slug: 'lists-keys-render-commit',
      title: 'Lists & Keys, Conditional Rendering, and the Render/Commit Model',
      estimatedMinutes: 85,
      body: `# Lists & Keys, Conditional Rendering, and the Render/Commit Model

## Rendering a list

\`\`\`jsx
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
\`\`\`

An array of elements is a valid child; React renders each in order. \`map\` is the idiom because it returns a value — \`forEach\` returns \`undefined\` and renders nothing.

## What a key actually does

When React re-renders, it compares the new element list against the previous one to decide what to create, update, move or destroy. Without keys it can only match by **position**: first child to first child, second to second. With keys it matches by **identity**.

Consider prepending an item to \`['b', 'c']\` to get \`['a', 'b', 'c']\`, using the array index as key:

| Position | Before | After | React's conclusion |
| --- | --- | --- | --- |
| key 0 | b | a | text changed b → a |
| key 1 | c | b | text changed c → b |
| key 2 | — | c | new node |

Three DOM mutations to express one insertion. With \`key={todo.id}\`, keys \`b\` and \`c\` are unchanged, so React moves the existing nodes and creates exactly one new one.

Wasted work is the *mild* version of the problem. The real damage is that React reuses the **component state and DOM state** attached to the reused position. Every row keeps its old input value, focus, scroll position, CSS animation state and \`useState\` contents:

\`\`\`jsx
{todos.map((todo, i) => (
  <li key={i}>
    <input defaultValue={todo.text} />   {/* uncontrolled: value lives in the DOM */}
  </li>
))}
\`\`\`

Delete the first todo and every row's text shifts up by one — except the inputs, which keep the values from their old positions. The list is now lying to the user. Checkbox states shifting by one row is the same bug, and it ships to production constantly.

### Rules for keys

- **Stable** — derived from the data, the same across renders. A database id, a slug, a UUID generated when the item is created.
- **Unique among siblings** — not globally unique. Two different lists may both use key \`1\`.
- **Not \`Math.random()\` or \`Date.now()\`** — a fresh key every render means React destroys and recreates every node, every time. That is worse than index keys.
- **Not the index**, unless *all* of these hold: the list never reorders, never has items inserted or removed anywhere but the end, and the items are stateless.
- Keys are passed to React, not to your component. \`props.key\` is \`undefined\` inside \`Todo\`. Pass \`id\` separately if you need it.

For a fragment in a list, use the long form so you have somewhere to put the key:

\`\`\`jsx
import { Fragment } from 'react';

{entries.map((e) => (
  <Fragment key={e.id}>
    <dt>{e.term}</dt>
    <dd>{e.definition}</dd>
  </Fragment>
))}
\`\`\`

And a bonus use: changing a key **deliberately** resets a component. \`<ProfileForm key={userId} />\` throws away all form state when the selected user changes, without a single \`useEffect\`.

## Conditional rendering

\`\`\`jsx
// ternary — choose between two branches
{isLoggedIn ? <Dashboard /> : <LoginPrompt />}

// && — render or nothing (mind the falsy-0 trap)
{errors.length > 0 && <ErrorList errors={errors} />}

// early return — for whole-component branches
if (isLoading) return <Spinner />;
if (error) return <ErrorState error={error} />;
return <Report data={data} />;

// lookup map — beats a ternary chain
const byStatus = { idle: <Idle />, loading: <Spinner />, error: <Err />, done: <Done /> };
return byStatus[status];
\`\`\`

Two things to keep in mind. Nested ternaries in JSX become unreadable fast — extract a variable or a component instead. And conditionally rendering a *different component type* at the same position unmounts the old one and destroys its state, while rendering the same type with different props preserves it.

## Render and commit

React updates the screen in two phases, and confusing them is the root of a lot of misunderstanding.

**Render phase.** React calls your component function and builds a tree of elements, then diffs it against the previous tree. This phase must be **pure**: no DOM access, no network calls, no mutation of anything outside the function, no \`setState\` on other components. React may run it for a state update that never commits (a low-priority update interrupted by a click), run it twice, or throw the result away.

**Commit phase.** React applies the minimum set of DOM mutations it computed, then runs layout effects, then paints. Only here does the browser show anything.

\`\`\`jsx
function Impure() {
  const now = Date.now();          // different every render — makes render impure
  sideEffectCounter++;             // ❌ mutating module scope during render
  document.title = 'Hi';           // ❌ DOM write during render
  return <p>{now}</p>;
}
\`\`\`

Effects (day 9) exist to give you a legal place for the last two.

Between render and commit sits **reconciliation**: same element type at the same position → update props in place and keep state; different type → unmount the old subtree, mount a new one. Keys override the positional matching for lists.

## StrictMode and the double render

Wrap your app in \`<StrictMode>\` and, **in development only**, React deliberately calls each component function twice, runs each effect setup/cleanup/setup, and double-invokes state updater functions.

\`\`\`jsx
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
\`\`\`

It is not a bug and it does not happen in production builds. It is a detector: if your component is pure, running it twice changes nothing. If it is not, the symptom becomes loud and immediate — a counter that increments by two, a list that gets duplicated items, a request fired twice.

\`\`\`jsx
const [items, setItems] = useState([]);
setItems((prev) => { prev.push(newItem); return prev; }); // ❌ mutating updater: double-adds under StrictMode
setItems((prev) => [...prev, newItem]);                   // ✅ pure updater
\`\`\`

> If turning StrictMode on breaks your app, StrictMode found a real bug. The fix is never to remove StrictMode.

The same reasoning applies to Concurrent React more broadly: React reserves the right to render speculatively and discard the result. Purity is what buys you that freedom.`,
    },
  ],
  quiz: [
    {
      prompt: 'What does the JSX expression `<Badge label="New" />` compile to?',
      options: [
        'createElement(Badge, { label: "New" }) — the identifier Badge is passed as the type',
        'createElement("Badge", { label: "New" }) — the tag name is passed as a string',
        'A DOM node created immediately via document.createElement',
        'An HTML string that is later parsed by the browser',
      ],
      correctIndex: 0,
      explanation:
        'Capitalised tags compile to the identifier, so `Badge` must be in scope. Lowercase tags compile to a string type (a host element). The result is a plain object describing the UI, not a DOM node.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Why does `{items.length && <List />}` render a literal `0` when the list is empty?',
      options: [
        'React converts falsy values to their string form',
        'It is a bug in the JSX transform',
        '`&&` returns its left operand when that operand is falsy, and `0` is a value React renders',
        'The `length` property is a string in JavaScript',
      ],
      correctIndex: 2,
      explanation:
        '`0 && x` evaluates to `0`. React skips `null`, `undefined`, `true` and `false`, but renders numbers — including zero. Write `items.length > 0 && ...` so the left operand is a real boolean.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Inside a click handler you call `setCount(count + 1)` twice. Starting from 0, what is the final count?',
      options: ['2', '1', '0', 'It throws a "too many re-renders" error'],
      correctIndex: 1,
      explanation:
        '`count` is a const captured by the current render, so both calls compute `0 + 1`. Updates are batched into one re-render with the final queued value, 1. Use the updater form `setCount(c => c + 1)` to get 2.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'You call `user.name = "Grace"` and then `setUser(user)`. What happens?',
      options: [
        'The component re-renders with the new name',
        'React throws because state objects are frozen',
        'The name updates but only after the next unrelated render',
        'Nothing re-renders: the reference is unchanged, so React bails out of the update',
      ],
      correctIndex: 3,
      explanation:
        'React compares the next state to the current one with `Object.is`. Mutating in place leaves the same reference, so the comparison says "no change" and the re-render is skipped. Always produce a new object.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'A list of rows each containing an uncontrolled `<input>` uses `key={index}`. The user deletes the first row. What goes wrong?',
      options: [
        'React throws a duplicate key warning',
        'Rows shift up but the DOM inputs keep the values from their previous positions, so text and row no longer match',
        'The entire list unmounts and remounts, clearing all inputs',
        'Nothing — index keys are always safe for deletion',
      ],
      correctIndex: 1,
      explanation:
        'Index keys make React match by position. After a deletion, position 0 still has key 0, so React reuses that DOM node — including the value the user typed — while the data behind it has changed. Stable ids fix this.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Which statement about the render phase is correct?',
      options: [
        'It is where you should write to document.title, because the DOM is already updated',
        'It runs exactly once per state update in every environment',
        'It must be pure: React may call it twice, or discard the result without committing it',
        'It applies DOM mutations directly as each element is created',
      ],
      correctIndex: 2,
      explanation:
        'Render builds and diffs the element tree and can be run speculatively or thrown away. DOM mutations happen in the separate commit phase; side effects belong in effects, not render.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'In development your component logs twice on every mount. What is going on?',
      options: [
        'A memory leak is duplicating the component instance',
        'StrictMode intentionally double-invokes components in development to surface impure render logic',
        'You forgot a key on a list, so React mounted the tree twice',
        'React always renders twice; production does the same',
      ],
      correctIndex: 1,
      explanation:
        '`<StrictMode>` double-invokes component functions, updater functions and effect setup/cleanup in development only. A pure component is unaffected; if the double call changes behaviour, the component has a real bug.',
      difficulty: 'EASY',
    },
    {
      prompt: 'When should you prefer an uncontrolled input over a controlled one?',
      options: [
        'When you need live validation and formatting as the user types',
        'When the value must be shared with a sibling component',
        'When you want React state to be the single source of truth',
        'For file inputs, and when you only read the value on submit and want to avoid a render per keystroke',
      ],
      correctIndex: 3,
      explanation:
        '`<input type="file">` cannot be controlled, and uncontrolled inputs skip a re-render per keystroke. Anything requiring live derivation, cross-component sharing, or React-owned truth wants a controlled input.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'immutable-state-updaters',
      title: 'Immutable State Updaters',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `React only re-renders when a state reference changes, so every update must produce **new** objects and arrays along the path you touched — and leave everything else alone.

Implement four pure updaters. None of them may mutate their arguments.

- \`addTodo(todos, todo)\` — returns a new array with \`todo\` appended.
- \`toggleTodo(todos, id)\` — returns a new array where the todo with that \`id\` has \`done\` flipped. **Untouched todos must keep their original object identity** (this is what makes memoisation work later).
- \`removeTodo(todos, id)\` — returns a new array without that todo.
- \`setCity(state, city)\` — given \`{ user: { name, address: { city, zip } } }\`, returns a new state with \`address.city\` replaced and every other field preserved.

\`\`\`js
const todos = [{ id: 1, text: 'learn jsx', done: false }];
toggleTodo(todos, 1); // [{ id: 1, text: 'learn jsx', done: true }]
todos[0].done;        // still false
\`\`\``,
      starterCode: `function addTodo(todos, todo) {
  // your code
}

function toggleTodo(todos, id) {
  // your code
}

function removeTodo(todos, id) {
  // your code
}

function setCity(state, city) {
  // state looks like { user: { name, address: { city, zip } } }
  // your code
}

module.exports = { addTodo, toggleTodo, removeTodo, setCity };`,
      solutionCode: `function addTodo(todos, todo) {
  return [...todos, todo];
}

function toggleTodo(todos, id) {
  return todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

function removeTodo(todos, id) {
  return todos.filter((t) => t.id !== id);
}

function setCity(state, city) {
  return {
    ...state,
    user: {
      ...state.user,
      address: { ...state.user.address, city },
    },
  };
}

module.exports = { addTodo, toggleTodo, removeTodo, setCity };`,
      hints: [
        'Spread creates a shallow copy: [...arr] and { ...obj }.',
        'map is the immutable "replace one item"; filter is the immutable "remove".',
        'In toggleTodo, return the SAME object for non-matching todos — do not spread every item.',
        'For nested updates you need a new object at every level you change, and only those levels.',
      ],
      tests: [
        {
          name: 'addTodo appends without mutating',
          assertion:
            "(() => { const a = [{ id: 1 }]; const b = solution.addTodo(a, { id: 2 }); return a.length === 1 && deepEqual(b, [{ id: 1 }, { id: 2 }]); })()",
        },
        {
          name: 'toggleTodo flips done',
          assertion:
            "solution.toggleTodo([{ id: 1, done: false }], 1)[0].done === true",
        },
        {
          name: 'toggleTodo does not mutate the input',
          assertion:
            "(() => { const a = [{ id: 1, done: false }]; solution.toggleTodo(a, 1); return a[0].done === false; })()",
        },
        {
          name: 'toggleTodo preserves identity of untouched items',
          assertion:
            "(() => { const a = [{ id: 1, done: false }, { id: 2, done: false }]; const b = solution.toggleTodo(a, 1); return b !== a && b[1] === a[1] && b[0] !== a[0]; })()",
        },
        {
          name: 'removeTodo removes only the matching id',
          assertion:
            "deepEqual(solution.removeTodo([{ id: 1 }, { id: 2 }, { id: 3 }], 2).map((t) => t.id), [1, 3])",
        },
        {
          name: 'removeTodo returns a new array',
          assertion:
            "(() => { const a = [{ id: 1 }]; return solution.removeTodo(a, 99) !== a; })()",
          hidden: true,
        },
        {
          name: 'setCity updates deeply and preserves siblings',
          assertion:
            "(() => { const s = { user: { name: 'Ada', address: { city: 'X', zip: '1' } } }; const n = solution.setCity(s, 'Y'); return n.user.address.city === 'Y' && n.user.name === 'Ada' && n.user.address.zip === '1' && s.user.address.city === 'X'; })()",
        },
        {
          name: 'setCity creates new objects at every changed level',
          assertion:
            "(() => { const s = { user: { name: 'Ada', address: { city: 'X', zip: '1' } } }; const n = solution.setCity(s, 'Y'); return n !== s && n.user !== s.user && n.user.address !== s.user.address; })()",
          hidden: true,
        },
      ],
      xp: 40,
    },
    {
      slug: 'list-key-auditor',
      title: 'List Key Auditor',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `You are writing a lint rule for a React codebase. Given a list and the \`keyFn\` a component uses, decide whether the keys are safe.

Implement two functions.

**\`auditKeys(items, keyFn)\`** calls \`keyFn(item, index)\` for every item and returns:

\`\`\`js
{ ok: boolean, duplicates: string[], missing: number[] }
\`\`\`

- \`missing\` — the indices whose key is \`undefined\`, \`null\` or the empty string, in ascending order.
- \`duplicates\` — the *stringified* keys that appear more than once, sorted ascending, each listed once. Items with a missing key do not count toward duplicates.
- \`ok\` — true only when both arrays are empty.

**\`reorderPreservesKeys(items, keyFn)\`** returns \`true\` if every item still maps to the same key after the list is reversed. A key derived from the item (\`item.id\`) passes; a positional key (\`(item, i) => i\`) fails, which is precisely why index keys corrupt reordered lists.

\`\`\`js
auditKeys([{ id: 'a' }, { id: 'a' }], (it) => it.id);
// { ok: false, duplicates: ['a'], missing: [] }
reorderPreservesKeys([{ id: 'a' }, { id: 'b' }], (it, i) => i); // false
\`\`\``,
      starterCode: `function auditKeys(items, keyFn) {
  // return { ok, duplicates, missing }
}

function reorderPreservesKeys(items, keyFn) {
  // reverse the list, recompute keys, and check every item kept its key
}

module.exports = { auditKeys, reorderPreservesKeys };`,
      solutionCode: `function auditKeys(items, keyFn) {
  const counts = new Map();
  const missing = [];

  items.forEach((item, i) => {
    const key = keyFn(item, i);
    if (key === undefined || key === null || key === '') {
      missing.push(i);
      return;
    }
    const k = String(key);
    counts.set(k, (counts.get(k) || 0) + 1);
  });

  const duplicates = Array.from(counts.entries())
    .filter((entry) => entry[1] > 1)
    .map((entry) => entry[0])
    .sort();

  return { ok: duplicates.length === 0 && missing.length === 0, duplicates, missing };
}

function reorderPreservesKeys(items, keyFn) {
  const before = new Map();
  items.forEach((item, i) => before.set(item, String(keyFn(item, i))));

  const reversed = items.slice().reverse();
  return reversed.every((item, i) => before.get(item) === String(keyFn(item, i)));
}

module.exports = { auditKeys, reorderPreservesKeys };`,
      hints: [
        'A Map from stringified key to a count makes duplicate detection one pass.',
        'Check for missing keys with strict equality against undefined, null and the empty string — 0 is a legal key.',
        'Array.from(map.entries()) gives you [key, count] pairs you can filter and sort.',
        'For reorderPreservesKeys, remember the ITEM identity: build a Map from item object to its original key.',
      ],
      tests: [
        {
          name: 'clean list passes',
          assertion:
            "(() => { const r = solution.auditKeys([{ id: 'a' }, { id: 'b' }], (it) => it.id); return r.ok === true && deepEqual(r.duplicates, []) && deepEqual(r.missing, []); })()",
        },
        {
          name: 'detects duplicate keys',
          assertion:
            "(() => { const r = solution.auditKeys([{ id: 'a' }, { id: 'b' }, { id: 'a' }], (it) => it.id); return r.ok === false && deepEqual(r.duplicates, ['a']); })()",
        },
        {
          name: 'detects missing keys by index',
          assertion:
            "deepEqual(solution.auditKeys([{ id: 'a' }, {}, { id: 'b' }, { id: null }], (it) => it.id).missing, [1, 3])",
        },
        {
          name: 'zero is a valid key, not a missing one',
          assertion:
            "solution.auditKeys([{ id: 0 }, { id: 1 }], (it) => it.id).ok === true",
        },
        {
          name: 'duplicates are sorted and de-duplicated',
          assertion:
            "deepEqual(solution.auditKeys([{ id: 'b' }, { id: 'b' }, { id: 'a' }, { id: 'a' }, { id: 'a' }], (it) => it.id).duplicates, ['a', 'b'])",
          hidden: true,
        },
        {
          name: 'stable id keys survive a reorder',
          assertion:
            "solution.reorderPreservesKeys([{ id: 'a' }, { id: 'b' }, { id: 'c' }], (it) => it.id) === true",
        },
        {
          name: 'index keys do not survive a reorder',
          assertion:
            "solution.reorderPreservesKeys([{ id: 'a' }, { id: 'b' }, { id: 'c' }], (it, i) => i) === false",
        },
        {
          name: 'index keys on a single-item list are trivially stable',
          assertion:
            "solution.reorderPreservesKeys([{ id: 'a' }], (it, i) => i) === true",
          hidden: true,
        },
      ],
      xp: 60,
    },
    {
      slug: 'mini-usestate-engine',
      title: 'Build a Mini useState Engine',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `The clearest way to understand \`useState\` is to build it. Implement \`createRuntime(component)\`, a tiny renderer that gives a component function hook-like state.

The component is called as \`component(props, hooks)\` where \`hooks.useState(initial)\` returns \`[value, setValue]\`. Whatever the component returns is the "rendered output".

\`createRuntime\` returns an object with:

- \`render(props)\` — renders with the given props and returns the output.
- \`getOutput()\` — the most recent output.
- \`getRenderCount()\` — how many times the component function has been called.

Required behaviour:

1. **State slots are identified by call order.** Reset the hook index at the start of every render, so the first \`useState\` call always reads the first slot.
2. **State persists across renders.** Only the first render evaluates the initial value.
3. **Lazy initialisers.** If \`initial\` is a function, call it once and store the result.
4. **Setting state re-renders synchronously**, reusing the props from the last render.
5. **Updater functions.** \`setValue(prev => next)\` receives the latest stored value, so two updater calls in a row both take effect.
6. **Bail out.** If the next value is \`Object.is\`-equal to the current one, do not store and do not re-render.

\`\`\`js
const rt = createRuntime((props, h) => {
  const [c, setC] = h.useState(0);
  return { c, inc: () => setC((x) => x + 1) };
});
rt.render({});
rt.getOutput().inc();
rt.getOutput().c; // 1
\`\`\``,
      starterCode: `function createRuntime(component) {
  const slots = [];
  let index = 0;
  let lastProps = {};
  let output;
  let renderCount = 0;

  function useState(initial) {
    // 1. take the next slot
    // 2. initialise it on first use (support a lazy initialiser function)
    // 3. return [value, setter]; the setter bails out on Object.is equality
  }

  function doRender(props) {
    // reset the hook index, bump the render count, call the component
  }

  return {
    render(props) {
      return doRender(props || {});
    },
    getOutput() {
      return output;
    },
    getRenderCount() {
      return renderCount;
    },
  };
}

module.exports = { createRuntime };`,
      solutionCode: `function createRuntime(component) {
  const slots = [];
  let index = 0;
  let lastProps = {};
  let output;
  let renderCount = 0;

  function useState(initial) {
    const i = index;
    index += 1;

    if (!(i in slots)) {
      slots[i] = typeof initial === 'function' ? initial() : initial;
    }

    function setState(next) {
      const prev = slots[i];
      const value = typeof next === 'function' ? next(prev) : next;
      if (Object.is(prev, value)) return;
      slots[i] = value;
      doRender(lastProps);
    }

    return [slots[i], setState];
  }

  function doRender(props) {
    lastProps = props;
    index = 0;
    renderCount += 1;
    output = component(props, { useState });
    return output;
  }

  return {
    render(props) {
      return doRender(props || {});
    },
    getOutput() {
      return output;
    },
    getRenderCount() {
      return renderCount;
    },
  };
}

module.exports = { createRuntime };`,
      hints: [
        'Capture the slot index in a local const before you increment it — the setter closes over that const.',
        'Use `i in slots` rather than a truthiness check, so an initial value of 0, false or null still counts as initialised.',
        'The setter must re-render with lastProps, not with fresh props: a state update does not change props.',
        'Object.is, not ===, so that NaN compares equal to NaN and +0 does not equal -0.',
        'Store the resolved value BEFORE re-rendering, or the re-render will read the old one.',
      ],
      tests: [
        {
          name: 'first render returns the initial state',
          assertion:
            "(() => { const rt = solution.createRuntime((p, h) => h.useState(7)[0]); return rt.render({}) === 7; })()",
        },
        {
          name: 'setting state re-renders with the new value',
          assertion:
            "(() => { const rt = solution.createRuntime((p, h) => { const s = h.useState(0); return { c: s[0], inc: () => s[1](s[0] + 1) }; }); rt.render({}); rt.getOutput().inc(); return rt.getOutput().c === 1; })()",
        },
        {
          name: 'two updater calls both apply',
          assertion:
            "(() => { const rt = solution.createRuntime((p, h) => { const s = h.useState(0); return { c: s[0], inc: () => { s[1]((x) => x + 1); s[1]((x) => x + 1); } }; }); rt.render({}); rt.getOutput().inc(); return rt.getOutput().c === 2; })()",
        },
        {
          name: 'two direct calls with a stale value only apply once',
          assertion:
            "(() => { const rt = solution.createRuntime((p, h) => { const s = h.useState(0); return { c: s[0], inc: () => { s[1](s[0] + 1); s[1](s[0] + 1); } }; }); rt.render({}); rt.getOutput().inc(); return rt.getOutput().c === 1; })()",
        },
        {
          name: 'multiple useState calls get independent slots',
          assertion:
            "(() => { const rt = solution.createRuntime((p, h) => { const a = h.useState('a'); const b = h.useState('b'); return { a: a[0], b: b[0], setA: a[1] }; }); rt.render({}); rt.getOutput().setA('z'); return rt.getOutput().a === 'z' && rt.getOutput().b === 'b'; })()",
        },
        {
          name: 'lazy initialiser runs exactly once',
          assertion:
            "(() => { let calls = 0; const rt = solution.createRuntime((p, h) => { const s = h.useState(() => { calls += 1; return 5; }); return { c: s[0], set: s[1] }; }); rt.render({}); rt.getOutput().set(6); return calls === 1 && rt.getOutput().c === 6; })()",
        },
        {
          name: 'setting an identical value bails out of the re-render',
          assertion:
            "(() => { const rt = solution.createRuntime((p, h) => { const s = h.useState(0); return { set: s[1] }; }); rt.render({}); const before = rt.getRenderCount(); rt.getOutput().set(0); return rt.getRenderCount() === before; })()",
          hidden: true,
        },
        {
          name: 'state survives a props-only re-render',
          assertion:
            "(() => { const rt = solution.createRuntime((p, h) => { const s = h.useState(0); return { label: p.label, c: s[0], set: s[1] }; }); rt.render({ label: 'x' }); rt.getOutput().set(9); return rt.render({ label: 'y' }).label === 'y' && rt.getOutput().c === 9; })()",
          hidden: true,
        },
      ],
      xp: 90,
    },
  ],
  flashcards: [
    {
      front: 'What does JSX compile into?',
      back: 'Calls to `createElement` (or `jsx` from react/jsx-runtime) that return plain objects — React elements of the shape `{ type, props, key }`. Not DOM nodes.',
      tags: ['react', 'jsx'],
    },
    {
      front: 'Why does `<button>` behave differently from `<Button>` in JSX?',
      back: 'Lowercase tags compile to a string type (a host DOM element); capitalised tags compile to the identifier, so the component must be imported and in scope.',
      tags: ['react', 'jsx'],
    },
    {
      front: 'Which values does React render, and which does it skip?',
      back: 'Renders strings, numbers (including 0) and arrays. Skips null, undefined, true and false. Objects throw.',
      tags: ['react', 'jsx'],
    },
    {
      front: 'Why is `{count && <List />}` a bug?',
      back: '`&&` returns the left operand when falsy, and React renders the number 0. Compare explicitly: `count > 0 && <List />`.',
      tags: ['react', 'jsx', 'gotcha'],
    },
    {
      front: 'Why does calling `setCount(count + 1)` twice only add one?',
      back: '`count` is a const captured by the current render, so both calls compute the same value. Use the updater form `setCount(c => c + 1)`.',
      tags: ['react', 'state'],
    },
    {
      front: 'When does React skip a re-render after setState?',
      back: 'When the next value is `Object.is`-equal to the current one — the bail-out. Mutating an object and setting it back triggers this, which is why mutation appears to do nothing.',
      tags: ['react', 'state'],
    },
    {
      front: 'What must a list key be?',
      back: 'Stable across renders, unique among siblings, and derived from the data. Never Math.random(); index only for append-only, stateless lists.',
      tags: ['react', 'keys'],
    },
    {
      front: 'What exactly breaks when you use the array index as a key?',
      back: 'React matches children by position, so on insert/remove/reorder it reuses the DOM node and component state of the old occupant — inputs, focus, checkboxes and useState values shift by one row.',
      tags: ['react', 'keys', 'gotcha'],
    },
    {
      front: 'How do you reset a component tree deliberately?',
      back: 'Change its `key`. `<ProfileForm key={userId} />` unmounts and remounts when the user changes, throwing away all internal state.',
      tags: ['react', 'keys'],
    },
    {
      front: 'Render phase vs commit phase',
      back: 'Render calls your components and diffs the element tree — pure, may run twice or be discarded. Commit applies the minimal DOM mutations and then runs effects.',
      tags: ['react', 'rendering'],
    },
    {
      front: 'Why does StrictMode render components twice?',
      back: 'Development-only detection of impure render logic. A pure component is unaffected; a double increment or duplicated item is a real bug surfacing.',
      tags: ['react', 'strictmode'],
    },
    {
      front: 'Controlled vs uncontrolled input',
      back: 'Controlled: `value` + `onChange`, React state is the source of truth, re-renders per keystroke. Uncontrolled: `defaultValue` + ref, the DOM owns the value. File inputs are always uncontrolled.',
      tags: ['react', 'forms'],
    },
  ],
  resources: [
    { label: 'React — Describing the UI', url: 'https://react.dev/learn/describing-the-ui', kind: 'DOCS' },
    { label: 'React — Adding Interactivity (state, events, batching)', url: 'https://react.dev/learn/adding-interactivity', kind: 'DOCS' },
    { label: 'React — Rendering Lists and the role of keys', url: 'https://react.dev/learn/rendering-lists', kind: 'DOCS' },
    { label: 'React — Keeping Components Pure', url: 'https://react.dev/learn/keeping-components-pure', kind: 'ARTICLE' },
    { label: 'React — <StrictMode>', url: 'https://react.dev/reference/react/StrictMode', kind: 'DOCS' },
  ],
};

export default day;
