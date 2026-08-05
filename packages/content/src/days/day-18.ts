import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 18,
  week: 3,
  pillar: 'BACKEND',
  title: 'GraphQL — Schemas, Resolvers & the N+1 Problem',
  summary: 'One endpoint, a typed graph, and the batching trick that stops it melting your database.',
  estimatedMinutes: 325,
  objectives: [
    'Explain which REST problems GraphQL solves — and which ones it creates',
    'Write an SDL schema with types, queries, mutations, inputs, enums and interfaces',
    'Implement resolvers using the (parent, args, context, info) signature',
    'Trace the resolver chain and predict exactly how many database calls a query makes',
    'Kill N+1 queries with a DataLoader-style batching layer',
    'Paginate with Relay-style cursor connections',
    'Defend a public endpoint with depth limiting, cost analysis and persisted queries',
    'Decide when a REST API is the better answer',
  ],
  technologies: ['GraphQL', 'Apollo'],
  lessons: [
    {
      slug: 'why-graphql-and-the-sdl',
      title: 'Why GraphQL Exists, and the Schema Language',
      estimatedMinutes: 80,
      body: `# Why GraphQL Exists, and the Schema Language

## The two REST problems

Say a mobile screen needs a user's name, their last three post titles, and the comment count on each.

\`\`\`
GET /users/42                 → 40 fields, you need 1
GET /users/42/posts?limit=3   → full post bodies, you need titles
GET /posts/7/comments         → 3 more round trips just to count
\`\`\`

That is **over-fetching** (fields you throw away) and **under-fetching** (round trips to assemble one screen). The classic fix is a bespoke endpoint — \`GET /mobile/home-screen-v2\` — and then another one when the design changes, and now your API surface is a graveyard of screen-shaped endpoints owned by nobody.

GraphQL inverts the control. The server publishes a **typed graph** of what is available; the client sends a query describing exactly the shape it wants, and gets that shape back.

\`\`\`graphql
query HomeScreen {
  user(id: "42") {
    name
    posts(first: 3) {
      title
      commentCount
    }
  }
}
\`\`\`

\`\`\`json
{ "data": { "user": { "name": "Ada", "posts": [ { "title": "…", "commentCount": 12 } ] } } }
\`\`\`

One request. Exactly the fields asked for. The response mirrors the query shape, which means clients never guess.

What you get on top: a **single endpoint** (\`POST /graphql\`), a machine-readable schema that powers autocomplete and codegen, and introspection — the schema documents itself.

What you pay: HTTP caching stops working (everything is a POST to one URL), the naive implementation has a catastrophic performance mode we will spend a whole lesson on, error handling is unusual, and file uploads need a separate spec.

## The Schema Definition Language

The schema *is* the contract. Everything else is implementation detail.

\`\`\`graphql
scalar DateTime

enum Role { VIEWER AUTHOR EDITOR ADMIN }

type User {
  id: ID!
  email: String!
  name: String
  role: Role!
  posts(first: Int = 10, after: String): [Post!]!
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  body: String!
  published: Boolean!
  author: User!          # traversing back up the graph
  comments: [Comment!]!
  commentCount: Int!     # a computed field, backed by no column
}

type Comment {
  id: ID!
  body: String!
  author: User!
  post: Post!
}
\`\`\`

Built-in scalars are \`Int\`, \`Float\`, \`String\`, \`Boolean\` and \`ID\`. Anything else — \`DateTime\`, \`JSON\`, \`EmailAddress\` — is a **custom scalar** you declare and give serialise/parse functions.

### Nullability is inverted

Every type is **nullable by default**; \`!\` means non-null. That is the opposite of most type systems and it is deliberate — a field that fails should be able to return \`null\` rather than blowing up the whole response.

Read the list types carefully, right to left:

| Type | Meaning |
| --- | --- |
| \`[Post]\` | list may be null; items may be null |
| \`[Post!]\` | list may be null; items never null |
| \`[Post]!\` | list always present; items may be null |
| \`[Post!]!\` | list always present, items never null ← what you almost always want |

### The three root types

\`\`\`graphql
type Query {
  me: User
  user(id: ID!): User
  posts(first: Int = 20, after: String, published: Boolean): [Post!]!
  search(term: String!): [SearchResult!]!
}

type Mutation {
  createPost(input: CreatePostInput!): CreatePostPayload!
  publishPost(id: ID!): Post!
}

type Subscription {
  postPublished(authorId: ID): Post!
}
\`\`\`

- **Query** fields run **in parallel**. They must be side-effect free.
- **Mutation** fields at the top level run **in series**, top to bottom, so \`createPost\` then \`publishPost\` in one document is well defined.
- **Subscription** fields open a long-lived stream, normally over WebSocket (\`graphql-ws\`) or SSE. One subscription per operation.

### Input types and payload types

Arguments cannot use object types — they need \`input\` types, which are a separate kind with no resolvers.

\`\`\`graphql
input CreatePostInput {
  title: String!
  body: String!
  tags: [String!] = []
}

type CreatePostPayload {
  post: Post
  errors: [UserError!]!
}

type UserError {
  field: String
  message: String!
}
\`\`\`

Wrapping mutation results in a **payload type** is the single best schema habit to adopt early. It lets you return expected, typed, per-field failures ("title already taken") in \`data\` instead of stuffing them into the transport-level \`errors\` array — where clients cannot type them and cannot easily map them to a form field.

### Interfaces and unions

\`\`\`graphql
interface Node { id: ID! }

type Post implements Node { id: ID! title: String! }
type User implements Node { id: ID! email: String! }

union SearchResult = Post | User | Comment
\`\`\`

- **interface** — shared fields, so clients can select them without knowing the concrete type.
- **union** — no shared fields; the client must branch.

Both are queried with fragments on the concrete type:

\`\`\`graphql
query Search($term: String!) {
  search(term: $term) {
    __typename
    ... on Post { title }
    ... on User { email }
    ... on Comment { body }
  }
}
\`\`\`

Always ask for \`__typename\` on an abstract type — every client cache needs it to know what it just received. Behind the scenes each interface and union needs a \`__resolveType\` function that maps a row to a type name; forgetting it is the most common "Abstract type must resolve to an Object type at runtime" error.`,
    },
    {
      slug: 'resolvers-and-the-chain',
      title: 'Resolvers, the Chain, Errors & Nullability',
      estimatedMinutes: 85,
      body: `# Resolvers, the Chain, Errors & Nullability

A schema without resolvers is documentation. A **resolver** is a function that produces the value for one field of one type.

## The signature

\`\`\`js
const resolvers = {
  Query: {
    // parent, args, context, info
    user: (_parent, args, ctx) => ctx.db.user.findUnique({ where: { id: args.id } }),
  },

  User: {
    posts: (user, args, ctx) =>
      ctx.db.post.findMany({ where: { authorId: user.id }, take: args.first }),
  },

  Post: {
    author: (post, _args, ctx) => ctx.db.user.findUnique({ where: { id: post.authorId } }),
    commentCount: (post, _args, ctx) => ctx.db.comment.count({ where: { postId: post.id } }),
  },
};
\`\`\`

| Parameter | What it is |
| --- | --- |
| \`parent\` | The value the **parent field's** resolver returned. For \`Post.author\`, this is the post object. |
| \`args\` | The field's arguments, already coerced and validated against the schema. |
| \`context\` | Per-request object you build in the server config — the authenticated user, database clients, loaders. |
| \`info\` | The AST of the current field: the selection set, path, return type. Advanced use only. |

**\`context\` is per request, never global.** That is what makes it safe to hang \`ctx.user\` and per-request DataLoaders off it — you get natural request isolation, and a loader cache that cannot leak one user's data into another user's response.

\`\`\`js
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

const server = new ApolloServer({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => {
    const user = await userFromAuthHeader(req.headers.authorization);
    return { db, user, loaders: createLoaders(db) }; // fresh loaders every request
  },
  listen: { port: 4000 },
});
\`\`\`

## The default resolver

You do not write most resolvers. If a type has no resolver for a field, the executor uses the default:

\`\`\`js
const defaultResolver = (parent, args, ctx, info) => {
  const value = parent?.[info.fieldName];
  return typeof value === 'function' ? value(args, ctx, info) : value;
};
\`\`\`

So if \`ctx.db.user.findUnique\` already returns \`{ id, email, name }\`, the \`User.id\`, \`User.email\` and \`User.name\` resolvers write themselves. You only implement fields that need work: joins, computed values, permission-scoped data.

## The chain

Execution is a **depth-first walk of the query, one resolver per field per object**. Trace this:

\`\`\`graphql
{ user(id: "1") { name posts(first: 2) { title author { name } } } }
\`\`\`

1. \`Query.user\` → 1 call, returns a user row.
2. \`User.name\` → default resolver, 0 calls.
3. \`User.posts\` → 1 call, returns 2 rows.
4. \`Post.title\` → default resolver ×2, 0 calls.
5. \`Post.author\` → **called once per post**, so 2 calls.

Total: 4 database calls for 3 logical entities. Change \`first: 2\` to \`first: 100\` and step 5 becomes 100 calls. That is the N+1 problem, and the next lesson is entirely about it.

Two properties that fall out of the chain and matter in practice:

- **Sibling fields resolve in parallel.** Do not rely on ordering between them.
- **A field's resolver only runs if the client asked for it.** \`Post.commentCount\` costs nothing when it is not selected — which is precisely the efficiency GraphQL is selling you.

Resolvers may return a promise, a plain value, or a *thunk*; the executor awaits whatever it gets before descending.

## Errors and nullability

A GraphQL response always has HTTP 200 (unless the request itself was malformed). Failures live in a top-level \`errors\` array:

\`\`\`json
{
  "data": { "user": { "name": "Ada", "posts": null } },
  "errors": [{
    "message": "Database unavailable",
    "path": ["user", "posts"],
    "locations": [{ "line": 3, "column": 5 }],
    "extensions": { "code": "INTERNAL_SERVER_ERROR" }
  }]
}
\`\`\`

Now the rule that surprises everyone: **a thrown error nulls the field, and if that field is non-null the null propagates up to the nearest nullable ancestor.**

Given \`posts: [Post!]!\` on \`User\`, and \`user: User\` on \`Query\`, a failure inside \`posts\` cannot be null, so the error bubbles to \`user\` — which is nullable, so the entire user becomes \`null\`. Mark too much of your schema non-null and one flaky field takes out the whole response. Mark it thoughtfully:

- \`ID\` and fields you truly always have: non-null.
- Anything crossing a network or service boundary: **nullable**, so a partial failure stays partial.

Distinguish the two error species:

\`\`\`js
import { GraphQLError } from 'graphql';

// Expected, actionable, part of the domain → return it in the payload type
return { post: null, errors: [{ field: 'title', message: 'Title already used' }] };

// Exceptional → throw, with a machine-readable code
throw new GraphQLError('Not authenticated', {
  extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
});
\`\`\`

And always **mask internal errors in production**. Apollo Server does this by default for unexpected throws, replacing the message with a generic one and keeping the real stack in your logs. A leaked \`error: duplicate key value violates unique constraint "users_email_key"\` tells an attacker your schema and confirms an account exists.`,
    },
    {
      slug: 'n-plus-one-dataloader-pagination',
      title: 'The N+1 Problem, DataLoader & Pagination',
      estimatedMinutes: 85,
      body: `# The N+1 Problem, DataLoader & Pagination

## How one innocent query becomes 101

\`\`\`graphql
{ posts(first: 100) { title author { name } } }
\`\`\`

\`Query.posts\` runs once and returns 100 rows. Then \`Post.author\` runs **once per post**, because that is what the resolver chain does — it has no idea the other 99 exist.

\`\`\`
SELECT * FROM posts LIMIT 100;
SELECT * FROM users WHERE id = 3;
SELECT * FROM users WHERE id = 7;
SELECT * FROM users WHERE id = 3;   -- again
… 97 more
\`\`\`

101 round trips, most of them duplicates. At 2ms each that is a 200ms field. This is not a GraphQL bug — it is the direct consequence of resolvers being independent functions, and every ORM has the same failure mode.

## DataLoader: batch + cache per request

The fix is a layer that collects the keys requested during a single tick of the event loop, calls your batch function **once**, and hands the values back out.

\`\`\`js
import DataLoader from 'dataloader';

export const createLoaders = (db) => ({
  userById: new DataLoader(async (ids) => {
    const users = await db.user.findMany({ where: { id: { in: ids } } });
    const byId = new Map(users.map((u) => [u.id, u]));
    // MUST return one entry per key, in the same order
    return ids.map((id) => byId.get(id) ?? null);
  }),

  postsByAuthorId: new DataLoader(async (authorIds) => {
    const posts = await db.post.findMany({ where: { authorId: { in: authorIds } } });
    const grouped = new Map(authorIds.map((id) => [id, []]));
    for (const p of posts) grouped.get(p.authorId).push(p);
    return authorIds.map((id) => grouped.get(id));
  }),
});
\`\`\`

\`\`\`js
Post: {
  author: (post, _args, ctx) => ctx.loaders.userById.load(post.authorId),
}
\`\`\`

101 queries become 2. The mechanics:

1. \`.load(key)\` returns a promise and pushes the key onto a queue.
2. The queue is flushed on the next **microtask** — after all 100 sibling resolvers have run, before any I/O.
3. Duplicate keys are collapsed, so the 3s and 7s above are requested once.
4. The result is memoised for the life of the loader.

Three rules the batch function must obey, and the first one is where every bug lives:

- **Return an array of exactly \`keys.length\`, in the same order.** \`WHERE id IN (…)\` does not guarantee order and silently drops missing rows — always re-index through a Map.
- **Never share loaders between requests.** Build them in \`context\`. A process-wide loader is a cache with no invalidation and a cross-tenant data leak waiting to happen.
- **Clear on write.** After a mutation touches a user, \`ctx.loaders.userById.clear(id)\` so a later field in the same request does not read a stale value.

> DataLoader solves *fan-out*. It does not solve a genuinely expensive root query. For that you want the \`info\` argument (or a library like \`graphql-parse-resolve-info\`) to look ahead at the selection set and issue a single join.

## Pagination: cursors, not offsets

\`OFFSET 5000\` makes the database count and discard 5000 rows, and if someone inserts a row while the user is paging, they see an item twice or miss one entirely. Cursor pagination fixes both by remembering *where you were*, not *how far in*.

The **Relay connection** specification is the de-facto shape:

\`\`\`graphql
type Query {
  posts(first: Int, after: String, last: Int, before: String): PostConnection!
}

type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}

type PostEdge {
  node: Post!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
\`\`\`

It looks over-engineered until you need it. The \`edges\` wrapper exists so an edge can carry data about the *relationship* (\`role\`, \`addedAt\`) rather than the node. \`pageInfo\` gives the client a "load more" button that works without a second request.

\`\`\`js
const encodeCursor = (id) => Buffer.from('cursor:' + id).toString('base64');
const decodeCursor = (c) => Buffer.from(c, 'base64').toString('utf8').slice(7);

Query: {
  posts: async (_p, { first = 20, after }, ctx) => {
    const take = Math.min(first, 100) + 1;          // fetch one extra to detect more
    const rows = await ctx.db.post.findMany({
      take,
      orderBy: { id: 'asc' },
      ...(after ? { cursor: { id: decodeCursor(after) }, skip: 1 } : {}),
    });

    const hasNextPage = rows.length === take;
    const nodes = hasNextPage ? rows.slice(0, -1) : rows;

    return {
      edges: nodes.map((node) => ({ node, cursor: encodeCursor(node.id) })),
      pageInfo: {
        hasNextPage,
        hasPreviousPage: Boolean(after),
        startCursor: nodes.length ? encodeCursor(nodes[0].id) : null,
        endCursor: nodes.length ? encodeCursor(nodes[nodes.length - 1].id) : null,
      },
    };
  },
}
\`\`\`

Two details that save you later: **cap \`first\`** (a client asking for \`first: 1000000\` is a denial-of-service), and **always order by something unique and stable** — a \`createdAt\` cursor with ties will skip rows. Base64-encoding the cursor is not security, it is a signal to clients that the value is opaque and they must not parse it.`,
    },
    {
      slug: 'production-graphql',
      title: 'Security, Evolution, Caching & When Not To',
      estimatedMinutes: 75,
      body: `# Security, Evolution, Caching & When Not To

## A public GraphQL endpoint is a query engine you handed to strangers

REST gives an attacker the endpoints you built. GraphQL gives them arbitrary traversal of your graph. Three cheap defences, in the order you should add them.

### 1. Depth limiting

Any cycle in the schema (\`Post.author.posts.author…\`) lets one small document explode into millions of resolver calls.

\`\`\`graphql
{ post(id:"1") { author { posts { author { posts { author { name } } } } } } }
\`\`\`

\`\`\`js
import depthLimit from 'graphql-depth-limit';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [depthLimit(8)], // rejected at validation, before any resolver runs
});
\`\`\`

Depth limiting is a validation rule, so a rejected query costs you nothing but a parse. Note that introspection fields and inline fragments should not add depth — a fragment is a syntactic convenience, not a level of nesting.

### 2. Cost analysis

Depth is a blunt instrument: \`{ posts(first: 10000) { title } }\` is depth 2 and will still hurt. Assign a cost per field and multiply by list sizes:

\`\`\`
cost(field) = 1 + multiplier × Σ cost(children)      multiplier = args.first ?? 1

{ users(first: 10) { posts(first: 5) { title } } }
  title  = 1
  posts  = 1 + 5 × 1  = 6
  users  = 1 + 10 × 6 = 61
\`\`\`

Reject anything over a budget (say 1000), and — better — spend the budget as a **rate limit**: each client gets N cost points per minute rather than N requests per minute, which is a far more honest measure of load.

### 3. Persisted queries

The strongest control: clients register their operations at build time and send only a hash at runtime.

\`\`\`json
{ "extensions": { "persistedQuery": { "version": 1, "sha256Hash": "ec2e01…" } } }
\`\`\`

An unknown hash is rejected, so **arbitrary queries become impossible** and depth/cost analysis becomes a build-time concern. You also shrink request bodies to a few hundred bytes and, because the hash is stable, you can serve them over \`GET\` and get CDN caching back.

Also on the list: turn off **introspection** in production if your API is not public (it is obscurity, not security, but it raises the cost of reconnaissance), cap request body size, disable the GraphQL playground, set a query timeout, and remember that **authorisation belongs in resolvers**, not in the gateway — there is no URL to guard.

## Versioning by evolution

GraphQL APIs are not versioned. There is no \`/v2/graphql\`. Instead the schema evolves, and the type system tells you exactly what is safe:

| Change | Safe? |
| --- | --- |
| Add a type, field, or optional argument | ✅ Always |
| Add an enum value | ⚠️ Breaks clients with exhaustive switches |
| Make a nullable field non-null | ✅ Safe |
| Make a non-null field nullable | ❌ Breaking |
| Add a required argument | ❌ Breaking |
| Remove or rename a field | ❌ Breaking |

The deprecation workflow:

\`\`\`graphql
type User {
  name: String! @deprecated(reason: "Use fullName. Removal after 2026-12-01.")
  fullName: String!
}
\`\`\`

Deprecated fields show up struck-through in every IDE and in introspection. Combine with **field-level usage tracking** (Apollo Studio, or your own logging of \`info.path\`) and you can remove a field the day its usage hits zero — which is a far better guarantee than any version number gave you.

## Caching

You lose HTTP caching (one URL, all POSTs) and get **normalised client caching** instead. Apollo Client splits every response into objects keyed by \`__typename\` + \`id\`:

\`\`\`
Post:7      { id: 7, title: "…", author: Ref(User:3) }
User:3      { id: 3, name: "Ada" }
\`\`\`

Two consequences you must design for:

1. **Always request \`id\` on any object you might update.** Without it the cache falls back to storing the object under its query path, and an update in one view will not appear in another.
2. **Mutations should return the modified objects**, including their \`id\` and every field the UI shows. The cache then updates every view automatically with no refetch.

\`\`\`js
const { data } = useQuery(GET_POSTS, { fetchPolicy: 'cache-first' });
\`\`\`

\`cache-first\` (default) → \`cache-and-network\` (show stale, revalidate) → \`network-only\` → \`no-cache\`. On the server side, \`@cacheControl\` hints plus a response cache handle the rest; a single expensive field can also be memoised in Redis behind its resolver.

## When not to use GraphQL

Be honest about this — GraphQL is a cost you pay to buy client flexibility.

- **One client, one team, stable screens.** REST is less machinery for the same result.
- **File upload / download heavy.** Multipart uploads need an extra spec; streaming a CSV over GraphQL is miserable.
- **Public, cacheable, read-mostly content.** A REST endpoint behind a CDN is nearly free; GraphQL throws that away.
- **Simple CRUD.** A generated REST or RPC layer will be shorter and faster.
- **Hard latency budgets on a small payload.** The parse-validate-execute pipeline is real overhead.
- **Your team has no capacity for the operational side.** N+1, cost limiting, schema governance and cache correctness are ongoing work, not a one-off setup.

The strongest cases for GraphQL: many heterogeneous clients (web, iOS, Android, partners), aggregation over several backend services, and rapidly changing UI where the backend team should not be a bottleneck on every screen change.`,
    },
  ],
  quiz: [
    {
      prompt: 'Which pair of problems is GraphQL primarily designed to solve?',
      options: [
        'Authentication and authorisation',
        'Over-fetching and under-fetching of data by clients',
        'Database indexing and query planning',
        'Horizontal scaling and load balancing',
      ],
      correctIndex: 1,
      explanation:
        'A REST resource returns a fixed shape, so clients receive fields they discard (over-fetching) and make extra round trips to assemble a screen (under-fetching). GraphQL lets the client specify the exact shape it wants in one request.',
      difficulty: 'EASY',
    },
    {
      prompt: 'What does the type `[Post!]!` mean?',
      options: [
        'The list may be null, but its items may not',
        'The list is always present, but items may be null',
        'The list is always present and no item is ever null',
        'Exactly one Post is returned',
      ],
      correctIndex: 2,
      explanation:
        'Read it outside-in: the trailing `!` makes the list itself non-null, and the inner `!` makes each element non-null. This is the type you want for most collection fields — an empty list, never null.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'In the resolver signature `(parent, args, context, info)`, what is `parent`?',
      options: [
        'The value returned by the parent field’s resolver',
        'The root Query object, always',
        'The parsed HTTP request',
        'The parent type’s schema definition',
      ],
      correctIndex: 0,
      explanation:
        'Each resolver receives whatever the resolver one level up returned. For `Post.author`, `parent` is the post object, which is where you find `post.authorId`. `context` is the per-request object holding db clients, the user and loaders.',
      difficulty: 'EASY',
    },
    {
      prompt: 'A query asks for 50 posts and each post’s author. Without batching, how many database calls does the naive implementation make?',
      options: ['1', '2', '50', '51'],
      correctIndex: 3,
      explanation:
        'One call for the list of posts, then `Post.author` runs once per post — 50 more. That is the classic N+1. DataLoader collapses the 50 into a single `WHERE id IN (…)`, taking the total to 2.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What must a DataLoader batch function return?',
      options: [
        'Any array of rows the database happened to return',
        'A Map keyed by the requested keys',
        'An array of exactly keys.length values, in the same order as the keys',
        'A single object containing all results',
      ],
      correctIndex: 2,
      explanation:
        'DataLoader hands values back positionally. Because `WHERE id IN (…)` neither preserves order nor returns rows for missing ids, you must re-index the result through a Map and map over the original keys, using `null` for misses.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Why do Relay-style connections wrap each node in an `edge`?',
      options: [
        'To make the JSON smaller',
        'So the edge can carry data about the relationship itself, plus that node’s cursor',
        'Because GraphQL cannot return lists of objects directly',
        'To allow the server to skip pagination entirely',
      ],
      correctIndex: 1,
      explanation:
        'An edge is the relationship, a node is the thing. That lets you put `cursor`, `role` or `addedAt` on the edge without polluting the node type. `pageInfo` then carries `hasNextPage` and the boundary cursors.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why is depth limiting alone insufficient protection for a public endpoint?',
      options: [
        'It only works when introspection is disabled',
        'It runs after resolvers, so the damage is already done',
        'It cannot be applied to mutations',
        'A shallow query like `{ posts(first: 10000) { title } }` is depth 2 and still expensive',
      ],
      correctIndex: 3,
      explanation:
        'Depth ignores breadth. Cost analysis (roughly `1 + multiplier × Σ children`, using list arguments as the multiplier) catches wide queries, and persisted queries remove arbitrary queries altogether. Depth limiting does run before resolvers — it is a validation rule.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Which schema change is safe to ship without breaking existing clients?',
      options: [
        'Adding a new optional argument to an existing field',
        'Adding a required argument to an existing field',
        'Changing a field from `String!` to `String`',
        'Renaming a field that clients query',
      ],
      correctIndex: 0,
      explanation:
        'Additive changes are safe: new types, new fields, new optional arguments. Making a non-null field nullable breaks clients that assumed a value, and required arguments or renames break every existing document. GraphQL evolves via `@deprecated` plus usage tracking instead of versioned URLs.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'dataloader-batching',
      title: 'Build a DataLoader',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Implement the batching layer that turns 101 database calls into 2.

### \`createLoader(batchFn)\`

\`batchFn(keys)\` receives an array of **unique** keys in first-requested order and returns a promise for an array of values, one per key, in the same order.

Return an object with:

| Method | Behaviour |
| --- | --- |
| \`load(key)\` | Returns a promise for one value. Queues the key; the queue is flushed **once per microtask** via \`queueMicrotask\`. |
| \`loadMany(keys)\` | \`Promise.all\` over \`load\`. |
| \`clear(key)\` | Drops one key from the cache. Returns the loader. |
| \`clearAll()\` | Empties the cache. Returns the loader. |

Rules:

1. **Batch.** Every \`load\` in the same microtask goes into one \`batchFn\` call.
2. **Dedupe.** The same key loaded twice in one tick appears once in \`keys\`.
3. **Cache.** A key already loaded returns the same promise without touching \`batchFn\` again.
4. **Per-key errors.** If the value at index \`i\` is an \`Error\` instance, that key's promise **rejects** with it.
5. **Batch failure.** If \`batchFn\` throws or rejects, every key in that batch rejects with that error.
6. **Failures are not cached.** A key that rejected must be re-requested on the next \`load\`.

### Example

\`\`\`js
let calls = 0;
const loader = createLoader(async (ids) => { calls++; return ids.map((id) => id * 2); });

const [a, b, c] = await Promise.all([loader.load(1), loader.load(2), loader.load(1)]);
// a = 2, b = 4, c = 2, calls = 1  — three loads, one batch
\`\`\`

### Constraints

- \`queueMicrotask\` is available. Do not use \`setTimeout\`.
- Keys are primitives (numbers or strings).`,
      starterCode: `function createLoader(batchFn) {
  // batchFn(keys) -> Promise<values>, one value per key, same order

  return {
    load(key) {},
    loadMany(keys) {},
    clear(key) {},
    clearAll() {},
  };
}

module.exports = { createLoader };`,
      solutionCode: `function createLoader(batchFn) {
  const cache = new Map();
  let queue = [];
  let scheduled = false;

  const dispatch = () => {
    const batch = queue;
    queue = [];
    scheduled = false;

    const keys = batch.map((job) => job.key);

    Promise.resolve()
      .then(() => batchFn(keys))
      .then(
        (values) => {
          if (!Array.isArray(values) || values.length !== keys.length) {
            const err = new Error('batchFn must return one value per key');
            batch.forEach((job) => {
              cache.delete(job.key);
              job.reject(err);
            });
            return;
          }
          batch.forEach((job, i) => {
            const value = values[i];
            if (value instanceof Error) {
              cache.delete(job.key); // never cache a failure
              job.reject(value);
            } else {
              job.resolve(value);
            }
          });
        },
        (err) => {
          batch.forEach((job) => {
            cache.delete(job.key);
            job.reject(err);
          });
        },
      );
  };

  const loader = {
    load(key) {
      if (cache.has(key)) return cache.get(key);

      const promise = new Promise((resolve, reject) => {
        queue.push({ key, resolve, reject });
        if (!scheduled) {
          scheduled = true;
          queueMicrotask(dispatch);
        }
      });

      promise.catch(() => {}); // keep an unawaited rejection quiet
      cache.set(key, promise);
      return promise;
    },

    loadMany(keys) {
      return Promise.all(keys.map((key) => loader.load(key)));
    },

    clear(key) {
      cache.delete(key);
      return loader;
    },

    clearAll() {
      cache.clear();
      return loader;
    },
  };

  return loader;
}

module.exports = { createLoader };`,
      hints: [
        'Keep a Map from key to the promise you already handed out - that gives you caching and in-tick deduplication in one move.',
        'Push { key, resolve, reject } onto a queue inside the Promise executor, and schedule the flush with queueMicrotask only when nothing is scheduled yet.',
        'Swap the queue for a fresh array at the top of dispatch, before you await anything, or loads issued during the batch will be lost.',
        'Wrap the batchFn call in Promise.resolve().then(...) so a synchronous throw becomes a rejection like any other.',
        'Delete the key from the cache on every failure path, otherwise a retry replays the rejected promise forever.',
      ],
      tests: [
        {
          name: 'batches and dedupes loads in one tick',
          assertion:
            "await (async () => { let calls = 0; const l = solution.createLoader(async (ids) => { calls++; return ids.map((id) => id * 2); }); const r = await Promise.all([l.load(1), l.load(2), l.load(1)]); return calls === 1 && deepEqual(r, [2, 4, 2]); })()",
        },
        {
          name: 'passes unique keys in first-requested order',
          assertion:
            "await (async () => { let seen = null; const l = solution.createLoader(async (ids) => { seen = ids.slice(); return ids.map((id) => id * 10); }); await Promise.all([l.load(2), l.load(1), l.load(2)]); return deepEqual(seen, [2, 1]); })()",
        },
        {
          name: 'caches across ticks',
          assertion:
            "await (async () => { let calls = 0; const l = solution.createLoader(async (ids) => { calls++; return ids.map((id) => id * 2); }); const a = await l.load(1); const b = await l.load(1); return calls === 1 && a === 2 && b === 2; })()",
        },
        {
          name: 'separate ticks produce separate batches',
          assertion:
            "await (async () => { let calls = 0; const l = solution.createLoader(async (ids) => { calls++; return ids.map((id) => id * 2); }); await l.load(1); await l.load(2); return calls === 2; })()",
        },
        {
          name: 'loadMany resolves in order from one batch',
          assertion:
            "await (async () => { let calls = 0; const l = solution.createLoader(async (ks) => { calls++; return ks.map((k) => k.toUpperCase()); }); const r = await l.loadMany(['a', 'b', 'c']); return calls === 1 && deepEqual(r, ['A', 'B', 'C']); })()",
        },
        {
          name: 'clear(key) forces a refetch',
          assertion:
            "await (async () => { let calls = 0; const l = solution.createLoader(async (ids) => { calls++; return ids.map((id) => id * 2); }); await l.load(1); l.clear(1); await l.load(1); return calls === 2; })()",
        },
        {
          name: 'an Error value rejects only that key',
          assertion:
            "await (async () => { const l = solution.createLoader(async (ids) => ids.map((id) => (id === 2 ? new Error('nope') : id))); const [a, b] = await Promise.all([l.load(1), l.load(2).then(() => 'resolved', (e) => e.message)]); return a === 1 && b === 'nope'; })()",
          hidden: true,
        },
        {
          name: 'a rejecting batchFn rejects every key',
          assertion:
            "await (async () => { const l = solution.createLoader(async () => { throw new Error('boom'); }); const [a, b] = await Promise.all([l.load(1).then(() => 'ok', (e) => e.message), l.load(2).then(() => 'ok', (e) => e.message)]); return a === 'boom' && b === 'boom'; })()",
          hidden: true,
        },
        {
          name: 'failures are not cached',
          assertion:
            "await (async () => { let calls = 0; const l = solution.createLoader(async (ids) => { calls++; if (calls === 1) throw new Error('boom'); return ids.map((id) => id * 2); }); await l.load(1).catch(() => {}); const v = await l.load(1); return calls === 2 && v === 2; })()",
          hidden: true,
        },
        {
          name: 'clearAll empties the whole cache',
          assertion:
            "await (async () => { let calls = 0; const l = solution.createLoader(async (ids) => { calls++; return ids.map((id) => id * 2); }); await l.loadMany([1, 2]); l.clearAll(); await l.loadMany([1, 2]); return calls === 2; })()",
          hidden: true,
        },
      ],
      xp: 110,
    },
    {
      slug: 'query-depth-and-cost',
      title: 'Depth Limiting and Cost Analysis',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Before a single resolver runs, a production server decides whether a query is *allowed*. Build the two analyses that decision rests on.

You are given a simplified document AST:

\`\`\`js
{
  kind: 'Document',
  definitions: [
    { kind: 'OperationDefinition', operation: 'query', selectionSet: { selections: [ ... ] } },
    { kind: 'FragmentDefinition', name: 'PostBits', selectionSet: { selections: [ ... ] } },
  ],
}
\`\`\`

A selection is one of:

| Node | Shape |
| --- | --- |
| Field | \`{ kind: 'Field', name, args?, selectionSet? }\` |
| Inline fragment | \`{ kind: 'InlineFragment', selectionSet }\` |
| Fragment spread | \`{ kind: 'FragmentSpread', name }\` |

### \`queryDepth(document)\`

Return the deepest nesting across all operations.

- A leaf field is depth **1**; a field with children is \`1 + depth(children)\`.
- **Inline fragments do not add depth** — they are syntax, not nesting.
- **Fragment spreads** expand the named fragment's selections at the current depth. An unknown fragment contributes nothing.
- **Introspection fields** (name starts with \`__\`, e.g. \`__typename\`) are ignored entirely.
- A document with no operations has depth \`0\`.
- The AST may contain a fragment cycle. Do not recurse forever — stop when a fragment is already being expanded on the current path.

### \`estimateCost(document)\`

\`\`\`
cost(field) = 1 + multiplier x (sum of child costs)
multiplier  = args.first ?? args.limit ?? 1
\`\`\`

Inline fragments and fragment spreads contribute their children's cost at the current level with no field cost of their own. Introspection fields cost nothing. The document's cost is the sum over all operations.

\`\`\`
{ users(first: 10) { posts(first: 5) { title } } }
  title = 1
  posts = 1 + 5 x 1  = 6
  users = 1 + 10 x 6 = 61     → estimateCost = 61
\`\`\`

### \`validateQuery(document, options)\`

\`options\` is \`{ maxDepth, maxCost }\` (either may be omitted). Return:

\`\`\`js
{ ok: boolean, depth: number, cost: number, errors: string[] }
\`\`\`

Push a string into \`errors\` when \`maxDepth\` is given and depth exceeds it, and another when \`maxCost\` is given and cost exceeds it. \`ok\` is \`errors.length === 0\`.`,
      starterCode: `function queryDepth(document) {
  // deepest field nesting; fragments spread, inline fragments are free
}

function estimateCost(document) {
  // 1 + (args.first ?? args.limit ?? 1) * sum(child costs)
}

function validateQuery(document, options) {
  // { ok, depth, cost, errors }
}

module.exports = { queryDepth, estimateCost, validateQuery };`,
      solutionCode: `function collectFragments(document) {
  const fragments = {};
  const defs = (document && document.definitions) || [];
  for (const def of defs) {
    if (def.kind === 'FragmentDefinition') fragments[def.name] = def;
  }
  return fragments;
}

function selectionsOf(node) {
  return (node && node.selectionSet && node.selectionSet.selections) || [];
}

function isIntrospection(node) {
  return typeof node.name === 'string' && node.name.slice(0, 2) === '__';
}

function queryDepth(document) {
  const fragments = collectFragments(document);

  const walk = (selections, active) => {
    let max = 0;
    for (const sel of selections) {
      if (sel.kind === 'Field') {
        if (isIntrospection(sel)) continue;
        const children = selectionsOf(sel);
        const depth = 1 + (children.length ? walk(children, active) : 0);
        if (depth > max) max = depth;
      } else if (sel.kind === 'InlineFragment') {
        const depth = walk(selectionsOf(sel), active);
        if (depth > max) max = depth;
      } else if (sel.kind === 'FragmentSpread') {
        const fragment = fragments[sel.name];
        if (!fragment || active.has(sel.name)) continue; // unknown or cyclic
        active.add(sel.name);
        const depth = walk(selectionsOf(fragment), active);
        active.delete(sel.name);
        if (depth > max) max = depth;
      }
    }
    return max;
  };

  let overall = 0;
  for (const def of (document && document.definitions) || []) {
    if (def.kind !== 'OperationDefinition') continue;
    const depth = walk(selectionsOf(def), new Set());
    if (depth > overall) overall = depth;
  }
  return overall;
}

function estimateCost(document) {
  const fragments = collectFragments(document);

  const walk = (selections, active) => {
    let total = 0;
    for (const sel of selections) {
      if (sel.kind === 'Field') {
        if (isIntrospection(sel)) continue;
        const args = sel.args || {};
        let multiplier = 1;
        if (typeof args.first === 'number') multiplier = args.first;
        else if (typeof args.limit === 'number') multiplier = args.limit;
        total += 1 + multiplier * walk(selectionsOf(sel), active);
      } else if (sel.kind === 'InlineFragment') {
        total += walk(selectionsOf(sel), active);
      } else if (sel.kind === 'FragmentSpread') {
        const fragment = fragments[sel.name];
        if (!fragment || active.has(sel.name)) continue;
        active.add(sel.name);
        total += walk(selectionsOf(fragment), active);
        active.delete(sel.name);
      }
    }
    return total;
  };

  let overall = 0;
  for (const def of (document && document.definitions) || []) {
    if (def.kind !== 'OperationDefinition') continue;
    overall += walk(selectionsOf(def), new Set());
  }
  return overall;
}

function validateQuery(document, options) {
  const opts = options || {};
  const depth = queryDepth(document);
  const cost = estimateCost(document);
  const errors = [];

  if (typeof opts.maxDepth === 'number' && depth > opts.maxDepth) {
    errors.push('Query depth ' + depth + ' exceeds maximum ' + opts.maxDepth);
  }
  if (typeof opts.maxCost === 'number' && cost > opts.maxCost) {
    errors.push('Query cost ' + cost + ' exceeds maximum ' + opts.maxCost);
  }

  return { ok: errors.length === 0, depth, cost, errors };
}

module.exports = { queryDepth, estimateCost, validateQuery };`,
      hints: [
        'Index the FragmentDefinitions into a lookup object once, before you start walking.',
        'Pass a Set of fragment names currently being expanded down the recursion; skip any spread already in it and delete it on the way back out.',
        'Only the Field branch adds 1. InlineFragment and FragmentSpread just recurse and return whatever their children give you.',
        'Depth takes the max over siblings; cost takes the sum. That is the only structural difference between the two walks.',
        'Skip any field whose name starts with __ before doing anything else with it.',
      ],
      tests: [
        {
          name: 'nested fields count as depth',
          assertion:
            "(() => { const f = (name, kids, args) => ({ kind: 'Field', name, args, selectionSet: kids ? { kind: 'SelectionSet', selections: kids } : undefined }); const doc = { kind: 'Document', definitions: [{ kind: 'OperationDefinition', operation: 'query', selectionSet: { kind: 'SelectionSet', selections: [f('user', [f('posts', [f('title')])])] } }] }; return solution.queryDepth(doc) === 3; })()",
        },
        {
          name: 'an empty document has depth 0',
          assertion: "solution.queryDepth({ kind: 'Document', definitions: [] }) === 0",
        },
        {
          name: 'depth is the max over sibling branches',
          assertion:
            "(() => { const f = (name, kids) => ({ kind: 'Field', name, selectionSet: kids ? { kind: 'SelectionSet', selections: kids } : undefined }); const doc = { kind: 'Document', definitions: [{ kind: 'OperationDefinition', operation: 'query', selectionSet: { kind: 'SelectionSet', selections: [f('me'), f('user', [f('posts', [f('author', [f('name')])])])] } }] }; return solution.queryDepth(doc) === 4; })()",
        },
        {
          name: 'inline fragments do not add depth',
          assertion:
            "(() => { const f = (name, kids) => ({ kind: 'Field', name, selectionSet: kids ? { kind: 'SelectionSet', selections: kids } : undefined }); const inline = (kids) => ({ kind: 'InlineFragment', selectionSet: { kind: 'SelectionSet', selections: kids } }); const doc = { kind: 'Document', definitions: [{ kind: 'OperationDefinition', operation: 'query', selectionSet: { kind: 'SelectionSet', selections: [f('search', [inline([f('title')])])] } }] }; return solution.queryDepth(doc) === 2; })()",
        },
        {
          name: 'fragment spreads expand at the current depth',
          assertion:
            "(() => { const f = (name, kids) => ({ kind: 'Field', name, selectionSet: kids ? { kind: 'SelectionSet', selections: kids } : undefined }); const doc = { kind: 'Document', definitions: [{ kind: 'OperationDefinition', operation: 'query', selectionSet: { kind: 'SelectionSet', selections: [f('user', [{ kind: 'FragmentSpread', name: 'Bits' }])] } }, { kind: 'FragmentDefinition', name: 'Bits', selectionSet: { kind: 'SelectionSet', selections: [f('posts', [f('title')])] } }] }; return solution.queryDepth(doc) === 3; })()",
        },
        {
          name: 'introspection fields are ignored',
          assertion:
            "(() => { const f = (name, kids) => ({ kind: 'Field', name, selectionSet: kids ? { kind: 'SelectionSet', selections: kids } : undefined }); const doc = { kind: 'Document', definitions: [{ kind: 'OperationDefinition', operation: 'query', selectionSet: { kind: 'SelectionSet', selections: [f('__schema', [f('types', [f('name')])]), f('me')] } }] }; return solution.queryDepth(doc) === 1; })()",
        },
        {
          name: 'a cyclic fragment terminates',
          assertion:
            "(() => { const f = (name, kids) => ({ kind: 'Field', name, selectionSet: kids ? { kind: 'SelectionSet', selections: kids } : undefined }); const doc = { kind: 'Document', definitions: [{ kind: 'OperationDefinition', operation: 'query', selectionSet: { kind: 'SelectionSet', selections: [{ kind: 'FragmentSpread', name: 'Loop' }] } }, { kind: 'FragmentDefinition', name: 'Loop', selectionSet: { kind: 'SelectionSet', selections: [f('user', [{ kind: 'FragmentSpread', name: 'Loop' }])] } }] }; return solution.queryDepth(doc) === 1; })()",
        },
        {
          name: 'cost multiplies by list arguments',
          assertion:
            "(() => { const f = (name, kids, args) => ({ kind: 'Field', name, args, selectionSet: kids ? { kind: 'SelectionSet', selections: kids } : undefined }); const doc = { kind: 'Document', definitions: [{ kind: 'OperationDefinition', operation: 'query', selectionSet: { kind: 'SelectionSet', selections: [f('users', [f('posts', [f('title')], { first: 5 })], { first: 10 })] } }] }; return solution.estimateCost(doc) === 61; })()",
        },
        {
          name: 'a plain leaf field costs 1',
          assertion:
            "(() => { const doc = { kind: 'Document', definitions: [{ kind: 'OperationDefinition', operation: 'query', selectionSet: { kind: 'SelectionSet', selections: [{ kind: 'Field', name: 'me' }] } }] }; return solution.estimateCost(doc) === 1; })()",
          hidden: true,
        },
        {
          name: 'limit works as a multiplier too',
          assertion:
            "(() => { const f = (name, kids, args) => ({ kind: 'Field', name, args, selectionSet: kids ? { kind: 'SelectionSet', selections: kids } : undefined }); const doc = { kind: 'Document', definitions: [{ kind: 'OperationDefinition', operation: 'query', selectionSet: { kind: 'SelectionSet', selections: [f('posts', [f('title'), f('body')], { limit: 3 })] } }] }; return solution.estimateCost(doc) === 7; })()",
          hidden: true,
        },
        {
          name: 'validateQuery accepts a query inside both budgets',
          assertion:
            "(() => { const f = (name, kids) => ({ kind: 'Field', name, selectionSet: kids ? { kind: 'SelectionSet', selections: kids } : undefined }); const doc = { kind: 'Document', definitions: [{ kind: 'OperationDefinition', operation: 'query', selectionSet: { kind: 'SelectionSet', selections: [f('user', [f('name')])] } }] }; const r = solution.validateQuery(doc, { maxDepth: 5, maxCost: 100 }); return r.ok === true && r.depth === 2 && r.cost === 2 && deepEqual(r.errors, []); })()",
          hidden: true,
        },
        {
          name: 'validateQuery reports both violations',
          assertion:
            "(() => { const f = (name, kids, args) => ({ kind: 'Field', name, args, selectionSet: kids ? { kind: 'SelectionSet', selections: kids } : undefined }); const doc = { kind: 'Document', definitions: [{ kind: 'OperationDefinition', operation: 'query', selectionSet: { kind: 'SelectionSet', selections: [f('users', [f('posts', [f('title')], { first: 5 })], { first: 10 })] } }] }; const r = solution.validateQuery(doc, { maxDepth: 2, maxCost: 50 }); return r.ok === false && r.depth === 3 && r.cost === 61 && r.errors.length === 2; })()",
          hidden: true,
        },
      ],
      xp: 90,
    },
  ],
  flashcards: [
    {
      front: 'Over-fetching vs under-fetching',
      back: 'Over-fetching: the endpoint returns fields the client discards. Under-fetching: the client needs several round trips to build one screen. GraphQL fixes both by letting the client specify the shape.',
      tags: ['graphql', 'concepts'],
    },
    {
      front: 'What does `[Post!]!` mean?',
      back: 'A list that is always present, containing elements that are never null. The usual choice for collections — an empty list rather than null.',
      tags: ['graphql', 'sdl'],
    },
    {
      front: 'Query vs Mutation execution order',
      back: 'Top-level Query fields resolve in parallel; top-level Mutation fields resolve in series, in document order. Everything below the root resolves in parallel in both cases.',
      tags: ['graphql', 'execution'],
    },
    {
      front: 'The resolver signature',
      back: '`(parent, args, context, info)`. `parent` = what the field above returned, `args` = coerced arguments, `context` = per-request bag (user, db, loaders), `info` = the field AST.',
      tags: ['graphql', 'resolvers'],
    },
    {
      front: 'What is the default resolver?',
      back: 'If no resolver exists for a field, GraphQL reads `parent[fieldName]` (calling it if it is a function). That is why you only write resolvers for joins and computed fields.',
      tags: ['graphql', 'resolvers'],
    },
    {
      front: 'The N+1 problem',
      back: '`Post.author` runs once per post, so a list of N posts costs 1 + N queries. It is a consequence of resolvers being independent functions, not a bug.',
      tags: ['graphql', 'performance'],
    },
    {
      front: 'What must a DataLoader batch function return?',
      back: 'Exactly `keys.length` values in the same order as the keys. `WHERE id IN (…)` preserves neither, so re-index through a Map and return `null` for misses.',
      tags: ['graphql', 'dataloader'],
    },
    {
      front: 'Why build DataLoaders in `context`?',
      back: 'Loaders memoise. A process-wide loader is a cache with no invalidation and can serve one user’s data to another. Fresh loaders per request give correct isolation.',
      tags: ['graphql', 'dataloader', 'security'],
    },
    {
      front: 'Why cursor pagination over offset?',
      back: '`OFFSET n` makes the database scan and discard n rows, and concurrent inserts cause duplicate or skipped items. A cursor remembers a stable position instead.',
      tags: ['graphql', 'pagination'],
    },
    {
      front: 'Relay connection shape',
      back: '`connection { edges { node cursor } pageInfo { hasNextPage hasPreviousPage startCursor endCursor } }`. The edge describes the relationship; the node is the entity.',
      tags: ['graphql', 'pagination'],
    },
    {
      front: 'Null propagation on error',
      back: 'A thrown resolver error nulls its field. If the field is non-null the null bubbles up to the nearest nullable ancestor — so over-using `!` lets one flaky field wipe out the response.',
      tags: ['graphql', 'errors'],
    },
    {
      front: 'Three defences for a public GraphQL endpoint',
      back: 'Depth limiting (validation rule, blocks cyclic nesting), cost analysis (catches wide queries depth misses), persisted queries (only pre-registered operations are accepted).',
      tags: ['graphql', 'security'],
    },
  ],
  resources: [
    { label: 'GraphQL Specification', url: 'https://spec.graphql.org/October2021/', kind: 'SPEC' },
    { label: 'graphql.org — Learn GraphQL', url: 'https://graphql.org/learn/', kind: 'DOCS' },
    { label: 'Apollo Server documentation', url: 'https://www.apollographql.com/docs/apollo-server/', kind: 'DOCS' },
    { label: 'DataLoader — source and rationale', url: 'https://github.com/graphql/dataloader', kind: 'TOOL' },
    { label: 'Relay GraphQL Cursor Connections Specification', url: 'https://relay.dev/graphql/connections.htm', kind: 'SPEC' },
  ],
};

export default day;
