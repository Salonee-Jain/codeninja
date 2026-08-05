import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 11,
  week: 2,
  pillar: 'FRONTEND',
  title: 'Vue.js 3 & the Composition API',
  summary: 'Fine-grained reactivity, a real template language, and everything you know from React remapped.',
  estimatedMinutes: 350,
  objectives: [
    'Write a Vue 3 Single-File Component with <script setup>, template directives and scoped styles',
    'Use ref, reactive, computed, watch, watchEffect and shallowRef correctly, and know when .value applies',
    'Avoid the destructuring and toRefs pitfalls that silently kill reactivity',
    'Design component contracts with props, emits, defineModel and default / named / scoped slots',
    'Extract reusable logic into composables and share dependencies with provide / inject',
    'Route a Vue app with vue-router, including dynamic params and navigation guards',
    'Wire a Pinia store into a component with storeToRefs, and use Teleport, Suspense and KeepAlive',
    'Translate any concept between React and Vue using a shared mental model',
  ],
  technologies: ['Vue.js', 'Pinia'],
  lessons: [
    {
      slug: 'sfc-and-template-language',
      title: 'Single-File Components and the Template Language',
      estimatedMinutes: 90,
      body: `# Single-File Components and the Template Language

## One file, three blocks

A \`.vue\` file is compiled by Vite into a normal ES module. It holds a component's logic, markup and styles together — the same instinct as a React component with Tailwind classes, but with the boundaries made explicit.

\`\`\`vue
<script setup>
import { ref, computed } from 'vue';

const query = ref('');
const items = ref([
  { id: 1, name: 'Keyboard', price: 90 },
  { id: 2, name: 'Monitor', price: 320 },
]);

const results = computed(() =>
  items.value.filter((i) => i.name.toLowerCase().includes(query.value.toLowerCase()))
);
</script>

<template>
  <input v-model="query" placeholder="Search products" />
  <p v-if="results.length === 0">No matches.</p>
  <ul v-else>
    <li v-for="item in results" :key="item.id">
      {{ item.name }} — {{ item.price }}
    </li>
  </ul>
</template>

<style scoped>
li { padding: 4px 0; }
</style>
\`\`\`

Three things differ from React on sight:

1. **\`<script setup>\`** — every top-level binding is automatically exposed to the template. No \`return\`, no render function, no \`this\`. The block runs **once per component instance**, not once per render, which is why Vue needs no \`useCallback\` and no dependency arrays.
2. **The template is real HTML**, parsed by the browser's own rules, with directives as attributes. It compiles ahead of time into a render function, and because the compiler can see which nodes are static, it hoists them out and skips them entirely on update.
3. **\`<style scoped>\`** rewrites selectors with a per-component data attribute, giving you component-scoped CSS with zero runtime cost. \`<style module>\` gives you CSS Modules instead, and \`:deep(.child)\` pierces into a child component when you really must.

## Interpolation and directives

\`{{ expression }}\` interpolates a **single JavaScript expression** — no statements, no \`if\`, no \`for\`. Anything longer belongs in a \`computed\`.

| Directive | Meaning | Shorthand |
| --- | --- | --- |
| \`v-bind:href="url"\` | bind an attribute or prop | \`:href="url"\` |
| \`v-on:click="fn"\` | attach an event listener | \`@click="fn"\` |
| \`v-model="x"\` | two-way binding on a form control | — |
| \`v-if\` / \`v-else-if\` / \`v-else\` | conditionally **create/destroy** the node | — |
| \`v-show\` | toggle \`display: none\`; the node always exists | — |
| \`v-for="(item, i) in list"\` | render a list | — |
| \`v-html\` | set innerHTML (XSS risk — never on user input) | — |
| \`v-once\` / \`v-memo\` | render once / skip updates when deps are equal | — |
| \`v-cloak\` | hide un-compiled markup during hydration | — |

\`v-if\` versus \`v-show\` is the classic interview question: \`v-if\` is lazy and cheap when the condition rarely flips; \`v-show\` pays the render cost once and is cheap to toggle often.

\`\`\`vue
<template>
  <a :href="'/users/' + user.id" :class="{ active: isActive, 'is-admin': user.admin }">
    {{ user.name }}
  </a>

  <div :style="{ color: theme.text, fontSize: size + 'px' }">Styled</div>

  <button @click="count++">+1</button>
  <button @click.prevent.stop="submit">Save</button>
  <input @keyup.enter="search" />

  <span v-show="isTyping">typing…</span>
</template>
\`\`\`

Those dotted suffixes are **event modifiers**: \`.prevent\`, \`.stop\`, \`.once\`, \`.self\`, \`.capture\`, \`.passive\`, plus key modifiers such as \`.enter\` and \`.esc\`. In React you write \`e.preventDefault()\` by hand; here it is declarative and the compiler generates it. \`:class\` accepts an object (keys are class names, values are conditions), an array, or a mix — and a class bound on a component tag is merged onto that component's root element rather than replacing it.

> **Always key your \`v-for\`.** \`:key="item.id"\` — the same reconciliation reason as React, and never the array index for a list that can reorder. And never put \`v-if\` and \`v-for\` on the same element: in Vue 3 \`v-if\` has the higher priority and cannot see the loop variable. Wrap with \`<template v-for>\` and put the \`v-if\` inside.

## v-model on a form control

\`v-model\` is sugar. On an \`<input>\` it expands to \`:value\` plus \`@input\`, on a checkbox to \`:checked\` plus \`@change\`, and on a \`<select>\` to \`:value\` plus \`@change\`. Its modifiers do the tedious parts you would otherwise hand-write:

\`\`\`vue
<input v-model.trim="name" />        <!-- trims whitespace -->
<input v-model.number="age" />       <!-- casts to Number -->
<input v-model.lazy="bio" />         <!-- syncs on change, not input -->
\`\`\`

Bound to a checkbox array, \`v-model\` pushes and removes values for you; bound to a radio group it sets the chosen value. This is the single biggest ergonomic gap between Vue and React for form-heavy screens.

## Built-in components worth knowing now

- **\`<Teleport to="body">\`** — render this subtree somewhere else in the DOM. Modals, toasts and tooltips, without a portal library. The component stays a logical child, so props, events and provide/inject all still work; only the DOM position moves.
- **\`<Suspense>\`** — await an async \`setup\` in a descendant and show \`#fallback\` until it resolves.
- **\`<KeepAlive>\`** — cache a toggled component instead of destroying it, preserving its state and firing \`onActivated\` / \`onDeactivated\` instead of mount / unmount. Perfect for tabbed panels.
- **\`<Transition>\`** and **\`<TransitionGroup>\`** — apply enter and leave CSS classes automatically. There is no React equivalent in core.

## The compiler is the performance story

React re-runs your component function and diffs the resulting virtual DOM. Vue compiles your template once, at build time, into a render function annotated with **patch flags**: this node's class is dynamic, that node's text is dynamic, everything else is static and hoisted out of the render entirely. At runtime, updating a component means walking a short list of dynamic nodes rather than diffing a tree.

That is why Vue can afford fine-grained reactivity without asking you to memoise anything, and it is the subject of the next lesson.`,
    },
    {
      slug: 'reactivity-system',
      title: 'The Reactivity System: ref, reactive, computed and watch',
      estimatedMinutes: 90,
      body: `# The Reactivity System: ref, reactive, computed and watch

Vue's reactivity is **automatic dependency tracking**, not a diffing algorithm. When you read a reactive value inside a render, a \`computed\` or an effect, Vue records the dependency. When you write it, Vue re-runs exactly the effects that read it. That is why Vue has no \`useMemo\`, no \`useCallback\` and no dependency arrays: the framework already knows what depends on what.

## ref vs reactive

\`\`\`js
import { ref, reactive } from 'vue';

const count = ref(0);                              // any value, boxed
const user = reactive({ name: 'Ada', tags: [] });  // objects only, Proxy-based

count.value += 1;      // .value in JavaScript...
user.name = 'Grace';   // ...but reactive objects are used directly
\`\`\`

| | \`ref\` | \`reactive\` |
| --- | --- | --- |
| Works with | anything, including primitives | objects, arrays, \`Map\`, \`Set\` |
| Access in JS | \`.value\` | direct property access |
| Access in template | auto-unwrapped, no \`.value\` | direct |
| Survives destructuring | yes (pass the ref around) | **no** — loses reactivity |
| Reassignable wholesale | yes (\`list.value = []\`) | no (\`user = {}\` breaks the link) |

The Vue team's own advice: **default to \`ref\`.** It works for every type, survives being returned from a composable, and one rule (\`.value\` in script, nothing in template) is easier than two.

> The single most common Vue bug is forgetting \`.value\` in a \`<script>\` block. \`if (count)\` on a ref is *always* truthy, because a ref is an object. Turn on the Vue ESLint plugin and Volar; both catch it.

## The destructuring trap, and toRefs

\`reactive\` returns a \`Proxy\`. Reactivity lives in the proxy, not in the values, so the moment you pull a primitive out you are holding a plain copy:

\`\`\`js
const state = reactive({ count: 0, name: 'Ada' });

const { count } = state;   // count is now the number 0, forever
count + 1;                 // updating state.count changes nothing here

const { count: countRef } = toRefs(state);  // countRef is a live ref
countRef.value;                             // tracks state.count
\`\`\`

\`toRefs(state)\` converts every property into a ref bound back to the original object, which is exactly how a composable returns a \`reactive\` bag without callers losing reactivity. \`toRef(state, 'count')\` does one property. The same rule applies to props: \`const { modelValue } = props\` breaks reactivity; \`const model = toRef(props, 'modelValue')\` does not.

## computed

\`\`\`js
const first = ref('Ada');
const last = ref('Lovelace');

// Cached, lazily evaluated, recomputed only when a dependency changes.
const fullName = computed(() => first.value + ' ' + last.value);

// Writable computed: the set path decides how to distribute the value
const editable = computed({
  get: () => first.value + ' ' + last.value,
  set: (value) => { [first.value, last.value] = value.split(' '); },
});
\`\`\`

A \`computed\` is lazy (the getter does not run until something reads \`.value\`), cached (repeat reads with unchanged dependencies do not re-run it) and trackable (an effect reading a computed re-runs when the computed invalidates). Keep the getter **pure** — no fetching, no mutation, no \`Date.now()\`.

## watch vs watchEffect

\`watch\` is for **side effects**, not derived values. If you find yourself writing a watcher whose only job is to assign another ref, you wanted \`computed\`.

\`\`\`js
// Explicit source, lazy by default, gives you old and new values
watch(query, async (newQuery, oldQuery) => {
  results.value = await search(newQuery);
}, { immediate: true });

// A getter source, multiple sources, and deep traversal
watch(() => user.address.city, (city) => track(city));
watch([first, last], ([f, l], [prevF, prevL]) => console.log(f, l));
watch(user, handler, { deep: true });

// Automatic dependency collection; runs immediately
watchEffect((onCleanup) => {
  const controller = new AbortController();
  onCleanup(() => controller.abort());
  fetch('/api/inbox?user=' + userId.value, { signal: controller.signal });
});
\`\`\`

| | \`watch\` | \`watchEffect\` |
| --- | --- | --- |
| Dependencies | explicit source | collected automatically on first run |
| First run | lazy (unless \`immediate\`) | immediate, always |
| Old value | yes | no |
| Best for | reacting to one specific value | keeping something in sync with several |

Three details that matter in production. **\`deep: true\` is not free** — it walks the whole object on every check, so watch a getter for the specific field where you can. **\`onCleanup\` runs before the next invocation and on unmount**, which is how you cancel an in-flight request and avoid an out-of-order response overwriting a newer one. And **both auto-stop when the owning component unmounts**, but only if you created them synchronously inside \`setup\`; a watcher created inside a \`setTimeout\` leaks and must be stopped by hand with the function it returns.

## shallowRef, shallowReactive and friends

Deep reactivity is convenient and, for big payloads, wasteful. Vue proxies nested objects lazily but it still proxies them.

- **\`shallowRef(value)\`** tracks only reassignment of \`.value\`. Mutating a property inside triggers nothing. Ideal for a large fetched response, a chart instance, a Map you replace wholesale, or a third-party class you must not proxy.
- **\`shallowReactive(obj)\`** tracks only root-level properties.
- **\`markRaw(obj)\`** permanently opts an object out of reactivity — the correct fix when a library instance misbehaves inside \`reactive\`.
- **\`readonly(obj)\`** returns a proxy that warns on writes; pair it with \`provide\` so descendants can read but not mutate.
- **\`triggerRef(shallow)\`** forces subscribers to re-run after you mutated a \`shallowRef\` in place on purpose.

\`\`\`js
const rows = shallowRef([]);
rows.value.push(newRow);        // no update: mutation is invisible
rows.value = [...rows.value, newRow];  // update: the ref itself changed
\`\`\`

## Lifecycle

\`\`\`js
import { onMounted, onUnmounted, onUpdated, onErrorCaptured, nextTick } from 'vue';

onMounted(() => { chart = new Chart(el.value); });
onUnmounted(() => { chart.destroy(); });

await nextTick();   // wait for the DOM to reflect the state you just set
\`\`\`

| React | Vue |
| --- | --- |
| \`useEffect(fn, [])\` | \`onMounted\` |
| cleanup returned from \`useEffect\` | \`onUnmounted\` |
| \`useEffect(fn, [dep])\` | \`watch(dep, fn)\` |
| \`useEffect(fn)\` with no array | \`onUpdated\` / \`watchEffect\` |
| error boundary component | \`onErrorCaptured\` |
| \`flushSync\` / \`useLayoutEffect\` | \`nextTick\` / \`watch(..., { flush: 'post' })\` |

Vue batches state changes and flushes them on a microtask, so the DOM is *not* updated on the line after you set a ref. \`await nextTick()\` is how you measure or focus an element that only just appeared.`,
    },
    {
      slug: 'props-emits-slots-composables',
      title: 'Component Contracts: Props, Emits, Slots, Composables and provide/inject',
      estimatedMinutes: 90,
      body: `# Component Contracts: Props, Emits, Slots, Composables and provide/inject

## Props down, events up

Data goes **down** through props, events go **up** through emits. Props are read-only — mutating one logs a warning, because the parent owns that value.

\`\`\`vue
<!-- TodoItem.vue -->
<script setup>
const props = defineProps({
  todo: { type: Object, required: true },
  dense: { type: Boolean, default: false },
  tags: { type: Array, default: () => [] },   // object/array defaults need a factory
});

const emit = defineEmits({
  toggle: (id) => typeof id === 'number',     // object form validates the payload
  remove: null,
});
</script>

<template>
  <li :class="{ dense: props.dense }">
    <input type="checkbox" :checked="todo.done" @change="emit('toggle', todo.id)" />
    {{ todo.text }}
    <button @click="emit('remove', todo.id)">Remove</button>
  </li>
</template>
\`\`\`

An emit is Vue's version of an \`onToggle\` callback prop, with two advantages: the child does not need the parent to pass anything, and the events are declared, so tooling can check them. Anything the parent puts on the tag that is *not* a declared prop or emit becomes a **fallthrough attribute** and lands on the root element automatically — which is why \`<MyButton class="primary" @focus="...">\` just works. Turn that off with \`defineOptions({ inheritAttrs: false })\` and place \`v-bind="$attrs"\` yourself when the root is a wrapper.

## v-model on a component

\`v-model\` on a component is sugar over one prop plus one event. In Vue 3.4+ the ergonomic form is \`defineModel()\`, which returns a **writable ref**: reading it reads the \`modelValue\` prop, writing it emits \`update:modelValue\`.

\`\`\`vue
<script setup>
const model = defineModel();                       // <MyInput v-model="name" />
const title = defineModel('title', { default: '' }); // <MyInput v-model:title="t" />
</script>

<template>
  <input :value="model" @input="model = $event.target.value" />
</template>
\`\`\`

Named models are how one component exposes several two-way bindings — a date-range picker with \`v-model:start\` and \`v-model:end\` needs no callback props at all.

## Slots

Slots are Vue's \`children\`. A **default slot** takes whatever the parent nests inside the tag; **named slots** carve out several holes; **scoped slots** let the child hand data *back* to the parent's markup — Vue's equivalent of a render prop.

\`\`\`vue
<!-- Card.vue -->
<template>
  <section class="card">
    <header><slot name="header">Untitled</slot></header>
    <slot />                                    <!-- default slot -->
    <footer v-if="$slots.footer"><slot name="footer" /></footer>
  </section>
</template>

<!-- DataList.vue: a scoped slot -->
<template>
  <ul>
    <li v-for="(item, index) in items" :key="item.id">
      <slot name="row" :item="item" :index="index" />
    </li>
  </ul>
</template>
\`\`\`

\`\`\`vue
<Card>
  <template #header><h2>Invoice</h2></template>
  <p>Body content goes into the default slot.</p>
  <template #footer><button>Pay</button></template>
</Card>

<DataList :items="users">
  <template #row="{ item, index }">
    <strong>{{ index + 1 }}. {{ item.name }}</strong>
  </template>
</DataList>
\`\`\`

Content between \`<slot>\` tags is **fallback**, rendered when the parent supplies nothing — nicer than React's \`children ?? <Fallback />\`. \`$slots.footer\` tells you at runtime whether the parent passed that slot, so you can skip rendering an empty wrapper. A component whose entire template is a scoped slot is a **renderless component**: all logic, no markup, the parent decides everything.

## Composables

A composable is Vue's custom hook: a function named \`useSomething\` that creates reactive state and returns it. There is no rules-of-hooks restriction on *ordering* or conditionals, but a composable that registers lifecycle hooks or watchers must be called **synchronously inside \`setup\`** so Vue knows which component owns them.

\`\`\`js
// useFetch.js
import { ref, watchEffect, toValue } from 'vue';

export function useFetch(url) {
  const data = ref(null);
  const error = ref(null);
  const loading = ref(false);

  watchEffect(async (onCleanup) => {
    const controller = new AbortController();
    onCleanup(() => controller.abort());

    loading.value = true;
    try {
      const res = await fetch(toValue(url), { signal: controller.signal });
      data.value = await res.json();
    } catch (e) {
      if (e.name !== 'AbortError') error.value = e;
    } finally {
      loading.value = false;
    }
  });

  return { data, error, loading };
}
\`\`\`

\`toValue\` accepts a plain value, a ref, or a getter, so callers can write \`useFetch('/api/users')\` **or** \`useFetch(() => '/api/users/' + id.value)\` and the second form refetches automatically when \`id\` changes. Accepting \`MaybeRefOrGetter\` is the convention every good Vue library follows.

Two rules make composables composable: **return refs, not raw values** (so destructuring at the call site keeps reactivity), and **clean up what you create** with \`onCleanup\` or \`onUnmounted\`. Everything you know about custom hooks transfers; you just lose the dependency arrays.

## provide / inject

\`provide\` and \`inject\` are Vue's dependency injection — the analogue of React Context, and the right tool for the same narrow set of problems: theme, locale, the current user, a form context shared by deeply nested fields.

\`\`\`js
// Ancestor
import { provide, ref, readonly } from 'vue';

const theme = ref('dark');
provide('theme', readonly(theme));                  // descendants read only
provide('setTheme', (value) => { theme.value = value; });

// Any descendant, at any depth
import { inject } from 'vue';
const theme = inject('theme', 'light');             // second arg is a default
const setTheme = inject('setTheme');
\`\`\`

Provide a **ref**, not its \`.value\`, or descendants get a dead snapshot. Provide a \`readonly\` wrapper plus a mutator function so state can only change in one place. Use a \`Symbol\` as the key in a library to avoid collisions, and type it with \`InjectionKey<T>\` in TypeScript.

The important difference from React Context: because Vue's reactivity is fine-grained, an injected ref changing re-renders only the components that actually *read* it. There is no "every consumer re-renders" problem — but injection is still invisible coupling, so a component that injects something is a component you cannot render in isolation without a provider.`,
    },
    {
      slug: 'router-pinia-and-react-map',
      title: 'Vue Router, Pinia, and the React Mental Map',
      estimatedMinutes: 80,
      body: `# Vue Router, Pinia, and the React Mental Map

## Vue Router

Routing is an official package, so every Vue app routes the same way.

\`\`\`js
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', component: () => import('./views/Home.vue') },
  {
    path: '/users/:id',
    name: 'user',
    component: () => import('./views/User.vue'),
    props: true,                        // pass :id as a prop instead of reading route.params
    children: [{ path: 'posts', component: UserPosts }],
  },
  { path: '/admin', component: Admin, meta: { requiresAuth: true } },
  { path: '/:pathMatch(.*)*', component: NotFound },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isLoggedIn()) {
    return { name: 'login', query: { next: to.fullPath } };
  }
});
\`\`\`

A guard returning \`false\` cancels the navigation, returning a location object redirects, and returning nothing lets it through. Per-route \`beforeEnter\` and in-component \`onBeforeRouteLeave\` handle the "you have unsaved changes" case.

\`\`\`vue
<script setup>
import { useRoute, useRouter } from 'vue-router';
const route = useRoute();     // reactive: route.params.id, route.query.page
const router = useRouter();   // imperative: router.push, router.replace, router.back
</script>

<template>
  <RouterLink :to="{ name: 'user', params: { id: 7 } }" active-class="on">Profile</RouterLink>
  <RouterView />
</template>
\`\`\`

> The gotcha: navigating from \`/users/1\` to \`/users/2\` **reuses the component instance**, so \`onMounted\` does not fire again. Watch the param instead — \`watch(() => route.params.id, loadUser, { immediate: true })\` — or force a remount with \`:key="route.fullPath"\` on \`<RouterView>\`. This is the exact analogue of React Router handing you a new \`useParams()\` value without remounting.

Lazy \`component: () => import(...)\` is how you code-split; Vite turns each one into its own chunk automatically.

## Pinia in a component

Pinia is the official store, and day 10 covered its API. What matters here is how it meets a component.

\`\`\`vue
<script setup>
import { storeToRefs } from 'pinia';
import { useCartStore } from '@/stores/cart';

const cart = useCartStore();

// State and getters lose reactivity if you destructure them directly.
const { items, total } = storeToRefs(cart);

// Actions are plain functions, so destructure those straight off the store.
const { addItem, checkout } = cart;
</script>

<template>
  <p>{{ items.length }} items — {{ total }}</p>
  <button @click="addItem({ sku: 'A', price: 10, qty: 1 })">Add</button>
  <button :disabled="items.length === 0" @click="checkout">Checkout</button>
</template>
\`\`\`

Because a setup store is literally a function using \`ref\` and \`computed\`, a Pinia store *is* a composable with an identity: \`defineStore\` guarantees one instance per app, gives it DevTools integration, and adds \`$patch\`, \`$reset\`, \`$subscribe\` and \`$onAction\`. Anything smaller than that — state used by one subtree — should stay a plain composable.

## Teleport, Suspense and KeepAlive in practice

\`\`\`vue
<template>
  <Teleport to="body">
    <div v-if="open" class="modal" role="dialog" aria-modal="true">
      <slot />
    </div>
  </Teleport>

  <Suspense>
    <template #default><UserProfile :id="id" /></template>
    <template #fallback><Skeleton /></template>
  </Suspense>

  <KeepAlive :max="5" include="EditorTab">
    <component :is="currentTab" />
  </KeepAlive>
</template>
\`\`\`

\`<Teleport>\` moves DOM position only — the component stays a logical child, so props, emits and \`inject\` still work, and the modal escapes any ancestor's \`overflow: hidden\` or stacking context. \`<Suspense>\` waits for \`async setup()\` in descendants; it is still marked experimental, so most teams drive loading states from a composable's \`loading\` ref instead. \`<KeepAlive>\` caches instead of destroying, so a tab keeps its scroll position and its unsaved input, and gets \`onActivated\` / \`onDeactivated\` instead of mount / unmount.

## The React mental map

Everything below is the same idea wearing two costumes. Once you can read this table, "learning Vue" is a weekend, not a quarter.

| Concept | React | Vue 3 |
| --- | --- | --- |
| Component unit | function returning JSX | \`.vue\` SFC with \`<script setup>\` |
| Runs per render? | the whole function body | only the template; \`setup\` runs once |
| Local state | \`useState\` | \`ref\` / \`reactive\` |
| Read a state value | \`count\` | \`count.value\` in JS, \`count\` in template |
| Derived value | \`useMemo\` | \`computed\` (no dependency array) |
| Stable callback | \`useCallback\` | not needed — \`setup\` runs once |
| Side effect | \`useEffect\` | \`watchEffect\` / \`watch\` |
| Mount / unmount | \`useEffect(fn, [])\` + cleanup | \`onMounted\` / \`onUnmounted\` |
| DOM node handle | \`useRef\` | \`ref\` + matching \`ref="name"\` attribute |
| Reuse logic | custom hook | composable |
| Data in | props | \`defineProps\` |
| Data out | callback prop | \`defineEmits\` |
| Two-way binding | value + onChange by hand | \`v-model\` / \`defineModel\` |
| Children | \`props.children\` | \`<slot>\` |
| Render prop | function as a child | scoped slot |
| Dependency injection | Context | \`provide\` / \`inject\` |
| Conditional render | \`{cond && <X/>}\` | \`v-if\` / \`v-show\` |
| List render | \`items.map()\` + \`key\` | \`v-for\` + \`:key\` |
| Portal | \`createPortal\` | \`<Teleport>\` |
| Router | React Router | Vue Router (official) |
| Global state | Redux / Zustand | Pinia (official) |
| Update model | re-render + VDOM diff | fine-grained tracking + compiled template |
| Escape hatch for perf | \`memo\`, \`useMemo\`, \`useCallback\` | \`shallowRef\`, \`v-memo\`, \`v-once\` |

Two places the mapping genuinely breaks down, and they are worth internalising:

1. **\`setup\` runs once.** In React, every value in your component body is recreated on every render, which is why memoisation is a daily concern. In Vue the setup block is an initialiser; only the compiled template re-runs, and only for the nodes marked dynamic. Most React performance advice simply does not apply.
2. **Mutation is fine.** \`state.items.push(x)\` is idiomatic Vue and a bug in React. Vue's proxies observe the mutation; React compares references and sees nothing. Carrying React's immutability habits into Vue is harmless; carrying Vue's mutation habits into React is not.

## Where to go next

The Vue ecosystem is small and official, which is the point: Vite for the build, Vue Router for routing, Pinia for state, Vitest for tests, Nuxt when you want SSR and file-based routing, and VueUse for the two hundred composables you would otherwise write yourself. There is very little to choose between, and that is a feature.`,
    },
  ],
  quiz: [
    {
      prompt: 'What is the difference between `v-if` and `v-show`?',
      options: [
        '`v-if` removes and recreates the element from the DOM; `v-show` keeps it and toggles `display`',
        '`v-show` only works inside `v-for`',
        '`v-if` is reactive; `v-show` evaluates once',
        'They are aliases; `v-show` is the older spelling',
      ],
      correctIndex: 0,
      explanation:
        '`v-if` is truly conditional rendering with mount/unmount cost, so it is right when the condition rarely flips. `v-show` always renders and just flips a CSS display, so it is cheaper to toggle frequently.',
      difficulty: 'EASY',
    },
    {
      prompt: 'In a `<script setup>` block, `const count = ref(0)`. Which line is correct?',
      options: [
        '`count += 1` in script, `{{ count.value }}` in template',
        '`count.value += 1` in script, `{{ count }}` in template',
        '`count.value += 1` in script, `{{ count.value }}` in template',
        '`count += 1` in script, `{{ count }}` in template',
      ],
      correctIndex: 1,
      explanation:
        'A ref is a box: you go through `.value` in JavaScript. Templates auto-unwrap top-level refs, so you write the bare name there. Forgetting `.value` in script is the single most common Vue mistake — `if (count)` on a ref is always truthy.',
      difficulty: 'EASY',
    },
    {
      prompt: 'You need a value derived from two refs, recomputed only when they change. Which API?',
      options: ['watch with immediate: true', 'computed', 'watchEffect assigning to a third ref', 'onUpdated'],
      correctIndex: 1,
      explanation:
        '`computed` is cached, lazy and auto-tracked. A watcher whose only job is to assign another ref is a code smell — it runs later, can loop, and gives you a value that is briefly stale.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'A Vue Router navigation from /users/1 to /users/2 does not reload the profile. Why?',
      options: [
        'The route needs `props: true`',
        'You must call router.go(0)',
        'Vue Router caches responses by default',
        'The component instance is reused because the matched route is the same, so onMounted does not fire again',
      ],
      correctIndex: 3,
      explanation:
        'Only the params changed, so Vue reuses the instance for efficiency. Watch the param — `watch(() => route.params.id, load, { immediate: true })` — or force a remount with `:key="route.fullPath"` on <RouterView>.',
      difficulty: 'HARD',
    },
    {
      prompt: 'A composable does `const { count } = reactive({ count: 0 })` and returns `count`. Callers never see updates. Why?',
      options: [
        'reactive() only accepts arrays and Maps',
        'The composable must be called inside onMounted',
        'Destructuring a reactive object copies the current primitive out of the proxy, breaking the tracking link; use toRefs/toRef',
        'reactive() is deprecated in favour of shallowReactive',
      ],
      correctIndex: 2,
      explanation:
        'Reactivity lives in the Proxy, not in the value. `toRefs(state)` (or `toRef(state, "count")`) hands back live refs bound to the original object, which is why composables should return refs rather than raw values.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What does `defineModel()` give you in a `<script setup>` component?',
      options: [
        'A writable ref backed by a `modelValue` prop and an `update:modelValue` emit',
        'A private ref that is never shared with the parent',
        'A read-only snapshot of the parent value taken at mount',
        'A Pinia store scoped to this component instance',
      ],
      correctIndex: 0,
      explanation:
        '`defineModel()` is 3.4+ sugar for the prop-plus-event pair that `v-model` on a component has always compiled to. Reading it reads the prop; assigning to it emits the update. `defineModel("title")` creates a named model for `v-model:title`.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'A child renders `<slot name="row" :item="item" />`. How does the parent consume that data?',
      options: [
        '<template #row>{{ item.name }}</template>',
        '<slot #row="{ item }">{{ item.name }}</slot>',
        '<template v-slot:item="row">{{ row.name }}</template>',
        '<template #row="{ item }">{{ item.name }}</template>',
      ],
      correctIndex: 3,
      explanation:
        'A scoped slot passes props out of the child. The parent names the slot with `#row` and destructures the slot props in the value: `#row="{ item }"`. Without the value the slot content has no access to `item`.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'When is `watchEffect` the better choice over `watch`?',
      options: [
        'When you need the previous value of the source',
        'When the callback must not run until after the first change',
        'When you want dependencies collected automatically and an immediate first run, and you do not need the old value',
        'When the source is a deeply nested object',
      ],
      correctIndex: 2,
      explanation:
        '`watchEffect` runs once straight away and re-runs whenever anything it read changes — no explicit source, no old value. Use `watch` when you need laziness, the previous value, or a precisely scoped source.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'mustache-interpolation',
      title: 'Vue-Style Template Interpolation',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Every template language starts here. Implement \`renderTemplate(template, scope)\` which replaces each \`{{ path }}\` placeholder with the value at that path in \`scope\`.

Rules:

1. A placeholder is \`{{\` … \`}}\`. Surrounding whitespace inside the braces is ignored, so \`{{name}}\` and \`{{  name  }}\` behave identically.
2. The path is dot-separated and may walk objects **and arrays**: \`user.address.city\`, \`items.1\`.
3. A missing or \`null\`/\`undefined\` value renders as the **empty string** — and walking into a missing object must not throw.
4. Any other value is stringified, so \`0\` renders \`"0"\` and \`false\` renders \`"false"\`.
5. Text outside placeholders is untouched, and there may be any number of placeholders.

\`\`\`js
renderTemplate('Hello {{ name }}!', { name: 'Ada' });              // 'Hello Ada!'
renderTemplate('{{ user.address.city }}', { user: { address: { city: 'Oslo' } } }); // 'Oslo'
renderTemplate('[{{ missing.deep }}]', {});                        // '[]'
renderTemplate('{{ items.1 }}', { items: ['a', 'b'] });            // 'b'
\`\`\``,
      starterCode: `function renderTemplate(template, scope) {
  // Replace every {{ path }} with the resolved value from scope.
  return template;
}

module.exports = { renderTemplate };`,
      solutionCode: `function renderTemplate(template, scope) {
  return String(template).replace(/\\{\\{\\s*([^{}]+?)\\s*\\}\\}/g, (_match, path) => {
    const value = path
      .split('.')
      .reduce(
        (acc, key) => (acc === null || acc === undefined ? undefined : acc[key]),
        scope
      );

    return value === undefined || value === null ? '' : String(value);
  });
}

module.exports = { renderTemplate };`,
      hints: [
        'A global regex with a replacer function is the shortest route: String.prototype.replace(/pattern/g, (match, group) => ...).',
        'Use a non-greedy capture so `{{a}}-{{b}}` matches twice instead of once across the whole string.',
        'Resolve the path with reduce, short-circuiting to undefined as soon as the accumulator is null or undefined.',
        'Only undefined and null become the empty string — 0 and false must still render.',
      ],
      tests: [
        {
          name: 'replaces a simple placeholder',
          assertion: "solution.renderTemplate('Hello {{ name }}!', {name:'Ada'}) === 'Hello Ada!'",
        },
        {
          name: 'tolerates missing whitespace',
          assertion: "solution.renderTemplate('{{name}}', {name:'Vue'}) === 'Vue'",
        },
        {
          name: 'resolves dotted paths',
          assertion:
            "solution.renderTemplate('{{ user.address.city }}', {user:{address:{city:'Oslo'}}}) === 'Oslo'",
        },
        {
          name: 'missing paths render empty and do not throw',
          assertion: "solution.renderTemplate('[{{ nope.deep.deeper }}]', {}) === '[]'",
        },
        {
          name: 'handles several placeholders including repeats',
          assertion: "solution.renderTemplate('{{a}}-{{b}}-{{a}}', {a:1,b:2}) === '1-2-1'",
        },
        {
          name: 'falsy values still render',
          assertion: "solution.renderTemplate('{{ n }} {{ ok }}', {n:0, ok:false}) === '0 false'",
        },
        {
          name: 'null renders as empty string',
          assertion: "solution.renderTemplate('x{{v}}y', {v:null}) === 'xy'",
          hidden: true,
        },
        {
          name: 'array indexes work',
          assertion: "solution.renderTemplate('{{ items.1 }}', {items:['a','b']}) === 'b'",
          hidden: true,
        },
        {
          name: 'text without placeholders is unchanged',
          assertion:
            "solution.renderTemplate('plain text, no braces', {a:1}) === 'plain text, no braces'",
          hidden: true,
        },
      ],
      xp: 40,
    },
    {
      slug: 'reactivity-ref-computed-effect',
      title: 'Build Vue-Style Reactivity',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `This is the engine behind Vue's \`ref\`, \`computed\` and \`watchEffect\`. Build a dependency-tracking reactivity system exporting \`ref\`, \`reactive\`, \`computed\` and \`effect\`.

**\`effect(fn, options?)\`** runs \`fn\` immediately (unless \`options.lazy\`), recording every reactive value read during that run. It returns a runner you can call again. When a recorded dependency changes, the effect re-runs — or, if \`options.scheduler\` was given, the scheduler is called instead.

**\`ref(value)\`** returns \`{ value }\` where the getter tracks the current effect and the setter triggers dependents. Setting the **same** value (\`Object.is\`) must trigger nothing.

**\`reactive(obj)\`** is the same idea for objects, tracked **per property**, so an effect reading only \`state.a\` must not re-run when \`state.b\` changes.

**\`computed(getter)\`** returns \`{ value }\` that is:
- **lazy** — the getter does not run until \`.value\` is first read,
- **cached** — repeated reads with no dependency change do not re-run the getter,
- **invalidated** — when a dependency changes it is marked dirty and recomputes on the next read,
- **trackable** — an effect reading \`computed.value\` re-runs when the computed's value is invalidated.

\`\`\`js
const count = ref(0);
const double = computed(() => count.value * 2);
const seen = [];
effect(() => { seen.push(double.value); });   // seen: [0]
count.value = 3;                              // seen: [0, 6]
count.value = 3;                              // unchanged — no rerun
\`\`\``,
      starterCode: `let activeEffect = null;
const targetMap = new WeakMap();   // target -> Map<key, Set<effectRunner>>

function track(target, key) {
  // record activeEffect as a dependent of target[key]
}

function trigger(target, key) {
  // run (or schedule) every effect that depends on target[key]
}

function effect(fn, options = {}) {}
function ref(initial) {}
function reactive(target) {}
function computed(getter) {}

module.exports = { ref, reactive, computed, effect };`,
      solutionCode: `let activeEffect = null;
const targetMap = new WeakMap();

function track(target, key) {
  if (!activeEffect) return;
  let depsForTarget = targetMap.get(target);
  if (!depsForTarget) {
    depsForTarget = new Map();
    targetMap.set(target, depsForTarget);
  }
  let dep = depsForTarget.get(key);
  if (!dep) {
    dep = new Set();
    depsForTarget.set(key, dep);
  }
  dep.add(activeEffect);
}

function trigger(target, key) {
  const depsForTarget = targetMap.get(target);
  if (!depsForTarget) return;
  const dep = depsForTarget.get(key);
  if (!dep) return;
  // Copy first: a running effect may re-track and mutate the set.
  for (const runner of Array.from(dep)) {
    if (runner.scheduler) runner.scheduler();
    else runner();
  }
}

function effect(fn, options = {}) {
  const runner = () => {
    const parent = activeEffect;
    activeEffect = runner;
    try {
      return fn();
    } finally {
      activeEffect = parent;
    }
  };
  runner.scheduler = options.scheduler;
  if (!options.lazy) runner();
  return runner;
}

function ref(initial) {
  let value = initial;
  const box = {
    get value() {
      track(box, 'value');
      return value;
    },
    set value(next) {
      if (Object.is(next, value)) return;
      value = next;
      trigger(box, 'value');
    },
  };
  return box;
}

function reactive(target) {
  return new Proxy(target, {
    get(obj, key, receiver) {
      track(obj, key);
      return Reflect.get(obj, key, receiver);
    },
    set(obj, key, next, receiver) {
      const previous = obj[key];
      const ok = Reflect.set(obj, key, next, receiver);
      if (!Object.is(previous, next)) trigger(obj, key);
      return ok;
    },
  });
}

function computed(getter) {
  let value;
  let dirty = true;

  const runner = effect(getter, {
    lazy: true,
    scheduler: () => {
      if (dirty) return;
      dirty = true;
      trigger(box, 'value');   // tell effects that read this computed
    },
  });

  const box = {
    get value() {
      if (dirty) {
        value = runner();
        dirty = false;
      }
      track(box, 'value');
      return value;
    },
  };

  return box;
}

module.exports = { ref, reactive, computed, effect };`,
      hints: [
        'One module-level `activeEffect` variable is the whole trick: the getter knows who is reading because the runner set it before calling fn.',
        'Save and restore the previous activeEffect around each run, otherwise a computed evaluated inside an effect wipes the outer effect out.',
        'targetMap: WeakMap<target, Map<key, Set<runner>>>. ref can use itself as the target and the literal string "value" as the key.',
        'computed needs a lazy effect plus a scheduler. The scheduler does not recompute — it only flips a dirty flag and triggers the computed’s own dependents.',
        'Iterate over a copy of the dependency Set when triggering: an effect that re-runs will re-track itself into the same Set.',
      ],
      tests: [
        {
          name: 'effect runs once immediately',
          assertion:
            "(() => { let n=0; const c = solution.ref(0); solution.effect(()=>{ c.value; n+=1; }); return n===1; })()",
        },
        {
          name: 'effect re-runs when a dependency changes',
          assertion:
            "(() => { const c = solution.ref(0); const seen=[]; solution.effect(()=>{ seen.push(c.value); }); c.value=1; c.value=2; return deepEqual(seen,[0,1,2]); })()",
        },
        {
          name: 'setting the same value does not re-run',
          assertion:
            "(() => { let n=0; const c = solution.ref(1); solution.effect(()=>{ c.value; n+=1; }); c.value=1; return n===1; })()",
        },
        {
          name: 'unread refs do not trigger the effect',
          assertion:
            "(() => { let n=0; const a=solution.ref(0); const b=solution.ref(0); solution.effect(()=>{ a.value; n+=1; }); b.value=5; return n===1; })()",
        },
        {
          name: 'computed is lazy',
          assertion:
            "(() => { let n=0; const a=solution.ref(2); const d=solution.computed(()=>{ n+=1; return a.value*2; }); const before=n; return before===0 && d.value===4 && n===1; })()",
        },
        {
          name: 'computed caches repeated reads',
          assertion:
            "(() => { let n=0; const a=solution.ref(2); const d=solution.computed(()=>{ n+=1; return a.value*2; }); d.value; d.value; d.value; return n===1; })()",
        },
        {
          name: 'computed recomputes after its dependency changes',
          assertion:
            "(() => { let n=0; const a=solution.ref(2); const d=solution.computed(()=>{ n+=1; return a.value*2; }); d.value; a.value=5; return d.value===10 && n===2; })()",
        },
        {
          name: 'an effect reading a computed re-runs',
          assertion:
            "(() => { const a=solution.ref(1); const d=solution.computed(()=>a.value*10); const seen=[]; solution.effect(()=>{ seen.push(d.value); }); a.value=3; return deepEqual(seen,[10,30]); })()",
          hidden: true,
        },
        {
          name: 'reactive objects track per property',
          assertion:
            "(() => { const s=solution.reactive({a:0,b:0}); let n=0; solution.effect(()=>{ s.a; n+=1; }); s.b=9; s.a=1; s.a=1; return n===2; })()",
          hidden: true,
        },
        {
          name: 'reactive drives an effect end to end',
          assertion:
            "(() => { const s=solution.reactive({count:0}); const seen=[]; solution.effect(()=>{ seen.push(s.count); }); s.count=1; s.count=2; return deepEqual(seen,[0,1,2]); })()",
          hidden: true,
        },
        {
          name: 'computed of a computed stays correct',
          assertion:
            "(() => { const a=solution.ref(1); const d=solution.computed(()=>a.value+1); const q=solution.computed(()=>d.value*2); const first=q.value; a.value=4; return first===4 && q.value===10; })()",
          hidden: true,
        },
      ],
      xp: 90,
    },
    {
      slug: 'vue-watch-with-deep-and-cleanup',
      title: 'Implement Vue watch: deep, immediate and onCleanup',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `A working reactivity core is provided (\`ref\`, \`reactive\`, \`effect\`, \`stop\`). Build \`watch(source, callback, options)\` on top of it — the API you reach for every day in Vue, minus the async flush queue (here the callback runs synchronously).

**\`source\`** may be:

- a **ref** — anything with a \`.value\`,
- a **getter function** — \`() => state.user.name\`,
- an **array** of refs and/or getters, in which case the callback receives arrays of new and old values.

**\`callback(newValue, oldValue, onCleanup)\`** runs when the watched value changes.

Required behaviour:

1. **Lazy by default.** Nothing runs at setup time. With \`options.immediate\` the callback fires once straight away, with \`oldValue === undefined\`.
2. **Change detection.** Compare with \`Object.is\` (element-wise for an array source) and do **not** call the callback when the value is unchanged — a getter such as \`() => count.value > 5\` must stay quiet while the boolean stays the same.
3. **\`options.deep\`** traverses the new value so nested mutations are tracked, and makes every trigger fire the callback (a mutated object is reference-equal to itself).
4. **\`onCleanup(fn)\`** registers a teardown that runs **before the next callback invocation** and when the watcher is stopped. This is how you abort an in-flight request.
5. **The return value is a \`stop()\` function** that detaches the watcher and runs any pending cleanup.

\`\`\`js
const count = ref(0);
const stop = watch(count, (next, prev, onCleanup) => {
  const id = setTimeout(() => console.log(next), 100);
  onCleanup(() => clearTimeout(id));
});

count.value = 1;   // callback runs with (1, 0)
stop();            // detached, pending timeout cleared
\`\`\``,
      starterCode: `// ---- Provided reactivity core - do not change. ----
let activeEffect = null;
const targetMap = new WeakMap();
const proxyCache = new WeakMap();

function track(target, key) {
  if (!activeEffect) return;
  let deps = targetMap.get(target);
  if (!deps) { deps = new Map(); targetMap.set(target, deps); }
  let dep = deps.get(key);
  if (!dep) { dep = new Set(); deps.set(key, dep); }
  dep.add(activeEffect);
  activeEffect.deps.push(dep);
}

function trigger(target, key) {
  const deps = targetMap.get(target);
  if (!deps) return;
  const dep = deps.get(key);
  if (!dep) return;
  for (const runner of Array.from(dep)) {
    if (runner.scheduler) runner.scheduler();
    else runner();
  }
}

function cleanupDeps(runner) {
  for (const dep of runner.deps) dep.delete(runner);
  runner.deps.length = 0;
}

function effect(fn, options = {}) {
  const runner = () => {
    cleanupDeps(runner);
    const parent = activeEffect;
    activeEffect = runner;
    try { return fn(); } finally { activeEffect = parent; }
  };
  runner.deps = [];
  runner.scheduler = options.scheduler;
  runner.active = true;
  if (!options.lazy) runner();
  return runner;
}

function stop(runner) {
  if (!runner.active) return;
  cleanupDeps(runner);
  runner.active = false;
}

function ref(initial) {
  const box = {
    get value() { track(box, 'value'); return initial; },
    set value(next) {
      if (Object.is(next, initial)) return;
      initial = next;
      trigger(box, 'value');
    },
  };
  return box;
}

function reactive(target) {
  if (proxyCache.has(target)) return proxyCache.get(target);
  const proxy = new Proxy(target, {
    get(obj, key) {
      track(obj, key);
      const value = obj[key];
      return value !== null && typeof value === 'object' ? reactive(value) : value;
    },
    set(obj, key, next) {
      const prev = obj[key];
      obj[key] = next;
      if (!Object.is(prev, next)) trigger(obj, key);
      return true;
    },
  });
  proxyCache.set(target, proxy);
  return proxy;
}

// ---- Your code ----

function traverse(value, seen = new Set()) {
  // Read every nested property so the running effect tracks them all, then return value.
  return value;
}

function watch(source, callback, options = {}) {
  // 1. Normalise source into a single getter.
  // 2. Wrap it in traverse() when options.deep.
  // 3. Create a lazy effect whose scheduler decides whether to call the callback.
  return () => {};
}

module.exports = { ref, reactive, effect, stop, watch };`,
      solutionCode: `// ---- Provided reactivity core - do not change. ----
let activeEffect = null;
const targetMap = new WeakMap();
const proxyCache = new WeakMap();

function track(target, key) {
  if (!activeEffect) return;
  let deps = targetMap.get(target);
  if (!deps) { deps = new Map(); targetMap.set(target, deps); }
  let dep = deps.get(key);
  if (!dep) { dep = new Set(); deps.set(key, dep); }
  dep.add(activeEffect);
  activeEffect.deps.push(dep);
}

function trigger(target, key) {
  const deps = targetMap.get(target);
  if (!deps) return;
  const dep = deps.get(key);
  if (!dep) return;
  for (const runner of Array.from(dep)) {
    if (runner.scheduler) runner.scheduler();
    else runner();
  }
}

function cleanupDeps(runner) {
  for (const dep of runner.deps) dep.delete(runner);
  runner.deps.length = 0;
}

function effect(fn, options = {}) {
  const runner = () => {
    cleanupDeps(runner);
    const parent = activeEffect;
    activeEffect = runner;
    try { return fn(); } finally { activeEffect = parent; }
  };
  runner.deps = [];
  runner.scheduler = options.scheduler;
  runner.active = true;
  if (!options.lazy) runner();
  return runner;
}

function stop(runner) {
  if (!runner.active) return;
  cleanupDeps(runner);
  runner.active = false;
}

function ref(initial) {
  const box = {
    get value() { track(box, 'value'); return initial; },
    set value(next) {
      if (Object.is(next, initial)) return;
      initial = next;
      trigger(box, 'value');
    },
  };
  return box;
}

function reactive(target) {
  if (proxyCache.has(target)) return proxyCache.get(target);
  const proxy = new Proxy(target, {
    get(obj, key) {
      track(obj, key);
      const value = obj[key];
      return value !== null && typeof value === 'object' ? reactive(value) : value;
    },
    set(obj, key, next) {
      const prev = obj[key];
      obj[key] = next;
      if (!Object.is(prev, next)) trigger(obj, key);
      return true;
    },
  });
  proxyCache.set(target, proxy);
  return proxy;
}

// ---- Your code ----

function traverse(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Object.keys(value)) traverse(value[key], seen);
  return value;
}

function watch(source, callback, options = {}) {
  const immediate = Boolean(options.immediate);
  const deep = Boolean(options.deep);

  const toGetter = (entry) => (typeof entry === 'function' ? entry : () => entry.value);
  let getter = Array.isArray(source)
    ? () => source.map((entry) => toGetter(entry)())
    : toGetter(source);

  if (deep) {
    const base = getter;
    getter = () => traverse(base());
  }

  const INITIAL = Symbol('initial');
  let oldValue = INITIAL;
  let cleanup = null;

  const onCleanup = (fn) => { cleanup = fn; };
  const runCleanup = () => {
    if (!cleanup) return;
    const fn = cleanup;
    cleanup = null;
    fn();
  };

  const changed = (next, prev) => {
    if (prev === INITIAL || deep) return true;
    if (Array.isArray(next) && Array.isArray(prev)) {
      return next.some((value, i) => !Object.is(value, prev[i]));
    }
    return !Object.is(next, prev);
  };

  const job = () => {
    if (!runner.active) return;
    const newValue = runner();
    if (!changed(newValue, oldValue)) return;
    runCleanup();
    const previous = oldValue === INITIAL ? undefined : oldValue;
    oldValue = newValue;
    callback(newValue, previous, onCleanup);
  };

  const runner = effect(getter, { lazy: true, scheduler: job });

  if (immediate) job();
  else oldValue = runner();

  return () => {
    stop(runner);
    runCleanup();
  };
}

module.exports = { ref, reactive, effect, stop, watch };`,
      hints: [
        'Normalise first: a ref becomes () => source.value, a getter is already a getter, an array becomes () => source.map(entry => toGetter(entry)()).',
        'Create the effect with { lazy: true, scheduler: job }. The scheduler is what turns a dependency change into a callback instead of a blind re-run.',
        'The lazy branch still has to run the runner once, to record dependencies and capture the first old value. immediate runs the job instead.',
        'Use a unique sentinel (a Symbol) for "no old value yet" so that a legitimate undefined or 0 is not mistaken for the initial state.',
        'deep means two things: traverse the value so nested reads are tracked, and always treat the value as changed, because a mutated object is reference-equal to itself.',
        'Keep the pending cleanup in a closure variable and call it in exactly two places: at the start of a new callback run, and inside stop().',
      ],
      tests: [
        {
          name: 'lazy by default, then reports new and old values',
          assertion:
            "(() => { const c = solution.ref(0); const seen=[]; solution.watch(c, (n,o)=>{ seen.push([n,o]); }); const before=seen.length; c.value=1; c.value=2; return before===0 && deepEqual(seen,[[1,0],[2,1]]); })()",
        },
        {
          name: 'immediate fires once with an undefined old value',
          assertion:
            "(() => { const c = solution.ref(5); const seen=[]; solution.watch(c, (n,o)=>{ seen.push([n,o]); }, {immediate:true}); return seen.length===1 && seen[0][0]===5 && seen[0][1]===undefined; })()",
        },
        {
          name: 'a getter source only reacts to what it reads',
          assertion:
            "(() => { const s = solution.reactive({a:0,b:0}); let n=0; solution.watch(()=>s.a, ()=>{ n+=1; }); s.b=9; s.a=1; return n===1; })()",
        },
        {
          name: 'an unchanged derived value does not fire the callback',
          assertion:
            "(() => { const c = solution.ref(0); let n=0; solution.watch(()=>c.value>5, ()=>{ n+=1; }); c.value=1; c.value=2; const quiet=n; c.value=9; return quiet===0 && n===1; })()",
        },
        {
          name: 'an array source receives arrays of new and old values',
          assertion:
            "(() => { const a=solution.ref(1); const b=solution.ref(2); let got=null; solution.watch([a,b], (nv,ov)=>{ got=[nv,ov]; }); b.value=7; return deepEqual(got,[[1,7],[1,2]]); })()",
        },
        {
          name: 'without deep, a nested mutation is invisible',
          assertion:
            "(() => { const s = solution.reactive({user:{name:'Ada'}}); let n=0; solution.watch(()=>s.user, ()=>{ n+=1; }); s.user.name='Grace'; return n===0; })()",
        },
        {
          name: 'deep traverses and fires on a nested mutation',
          assertion:
            "(() => { const s = solution.reactive({user:{name:'Ada'}}); let n=0; solution.watch(()=>s, ()=>{ n+=1; }, {deep:true}); s.user.name='Grace'; return n===1; })()",
        },
        {
          name: 'onCleanup runs before the next callback',
          assertion:
            "(() => { const c = solution.ref(0); const log=[]; solution.watch(c, (n,o,onCleanup)=>{ log.push('run'+n); onCleanup(()=>log.push('clean'+n)); }); c.value=1; c.value=2; return deepEqual(log,['run1','clean1','run2']); })()",
          hidden: true,
        },
        {
          name: 'stop() detaches the watcher and runs the pending cleanup',
          assertion:
            "(() => { const c = solution.ref(0); const log=[]; const halt = solution.watch(c, (n,o,onCleanup)=>{ log.push('run'+n); onCleanup(()=>log.push('clean'+n)); }); c.value=1; halt(); c.value=2; return deepEqual(log,['run1','clean1']); })()",
          hidden: true,
        },
        {
          name: 'setting the same value never fires',
          assertion:
            "(() => { const c = solution.ref(3); let n=0; solution.watch(c, ()=>{ n+=1; }); c.value=3; c.value=3; return n===0; })()",
          hidden: true,
        },
      ],
      xp: 110,
    },
  ],
  flashcards: [
    {
      front: 'Vue: `v-if` vs `v-show`',
      back: '`v-if` creates and destroys the node (lazy, cheap when rarely toggled). `v-show` always renders and toggles `display: none` (cheap when toggled often).',
      tags: ['vue', 'directives'],
    },
    {
      front: 'Vue: when do you need `.value`?',
      back: 'On refs, in JavaScript only. Templates auto-unwrap top-level refs. `reactive()` objects never use `.value`.',
      tags: ['vue', 'reactivity'],
    },
    {
      front: 'Vue: `ref` or `reactive`?',
      back: 'Default to `ref` — it holds any type, survives destructuring and can be reassigned wholesale. Use `reactive` for a cohesive object you never reassign; destructuring it loses reactivity.',
      tags: ['vue', 'reactivity'],
    },
    {
      front: 'Vue: what does `toRefs` fix?',
      back: 'Destructuring a `reactive` object copies primitives out of the proxy and breaks tracking. `toRefs(state)` returns a live ref per property (and `toRef(state, key)` does one), which is how composables return reactive bags safely.',
      tags: ['vue', 'reactivity', 'gotcha'],
    },
    {
      front: 'Vue: `computed` vs `watch` vs `watchEffect`',
      back: '`computed` derives a cached value. `watch` reacts to an explicit source, lazily, with the old value. `watchEffect` collects dependencies automatically and runs immediately, with no old value.',
      tags: ['vue', 'reactivity'],
    },
    {
      front: 'Vue: what is `shallowRef` for?',
      back: 'Tracking only reassignment of `.value`, not nested mutation. Use it for large fetched payloads, chart or map instances and third-party class objects you do not want proxied. `markRaw` opts out permanently.',
      tags: ['vue', 'performance'],
    },
    {
      front: 'Vue: props and emits',
      back: 'Data down via `defineProps` (read-only — never mutate a prop), events up via `defineEmits`. Object/array prop defaults need a factory function. Undeclared attributes fall through to the root element.',
      tags: ['vue', 'components'],
    },
    {
      front: 'Vue: what does `defineModel()` do?',
      back: 'Returns a writable ref backed by the `modelValue` prop and an `update:modelValue` emit — the pair that `v-model` on a component compiles to. `defineModel("title")` powers `v-model:title`.',
      tags: ['vue', 'components'],
    },
    {
      front: 'Vue: what is a scoped slot?',
      back: 'A `<slot :item="item" />` in the child that passes data back out, consumed with `<template #row="{ item }">`. It is Vue’s render prop; a component that is nothing but a scoped slot is a renderless component.',
      tags: ['vue', 'slots'],
    },
    {
      front: 'Vue: composable rules',
      back: 'Name it `useX`, call it synchronously inside `setup` if it registers lifecycle hooks or watchers, return refs rather than raw values, accept `MaybeRefOrGetter` and read it with `toValue`, and clean up what you create.',
      tags: ['vue', 'composables'],
    },
    {
      front: 'Vue: provide / inject, and what to provide',
      back: 'Dependency injection down any depth. Provide the **ref** (not `.value`), wrap it in `readonly()` and provide a mutator alongside, and use a Symbol key in shared code. `inject(key, default)` supplies a fallback.',
      tags: ['vue', 'di'],
    },
    {
      front: 'Vue Router: why does /users/1 -> /users/2 not re-run onMounted?',
      back: 'The matched route is the same, so the component instance is reused. Watch the param with `watch(() => route.params.id, load, { immediate: true })`, or force a remount with `:key="route.fullPath"` on `<RouterView>`.',
      tags: ['vue', 'router', 'gotcha'],
    },
  ],
  resources: [
    { label: 'Vue 3 — official guide', url: 'https://vuejs.org/guide/introduction.html', kind: 'DOCS' },
    { label: 'Vue — Reactivity in Depth', url: 'https://vuejs.org/guide/extras/reactivity-in-depth.html', kind: 'DOCS' },
    { label: 'Vue Router 4 documentation', url: 'https://router.vuejs.org/', kind: 'DOCS' },
    { label: 'Pinia — official docs', url: 'https://pinia.vuejs.org/', kind: 'DOCS' },
    { label: 'VueUse — a collection of essential composables', url: 'https://vueuse.org/', kind: 'TOOL' },
  ],
};

export default day;
