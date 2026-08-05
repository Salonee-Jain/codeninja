import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 10,
  week: 2,
  pillar: 'FRONTEND',
  title: 'State Management: Redux Toolkit, Zustand & Pinia',
  summary: 'Three answers to shared state — and the judgement to know when you need none of them.',
  estimatedMinutes: 360,
  objectives: [
    'Explain the flux / unidirectional data-flow model and the three Redux principles',
    'Configure a store with configureStore and write feature logic with createSlice',
    'Use Immer draft mutation correctly and know the four ways people silently break it',
    'Model async work with createAsyncThunk, normalise with createEntityAdapter and derive with memoised selectors',
    'Fetch, cache and invalidate server data with RTK Query tags instead of hand-rolled thunks',
    'Build a Zustand store, subscribe with selectors and compose persist / devtools / immer middleware',
    'Write a Pinia store for Vue in both options and setup style',
    'Choose between Redux Toolkit, Zustand, Pinia, Context and a server cache for a given problem',
  ],
  technologies: ['Redux Toolkit', 'RTK Query', 'Zustand', 'Pinia'],
  lessons: [
    {
      slug: 'flux-createslice-immer',
      title: 'Flux, createSlice and the Immer Draft',
      estimatedMinutes: 95,
      body: `# Flux, createSlice and the Immer Draft

## The problem Redux was invented to solve

In 2014 Facebook described a bug they could not reason about: a notification badge that would not clear. Several views could each write to several models, and each model back to several views — an *n x m* mesh of mutations, with nowhere to stand and ask "why is the state like this?"

**Flux** answered with a one-way street: \`Action -> Dispatcher -> Store -> View\`, and the view can only dispatch more actions. A view never writes to a store; it *describes what happened*, and the store decides what that means. Redux is Flux with the dispatcher deleted and a single store, resting on three rules:

1. **Single source of truth** — one plain-object state tree for the whole app.
2. **State is read-only** — the only way to change it is to dispatch an action.
3. **Changes are made by pure functions** — reducers, \`(state, action) => newState\`, with no I/O, no randomness, no mutation.

Those rules buy time-travel debugging, action replay, testable logic and server-rendered hydration. Every constraint in Redux exists to pay for one of them.

## The vocabulary, precisely

- An **action** is a plain object with a required \`type\`: \`{ type: 'cart/itemAdded', payload: { id: 7 } }\`. It is a *fact that happened*, not a command — name it in the past tense.
- A **reducer** folds an action into state. Redux literally reduces over the stream of actions.
- The **store** holds state and exposes \`getState()\`, \`dispatch(action)\` and \`subscribe(listener)\`.
- A **selector** is \`state => derived\`, keeping components ignorant of the shape.

A reducer receiving an action it does not handle must return the **same reference**, not a copy — otherwise every connected component re-renders.

## What hand-written Redux cost

Classic Redux was correct but expensive: one counter meant four files — action types, action creators, a \`switch\`-based reducer, and store wiring.

| Pain | RTK answer |
| --- | --- |
| Constants + creators + reducer per behaviour | \`createSlice\` generates all three |
| Deep spread updates | Immer lets you write \`state.a.b.push(x)\` |
| Store setup ceremony | \`configureStore\` wires thunk + DevTools + checks |
| Accidental mutation in production | dev-only immutability and serializability checks |

**Redux Toolkit is the official way to write Redux.** A tutorial showing \`createStore\` and \`switch\` statements is describing 2016.

## configureStore

\`\`\`js
import { configureStore } from '@reduxjs/toolkit';
import cartReducer from './features/cart/cartSlice';
import authReducer from './features/auth/authSlice';

export const store = configureStore({
  reducer: { cart: cartReducer, auth: authReducer },
  middleware: (getDefault) =>
    getDefault({ serializableCheck: { ignoredActions: ['app/fileDropped'] } }),
});
\`\`\`

Passing an object to \`reducer\` calls \`combineReducers\`, so each key becomes a slice name. It also adds redux-thunk, wires DevTools, and adds dev-only **immutability** and **serializability** checks that reject mutation outside a reducer and values like \`Date\` or class instances. In TypeScript, derive the types: \`type RootState = ReturnType<typeof store.getState>\`.

## createSlice: one feature, one file

\`\`\`js
import { createSlice } from '@reduxjs/toolkit';

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [], coupon: null, status: 'idle' },
  reducers: {
    itemAdded: {
      reducer(state, action) {
        const existing = state.items.find((i) => i.sku === action.payload.sku);
        if (existing) existing.qty += action.payload.qty;
        else state.items.push(action.payload);
      },
      prepare(sku, qty = 1) {
        return { payload: { sku, qty, addedAt: Date.now() } };
      },
    },
    cartCleared() {
      return { items: [], coupon: null, status: 'idle' };
    },
  },
});

export const { itemAdded, cartCleared } = cartSlice.actions;
export default cartSlice.reducer;
\`\`\`

Everything worth knowing is in that block:

- The **action type is derived**: \`name + '/' + reducerKey\`, so \`cart/itemAdded\`. You never write the string.
- Each generated creator takes **one argument**, which becomes \`action.payload\`. Need more, or an impure value like a timestamp or generated id? Use the **\`prepare\` callback**, which keeps the reducer pure.
- \`String(actionCreator)\` returns the type, which is why a creator can be passed to \`builder.addCase\`.
- A reducer may **mutate the draft** *or* **return a new state**, never both in one call.

## Immer: mutate a draft, get an immutable result

Inside \`createSlice\`, \`state\` is an Immer **draft** — a \`Proxy\` recording every write. When the reducer returns, Immer builds the next state with **structural sharing**: touched branches are copied, untouched branches keep their reference.

\`\`\`js
const base = { user: { name: 'Ada' }, tags: ['x'] };
const next = produce(base, (draft) => { draft.user.name = 'Grace'; });

next !== base;            // true  - the root was copied
next.user !== base.user;  // true  - the touched branch was copied
next.tags === base.tags;  // true  - the untouched branch is SHARED
\`\`\`

That last line is what makes \`useSelector\` cheap: a component selecting \`tags\` gets an identical reference and skips its re-render.

### The four ways people break Immer

**1. Mutating *and* returning** throws "may not return a new state and modify the draft".

**2. Reassigning the draft binding.** Immer tracks writes *through* the proxy; rebinding the parameter throws it away.

\`\`\`js
wrong(state) { state = { items: [] }; }   // does nothing
right() { return { items: [] }; }         // correct
alsoRight(state) { state.items = []; }    // also correct
\`\`\`

**3. Returning \`undefined\` deliberately to mean "empty".** Immer reads that as "I mutated the draft, use it". Return \`null\` or the \`nothing\` token instead.

**4. Async inside the recipe.** The draft is **revoked** the moment the reducer returns; touching it later from a \`setTimeout\` throws. Reducers are synchronous, always.

> Immer only proxies plain objects, arrays, \`Map\` and \`Set\`. Class instances need an \`[immerable]\` marker; \`Date\` and \`RegExp\` are atomic values you replace wholesale.

## extraReducers: reacting to actions you do not own

\`reducers\` defines actions the slice **owns**. \`extraReducers\` lets a slice respond to actions other slices, thunks or RTK Query dispatched — this is how one action updates several slices.

\`\`\`js
extraReducers: (builder) => {
  builder
    .addCase(authSlice.actions.loggedOut, (state) => { state.items = []; })
    .addMatcher((action) => action.type.endsWith('/rejected'), (state) => { state.status = 'error'; });
}
\`\`\`

\`addCase\` must come before \`addMatcher\`, which must come before \`addDefaultCase\`; the builder enforces that order.

## Wiring it into React

\`react-redux\` supplies \`<Provider>\`, \`useDispatch\`, and \`useSelector\`, which re-renders when the **selected value** changes (compared with \`===\`). Export selectors from the slice file so the state shape never leaks.

> **Gotcha:** \`useSelector((s) => ({ a: s.a, b: s.b }))\` returns a *new object every time* and therefore re-renders on every dispatch anywhere in the app. Call \`useSelector\` twice, pass \`shallowEqual\`, or memoise with \`createSelector\` — which is where the next lesson starts.`,
    },
    {
      slug: 'async-entities-selectors-rtk-query',
      title: 'Async State: Thunks, Entities, Selectors and RTK Query',
      estimatedMinutes: 95,
      body: `# Async State: Thunks, Entities, Selectors and RTK Query

## Why async needs a middleware at all

\`dispatch\` accepts plain objects, and a promise is not one, so something must sit between \`dispatch\` and the reducers. That is **redux-thunk**, whose entire implementation is roughly:

\`\`\`js
const thunk = ({ dispatch, getState }) => (next) => (action) =>
  typeof action === 'function' ? action(dispatch, getState) : next(action);
\`\`\`

Dispatch a *function* and thunk calls it with \`dispatch\` and \`getState\` instead. That is the whole trick.

## createAsyncThunk

It turns one promise-returning function into three action types and dispatches them for you.

\`\`\`js
import { createAsyncThunk } from '@reduxjs/toolkit';

export const fetchUserById = createAsyncThunk(
  'users/fetchById',
  async (userId, thunkApi) => {
    const res = await fetch('/api/users/' + userId, { signal: thunkApi.signal });
    if (!res.ok) return thunkApi.rejectWithValue({ status: res.status });
    return res.json();
  },
  { condition: (userId, { getState }) => (getState().users.entities[userId] ? false : undefined) }
);
\`\`\`

Dispatching \`fetchUserById(7)\` produces, in order:

| Action | \`meta.arg\` | Payload |
| --- | --- | --- |
| \`users/fetchById/pending\` | \`7\` | — |
| \`users/fetchById/fulfilled\` | \`7\` | the resolved value |
| \`users/fetchById/rejected\` | \`7\` | \`action.error\`, or \`action.payload\` from \`rejectWithValue\` |

Details people trip on:

- **\`rejectWithValue\` vs throwing.** A thrown error lands on \`action.error\` as a *serialised* \`{ name, message, stack }\`. \`rejectWithValue(x)\` puts \`x\` on \`action.payload\` — that is how you surface a server validation body.
- **\`thunkApi.signal\`** is an \`AbortSignal\`; pass it to \`fetch\` so \`promise.abort()\` really cancels.
- **\`condition\`** returning \`false\` cancels *before* \`pending\` — the cheapest possible dedupe.
- The returned promise **never rejects**. \`await dispatch(thunk())\` gives you the final action; \`.unwrap()\` makes it throw so a \`try\`/\`catch\` can toast the error.

Handle the lifecycle in \`extraReducers\`:


\`\`\`js
extraReducers: (builder) => {
  builder
    .addCase(fetchUserById.pending, (state) => { state.status = 'loading'; state.error = null; })
    .addCase(fetchUserById.fulfilled, (state, action) => {
      state.status = 'succeeded';
      usersAdapter.upsertOne(state, action.payload);
    })
    .addCase(fetchUserById.rejected, (state, action) => {
      state.status = 'failed';
      state.error = action.payload ? action.payload.status : action.error.message;
    });
}
\`\`\`

## Normalisation with createEntityAdapter

An array means every lookup is O(n), every update rewrites it, and the same record ends up duplicated. Normalise instead: **\`{ ids: [], entities: {} }\`**.

\`\`\`js
import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';

const usersAdapter = createEntityAdapter({
  selectId: (user) => user.userId,               // the default is user.id
  sortComparer: (a, b) => a.name.localeCompare(b.name),
});

const usersSlice = createSlice({
  name: 'users',
  initialState: usersAdapter.getInitialState({ status: 'idle', error: null }),
  reducers: {
    userAdded: usersAdapter.addOne,
    userUpdated: usersAdapter.updateOne,   // payload: { id, changes: {...} }
    usersReceived: usersAdapter.setAll,
  },
});

export const {
  selectAll: selectAllUsers,
  selectById: selectUserById,
  selectIds: selectUserIds,
  selectTotal: selectUserCount,
} = usersAdapter.getSelectors((state) => state.users);
\`\`\`

The adapter gives you \`addOne / setAll / updateOne / upsertOne / removeOne / removeAll\`, all Immer-aware so they work directly as reducers, and \`sortComparer\` keeps \`ids\` ordered. A common React pattern falls out of this: render the list from \`selectUserIds\` and let each row select its own entity by id, so adding one user re-renders one row.

## Memoised selectors with reselect

\`createSelector\` takes *input selectors* plus a *result function*, caching the last result and recomputing only when an input changes by reference.

\`\`\`js
import { createSelector } from '@reduxjs/toolkit';

const selectItems = (state) => state.cart.items;
const selectTaxRate = (state) => state.settings.taxRate;

export const selectCartTotal = createSelector([selectItems, selectTaxRate], (items, taxRate) => {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return Math.round(subtotal * (1 + taxRate));
});
\`\`\`

Two things this buys you. **Skipped work** — dispatching \`auth/loggedIn\` does not recompute the cart total. And **stable references** — a selector deriving an object or array *must* be memoised:

\`\`\`js
// new array every call, so every dispatch re-renders the component
const selectExpensive = (state) => state.cart.items.filter((i) => i.price > 100);
// same array reference until items actually change
const selectExpensive = createSelector([selectItems], (items) => items.filter((i) => i.price > 100));
\`\`\`

> **The shared-cache trap:** the classic cache size is **one**. A selector taking a prop — \`selectItemById(state, id)\` — thrashes when two components pass different ids: A recomputes, then B, then A again. Create a per-component instance with \`useMemo(() => makeSelectItemById(), [])\`, or rely on \`weakMapMemoize\`, the default in reselect 5, which caches per argument identity.

## RTK Query: server state is a cache, not a state tree

Most "global state" is not state at all: it is a **local copy of data that lives on a server**. Modelling it as a state tree means hand-writing loading flags, dedupe, refetch and invalidation for every endpoint.

\`\`\`js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Post'],
  endpoints: (builder) => ({
    getPosts: builder.query({
      query: (params = {}) => ({ url: 'posts', params }),
      providesTags: (result = []) => [
        { type: 'Post', id: 'LIST' },
        ...result.map((p) => ({ type: 'Post', id: p.id })),
      ],
    }),
    addPost: builder.mutation({
      query: (body) => ({ url: 'posts', method: 'POST', body }),
      invalidatesTags: [{ type: 'Post', id: 'LIST' }],
    }),
  }),
});

export const { useGetPostsQuery, useAddPostMutation } = api;
\`\`\`

Register it with \`reducer: { [api.reducerPath]: api.reducer }\` and \`middleware: (getDefault) => getDefault().concat(api.middleware)\`. The middleware is **not optional** — it runs the requests and manages cache lifetimes.

Queries **provide** tags; mutations **invalidate** them. Any entry holding an invalidated tag refetches if it is in use and is dropped if it is not.

| Situation | providesTags | invalidatesTags |
| --- | --- | --- |
| List endpoint | \`[{type:'Post',id:'LIST'}, ...ids]\` | — |
| Detail endpoint | \`[{type:'Post', id}]\` | — |
| Create | — | \`[{type:'Post', id:'LIST'}]\` |
| Update one | — | \`[{type:'Post', id: arg.id}]\` |

The \`'LIST'\` id is a convention, not magic: a synthetic tag meaning "the shape of the collection". Without it, creating a post would invalidate nothing, because the new post's id was in no previous result.

Three more things worth knowing:

- **\`isLoading\`** is true only on the *first* load for a cache entry; **\`isFetching\`** is true for *any* in-flight request including a background refetch. Skeletons come from \`isLoading\` — swap them and the page flashes on every revalidation.
- The **cache key** is \`endpointName + serialised argument\`, so two components calling \`useGetPostsQuery({ page: 1 })\` share one request and one entry, which survives \`keepUnusedDataFor\` seconds after the last subscriber unmounts.
- \`onQueryStarted\` plus \`api.util.updateQueryData\` gives optimistic updates with a one-line rollback.

> **Rule of thumb:** server data → RTK Query or TanStack Query. Genuinely client-owned, cross-cutting state → slices. Anything used by one subtree → \`useState\`.`,
    },
    {
      slug: 'zustand-and-pinia',
      title: 'Zustand and Pinia — Stores Without Ceremony',
      estimatedMinutes: 95,
      body: `# Zustand and Pinia — Stores Without Ceremony

## The store-as-a-hook idea

Context and Redux both work top-down: something wraps your tree in a \`<Provider>\`, and that provider decides who re-renders. Zustand inverts it. **The store is a module-level object; the hook is just a subscription to it.** No provider, no context — only the components that asked for the changed slice re-render.

\`\`\`js
import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
  items: [],
  coupon: null,
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (sku) => set((state) => ({ items: state.items.filter((i) => i.sku !== sku) })),
  applyCoupon: (code) => set({ coupon: code }),
  total: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
}));
\`\`\`

That is the whole store: state and the functions that change it, in one object. Actions live **inside** the state, so a component only ever needs the hook.

## create, set and get

- **\`set(partial)\`** merges — a shallow \`Object.assign\` onto the current state, so \`set({ coupon: 'X' })\` leaves \`items\` and every action untouched. This is the biggest difference from \`useState\`, where setting replaces.
- **\`set(fn)\`** hands you the current state: \`set((s) => ({ count: s.count + 1 }))\`. Use it whenever the next value depends on the previous one.
- **\`set(partial, true)\`** *replaces*. You almost never want this, because it deletes your actions too.
- **\`get()\`** reads state synchronously, outside React. It is how one action calls another and how async code reads fresh state after an \`await\`.

There is no thunk middleware and no async action type. An action is just a function: \`set({ status: 'loading' })\`, \`await fetch(...)\`, \`set({ user, status: 'ready' })\`. Every \`set\` is a separate notification to subscribers.

## Selectors and render minimisation

The value \`create\` returns is a hook **and** a plain API object. Calling it with no selector subscribes to the entire store, so always pass one. The result is compared with \`Object.is\`, which makes primitives free and objects the trap:

\`\`\`jsx
// new object every run, so every store change re-renders
const { items, coupon } = useCartStore((s) => ({ items: s.items, coupon: s.coupon }));

// two subscriptions, each compared by reference
const items = useCartStore((s) => s.items);
const coupon = useCartStore((s) => s.coupon);

// or one subscription with a shallow comparison
const { items, coupon } = useCartStore(useShallow((s) => ({ items: s.items, coupon: s.coupon })));
\`\`\`

This is exactly the problem \`useSelector\` has, and exactly the same fix. Sharper still: select the narrowest value you can — \`(s) => s.items.length\` re-renders only when the length changes.

Outside React, use the static API: \`getState()\`, \`setState()\`, \`subscribe(listener)\`. No hooks rules, no component required, fully testable — and \`setState(initialState, true)\` in a \`beforeEach\` resets the world.

For values arriving at animation frequency — cursor position, a drag delta — subscribe imperatively and write straight to a ref or the DOM. The component renders **once**, ever. That is a **transient update**; the \`(selector, listener)\` overload it needs comes from the \`subscribeWithSelector\` middleware.

## Slices and middleware

Split a large store into **slice creators** with the same \`(set, get)\` signature and spread them together. State stays flat, so any slice can call any other slice's action through \`get()\` — something Redux needs \`extraReducers\` for. The cost is that key names must stay unique.

\`\`\`js
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export const useStore = create(
  devtools(
    persist(
      immer((set) => ({
        settings: { theme: 'dark' },
        items: [],
        addItem: (item) => set((state) => { state.items.push(item); }),
      })),
      {
        name: 'app-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ settings: state.settings }),
        version: 2,
        migrate: (persisted, version) => (version < 2 ? { settings: { theme: 'dark' } } : persisted),
      }
    ),
    { name: 'AppStore' }
  )
);
\`\`\`

| Middleware | Effect | Watch out for |
| --- | --- | --- |
| \`immer\` | \`set\` recipes mutate a draft; you stop spreading | must be the **innermost** wrapper |
| \`persist\` | saves on every change, rehydrates on load | use \`partialize\` — never persist functions or tokens |
| \`devtools\` | streams actions to the Redux DevTools extension | usually **outermost**; name your actions |

Two \`persist\` details bite in production. Hydration is **asynchronous** for async storages, so a fresh component briefly sees the *initial* state — guard with \`persist.hasHydrated()\`. And **bump \`version\` with a \`migrate\`** whenever the persisted shape changes, or returning users get a store missing keys.

> A module-level store is a **shared singleton on the server**, so one user's data can leak into another's render. Under SSR, create the store per request and provide it through a small context — the officially recommended pattern.

## Pinia — the same idea for Vue

Pinia is what Vuex became and the official store for Vue 3: no mutations, no nested modules, full TypeScript inference. Install it with \`createApp(App).use(createPinia())\`.

\`\`\`js
import { defineStore } from 'pinia';

export const useCartStore = defineStore('cart', {
  state: () => ({ items: [], coupon: null }),
  getters: {
    subtotal: (state) => state.items.reduce((n, i) => n + i.price * i.qty, 0),
    total(state) { return this.coupon ? this.subtotal * 0.9 : this.subtotal; },
    itemBySku: (state) => (sku) => state.items.find((i) => i.sku === sku),
  },
  actions: {
    addItem(item) {
      const existing = this.items.find((i) => i.sku === item.sku);
      if (existing) existing.qty += item.qty;
      else this.items.push(item);          // direct mutation is idiomatic
    },
  },
});
\`\`\`

- **\`state\` must be a function**, exactly like a component's \`data()\`, so each SSR request gets its own object.
- **Actions mutate directly.** Vue's proxy reactivity tracks it; Pinia has no \`mutations\` concept at all.
- **Getters are cached \`computed\`s.** One that reads another getter needs \`this\`, so write it as a method, not an arrow. One that *returns a function* is a parameterised lookup and cannot be cached.

The same store in setup style is a function: \`ref\` becomes state, \`computed\` becomes a getter, a plain function becomes an action, and whatever you do not \`return\` stays private. Setup stores can use composables, watchers and lifecycle hooks; options stores get \`$reset()\` for free.

The instance API is worth memorising: \`$patch(obj)\` shallow-merges, \`$patch(fn)\` batches array edits into one DevTools entry, plus \`$reset()\`, \`$subscribe()\` and \`$onAction()\`. A **plugin** receives \`{ store, options, app, pinia }\` and merges what it returns onto every store.

> **The number-one Pinia bug:** \`const { items } = useCartStore()\` gives you a detached value that never updates. State and getters need \`storeToRefs(store)\`; actions are plain functions and destructure safely.`,
    },
    {
      slug: 'choosing-a-state-tool',
      title: 'Choosing: Redux Toolkit, Zustand, Pinia, Context or Nothing',
      estimatedMinutes: 75,
      body: `# Choosing: Redux Toolkit, Zustand, Pinia, Context or Nothing

You now know four tools that all claim to "manage state". The senior skill is not using them — it is knowing which problem you actually have.

## Five kinds of state

Before you pick a library, classify the value:

1. **Local UI state** — is this dropdown open, what is in this input. Lives in the component: \`useState\` in React, \`ref\` in Vue.
2. **Shared client state** — cart contents, wizard progress, feature flags, editor selection. Owned by your app, written from several places. This is what Redux Toolkit, Zustand and Pinia are for.
3. **Server state** — a *copy* of rows that live in a database. Stale the moment you receive it, and in need of caching, revalidation, deduping and invalidation. RTK Query or TanStack Query.
4. **URL state** — the current route, filters, pagination, the selected tab you want to be shareable. Belongs in the URL. The router is your state manager.
5. **Form state** — field values, touched flags, errors. React Hook Form or a Vue form composable; putting keystrokes into a global store is a classic beginner mistake.

Most "we need Redux" conversations end the moment someone notices that 80% of the state in question is category 3 or 4.

## The comparison

| | Redux Toolkit | Zustand | Pinia | React Context | Server cache |
| --- | --- | --- | --- | --- | --- |
| Framework | React (core is framework-agnostic) | React (+ vanilla core) | Vue 3 | React | React (TanStack: any) |
| Bundle, min+gzip approx. | ~13 kB + react-redux | ~1.2 kB | ~1.5 kB | 0 (built in) | ~10 kB |
| Boilerplate | moderate (slices) | minimal | minimal | trivial to write, painful to scale | minimal per endpoint |
| Provider required | yes | no (except SSR) | yes (\`createPinia\`) | yes | yes |
| DevTools | best in class, time travel | via middleware | first class, time travel | none | own panel / Redux DevTools |
| Immutability | enforced (Immer + dev checks) | manual, or the immer middleware | not needed (proxy reactivity) | manual | managed for you |
| Async | thunks / RTK Query | plain async functions | plain async actions | do it yourself | the entire point |
| Render control | \`useSelector\` + memoised selectors | selector subscriptions | fine-grained by dependency | **every consumer re-renders** | per hook, \`selectFromResult\` |
| SSR | \`preloadedState\` | store per request | store per request | per request | hydrate the cache |
| Pick it when | big team, audit trail, complex cross-cutting logic | you want global state to feel like \`useState\` | you are on Vue | the value changes rarely | the data belongs to a server |

The Context row is the important one. **Context is a dependency-injection mechanism, not a state manager**: every consumer of a provider re-renders when its value changes, with no selector escape hatch. Perfect for a theme, a locale or the current user. Disastrous for a cart.

## When global state is the wrong answer

Reach for a store only when you can name **three unrelated components that must agree on the same value**, and you have already tried the cheaper options and they hurt. Before that, in order:

- **Lift state up one level.** Two siblings need a value? Put it in their parent. Most "we need global state" is two components and a missing shared parent.
- **Pass it as a prop.** Drilling three levels is fine. Drilling seven levels is a signal — but the fix is usually composition (pass an element as \`children\`, or use a slot), not a store.
- **Put it in the URL.** Filters, tabs, pagination, the selected record. You get shareable links, a working back button and free persistence.
- **Put it on the server.** If the value must survive a reload, it belongs in a database or a cookie, not in \`localStorage\` behind a persist middleware you will forget to migrate.
- **Use a server cache.** \`useQuery\` for the data plus \`useState\` for the two genuinely local flags beats a slice that mirrors your API.

Symptoms that you reached for a store too early: reducers that only ever run from one component; a slice whose fields map one-to-one onto an API response; a \`selectedTabIndex\` in global state; an effect that copies server data into a store and a second effect that copies it back out.

## Symptoms that you reached for a store too late

The opposite failure is just as real. Move to a store when you see the same fetch happening in four components with four loading flags; a value threaded through five layers that only the leaf uses; two components disagreeing about whether the user is logged in; state duplicated into a parent *and* a child so both can write it; or an ordering bug you cannot reproduce because nothing records what happened, in order.

That last one is the honest argument for Redux in 2026. Zustand and Pinia are smaller, faster to write and perfectly capable — for most products they are the right default. Redux Toolkit gives you something they do not: **an audited, replayable, serialisable log of every transition**, and a shape thirty people can follow without a meeting. On a team of two that is overhead. On a team of thirty in year four of a product, it is the reason the app is still debuggable.

## A decision procedure

1. Is it derived from other state? Compute it. Do not store it.
2. Does it come from a server? Server cache.
3. Should it survive a reload or be shareable? URL, then cookie or database.
4. Is it used by one subtree? Local state, lifted to the nearest common parent.
5. Does it change rarely and read widely? Context.
6. Otherwise: Zustand or Pinia by default, Redux Toolkit when you need the audit trail, the middleware ecosystem or the discipline.

Notice that steps 1 to 5 do not involve a state library at all. That is the point of this lesson.`,
    },
  ],
  quiz: [
    {
      prompt: 'A reducer receives an action type it does not handle. What must it return?',
      options: [
        'The exact same state reference it was given',
        'A shallow copy of the state',
        'undefined, so Redux keeps the previous state',
        'The initial state',
      ],
      correctIndex: 0,
      explanation:
        'Returning the identical reference is what lets connected components skip re-rendering. Returning a copy makes every useSelector see a "changed" value and re-render the whole app; returning undefined would wipe the slice.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What action type does createSlice generate for `reducers: { itemAdded }` in a slice named `cart`?',
      options: ['ITEM_ADDED', 'cart.itemAdded', 'cart/itemAdded', 'itemAdded@cart'],
      correctIndex: 2,
      explanation:
        'The type is `name + "/" + reducerKey`. That string is also available as `slice.actions.itemAdded.type` and via `String(actionCreator)`, which is why an action creator can be passed straight to `builder.addCase`.',
      difficulty: 'EASY',
    },
    {
      prompt: 'After `produce(base, d => { d.user.name = "Grace" })` on `{ user: {...}, tags: [...] }`, which comparison is true?',
      options: [
        'next.tags !== base.tags, because the root object was copied',
        'next.user === base.user, because only the name string changed',
        'next === base, because Immer mutates in place',
        'next.tags === base.tags, because untouched branches are structurally shared',
      ],
      correctIndex: 3,
      explanation:
        'Immer copies only the path from the root to each modified node. `user` and the root are new objects; `tags` was never touched, so the original reference is reused — which is exactly what makes reference-equality checks in useSelector cheap.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Inside a createAsyncThunk payload creator, what is the difference between throwing an Error and calling `rejectWithValue(body)`?',
      options: [
        'There is none; both populate action.error',
        'Throwing populates action.error with a serialised error, while rejectWithValue puts your value on action.payload',
        'rejectWithValue cancels the thunk before the pending action is dispatched',
        'Throwing skips the rejected action entirely',
      ],
      correctIndex: 1,
      explanation:
        'A thrown error is serialised to `{ name, message, stack }` on `action.error`. `rejectWithValue` is how you carry a structured server response (validation errors, status codes) through to the reducer on `action.payload`. Cancelling before `pending` is the job of the `condition` option.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'In RTK Query, when should you show a skeleton using `isLoading` rather than `isFetching`?',
      options: [
        'Always use isFetching; isLoading is deprecated',
        'When there is no cached data yet — isLoading is true only for the first load of a cache entry',
        'When polling is enabled',
        'Only for mutations',
      ],
      correctIndex: 1,
      explanation:
        '`isLoading` means "first request for this cache key, nothing to show". `isFetching` is true for any in-flight request including background refetches, so driving a skeleton from it makes the page flash every time the data revalidates.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'In a Zustand middleware chain, where must the `immer` middleware sit?',
      options: [
        'Innermost — closest to the state initialiser',
        'Outermost — wrapping devtools',
        'Immediately inside devtools but outside persist',
        'Order does not matter',
      ],
      correctIndex: 0,
      explanation:
        'immer changes what `set` means for the initialiser it wraps, so it has to be the last wrapper applied to the initialiser (i.e. innermost). devtools is normally outermost so it observes the final, fully-processed actions.',
      difficulty: 'HARD',
    },
    {
      prompt: 'A Vue component does `const { items } = useCartStore()` and the list never updates. What is wrong?',
      options: [
        'The store must be registered with app.use()',
        'items should have been declared with reactive() not ref()',
        'Destructuring unwraps the reactive property into a plain value; state and getters need storeToRefs()',
        'Getters cannot be destructured, only actions can',
      ],
      correctIndex: 2,
      explanation:
        'Destructuring a store copies the current value and drops the reactive link. `storeToRefs(store)` returns refs for state and getters that stay connected. Actions are plain functions and can be destructured safely.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Which statement about React Context as a state manager is accurate?',
      options: [
        'It memoises consumers automatically, so only components using a changed field re-render',
        'It supports selectors via the second argument to useContext',
        'It ships with DevTools time travel',
        'Every consumer of a provider re-renders when the provider value changes, with no built-in selector',
      ],
      correctIndex: 3,
      explanation:
        'Context is dependency injection, not state management. There is no selector API, so a frequently-changing value forces every consumer to re-render. Reserve it for values that change rarely — theme, locale, the current user.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'mini-create-slice',
      title: 'Build a Mini createSlice',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Recreate the part of Redux Toolkit that removes the most boilerplate: \`createSlice\`.

Implement \`createSlice({ name, initialState, reducers })\` returning an object with:

- \`name\` — the slice name, unchanged.
- \`actions\` — one action creator per key in \`reducers\`. Calling it returns \`{ type, payload }\` where \`type\` is \`name + '/' + key\`. The creator also exposes \`.type\` and its \`toString()\` returns the type.
- \`reducer(state, action)\` — a pure reducer.
- \`getInitialState()\` — returns \`initialState\`.

The reducer must:

1. Use \`initialState\` when \`state\` is \`undefined\`.
2. Return the **same state reference** for an action it does not handle.
3. Pass a **shallow copy** of the state (a "draft") to the case reducer, so mutating it never touches the caller's object. Arrays copy with \`slice()\`, objects with spread.
4. Use the draft as the next state if the case reducer returns \`undefined\`, otherwise use the returned value.

\`\`\`js
const counter = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    incremented: (state) => { state.value += 1; },
    addedBy: (state, action) => { state.value += action.payload; },
    reset: () => ({ value: 0 }),
  },
});

counter.actions.addedBy(5);                 // { type: 'counter/addedBy', payload: 5 }
counter.reducer(undefined, { type: '@@x' }) // { value: 0 }
counter.reducer({ value: 1 }, counter.actions.incremented()) // { value: 2 }
\`\`\``,
      starterCode: `function createSlice(options) {
  const { name, initialState, reducers } = options;
  // Build one action creator per key, then a reducer that dispatches to the right handler.
  return { name, actions: {}, reducer: () => initialState, getInitialState: () => initialState };
}

module.exports = { createSlice };`,
      solutionCode: `function createSlice(options) {
  const { name, initialState, reducers } = options;
  const handlers = {};
  const actions = {};

  for (const key of Object.keys(reducers)) {
    const type = name + '/' + key;
    handlers[type] = reducers[key];

    const actionCreator = (payload) => ({ type, payload });
    actionCreator.type = type;
    actionCreator.toString = () => type;
    actions[key] = actionCreator;
  }

  const reducer = (state, action) => {
    const current = state === undefined ? initialState : state;
    const handler = action && handlers[action.type];
    if (!handler) return current;

    const draft = Array.isArray(current) ? current.slice() : { ...current };
    const returned = handler(draft, action);
    return returned === undefined ? draft : returned;
  };

  return { name, reducer, actions, getInitialState: () => initialState };
}

module.exports = { createSlice };`,
      hints: [
        'Build a lookup table from action type to case reducer once, up front. The reducer then never needs a switch statement.',
        'An action creator is a function, and functions can carry properties: set actionCreator.type and override actionCreator.toString.',
        'Unknown action means "return the exact same reference" — not a copy, or every component re-renders.',
        'Immer-lite: give the case reducer a shallow copy. If it returns undefined it mutated the copy; if it returns a value, that value wins.',
      ],
      tests: [
        {
          name: 'action type is name/key',
          assertion:
            "(() => { const s = solution.createSlice({name:'counter',initialState:{value:0},reducers:{incremented:(st)=>{st.value+=1;}}}); return s.actions.incremented.type === 'counter/incremented'; })()",
        },
        {
          name: 'action creator carries the payload',
          assertion:
            "(() => { const s = solution.createSlice({name:'counter',initialState:{value:0},reducers:{addedBy:(st,a)=>{st.value+=a.payload;}}}); const a = s.actions.addedBy(5); return a.type==='counter/addedBy' && a.payload===5; })()",
        },
        {
          name: 'undefined state falls back to initialState',
          assertion:
            "(() => { const s = solution.createSlice({name:'c',initialState:{value:0},reducers:{inc:(st)=>{st.value+=1;}}}); return deepEqual(s.reducer(undefined,{type:'@@INIT'}), {value:0}); })()",
        },
        {
          name: 'reducer does not mutate the input state',
          assertion:
            "(() => { const s = solution.createSlice({name:'c',initialState:{value:0},reducers:{inc:(st)=>{st.value+=1;}}}); const before={value:0}; const after=s.reducer(before, s.actions.inc()); return after.value===1 && before.value===0 && after!==before; })()",
        },
        {
          name: 'unknown action returns the same reference',
          assertion:
            "(() => { const s = solution.createSlice({name:'c',initialState:{value:0},reducers:{inc:(st)=>{st.value+=1;}}}); const st={value:7}; return s.reducer(st,{type:'other/thing'}) === st; })()",
        },
        {
          name: 'a returned value replaces the draft',
          assertion:
            "(() => { const s = solution.createSlice({name:'c',initialState:{value:0},reducers:{reset:()=>({value:0})}}); return deepEqual(s.reducer({value:9}, s.actions.reset()), {value:0}); })()",
        },
        {
          name: 'toString returns the action type',
          assertion:
            "(() => { const s = solution.createSlice({name:'todos',initialState:[],reducers:{added:(st,a)=>{st.push(a.payload);}}}); return String(s.actions.added) === 'todos/added'; })()",
          hidden: true,
        },
        {
          name: 'array state is copied, not mutated',
          assertion:
            "(() => { const s = solution.createSlice({name:'todos',initialState:[],reducers:{added:(st,a)=>{st.push(a.payload);}}}); const st=['a']; const next=s.reducer(st, s.actions.added('b')); return deepEqual(next,['a','b']) && st.length===1; })()",
          hidden: true,
        },
        {
          name: 'getInitialState and multiple reducers',
          assertion:
            "(() => { const s = solution.createSlice({name:'c',initialState:{value:0},reducers:{inc:(st)=>{st.value+=1;},dec:(st)=>{st.value-=1;}}}); return deepEqual(s.getInitialState(),{value:0}) && Object.keys(s.actions).length===2 && s.reducer(undefined, s.actions.dec()).value===-1; })()",
          hidden: true,
        },
      ],
      xp: 50,
    },
    {
      slug: 'reselect-memoised-selector',
      title: 'Clone reselect: createSelector',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Derived data must not be recomputed on every dispatch, and it must return a **stable reference** so React can bail out of a render. That is what \`createSelector\` does.

Implement \`createSelector\` supporting **both** call styles:

\`\`\`js
createSelector([inputA, inputB], resultFn)   // array of input selectors
createSelector(inputA, inputB, resultFn)     // variadic
\`\`\`

Rules:

1. Calling the returned selector runs every input selector with **all** the arguments it received (so \`selector(state, props)\` works).
2. If every input value is \`Object.is\`-equal to the previous call's, return the **cached result** without calling \`resultFn\`.
3. Otherwise call \`resultFn(...inputValues)\`, cache it, and return it.
4. Expose \`selector.recomputations\` — a number, starting at \`0\`, incremented once per actual \`resultFn\` call — and \`selector.resetRecomputations()\`.

\`\`\`js
const selectTotal = createSelector(
  [(s) => s.items, (s) => s.taxRate],
  (items, taxRate) => items.reduce((n, i) => n + i.price, 0) * (1 + taxRate)
);

const state = { items: [{ price: 10 }], taxRate: 0.1, unrelated: 1 };
selectTotal(state);                      // computes -> recomputations === 1
selectTotal({ ...state, unrelated: 2 }); // inputs identical -> cached, still 1
\`\`\``,
      starterCode: `function createSelector(...args) {
  // The last argument is always the result function.
  // Everything before it is either one array of input selectors, or the inputs themselves.
  return () => undefined;
}

module.exports = { createSelector };`,
      solutionCode: `function createSelector(...args) {
  const resultFn = args.pop();
  const inputs = Array.isArray(args[0]) ? args[0] : args;

  let lastInputs = null;
  let lastResult;

  const selector = (...selectorArgs) => {
    const values = inputs.map((input) => input(...selectorArgs));

    const isSame =
      lastInputs !== null &&
      values.length === lastInputs.length &&
      values.every((value, i) => Object.is(value, lastInputs[i]));

    if (isSame) return lastResult;

    lastInputs = values;
    lastResult = resultFn(...values);
    selector.recomputations += 1;
    return lastResult;
  };

  selector.recomputations = 0;
  selector.resetRecomputations = () => {
    selector.recomputations = 0;
  };

  return selector;
}

module.exports = { createSelector };`,
      hints: [
        'Pop the result function off the argument list first, then decide whether what remains is an array of inputs or the inputs themselves.',
        'Compare input values with Object.is, position by position — never JSON.stringify.',
        'Store lastInputs as null initially so the very first call always computes.',
        'recomputations must be a property on the returned function, set before the function can ever be called.',
      ],
      tests: [
        {
          name: 'computes once and caches',
          assertion:
            "(() => { const sel = solution.createSelector([s=>s.a, s=>s.b], (a,b)=>a+b); const st={a:1,b:2}; return sel(st)===3 && sel(st)===3 && sel.recomputations===1; })()",
        },
        {
          name: 'variadic form works',
          assertion:
            "(() => { const sel = solution.createSelector(s=>s.a, s=>s.b, (a,b)=>a*b); return sel({a:3,b:4})===12 && sel.recomputations===1; })()",
        },
        {
          name: 'unrelated state change does not recompute',
          assertion:
            "(() => { const sel = solution.createSelector([s=>s.a], (a)=>a+1); sel({a:1,z:0}); sel({a:1,z:9}); return sel.recomputations===1; })()",
        },
        {
          name: 'relevant change recomputes',
          assertion:
            "(() => { const sel = solution.createSelector([s=>s.a], (a)=>a+1); sel({a:1}); const out=sel({a:2}); return out===3 && sel.recomputations===2; })()",
        },
        {
          name: 'returns a stable reference for derived arrays',
          assertion:
            "(() => { const sel = solution.createSelector([s=>s.items], items=>items.filter(x=>x>1)); const st={items:[1,2,3]}; return sel(st)===sel(st) && deepEqual(sel(st),[2,3]); })()",
        },
        {
          name: 'extra arguments reach the input selectors',
          assertion:
            "(() => { const sel = solution.createSelector([(s,id)=>s.byId[id]], (u)=>u.name.toUpperCase()); return sel({byId:{7:{name:'ada'}}}, 7)==='ADA'; })()",
          hidden: true,
        },
        {
          name: 'resetRecomputations works',
          assertion:
            "(() => { const sel = solution.createSelector([s=>s.a], a=>a); sel({a:1}); sel.resetRecomputations(); return sel.recomputations===0 && typeof sel.resetRecomputations==='function'; })()",
          hidden: true,
        },
        {
          name: 'cache size is one (thrashes on alternating args)',
          assertion:
            "(() => { const sel = solution.createSelector([(s,id)=>id], id=>id*2); sel({},1); sel({},2); sel({},1); return sel.recomputations===3; })()",
          hidden: true,
        },
      ],
      xp: 70,
    },
    {
      slug: 'tiny-zustand-store',
      title: 'Build a Tiny Zustand',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Zustand is small enough to rebuild. Implement \`create(initializer)\`.

\`create\` calls \`initializer(set, get, api)\` and uses the returned object as the initial state. It returns a **function that is also the API**:

- \`useStore(selector)\` — returns \`selector(state)\`, or the whole state when no selector is given.
- \`useStore.getState()\`
- \`useStore.setState(partial, replace)\` — \`partial\` may be an object or \`(state) => partial\`. By default it is **shallow-merged** onto the current state; when \`replace\` is truthy it replaces the state entirely. A partial of \`undefined\` or \`null\` is a no-op.
- \`useStore.subscribe(listener)\` — listener is called as \`listener(nextState, prevState)\` after each change; returns an unsubscribe function.
- \`useStore.destroy()\` — removes all listeners.

Every \`setState\` must produce a **new state object** (when merging) so reference comparisons work.

\`\`\`js
const useCounter = create((set, get) => ({
  count: 0,
  step: 2,
  inc: () => set((s) => ({ count: s.count + 1 })),
  bump: () => set({ count: get().count + get().step }),
}));

useCounter.getState().inc();
useCounter.getState().count;   // 1
useCounter((s) => s.count);    // 1
\`\`\``,
      starterCode: `function create(initializer) {
  // Hold state and a Set of listeners in a closure.
  // Build set/get/subscribe first, then call the initializer with them.
  return () => undefined;
}

module.exports = { create };`,
      solutionCode: `function create(initializer) {
  let state;
  const listeners = new Set();

  const setState = (partial, replace) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    if (next === undefined || next === null) return;

    const prev = state;
    state = replace ? next : { ...state, ...next };
    listeners.forEach((listener) => listener(state, prev));
  };

  const getState = () => state;

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const destroy = () => {
    listeners.clear();
  };

  const api = { setState, getState, subscribe, destroy };

  state = initializer(setState, getState, api);

  const useStore = (selector) => (selector ? selector(state) : state);
  Object.assign(useStore, api);
  return useStore;
}

module.exports = { create };`,
      hints: [
        'Declare `let state` before you build set/get — the initializer needs to be able to call them later, and closures capture the variable, not its value.',
        'Assign the initializer result to state only after set/get/subscribe exist, otherwise actions defined in the initializer capture undefined helpers.',
        'Merging means `{ ...state, ...next }` — a brand-new object every time, which is what makes `getState() !== previous` true.',
        'Object.assign(useStore, api) is what makes the returned function double as the store API.',
      ],
      tests: [
        {
          name: 'initial state and actions are present',
          assertion:
            "(() => { const u = solution.create((set,get)=>({count:0,step:2,inc:()=>set(s=>({count:s.count+1}))})); return u.getState().count===0 && typeof u.getState().inc==='function'; })()",
        },
        {
          name: 'functional set updates from previous state',
          assertion:
            "(() => { const u = solution.create((set)=>({count:0,inc:()=>set(s=>({count:s.count+1}))})); u.getState().inc(); u.getState().inc(); return u.getState().count===2; })()",
        },
        {
          name: 'get() inside an action reads fresh state',
          assertion:
            "(() => { const u = solution.create((set,get)=>({count:0,step:5,bump:()=>set({count:get().count+get().step})})); u.getState().bump(); u.getState().bump(); return u.getState().count===10; })()",
        },
        {
          name: 'setState shallow-merges and keeps other keys',
          assertion:
            "(() => { const u = solution.create((set)=>({count:0,step:2,inc:()=>set(s=>({count:s.count+1}))})); u.setState({count:9}); const s=u.getState(); return s.count===9 && s.step===2 && typeof s.inc==='function'; })()",
        },
        {
          name: 'calling the store with a selector reads a slice',
          assertion:
            "(() => { const u = solution.create(()=>({count:3,step:2})); return u(s=>s.count)===3 && u().step===2; })()",
        },
        {
          name: 'subscribe receives next and previous state',
          assertion:
            "(() => { const u = solution.create((set)=>({count:0,inc:()=>set(s=>({count:s.count+1}))})); let seen=null; u.subscribe((s,p)=>{ seen=[s.count,p.count]; }); u.getState().inc(); return deepEqual(seen,[1,0]); })()",
        },
        {
          name: 'unsubscribe stops notifications',
          assertion:
            "(() => { const u = solution.create((set)=>({count:0,inc:()=>set(s=>({count:s.count+1}))})); let n=0; const un=u.subscribe(()=>{n+=1;}); u.getState().inc(); un(); u.getState().inc(); return n===1 && u.getState().count===2; })()",
          hidden: true,
        },
        {
          name: 'replace flag replaces the whole state',
          assertion:
            "(() => { const u = solution.create(()=>({count:0,step:2})); u.setState({count:5}, true); return deepEqual(u.getState(),{count:5}); })()",
          hidden: true,
        },
        {
          name: 'every merge produces a new object reference',
          assertion:
            "(() => { const u = solution.create(()=>({count:0})); const before=u.getState(); u.setState({count:1}); return u.getState()!==before && before.count===0; })()",
          hidden: true,
        },
        {
          name: 'destroy clears listeners',
          assertion:
            "(() => { const u = solution.create((set)=>({count:0,inc:()=>set(s=>({count:s.count+1}))})); let n=0; u.subscribe(()=>{n+=1;}); u.destroy(); u.getState().inc(); return n===0 && u.getState().count===1; })()",
          hidden: true,
        },
      ],
      xp: 60,
    },
  ],
  flashcards: [
    {
      front: 'The three principles of Redux',
      back: 'Single source of truth (one state tree); state is read-only (change only by dispatching actions); changes are made by pure reducer functions.',
      tags: ['redux', 'concepts'],
    },
    {
      front: 'What action type does createSlice generate?',
      back: '`name + "/" + reducerKey`, e.g. slice `cart` with reducer `itemAdded` gives `cart/itemAdded`. Also available as `actions.itemAdded.type`.',
      tags: ['redux-toolkit', 'createSlice'],
    },
    {
      front: 'What does configureStore add that createStore did not?',
      back: 'redux-thunk, DevTools wiring, dev-only immutability and serializability checks, combineReducers from the reducer object, and full TypeScript inference.',
      tags: ['redux-toolkit', 'store'],
    },
    {
      front: 'Why does `state = newObject` inside a createSlice reducer do nothing?',
      back: 'Immer records writes made through the draft proxy. Reassigning the parameter just repoints a local binding. Return the new state instead, or mutate a property.',
      tags: ['immer', 'gotcha'],
    },
    {
      front: 'What is structural sharing?',
      back: 'Immer copies only the nodes on the path from the root to each modification. Untouched branches keep their original reference, so `===` checks stay cheap and re-renders stay narrow.',
      tags: ['immer', 'performance'],
    },
    {
      front: 'Which three actions does createAsyncThunk dispatch, and what does rejectWithValue change?',
      back: '`name/pending`, then `name/fulfilled` (payload = resolved value) or `name/rejected`. Throwing serialises to `action.error`; `rejectWithValue(x)` puts x on `action.payload`, which is how a server validation body reaches the reducer.',
      tags: ['redux-toolkit', 'async'],
    },
    {
      front: 'What state shape does createEntityAdapter produce?',
      back: '`{ ids: [...], entities: { [id]: entity } }`. Use `getInitialState({ status, error })` to add extra fields and `getSelectors` for selectAll / selectById / selectIds / selectTotal.',
      tags: ['redux-toolkit', 'normalisation'],
    },
    {
      front: 'When must a selector be memoised with createSelector?',
      back: 'Whenever it derives a new object or array. useSelector compares with `===`, so an un-memoised derived array re-renders the component on every dispatch in the app.',
      tags: ['reselect', 'performance'],
    },
    {
      front: 'RTK Query: isLoading vs isFetching, and how invalidation works',
      back: '`isLoading` = first request for this cache key (drive skeletons from it); `isFetching` = any request in flight. Queries declare `providesTags`, mutations declare `invalidatesTags`; `{ type, id: "LIST" }` is the convention for "the collection changed".',
      tags: ['rtk-query', 'caching'],
    },
    {
      front: 'What does Zustand `set(partial)` do by default?',
      back: 'Shallow-merges the partial into the current state (one level). `set(partial, true)` replaces instead — which also deletes your action functions.',
      tags: ['zustand', 'api'],
    },
    {
      front: 'Zustand middleware ordering rule, and the two persist settings you must not skip',
      back: 'immer must be innermost (it redefines set for the initialiser); devtools is normally outermost. With persist, always set `partialize` (never store functions or tokens) and `version` + `migrate` (or returning users get a broken store).',
      tags: ['zustand', 'middleware'],
    },
    {
      front: 'Pinia: why must `state` be a function, and when do you need `storeToRefs`?',
      back: '`state()` gives each app instance and SSR request a fresh object. `storeToRefs(store)` is required when destructuring state or getters — plain destructuring copies the value and loses reactivity. Actions destructure fine.',
      tags: ['pinia', 'gotcha'],
    },
  ],
  resources: [
    { label: 'Redux Toolkit — official docs', url: 'https://redux-toolkit.js.org/', kind: 'DOCS' },
    { label: 'RTK Query overview', url: 'https://redux-toolkit.js.org/rtk-query/overview', kind: 'DOCS' },
    { label: 'Immer — introduction', url: 'https://immerjs.github.io/immer/', kind: 'DOCS' },
    { label: 'Zustand — documentation', url: 'https://zustand.docs.pmnd.rs/', kind: 'DOCS' },
    { label: 'Pinia core concepts: state, getters, actions', url: 'https://pinia.vuejs.org/core-concepts/', kind: 'DOCS' },
  ],
};

export default day;
