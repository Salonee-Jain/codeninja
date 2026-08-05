import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 23,
  week: 4,
  pillar: 'DATABASE',
  title: 'ORMs — Prisma, Drizzle, TypeORM & Mongoose',
  summary: 'Map objects to rows and documents without losing control of the SQL that ships.',
  estimatedMinutes: 330,
  objectives: [
    'Explain what an ORM buys you and what it costs, in concrete terms',
    'Model a schema in Prisma, generate a migration, and query with the generated client',
    'Define a schema in TypeScript with Drizzle and migrate it with drizzle-kit',
    'Choose between Prisma and Drizzle on DX, bundle size, edge support and raw SQL',
    'Build TypeORM entities and choose between the Repository and Active Record patterns',
    'Design Mongoose schemas with validation, hooks, populate and lean reads',
    'Detect and fix the N+1 query problem in an ORM-backed codebase',
    'Size a connection pool and know when to drop to raw SQL',
  ],
  technologies: ['Prisma', 'Drizzle ORM', 'TypeORM', 'Mongoose'],
  lessons: [
    {
      slug: 'what-an-orm-buys-you',
      title: 'What an ORM Buys You — and What It Costs',
      estimatedMinutes: 60,
      body: `# What an ORM Buys You — and What It Costs

You already know SQL from Day 22. So why add a library between you and the database?

## The impedance mismatch

A relational database stores **rows in flat tables**. Your application code works with **objects that contain other objects**. A \`User\` has \`Post[]\`, each \`Post\` has \`Comment[]\`, each \`Comment\` has an \`author\`. That graph does not exist in Postgres — it exists only as foreign keys you have to join and then reassemble by hand.

Without an ORM every read looks like this:

\`\`\`js
const { rows } = await pg.query(
  'SELECT u.id AS user_id, u.email, p.id AS post_id, p.title FROM users u LEFT JOIN posts p ON p.author_id = u.id WHERE u.id = $1',
  [userId],
);
// now hand-fold 40 duplicated user columns back into one object with a posts array
\`\`\`

That folding code is boring, easy to get wrong, and you write it again for every query. An ORM (Object-Relational Mapper) does four things for you:

1. **Mapping** — rows to typed objects and back.
2. **Query generation** — a method call becomes parameterised SQL, which kills a whole class of injection bugs.
3. **Relation traversal** — \`include: { posts: true }\` instead of a hand-written join plus folding.
4. **Schema lifecycle** — migrations derived from your model definition, versioned in git.

## The costs, stated honestly

**Leaky abstraction.** The ORM hides SQL until it does not. The moment you need a window function, a lateral join, a partial index, a CTE, or \`INSERT ... ON CONFLICT DO UPDATE\` with a custom \`WHERE\`, you are reading the ORM's source to work out how to express it. Every ORM has an escape hatch precisely because this happens.

**Invisible cost.** \`user.posts\` looks like a property access. It may be a network round trip. This is how the N+1 problem is born — we spend the last lesson of the day on it.

**Query shape you did not choose.** ORMs often emit a query that is correct but slow: a \`LEFT JOIN\` that multiplies rows, a \`SELECT *\` that pulls a 2 MB JSONB column you never read, an \`ORDER BY\` that cannot use your index.

**Another thing to learn.** The ORM's DSL, its migration tool, its transaction semantics, its connection pool. That is real budget.

Rule of thumb: **an ORM is a productivity tool for the 90% of queries that are boring, not a replacement for knowing SQL.** If you cannot read the SQL your ORM emits, you cannot debug production.

## Two patterns: Active Record vs Data Mapper

**Active Record** — the model object knows how to persist itself.

\`\`\`ts
const user = new User();
user.email = 'ada@example.com';
await user.save();            // the object talks to the database
\`\`\`

Short and readable. The cost is that persistence logic and domain logic live in the same class, which gets awkward to unit test and to reason about once the model has 30 methods. Rails popularised it; TypeORM and Mongoose both offer it.

**Data Mapper** — a separate object moves data between the database and plain models.

\`\`\`ts
const repo = dataSource.getRepository(User);
const user = repo.create({ email: 'ada@example.com' });
await repo.save(user);        // the repository talks to the database
\`\`\`

Your entity stays a dumb data holder; the repository owns persistence. More ceremony, better separation, easier to mock. TypeORM supports both. Prisma sidesteps the argument entirely: there are no model classes at all, just a generated client with typed methods.

## The four libraries at a glance

| | Prisma | Drizzle ORM | TypeORM | Mongoose |
| --- | --- | --- | --- | --- |
| Model definition | \`schema.prisma\` DSL | TypeScript objects (\`pgTable\`) | TS classes + decorators | JS schema objects |
| Pattern | generated client (neither AR nor DM) | typed SQL query builder | Data Mapper *and* Active Record | document/ODM, active-record flavoured |
| Databases | Postgres, MySQL, SQLite, SQL Server, CockroachDB, MongoDB | Postgres, MySQL, SQLite (+ their serverless drivers) | most SQL engines | MongoDB only |
| Type safety | generated from schema — the strongest | inferred from the schema objects — equally strong, no codegen | decorator-inferred — good | weakest; types are hand-maintained |
| Migrations | \`prisma migrate\` (real SQL files) | \`drizzle-kit generate\` (real SQL files) | \`migration:generate\` (TS files) | none — Mongo is schemaless |
| Eager load | \`include\` / \`select\` | \`with\` (relational queries) or an explicit join | \`relations\` / QueryBuilder | \`populate()\` |
| Raw escape | \`$queryRaw\` | the \`sql\` tagged template, composable | \`dataSource.query()\` | \`Model.aggregate()\` / driver access |

## Choosing

- **New TypeScript service on Postgres or MySQL?** Prisma or Drizzle. Prisma if you want the highest-level API and the richest tooling; Drizzle if you like SQL, care about bundle size, or deploy to an edge runtime. The table below is the honest side-by-side; the next lesson teaches both APIs.
- **Existing class-heavy codebase, or you need lazy relations and deep customisation of the query builder?** TypeORM.
- **Storing documents in MongoDB?** Mongoose, or the raw driver if your access patterns are simple.

## Prisma vs Drizzle, honestly

| | Prisma | Drizzle |
| --- | --- | --- |
| **DX** | highest-level API, least SQL to know, excellent errors | you must know SQL; nothing is hidden |
| **Types** | generated — needs \`prisma generate\` after every schema edit | inferred — no build step, but heavy schemas slow \`tsc\` |
| **Bundle size** | larger: client plus engine/adapters | small, tree-shakeable |
| **Edge runtimes** | via driver adapters | first-class, no extra setup |
| **Raw SQL** | \`$queryRaw\`, untyped rows you annotate by hand | \`sql\` composes into the builder, keeps its types |
| **Migrations** | \`prisma migrate\`, mature, checksummed | \`drizzle-kit generate/migrate\`, same model, younger |
| **Ecosystem** | very large: Studio, hosted add-ons, tutorials | smaller, moving fast; Studio and Kit cover the basics |

The decision, plainly: **pick Prisma when the team wants to think about objects and the fewest database concepts; pick Drizzle when the team already thinks in SQL, or when bundle size and edge runtimes are hard requirements.** Both emit reviewable SQL migrations and both are properly typed. Do not let this choice consume a sprint.

> Whatever you choose, turn on query logging in development on day one. An ORM you cannot observe is an ORM you cannot tune.`,
    },
    {
      slug: 'prisma-and-drizzle',
      title: 'Prisma & Drizzle — Schemas, Migrations, Typed Clients',
      estimatedMinutes: 100,
      body: `# Prisma & Drizzle — Schemas, Migrations, Typed Clients

These are the two libraries a new TypeScript service on Postgres actually chooses between. They solve the same problem from opposite ends: Prisma gives you a purpose-built schema language and a generated high-level client; Drizzle gives you SQL with types on it.

Prisma is not a classic ORM. There are no model classes and no \`save()\`. You write a schema, run a generator, and get a fully typed client.

## The schema DSL

One file, \`prisma/schema.prisma\`, is the single source of truth. Above the models it also declares the \`datasource\` (provider plus \`env("DATABASE_URL")\`) and the \`generator\`:

\`\`\`prisma
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id        Int     @id @default(autoincrement())
  title     String
  published Boolean @default(false)
  author    User    @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId  Int
  tags      Tag[]

  @@index([authorId, published])
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[]
}
\`\`\`

Read the relations carefully, because this trips up everyone:

- \`posts Post[]\` on \`User\` is **virtual**. It creates no column. It is the back-reference.
- \`author User @relation(fields: [authorId], references: [id])\` on \`Post\` is the side that owns the **foreign key**. \`authorId\` is the real column. A one-to-one is the same shape plus \`@unique\` on the FK.
- \`Post[] <-> Tag[]\` with no explicit fields is an **implicit many-to-many**: Prisma silently creates a \`_PostToTag\` join table. Add an explicit join model the moment you need a column on the relationship.

## Migrations

\`\`\`bash
npx prisma migrate dev --name add_post_tags   # dev: diff, write SQL, apply, regenerate client
npx prisma migrate deploy                     # prod/CI: apply pending migrations only
npx prisma db push                            # prototyping only: sync schema, no migration file
\`\`\`

\`migrate dev\` writes a real \`.sql\` file under \`prisma/migrations/\`. **Read it before you commit it** — a rename looks identical to "drop one column, add another", and the generated SQL will throw your data away unless you hand-edit it to an \`ALTER TABLE ... RENAME COLUMN\`.

> Never edit a migration already applied to an environment you care about. \`_prisma_migrations\` stores a checksum, so changing an applied file makes \`migrate deploy\` fail.

## The generated client

\`\`\`ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['query', 'warn', 'error'] });

// a nested write: one call, run inside a transaction
await prisma.user.create({
  data: { email: 'ada@example.com', posts: { create: [{ title: 'On Notes' }] } },
});

await prisma.post.findMany({
  where: { published: true, title: { contains: 'ninja', mode: 'insensitive' } },
  orderBy: { createdAt: 'desc' },
  take: 20,
});
\`\`\`

## include vs select

**\`select\`** is exclusive — only the listed fields come back, relations included. **\`include\`** is additive — every scalar plus the listed relations. Using both at one level throws; nest instead (\`select: { id: true, author: { select: { email: true } } }\`). Default to \`select\`: \`include: { author: true }\` on a table with a \`passwordHash\` column is how credentials leak into JSON responses.

## Transactions

\`\`\`ts
await prisma.$transaction(async (tx) => {
  const from = await tx.account.findUniqueOrThrow({ where: { id: 1 } });
  if (from.balance < 100) throw new Error('insufficient funds');   // throwing rolls back
  await tx.account.update({ where: { id: 1 }, data: { balance: { decrement: 100 } } });
}, { timeout: 5000, isolationLevel: 'Serializable' });
\`\`\`

That is the *interactive* form; pass an array (\`$transaction([opA, opB])\`) when there is no logic in between. Inside the callback you **must** use \`tx\`, not \`prisma\` — the outer client checks out a second connection outside the transaction, a classic deadlock generator. For raw SQL, \`$queryRaw\`/\`$executeRaw\` take a **tagged template** so interpolations become bind parameters; \`$queryRawUnsafe(string)\` is as dangerous as it sounds.

---

# Drizzle ORM

Drizzle takes the opposite bet: **no DSL and no code generation.** The schema is ordinary TypeScript, the builder mirrors SQL clause for clause, and types are *inferred* rather than emitted.

## Schema in TypeScript

\`\`\`ts
// src/db/schema.ts
import { pgTable, serial, text, boolean, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
});

export const posts = pgTable(
  'posts',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    published: boolean('published').default(false).notNull(),
    authorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => ({ authorPublishedIdx: index('posts_author_published_idx').on(t.authorId, t.published) }),
);

export const usersRelations = relations(users, ({ many }) => ({ posts: many(posts) }));
export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
}));

export type Post = typeof posts.$inferSelect;      // row type
export type NewPost = typeof posts.$inferInsert;   // insert type, defaults optional
\`\`\`

Two things follow from this being plain TypeScript. First, \`$inferSelect\`/\`$inferInsert\` give you row types with **no build step** — no \`prisma generate\` to forget in CI. Second, \`relations()\` is purely a client-side description: unlike \`references()\`, it emits no DDL. Forgetting it is the classic Drizzle bug, because the relational query API then silently cannot see the relation.

## The SQL-like builder

\`\`\`ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, ilike, desc, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';
import { posts, users, accounts } from './schema';

export const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }), { schema });

const rows = await db
  .select({ id: posts.id, title: posts.title, authorEmail: users.email })
  .from(posts)
  .innerJoin(users, eq(posts.authorId, users.id))
  .where(and(eq(posts.published, true), ilike(posts.title, '%ninja%')))
  .orderBy(desc(posts.id))
  .limit(20);
// rows: { id: number; title: string; authorEmail: string }[]
\`\`\`

If you can read the SQL, you can read this — and the reverse, which is the real selling point: **there is no query you can write in the builder whose emitted SQL surprises you.** Writes look the same, including \`.returning()\` and \`.onConflictDoUpdate({ target, set })\`:

\`\`\`ts
await db.transaction(async (tx) => {
  await tx.update(accounts).set({ balance: sql\`\${accounts.balance} - 100\` }).where(eq(accounts.id, 1));
  await tx.update(accounts).set({ balance: sql\`\${accounts.balance} + 100\` }).where(eq(accounts.id, 2));
});
\`\`\`

The \`sql\` template is not a bolt-on escape hatch but a first-class value you compose into any clause: interpolated columns render as identifiers, interpolated values as bind parameters.

## Relational queries: the nested-object API

The builder returns flat rows — correct SQL, annoying application code. \`db.query\` is the second API, returning an object graph from **one** statement:

\`\`\`ts
const feed = await db.query.posts.findMany({
  columns: { id: true, title: true },
  with: { author: { columns: { email: true } } },
  where: (p, { eq }) => eq(p.published, true),
  orderBy: (p, { desc }) => [desc(p.id)],
  limit: 20,
});
// { id: number; title: string; author: { email: string } }[]
\`\`\`

This is Prisma's \`select\`/\`include\` ergonomics without giving up the builder, and it is a single round trip by construction, so it cannot decay into an N+1.

## drizzle-kit migrations

A \`drizzle.config.ts\` exporting \`defineConfig({ schema, out, dialect: 'postgresql', dbCredentials })\` points the CLI at your schema:

\`\`\`bash
npx drizzle-kit generate   # diff schema.ts against ./drizzle -> a numbered .sql file
npx drizzle-kit migrate    # apply pending migrations
npx drizzle-kit push       # prototyping only: sync the database, no migration file
npx drizzle-kit studio     # browse the data
\`\`\`

Same shape as Prisma, same rules: \`generate\` writes plain SQL you are expected to read, a rename looks like a drop-plus-add until you edit it by hand, and \`push\` is for throwaway databases only.

## Zero-runtime and the edge

Drizzle is a thin, tree-shakeable TypeScript library: no companion binary, no query-engine process, no generated client directory. That is why it runs unmodified on Cloudflare Workers, Vercel Edge, Bun and Deno, and why a bundled Lambda handler stays small. You supply the driver — \`drizzle-orm/node-postgres\`, \`neon-http\`, \`d1\`. Prisma reached the edge later, through driver adapters plus a Rust-free client: it works, but it is more moving parts. Lesson 1's table has the full side-by-side.`,
    },
    {
      slug: 'typeorm-and-mongoose',
      title: 'TypeORM & Mongoose — Entities, Repositories, Documents and Hooks',
      estimatedMinutes: 90,
      body: `# TypeORM & Mongoose — Entities, Repositories, Documents and Hooks

## TypeORM: your classes *are* the schema

\`\`\`ts
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, Index, CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @OneToMany(() => Post, (post) => post.author)
  posts!: Post[];

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity('posts')
@Index(['authorId', 'published'])
export class Post {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ default: false })
  published!: boolean;

  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author!: User;

  @Column({ name: 'author_id' })
  authorId!: number;
}
\`\`\`

The \`() => Post\` thunk is not decoration — it defers evaluation so circular imports between entity files resolve. Forgetting it produces the famously unhelpful "Cannot read properties of undefined (reading 'name')" at boot.

### DataSource

The \`DataSource\` is the connection + metadata registry. Create it once per process.

\`\`\`ts
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Post],
  migrations: ['dist/migrations/*.js'],
  synchronize: false,      // NEVER true outside a throwaway dev database
  logging: ['query', 'error'],
  poolSize: 10,
});

await AppDataSource.initialize();
\`\`\`

> \`synchronize: true\` alters your live schema to match your entities on every boot. It will silently drop a column you renamed. Use migrations.

### Repository vs Active Record

\`\`\`ts
// Data Mapper — the default and the one to prefer
const posts = AppDataSource.getRepository(Post);
const p = posts.create({ title: 'Hello', authorId: 1 });
await posts.save(p);
const published = await posts.find({
  where: { published: true },
  relations: { author: true },
  order: { id: 'DESC' },
  take: 20,
});
\`\`\`

For Active Record, extend \`BaseEntity\` and you get \`Post.find()\`, \`post.save()\`, \`post.remove()\` directly on the class. It reads well in small apps; it also means every entity is coupled to a global connection, which makes multi-tenant setups and tests painful. Pick one style per codebase and stick to it.

### QueryBuilder and migrations

When \`find()\` runs out of expressiveness:

\`\`\`ts
const rows = await posts
  .createQueryBuilder('post')
  .innerJoinAndSelect('post.author', 'author')
  .where('post.published = :pub', { pub: true })
  .andWhere('author.email ILIKE :q', { q: '%@example.com' })
  .orderBy('post.createdAt', 'DESC')
  .limit(50)
  .getMany();
\`\`\`

Always use \`:named\` parameters — string-concatenating into \`.where()\` reintroduces SQL injection.

\`\`\`bash
npx typeorm migration:generate ./src/migrations/AddPublished -d ./src/data-source.ts
npx typeorm migration:run -d ./src/data-source.ts
npx typeorm migration:revert -d ./src/data-source.ts
\`\`\`

Generated migrations are TypeScript classes with \`up()\` and \`down()\`. Unlike Prisma, TypeORM writes both directions — but the generated \`down()\` is only as good as the diff, so review it.

## Mongoose: schemas over a schemaless database

MongoDB does not enforce a shape. Mongoose adds one in the application layer, which is usually what you want.

\`\`\`js
const mongoose = require('mongoose');
const { Schema, model, Types } = mongoose;

const postSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    body: { type: String, required: true },
    published: { type: Boolean, default: false, index: true },
    author: { type: Types.ObjectId, ref: 'User', required: true },
    tags: { type: [String], default: [], validate: (v) => v.length <= 10 },
    views: {
      type: Number,
      default: 0,
      min: [0, 'views cannot be negative'],
    },
  },
  { timestamps: true },
);

postSchema.index({ author: 1, createdAt: -1 });

const Post = model('Post', postSchema);
\`\`\`

\`timestamps: true\` adds and maintains \`createdAt\`/\`updatedAt\`. Validators run on \`save()\` and, only if you pass \`runValidators: true\`, on \`updateOne\`/\`findOneAndUpdate\` — a very common source of "how did that invalid document get in?".

### Middleware (hooks)

\`\`\`js
postSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  next();
});

postSchema.post('save', function (doc) {
  console.log('saved', doc._id.toString());
});

// query middleware: note the arrow-unfriendly \`this\` is the Query, not the doc
postSchema.pre(/^find/, function () {
  this.where({ deletedAt: null });
});
\`\`\`

Document hooks (\`save\`, \`validate\`) bind \`this\` to the document. Query hooks (\`find\`, \`findOneAndUpdate\`) bind \`this\` to the query. Never use an arrow function for either — you lose \`this\`.

### populate and lean

\`populate\` is a **second query**, not a join:

\`\`\`js
const posts = await Post.find({ published: true })
  .populate({ path: 'author', select: 'email name' })
  .sort({ createdAt: -1 })
  .limit(20)
  .lean();
\`\`\`

Mongoose collects the distinct \`author\` ObjectIds and issues one \`$in\` query — so a populate over 20 posts is 2 queries, not 21. That is good. What is not good is populating in a loop.

\`.lean()\` returns plain JS objects instead of hydrated Mongoose documents. You lose \`save()\`, virtuals and getters; you gain a large amount of speed and memory on read-only endpoints. **Use \`.lean()\` on every read you are only going to serialise to JSON.**`,
    },
    {
      slug: 'n-plus-one-pools-and-raw',
      title: 'N+1, Connection Pools and the Raw-SQL Escape Hatch',
      estimatedMinutes: 80,
      body: `# N+1, Connection Pools and the Raw-SQL Escape Hatch

## The N+1 problem

You fetch a list, then loop over it and touch a relation:

\`\`\`ts
const posts = await prisma.post.findMany({ take: 50 });          // 1 query
for (const post of posts) {
  const author = await prisma.user.findUnique({ where: { id: post.authorId } });  // 50 queries
  console.log(post.title, author.email);
}
\`\`\`

51 round trips. At 1 ms of network latency each that is 51 ms of pure waiting; across an ocean at 40 ms it is two seconds. The query log is the giveaway — the same statement shape repeated with different parameters:

\`\`\`
SELECT * FROM "User" WHERE id = $1   -- 50 times
\`\`\`

That signature — **one query, then N identical-shaped queries** — is what you look for. Today's first coding problem builds a detector for exactly this pattern.

### Fix 1: eager load

\`\`\`ts
const posts = await prisma.post.findMany({ take: 50, include: { author: true } });
\`\`\`

One query with a join (or two queries that Prisma correlates for you, depending on the relation). TypeORM: \`relations: { author: true }\`. Mongoose: \`.populate('author')\`.

### Fix 2: batch by hand

Sometimes you cannot eager load — the relation is computed, or comes from another service.

\`\`\`ts
const ids = [...new Set(posts.map((p) => p.authorId))];
const authors = await prisma.user.findMany({ where: { id: { in: ids } } });
const byId = new Map(authors.map((a) => [a.id, a]));
posts.forEach((p) => (p.author = byId.get(p.authorId)));
\`\`\`

Two queries regardless of list size. Deduplicating with a \`Set\` matters: 50 posts by 3 authors should fetch 3 rows.

### Fix 3: DataLoader

In GraphQL (Day 18) resolvers cannot see each other, so the batching has to happen underneath:

\`\`\`js
const DataLoader = require('dataloader');
const userLoader = new DataLoader(async (ids) => {
  const users = await prisma.user.findMany({ where: { id: { in: [...ids] } } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return ids.map((id) => byId.get(id) ?? null);   // must return in input order, same length
});
\`\`\`

DataLoader collects every \`.load(id)\` call within one tick of the event loop and issues a single batched query. The contract is strict: **return an array the same length as \`keys\`, in the same order.**

### The opposite failure: over-fetching

\`include\` everything and a "list posts" endpoint becomes a five-table join returning 8 MB. Eager loading a \`hasMany\` inside another \`hasMany\` multiplies rows. Load what the screen renders, nothing more.

## Connection pooling

Every query needs a TCP connection with an authenticated session. Opening one costs several round trips plus a Postgres backend process (a few MB). A **pool** keeps a fixed set open and hands them out.

\`\`\`
DATABASE_URL="postgresql://u:p@host:5432/db?connection_limit=10&pool_timeout=20"
\`\`\`

\`\`\`ts
// TypeORM
new DataSource({ type: 'postgres', url, poolSize: 10, extra: { idleTimeoutMillis: 30000 } });

// Mongoose
await mongoose.connect(uri, { maxPoolSize: 20, minPoolSize: 2, serverSelectionTimeoutMS: 5000 });
\`\`\`

Sizing rules that actually hold:

- **Pool size is per process.** 8 Node containers with \`connection_limit=10\` is 80 connections. Postgres' default \`max_connections\` is 100 and it includes your migration job and your psql session.
- Bigger is not faster. Past roughly \`(cores * 2) + effective_spindles\` on the database, more connections mean more context switching and *lower* throughput.
- Serverless is the hard case: every cold lambda wants its own pool. Put **PgBouncer** (transaction pooling) or a managed proxy in front, and set \`pgbouncer=true\` on the Prisma URL so it stops using prepared statements.
- Always set a **pool timeout**. Without it, a pool exhausted by one slow query turns into an unbounded queue and the whole service hangs instead of failing fast.

> Symptom to memorise: "Timed out fetching a new connection from the pool." That is almost never a database problem. It is a leaked connection (a transaction you never committed) or an N+1 loop holding connections while it waits.

## When to drop to raw SQL

Reach for the escape hatch when:

| Situation | Why the ORM loses |
| --- | --- |
| Window functions, \`LATERAL\`, recursive CTEs | Most ORMs cannot express them at all |
| Bulk upsert of 10k rows | Row-at-a-time \`save()\` is 10k round trips; one \`INSERT ... ON CONFLICT\` is one |
| Reporting aggregates across 6 tables | The generated join is nowhere near what the planner wants |
| \`EXPLAIN\`-driven tuning | You need to control join order and index hints |
| Vendor features: \`tsvector\`, PostGIS, \`JSONB\` operators | Outside the ORM's type system |

And keep using the ORM for CRUD, relation traversal, migrations and anything a junior will touch.

\`\`\`ts
const stats = await prisma.$queryRaw<{ author_id: number; posts: bigint }[]>\`
  SELECT author_id, count(*) AS posts
  FROM "Post"
  WHERE created_at > now() - interval '30 days'
  GROUP BY author_id
  ORDER BY posts DESC
  LIMIT 10
\`;
\`\`\`

Two rules for raw SQL in an ORM codebase: **always parameterise** (tagged templates or \`$1\` placeholders, never string concatenation), and **isolate it** in a \`src/queries/\` module so it is reviewable and testable rather than scattered through controllers.`,
    },
  ],
  quiz: [
    {
      prompt: 'In Prisma, what is the difference between `select` and `include`?',
      options: [
        '`select` returns only the listed fields; `include` returns all scalar fields plus the listed relations',
        '`select` works on relations only; `include` works on scalars only',
        'They are aliases for each other',
        '`include` is for writes and `select` is for reads',
      ],
      correctIndex: 0,
      explanation:
        '`select` is exclusive — anything not listed is dropped, including scalars. `include` is additive — every scalar column comes back plus whichever relations you list. Prisma throws if you use both at the same level.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Inside `prisma.$transaction(async (tx) => { ... })`, why must you use `tx` rather than the outer `prisma` client?',
      options: [
        '`prisma` is read-only inside a transaction callback',
        'It is only a style preference; both are equivalent',
        'The outer client checks out a different connection, so its writes are outside the transaction and can deadlock against it',
        '`tx` is faster because it skips validation',
      ],
      correctIndex: 2,
      explanation:
        'The transaction is bound to one checked-out connection. Calling the outer client grabs a second connection whose statements are not part of the transaction — they will not roll back, and they can block on locks the transaction holds.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What does TypeORM `synchronize: true` do, and why is it dangerous in production?',
      options: [
        'It replicates data to a read replica; dangerous because of lag',
        'It alters the live schema on boot to match your entities, which can silently drop columns and data',
        'It synchronises the connection pool size with CPU count',
        'It forces every query into a serializable transaction',
      ],
      correctIndex: 1,
      explanation:
        'It diffs entity metadata against the live schema and applies DDL at startup. A renamed property looks like drop-plus-add, so the old column and its data disappear with no migration file to review or revert.',
      difficulty: 'EASY',
    },
    {
      prompt: 'A Mongoose `pre` hook registered on `findOneAndUpdate` — what is `this` bound to?',
      options: ['The document being updated', 'The model class', 'The Query object', 'The connection'],
      correctIndex: 2,
      explanation:
        'Query middleware binds `this` to the Query, so you use `this.getFilter()` / `this.getUpdate()` / `this.where()`. Only document middleware (`save`, `validate`) binds `this` to the document. Arrow functions break both.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which query log is the signature of an N+1 problem?',
      options: [
        'A single query with six JOINs returning 40,000 rows',
        'One SELECT over a list, followed by the same SELECT shape repeated once per row with different parameters',
        'Repeated BEGIN/COMMIT pairs with no statements in between',
        'A query that appears once but takes 900 ms',
      ],
      correctIndex: 1,
      explanation:
        'N+1 is literally one query for the collection plus N identical-shaped queries for the relation. The fix is eager loading (`include` / `relations` / `populate`) or batching the ids into a single `IN` query.',
      difficulty: 'EASY',
    },
    {
      prompt: 'In Drizzle, what does `db.query.posts.findMany({ with: { author: true } })` give you that `db.select().from(posts).innerJoin(users, ...)` does not?',
      options: [
        'It runs one extra query per post to load the author',
        'It bypasses the connection pool for read-only work',
        'It trades away type inference for convenience',
        'It returns a nested object graph — each post with an `author` object — from a single SQL statement, instead of flat joined rows you have to fold yourself',
      ],
      correctIndex: 3,
      explanation:
        'The relational query API builds one statement and assembles the nested result for you, so it is a single round trip by construction and cannot degrade into an N+1. The plain builder is still there when you want exact control over the join and the projection.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'You run 8 Node containers, each with a Prisma `connection_limit=10`, against a Postgres with `max_connections=100`. What happens?',
      options: [
        'Nothing — Prisma shares one global pool across containers',
        'Postgres queues the extra connections transparently',
        'Prisma automatically reduces each pool to 12',
        'Up to 80 connections are opened, leaving almost no headroom for migrations, psql and superuser slots — new connections start failing',
      ],
      correctIndex: 3,
      explanation:
        'Pools are per process. 8 x 10 = 80, and Postgres reserves some slots for superusers, so a migration job or an ops session can be refused. Either lower the per-process limit or put PgBouncer in front.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Which task is the best reason to drop out of the ORM into raw SQL?',
      options: [
        'Fetching one row by primary key',
        'Inserting a single record with two relations',
        'A ranked report using a window function over a 30-day interval across six joined tables',
        'Paginating a list with take/skip',
      ],
      correctIndex: 2,
      explanation:
        'Window functions and hand-tuned join order are outside what most ORM query builders can express, and the generated plan is usually far from optimal. Simple CRUD and pagination are exactly what the ORM is good at.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'n-plus-one-detector',
      title: 'N+1 Detector and Query Batcher',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Your ORM logged every SQL statement it emitted during one request. Write the tooling that spots an N+1.

Export three functions.

**\`normalizeQuery(sql)\`** — collapse a statement into its *shape* so that queries differing only by literal values look identical. In order:

1. replace every single-quoted string literal with \`?\`
2. replace every run of digits with \`?\`
3. collapse runs of whitespace to a single space
4. trim

\`\`\`js
normalizeQuery('SELECT * FROM posts WHERE author_id = 42')
// 'SELECT * FROM posts WHERE author_id = ?'
\`\`\`

**\`detectNPlusOne(log, threshold = 3)\`** — \`log\` is an array of SQL strings. Return \`{ pattern, count }\` objects for every shape that occurs at least \`threshold\` times, sorted by \`count\` descending, then by \`pattern\` ascending.

**\`batchedQueryCount(log, threshold = 3)\`** — how many queries would remain if every detected N+1 shape were collapsed into a single batched \`IN (...)\` query. Shapes below the threshold are counted as-is.

\`\`\`js
const log = [
  'SELECT * FROM users',
  'SELECT * FROM posts WHERE author_id = 1',
  'SELECT * FROM posts WHERE author_id = 2',
  'SELECT * FROM posts WHERE author_id = 3',
];
batchedQueryCount(log); // 2  -> the users query, plus one batched posts query
\`\`\``,
      starterCode: `function normalizeQuery(sql) {
  // your code
}

function detectNPlusOne(log, threshold = 3) {
  // your code
}

function batchedQueryCount(log, threshold = 3) {
  // your code
}

module.exports = { normalizeQuery, detectNPlusOne, batchedQueryCount };`,
      solutionCode: `function normalizeQuery(sql) {
  return String(sql)
    .replace(/'[^']*'/g, '?')
    .replace(/\\d+/g, '?')
    .replace(/\\s+/g, ' ')
    .trim();
}

function countShapes(log) {
  const counts = new Map();
  for (const sql of log) {
    const pattern = normalizeQuery(sql);
    counts.set(pattern, (counts.get(pattern) || 0) + 1);
  }
  return counts;
}

function detectNPlusOne(log, threshold = 3) {
  const out = [];
  for (const [pattern, count] of countShapes(log)) {
    if (count >= threshold) out.push({ pattern, count });
  }
  out.sort((a, b) => b.count - a.count || (a.pattern < b.pattern ? -1 : a.pattern > b.pattern ? 1 : 0));
  return out;
}

function batchedQueryCount(log, threshold = 3) {
  let total = 0;
  for (const count of countShapes(log).values()) {
    total += count >= threshold ? 1 : count;
  }
  return total;
}

module.exports = { normalizeQuery, detectNPlusOne, batchedQueryCount };`,
      hints: [
        'Do the string-literal replacement before the digit replacement, or digits inside quoted strings get mangled first.',
        'A Map keyed by the normalised pattern gives you the counts in one pass.',
        'For batchedQueryCount, every shape at or above the threshold contributes exactly 1; every other shape contributes its own count.',
      ],
      tests: [
        {
          name: 'normalises numeric literals',
          assertion:
            "solution.normalizeQuery('SELECT * FROM posts WHERE author_id = 42') === 'SELECT * FROM posts WHERE author_id = ?'",
        },
        {
          name: 'normalises string literals and whitespace',
          assertion:
            "solution.normalizeQuery(\"SELECT   id FROM users WHERE email = 'ada@example.com'\") === 'SELECT id FROM users WHERE email = ?'",
        },
        {
          name: 'detects a repeated shape',
          assertion:
            "(() => { const log = ['SELECT * FROM users', 'SELECT * FROM posts WHERE author_id = 1', 'SELECT * FROM posts WHERE author_id = 2', 'SELECT * FROM posts WHERE author_id = 3']; return deepEqual(solution.detectNPlusOne(log), [{ pattern: 'SELECT * FROM posts WHERE author_id = ?', count: 3 }]); })()",
        },
        {
          name: 'respects the threshold',
          assertion:
            "(() => { const log = ['SELECT * FROM posts WHERE id = 1', 'SELECT * FROM posts WHERE id = 2']; return solution.detectNPlusOne(log).length === 0 && solution.detectNPlusOne(log, 2).length === 1; })()",
        },
        {
          name: 'batching collapses the repeated shape',
          assertion:
            "(() => { const log = ['SELECT * FROM users', 'SELECT * FROM posts WHERE author_id = 1', 'SELECT * FROM posts WHERE author_id = 2', 'SELECT * FROM posts WHERE author_id = 3']; return solution.batchedQueryCount(log) === 2; })()",
        },
        {
          name: 'sorts by count desc then pattern asc',
          assertion:
            "(() => { const log = ['SELECT a FROM t WHERE id = 1','SELECT a FROM t WHERE id = 2','SELECT a FROM t WHERE id = 3','SELECT a FROM t WHERE id = 4','SELECT b FROM u WHERE id = 1','SELECT b FROM u WHERE id = 2','SELECT b FROM u WHERE id = 3']; const r = solution.detectNPlusOne(log); return r.length === 2 && r[0].count === 4 && r[1].count === 3; })()",
          hidden: true,
        },
        {
          name: 'empty log is safe',
          assertion: 'deepEqual(solution.detectNPlusOne([]), []) && solution.batchedQueryCount([]) === 0',
          hidden: true,
        },
      ],
      xp: 40,
    },
    {
      slug: 'migration-diff-generator',
      title: 'Migration Diff Generator',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `This is what \`prisma migrate dev\` and \`typeorm migration:generate\` do underneath: diff two schema snapshots and emit DDL.

A schema is an object of tables; a table is an object of columns; a column is \`{ type, nullable }\`.

\`\`\`js
const from = { User: { id: { type: 'Int', nullable: false }, email: { type: 'String', nullable: false } } };
const to   = { User: { id: { type: 'Int', nullable: false }, email: { type: 'String', nullable: true },
                       name: { type: 'String', nullable: true } } };
\`\`\`

**\`diffSchemas(from, to)\`** returns an array of operations in exactly this order:

1. \`{ op: 'createTable', table, columns }\` for every table only in \`to\` (tables in ascending name order)
2. then, for each table present in **both** (ascending name order), in this order:
   - \`{ op: 'addColumn', table, column, definition }\` for columns only in \`to\` (ascending column name)
   - \`{ op: 'alterColumn', table, column, from, to }\` for columns whose \`type\` or \`nullable\` differ (ascending column name) — interleaved with \`addColumn\` by walking \`to\`'s columns in ascending order
   - \`{ op: 'dropColumn', table, column }\` for columns only in \`from\` (ascending column name)
3. \`{ op: 'dropTable', table }\` for every table only in \`from\` (ascending name order)

**\`isDestructive(ops)\`** returns \`true\` if any op is a \`dropTable\`, a \`dropColumn\`, or an \`alterColumn\` that makes a nullable column \`NOT NULL\` (the migration can fail on existing rows).

**\`toSql(ops)\`** returns an array of statement strings:

\`\`\`
CREATE TABLE "Post" ("id" Int NOT NULL, "title" String);
ALTER TABLE "User" ADD COLUMN "name" String;
ALTER TABLE "User" ALTER COLUMN "email" TYPE Text;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" DROP COLUMN "legacy";
DROP TABLE "Audit";
\`\`\`

Column definitions inside \`CREATE TABLE\` are \`"name" Type\` plus \` NOT NULL\` when \`nullable\` is false, in the object's own key order. An \`alterColumn\` emits a \`TYPE\` statement only if the type changed, and a \`SET NOT NULL\`/\`DROP NOT NULL\` statement only if nullability changed — in that order.`,
      starterCode: `function diffSchemas(from, to) {
  // your code
}

function isDestructive(ops) {
  // your code
}

function toSql(ops) {
  // your code
}

module.exports = { diffSchemas, isDestructive, toSql };`,
      solutionCode: `function diffSchemas(from, to) {
  const ops = [];
  const fromTables = Object.keys(from).sort();
  const toTables = Object.keys(to).sort();

  for (const t of toTables) {
    if (!(t in from)) ops.push({ op: 'createTable', table: t, columns: to[t] });
  }

  for (const t of toTables) {
    if (!(t in from)) continue;
    const a = from[t];
    const b = to[t];
    for (const c of Object.keys(b).sort()) {
      if (!(c in a)) {
        ops.push({ op: 'addColumn', table: t, column: c, definition: b[c] });
      } else if (a[c].type !== b[c].type || a[c].nullable !== b[c].nullable) {
        ops.push({ op: 'alterColumn', table: t, column: c, from: a[c], to: b[c] });
      }
    }
    for (const c of Object.keys(a).sort()) {
      if (!(c in b)) ops.push({ op: 'dropColumn', table: t, column: c });
    }
  }

  for (const t of fromTables) {
    if (!(t in to)) ops.push({ op: 'dropTable', table: t });
  }

  return ops;
}

function isDestructive(ops) {
  return ops.some(
    (o) =>
      o.op === 'dropTable' ||
      o.op === 'dropColumn' ||
      (o.op === 'alterColumn' && o.from.nullable === true && o.to.nullable === false),
  );
}

function columnDef(name, def) {
  return '"' + name + '" ' + def.type + (def.nullable ? '' : ' NOT NULL');
}

function toSql(ops) {
  const out = [];
  for (const o of ops) {
    if (o.op === 'createTable') {
      const cols = Object.keys(o.columns).map((c) => columnDef(c, o.columns[c]));
      out.push('CREATE TABLE "' + o.table + '" (' + cols.join(', ') + ');');
    } else if (o.op === 'addColumn') {
      out.push('ALTER TABLE "' + o.table + '" ADD COLUMN ' + columnDef(o.column, o.definition) + ';');
    } else if (o.op === 'alterColumn') {
      const head = 'ALTER TABLE "' + o.table + '" ALTER COLUMN "' + o.column + '" ';
      if (o.from.type !== o.to.type) out.push(head + 'TYPE ' + o.to.type + ';');
      if (o.from.nullable !== o.to.nullable) {
        out.push(head + (o.to.nullable ? 'DROP NOT NULL' : 'SET NOT NULL') + ';');
      }
    } else if (o.op === 'dropColumn') {
      out.push('ALTER TABLE "' + o.table + '" DROP COLUMN "' + o.column + '";');
    } else if (o.op === 'dropTable') {
      out.push('DROP TABLE "' + o.table + '";');
    }
  }
  return out;
}

module.exports = { diffSchemas, isDestructive, toSql };`,
      hints: [
        'Object.keys(...).sort() everywhere makes the output deterministic — a migration generator that emits a different order on every run is useless.',
        'Walk the target table columns once: a column missing from the source is an addColumn, a column whose type or nullable differs is an alterColumn.',
        'A widening change (NOT NULL -> nullable) is safe; the narrowing direction is the destructive one.',
      ],
      tests: [
        {
          name: 'detects an added column',
          assertion:
            "(() => { const from = { User: { id: { type: 'Int', nullable: false } } }; const to = { User: { id: { type: 'Int', nullable: false }, name: { type: 'String', nullable: true } } }; return deepEqual(solution.diffSchemas(from, to), [{ op: 'addColumn', table: 'User', column: 'name', definition: { type: 'String', nullable: true } }]); })()",
        },
        {
          name: 'detects a created and a dropped table',
          assertion:
            "(() => { const from = { Audit: { id: { type: 'Int', nullable: false } } }; const to = { Post: { id: { type: 'Int', nullable: false } } }; const ops = solution.diffSchemas(from, to); return ops.length === 2 && ops[0].op === 'createTable' && ops[0].table === 'Post' && ops[1].op === 'dropTable' && ops[1].table === 'Audit'; })()",
        },
        {
          name: 'detects an altered column',
          assertion:
            "(() => { const from = { User: { email: { type: 'String', nullable: false } } }; const to = { User: { email: { type: 'Text', nullable: true } } }; const ops = solution.diffSchemas(from, to); return ops.length === 1 && ops[0].op === 'alterColumn' && ops[0].column === 'email' && ops[0].to.type === 'Text'; })()",
        },
        {
          name: 'isDestructive flags a dropped column',
          assertion:
            "solution.isDestructive([{ op: 'addColumn', table: 'U', column: 'a', definition: { type: 'Int', nullable: true } }, { op: 'dropColumn', table: 'U', column: 'b' }]) === true",
        },
        {
          name: 'isDestructive ignores a widening nullability change',
          assertion:
            "solution.isDestructive([{ op: 'alterColumn', table: 'U', column: 'a', from: { type: 'Int', nullable: false }, to: { type: 'Int', nullable: true } }]) === false",
        },
        {
          name: 'isDestructive flags NOT NULL narrowing',
          assertion:
            "solution.isDestructive([{ op: 'alterColumn', table: 'U', column: 'a', from: { type: 'Int', nullable: true }, to: { type: 'Int', nullable: false } }]) === true",
        },
        {
          name: 'toSql renders CREATE TABLE',
          assertion:
            "deepEqual(solution.toSql([{ op: 'createTable', table: 'Post', columns: { id: { type: 'Int', nullable: false }, title: { type: 'String', nullable: true } } }]), ['CREATE TABLE \"Post\" (\"id\" Int NOT NULL, \"title\" String);'])",
        },
        {
          name: 'toSql splits an alterColumn into type and nullability statements',
          assertion:
            "deepEqual(solution.toSql([{ op: 'alterColumn', table: 'User', column: 'email', from: { type: 'String', nullable: false }, to: { type: 'Text', nullable: true } }]), ['ALTER TABLE \"User\" ALTER COLUMN \"email\" TYPE Text;', 'ALTER TABLE \"User\" ALTER COLUMN \"email\" DROP NOT NULL;'])",
          hidden: true,
        },
        {
          name: 'identical schemas produce no operations',
          assertion:
            "(() => { const s = { User: { id: { type: 'Int', nullable: false } } }; return deepEqual(solution.diffSchemas(s, s), []) && deepEqual(solution.toSql([]), []); })()",
          hidden: true,
        },
      ],
      xp: 70,
    },
    {
      slug: 'select-include-projection',
      title: 'Prisma-style select / include Projection',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Implement Prisma's projection semantics over an already-loaded object graph.

Export \`project(doc, spec)\`.

A **relation** is any value that is a non-null object or an array (a nested document). Everything else is a **scalar**.

Rules, applied at every level:

1. If \`doc\` is an array, project every element.
2. If the spec has **both** \`select\` and \`include\` at the same level, \`throw\`.
3. If the spec has \`select\`: return **only** the listed keys. A key whose value is \`true\` is copied verbatim; a key whose value is a nested spec object recurses; a key whose value is falsy is skipped; a key not present on the document is skipped.
4. Otherwise: return **all scalar fields** of the document (relations are dropped). Then, if the spec has \`include\`, add each listed relation — \`true\` copies it verbatim, a nested spec recurses.
5. A missing/empty spec therefore means "scalars only".

\`\`\`js
const post = { id: 1, title: 'Hi', secret: 'x', author: { id: 9, email: 'a@b.c', passwordHash: 'zzz' } };

project(post, { select: { id: true, title: true } });
// { id: 1, title: 'Hi' }

project(post, {});
// { id: 1, title: 'Hi', secret: 'x' }        <- relations dropped

project(post, { include: { author: { select: { email: true } } } });
// { id: 1, title: 'Hi', secret: 'x', author: { email: 'a@b.c' } }
\`\`\`

Key order in the result must follow the order the keys are visited: for \`select\`, the spec's key order; for the scalar pass, the document's key order.`,
      starterCode: `function project(doc, spec) {
  // your code
}

module.exports = { project };`,
      solutionCode: `function isRelation(value) {
  return value !== null && typeof value === 'object';
}

function project(doc, spec) {
  if (Array.isArray(doc)) return doc.map((d) => project(d, spec));
  if (doc === null || typeof doc !== 'object') return doc;

  const sel = spec && spec.select;
  const inc = spec && spec.include;
  if (sel && inc) {
    throw new Error('Cannot use both select and include at the same level');
  }

  const out = {};

  if (sel) {
    for (const key of Object.keys(sel)) {
      const sub = sel[key];
      if (!sub) continue;
      if (!(key in doc)) continue;
      out[key] = sub === true ? doc[key] : project(doc[key], sub);
    }
    return out;
  }

  for (const key of Object.keys(doc)) {
    if (!isRelation(doc[key])) out[key] = doc[key];
  }

  if (inc) {
    for (const key of Object.keys(inc)) {
      const sub = inc[key];
      if (!sub) continue;
      if (!(key in doc)) continue;
      out[key] = sub === true ? doc[key] : project(doc[key], sub);
    }
  }

  return out;
}

module.exports = { project };`,
      hints: [
        'Handle the array case first and recurse — every rule below it then only has to deal with a single document.',
        'select is exclusive (start from an empty object, add what is listed); include is additive (start from the scalars, then add relations).',
        'null is typeof "object" — guard for it or a null column becomes a relation and silently disappears.',
      ],
      tests: [
        {
          name: 'select returns only the listed fields',
          assertion:
            "deepEqual(solution.project({ id: 1, title: 'Hi', secret: 'x' }, { select: { id: true, title: true } }), { id: 1, title: 'Hi' })",
        },
        {
          name: 'select skips falsy and unknown keys',
          assertion:
            "deepEqual(solution.project({ id: 1, title: 'Hi' }, { select: { id: true, title: false, nope: true } }), { id: 1 })",
        },
        {
          name: 'no spec means scalars only, relations dropped',
          assertion:
            "deepEqual(solution.project({ id: 1, title: 'Hi', author: { id: 9 }, tags: [{ id: 2 }] }, {}), { id: 1, title: 'Hi' })",
        },
        {
          name: 'null scalars survive',
          assertion: "deepEqual(solution.project({ id: 1, name: null }, {}), { id: 1, name: null })",
        },
        {
          name: 'include is additive and can narrow the relation',
          assertion:
            "deepEqual(solution.project({ id: 1, title: 'Hi', author: { id: 9, email: 'a@b.c', passwordHash: 'zzz' } }, { include: { author: { select: { email: true } } } }), { id: 1, title: 'Hi', author: { email: 'a@b.c' } })",
        },
        {
          name: 'projects through an array relation',
          assertion:
            "deepEqual(solution.project({ id: 1, posts: [{ id: 7, title: 'a', body: 'x' }, { id: 8, title: 'b', body: 'y' }] }, { select: { id: true, posts: { select: { title: true } } } }), { id: 1, posts: [{ title: 'a' }, { title: 'b' }] })",
        },
        {
          name: 'select with true on a relation copies it whole',
          assertion:
            "deepEqual(solution.project({ id: 1, author: { id: 9, email: 'a@b.c' } }, { select: { author: true } }), { author: { id: 9, email: 'a@b.c' } })",
        },
        {
          name: 'select plus include at the same level throws',
          assertion:
            "throws(() => solution.project({ id: 1, author: { id: 9 } }, { select: { id: true }, include: { author: true } }))",
          hidden: true,
        },
        {
          name: 'nested include keeps deeper scalars',
          assertion:
            "deepEqual(solution.project({ id: 1, author: { id: 9, email: 'a@b.c', profile: { bio: 'hey' } } }, { include: { author: { include: { profile: true } } } }), { id: 1, author: { id: 9, email: 'a@b.c', profile: { bio: 'hey' } } })",
          hidden: true,
        },
        {
          name: 'top-level array input is projected element-wise',
          assertion:
            "deepEqual(solution.project([{ id: 1, x: 2 }, { id: 3, x: 4 }], { select: { id: true } }), [{ id: 1 }, { id: 3 }])",
          hidden: true,
        },
      ],
      xp: 90,
    },
  ],
  flashcards: [
    {
      front: 'Active Record vs Data Mapper',
      back: 'Active Record: the model persists itself (`user.save()`). Data Mapper: a separate repository moves data in and out (`repo.save(user)`), leaving the entity a plain object.',
      tags: ['orm', 'patterns'],
    },
    {
      front: 'Drizzle: what replaces `schema.prisma`?',
      back: 'Plain TypeScript — `pgTable(...)` objects in a `.ts` file. Row types come from `typeof table.$inferSelect`, so there is no codegen step and no generated client to keep in sync.',
      tags: ['drizzle', 'schema'],
    },
    {
      front: '`prisma migrate dev` vs `prisma db push`',
      back: '`migrate dev` writes a versioned SQL migration file and applies it. `db push` just syncs the database to the schema with no history — prototyping only.',
      tags: ['prisma', 'migrations'],
    },
    {
      front: 'Why must you use `tx` inside a Prisma interactive transaction?',
      back: 'The outer client checks out a different connection. Its statements are outside the transaction, will not roll back, and can deadlock against the locks the transaction holds.',
      tags: ['prisma', 'transactions'],
    },
    {
      front: 'Why is Drizzle the usual pick for edge runtimes?',
      back: 'It is a thin, tree-shakeable TypeScript library with no query-engine binary and no generated client, so it bundles small and runs unmodified on Workers, Vercel Edge, Bun and Deno. You supply the driver (`node-postgres`, `neon-http`, `d1`).',
      tags: ['drizzle', 'edge', 'performance'],
    },
    {
      front: 'Mongoose: what is `this` in `pre(\'save\')` vs `pre(\'findOneAndUpdate\')`?',
      back: 'Document middleware binds `this` to the document; query middleware binds it to the Query (use `getFilter()` / `getUpdate()`). Arrow functions break both.',
      tags: ['mongoose', 'hooks'],
    },
    {
      front: 'When do Mongoose validators NOT run?',
      back: 'On `updateOne` / `findOneAndUpdate` unless you pass `runValidators: true`. They run by default only on `save()` and `create()`.',
      tags: ['mongoose', 'validation'],
    },
    {
      front: 'What does `.lean()` give up and gain?',
      back: 'Gives up hydrated documents: `save()`, virtuals, getters, change tracking. Gains a large speed and memory win. Use it on read-only endpoints.',
      tags: ['mongoose', 'performance'],
    },
    {
      front: 'Is Mongoose `populate()` a join?',
      back: 'No. It is a second query against the referenced collection using `$in` over the collected ids. One populate over a page of results is 2 queries, not N+1 — unless you populate inside a loop.',
      tags: ['mongoose', 'relations'],
    },
    {
      front: 'Three fixes for N+1',
      back: 'Eager load (`include` / `relations` / `populate`), batch the ids yourself into one `IN` query, or put DataLoader in front so per-tick `load()` calls coalesce.',
      tags: ['orm', 'performance'],
    },
    {
      front: 'Why is a bigger connection pool not faster?',
      back: 'Pools are per process, and past roughly (cores * 2) concurrent queries the database spends its time context-switching. Too many connections also exhaust `max_connections`.',
      tags: ['pooling', 'performance'],
    },
    {
      front: 'When should you drop to raw SQL?',
      back: 'Window functions, recursive CTEs, LATERAL, bulk upserts, vendor features (tsvector, PostGIS, JSONB operators) and EXPLAIN-driven tuning. Keep CRUD in the ORM.',
      tags: ['orm', 'sql'],
    },
  ],
  resources: [
    { label: 'Prisma — Documentation', url: 'https://www.prisma.io/docs', kind: 'DOCS' },
    { label: 'Drizzle ORM — Documentation', url: 'https://orm.drizzle.team/docs/overview', kind: 'DOCS' },
    { label: 'TypeORM — Documentation', url: 'https://typeorm.io/', kind: 'DOCS' },
    { label: 'Mongoose — Guides', url: 'https://mongoosejs.com/docs/guide.html', kind: 'DOCS' },
    { label: 'DataLoader — batching and caching', url: 'https://github.com/graphql/dataloader', kind: 'TOOL' },
  ],
};

export default day;
