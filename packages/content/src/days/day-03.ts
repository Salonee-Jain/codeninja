import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 3,
  week: 1,
  pillar: 'FRONTEND',
  title: 'JavaScript ES6+ I — Language Core',
  summary: 'The half of JavaScript you use every hour: values, scope, functions and data transformation.',
  estimatedMinutes: 320,
  objectives: [
    'Distinguish the seven primitives from objects and predict coercion results',
    'Explain the temporal dead zone and why const is not immutability',
    'Use closures deliberately, and know which `this` an arrow function gets',
    'Destructure, spread and default-parameter your way to smaller functions',
    'Reach for map/filter/reduce/flatMap/some/every instead of index loops',
    'Model data with Map and Set, and copy it without accidental aliasing',
    'Ship code as ES modules and know how they differ from CommonJS',
  ],
  technologies: ['JavaScript (ES6+)'],
  lessons: [
    {
      slug: 'values-types-and-declarations',
      title: 'Values, Types, Coercion & Declarations',
      estimatedMinutes: 70,
      body: `# Values, Types, Coercion & Declarations

JavaScript has **seven primitives** — \`string\`, \`number\`, \`boolean\`, \`null\`, \`undefined\`, \`symbol\`, \`bigint\` — and everything else is an object (including arrays and functions).

\`\`\`js
typeof 42;          // 'number'
typeof 42n;         // 'bigint'
typeof 'hi';        // 'string'
typeof undefined;   // 'undefined'
typeof Symbol();    // 'symbol'
typeof null;        // 'object'  <-- a bug from 1995, kept for compatibility
typeof [];          // 'object'
typeof function(){} // 'function'
\`\`\`

Because \`typeof null\` lies and \`typeof []\` is unhelpful, use the right tool per case: \`Array.isArray(x)\`, \`x === null\`, \`Number.isNaN(x)\`, and for the general case \`Object.prototype.toString.call(x)\` which yields \`'[object Date]'\`, \`'[object Map]'\` and so on.

## Primitives are copied, objects are shared

\`\`\`js
let a = 1; let b = a; b++;            // a is still 1
const x = { n: 1 }; const y = x; y.n++; // x.n is now 2 — same object
\`\`\`

This single distinction explains most "why did my state change?" bugs. \`const\` prevents **rebinding**, not mutation:

\`\`\`js
const config = { retries: 3 };
config.retries = 5;      // fine — the binding still points at the same object
config = {};             // TypeError: Assignment to constant variable
Object.freeze(config);   // shallow freeze: config.retries = 9 is now a no-op
\`\`\`

## Coercion, and why \`===\` is the default

\`==\` runs the abstract equality algorithm, which converts operands before comparing:

\`\`\`js
'5' == 5        // true  — string converted to number
null == undefined // true — special-cased
[] == false     // true  — [] -> '' -> 0, false -> 0
'0' == false    // true
NaN == NaN      // false — NaN is never equal to anything
\`\`\`

Use \`===\` everywhere. The one idiomatic exception is \`x == null\`, which is a compact test for "null **or** undefined".

Truthiness has exactly **eight** falsy values: \`false\`, \`0\`, \`-0\`, \`0n\`, \`''\`, \`null\`, \`undefined\`, \`NaN\`. Everything else — including \`[]\`, \`{}\` and \`'0'\` — is truthy.

\`\`\`js
if ([]) console.log('runs');       // empty array is truthy
if ([].length) console.log('nope'); // 0 is falsy — this is what you meant
\`\`\`

Numbers are IEEE-754 doubles, so:

\`\`\`js
0.1 + 0.2 === 0.3;                          // false
Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON; // true — compare with a tolerance
Number.MAX_SAFE_INTEGER;                    // 9007199254740991
\`\`\`

> Never store money as a float. Store integer cents, or use \`BigInt\`/a decimal library.

## var, let, const and the temporal dead zone

\`var\` is function-scoped and hoisted **and initialised to \`undefined\`**. \`let\`/\`const\` are block-scoped and hoisted but *not* initialised — the span between the top of the block and the declaration is the **temporal dead zone (TDZ)**, and touching the binding there throws.

\`\`\`js
console.log(v); // undefined
var v = 1;

console.log(l); // ReferenceError: Cannot access 'l' before initialization
let l = 1;
\`\`\`

The TDZ is a feature: it turns a silent \`undefined\` into a loud error at the exact line you made the mistake.

Block scoping also fixes the most famous loop bug in the language:

\`\`\`js
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i)); // 3 3 3
for (let i = 0; i < 3; i++) setTimeout(() => console.log(i)); // 0 1 2
\`\`\`

With \`var\` there is one \`i\` shared by all three callbacks. With \`let\` the loop creates a **fresh binding per iteration**, so each closure captures its own copy.

Default to \`const\`. Use \`let\` only when you genuinely reassign. Never use \`var\` in new code.

## Strings, symbols and template literals

Template literals do interpolation, multi-line text and tagged templates:

\`\`\`js
const user = { name: 'Ada', score: 91 };
const line = \`\${user.name} scored \${user.score}%\`;

const rows = ['a', 'b'].map((c) => \`<li>\${c}</li>\`).join('\\n');
\`\`\`

Symbols give you collision-free keys and hook into language protocols:

\`\`\`js
const ID = Symbol('id');
const record = { [ID]: 7, name: 'Ada' };
Object.keys(record);              // ['name'] — symbol keys are skipped
record[Symbol.iterator];          // this is how for...of finds an iterator
\`\`\`

Knowing what a value *is* — and what the engine will silently turn it into — is the foundation everything else in this day rests on.`,
    },
    {
      slug: 'scope-closures-functions-this',
      title: 'Scope, Closures, Functions & `this`',
      estimatedMinutes: 80,
      body: `# Scope, Closures, Functions & \`this\`

## Lexical scope

Where a function is **written** decides what it can see — not where it is called. The engine resolves an identifier by walking outward through enclosing scopes to the global scope, then throwing \`ReferenceError\`.

\`\`\`js
const outerVal = 'outer';

function parent() {
  const parentVal = 'parent';
  function child() {
    // sees parentVal and outerVal by lexical position
    return [parentVal, outerVal].join('-');
  }
  return child();
}
\`\`\`

## Closures are just lexical scope that outlives the call

A closure is a function plus the scope it captured. The captured variables are **live references**, not snapshots.

\`\`\`js
function makeCounter(start = 0) {
  let count = start;             // private state
  return {
    increment: () => ++count,
    get value() { return count; },
  };
}

const c = makeCounter(10);
c.increment(); c.increment();
c.value;  // 12 — and nothing outside can touch count
\`\`\`

That is data privacy without classes, and it is the mechanism behind memoisation, throttling, module state, and React hooks.

\`\`\`js
function memoize(fn) {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) cache.set(key, fn(...args));
    return cache.get(key);
  };
}
\`\`\`

> Closures keep their captured scope alive. A long-lived closure that captured a huge array is a memory leak with a friendly face.

## Function forms

\`\`\`js
function declared(a) { return a; }          // hoisted, has its own this
const expressed = function (a) { return a; }; // not hoisted
const arrow = (a) => a;                     // not hoisted, NO own this
\`\`\`

Declarations are fully hoisted, so you can call them before their definition in the file. Expressions and arrows are not — the binding is in the TDZ until the assignment runs.

Arrow functions differ in four ways: no own \`this\`, no \`arguments\` object, cannot be called with \`new\`, and no \`prototype\`. Everything else is syntax sugar.

## \`this\` is decided at call time

For normal functions, \`this\` depends on **how the function is called**:

| Call form | \`this\` |
| --- | --- |
| \`obj.method()\` | \`obj\` |
| \`fn()\` | \`undefined\` in strict mode / modules, \`globalThis\` otherwise |
| \`new Fn()\` | the newly created object |
| \`fn.call(x)\` / \`fn.apply(x)\` / \`fn.bind(x)\` | \`x\` |

An arrow function ignores all of that and uses the \`this\` of its **enclosing lexical scope**, permanently.

\`\`\`js
const timer = {
  label: 'tick',
  startBroken() {
    setInterval(function () {
      console.log(this.label); // undefined — plain call, this is not timer
    }, 1000);
  },
  startFixed() {
    setInterval(() => {
      console.log(this.label); // 'tick' — arrow captured startFixed's this
    }, 1000);
  },
};
\`\`\`

The mirror-image mistake is defining an *object method* as an arrow:

\`\`\`js
const bad = { n: 1, get: () => this.n };  // this is module scope, not bad
\`\`\`

**Rule:** arrows for callbacks, normal functions (or class methods) for object methods.

Detaching a method loses its receiver, which is why event handlers so often need binding:

\`\`\`js
class Panel {
  constructor() { this.open = false; this.toggle = this.toggle.bind(this); }
  toggle() { this.open = !this.open; }
}
// or, with a class field: toggle = () => { this.open = !this.open; };
\`\`\`

## Parameters: defaults, rest and evaluation order

\`\`\`js
function request(url, { method = 'GET', retries = 3, headers = {} } = {}) {
  return { url, method, retries, headers };
}
request('/api');                       // all defaults, no options object needed
request('/api', { method: 'POST' });
\`\`\`

Defaults are evaluated **at call time, left to right**, so later parameters can reference earlier ones:

\`\`\`js
const clamp = (min, max, value = (min + max) / 2) => Math.min(max, Math.max(min, value));
clamp(0, 10);      // 5
\`\`\`

A default only fires for \`undefined\` — \`null\` is passed through untouched. And rest gathers the remainder into a **real array**, unlike the old \`arguments\`:

\`\`\`js
const sum = (...nums) => nums.reduce((total, n) => total + n, 0);
sum(1, 2, 3); // 6
\`\`\`

\`fn.length\` counts only the parameters **before** the first default or rest — a detail you will exploit when you build \`curry\` later today.`,
    },
    {
      slug: 'destructuring-and-modern-syntax',
      title: 'Destructuring, Spread/Rest & Safe Access',
      estimatedMinutes: 70,
      body: `# Destructuring, Spread/Rest & Safe Access

These are the features that make modern JavaScript look modern. They are not just terser — they remove whole categories of bugs.

## Destructuring

\`\`\`js
const user = { id: 7, name: 'Ada', address: { city: 'London', zip: 'E1' } };

const { name, id } = user;                       // order does not matter
const { address: { city } } = user;              // nested
const { role = 'student' } = user;               // default for missing key
const { name: displayName } = user;              // rename
const { id: userId, ...rest } = user;            // rest of the own enumerable props
\`\`\`

Arrays destructure by **position**:

\`\`\`js
const [first, second = 0, ...others] = [10, undefined, 30, 40];
// first = 10, second = 0 (default fires for undefined), others = [30, 40]

const [, , third] = [1, 2, 3];   // holes skip positions
let a = 1, b = 2;
[a, b] = [b, a];                 // swap with no temp variable
\`\`\`

Destructuring in parameters is where it earns its keep — it documents the shape of the argument in the signature:

\`\`\`js
const formatUser = ({ name, address: { city } = {} }) => name + ' (' + city + ')';
\`\`\`

> Destructuring \`null\` or \`undefined\` throws. Guard with a default: \`function f({ a } = {}) {}\`.

## Spread vs rest

They share syntax and are opposites. **Rest** collects (on the left of \`=\`, or in a parameter list); **spread** expands (in a literal or a call).

\`\`\`js
const base = { theme: 'dark', lang: 'en' };
const merged = { ...base, lang: 'fr' };    // later keys win: { theme:'dark', lang:'fr' }

const nums = [1, 2, 3];
Math.max(...nums);                          // 3
const copy = [...nums, 4];                  // [1,2,3,4]
const chars = [...'abc'];                   // ['a','b','c'] — any iterable
\`\`\`

The critical caveat: **spread is a shallow copy.**

\`\`\`js
const original = { meta: { tags: ['a'] } };
const shallow = { ...original };
shallow.meta.tags.push('b');
original.meta.tags;   // ['a','b'] — still the same nested object
\`\`\`

Use \`structuredClone(value)\` for a real deep copy of plain data (it handles Date, Map, Set, TypedArray and cycles, but not functions or DOM nodes) — or write your own, which is today's second exercise.

## Optional chaining and nullish coalescing

\`\`\`js
const city = user?.address?.city;             // undefined instead of a TypeError
const firstTag = post?.tags?.[0];             // works on indexes
const result = api.load?.();                  // only calls if load exists

const port = config.port ?? 3000;             // 0 stays 0
const portBad = config.port || 3000;          // 0 becomes 3000 — classic bug
\`\`\`

\`??\` falls back only for \`null\`/\`undefined\`; \`||\` falls back for every falsy value, which silently eats \`0\`, \`''\` and \`false\`. There is also \`??=\`:

\`\`\`js
options.timeout ??= 5000;   // set only if null/undefined
\`\`\`

> \`?.\` short-circuits the *whole* chain: in \`a?.b.c\`, if \`a\` is nullish the expression is \`undefined\` and \`.c\` is never evaluated. But do not sprinkle it everywhere — if a value should never be null, an exception is better feedback than a silent \`undefined\`.

## Working with objects

\`\`\`js
const scores = { ada: 91, linus: 84, grace: 97 };

Object.keys(scores);     // ['ada','linus','grace']
Object.values(scores);   // [91,84,97]
Object.entries(scores);  // [['ada',91], ...]

// Transform an object: entries -> map -> fromEntries
const boosted = Object.fromEntries(
  Object.entries(scores).map(([k, v]) => [k, Math.min(100, v + 5)])
);

// Computed keys and shorthand
const key = 'ada';
const one = { [key]: scores[key] };
const name = 'Grace';
const record = { name };            // shorthand for { name: name }
\`\`\`

\`Object.entries → map → Object.fromEntries\` is the object equivalent of \`Array.prototype.map\`, and it is worth committing to muscle memory.

Property order is not arbitrary: integer-like keys come first in ascending numeric order, then string keys in insertion order, then symbols. If order matters to you, use a \`Map\`.

## Checking for properties

\`\`\`js
'name' in user;                                    // true, includes the prototype chain
Object.hasOwn(user, 'name');                       // true, own properties only (ES2022)
Object.prototype.hasOwnProperty.call(user, 'name'); // the old, safe spelling
\`\`\`

Prefer \`Object.hasOwn\`. Calling \`user.hasOwnProperty(...)\` directly breaks on objects created with \`Object.create(null)\` — which is exactly the kind of object you use as a safe lookup table.`,
    },
    {
      slug: 'collections-classes-modules',
      title: 'Arrays, Collections, Classes & Modules',
      estimatedMinutes: 90,
      body: `# Arrays, Collections, Classes & Modules

## Array methods are your control flow

\`\`\`js
const orders = [
  { id: 1, user: 'ada',   total: 30, items: ['pen'] },
  { id: 2, user: 'linus', total: 55, items: ['book', 'mug'] },
  { id: 3, user: 'ada',   total: 12, items: [] },
];

orders.map((o) => o.total);                     // [30, 55, 12]
orders.filter((o) => o.total > 20);             // 2 orders
orders.find((o) => o.user === 'ada');           // first match, or undefined
orders.findIndex((o) => o.id === 3);            // 2
orders.some((o) => o.total > 50);               // true
orders.every((o) => o.total > 0);               // true
orders.flatMap((o) => o.items);                 // ['pen','book','mug']
orders.reduce((sum, o) => sum + o.total, 0);    // 97
\`\`\`

\`reduce\` is the general case: give it an accumulator and a step. Always pass the initial value — \`[].reduce((a, b) => a + b)\` throws on an empty array.

\`\`\`js
// reduce to an object: the shape of every groupBy you will ever write
const totalsByUser = orders.reduce((acc, o) => {
  acc[o.user] = (acc[o.user] ?? 0) + o.total;
  return acc;
}, {});
// { ada: 42, linus: 55 }
\`\`\`

**Mutating vs non-mutating** is the distinction that matters in React and Redux:

| Mutates in place | Returns a new array |
| --- | --- |
| \`push\`, \`pop\`, \`shift\`, \`unshift\` | \`concat\`, \`slice\`, \`map\`, \`filter\` |
| \`splice\`, \`sort\`, \`reverse\`, \`fill\` | \`toSorted\`, \`toReversed\`, \`toSpliced\`, \`with\` |

\`sort\` mutates **and** sorts lexicographically by default:

\`\`\`js
[10, 9, 1].sort();                   // [1, 10, 9]  — string comparison!
[10, 9, 1].sort((a, b) => a - b);    // [1, 9, 10]
[...orders].sort((a, b) => b.total - a.total); // copy first, then sort
orders.toSorted((a, b) => b.total - a.total); // ES2023, no copy needed
\`\`\`

Also useful: \`at(-1)\` for the last element, \`Array.from({ length: 5 }, (_, i) => i)\` to build ranges, and \`flat(Infinity)\` to fully flatten.

## Map and Set

Plain objects have three weaknesses as collections: keys are coerced to strings, inherited keys can collide, and there is no \`size\`.

\`\`\`js
const byId = new Map();
const key = { id: 1 };
byId.set(key, 'object keys work');
byId.set(1, 'number key stays a number');
byId.get(1);       // 'number key stays a number'
byId.has(key);     // true
byId.size;         // 2
[...byId.keys()];  // insertion order, guaranteed

const seen = new Set([1, 2, 2, 3]);
seen.size;                    // 3
const unique = [...new Set(['a', 'b', 'a'])]; // ['a','b']
\`\`\`

Use \`Map\` when keys are dynamic, non-string, or when you iterate often; use an object when the shape is fixed and you want JSON serialisation. \`WeakMap\`/\`WeakSet\` hold keys weakly — perfect for attaching metadata to objects you do not own, without leaking.

## Classes

\`\`\`js
class Account {
  #balance = 0;                      // truly private, enforced by the engine
  static minimum = 0;

  constructor(owner, balance = 0) {
    this.owner = owner;
    this.#balance = balance;
  }

  get balance() { return this.#balance; }

  deposit(amount) {
    if (amount <= 0) throw new RangeError('amount must be positive');
    this.#balance += amount;
    return this;                     // chainable
  }

  static open(owner) { return new Account(owner); }
}

class Savings extends Account {
  constructor(owner, balance, rate) {
    super(owner, balance);           // must run before touching this
    this.rate = rate;
  }
  addInterest() { return this.deposit(this.balance * this.rate); }
}
\`\`\`

Classes are syntax over prototypes: methods live on \`Account.prototype\`, shared by every instance. Class bodies are always strict mode, and class declarations are **not** hoisted for use.

## Modules: ESM vs CommonJS

\`\`\`js
// math.js
export const PI = 3.14159;
export function area(r) { return PI * r * r; }
export default class Circle {}

// app.js
import Circle, { area, PI as pi } from './math.js';
import * as math from './math.js';
const { chunk } = await import('./lazy.js');   // dynamic, returns a Promise
\`\`\`

| | ESM | CommonJS |
| --- | --- | --- |
| Syntax | \`import\` / \`export\` | \`require\` / \`module.exports\` |
| Resolution | static, at parse time | dynamic, at run time |
| Loading | asynchronous | synchronous |
| Bindings | live views of the export | a copy of the value at require time |
| Tree-shaking | yes | not reliably |
| \`this\` at top level | \`undefined\` | \`module.exports\` |

Static analysability is the whole point: because \`import\` cannot be conditional, bundlers can prove which exports are unused and drop them. In Node, \`"type": "module"\` in \`package.json\` (or a \`.mjs\` extension) selects ESM.

## Immutability in practice

\`\`\`js
const state = { user: { name: 'Ada' }, tags: ['js'] };

const next = {
  ...state,
  user: { ...state.user, name: 'Grace' },   // clone every level you change
  tags: [...state.tags, 'css'],
};
\`\`\`

Update by copying the path you touch and reusing everything else. That is exactly what Redux reducers and React state setters require: a **new reference** for anything that changed, and the **same reference** for anything that did not — which is what makes \`===\` comparisons a valid change-detection strategy.`,
    },
  ],
  quiz: [
    {
      prompt: 'What does `console.log(x); let x = 1;` do, and why?',
      options: [
        'Logs `undefined`, because `let` is hoisted and initialised',
        'Logs `1`, because the engine reorders the statements',
        'Throws a ReferenceError, because `x` is in the temporal dead zone until its declaration is evaluated',
        'Throws a SyntaxError at parse time',
      ],
      correctIndex: 2,
      explanation:
        '`let` and `const` bindings are hoisted to the top of the block but left uninitialised. Any access before the declaration executes throws a ReferenceError. `var` would have logged `undefined` instead, which is precisely the silent bug the TDZ was designed to surface.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What does `const cfg = { port: 0 }; const p = cfg.port || 3000;` produce, and what should you write instead?',
      options: [
        '`0`; the code is already correct',
        '`3000`, because `0` is falsy — use `cfg.port ?? 3000` so only null/undefined fall back',
        '`3000`, and `??` behaves identically',
        '`undefined`, because `||` requires both operands to be objects',
      ],
      correctIndex: 1,
      explanation:
        '`||` falls back on any falsy value, so a legitimate `0`, `\'\'` or `false` gets replaced. `??` only falls back for `null` and `undefined`, which is almost always the intent when reading configuration.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Why does `for (var i = 0; i < 3; i++) setTimeout(() => console.log(i))` print `3 3 3`?',
      options: [
        'setTimeout always fires after the loop, so the value is stale',
        'Arrow functions cannot capture loop variables',
        '`var` is function-scoped, so all three closures capture the one shared binding, which is 3 by the time the callbacks run',
        'The callbacks run in parallel and race each other',
      ],
      correctIndex: 2,
      explanation:
        'There is exactly one `i` for the whole function. `let` instead creates a fresh binding per iteration that each closure captures independently, printing 0 1 2. The timing is a red herring — the scoping is the cause.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'An object method is written as `const obj = { n: 1, get() { return this.n; } }`. What breaks if you change `get` to an arrow function?',
      options: [
        'Nothing — arrows and methods are interchangeable',
        'It becomes asynchronous',
        'It can no longer be called with parentheses',
        '`this` is taken from the enclosing lexical scope (module/global) instead of `obj`, so `this.n` is undefined',
      ],
      correctIndex: 3,
      explanation:
        'Arrow functions have no own `this` binding; they close over the `this` of where they were written. An object literal does not create a `this` scope, so the arrow gets module scope. Arrows are for callbacks; use methods or normal functions for object members.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'After `const a = { m: { t: [1] } }; const b = { ...a }; b.m.t.push(2);` what is `a.m.t`?',
      options: [
        '`[1, 2]`, because spread copies only the top level and `b.m` is the same object as `a.m`',
        '`[1]`, because spread deep-clones',
        '`[]`, because push replaces the array',
        'It throws, because `a` is const',
      ],
      correctIndex: 0,
      explanation:
        'Spread produces a shallow copy: `b` is a new object whose `m` property still points at the same nested object. For a real deep copy of plain data use `structuredClone(a)` or clone each level you intend to change.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which array method call correctly turns `[{tags:["a"]},{tags:["b","c"]}]` into `["a","b","c"]`?',
      options: [
        '`arr.map(o => o.tags)`',
        '`arr.reduce((a, o) => a.concat(o), [])`',
        '`arr.flatMap(o => o.tags)`',
        '`arr.filter(o => o.tags).flat()`',
      ],
      correctIndex: 2,
      explanation:
        '`flatMap` maps then flattens one level, which is exactly this shape. `map` alone would give `[["a"],["b","c"]]`, and the `filter` option keeps the objects rather than the tags.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Why can bundlers tree-shake ES modules but not reliably CommonJS?',
      options: [
        'ESM files are smaller on disk',
        '`import`/`export` are static and analysable before execution, whereas `require()` can be called conditionally with a computed path',
        'CommonJS does not support named exports',
        'ESM runs in strict mode',
      ],
      correctIndex: 1,
      explanation:
        'ESM bindings are resolved at parse time and cannot be conditional, so a bundler can prove which exports are never used. `require()` is an ordinary function call evaluated at run time, so its result cannot be statically determined.',
      difficulty: 'HARD',
    },
    {
      prompt: 'When is `Map` a strictly better choice than a plain object?',
      options: [
        'When you need JSON.stringify to serialise it directly',
        'When you want prototype inheritance on the collection',
        'When you need non-string keys, frequent size checks, or guaranteed insertion-order iteration without key coercion',
        'When the keys are known at author time and never change',
      ],
      correctIndex: 2,
      explanation:
        'Object keys are coerced to strings, may collide with prototype members, and have a mixed ordering rule (integer-like keys first). `Map` accepts any value as a key, exposes `.size`, and iterates in insertion order. It does not serialise to JSON, which is the main reason to still use objects.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'group-by',
      title: 'Implement groupBy',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Write \`groupBy(items, keyFn)\` — the utility you would otherwise pull Lodash in for.

It takes an array and a function that derives a key from each item, and returns a **plain object** mapping each key to the array of items that produced it.

\`\`\`js
groupBy([1, 2, 3, 4, 5], (n) => (n % 2 === 0 ? 'even' : 'odd'));
// { odd: [1, 3, 5], even: [2, 4] }

groupBy(['a', 'bb', 'cc'], (w) => w.length);
// { '1': ['a'], '2': ['bb', 'cc'] }
\`\`\`

Rules:

- Items must appear in each group in their original relative order.
- Keys are stringified (that is what object keys are).
- An empty input returns \`{}\`.
- Do **not** mutate the input array.`,
      starterCode: `function groupBy(items, keyFn) {
  // your code here
}

module.exports = { groupBy };`,
      solutionCode: `function groupBy(items, keyFn) {
  const result = {};

  for (const item of items) {
    const key = String(keyFn(item));
    if (!Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] = [];
    }
    result[key].push(item);
  }

  return result;
}

module.exports = { groupBy };`,
      hints: [
        'Start with an empty object and push into it as you iterate — a for...of loop or a reduce both work.',
        'Check the bucket exists before pushing: `result[key] ??= []` or `hasOwnProperty`.',
        'Use `String(keyFn(item))` so numeric and string keys behave consistently.',
        'Never write `if (result[key])` — a key named "constructor" would find an inherited value.',
      ],
      tests: [
        {
          name: 'groups by odd/even',
          assertion:
            "deepEqual(solution.groupBy([1,2,3,4,5], n => n % 2 === 0 ? 'even' : 'odd'), { odd: [1,3,5], even: [2,4] })",
        },
        {
          name: 'numeric keys become strings',
          assertion:
            "deepEqual(solution.groupBy(['a','bb','cc','d'], w => w.length), { 1: ['a','d'], 2: ['bb','cc'] })",
        },
        {
          name: 'empty input gives an empty object',
          assertion: "deepEqual(solution.groupBy([], x => x), {})",
        },
        {
          name: 'preserves original order inside each group',
          assertion:
            "deepEqual(solution.groupBy([3,1,2,4], n => n % 2 === 0 ? 'even' : 'odd'), { odd: [3,1], even: [2,4] })",
        },
        {
          name: 'groups objects by a property',
          assertion:
            "deepEqual(solution.groupBy([{r:'a',v:1},{r:'b',v:2},{r:'a',v:3}], o => o.r), { a: [{r:'a',v:1},{r:'a',v:3}], b: [{r:'b',v:2}] })",
        },
        {
          name: 'does not mutate the input',
          assertion:
            "(() => { const src = [1,2,3]; solution.groupBy(src, n => n); return src.length === 3 && src[0] === 1 && src[2] === 3; })()",
          hidden: true,
        },
        {
          name: 'handles a key that collides with Object.prototype',
          assertion:
            "(() => { const out = solution.groupBy(['x'], () => 'constructor'); return Array.isArray(out.constructor) && out.constructor.length === 1; })()",
          hidden: true,
        },
      ],
      xp: 40,
    },
    {
      slug: 'deep-clone',
      title: 'Implement deepClone',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Spread and \`Object.assign\` only copy one level deep. Write \`deepClone(value)\` that returns a structurally identical value sharing **no** object references with the original.

It must handle:

- primitives (\`number\`, \`string\`, \`boolean\`, \`null\`, \`undefined\`) — returned as-is
- plain objects and arrays, recursively
- \`Date\` — a new Date with the same time
- \`Map\` and \`Set\` — cloned, with their contents cloned too
- **circular references** — \`a.self = a\` must not blow the stack

\`\`\`js
const src = { a: { b: [1, 2] }, when: new Date(0) };
const copy = deepClone(src);
copy.a.b.push(3);
src.a.b.length; // still 2
\`\`\`

You may add extra parameters with defaults (a \`WeakMap\` of already-cloned objects is the usual trick).`,
      starterCode: `function deepClone(value) {
  // your code here
}

module.exports = { deepClone };`,
      solutionCode: `function deepClone(value, seen = new WeakMap()) {
  // Primitives (and functions, which we deliberately share) come back unchanged.
  if (value === null || typeof value !== 'object') return value;

  // Already cloned in this traversal? Reuse it — this is what handles cycles.
  if (seen.has(value)) return seen.get(value);

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (value instanceof Map) {
    const out = new Map();
    seen.set(value, out);
    for (const [k, v] of value) {
      out.set(deepClone(k, seen), deepClone(v, seen));
    }
    return out;
  }

  if (value instanceof Set) {
    const out = new Set();
    seen.set(value, out);
    for (const v of value) {
      out.add(deepClone(v, seen));
    }
    return out;
  }

  if (Array.isArray(value)) {
    const out = [];
    seen.set(value, out);
    for (let i = 0; i < value.length; i++) {
      out[i] = deepClone(value[i], seen);
    }
    return out;
  }

  const out = {};
  seen.set(value, out);
  for (const [k, v] of Object.entries(value)) {
    out[k] = deepClone(v, seen);
  }
  return out;
}

module.exports = { deepClone };`,
      hints: [
        'Bail out early: `if (value === null || typeof value !== "object") return value;` covers every primitive in one line.',
        'Register the new container in your WeakMap *before* you recurse into its contents, or cycles will still recurse forever.',
        'Order matters: check Date, Map and Set before the generic object branch, because they are all typeof "object".',
        'Arrays need `Array.isArray`, not `instanceof Array` — the latter fails across realms.',
      ],
      tests: [
        {
          name: 'primitives pass through',
          assertion:
            "solution.deepClone(42) === 42 && solution.deepClone('x') === 'x' && solution.deepClone(null) === null && solution.deepClone(true) === true",
        },
        {
          name: 'clones a nested structure by value',
          assertion: "deepEqual(solution.deepClone({ a: 1, b: { c: [1, 2] } }), { a: 1, b: { c: [1, 2] } })",
        },
        {
          name: 'nested objects are not shared',
          assertion:
            "(() => { const src = { a: { b: { c: 1 } } }; const copy = solution.deepClone(src); copy.a.b.c = 99; return src.a.b.c === 1 && copy.a !== src.a; })()",
        },
        {
          name: 'arrays are cloned, not aliased',
          assertion:
            "(() => { const src = { list: [1, 2] }; const copy = solution.deepClone(src); copy.list.push(3); return src.list.length === 2 && copy.list.length === 3 && copy.list !== src.list; })()",
        },
        {
          name: 'Date is cloned to a new instance',
          assertion:
            "(() => { const d = new Date(0); const copy = solution.deepClone({ d }); return copy.d instanceof Date && copy.d.getTime() === 0 && copy.d !== d; })()",
        },
        {
          name: 'Map is cloned deeply',
          assertion:
            "(() => { const m = new Map([['k', { n: 1 }]]); const copy = solution.deepClone(m); return copy instanceof Map && copy !== m && copy.get('k').n === 1 && copy.get('k') !== m.get('k'); })()",
        },
        {
          name: 'Set is cloned',
          assertion:
            "(() => { const s = new Set([1, 2]); const copy = solution.deepClone(s); return copy instanceof Set && copy !== s && copy.size === 2 && copy.has(2); })()",
        },
        {
          name: 'handles circular references',
          assertion:
            "(() => { const a = { n: 1 }; a.self = a; const copy = solution.deepClone(a); return copy !== a && copy.n === 1 && copy.self === copy; })()",
          hidden: true,
        },
        {
          name: 'shared references stay shared within one clone',
          assertion:
            "(() => { const shared = { id: 1 }; const src = { x: shared, y: shared }; const copy = solution.deepClone(src); return copy.x === copy.y && copy.x !== shared; })()",
          hidden: true,
        },
      ],
      xp: 70,
    },
    {
      slug: 'curry-pipe-compose',
      title: 'curry, pipe and compose',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Three functional building blocks. Export all three.

**\`curry(fn)\`** returns a function that can be called with the arguments in any grouping until it has at least \`fn.length\` of them, then invokes \`fn\`.

\`\`\`js
const add3 = curry((a, b, c) => a + b + c);
add3(1)(2)(3);   // 6
add3(1, 2)(3);   // 6
add3(1)(2, 3);   // 6
add3(1, 2, 3);   // 6

const add1 = add3(1);   // reusable partial — calling it twice must not leak state
add1(2)(3);      // 6
add1(10)(100);   // 111
\`\`\`

**\`pipe(...fns)\`** returns a function that runs the functions **left to right**, feeding each result into the next.

**\`compose(...fns)\`** does the same **right to left** (the maths convention).

\`\`\`js
pipe(x => x + 1, x => x * 2)(3);     // 8
compose(x => x + 1, x => x * 2)(3);  // 7
pipe()(5);                            // 5 — no functions means identity
\`\`\`

Hint: \`fn.length\` is the number of declared parameters before any default or rest parameter.`,
      starterCode: `function curry(fn) {
  // your code here
}

function pipe(...fns) {
  // your code here
}

function compose(...fns) {
  // your code here
}

module.exports = { curry, pipe, compose };`,
      solutionCode: `function curry(fn) {
  return function curried(...args) {
    // Enough arguments collected? Run the real function.
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    // Otherwise return a collector. Note it builds a NEW array each time,
    // so a partially applied function can be reused without leaking state.
    return function (...rest) {
      return curried.apply(this, args.concat(rest));
    };
  };
}

function pipe(...fns) {
  return (value) => fns.reduce((acc, fn) => fn(acc), value);
}

function compose(...fns) {
  return (value) => fns.reduceRight((acc, fn) => fn(acc), value);
}

module.exports = { curry, pipe, compose };`,
      hints: [
        'The recursive shape is: if you have enough args call the function, otherwise return a function that appends more args and calls yourself again.',
        '`fn.length` tells you the arity. Use `args.length >= fn.length` as the stop condition.',
        'Use `args.concat(rest)` rather than `args.push(...rest)` — mutating the captured array is exactly the bug that breaks reusable partials.',
        '`pipe` is `reduce` over the functions; `compose` is the same thing with `reduceRight`.',
      ],
      tests: [
        {
          name: 'curry supports one argument at a time',
          assertion: "solution.curry((a, b, c) => a + b + c)(1)(2)(3) === 6",
        },
        {
          name: 'curry supports mixed groupings',
          assertion:
            "(() => { const f = solution.curry((a, b, c) => a + b + c); return f(1, 2)(3) === 6 && f(1)(2, 3) === 6 && f(1, 2, 3) === 6; })()",
        },
        {
          name: 'a partially applied function is reusable',
          assertion:
            "(() => { const add1 = solution.curry((a, b, c) => a + b + c)(1); return add1(2)(3) === 6 && add1(10)(100) === 111; })()",
        },
        {
          name: 'curry works for arity 2',
          assertion: "solution.curry((a, b) => a * b)(3)(4) === 12",
        },
        {
          name: 'pipe applies functions left to right',
          assertion: "solution.pipe(x => x + 1, x => x * 2)(3) === 8",
        },
        {
          name: 'compose applies functions right to left',
          assertion: "solution.compose(x => x + 1, x => x * 2)(3) === 7",
        },
        {
          name: 'pipe with no functions is the identity',
          assertion: "solution.pipe()(5) === 5 && solution.compose()('a') === 'a'",
        },
        {
          name: 'pipe chains three steps',
          assertion:
            "(() => { const inc = x => x + 1, dbl = x => x * 2; return solution.pipe(inc, dbl, inc)(1) === 5; })()",
          hidden: true,
        },
        {
          name: 'curry and pipe compose together',
          assertion:
            "(() => { const mul = solution.curry((a, b) => a * b); const add = solution.curry((a, b) => a + b); return solution.pipe(mul(2), add(3))(5) === 13; })()",
          hidden: true,
        },
      ],
      xp: 100,
    },
  ],
  flashcards: [
    {
      front: 'How many primitive types does JavaScript have, and what are they?',
      back: 'Seven: string, number, boolean, null, undefined, symbol, bigint. Everything else — arrays, functions, dates — is an object.',
      tags: ['javascript', 'types'],
    },
    {
      front: 'List every falsy value',
      back: '`false`, `0`, `-0`, `0n`, `\'\'`, `null`, `undefined`, `NaN`. That is all eight — `[]`, `{}` and `\'0\'` are truthy.',
      tags: ['javascript', 'coercion'],
    },
    {
      front: 'What is the temporal dead zone?',
      back: 'The region between the top of a block and a `let`/`const` declaration. The binding is hoisted but uninitialised, so any access throws a ReferenceError instead of yielding `undefined`.',
      tags: ['javascript', 'scope'],
    },
    {
      front: 'Does `const` make a value immutable?',
      back: 'No. It prevents **rebinding** the identifier. `const o = {}; o.x = 1` is legal. Use `Object.freeze` (shallow) or structural copying for immutability.',
      tags: ['javascript', 'scope'],
    },
    {
      front: 'What is a closure?',
      back: 'A function together with the lexical scope it captured, kept alive after the outer call returned. The captured variables are live references, which is why it gives you private mutable state.',
      tags: ['javascript', 'closures'],
    },
    {
      front: 'How does `this` differ between an arrow and a normal function?',
      back: 'A normal function gets `this` from the call site (`obj.m()`, `new`, `call/apply/bind`, else undefined in strict mode). An arrow has no own `this` and permanently uses the enclosing lexical scope’s.',
      tags: ['javascript', 'functions'],
    },
    {
      front: '`??` vs `||`',
      back: '`??` falls back only for `null`/`undefined`. `||` falls back for every falsy value, so it silently replaces a valid `0`, `\'\'` or `false`.',
      tags: ['javascript', 'operators'],
    },
    {
      front: 'What does spread copy?',
      back: 'One level. `{...obj}` gives a new top-level object whose nested values are still the same references. Use `structuredClone` or a recursive clone for deep copies.',
      tags: ['javascript', 'objects'],
    },
    {
      front: 'How do you map over an object?',
      back: '`Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))`.',
      tags: ['javascript', 'objects'],
    },
    {
      front: 'Which array methods mutate?',
      back: '`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`. Their non-mutating ES2023 counterparts are `toSorted`, `toReversed`, `toSpliced` and `with`.',
      tags: ['javascript', 'arrays'],
    },
    {
      front: 'Why does `[10, 9, 1].sort()` give `[1, 10, 9]`?',
      back: 'The default comparator converts elements to strings and compares them lexicographically. Always pass `(a, b) => a - b` for numbers.',
      tags: ['javascript', 'arrays'],
    },
    {
      front: 'ESM vs CommonJS in one line each',
      back: 'ESM: static `import`/`export`, async loading, live bindings, tree-shakeable. CJS: dynamic `require`, synchronous, copies values at require time, not reliably tree-shakeable.',
      tags: ['javascript', 'modules'],
    },
  ],
  resources: [
    {
      label: 'MDN — JavaScript Guide',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
      kind: 'DOCS',
    },
    {
      label: 'javascript.info — The Modern JavaScript Tutorial',
      url: 'https://javascript.info/',
      kind: 'ARTICLE',
    },
    {
      label: 'ECMAScript Language Specification',
      url: 'https://tc39.es/ecma262/',
      kind: 'SPEC',
    },
    {
      label: 'MDN — Array instance methods',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array',
      kind: 'DOCS',
    },
    {
      label: 'Node.js — Modules: ECMAScript modules',
      url: 'https://nodejs.org/api/esm.html',
      kind: 'DOCS',
    },
  ],
};

export default day;
