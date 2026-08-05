import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 6,
  week: 1,
  pillar: 'FOUNDATIONS',
  title: 'TypeScript, Git & the Modern Toolchain',
  summary: 'Types that catch bugs, a git history people can read, and a build that takes 200ms.',
  estimatedMinutes: 340,
  objectives: [
    'Model real data with unions, literal types and narrowing instead of `any`',
    'Write generic functions and reach for the right utility type',
    'Choose between merge and rebase, and resolve a conflict without panic',
    'Explain semver, lockfiles and what a workspace actually does',
    'Set up Vite, ESLint and Prettier so they cooperate instead of fighting',
  ],
  technologies: ['TypeScript', 'Git', 'npm', 'Vite', 'ESLint', 'Prettier'],
  lessons: [
    {
      slug: 'typescript-type-system',
      title: 'TypeScript I — Structural Types, Narrowing & Strictness',
      estimatedMinutes: 85,
      body: `# TypeScript I — Structural Types, Narrowing & Strictness

TypeScript is a **static analyser with erasable syntax**. It never runs. \`tsc\` (or esbuild, or SWC) strips the types and emits JavaScript, and everything you wrote about types disappears. Internalise that early: types cannot validate a JSON response at runtime, cannot check user input, and cannot stop a third-party API from returning \`null\`.

## Structural, not nominal

Java and C# ask "is this an instance of that class?". TypeScript asks "does this shape have the members I need?".

\`\`\`ts
interface Point { x: number; y: number }

function len(p: Point) { return Math.hypot(p.x, p.y); }

const marker = { x: 3, y: 4, label: 'home' };
len(marker); // fine — extra properties are allowed on a variable
\`\`\`

That last line surprises people who expect an error. It is deliberate: \`marker\` *is* a \`Point\`, plus more. The exception is an **object literal passed directly**, which gets excess property checking:

\`\`\`ts
len({ x: 3, y: 4, label: 'home' }); // Error: 'label' does not exist in type 'Point'
\`\`\`

The literal check exists to catch typos (\`colour\` vs \`color\`) at the one moment TypeScript can be sure a property is a mistake rather than extra information.

## interface vs type

Both describe object shapes. The practical differences:

| | \`interface\` | \`type\` |
| --- | --- | --- |
| Declaration merging | yes (re-declare to add members) | no |
| Unions / tuples / primitives | no | yes |
| \`extends\` | yes | via intersection \`&\` |
| Error messages | usually shorter | can expand into a wall |

Use \`interface\` for object shapes you may extend, \`type\` for everything else — unions, tuples, function types, mapped types.

## The union is the workhorse

Most modelling problems in TypeScript are solved by a **discriminated union**: a set of object types sharing a literal-typed field.

\`\`\`ts
type Result<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

function render(r: Result<string[]>): string {
  switch (r.status) {
    case 'loading': return 'Loading…';
    case 'success': return r.data.join(', ');   // r.data exists here
    case 'error':   return r.message;           // r.message exists here
  }
}
\`\`\`

This is worth more than any other TypeScript feature. It makes illegal states unrepresentable: there is no way to construct a value that is both \`loading\` and has \`data\`. Compare the shape people write instead — \`{ loading: boolean; data?: T; error?: string }\` — which has eight possible states, six of them nonsense.

To guarantee you handled every case, use an exhaustiveness check:

\`\`\`ts
function assertNever(x: never): never {
  throw new Error('Unhandled variant: ' + JSON.stringify(x));
}

function label(r: Result<unknown>) {
  switch (r.status) {
    case 'loading': return 'busy';
    case 'success': return 'done';
    case 'error':   return 'failed';
    default: return assertNever(r); // compile error the day someone adds a variant
  }
}
\`\`\`

## Narrowing

The compiler runs a small flow analysis. Anything that narrows at runtime narrows in the type system:

\`\`\`ts
function describe(v: string | number | string[] | Date | null) {
  if (v === null) return 'nothing';          // equality narrowing
  if (typeof v === 'string') return v.trim(); // typeof
  if (Array.isArray(v)) return v.length + ' items';
  if (v instanceof Date) return v.toISOString(); // instanceof
  return v.toFixed(2);                        // number, by elimination
}
\`\`\`

For your own runtime checks, write a **type predicate** so the compiler learns from them:

\`\`\`ts
interface User { id: number; email: string }

function isUser(v: unknown): v is User {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as Record<string, unknown>).id === 'number' &&
    typeof (v as Record<string, unknown>).email === 'string'
  );
}

const raw: unknown = JSON.parse(body);
if (isUser(raw)) {
  console.log(raw.email); // narrowed to User
}
\`\`\`

> A type predicate is a **promise you make to the compiler**. If \`isUser\` returns \`true\` for something that is not a \`User\`, TypeScript believes you and you have a runtime crash with a green build. This is why teams eventually adopt Zod or Valibot, which derive the type *from* the validator so the two cannot drift.

## unknown vs any

\`any\` disables the checker for that value and everything it touches — it is contagious. \`unknown\` is the safe top type: you can assign anything *to* it, but you must narrow before you use it.

\`\`\`ts
function parse(json: string): unknown { return JSON.parse(json); }

const cfg = parse(text);
// cfg.port            -> Error: 'cfg' is of type 'unknown'
if (isRecord(cfg) && typeof cfg.port === 'number') { /* now usable */ }
\`\`\`

**\`JSON.parse\` returns \`any\`.** That is the single biggest hole in most codebases: one \`fetch().then(r => r.json())\` and untyped data flows through the whole app with the compiler smiling. Type the boundary.

## tsconfig strictness

\`\`\`json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  }
}
\`\`\`

\`strict: true\` is a bundle of flags; the two that change how you write code are \`strictNullChecks\` (\`null\` and \`undefined\` stop being assignable to everything) and \`noImplicitAny\`.

Two more are worth turning on deliberately:

- **\`noUncheckedIndexedAccess\`** — \`arr[0]\` becomes \`T | undefined\`, which is the truth. Noisy, and correct.
- **\`skipLibCheck: true\`** — do not type-check \`node_modules\` \`.d.ts\` files. Saves enormous build time and spares you from other people's type errors.

> Never start a new project without \`strict\`. Retro-fitting it to a 60k-line codebase is a multi-week project; starting with it costs nothing.`,
    },
    {
      slug: 'typescript-generics-and-utility-types',
      title: 'TypeScript II — Generics, Utility Types & Declaration Files',
      estimatedMinutes: 80,
      body: `# TypeScript II — Generics, Utility Types & Declaration Files

## Generics are parameters for types

A generic exists to **relate** an input type to an output type. If a type parameter appears only once in a signature, you probably wanted a union or \`unknown\`.

\`\`\`ts
// Bad: T is used once. This is just (x: unknown) => void with extra steps.
function log<T>(value: T): void { console.log(value); }

// Good: the return type is derived from the argument type.
function first<T>(items: readonly T[]): T | undefined { return items[0]; }
\`\`\`

Constraints let you require capabilities:

\`\`\`ts
function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  return items.map((item) => item[key]);
}

const users = [{ id: 1, email: 'a@b.c' }, { id: 2, email: 'd@e.f' }];
const ids = pluck(users, 'id');      // number[]
const bad = pluck(users, 'name');    // Error: '"name"' is not assignable to 'id' | 'email'
\`\`\`

\`keyof T\` is the union of \`T\`'s keys; \`T[K]\` is an indexed access type. Those two operators are behind most of the clever typings you will read in library source.

Defaults and multiple parameters compose naturally:

\`\`\`ts
interface Paginated<T, M = { total: number }> {
  items: T[];
  meta: M;
}
\`\`\`

## The utility types you will actually use

\`\`\`ts
interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'member';
  createdAt: Date;
}

type Draft       = Partial<User>;                    // every prop optional
type Complete    = Required<Draft>;                  // every prop required
type Frozen      = Readonly<User>;                   // every prop readonly
type PublicUser  = Omit<User, 'email'>;              // drop keys
type Credentials = Pick<User, 'email' | 'id'>;       // keep keys
type Role        = User['role'];                     // 'admin' | 'member'
type ById        = Record<number, User>;             // index signature
type Roles       = Exclude<Role, 'admin'>;           // 'member'
type Defined     = NonNullable<string | null>;       // string
type Args        = Parameters<typeof pluck>;         // tuple of param types
type Ret         = ReturnType<typeof first>;         // unknown | undefined
type Resolved    = Awaited<ReturnType<typeof fetchUser>>;
\`\`\`

Three rules that save review time:

1. **\`Omit\` does not check its keys.** \`Omit<User, 'emial'>\` compiles happily and silently omits nothing. \`Pick\` *does* check. Prefer \`Pick\` where practical.
2. **Derive, do not duplicate.** If a function takes the same shape as an API payload, write \`Pick<User, 'email' | 'name'>\`, not a hand-copied interface that will drift.
3. **\`Record<string, T>\` lies without \`noUncheckedIndexedAccess\`** — \`map['missing']\` is typed \`T\` but is \`undefined\` at runtime.

Writing your own mapped type is not exotic:

\`\`\`ts
type Nullable<T> = { [K in keyof T]: T[K] | null };
type Getters<T> = {
  [K in keyof T & string as \`get\${Capitalize<K>}\`]: () => T[K];
};
// Getters<{ id: number }> -> { getId: () => number }
\`\`\`

That \`as\` clause is key remapping, and the backtick form is a **template literal type**. \`Capitalize\`, \`Uppercase\`, \`Lowercase\` and \`Uncapitalize\` are built in.

Conditional types complete the toolkit:

\`\`\`ts
type Unwrap<T> = T extends Promise<infer U> ? U : T;
type A = Unwrap<Promise<string>>; // string
type B = Unwrap<number>;          // number
\`\`\`

\`infer\` declares a type variable to be filled in by the match. This is exactly how \`ReturnType\` and \`Awaited\` are implemented.

## Declaration files

A \`.d.ts\` file contains types and no runtime code. You meet them in three situations.

**1. Consuming an untyped package.** First try \`npm i -D @types/thepackage\` (the DefinitelyTyped registry). If none exists, write a stub:

\`\`\`ts
// types/legacy-analytics.d.ts
declare module 'legacy-analytics' {
  export interface TrackOptions { userId?: string; ts?: number }
  export function track(event: string, options?: TrackOptions): void;
  const _default: { track: typeof track };
  export default _default;
}
\`\`\`

**2. Describing globals and non-JS imports.**

\`\`\`ts
// env.d.ts
declare global {
  interface Window { __APP_VERSION__: string }
}

declare module '*.svg' {
  const src: string;
  export default src;
}

interface ImportMetaEnv { readonly VITE_API_URL: string }
interface ImportMeta { readonly env: ImportMetaEnv }

export {}; // makes this a module so 'declare global' is legal
\`\`\`

That trailing \`export {}\` is required more often than you would guess: a \`.d.ts\` with no top-level import/export is a *script*, and its declarations are already global — which makes \`declare global\` an error.

**3. Publishing a library.** Set \`"declaration": true\` (or let your bundler emit them) and point \`package.json\` at the output:

\`\`\`json
{
  "name": "@ninja/utils",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist"]
}
\`\`\`

The \`"types"\` condition must come **first** in each exports entry — resolution is order-sensitive, and putting it after \`"import"\` is a common reason consumers see \`any\`.

## Type-only imports

\`\`\`ts
import type { User } from './models';   // erased entirely at compile time
import { type User, createUser } from './models'; // inline form
\`\`\`

With \`verbatimModuleSyntax\` (or \`isolatedModules\`), this is not stylistic — single-file transpilers like esbuild and SWC compile each file in isolation and cannot tell whether \`User\` is a type or a value. Marking it \`type\` tells them to drop the import instead of emitting a runtime require for a module with no runtime export.`,
    },
    {
      slug: 'git-in-practice',
      title: 'Git in Practice — Branching, Rebase, Conflicts & PRs',
      estimatedMinutes: 90,
      body: `# Git in Practice

Git is a content-addressed database with a confusing UI. Three objects explain almost everything: a **blob** (file contents), a **tree** (a directory listing of blobs and trees), and a **commit** (a tree, a parent pointer, an author and a message). A branch is a movable pointer to a commit. \`HEAD\` is a pointer to the branch you are on. That is the entire model.

## The three areas

\`\`\`
working tree  --git add-->  index (staging)  --git commit-->  repository
\`\`\`

\`\`\`bash
git status -sb          # short status + branch/tracking info
git diff                # working tree vs index  (what you have NOT staged)
git diff --staged       # index vs HEAD          (what WILL be committed)
git restore <file>      # discard unstaged changes to a file
git restore --staged <file>  # unstage, keep the edit
\`\`\`

\`git diff\` showing nothing after you edited a file means you already staged it. That confusion accounts for a large fraction of "git is broken" reports.

## Branching

\`\`\`bash
git switch -c feat/checkout-coupons   # create + switch (modern; 'checkout -b' still works)
git switch -                          # back to the previous branch
git branch -vv                        # local branches + upstream + ahead/behind
git push -u origin feat/checkout-coupons
\`\`\`

Trunk-based development is the mainstream default: short-lived branches off \`main\`, merged within a day or two, behind a feature flag if incomplete. Long-lived branches are where merge pain is manufactured.

## Merge vs rebase

Both integrate work. They differ in what they do to history.

\`\`\`bash
git merge main    # creates a merge commit; history is a graph, nothing is rewritten
git rebase main   # replays YOUR commits on top of main; new SHAs, linear history
\`\`\`

| | Merge | Rebase |
| --- | --- | --- |
| History shape | graph, with merge commits | straight line |
| Original commits preserved | yes | no — rewritten with new SHAs |
| Conflicts | once, in the merge commit | potentially once *per replayed commit* |
| Safe on a shared branch | yes | **no** |
| \`git bisect\` / \`blame\` | noisier | cleaner |

**The golden rule: never rebase a branch that someone else has pulled.** Rebasing rewrites commits; anyone who already has the old ones now has a divergent history and will "fix" it with a merge that duplicates every commit.

The workflow most teams settle on:

1. Rebase your *own* feature branch onto \`main\` to stay current: \`git pull --rebase origin main\`.
2. Merge the finished branch into \`main\` via a PR — squash or merge commit, per team policy.

Set the sane default once: \`git config --global pull.rebase true\`.

## Interactive staging — commit less than you changed

You fixed a bug and reformatted three functions. Those are two commits.

\`\`\`bash
git add -p            # hunk by hunk: y / n / s (split) / e (edit the hunk) / q
git restore -p        # same interface for discarding
git stash push -p     # stash only some hunks
\`\`\`

\`git add -p\` is the single highest-leverage git command for review quality. A reviewer reading "fix off-by-one in pagination" wants to see three lines, not a 400-line diff with a fix buried in it.

To rewrite your own unpushed history:

\`\`\`bash
git commit --amend --no-edit          # fold staged changes into the last commit
git rebase -i HEAD~5                  # pick / reword / squash / fixup / drop / edit
git commit --fixup <sha> && git rebase -i --autosquash main
\`\`\`

\`--fixup\` plus \`--autosquash\` is how you address review comments without a trail of "address feedback" commits: each fix is tagged to the commit it belongs to and folded in automatically.

## Resolving a conflict

\`\`\`
<<<<<<< HEAD            (during merge: your branch; during REBASE: the branch you are replaying ONTO)
const timeout = 5000;
=======
const timeout = 15000;
>>>>>>> feat/slow-api   (the commit being applied)
\`\`\`

The reversal during a rebase catches everyone. Remember it as: \`ours\` is always "the side already in place", and in a rebase that is \`main\`, not your work.

\`\`\`bash
git status                     # lists 'both modified' files
# edit each file, remove ALL conflict markers
git add <file>
git rebase --continue          # or: git merge --continue
git rebase --abort             # bail out entirely, nothing lost
\`\`\`

Two force multipliers:

\`\`\`bash
git config --global merge.conflictstyle zdiff3   # shows the ORIGINAL text too, not just both sides
git config --global rerere.enabled true          # remembers a resolution and replays it next time
\`\`\`

\`zdiff3\` adds a \`|||||||\` section with the common ancestor, which turns "which of these two is right?" into "what did each side actually change?". \`rerere\` pays for itself the first time you rebase a long branch twice.

And the safety net nobody teaches early enough:

\`\`\`bash
git reflog                     # every position HEAD has held, for ~90 days
git reset --hard HEAD@{3}      # go back to before you broke everything
\`\`\`

Almost nothing committed to git is ever truly lost. \`reflog\` is the undo button.

## Conventional commits

\`\`\`
<type>(<optional scope>)<optional !>: <description>

feat(auth): add refresh token rotation
fix(cart): prevent negative quantities on manual input
docs(readme): document the pnpm workspace layout
refactor(api)!: drop the deprecated /v1 endpoints

BREAKING CHANGE: /v1 routes now return 410 Gone.
\`\`\`

Types: \`feat\`, \`fix\`, \`docs\`, \`style\`, \`refactor\`, \`perf\`, \`test\`, \`build\`, \`ci\`, \`chore\`, \`revert\`. This is not bureaucracy — tools such as \`semantic-release\` and \`changesets\` read it to decide the next version number and generate the changelog. \`fix\` bumps patch, \`feat\` bumps minor, \`!\` or a \`BREAKING CHANGE\` footer bumps major.

Write the description in the imperative — "add", not "added" — so it completes the sentence "if applied, this commit will…".

## The PR workflow

1. Branch from an up-to-date \`main\`.
2. Small commits, each one green.
3. \`git pull --rebase origin main\` before pushing.
4. Open the PR: **what** changed, **why**, how to test, screenshots for UI.
5. CI runs typecheck, lint, tests.
6. Address feedback with \`--fixup\` commits.
7. Squash-merge (one clean commit on \`main\`) or merge-commit, per policy.
8. Delete the branch.

> Keep PRs under ~400 lines of diff. Review quality falls off a cliff past that, and a 2000-line PR gets "LGTM" rather than a review.`,
    },
    {
      slug: 'packages-bundlers-linting',
      title: 'npm, Semver, Vite & the Lint/Format Layer',
      estimatedMinutes: 85,
      body: `# npm, Semver, Vite & the Lint/Format Layer

## Semantic versioning

\`MAJOR.MINOR.PATCH\` — breaking, feature, fix. The contract is one sentence: **you may take a MINOR or PATCH upgrade without reading the changelog; you may not take a MAJOR.**

Ranges in \`package.json\` express how much drift you accept:

| Range | Matches | Notes |
| --- | --- | --- |
| \`1.2.3\` | exactly 1.2.3 | pinned |
| \`~1.2.3\` | >=1.2.3 <1.3.0 | patches only |
| \`^1.2.3\` | >=1.2.3 <2.0.0 | the npm default |
| \`^0.2.3\` | >=0.2.3 <0.3.0 | **caret on 0.x only allows patch** |
| \`^0.0.3\` | >=0.0.3 <0.0.4 | effectively pinned |
| \`*\` | anything | never do this |

The 0.x rule exists because pre-1.0 packages treat the minor as their major. Prerelease tags (\`1.0.0-beta.2\`) sort *before* the release, and are never matched by a plain range unless you ask for them.

## Lockfiles

\`package.json\` says what you want. \`package-lock.json\` / \`pnpm-lock.yaml\` says what you got — exact versions, resolved URLs and integrity hashes for the **entire** transitive tree.

\`\`\`bash
npm install    # may UPDATE the lockfile to satisfy package.json
npm ci         # installs exactly the lockfile; fails if it disagrees. Use in CI.
\`\`\`

Commit the lockfile. Always, including for libraries — it does not affect your consumers (their resolver ignores it) and it makes your own CI reproducible. Deleting it "to fix a weird error" throws away the only record of a known-good tree.

## npm vs pnpm vs yarn

npm hoists a flat \`node_modules\`, which means your code can \`import\` a package you never declared, because it happens to be a dependency of a dependency. That works until the day the intermediate package drops it.

pnpm stores every version once in a global content-addressable store and builds \`node_modules\` from symlinks, with only your declared dependencies at the top level. You get strict resolution and dramatically less disk and install time. Yarn Berry solves the same problem differently, with Plug'n'Play.

For a monorepo, pnpm is the pragmatic default in 2026. For a single app, npm is fine.

## Workspaces

\`\`\`json
// package.json (repo root)
{
  "name": "codeninja",
  "private": true,
  "workspaces": ["apps/*", "packages/*"]
}
\`\`\`

\`\`\`yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
\`\`\`

Now \`packages/content\` can be depended on by \`apps/web\` as \`"@codeninja/content": "workspace:*"\`, and the package manager symlinks it instead of downloading. One install, one lockfile, cross-package refactors in a single commit.

\`\`\`bash
pnpm --filter @codeninja/web dev
pnpm -r build                 # every package, in dependency order
npm run build --workspaces
\`\`\`

## ESM, CJS and why builds still hurt

\`\`\`js
// ESM — static, analysable, tree-shakeable
import { chunk } from './utils.js';
export const VERSION = '1.0.0';

// CommonJS — dynamic, runtime resolution, not statically analysable
const { chunk } = require('./utils');
module.exports = { VERSION: '1.0.0' };
\`\`\`

ESM imports are hoisted and resolved before any code runs, which is exactly what lets a bundler prove a function is unused and drop it (**tree shaking**). \`require\` can be called conditionally inside a function, so it cannot.

Set \`"type": "module"\` in \`package.json\` and \`.js\` files are ESM. The rough edges: \`__dirname\` does not exist (use \`import.meta.url\`), and importing CJS from ESM gives you the default export only.

## Vite

Vite is two tools sharing a config.

**In dev**, it does not bundle. It serves your source over native ESM and transforms each module on request with esbuild (Go, ~20× faster than tsc). Startup is O(1) in project size, and HMR only re-runs the module you touched. Dependencies are pre-bundled once with esbuild so 400 lodash files become one request.

**In production**, it bundles with Rollup — code splitting, tree shaking, asset hashing, CSS extraction.

\`\`\`js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  build: { sourcemap: true, target: 'es2022' },
});
\`\`\`

Two things to know:

- **\`import.meta.env\`** replaces \`process.env\`. Only variables prefixed \`VITE_\` are exposed to client code — everything else is stripped, so you cannot leak a secret by accident. There is no runtime env: values are inlined at build time.
- **Vite does not type-check.** esbuild strips types without validating them. Your \`build\` script must be \`tsc --noEmit && vite build\`, or type errors reach production.

## ESLint and Prettier

They do different jobs. **ESLint finds bugs** (unused variables, missing \`await\`, a hook called conditionally). **Prettier settles formatting** so nobody argues about it in review.

ESLint 9 uses flat config:

\`\`\`js
// eslint.config.js
import js from '@eslint/js';
import ts from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { ignores: ['dist/**', 'coverage/**'] },
  prettier, // MUST be last: turns off every formatting rule
);
\`\`\`

\`eslint-config-prettier\` goes last and disables ESLint's stylistic rules. Without it the two tools fight: ESLint reformats, Prettier reformats back, and your pre-commit hook loops.

Type-aware rules (\`recommendedTypeChecked\`) need real type information, so they are slower — but they are the only way to catch a floating promise, which is one of the most common production bugs in JS.

Wire it to the commit:

\`\`\`json
{
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "build": "npm run typecheck && vite build"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
\`\`\`

> Run the same commands in CI that you run locally. A hook can be skipped with \`--no-verify\`; CI cannot.`,
    },
  ],
  quiz: [
    {
      prompt: 'Why can a TypeScript `interface` not validate a JSON response at runtime?',
      options: [
        'Because interfaces only work on classes',
        'Because types are erased at compile time — the emitted JavaScript contains no type information',
        'Because JSON.parse returns a string',
        'Because interfaces need the `declare` keyword to be active',
      ],
      correctIndex: 1,
      explanation:
        'TypeScript is erasable syntax: `tsc`/esbuild strip types and emit plain JS. Runtime validation needs runtime code — a hand-written type predicate or a schema library like Zod.',
      difficulty: 'EASY',
    },
    {
      prompt: 'What is the main advantage of a discriminated union over `{ loading: boolean; data?: T; error?: string }`?',
      options: [
        'It compiles to smaller JavaScript',
        'It allows optional properties to be omitted',
        'It makes illegal states unrepresentable and lets the compiler narrow each branch',
        'It removes the need for a switch statement',
      ],
      correctIndex: 2,
      explanation:
        'The optional-flag shape has eight possible combinations, most of them nonsense. A union on a literal `status` field permits only the three real states, and narrowing gives you exactly the fields that exist in each one.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What does the signature `function isUser(v: unknown): v is User` give you?',
      options: [
        'A runtime guarantee that `v` is a User',
        'A type predicate: when it returns true, the compiler narrows `v` to `User` in that branch',
        'Automatic validation generated by the compiler',
        'An error unless `User` is a class',
      ],
      correctIndex: 1,
      explanation:
        'It is a promise you make to the compiler, not a check the compiler performs. If the body is wrong, TypeScript still narrows and you get a runtime crash with a passing build.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which npm range allows `1.9.4` but not `2.0.0`?',
      options: ['~1.2.3', '^1.2.3', '1.2.3', '^0.2.3'],
      correctIndex: 1,
      explanation:
        '`^1.2.3` means >=1.2.3 <2.0.0. `~1.2.3` stops at 1.3.0, `1.2.3` is pinned, and `^0.2.3` only allows patches because caret treats the minor as the major on 0.x releases.',
      difficulty: 'EASY',
    },
    {
      prompt: 'What is the difference between `npm install` and `npm ci`?',
      options: [
        '`npm ci` is just an alias for `npm install --production`',
        '`npm ci` skips devDependencies',
        '`npm install` may update the lockfile to satisfy package.json; `npm ci` installs the lockfile exactly and fails if they disagree',
        'There is no difference on modern npm',
      ],
      correctIndex: 2,
      explanation:
        '`npm ci` deletes node_modules and installs the resolved tree verbatim, which is what makes CI builds reproducible. `npm install` is allowed to resolve new versions inside your ranges.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'You have pushed `feat/checkout` and a colleague has pulled it. Why should you not rebase it now?',
      options: [
        'Rebase would delete the remote branch',
        'Rebase rewrites commits into new SHAs, so their history diverges and merging back duplicates every commit',
        'Rebase only works on the main branch',
        'Rebase cannot handle more than one author',
      ],
      correctIndex: 1,
      explanation:
        'Rebasing replays commits as new objects. Anyone holding the old SHAs now has a divergent branch, and reconciling it usually produces duplicate commits. Rebase your own unshared work; merge shared work.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'During a `git rebase main`, which side does `<<<<<<< HEAD` refer to?',
      options: [
        'The commits from the branch you are replaying onto (main)',
        'Always the branch you started the command from',
        'The most recently authored commit, whichever branch it is on',
        'The merge base of the two branches',
      ],
      correctIndex: 0,
      explanation:
        'A rebase replays your commits one at a time on top of the target, so "ours"/HEAD is the already-applied side — main — and the incoming side is your own commit. This inversion is the opposite of a merge.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Why must `eslint-config-prettier` be the last entry in an ESLint config?',
      options: [
        'It loads the Prettier binary and must run after linting',
        'It only registers the `prettier/prettier` rule',
        'It defines the parser for TypeScript files',
        'It turns off ESLint’s formatting rules, so it must override anything enabled earlier',
      ],
      correctIndex: 3,
      explanation:
        'Later config objects win in flat config. Placed last, it disables every stylistic rule that would otherwise conflict with Prettier — which is what stops the two tools from reformatting each other in a loop.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'type-guard-config-parser',
      title: 'A Type-Guard-Driven Config Parser',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `You are typing the boundary of an application. The TypeScript side declares:

\`\`\`ts
interface AppConfig {
  name: string;      // required, non-empty
  port: number;      // required, integer 1..65535
  debug: boolean;    // optional, defaults to false
  tags: string[];    // optional, defaults to []
}

type ParseResult =
  | { ok: true; value: AppConfig }
  | { ok: false; errors: string[] };
\`\`\`

Types are erased at runtime, so implement the checks in plain JavaScript.

### Export

- \`isRecord(value)\` — \`true\` only for a non-null, non-array object.
- \`parseConfig(raw)\` — returns a \`ParseResult\`.

### Rules

If \`raw\` is not a record, return \`{ ok: false, errors: ['config: expected object'] }\` immediately.

Otherwise collect errors **in field order** — \`name\`, \`port\`, \`debug\`, \`tags\` — using these exact messages:

| Condition | Message |
| --- | --- |
| \`name\` is \`undefined\` | \`name: required\` |
| \`name\` present but not a non-empty string | \`name: expected non-empty string\` |
| \`port\` is \`undefined\` | \`port: required\` |
| \`port\` present but not an integer in 1..65535 | \`port: expected integer between 1 and 65535\` |
| \`debug\` present and not a boolean | \`debug: expected boolean\` |
| \`tags\` present and not an array of strings | \`tags: expected string[]\` |

If there are no errors, return \`{ ok: true, value }\` where \`value\` has **exactly** the four keys, \`name\` is trimmed, \`debug\` defaults to \`false\` and \`tags\` defaults to \`[]\`. Unknown keys on the input are dropped.

### Examples

\`\`\`js
parseConfig({ name: 'api', port: 3000 });
// { ok: true, value: { name: 'api', port: 3000, debug: false, tags: [] } }

parseConfig({});
// { ok: false, errors: ['name: required', 'port: required'] }

parseConfig('nope');
// { ok: false, errors: ['config: expected object'] }
\`\`\``,
      starterCode: `function isRecord(value) {
  // non-null object that is not an array
}

function parseConfig(raw) {
  // 1. reject non-records
  // 2. collect errors in field order
  // 3. return { ok: true, value } with defaults applied
}

module.exports = { isRecord, parseConfig };`,
      solutionCode: `function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPort(value) {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 65535
  );
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseConfig(raw) {
  if (!isRecord(raw)) {
    return { ok: false, errors: ['config: expected object'] };
  }

  const errors = [];

  if (raw.name === undefined) {
    errors.push('name: required');
  } else if (!isNonEmptyString(raw.name)) {
    errors.push('name: expected non-empty string');
  }

  if (raw.port === undefined) {
    errors.push('port: required');
  } else if (!isPort(raw.port)) {
    errors.push('port: expected integer between 1 and 65535');
  }

  if (raw.debug !== undefined && typeof raw.debug !== 'boolean') {
    errors.push('debug: expected boolean');
  }

  if (raw.tags !== undefined && !isStringArray(raw.tags)) {
    errors.push('tags: expected string[]');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name: raw.name.trim(),
      port: raw.port,
      debug: raw.debug === undefined ? false : raw.debug,
      tags: raw.tags === undefined ? [] : raw.tags.slice(),
    },
  };
}

module.exports = { isRecord, parseConfig };`,
      hints: [
        'typeof null === "object" and typeof [] === "object" — isRecord has to exclude both.',
        'Distinguish "missing" (=== undefined) from "present but wrong type". They produce different messages.',
        'Number.isInteger(8080.5) is false, which is exactly the check the port rule needs.',
        'Build the value object literally with the four keys so unknown input keys are dropped for free.',
      ],
      tests: [
        {
          name: 'isRecord rejects null and arrays',
          assertion:
            'solution.isRecord({}) === true && solution.isRecord([]) === false && solution.isRecord(null) === false',
        },
        {
          name: 'applies defaults for debug and tags',
          assertion:
            "deepEqual(solution.parseConfig({ name: 'api', port: 3000 }), { ok: true, value: { name: 'api', port: 3000, debug: false, tags: [] } })",
        },
        {
          name: 'keeps supplied optional values',
          assertion:
            "deepEqual(solution.parseConfig({ name: 'api', port: 80, debug: true, tags: ['a', 'b'] }).value, { name: 'api', port: 80, debug: true, tags: ['a', 'b'] })",
        },
        {
          name: 'reports missing required fields in order',
          assertion:
            "deepEqual(solution.parseConfig({}).errors, ['name: required', 'port: required'])",
        },
        {
          name: 'distinguishes wrong type from missing',
          assertion:
            "deepEqual(solution.parseConfig({ name: '', port: 0 }).errors, ['name: expected non-empty string', 'port: expected integer between 1 and 65535'])",
        },
        {
          name: 'rejects a non-record root',
          assertion:
            "deepEqual(solution.parseConfig('nope'), { ok: false, errors: ['config: expected object'] }) && solution.parseConfig([1, 2]).ok === false",
        },
        {
          name: 'validates optional fields when present',
          assertion:
            "deepEqual(solution.parseConfig({ name: 'api', port: 8080, debug: 'yes' }).errors, ['debug: expected boolean']) && deepEqual(solution.parseConfig({ name: 'api', port: 8080, tags: ['a', 2] }).errors, ['tags: expected string[]'])",
          hidden: true,
        },
        {
          name: 'rejects non-integer ports and trims the name',
          assertion:
            "solution.parseConfig({ name: 'api', port: 8080.5 }).ok === false && solution.parseConfig({ name: '  api  ', port: 1 }).value.name === 'api'",
          hidden: true,
        },
        {
          name: 'drops unknown keys from the parsed value',
          assertion:
            "deepEqual(Object.keys(solution.parseConfig({ name: 'api', port: 1, extra: 9 }).value).sort(), ['debug', 'name', 'port', 'tags'])",
          hidden: true,
        },
      ],
      xp: 70,
    },
    {
      slug: 'semver-resolver',
      title: 'Implement a Semver Resolver',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Package managers do this on every install. Build a small version of it.

### Export

**\`parseVersion(input)\`** — parse \`MAJOR.MINOR.PATCH\` with an optional \`-prerelease\` suffix into
\`{ major, minor, patch, prerelease }\`. \`prerelease\` is the raw string after the hyphen, or \`null\`.
Return \`null\` for anything that does not match (including \`'1.2'\` and \`'v1.2.3'\`).

**\`compareVersions(a, b)\`** — return \`-1\`, \`0\` or \`1\`. Throw a \`TypeError\` if either input is unparseable.
Ordering rules:

1. Compare \`major\`, then \`minor\`, then \`patch\` numerically.
2. A version **with** a prerelease sorts **before** the same version without one: \`1.0.0-alpha < 1.0.0\`.
3. Compare prerelease identifiers dot-segment by dot-segment. Numeric segments compare numerically
   (\`alpha.2 < alpha.10\`), numeric sorts before non-numeric, and a shorter prefix sorts first
   (\`1.0.0-alpha < 1.0.0-alpha.1\`).

**\`satisfiesCaret(range, version)\`** — \`true\` when \`version\` satisfies a caret range.
\`^1.2.3\` means \`>=1.2.3 <2.0.0\`; \`^0.2.3\` means \`>=0.2.3 <0.3.0\`; \`^0.0.3\` means \`>=0.0.3 <0.0.4\`.
Return \`false\` for a non-caret range, an unparseable input, or a version carrying a prerelease.

**\`maxSatisfying(versions, range)\`** — the highest version in the array that satisfies the range, or \`null\`.

### Examples

\`\`\`js
compareVersions('1.2.3', '1.10.0');       // -1
compareVersions('1.0.0-alpha', '1.0.0');  // -1
satisfiesCaret('^0.2.3', '0.3.0');        // false
maxSatisfying(['1.2.3', '1.4.0', '2.0.0'], '^1.2.3'); // '1.4.0'
\`\`\``,
      starterCode: `function parseVersion(input) {
  // return { major, minor, patch, prerelease } or null
}

function compareVersions(a, b) {
  // -1 | 0 | 1, throws TypeError on bad input
}

function satisfiesCaret(range, version) {
  // '^1.2.3' style ranges only
}

function maxSatisfying(versions, range) {
  // highest satisfying version, or null
}

module.exports = { parseVersion, compareVersions, satisfiesCaret, maxSatisfying };`,
      solutionCode: `const SEMVER = /^(\\d+)\\.(\\d+)\\.(\\d+)(?:-([0-9A-Za-z.-]+))?$/;
const NUMERIC = /^\\d+$/;

function parseVersion(input) {
  if (typeof input !== 'string') return null;
  const match = SEMVER.exec(input.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] === undefined ? null : match[4],
  };
}

function cmpNumber(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function cmpPrerelease(a, b) {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // no prerelease outranks a prerelease
  if (b === null) return -1;

  const left = a.split('.');
  const right = b.split('.');
  const len = Math.max(left.length, right.length);

  for (let i = 0; i < len; i++) {
    const x = left[i];
    const y = right[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;

    const xNum = NUMERIC.test(x);
    const yNum = NUMERIC.test(y);

    if (xNum && yNum) {
      const c = cmpNumber(Number(x), Number(y));
      if (c !== 0) return c;
    } else if (xNum) {
      return -1;
    } else if (yNum) {
      return 1;
    } else {
      const c = cmpNumber(x, y);
      if (c !== 0) return c;
    }
  }

  return 0;
}

function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) throw new TypeError('Invalid version');

  return (
    cmpNumber(left.major, right.major) ||
    cmpNumber(left.minor, right.minor) ||
    cmpNumber(left.patch, right.patch) ||
    cmpPrerelease(left.prerelease, right.prerelease)
  );
}

function satisfiesCaret(range, version) {
  if (typeof range !== 'string' || range[0] !== '^') return false;

  const baseText = range.slice(1);
  const base = parseVersion(baseText);
  const target = parseVersion(version);
  if (!base || !target) return false;
  if (target.prerelease !== null) return false;

  if (compareVersions(version, baseText) < 0) return false;

  if (base.major > 0) return target.major === base.major;
  if (base.minor > 0) return target.major === 0 && target.minor === base.minor;
  return target.major === 0 && target.minor === 0 && target.patch === base.patch;
}

function maxSatisfying(versions, range) {
  if (!Array.isArray(versions)) return null;
  const matches = versions.filter((v) => satisfiesCaret(range, v));
  if (matches.length === 0) return null;
  return matches.reduce((best, v) => (compareVersions(v, best) > 0 ? v : best));
}

module.exports = { parseVersion, compareVersions, satisfiesCaret, maxSatisfying };`,
      hints: [
        'Anchor the regex with ^ and $ so "1.2" and "v1.2.3" both fail.',
        'Chain the numeric comparisons with || — 0 is falsy, so the first non-zero result wins.',
        'For the prerelease rule, handle the null cases first: null (no prerelease) is the LARGER side.',
        'A shorter prerelease is a prefix of the longer one, so run out of segments means "sorts first".',
        'The caret rule for 0.x is not a special case in the range text — it depends on which leading component is non-zero.',
      ],
      tests: [
        {
          name: 'parses a plain version',
          assertion:
            "deepEqual(solution.parseVersion('1.2.3'), { major: 1, minor: 2, patch: 3, prerelease: null })",
        },
        {
          name: 'parses a prerelease and rejects malformed input',
          assertion:
            "deepEqual(solution.parseVersion('2.0.0-rc.1'), { major: 2, minor: 0, patch: 0, prerelease: 'rc.1' }) && solution.parseVersion('1.2') === null && solution.parseVersion('v1.2.3') === null",
        },
        {
          name: 'compares numerically, not lexically',
          assertion:
            "solution.compareVersions('1.2.3', '1.10.0') === -1 && solution.compareVersions('2.0.0', '2.0.0') === 0 && solution.compareVersions('1.0.1', '1.0.0') === 1",
        },
        {
          name: 'a prerelease sorts before its release',
          assertion:
            "solution.compareVersions('1.0.0-alpha', '1.0.0') === -1 && solution.compareVersions('1.0.0', '1.0.0-alpha') === 1",
        },
        {
          name: 'orders prerelease identifiers correctly',
          assertion:
            "solution.compareVersions('1.0.0-alpha.2', '1.0.0-alpha.10') === -1 && solution.compareVersions('1.0.0-alpha', '1.0.0-alpha.1') === -1 && solution.compareVersions('1.0.0-alpha', '1.0.0-beta') === -1",
        },
        {
          name: 'throws on an unparseable version',
          assertion: "throws(() => solution.compareVersions('nope', '1.0.0'))",
        },
        {
          name: 'caret on 1.x allows minor and patch but not major',
          assertion:
            "solution.satisfiesCaret('^1.2.3', '1.9.0') === true && solution.satisfiesCaret('^1.2.3', '1.2.3') === true && solution.satisfiesCaret('^1.2.3', '1.2.2') === false && solution.satisfiesCaret('^1.2.3', '2.0.0') === false",
        },
        {
          name: 'caret on 0.x is narrower',
          assertion:
            "solution.satisfiesCaret('^0.2.3', '0.2.9') === true && solution.satisfiesCaret('^0.2.3', '0.3.0') === false && solution.satisfiesCaret('^0.0.3', '0.0.3') === true && solution.satisfiesCaret('^0.0.3', '0.0.4') === false",
          hidden: true,
        },
        {
          name: 'prereleases and non-caret ranges never satisfy',
          assertion:
            "solution.satisfiesCaret('^1.2.3', '1.5.0-beta.1') === false && solution.satisfiesCaret('~1.2.3', '1.2.4') === false",
          hidden: true,
        },
        {
          name: 'maxSatisfying picks the highest match',
          assertion:
            "solution.maxSatisfying(['1.2.3', '1.4.0', '2.0.0', '1.4.0-beta.1'], '^1.2.3') === '1.4.0' && solution.maxSatisfying(['2.0.0'], '^1.0.0') === null",
          hidden: true,
        },
      ],
      xp: 90,
    },
  ],
  flashcards: [
    {
      front: 'What does "TypeScript types are erased" mean in practice?',
      back: 'The compiler strips all type syntax and emits plain JS. Types cannot validate a fetch response, user input or env vars — that needs runtime code (a type predicate or Zod). It is also why `import type` matters: single-file transpilers cannot tell a type from a value.',
      tags: ['typescript', 'fundamentals'],
    },
    {
      front: '`unknown` vs `any`',
      back: '`any` disables checking and spreads to everything it touches. `unknown` accepts any value but forces you to narrow before use. Type the boundary as `unknown`.',
      tags: ['typescript', 'safety'],
    },
    {
      front: 'Why is a discriminated union better than optional flags?',
      back: '`{ status: "loading" } | { status: "success"; data: T }` permits only the real states and narrows per branch. `{ loading: boolean; data?: T; error?: string }` permits eight combinations, most of them impossible.',
      tags: ['typescript', 'modelling'],
    },
    {
      front: 'What is a type predicate, and what is its risk?',
      back: '`(v: unknown): v is User` narrows in the true branch. The compiler does not verify the body — a wrong predicate gives you a runtime crash with a green build.',
      tags: ['typescript', 'narrowing'],
    },
    {
      front: '`Omit<T, K>` vs `Pick<T, K>` — the trap',
      back: '`Pick` validates that K exists on T. `Omit` does not: `Omit<User, "emial">` compiles and omits nothing. Prefer `Pick` where you can.',
      tags: ['typescript', 'utility-types'],
    },
    {
      front: 'Merge vs rebase in one line each',
      back: 'Merge preserves history and adds a merge commit. Rebase replays your commits onto the target with new SHAs for a linear history — never on a branch anyone else has pulled.',
      tags: ['git', 'workflow'],
    },
    {
      front: 'What is `git add -p` for?',
      back: 'Staging hunk by hunk, so one commit contains one logical change. It is the highest-leverage command for making your PRs reviewable.',
      tags: ['git', 'workflow'],
    },
    {
      front: 'During a rebase, which side is `HEAD` in a conflict?',
      back: 'The branch you are replaying **onto** (usually main) — the reverse of a merge. "Ours" is always the side already applied.',
      tags: ['git', 'conflicts'],
    },
    {
      front: 'You reset --hard and lost a commit. Now what?',
      back: '`git reflog` lists every position HEAD has held for ~90 days; `git reset --hard HEAD@{n}` restores it. Committed work is almost never really lost.',
      tags: ['git', 'recovery'],
    },
    {
      front: 'Why does `^0.2.3` not allow `0.3.0`?',
      back: 'Pre-1.0 packages treat the minor as their major, so caret only permits patch bumps on 0.x. `^0.0.3` is effectively pinned to 0.0.3.',
      tags: ['npm', 'semver'],
    },
    {
      front: '`npm install` vs `npm ci`',
      back: '`install` may resolve new versions and rewrite the lockfile. `ci` wipes node_modules and installs the lockfile exactly, failing if it disagrees with package.json. Use `ci` in pipelines.',
      tags: ['npm', 'ci'],
    },
    {
      front: 'What does Vite NOT do that you must add yourself?',
      back: 'Type checking. esbuild strips types without validating them, so your build script needs `tsc --noEmit && vite build` or type errors ship.',
      tags: ['vite', 'build'],
    },
  ],
  resources: [
    { label: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/handbook/intro.html', kind: 'DOCS' },
    { label: 'TSConfig Reference', url: 'https://www.typescriptlang.org/tsconfig', kind: 'DOCS' },
    { label: 'Pro Git (free book)', url: 'https://git-scm.com/book/en/v2', kind: 'DOCS' },
    { label: 'Conventional Commits 1.0.0', url: 'https://www.conventionalcommits.org/en/v1.0.0/', kind: 'SPEC' },
    { label: 'Vite — Guide', url: 'https://vite.dev/guide/', kind: 'DOCS' },
  ],
};

export default day;
