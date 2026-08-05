import type { DaySpec } from '../types';

const SHOP_SETUP = `CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  signed_up_on TEXT NOT NULL
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL,
  placed_on TEXT NOT NULL
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL
);

INSERT INTO customers (name, country, signed_up_on) VALUES
  ('Ada Lovelace',    'UK', '2025-01-04'),
  ('Grace Hopper',    'US', '2025-01-19'),
  ('Alan Turing',     'UK', '2025-02-02'),
  ('Radia Perlman',   'US', '2025-02-14'),
  ('Barbara Liskov',  'US', '2025-03-01'),
  ('Ken Thompson',    'US', '2025-03-22');

INSERT INTO categories (name) VALUES
  ('Keyboards'),
  ('Monitors'),
  ('Audio');

INSERT INTO products (category_id, name, price_cents) VALUES
  (1, 'Ninja65 Keyboard',   12000),
  (1, 'Tenkeyless Pro',      9000),
  (1, 'Split Ergo',         18000),
  (2, 'Studio 27 4K',       45000),
  (2, 'UltraWide 34',       62000),
  (3, 'Focus Headphones',   22000),
  (3, 'Desk Mic',           15000);

INSERT INTO orders (customer_id, status, placed_on) VALUES
  (1, 'paid',      '2025-04-01'),
  (1, 'paid',      '2025-04-15'),
  (2, 'paid',      '2025-04-03'),
  (3, 'cancelled', '2025-04-05'),
  (3, 'paid',      '2025-04-20'),
  (4, 'paid',      '2025-05-02'),
  (4, 'pending',   '2025-05-09'),
  (5, 'paid',      '2025-05-11'),
  (2, 'paid',      '2025-05-18'),
  (6, 'cancelled', '2025-05-25'),
  (1, 'paid',      '2025-06-07'),
  (6, 'paid',      '2025-06-19');

INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES
  (1, 1, 1, 12000),
  (1, 6, 1, 22000),
  (2, 2, 3,  9000),
  (3, 4, 1, 45000),
  (3, 7, 1, 15000),
  (4, 5, 1, 62000),
  (5, 3, 1, 18000),
  (5, 1, 1, 12000),
  (6, 5, 1, 62000),
  (7, 2, 3,  9000),
  (8, 6, 2, 22000),
  (9, 1, 2, 12000),
  (9, 7, 1, 15000),
  (10, 4, 1, 45000),
  (11, 7, 1, 15000),
  (12, 3, 1, 18000);`;

const day: DaySpec = {
  day: 22,
  week: 4,
  pillar: 'DATABASE',
  title: 'Relational Databases & SQL Deep Dive',
  summary: 'Model it properly, query it precisely, index it deliberately, and know what a transaction guarantees.',
  estimatedMinutes: 340,
  objectives: [
    'Normalise a schema to 3NF and explain exactly when to denormalise instead',
    'Choose the right key and constraint for each column, including composite and foreign keys',
    'Write JOINs, GROUP BY/HAVING, correlated subqueries, CTEs and window functions with confidence',
    'Design B-tree, composite, covering and partial indexes and read an EXPLAIN plan to prove they are used',
    'Reason about ACID, the four isolation levels, the anomalies each one permits, and how deadlocks happen',
    'Name the concrete differences between PostgreSQL, MySQL and SQL Server that break portable SQL',
  ],
  technologies: ['PostgreSQL', 'MySQL', 'SQL Server'],
  lessons: [
    {
      slug: 'relational-modelling-and-normal-forms',
      title: 'Relational Modelling, Keys, Constraints & Normal Forms',
      estimatedMinutes: 85,
      body: `# Relational Modelling, Keys, Constraints & Normal Forms

A relational schema is a set of *claims about reality* that the database will enforce for you, forever, no matter which service writes to it. Every claim you decline to make becomes a bug in application code — usually in three services at once.

## Start from the entities and their relationships

Ask two questions about every pair of things: **how many of A relate to one B**, and **how many of B relate to one A**.

| Cardinality | Implementation |
| --- | --- |
| one-to-many | foreign key on the *many* side |
| many-to-many | a junction table with a composite primary key |
| one-to-one | foreign key with a \`UNIQUE\` constraint, or the same primary key in both tables |

\`\`\`sql
CREATE TABLE customers (
  id           bigserial PRIMARY KEY,
  email        citext      NOT NULL UNIQUE,
  country_code char(2)     NOT NULL REFERENCES countries(code),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id          bigserial   PRIMARY KEY,
  customer_id bigint      NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status      text        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','paid','shipped','cancelled')),
  placed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  order_id          bigint  NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        bigint  NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity          int     NOT NULL CHECK (quantity > 0),
  unit_price_cents  int     NOT NULL CHECK (unit_price_cents >= 0),
  PRIMARY KEY (order_id, product_id)
);
\`\`\`

Look at \`order_items\`: the primary key is **composite**, which encodes the rule "a product appears at most once per order" in the schema itself rather than in a service that someone will forget to call.

## Keys

- **Candidate key** — any column set that uniquely identifies a row.
- **Primary key** — the candidate key you chose. Never nullable.
- **Natural key** — a real-world identifier (an ISBN, an email). Meaningful, but people *do* change their email, and then you are cascading an update through six tables.
- **Surrogate key** — a synthetic \`bigserial\`/\`identity\`/UUID. Stable and meaningless, which is exactly the point.
- **Foreign key** — a reference the database checks on every write.

Default to a surrogate primary key **plus** a \`UNIQUE\` constraint on the natural key. You get stable references and the uniqueness rule.

> **\`ON DELETE\` is a design decision, not a default.** \`CASCADE\` on \`order_items\` is right — items have no life without their order. \`CASCADE\` on \`orders\` would mean deleting a customer silently destroys their financial history. Use \`RESTRICT\` for anything you would need in an audit.

## Constraints are cheaper than validation code

\`NOT NULL\`, \`UNIQUE\`, \`CHECK\`, \`FOREIGN KEY\` and \`DEFAULT\` run inside the database, atomically, under concurrency. Application-level validation cannot: two concurrent requests both read "email not taken" and both insert. The unique index is the only thing that actually prevents it.

\`\`\`sql
ALTER TABLE orders ADD CONSTRAINT chk_ship_after_place
  CHECK (shipped_at IS NULL OR shipped_at >= placed_at);
\`\`\`

## Normal forms, without the theory

**1NF — one value per cell, no repeating groups.**

\`\`\`
-- violates 1NF
orders(id, customer, product_names)
       7,  'Ada',    'Keyboard, Mouse, Monitor'
\`\`\`

You cannot index it, join it, or aggregate it. The fix is a child table.

**2NF — no partial dependency on part of a composite key.**

If the key is \`(order_id, product_id)\`, then \`product_name\` violates 2NF: it depends only on \`product_id\`. Move it to \`products\`. Note that \`unit_price_cents\` legitimately stays — it is the price *at the time of that order*, which genuinely depends on the whole key. Copying it is not denormalisation, it is capturing a historical fact.

**3NF — no transitive dependency: non-key columns depend on the key only.**

\`\`\`
-- violates 3NF
orders(id, customer_id, customer_email, customer_country)
\`\`\`

\`customer_email\` depends on \`customer_id\`, not on \`order_id\`. Update the customer's email and every historical order row is now stale — or you write an \`UPDATE\` that touches a million rows.

The one-line summary is the classic: **every non-key column depends on the key, the whole key, and nothing but the key.**

## When to denormalise on purpose

Normalisation optimises for *write correctness*. Sometimes you knowingly trade it away:

| Denormalisation | Use when | Cost |
| --- | --- | --- |
| Cached counter (\`posts.comment_count\`) | the count is read constantly, written rarely | must be kept accurate — trigger, or recompute in the same transaction |
| Copied attribute (\`order_items.unit_price_cents\`) | you need the value *as it was* | none, this is not really denormalisation |
| Materialised view / rollup table | expensive aggregate, staleness is acceptable | refresh strategy and lag |
| JSONB column for sparse attributes | genuinely schemaless per-row extras | no FK integrity, weaker constraints |

The rule: **normalise first, denormalise with evidence.** A query plan and a latency number are evidence; "joins are slow" is not — a join on an indexed foreign key is one of the cheapest things a database does.

## Pick the right types

- Money: \`numeric(12,2)\` or an integer count of cents. **Never \`float\`** — \`0.1 + 0.2\` is not \`0.3\` in binary floating point, and your ledger will not balance.
- Timestamps: \`timestamptz\` in Postgres, always. Store UTC, render in the user's zone.
- Enums: a \`CHECK\` constraint or a lookup table. A native \`enum\` type is painful to alter in Postgres.
- Text: \`text\` in Postgres — \`varchar(n)\` has no performance benefit there, only a length rule.`,
    },
    {
      slug: 'querying-joins-groups-ctes-windows',
      title: 'Querying: JOINs, GROUP BY, CTEs & Window Functions',
      estimatedMinutes: 90,
      body: `# Querying: JOINs, GROUP BY, CTEs & Window Functions

SQL is declarative: you describe the result, the planner decides how. Knowing the logical evaluation order is what makes surprising results stop being surprising.

## The order the engine actually thinks in

\`\`\`
FROM / JOIN  ->  WHERE  ->  GROUP BY  ->  HAVING  ->  SELECT  ->  DISTINCT  ->  ORDER BY  ->  LIMIT
\`\`\`

This single fact explains two of the most common beginner errors:

- You cannot use a \`SELECT\` alias in \`WHERE\` — \`SELECT\` has not run yet. (Postgres and MySQL do allow it in \`GROUP BY\`/\`ORDER BY\`, which run after or alongside.)
- You cannot filter an aggregate in \`WHERE\` — the groups do not exist yet. That is what \`HAVING\` is for.

## JOIN types

\`\`\`sql
SELECT c.name, o.id
FROM customers c
JOIN orders o ON o.customer_id = c.id;          -- INNER: matches only
\`\`\`

| Join | Returns |
| --- | --- |
| \`INNER JOIN\` | rows with a match on both sides |
| \`LEFT JOIN\` | all left rows; right columns \`NULL\` when unmatched |
| \`RIGHT JOIN\` | the mirror image; rare, usually rewrite as LEFT |
| \`FULL OUTER JOIN\` | everything from both, \`NULL\`-padded (MySQL lacks it) |
| \`CROSS JOIN\` | Cartesian product — deliberate, e.g. against \`generate_series\` |
| self join | a table joined to itself, for hierarchies |

The classic trap: a \`LEFT JOIN\` silently becomes an inner join when you filter the right table in \`WHERE\`.

\`\`\`sql
-- BROKEN: rows with no paid order are removed by the WHERE
SELECT c.name, COUNT(o.id)
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'paid'
GROUP BY c.name;

-- CORRECT: the condition belongs in the ON clause
SELECT c.name, COUNT(o.id) AS paid_orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'
GROUP BY c.name;
\`\`\`

For an inner join it makes no difference where the predicate goes. For an outer join it changes the answer.

## GROUP BY and HAVING

\`\`\`sql
SELECT c.country,
       COUNT(DISTINCT o.id)                        AS orders,
       SUM(oi.quantity * oi.unit_price_cents)      AS revenue_cents,
       ROUND(AVG(oi.unit_price_cents)::numeric, 0) AS avg_item_cents
FROM customers c
JOIN orders o       ON o.customer_id = c.id AND o.status = 'paid'
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.country
HAVING SUM(oi.quantity * oi.unit_price_cents) > 100000
ORDER BY revenue_cents DESC;
\`\`\`

Two things to internalise:

1. **\`WHERE\` filters rows, \`HAVING\` filters groups.** Push everything you can into \`WHERE\` — it runs first and on fewer rows.
2. **\`COUNT(*)\` counts rows; \`COUNT(col)\` skips NULLs; \`COUNT(DISTINCT col)\` deduplicates.** After a join that fans out (one order, three items), \`COUNT(o.id)\` counts three. \`COUNT(DISTINCT o.id)\` counts one. This is the number-one source of wrong dashboards.

## Subqueries vs CTEs

A **scalar subquery** returns one value; a **correlated subquery** re-runs per outer row:

\`\`\`sql
SELECT c.name,
       (SELECT MAX(o.placed_at) FROM orders o WHERE o.customer_id = c.id) AS last_order
FROM customers c;
\`\`\`

\`EXISTS\` is usually the right tool for "has at least one", and it beats \`IN (SELECT ...)\` when the inner set is large — it short-circuits on the first match:

\`\`\`sql
SELECT c.name
FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'paid');
\`\`\`

> \`NOT IN\` with a subquery that can return \`NULL\` returns **no rows at all**, because \`x NOT IN (1, NULL)\` evaluates to \`UNKNOWN\`. Use \`NOT EXISTS\`. This bug has shipped to production in every company you have heard of.

A **CTE** (\`WITH\`) names an intermediate result. It is the readable way to build a query in stages:

\`\`\`sql
WITH paid_items AS (
  SELECT o.customer_id, oi.quantity * oi.unit_price_cents AS line_cents
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status = 'paid'
),
totals AS (
  SELECT customer_id, SUM(line_cents) AS total_cents
  FROM paid_items
  GROUP BY customer_id
)
SELECT c.name, t.total_cents
FROM totals t
JOIN customers c ON c.id = t.customer_id
ORDER BY t.total_cents DESC
LIMIT 10;
\`\`\`

Since Postgres 12 a CTE is inlined into the plan by default, so it is no longer an optimisation fence — add \`MATERIALIZED\` if you deliberately want it computed once.

CTEs can also recurse, which is how you walk a tree:

\`\`\`sql
WITH RECURSIVE subtree AS (
  SELECT id, parent_id, name, 1 AS depth FROM categories WHERE id = 3
  UNION ALL
  SELECT c.id, c.parent_id, c.name, s.depth + 1
  FROM categories c JOIN subtree s ON c.parent_id = s.id
)
SELECT * FROM subtree ORDER BY depth;
\`\`\`

## Window functions

A window function computes across a set of rows **without collapsing them**. \`GROUP BY\` gives you one row per group; a window gives you every row plus the aggregate.

\`\`\`sql
SELECT
  name,
  category,
  revenue_cents,
  SUM(revenue_cents)  OVER (PARTITION BY category)                     AS category_total,
  RANK()              OVER (PARTITION BY category ORDER BY revenue_cents DESC) AS rank_in_category,
  revenue_cents - LAG(revenue_cents) OVER (ORDER BY month)             AS change_from_prev,
  SUM(revenue_cents)  OVER (ORDER BY month
                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
FROM product_revenue;
\`\`\`

The anatomy is always \`function() OVER (PARTITION BY ... ORDER BY ... frame)\`:

- **\`PARTITION BY\`** — restart the calculation per group. Omit it and the window is the whole result set.
- **\`ORDER BY\`** — the order *within* the window, which is what \`LAG\`, \`LEAD\` and running totals depend on.
- **frame** — \`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\` gives a running total; the default is \`RANGE\` and it treats ties as one unit, which surprises people.

Ranking functions differ only in how they handle ties:

| Values | \`ROW_NUMBER\` | \`RANK\` | \`DENSE_RANK\` |
| --- | --- | --- | --- |
| 100, 90, 90, 80 | 1, 2, 3, 4 | 1, 2, 2, 4 | 1, 2, 2, 3 |

The idiom you will use most: **top N per group.** You cannot filter a window function in \`WHERE\` (windows are computed after \`WHERE\`), so wrap it:

\`\`\`sql
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY revenue_cents DESC) AS rn
  FROM product_revenue
)
SELECT * FROM ranked WHERE rn <= 3;
\`\`\``,
    },
    {
      slug: 'indexes-and-query-plans',
      title: 'Indexes, EXPLAIN & Reading Query Plans',
      estimatedMinutes: 85,
      body: `# Indexes, EXPLAIN & Reading Query Plans

An index is a redundant, automatically maintained copy of some columns in sorted order. It makes reads faster and writes slower. Every index is a trade, and unused indexes are pure cost.

## The B-tree

The default index in Postgres, MySQL (InnoDB) and SQL Server is a **B-tree**: a balanced tree, sorted, with the rows chained at the leaves. That structure supports:

- equality: \`WHERE email = ?\`
- range: \`WHERE created_at >= ?\`
- prefix match: \`WHERE name LIKE 'ada%'\` (a leading wildcard cannot use it)
- \`ORDER BY\` on the indexed columns, for free — the data is already sorted
- \`MIN\`/\`MAX\`, by reading one end

\`\`\`sql
CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE UNIQUE INDEX idx_customers_email ON customers (lower(email));  -- expression index
\`\`\`

> **Every foreign key should have an index on the referencing side.** Databases index the primary key automatically but *not* the FK column. Without it, every \`DELETE\` on the parent triggers a full scan of the child to check the constraint.

## Composite indexes and the leftmost-prefix rule

\`\`\`sql
CREATE INDEX idx_orders_cust_status_date ON orders (customer_id, status, placed_at);
\`\`\`

This one index serves queries filtering on:

- \`customer_id\`
- \`customer_id, status\`
- \`customer_id, status, placed_at\`

and **not** \`status\` alone, nor \`placed_at\` alone. Think of a phone book sorted by (last name, first name): useless for finding everyone called "Ada".

Column order rules of thumb:

1. Equality columns first, range column last. \`WHERE customer_id = 7 AND placed_at > '2025-01-01'\` wants \`(customer_id, placed_at)\`, not the reverse.
2. Put the most selective equality column first when several are equally usable.
3. If you add \`ORDER BY placed_at DESC\`, having it as the trailing index column removes the sort step entirely.

## Covering indexes

If the index contains every column a query touches, the database never reads the table at all — an **index-only scan**.

\`\`\`sql
-- Postgres: INCLUDE adds payload columns that are stored but not part of the key
CREATE INDEX idx_orders_cover ON orders (customer_id, status) INCLUDE (placed_at, total_cents);
\`\`\`

SQL Server has the same \`INCLUDE\` syntax. MySQL/InnoDB has no \`INCLUDE\`, so you widen the key instead. In Postgres an index-only scan also depends on the visibility map, so keep autovacuum healthy or you will still see heap fetches.

## Partial indexes

Index only the rows you actually query. Smaller index, cheaper writes, and it can enforce a conditional uniqueness rule.

\`\`\`sql
CREATE INDEX idx_orders_open ON orders (placed_at) WHERE status = 'pending';

-- one active subscription per user, unlimited cancelled ones
CREATE UNIQUE INDEX uniq_active_sub ON subscriptions (user_id) WHERE status = 'active';
\`\`\`

Postgres and SQLite call these partial indexes; SQL Server calls them filtered indexes; MySQL does not have them.

## Beyond B-trees (Postgres)

| Type | For |
| --- | --- |
| \`GIN\` | \`jsonb\` containment, array membership, full-text search |
| \`GiST\` | geometry, ranges, nearest-neighbour |
| \`BRIN\` | huge, naturally ordered tables (append-only logs) — tiny index, coarse filter |
| \`HASH\` | equality only; rarely worth it over a B-tree |

## EXPLAIN: the only opinion that counts

\`\`\`sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT c.name, COUNT(*)
FROM customers c JOIN orders o ON o.customer_id = c.id
WHERE c.country_code = 'AU'
GROUP BY c.name;
\`\`\`

\`EXPLAIN\` alone shows the estimated plan; **\`EXPLAIN ANALYZE\` actually runs the query** and reports real timings and row counts. (It runs the query — wrap a mutating statement in a transaction you roll back.)

A node looks like:

\`\`\`
Index Scan using idx_orders_customer on orders o
  (cost=0.29..8.31 rows=1 width=16) (actual time=0.014..0.016 rows=3 loops=1)
\`\`\`

Read it like this:

- **cost** — arbitrary planner units: startup..total. Only useful for comparing plans.
- **rows** — the *estimate*. Compare it with **actual rows**. A 1000x gap means the statistics are stale (\`ANALYZE\`) or your predicate is correlated in a way the planner cannot see. Bad estimates cause bad plans, and this is where most real tuning starts.
- **loops** — multiply \`actual time\` by \`loops\` to get the true cost of a nested node.

Scan types, roughly worst to best for a selective query: \`Seq Scan\` → \`Bitmap Heap Scan\` → \`Index Scan\` → \`Index Only Scan\`. A \`Seq Scan\` is not automatically wrong: for a small table, or when you are reading 40% of the rows, sequential I/O beats random lookups and the planner knows it.

Join strategies: **Nested Loop** (great when the inner side is tiny and indexed), **Hash Join** (great for large unsorted inputs), **Merge Join** (great when both sides are already sorted).

## The things that silently kill index usage

\`\`\`sql
-- ✗ function on the indexed column
WHERE lower(email) = 'a@b.com'          -- unless you built an index on lower(email)
WHERE date(created_at) = '2025-01-01'   -- rewrite as a range:
WHERE created_at >= '2025-01-01' AND created_at < '2025-01-02'   -- ✓ sargable

-- ✗ leading wildcard
WHERE name LIKE '%ada%'                 -- use a trigram (pg_trgm) or full-text index

-- ✗ implicit type cast
WHERE user_id = '42'                    -- text vs bigint may prevent the index
\`\`\`

A predicate the index can use is called **sargable**. Rewriting a function call into a range is the single highest-value tuning trick you will learn today.

## Index hygiene

- Postgres: \`pg_stat_user_indexes.idx_scan = 0\` means nobody has used it. Drop it.
- Build on live tables with \`CREATE INDEX CONCURRENTLY\` — the plain form takes a lock that blocks writes for the whole build.
- Every extra index slows \`INSERT\`/\`UPDATE\`/\`DELETE\` and consumes cache. Five indexes on a hot write table is usually three too many.`,
    },
    {
      slug: 'transactions-isolation-and-vendors',
      title: 'Transactions, ACID, Isolation & Vendor Differences',
      estimatedMinutes: 80,
      body: `# Transactions, ACID, Isolation & Vendor Differences

## ACID

- **Atomicity** — all statements in the transaction commit, or none do.
- **Consistency** — the transaction moves the database from one state satisfying all constraints to another.
- **Isolation** — concurrent transactions do not see each other's uncommitted work; how *much* they see is configurable.
- **Durability** — once \`COMMIT\` returns, the data survives a crash (write-ahead log, \`fsync\`).

\`\`\`sql
BEGIN;
  UPDATE accounts SET balance_cents = balance_cents - 5000 WHERE id = 1;
  UPDATE accounts SET balance_cents = balance_cents + 5000 WHERE id = 2;
COMMIT;
\`\`\`

If the process dies between the two updates, atomicity means money is not destroyed. Note what this requires of your application: **the whole unit of work must run on one connection**, which is why passing a transaction/client object down through your repository layer matters. \`SAVEPOINT\` / \`ROLLBACK TO SAVEPOINT\` gives you partial rollback inside that unit.

## The four anomalies

| Anomaly | What happens |
| --- | --- |
| **Dirty read** | you read a row another transaction has written but not committed |
| **Non-repeatable read** | you read the same row twice and get different values |
| **Phantom read** | you re-run the same \`WHERE\` and new rows have appeared |
| **Lost update** | two transactions read-modify-write the same row; one write vanishes |

## The four isolation levels

| Level | Dirty | Non-repeatable | Phantom |
| --- | --- | --- | --- |
| READ UNCOMMITTED | possible | possible | possible |
| READ COMMITTED | no | possible | possible |
| REPEATABLE READ | no | no | possible (per the standard) |
| SERIALIZABLE | no | no | no |

Reality is messier than the table:

- **PostgreSQL** defaults to READ COMMITTED and has no true READ UNCOMMITTED (it silently behaves as READ COMMITTED). Its REPEATABLE READ is a genuine MVCC snapshot that also prevents phantoms, and its SERIALIZABLE uses Serializable Snapshot Isolation — no read locks, but a transaction can abort with a \`40001\` serialization failure that **you must be prepared to retry**.
- **MySQL/InnoDB** defaults to REPEATABLE READ and blocks phantoms with next-key (gap) locks.
- **SQL Server** defaults to READ COMMITTED using shared read locks, which makes readers block writers — turn on \`READ_COMMITTED_SNAPSHOT\` to get MVCC behaviour closer to Postgres.

\`\`\`sql
BEGIN ISOLATION LEVEL REPEATABLE READ;   -- Postgres
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;  -- MySQL / SQL Server
\`\`\`

## Preventing lost updates

Read-modify-write in application code is a lost update waiting to happen. Three fixes, in order of preference:

\`\`\`sql
-- 1. Do the arithmetic in the database. Atomic, no read needed.
UPDATE accounts SET balance_cents = balance_cents - 5000 WHERE id = 1;

-- 2. Pessimistic lock: hold the row for the duration of the transaction.
SELECT balance_cents FROM accounts WHERE id = 1 FOR UPDATE;

-- 3. Optimistic lock: version column, retry on zero rows affected.
UPDATE accounts SET balance_cents = $1, version = version + 1
WHERE id = $2 AND version = $3;
\`\`\`

\`SELECT ... FOR UPDATE SKIP LOCKED\` is the standard way to build a queue on top of Postgres: each worker grabs rows nobody else has locked.

## Deadlocks

Two transactions each hold a lock the other wants:

\`\`\`
T1: UPDATE accounts SET ... WHERE id = 1;   -- locks row 1
T2: UPDATE accounts SET ... WHERE id = 2;   -- locks row 2
T1: UPDATE accounts SET ... WHERE id = 2;   -- waits for T2
T2: UPDATE accounts SET ... WHERE id = 1;   -- waits for T1  -> deadlock
\`\`\`

The database detects the cycle and kills one transaction (Postgres: SQLSTATE \`40P01\`). Your defences:

1. **Always acquire locks in a consistent order** — e.g. sort ids ascending before updating. This alone eliminates most deadlocks.
2. Keep transactions short. Never do an HTTP call inside one.
3. Catch \`40001\`/\`40P01\` and retry with backoff. In a serializable system, retry logic is part of the contract, not an optional extra.

> Long-running transactions are corrosive in Postgres for a second reason: an open transaction holds back the oldest snapshot, so autovacuum cannot reclaim dead tuples and the table bloats. An idle-in-transaction connection is an outage in slow motion.

## Postgres vs MySQL vs SQL Server

| | PostgreSQL | MySQL 8 (InnoDB) | SQL Server |
| --- | --- | --- | --- |
| **Auto-increment** | \`bigserial\` / \`GENERATED ALWAYS AS IDENTITY\`, backed by a real \`SEQUENCE\` you can \`nextval()\` | \`AUTO_INCREMENT\` on one column; no standalone sequences | \`IDENTITY(1,1)\`, or \`CREATE SEQUENCE\` since 2012 |
| **String type** | \`text\` (no penalty), \`varchar(n)\` adds only a rule | \`VARCHAR(n)\` needs a length; index prefix limits apply | \`nvarchar(max)\`; \`varchar\` is non-Unicode |
| **Case sensitivity** | comparisons case-**sensitive** by default | default collation is case-**insensitive** | collation-dependent, usually case-insensitive |
| **Booleans** | native \`boolean\` | \`TINYINT(1)\` alias — \`true\` is just \`1\` | no boolean; use \`BIT\` |
| **JSON** | \`jsonb\` (binary, indexable with GIN), rich operator set \`->\`, \`->>\`, \`@>\` | \`JSON\` type, functional indexes via generated columns, \`JSON_EXTRACT\` | \`nvarchar\` + \`JSON_VALUE\`/\`OPENJSON\`; no dedicated type |
| **Upsert** | \`INSERT ... ON CONFLICT (col) DO UPDATE SET ...\` | \`INSERT ... ON DUPLICATE KEY UPDATE ...\` | \`MERGE\` (or the \`IF EXISTS\`/\`UPDATE\` pattern) |
| **Limit rows** | \`LIMIT n OFFSET m\` | \`LIMIT m, n\` or \`LIMIT n OFFSET m\` | \`OFFSET m ROWS FETCH NEXT n ROWS ONLY\` (or \`TOP n\`) |
| **Returning inserted row** | \`RETURNING *\` | none — \`LAST_INSERT_ID()\` | \`OUTPUT INSERTED.*\` |
| **String concat** | \`\\|\\|\` or \`concat()\` | \`concat()\` (\`\\|\\|\` is OR by default) | \`+\` or \`concat()\` |
| **Default isolation** | READ COMMITTED | REPEATABLE READ | READ COMMITTED (locking, unless RCSI is on) |
| **DDL in a transaction** | yes, fully transactional | no — DDL causes an implicit commit | yes |

That last row is bigger than it looks: in Postgres a failed migration rolls back cleanly; in MySQL a migration that dies halfway leaves you in a half-applied state you must repair by hand.

\`\`\`sql
INSERT INTO tags (name, uses) VALUES ('sql', 1)
  ON CONFLICT (name) DO UPDATE SET uses = tags.uses + 1;   -- Postgres

INSERT INTO tags (name, uses) VALUES ('sql', 1)
  ON DUPLICATE KEY UPDATE uses = uses + 1;                 -- MySQL
\`\`\`

Write portable SQL where it is free, and isolate the vendor-specific parts in your repository layer where you can see them.`,
    },
  ],
  quiz: [
    {
      prompt: 'A table `orders(id, customer_id, customer_email, customer_country)` violates which normal form, and why?',
      options: [
        '1NF — a cell contains multiple values',
        '3NF — customer_email and customer_country depend transitively on customer_id, not on the primary key',
        '2NF — there is a partial dependency on part of a composite key',
        'None — it is already fully normalised',
      ],
      correctIndex: 1,
      explanation:
        '2NF is about partial dependency on *part of a composite key*, and this table has a single-column key. The email depends on customer_id which depends on id — a transitive dependency, which is exactly what 3NF forbids.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why is copying `unit_price_cents` onto `order_items` NOT a normalisation violation?',
      options: [
        'Because prices are integers',
        'Because order_items has no primary key',
        'Because it records the price at the time of the order — a historical fact that depends on the whole key, not the current value in products',
        'Because denormalisation is always allowed for money columns',
      ],
      correctIndex: 2,
      explanation:
        'The product’s current price and the price the customer actually paid are different facts. If you joined to products for the price, changing a price would silently rewrite every past invoice.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'This query returns fewer customers than expected. Why?\n`SELECT c.name, COUNT(o.id) FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.status = \'paid\' GROUP BY c.name`',
      options: [
        'COUNT(o.id) counts NULLs, so the groups are wrong',
        'GROUP BY c.name merges customers with the same name',
        'LEFT JOIN is not supported with GROUP BY',
        'The WHERE clause discards the NULL-padded rows, turning the LEFT JOIN into an INNER JOIN — the condition belongs in the ON clause',
      ],
      correctIndex: 3,
      explanation:
        'For unmatched customers the right-hand columns are NULL, and `NULL = \'paid\'` is UNKNOWN, so WHERE drops those rows. Moving `AND o.status = \'paid\'` into the ON clause filters before the outer join preserves the rows.',
      difficulty: 'HARD',
    },
    {
      prompt: 'You have `CREATE INDEX idx ON orders (customer_id, status, placed_at)`. Which query can NOT use it?',
      options: [
        'WHERE status = \'paid\' AND placed_at > \'2025-01-01\'',
        'WHERE customer_id = 7',
        'WHERE customer_id = 7 AND status = \'paid\'',
        'WHERE customer_id = 7 AND status = \'paid\' AND placed_at > \'2025-01-01\'',
      ],
      correctIndex: 0,
      explanation:
        'A composite B-tree is only usable from its leftmost column inward. Without a predicate on customer_id there is no starting point in the sort order, so the planner falls back to a scan.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which rewrite makes `WHERE date(created_at) = \'2025-01-01\'` able to use an index on `created_at`?',
      options: [
        'WHERE created_at::text LIKE \'2025-01-01%\'',
        'WHERE created_at >= \'2025-01-01\' AND created_at < \'2025-01-02\'',
        'WHERE EXTRACT(day FROM created_at) = 1',
        'Adding an ORDER BY created_at',
      ],
      correctIndex: 1,
      explanation:
        'Wrapping the indexed column in a function makes the predicate non-sargable — the index stores `created_at`, not `date(created_at)`. A half-open range expresses the same condition using the stored values. (An expression index on `date(created_at)` is the other valid fix.)',
      difficulty: 'HARD',
    },
    {
      prompt: 'In `EXPLAIN ANALYZE` output you see `rows=1` but `actual rows=48000`. What does that tell you?',
      options: [
        'The query returned the wrong result',
        'The index is corrupt',
        'The row estimate is wildly off, so the planner likely chose a bad join strategy — check statistics (ANALYZE) and correlated predicates',
        'The cost units are misconfigured',
      ],
      correctIndex: 2,
      explanation:
        'Estimated vs actual is the first thing to read in a plan. A large gap means the planner optimised for a shape that does not exist — e.g. it picked a nested loop expecting one row and executed it 48,000 times.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Two transactions read a balance, add to it in application code, and write it back. One update is lost. What is the cleanest fix?',
      options: [
        'Do the arithmetic in SQL: `UPDATE accounts SET balance = balance + 5000 WHERE id = 1`',
        'Raise the isolation level to READ UNCOMMITTED',
        'Add an index on accounts(id)',
        'Retry the request on the client after a timeout',
      ],
      correctIndex: 0,
      explanation:
        'A single atomic UPDATE removes the read-modify-write window entirely. Failing that, `SELECT ... FOR UPDATE` (pessimistic) or a version column (optimistic) work; lowering isolation makes it strictly worse.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which statement about PostgreSQL vs MySQL is correct?',
      options: [
        'Both support `INSERT ... ON CONFLICT DO UPDATE`',
        'Postgres runs DDL inside transactions so a failed migration rolls back; MySQL implicitly commits on DDL, leaving migrations half-applied',
        'MySQL supports partial (filtered) indexes; Postgres does not',
        'Both return the inserted row with `RETURNING *`',
      ],
      correctIndex: 1,
      explanation:
        'Upsert syntax differs (`ON CONFLICT` vs `ON DUPLICATE KEY UPDATE`), `RETURNING` is Postgres-only, and partial indexes are Postgres/SQLite/SQL Server. Transactional DDL is the difference with the biggest operational impact.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'sql-top-customers',
      title: 'Top Customers by Paid Revenue',
      difficulty: 'MEDIUM',
      runtime: 'sql',
      statement: `The shop schema has \`customers\`, \`categories\`, \`products\`, \`orders\` and \`order_items\`. An order's revenue is the sum of \`quantity * unit_price_cents\` across its items. Only orders with \`status = 'paid'\` count.

Write **one** \`SELECT\` returning every customer whose total paid revenue is **at least 40000** cents, with these columns and aliases:

| column | meaning |
| --- | --- |
| \`name\` | the customer's name |
| \`country\` | the customer's country |
| \`order_count\` | how many **distinct** paid orders they have |
| \`total_cents\` | their total paid revenue in cents |

Order by \`total_cents\` descending, then \`name\` ascending.

> Watch the fan-out: joining \`orders\` to \`order_items\` multiplies order rows, so a plain \`COUNT(o.id)\` counts line items, not orders.`,
      starterCode: `SELECT
  -- your columns here
FROM customers c
-- your joins here
;`,
      solutionCode: `SELECT
  c.name    AS name,
  c.country AS country,
  COUNT(DISTINCT o.id) AS order_count,
  SUM(oi.quantity * oi.unit_price_cents) AS total_cents
FROM customers c
JOIN orders o       ON o.customer_id = c.id AND o.status = 'paid'
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id, c.name, c.country
HAVING SUM(oi.quantity * oi.unit_price_cents) >= 40000
ORDER BY total_cents DESC, name ASC;`,
      hints: [
        'Filter status = \'paid\' in the join condition (or WHERE) so cancelled and pending orders never reach the aggregate.',
        'Joining order_items fans each order out into one row per line item — use COUNT(DISTINCT o.id) for the order count.',
        'A condition on an aggregate cannot go in WHERE; that is what HAVING is for.',
        'Group by c.id as well as the selected columns so two customers with the same name never merge.',
      ],
      sqlSetup: SHOP_SETUP,
      tests: [
        {
          name: 'returns the four qualifying customers, highest revenue first',
          assertion:
            '[{"name":"Grace Hopper","country":"US","order_count":2,"total_cents":99000},{"name":"Ada Lovelace","country":"UK","order_count":3,"total_cents":76000},{"name":"Radia Perlman","country":"US","order_count":1,"total_cents":62000},{"name":"Barbara Liskov","country":"US","order_count":1,"total_cents":44000}]',
        },
      ],
      xp: 70,
    },
    {
      slug: 'sql-top-products-per-category',
      title: 'Top 2 Products per Category (CTE + Window)',
      difficulty: 'HARD',
      runtime: 'sql',
      statement: `Using the same shop schema, find the **two highest-revenue products in each category**, counting only \`paid\` orders.

Return these columns and aliases:

| column | meaning |
| --- | --- |
| \`category\` | the category name |
| \`product\` | the product name |
| \`revenue_cents\` | \`SUM(quantity * unit_price_cents)\` for that product |
| \`rank_in_category\` | \`RANK()\` of the product within its category, highest revenue = 1 |

Keep only rows with \`rank_in_category <= 2\`. Order by \`category\` ascending, then \`rank_in_category\` ascending.

Products with no paid sales do not appear.

> You cannot filter on a window function in \`WHERE\` — window functions are evaluated after \`WHERE\`. Compute the rank in a CTE (or subquery) and filter in the outer query.`,
      starterCode: `WITH product_revenue AS (
  -- aggregate revenue per product here
),
ranked AS (
  -- add RANK() OVER (PARTITION BY ... ORDER BY ...) here
)
SELECT ...
FROM ranked
;`,
      solutionCode: `WITH product_revenue AS (
  SELECT
    p.id          AS product_id,
    p.name        AS product_name,
    p.category_id AS category_id,
    SUM(oi.quantity * oi.unit_price_cents) AS revenue_cents
  FROM products p
  JOIN order_items oi ON oi.product_id = p.id
  JOIN orders o       ON o.id = oi.order_id AND o.status = 'paid'
  GROUP BY p.id, p.name, p.category_id
),
ranked AS (
  SELECT
    cat.name          AS category,
    pr.product_name   AS product,
    pr.revenue_cents  AS revenue_cents,
    RANK() OVER (PARTITION BY pr.category_id ORDER BY pr.revenue_cents DESC) AS rank_in_category
  FROM product_revenue pr
  JOIN categories cat ON cat.id = pr.category_id
)
SELECT category, product, revenue_cents, rank_in_category
FROM ranked
WHERE rank_in_category <= 2
ORDER BY category ASC, rank_in_category ASC;`,
      hints: [
        'First CTE: one row per product with its total paid revenue. Join orders so you can filter on status.',
        'Second CTE: RANK() OVER (PARTITION BY category_id ORDER BY revenue_cents DESC).',
        'Filter rank_in_category <= 2 in the outer SELECT, not inside the window CTE.',
        'Alias every output column exactly as the spec names it — category, product, revenue_cents, rank_in_category.',
      ],
      sqlSetup: SHOP_SETUP,
      tests: [
        {
          name: 'returns the top two products in each of the three categories',
          assertion:
            '[{"category":"Audio","product":"Focus Headphones","revenue_cents":66000,"rank_in_category":1},{"category":"Audio","product":"Desk Mic","revenue_cents":45000,"rank_in_category":2},{"category":"Keyboards","product":"Ninja65 Keyboard","revenue_cents":48000,"rank_in_category":1},{"category":"Keyboards","product":"Split Ergo","revenue_cents":36000,"rank_in_category":2},{"category":"Monitors","product":"UltraWide 34","revenue_cents":62000,"rank_in_category":1},{"category":"Monitors","product":"Studio 27 4K","revenue_cents":45000,"rank_in_category":2}]',
        },
      ],
      xp: 90,
    },
    {
      slug: 'sql-monthly-running-total',
      title: 'Monthly Revenue with a Running Total',
      difficulty: 'MEDIUM',
      runtime: 'sql',
      statement: `Build a monthly revenue report from \`paid\` orders only.

\`orders.placed_on\` is stored as a \`'YYYY-MM-DD'\` string, so \`substr(placed_on, 1, 7)\` gives the month.

Return one row per month with these columns and aliases:

| column | meaning |
| --- | --- |
| \`month\` | \`'YYYY-MM'\` |
| \`revenue_cents\` | that month's paid revenue |
| \`running_total_cents\` | cumulative revenue from the first month through this one |
| \`change_from_prev_cents\` | this month's revenue minus the previous month's; **0** for the first month |

Order by \`month\` ascending.

Hints on shape: aggregate per month in a CTE, then apply \`SUM(...) OVER (ORDER BY month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)\` and \`LAG(...) OVER (ORDER BY month)\` over that result.`,
      starterCode: `WITH monthly AS (
  -- one row per month: month, revenue_cents
)
SELECT ...
FROM monthly
ORDER BY month;`,
      solutionCode: `WITH monthly AS (
  SELECT
    substr(o.placed_on, 1, 7) AS month,
    SUM(oi.quantity * oi.unit_price_cents) AS revenue_cents
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status = 'paid'
  GROUP BY substr(o.placed_on, 1, 7)
)
SELECT
  month,
  revenue_cents,
  SUM(revenue_cents) OVER (
    ORDER BY month
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_total_cents,
  COALESCE(revenue_cents - LAG(revenue_cents) OVER (ORDER BY month), 0) AS change_from_prev_cents
FROM monthly
ORDER BY month;`,
      hints: [
        'Aggregate first: GROUP BY substr(placed_on, 1, 7) inside a CTE, filtering status = \'paid\' in WHERE.',
        'A running total is SUM(...) OVER (ORDER BY month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW).',
        'LAG(revenue_cents) OVER (ORDER BY month) returns NULL for the first row — wrap the subtraction in COALESCE(..., 0).',
        'Window functions cannot see other window functions in the same SELECT; both must read revenue_cents from the CTE.',
      ],
      sqlSetup: SHOP_SETUP,
      tests: [
        {
          name: 'returns three months with cumulative and month-over-month figures',
          assertion:
            '[{"month":"2025-04","revenue_cents":151000,"running_total_cents":151000,"change_from_prev_cents":0},{"month":"2025-05","revenue_cents":145000,"running_total_cents":296000,"change_from_prev_cents":-6000},{"month":"2025-06","revenue_cents":33000,"running_total_cents":329000,"change_from_prev_cents":-112000}]',
        },
      ],
      xp: 80,
    },
  ],
  flashcards: [
    {
      front: 'The one-line definition of 3NF',
      back: 'Every non-key column depends on the key, the whole key, and nothing but the key. No transitive dependencies through another non-key column.',
      tags: ['sql', 'modelling', 'normalisation'],
    },
    {
      front: 'Why must a LEFT JOIN filter go in ON, not WHERE?',
      back: 'Unmatched rows are NULL-padded, and `NULL = value` is UNKNOWN, so WHERE removes them and the outer join collapses to an inner join. ON filters before the join is preserved.',
      tags: ['sql', 'joins'],
    },
    {
      front: 'WHERE vs HAVING',
      back: 'WHERE filters individual rows before grouping; HAVING filters groups after aggregation. Push predicates into WHERE whenever possible — it runs first, on more rows.',
      tags: ['sql', 'aggregation'],
    },
    {
      front: 'GROUP BY vs a window function',
      back: 'GROUP BY collapses each group to one row. A window function computes across a partition while keeping every row, so you get the row *and* its group aggregate side by side.',
      tags: ['sql', 'window-functions'],
    },
    {
      front: 'ROW_NUMBER vs RANK vs DENSE_RANK on 100, 90, 90, 80',
      back: 'ROW_NUMBER: 1,2,3,4. RANK: 1,2,2,4 (gap after the tie). DENSE_RANK: 1,2,2,3 (no gap).',
      tags: ['sql', 'window-functions'],
    },
    {
      front: 'The leftmost-prefix rule',
      back: 'An index on (a, b, c) serves predicates on a, on (a,b), and on (a,b,c) — never on b or c alone. Equality columns first, the range column last.',
      tags: ['sql', 'indexes'],
    },
    {
      front: 'What is a covering index?',
      back: 'One that contains every column the query needs, so the engine never touches the table — an index-only scan. Postgres and SQL Server use INCLUDE for the payload columns.',
      tags: ['sql', 'indexes', 'performance'],
    },
    {
      front: 'What makes a predicate "sargable"?',
      back: 'The indexed column appears bare, so the B-tree can be searched. `date(created_at) = X` is not sargable; `created_at >= X AND created_at < X+1day` is.',
      tags: ['sql', 'indexes', 'performance'],
    },
    {
      front: 'What is the first thing to read in EXPLAIN ANALYZE?',
      back: 'Estimated `rows` vs `actual rows`. A large gap means the planner optimised for a shape that does not exist — run ANALYZE, check correlated predicates, then look at scan and join types.',
      tags: ['sql', 'explain', 'performance'],
    },
    {
      front: 'How do you prevent a lost update?',
      back: 'Best: do the arithmetic in SQL (`SET balance = balance - 5000`). Otherwise `SELECT ... FOR UPDATE` (pessimistic) or a version column checked in the WHERE clause (optimistic) with retry.',
      tags: ['sql', 'transactions', 'concurrency'],
    },
    {
      front: 'How do you avoid deadlocks?',
      back: 'Acquire locks in a consistent order (e.g. sort ids), keep transactions short, never do network I/O inside one, and retry on SQLSTATE 40001/40P01 with backoff.',
      tags: ['sql', 'transactions', 'concurrency'],
    },
    {
      front: 'Upsert in Postgres vs MySQL vs SQL Server',
      back: 'Postgres: `INSERT ... ON CONFLICT (col) DO UPDATE`. MySQL: `INSERT ... ON DUPLICATE KEY UPDATE`. SQL Server: `MERGE`. Only Postgres has `RETURNING *`.',
      tags: ['sql', 'postgresql', 'mysql', 'sql-server'],
    },
  ],
  resources: [
    { label: 'PostgreSQL 16 Documentation', url: 'https://www.postgresql.org/docs/current/index.html', kind: 'DOCS' },
    { label: 'Use The Index, Luke! — SQL indexing explained', url: 'https://use-the-index-luke.com/', kind: 'ARTICLE' },
    { label: 'PostgreSQL — Using EXPLAIN', url: 'https://www.postgresql.org/docs/current/using-explain.html', kind: 'DOCS' },
    { label: 'MySQL 8.0 Reference Manual — InnoDB Locking and Transaction Model', url: 'https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-transaction-model.html', kind: 'DOCS' },
    { label: 'Microsoft — Transact-SQL reference', url: 'https://learn.microsoft.com/en-us/sql/t-sql/language-reference', kind: 'DOCS' },
  ],
};

export default day;
