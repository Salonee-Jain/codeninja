import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 24,
  week: 4,
  pillar: 'DATABASE',
  title: 'NoSQL — MongoDB, Cassandra & DynamoDB',
  summary: 'Model for the query, not the entity, and know exactly what each store gives up to scale.',
  estimatedMinutes: 360,
  objectives: [
    'Explain the document model, the 16 MB limit, and when to embed instead of reference',
    'Query, update and aggregate MongoDB fluently, and read an explain() plan',
    'Design MongoDB indexes with the ESR rule and use Mongoose from a Node/TypeScript service',
    'Reason about CAP and PACELC and turn consistency into a per-request decision',
    'Design Cassandra tables around partition and clustering keys, and avoid tombstone death',
    'Design DynamoDB single-table schemas with PK/SK and GSIs, and cost a query against a scan',
    'Choose between PostgreSQL, MongoDB, Cassandra and DynamoDB for a given workload',
  ],
  technologies: ['MongoDB', 'Cassandra', 'DynamoDB'],
  lessons: [
    {
      slug: 'document-model-and-schema-design',
      title: 'The Document Model, Embed vs Reference, and the 16 MB Limit',
      estimatedMinutes: 90,
      body: `# The Document Model, Embed vs Reference, and the 16 MB Limit

MongoDB stores **documents** — ordered, typed, nested key/value structures — grouped into **collections**. There are no tables, no rows, no fixed columns and no joins in the storage engine.

\`\`\`js
{
  _id: ObjectId("665f1c2b9a4c0f0012ab34cd"),
  email: "ada@example.com",
  name: { first: "Ada", last: "Lovelace" },
  roles: ["admin", "author"],
  address: { city: "London", geo: { type: "Point", coordinates: [-0.12, 51.5] } },
  loginCount: 42,
  lastSeen: ISODate("2026-08-01T09:30:00Z"),
  active: true
}
\`\`\`

## BSON, not JSON

The wire and disk format is **BSON** — Binary JSON. It is length-prefixed (so the server can skip fields without parsing them) and it adds types JSON does not have:

| BSON type | Why it exists |
| --- | --- |
| \`ObjectId\` | 12 bytes: 4-byte timestamp, 5-byte random per-process value, 3-byte counter. Roughly sortable by creation time, generated client-side. |
| \`Date\` | Signed 64-bit ms since epoch, always UTC. |
| \`Decimal128\` | Exact decimal for money. **Never store currency as a double.** |
| \`Int32\` / \`Int64\` / \`Double\` | JSON has one number type; BSON has three. |
| \`Binary\` | Raw bytes, with a subtype (UUID, MD5, user-defined). |

Because \`ObjectId\` embeds a timestamp, \`sort({ _id: -1 })\` is a free "newest first" and you get \`_id.getTimestamp()\` for nothing. That is not a licence to use it as a business identifier — it leaks creation time and rough machine identity.

## Embed or reference

This is *the* schema-design decision, and it is driven by access pattern, not by purity.

**Embed** when the child is only ever read with the parent, the relationship is one-to-few, and the child is not updated far more often than the parent.

\`\`\`js
// order + its line items: always read together, bounded count
{ _id: 1, customerId: 7, total: 42.50,
  items: [ { sku: "A-1", qty: 2, price: 9.5 }, { sku: "B-9", qty: 1, price: 23.5 } ] }
\`\`\`

One read, no join, atomic update of the whole order. This is where document databases beat relational ones outright.

**Reference** when the child is large, shared, unbounded, or independently queried.

\`\`\`js
{ _id: ObjectId("..."), title: "Mongo in Anger", authorId: ObjectId("...") }
\`\`\`

Then resolve with \`$lookup\` at query time, or with a second query in the application — often faster, and always more predictable.

The honest heuristic:

| Cardinality | Do this |
| --- | --- |
| one-to-few (< ~100, bounded) | embed |
| one-to-many (hundreds–thousands) | reference from the child, index the parent id |
| one-to-squillions (log lines, events) | reference from the child, never embed |
| many-to-many | reference both ways, or an array of ids on the smaller side |

## The 16 MB limit

A single BSON document may not exceed **16 MB**. This is not a soft guideline; the write is rejected. It exists to stop unbounded documents from destroying working-set memory — the server reads and rewrites a whole document, so a 15 MB document is 15 MB of I/O to change one field.

Two consequences:

1. **Any array that grows without bound is a bug.** Comments on a post, events for a user, ticks for a sensor — these must be their own collection.
2. Large blobs go to object storage (S3) or GridFS, which chunks a file across a \`fs.chunks\` collection. Store the URL, not the bytes.

## Anti-patterns worth memorising

**Unbounded arrays.** The document grows, the server keeps relocating it, indexes on that array balloon, and eventually you hit 16 MB in production at 3 a.m. If you must embed a growing list, use the **bucket pattern**: fixed-size buckets of, say, 200 events per document.

\`\`\`js
{ sensorId: "s-1", day: "2026-08-05", count: 200,
  readings: [ { t: ISODate("..."), v: 21.4 } ] }
\`\`\`

**Massive number of collections.** Each collection and index costs file handles and memory. "One collection per customer" falls over at a few thousand tenants; add a \`tenantId\` field and index it instead.

**Case-everywhere polymorphism.** Documents in one collection may have different shapes — that is a feature — but if you cannot name the two or three variants, your queries will be full of \`$exists\` and no index will help. Use a discriminator field (\`type: "invoice" | "credit_note"\`).

**Treating Mongo as relational.** Six \`$lookup\` stages to reassemble a normalised model means you designed for a database you are not using. Either embed, or use Postgres.

## Schema validation

Schemaless does not mean unvalidated. The server can enforce JSON Schema:

\`\`\`js
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "createdAt"],
      properties: {
        email: { bsonType: "string", pattern: "^.+@.+$" },
        loginCount: { bsonType: "int", minimum: 0 },
        roles: { bsonType: "array", items: { enum: ["admin", "author", "reader"] } }
      }
    }
  },
  validationLevel: "moderate",   // only validate inserts + updates to already-valid docs
  validationAction: "error"      // or "warn" to log and accept
});
\`\`\`

> Application-level validation (Mongoose, Zod) and server-level validation are complements, not alternatives. The server is the only place that catches the ad-hoc \`mongosh\` write someone ran by hand.`,
    },
    {
      slug: 'mongodb-in-practice',
      title: 'MongoDB in Practice — Operators, Aggregation, Indexes and Mongoose',
      estimatedMinutes: 100,
      body: `# MongoDB in Practice — Operators, Aggregation, Indexes and Mongoose

Everything in MongoDB is a document — including your query. There is no query *language* to parse, only a structure to match.

## Reading

\`\`\`js
db.orders.find(
  { status: "shipped", total: { $gte: 100 } },   // filter: top-level keys are ANDed
  { _id: 0, orderNo: 1, total: 1 }               // projection: 1 includes, 0 excludes
).sort({ total: -1 }).skip(20).limit(10);
\`\`\`

You cannot mix inclusion and exclusion in a projection, except for \`_id\` — included by default, turned off explicitly.

\`\`\`js
{ qty: { $gt: 10, $lte: 100 } }                  // two conditions on one field
{ status: { $in: ["new", "paid"] }, deletedAt: { $exists: false } }
{ $or: [ { status: "paid" }, { total: { $gt: 500 } } ] }
{ name: { $regex: "^ad", $options: "i" } }       // only anchored regexes can use an index
\`\`\`

> \`$not\` and \`$ne\` also match documents where the field is **missing**. If you mean "exists and is not X", write \`{ field: { $exists: true, $ne: "X" } }\`.

### Arrays: the bug everyone ships once

\`\`\`js
{ "address.city": "London" }                     // dot notation into a subdocument
{ tags: "sale" }                                 // array CONTAINS "sale"
{ tags: ["sale", "new"] }                        // array EQUALS exactly, in this order
{ "items.sku": "A-1", "items.qty": { $gt: 5 } }  // different elements may satisfy each!
{ items: { $elemMatch: { sku: "A-1", qty: { $gt: 5 } } } }  // ONE element matches both
\`\`\`

Dot-notation conditions on an array are evaluated independently across elements; \`$elemMatch\` binds every condition to the *same* element, which is almost always what you meant.

## Writing

You never send a whole replacement document unless you mean to — you send an *operator*:

\`\`\`js
db.users.updateOne(
  { _id: userId },
  {
    $set:   { "name.first": "Ada", updatedAt: new Date() },
    $unset: { legacyField: "" },
    $inc:   { loginCount: 1 },
    $currentDate: { lastSeen: true }
  }
);

// arrays: $push (with $each/$sort/$slice), $addToSet, $pull, $pop
// $ updates the FIRST matched element, $[] every element, $[name] a filtered subset
db.orders.updateOne({ _id: 1, "items.sku": "A-1" }, { $set: { "items.$.qty": 9 } });
\`\`\`

**Single-document operations are always atomic**, however many fields or nested arrays they touch, which is why \`findOneAndUpdate({ _id: "invoice" }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" })\` is a race-free counter. That property is the real argument for embedding: it turns a multi-row transaction into one write. And when you find yourself in a \`for\` loop calling \`updateOne\`, reach for \`bulkWrite([...], { ordered: false })\`.

## The aggregation pipeline

\`find()\` retrieves documents; the pipeline *transforms* them — MongoDB's answer to \`GROUP BY\`, \`JOIN\`, \`CASE\` and window functions in one.

\`\`\`js
db.orders.aggregate([
  { $match: { status: "shipped", placedAt: { $gte: ISODate("2026-01-01") } } },
  { $group: { _id: "$customerId", revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
  { $match: { revenue: { $gt: 1000 } } },
  { $sort:  { revenue: -1 } },
  { $limit: 10 }
]);
\`\`\`

Inside an expression, \`"$field"\` means "the value of that field", a bare string is a **literal**, and \`"$$var"\` is a variable. That one rule explains most aggregation confusion.

| Stage | Does |
| --- | --- |
| \`$match\` | a \`find()\` filter. **Put it first** — only then can it use an index |
| \`$project\` / \`$addFields\` | reshape; \`$project\` is exclusive, \`$addFields\` (alias \`$set\`) additive |
| \`$group\` | \`_id\` is the key: \`null\` for a grand total, \`"$f"\`, or a document for a compound key. \`{ $sum: 1 }\` counts |
| \`$unwind\` | one document per array element. **Drops** documents whose array is missing or empty unless \`preserveNullAndEmptyArrays: true\` |
| \`$lookup\` | left outer join; the result is an **array** field, so it is usually followed by \`$unwind\` |
| \`$facet\` | several sub-pipelines over one input pass — page, total and filter counts for a search screen |

\`$lookup\` also takes a pipeline form — \`let: { uid: "$_id" }\` plus an inner \`$match\` on \`{ $expr: { $eq: ["$customerId", "$$uid"] } }\` — which lets you filter and project the joined side before it comes back. Either way it runs per input document, so **index the \`foreignField\`** or you have written an N+1 with extra steps. Push \`$match\`, \`$limit\` and \`$project\` as early as you can; a blocking \`$sort\` is capped at 100 MB of RAM before you must pass \`{ allowDiskUse: true }\`.

## Indexes and the ESR rule

\`\`\`js
db.users.createIndex({ email: 1 }, { unique: true });
db.orders.createIndex({ customerId: 1, placedAt: -1 });                    // compound
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });   // TTL
db.products.createIndex({ tags: 1 });                                      // multikey (array)
\`\`\`

A compound index serves any **prefix** of its keys: \`{a,b,c}\` answers \`a\`, \`a+b\` and \`a+b+c\` but not \`b\` alone, so a separate \`{a:1}\` index is redundant. For key *order*, use **ESR: Equality, Sort, Range.**

\`\`\`js
db.orders.find({ status: "open", total: { $gt: 100 } }).sort({ placedAt: -1 });
db.orders.createIndex({ status: 1, placedAt: -1, total: 1 });   // E, S, R
\`\`\`

Equality pins the scan to one contiguous run of the B-tree; within that run the index is already ordered by the next key, so the **sort** is free. A **range** must come last, because after a range scan the remaining keys are no longer in one ordered run. Same fields, wrong order, ten times the latency.

\`\`\`js
db.orders.find({ status: "open" }).sort({ placedAt: -1 }).explain("executionStats");
\`\`\`

| Field | Good | Bad |
| --- | --- | --- |
| \`winningPlan.stage\` | \`IXSCAN\` | \`COLLSCAN\` |
| \`totalKeysExamined\` vs \`nReturned\` | close to 1:1 | 1000:1 means a badly ordered index |
| \`totalDocsExamined\` | \`0\` = a **covered query** | a \`SORT\` stage here means a blocking in-memory sort |

## Transactions

\`\`\`js
const session = client.startSession();
await session.withTransaction(async () => {
  await accounts.updateOne({ _id: "a" }, { $inc: { balance: -100 } }, { session });
  await accounts.updateOne({ _id: "b" }, { $inc: { balance:  100 } }, { session });
}, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
await session.endSession();
\`\`\`

Every operation must be passed \`{ session }\` or it silently runs outside the transaction. Transactions default to a **60-second** limit and hold locks — an escape hatch, not the everyday tool. If you need them constantly, your documents are drawn on the wrong boundaries.

## Mongoose from a Node/TypeScript service

\`\`\`ts
import mongoose, { Schema, model, InferSchemaType } from 'mongoose';

const postSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  published: { type: Boolean, default: false },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

postSchema.index({ author: 1, createdAt: -1 });

export type Post = InferSchemaType<typeof postSchema>;
export const PostModel = model('Post', postSchema);

const feed = await PostModel.find({ published: true })
  .populate('author', 'email')
  .sort({ createdAt: -1 })
  .limit(20)
  .lean();
\`\`\`

\`InferSchemaType\` derives the TypeScript row type from the schema, so the shape has one source of truth, and \`timestamps: true\` maintains \`createdAt\`/\`updatedAt\` for you. Three things to carry over from Day 23: validators do **not** run on \`findOneAndUpdate\` unless you pass \`runValidators: true\`; \`populate()\` is a second \`$in\` query rather than a join, so a page costs 2 queries unless you populate inside a loop; and \`.lean()\` skips hydration, which is the right default for anything you only serialise to JSON.`,
    },
    {
      slug: 'query-first-modelling-and-cassandra',
      title: 'Query-First Modelling at Scale — CAP, PACELC and Cassandra',
      estimatedMinutes: 85,
      body: `# Query-First Modelling at Scale — CAP, PACELC and Cassandra

Everything so far assumed one machine held all the data. Once the dataset or the write rate exceeds one machine, you replicate and partition — and physics starts making decisions for you.

## CAP, stated correctly

CAP says that when a **network partition (P)** splits your cluster, you must choose between **Consistency** (every read sees the latest acknowledged write, or fails) and **Availability** (every request gets a non-error response, possibly stale).

The common misstatement is "pick two of three". You do not get to pick P — networks partition, and the only question is what your system does when they do. CAP is a binary choice **during a partition**: CP (refuse, stay correct) or AP (answer, reconcile later).

## PACELC — the half everyone forgets

Partitions are rare. The interesting trade-off is the one you pay *all the time*:

> **if P** then (**A** or **C**) **else** (**L**atency or **C**onsistency)

| System | Partition behaviour | Normal behaviour |
| --- | --- | --- |
| Cassandra \`ONE\` / DynamoDB default | PA | EL — one replica answers, fastest, may be stale |
| Cassandra \`QUORUM\` / DynamoDB \`ConsistentRead\` | PC | EC — waits for a majority, ~2x the cost |
| PostgreSQL (single primary) | PC | EC |

The lesson: **consistency is a per-request dial, not a database property.** You turn it differently for "did my payment go through" than for "how many likes does this post have".

## Quorum arithmetic

With **N** replicas, a read touching **R** of them and a write touching **W** of them are guaranteed to overlap — and therefore to be strongly consistent — when:

\`\`\`
R + W > N
\`\`\`

With N = 3: R=2, W=2 overlaps (4 > 3); R=1, W=1 does not, and you get eventual consistency. A second, separate condition covers **write conflicts** — \`W > N/2\`, so two concurrent majority writes share a replica and last-write-wins resolves them deterministically. Today's second problem builds the ring these replicas live on.

## Query-first modelling

Relationally you model the **entities**, normalise, and then write whatever query you need — the planner will find a way. In a distributed store there is no planner worth the name and no cross-partition join, so the rule inverts:

> **List your queries first. Create one table per query. Duplicate data freely.**

Take a message app. Relationally: \`users\`, \`conversations\`, \`messages\`, joined. Here you write down the access patterns — recent messages in a conversation; conversations for a user, newest first; a message by id — and create **three tables**, with the same message written three times.

That feels wrong for about a week. The justification is concrete: storage is cheap and a cross-node join at 10k requests/second is not; these stores have no foreign keys or cross-partition transactions anyway; and every read becomes a single-partition lookup with predictable latency at any scale.

The cost is that **writes fan out** and you own consistency between the copies. Before duplicating a field, ask how often it changes, whether the copies can diverge harmlessly (a stale avatar is cosmetic, a stale price is a lawsuit), and **who repairs them** — name the stream consumer or nightly job before you ship. If the answers are "constantly" and "nobody", store an id and do a second lookup. Two fast key-value gets beat one wrong answer.

## Cassandra: the primary key is two things

Cassandra is a masterless, wide-column store. Every node is identical; data is placed on a **token ring** by hashing the partition key, and each partition is replicated to the next *RF* nodes around the ring.

\`\`\`sql
CREATE TABLE messages_by_conversation (
  conversation_id uuid,
  bucket          text,
  sent_at         timestamp,
  message_id      timeuuid,
  sender_id       uuid,
  body            text,
  PRIMARY KEY ((conversation_id, bucket), sent_at, message_id)
) WITH CLUSTERING ORDER BY (sent_at DESC, message_id DESC);
\`\`\`

- \`(conversation_id, bucket)\` is the **partition key** — the double parentheses matter. It is hashed to a token, which decides *which nodes* store the row. Every query must supply it in full.
- \`sent_at, message_id\` are **clustering columns**. They decide the *physical order of rows inside* the partition, which is why "most recent 50 messages" is one contiguous disk read.

\`\`\`sql
-- fast: one partition, ordered range on the first clustering column
SELECT * FROM messages_by_conversation
WHERE conversation_id = ? AND bucket = '2026-08' AND sent_at < ? LIMIT 50;

-- legal but a lie: ALLOW FILTERING reads every partition on every node
SELECT * FROM messages_by_conversation WHERE sender_id = ? ALLOW FILTERING;
\`\`\`

> If a query needs \`ALLOW FILTERING\`, you need another table. Treat it as a compile error, not a hint.

## Tunable consistency

**Replication factor (RF)** is a storage property, fixed per keyspace and per data centre. **Consistency level (CL)** is a per-query property — that is the dial you actually turn.

| CL | Replicas contacted | Use for |
| --- | --- | --- |
| \`ONE\` | 1 | high-volume, tolerant reads: feeds, counters, metrics |
| \`QUORUM\` | floor(RF/2)+1 | anything that must be correct |
| \`LOCAL_QUORUM\` | majority **in the local DC** | the multi-DC default: correctness without a cross-ocean hop |
| \`ALL\` | RF | almost never; one dead node fails the query |

With RF=3, \`QUORUM\` is 2, so a QUORUM write plus a QUORUM read gives 2+2 > 3 and reads see the latest write. Conflicts resolve **last-write-wins** on a per-cell timestamp; there is no safe read-modify-write unless you use a lightweight transaction (\`IF NOT EXISTS\`), which runs Paxos at roughly four round trips. Uniqueness checks, not hot paths.

## LSM trees and tombstones

Writes go to a commit log plus an in-memory **memtable**; when that fills it is flushed to an immutable **SSTable** on disk, and compaction merges SSTables in the background. That is a **log-structured merge tree**, and it is why Cassandra writes are so cheap: every write is an append, with no read-before-write and no random I/O.

The price is on the read side, and it is called a **tombstone**. A delete cannot erase data from an immutable file, so it writes a marker. Reads must merge every SSTable that might contain the key and skip the tombstoned cells, and tombstones only disappear after \`gc_grace_seconds\` — 10 days by default, sized so a returning node cannot resurrect deleted data.

\`\`\`sql
-- queue anti-pattern: insert, read the oldest, delete, repeat
SELECT * FROM job_queue WHERE shard = 1 LIMIT 10;   -- now reads past 400,000 tombstones
\`\`\`

Using Cassandra as a queue means every read walks a graveyard. The driver warns at 1,000 tombstones per query and fails at 100,000. Use a real queue (Kafka, SQS) and give Cassandra data with a natural TTL instead.

Three more anti-patterns. **Large partitions**: stay under roughly 100 MB and 100,000 rows, because a partition lives on one node — bucket the partition key. **Low-cardinality partition keys**: \`PRIMARY KEY ((country), user_id)\` puts a whole country on three nodes. **Secondary indexes**: \`CREATE INDEX\` is node-local, so a lookup fans out to the entire cluster — prefer a second query table.`,
    },
    {
      slug: 'dynamodb-and-choosing',
      title: 'DynamoDB — Keys, Single-Table Design, Capacity, and How to Choose',
      estimatedMinutes: 85,
      body: `# DynamoDB — Keys, Single-Table Design, Capacity, and How to Choose

DynamoDB is AWS's managed key-value/document store. Same physics as Cassandra — hash-partitioned, replicated, no joins — wrapped in an API with no servers to run and a bill that maps directly to your access patterns.

## The key schema

Every item has a **partition key (PK)** and optionally a **sort key (SK)**; together they are the unique primary key. **PK** is hashed to choose a partition and must be supplied exactly — no ranges, no wildcards, ever. **SK** orders items *within* a partition and supports \`=\`, \`<\`, \`<=\`, \`>\`, \`>=\`, \`BETWEEN\` and \`begins_with\`. That is the entire query surface, and it is deliberately small: any query you can express runs in predictable time.

## Single-table design

With no joins, the idiomatic schema puts **every entity type in one table** with generic key attributes, arranged so related items share a partition and come back in one query.

| PK | SK | attributes |
| --- | --- | --- |
| \`USER#1\` | \`PROFILE\` | name, email |
| \`USER#1\` | \`ORDER#2026-01-14#8801\` | total, status |
| \`USER#1\` | \`ORDER#2026-02-02#8850\` | total, status |

Now "profile plus orders" is **one** query on \`PK = "USER#1"\`; "just the orders" adds \`begins_with(SK, "ORDER#")\`; "orders in February" adds \`SK BETWEEN "ORDER#2026-02" AND "ORDER#2026-03"\`.

The prefixes are what let \`begins_with\` and \`BETWEEN\` carve out entity types, and a sortable date first inside the sort key is what makes the range work. Sort keys compare as **strings**, so zero-pad numbers and use ISO-8601 dates.

\`\`\`js
await ddb.query({
  TableName: 'app',
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
  ExpressionAttributeValues: { ':pk': 'USER#1', ':prefix': 'ORDER#' },
  ScanIndexForward: false,   // newest first
});
\`\`\`

## Secondary indexes

A **GSI** (Global Secondary Index) is a whole separate copy of the table with a different PK/SK, updated asynchronously.

- Any attributes as key, with different partitioning from the base table.
- **Eventually consistent only** — a GSI read can miss a write from a millisecond ago.
- Its own capacity, its own bill.
- **Sparse**: items missing the GSI's key attributes are simply not in the index. That is a feature — set \`GSI1PK\` only on unprocessed orders and the index becomes a work queue containing exactly them.

An **LSI** (Local Secondary Index) keeps the table's PK and swaps the sort key. It reads strongly consistently, but must be created with the table and caps the partition it indexes at 10 GB.

Reach for a GSI whenever you need to query by something that is not the table's PK: "find the user by email", "find all orders in state PENDING".

## Query vs Scan

\`Query\` goes to one partition and reads a contiguous range, so cost is proportional to what you read. \`Scan\` reads **every** item in the table and *then* applies \`FilterExpression\`.

The critical detail: a \`FilterExpression\` is applied **after** the read, so you are billed for every item scanned, not the handful returned. A scan over a 200 GB table costs the same whether it matches 1 item or 100,000. Scans are for migrations and one-off analytics. If you find yourself scanning in a request handler, you need a GSI. Today's third problem makes that gap concrete by returning \`count\` and \`scannedCount\` separately.

## Capacity: RCU, WCU and on-demand

**Provisioned** mode bills in capacity units per second: **1 RCU** is one *strongly consistent* read of up to 4 KB per second (or two eventually-consistent reads), and **1 WCU** is one write of up to 1 KB per second.

A 6 KB item read strongly consistently costs 2 RCU (4 KB blocks, rounded up); eventually consistent, 1 RCU. A 3.5 KB write costs 4 WCU. Exceed the provisioned rate and you get \`ProvisionedThroughputExceededException\`; the SDK retries with backoff, but sustained overrun surfaces as latency.

**On-demand** mode bills per request with no capacity planning, at roughly 5-7x the per-request price of well-utilised provisioned capacity. Use it for spiky or unknown traffic; switch to provisioned with auto-scaling once the load is steady.

Hot partitions still exist: adaptive capacity helps, but one partition key taking all the writes still bottlenecks. **Write sharding** is the fix — append \`#\` plus a small random suffix to the PK and query the shards in parallel.

## Streams and TTL

A **stream** is an ordered, 24-hour change log per partition key (\`StreamViewType\`: \`KEYS_ONLY\`, \`NEW_IMAGE\`, \`OLD_IMAGE\`, \`NEW_AND_OLD_IMAGES\`). It is the event-sourcing hook: trigger a Lambda on every insert/modify/remove to maintain an aggregate, push to OpenSearch, or fan out a notification. Delivery is at-least-once, so handlers must be idempotent.

**TTL** deletes items after an epoch-seconds timestamp you store in a numeric attribute (\`{ PK: 'SESSION#abc', SK: 'META', expiresAt: 1786000000 }\`). Deletion is free but **eventual** — typically within 48 hours, not at the second — so filter expired items out in your reads rather than trusting the timestamp. TTL deletions do appear in Streams, which makes "archive on expiry" a two-line Lambda.

## Choosing: PostgreSQL, MongoDB, Cassandra or DynamoDB

| | PostgreSQL | MongoDB | Cassandra | DynamoDB |
| --- | --- | --- | --- | --- |
| Data model | relations, rows | documents | wide rows, partitioned | items, partitioned |
| Query flexibility | total: ad-hoc joins, aggregates, windows | high: rich queries + pipeline | low: partition key + clustering prefix | lowest: PK, SK range, GSIs |
| Joins | yes, planned | \`$lookup\` (per-document) | none | none |
| Transactions | full ACID, multi-table | multi-document (60 s cap) | single-partition; LWT via Paxos | \`TransactWriteItems\`, ≤100 items |
| Scaling writes | one primary (or Citus) | sharded clusters | linear, masterless | effectively unlimited |
| Consistency | strong by default | strong on primary, tunable reads | tunable per query | eventual, or \`ConsistentRead\` |
| Secondary indexes | excellent | excellent | node-local, dangerous | GSIs, eventually consistent |
| Schema change | planned migration | flexible per document | new query = new table | new pattern = new GSI or backfill |
| Ops burden / cost | medium, per instance-hour | medium, per instance-hour | high (compaction, repairs), per node | none, per request |

Five questions settle it faster than an argument:

1. **Do you know all your queries in advance?** No, requirements shift weekly: Postgres or MongoDB. Yes, and there are five of them: Cassandra or DynamoDB become viable.
2. **Do you need multi-entity ACID transactions, often?** Then Postgres.
3. **What is the write rate, honestly?** Below roughly 10,000 writes/second a well-tuned Postgres is fine and enormously simpler.
4. **Who operates it at 3 a.m.?** If nobody has run a Cassandra ring — repairs, compaction, topology — DynamoDB gives you the same data model with no cluster.
5. **Does the workload have a natural partition key?** Tenant, user, device. If your hottest queries cut across all entities instead, a partitioned store will fight you every day.

Real systems use more than one, and the healthy version keeps **one system of record per piece of data**, everything else a derived projection you have actually rebuilt once in staging. Distributed stores move difficulty from *query time*, where a planner helps you, to *design time*, where you are on your own — a good trade exactly when your access patterns are stable and your scale is real, and a bad one otherwise.`,
    },
  ],
  quiz: [
    {
      prompt: 'Why does MongoDB impose a 16 MB limit on a single document?',
      options: [
        'BSON cannot address more than 16 MB',
        'Documents are read and rewritten as a unit, so unbounded documents would destroy I/O and working-set memory',
        'It is a licensing restriction in the community edition',
        'The wire protocol has a 16 MB frame size for compressed payloads only',
      ],
      correctIndex: 1,
      explanation:
        'A document is the unit of storage and of atomic update. Allowing them to grow without bound means every small change rewrites megabytes and every read pulls them into RAM. The limit is a forcing function against unbounded arrays.',
      difficulty: 'EASY',
    },
    {
      prompt: 'What is the difference between `{ "items.sku": "A-1", "items.qty": { $gt: 5 } }` and `{ items: { $elemMatch: { sku: "A-1", qty: { $gt: 5 } } } }`?',
      options: [
        'They are equivalent; $elemMatch is just shorthand',
        '$elemMatch is slower but otherwise identical',
        'The first matches when different array elements satisfy each condition; $elemMatch requires one element to satisfy both',
        '$elemMatch only works on arrays of scalars',
      ],
      correctIndex: 2,
      explanation:
        'Dot-notation conditions on an array are evaluated independently across elements. `$elemMatch` binds all its conditions to the same element, which is almost always what you actually meant.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'In an aggregation expression, what does the string `"$total"` mean, versus `"total"`?',
      options: [
        '`"$total"` is the value of the `total` field; `"total"` is the literal string',
        'Both refer to the field; the `$` is optional style',
        '`"$total"` is a variable declared in `let`; `"total"` is a field',
        '`"$total"` only works inside `$group`',
      ],
      correctIndex: 0,
      explanation:
        'A single `$` prefix is a field path. A bare string is a literal. A double `$$` prefix (`"$$uid"`, `"$$ROOT"`) refers to a variable — that is the distinction to keep straight inside `$lookup` pipelines.',
      difficulty: 'EASY',
    },
    {
      prompt: 'A query filters on `status` (equality), sorts by `placedAt` descending, and ranges on `total`. Which compound index should you build?',
      options: [
        '{ total: 1, placedAt: -1, status: 1 }',
        '{ placedAt: -1, status: 1, total: 1 }',
        '{ status: 1, total: 1, placedAt: -1 }',
        '{ status: 1, placedAt: -1, total: 1 }',
      ],
      correctIndex: 3,
      explanation:
        'ESR: Equality, Sort, Range. Equality pins the scan to one contiguous section, within which the index is already ordered by the sort key, so the sort is free. Putting the range before the sort forces a blocking in-memory SORT stage.',
      difficulty: 'HARD',
    },
    {
      prompt: 'What does the "P" in CAP actually let you choose?',
      options: [
        'Whether your system tolerates network partitions at all',
        'Nothing — partitions happen, so you only choose how the system behaves during one: stay consistent and refuse, or stay available and serve possibly-stale data',
        'How many partitions the data is split across',
        'Whether to use synchronous or asynchronous replication in normal operation',
      ],
      correctIndex: 1,
      explanation:
        'You cannot opt out of network partitions. CAP reduces to a binary behaviour choice during a partition: CP (fail the request, keep correctness) or AP (answer, reconcile later). PACELC then covers the far more common no-partition case: latency versus consistency.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why does using Cassandra as a job queue eventually break?',
      options: [
        'Cassandra does not support DELETE',
        'Clustering columns cannot be timestamps',
        'Deletes write tombstones into immutable SSTables, so reads of the oldest rows must skip an ever-growing graveyard until the query fails',
        'The commit log fills up and blocks writes',
      ],
      correctIndex: 2,
      explanation:
        'An LSM tree cannot erase data in place. Every delete appends a tombstone that survives `gc_grace_seconds` (10 days by default), and a queue deletes constantly. Reads warn at 1,000 tombstones and fail at 100,000.',
      difficulty: 'HARD',
    },
    {
      prompt: 'A DynamoDB `Scan` with a `FilterExpression` that matches 3 items out of 2 million — what are you billed for?',
      options: [
        'Reading all 2 million items, because the filter is applied after the read',
        'Reading 3 items',
        'Nothing — filtered scans are free',
        'Reading one partition',
      ],
      correctIndex: 0,
      explanation:
        'A FilterExpression runs after items are read, so the consumed capacity reflects everything scanned, not what came back. This is why a scan in a request handler is always the wrong answer — add a GSI instead.',
      difficulty: 'EASY',
    },
    {
      prompt: 'What makes a DynamoDB GSI "sparse", and why is that useful?',
      options: [
        'It only indexes items smaller than 4 KB, saving storage',
        'It samples a subset of items, trading accuracy for cost',
        'It is compressed on disk',
        'Items missing the GSI key attributes are absent from the index, so setting the key only on interesting items turns the index into a work queue',
      ],
      correctIndex: 3,
      explanation:
        'A GSI only contains items that have all of its key attributes. Writing `GSI1PK` only onto, say, unprocessed orders means querying that index returns exactly the unprocessed ones, at the size of that subset rather than the whole table.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'mini-aggregation-pipeline',
      title: 'Build a Mini Aggregation Pipeline',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Implement \`aggregate(docs, pipeline)\` — a miniature of MongoDB's aggregation engine over an array of plain objects. Each stage takes the stream from the previous stage.

Support exactly these stages.

**\`$match\`** — an object of \`path: condition\`, ANDed. \`path\` may be dotted. A condition is either a literal (equality; if the document value is an **array**, it matches when the array *contains* the literal) or an operator object supporting \`$eq\`, \`$ne\`, \`$gt\`, \`$gte\`, \`$lt\`, \`$lte\`, \`$in\`, \`$nin\`, \`$exists\`.

**\`$project\`** — inclusion only. \`field: 1\` copies the field; \`field: '$some.path'\` copies from an expression; \`_id\` is included by default and dropped with \`_id: 0\`. Fields whose value resolves to \`undefined\` are omitted.

**\`$group\`** — \`{ _id: <expr>, <out>: { <acc>: <expr> } }\`. An \`<expr>\` is \`null\`, a \`'$path'\` string, a literal, or an object of expressions (compound key). Accumulators: \`$sum\`, \`$avg\`, \`$min\`, \`$max\`, \`$push\`, \`$first\`, \`$last\`. Groups come out in **first-seen order**.

**\`$sort\`** — \`{ path: 1 | -1 }\`, multiple keys applied in order, stable. Missing values sort lowest.

**\`$unwind\`** — \`'$path'\` or \`{ path: '$path' }\`. Emits one document per array element with that path replaced by the element. Documents whose value is missing or null are **dropped**; a non-array value passes through unchanged.

**\`$limit\`** / **\`$skip\`** — numbers.

An unknown stage name must \`throw\`.

\`\`\`js
aggregate(sales, [
  { $match: { qty: { $gte: 5 } } },
  { $group: { _id: '$item', total: { $sum: '$qty' }, n: { $sum: 1 } } },
  { $sort: { total: -1 } },
]);
\`\`\``,
      starterCode: `function aggregate(docs, pipeline) {
  // your code
}

module.exports = { aggregate };`,
      solutionCode: `function getField(doc, path) {
  let current = doc;
  for (const part of String(path).split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function withField(doc, path, value) {
  const parts = String(path).split('.');
  const root = { ...doc };
  let current = root;
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = { ...current[parts[i]] };
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
  return root;
}

function evalExpr(doc, expr) {
  if (typeof expr === 'string' && expr.charAt(0) === '$') return getField(doc, expr.slice(1));
  if (expr !== null && typeof expr === 'object' && !Array.isArray(expr)) {
    const out = {};
    for (const key of Object.keys(expr)) out[key] = evalExpr(doc, expr[key]);
    return out;
  }
  return expr;
}

function cmp(a, b) {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function isOperatorCondition(cond) {
  return (
    cond !== null &&
    typeof cond === 'object' &&
    !Array.isArray(cond) &&
    Object.keys(cond).every((k) => k.charAt(0) === '$') &&
    Object.keys(cond).length > 0
  );
}

function matchValue(value, cond) {
  if (isOperatorCondition(cond)) {
    return Object.keys(cond).every((op) => {
      const rhs = cond[op];
      if (op === '$eq') return value === rhs;
      if (op === '$ne') return value !== rhs;
      if (op === '$gt') return value !== undefined && value > rhs;
      if (op === '$gte') return value !== undefined && value >= rhs;
      if (op === '$lt') return value !== undefined && value < rhs;
      if (op === '$lte') return value !== undefined && value <= rhs;
      if (op === '$in') return rhs.indexOf(value) !== -1;
      if (op === '$nin') return rhs.indexOf(value) === -1;
      if (op === '$exists') return (value !== undefined) === Boolean(rhs);
      throw new Error('unsupported query operator ' + op);
    });
  }
  if (Array.isArray(value)) return value.indexOf(cond) !== -1;
  return value === cond;
}

function projectDoc(doc, spec) {
  const out = {};
  const hasId = Object.prototype.hasOwnProperty.call(spec, '_id');
  if ((!hasId || spec._id === 1 || spec._id === true) && '_id' in doc) out._id = doc._id;

  for (const key of Object.keys(spec)) {
    const rule = spec[key];
    if (key === '_id') {
      if (rule !== 0 && rule !== false && rule !== 1 && rule !== true) {
        const value = evalExpr(doc, rule);
        if (value !== undefined) out._id = value;
      }
      continue;
    }
    if (rule === 0 || rule === false) continue;
    const value = rule === 1 || rule === true ? getField(doc, key) : evalExpr(doc, rule);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function groupDocs(docs, spec) {
  const accumulators = Object.keys(spec).filter((k) => k !== '_id');
  const order = [];
  const buckets = new Map();

  for (const doc of docs) {
    const raw = evalExpr(doc, spec._id);
    const id = raw === undefined ? null : raw;
    const key = JSON.stringify(id === undefined ? null : id);
    if (!buckets.has(key)) {
      buckets.set(key, { id, docs: [] });
      order.push(key);
    }
    buckets.get(key).docs.push(doc);
  }

  return order.map((key) => {
    const bucket = buckets.get(key);
    const out = { _id: bucket.id };
    for (const field of accumulators) {
      const accSpec = spec[field];
      const op = Object.keys(accSpec)[0];
      const values = bucket.docs.map((d) => evalExpr(d, accSpec[op]));
      const numbers = values.filter((v) => typeof v === 'number');
      const defined = values.filter((v) => v !== undefined && v !== null);
      if (op === '$sum') out[field] = numbers.reduce((s, v) => s + v, 0);
      else if (op === '$avg') out[field] = numbers.length ? numbers.reduce((s, v) => s + v, 0) / numbers.length : null;
      else if (op === '$min') out[field] = defined.length ? defined.reduce((a, b) => (cmp(a, b) <= 0 ? a : b)) : null;
      else if (op === '$max') out[field] = defined.length ? defined.reduce((a, b) => (cmp(a, b) >= 0 ? a : b)) : null;
      else if (op === '$push') out[field] = values;
      else if (op === '$first') out[field] = values[0];
      else if (op === '$last') out[field] = values[values.length - 1];
      else throw new Error('unsupported accumulator ' + op);
    }
    return out;
  });
}

function sortDocs(docs, spec) {
  const keys = Object.keys(spec);
  return docs.slice().sort((a, b) => {
    for (const key of keys) {
      const result = cmp(getField(a, key), getField(b, key));
      if (result !== 0) return spec[key] < 0 ? -result : result;
    }
    return 0;
  });
}

function unwindDocs(docs, arg) {
  const raw = typeof arg === 'string' ? arg : arg.path;
  const path = raw.charAt(0) === '$' ? raw.slice(1) : raw;
  const out = [];
  for (const doc of docs) {
    const value = getField(doc, path);
    if (Array.isArray(value)) {
      for (const element of value) out.push(withField(doc, path, element));
    } else if (value === undefined || value === null) {
      continue;
    } else {
      out.push(doc);
    }
  }
  return out;
}

function aggregate(docs, pipeline) {
  let stream = docs.slice();
  for (const stage of pipeline) {
    const name = Object.keys(stage)[0];
    const arg = stage[name];
    if (name === '$match') {
      stream = stream.filter((d) => Object.keys(arg).every((f) => matchValue(getField(d, f), arg[f])));
    } else if (name === '$project') {
      stream = stream.map((d) => projectDoc(d, arg));
    } else if (name === '$group') {
      stream = groupDocs(stream, arg);
    } else if (name === '$sort') {
      stream = sortDocs(stream, arg);
    } else if (name === '$unwind') {
      stream = unwindDocs(stream, arg);
    } else if (name === '$limit') {
      stream = stream.slice(0, arg);
    } else if (name === '$skip') {
      stream = stream.slice(arg);
    } else {
      throw new Error('unsupported stage ' + name);
    }
  }
  return stream;
}

module.exports = { aggregate };`,
      hints: [
        'Write one helper that resolves a dotted path and one that evaluates an expression (a string starting with "$" is a field path, anything else is a literal). Every stage is built from those two.',
        '$group needs a stable key for compound _id values — JSON.stringify the evaluated _id and keep a separate array of keys to preserve first-seen order.',
        '{ $sum: 1 } is a count: the expression evaluates to the literal 1 for every document in the bucket.',
      ],
      tests: [
        {
          name: '$match with a comparison operator',
          assertion:
            "(() => { const s = [{ _id: 1, qty: 5 }, { _id: 2, qty: 3 }, { _id: 3, qty: 7 }]; return deepEqual(solution.aggregate(s, [{ $match: { qty: { $gte: 5 } } }]).map(d => d._id), [1, 3]); })()",
        },
        {
          name: '$match on a dotted path',
          assertion:
            "(() => { const s = [{ _id: 1, store: { city: 'NY' } }, { _id: 2, store: { city: 'LA' } }]; return deepEqual(solution.aggregate(s, [{ $match: { 'store.city': 'NY' } }]).map(d => d._id), [1]); })()",
        },
        {
          name: 'equality against an array means contains',
          assertion:
            "(() => { const s = [{ _id: 1, tags: ['fruit', 'red'] }, { _id: 2, tags: ['veg'] }]; return deepEqual(solution.aggregate(s, [{ $match: { tags: 'fruit' } }]).map(d => d._id), [1]); })()",
        },
        {
          name: '$group with $sum, count and $avg',
          assertion:
            "(() => { const s = [{ item: 'apple', qty: 5 }, { item: 'banana', qty: 3 }, { item: 'apple', qty: 7 }]; return deepEqual(solution.aggregate(s, [{ $group: { _id: '$item', total: { $sum: '$qty' }, n: { $sum: 1 }, avg: { $avg: '$qty' } } }]), [{ _id: 'apple', total: 12, n: 2, avg: 6 }, { _id: 'banana', total: 3, n: 1, avg: 3 }]); })()",
        },
        {
          name: '$group with a null _id gives a grand total',
          assertion:
            "(() => { const s = [{ qty: 5 }, { qty: 3 }]; return deepEqual(solution.aggregate(s, [{ $group: { _id: null, total: { $sum: '$qty' } } }]), [{ _id: null, total: 8 }]); })()",
        },
        {
          name: '$sort descending then $limit',
          assertion:
            "(() => { const s = [{ _id: 1, qty: 5 }, { _id: 2, qty: 9 }, { _id: 3, qty: 7 }]; return deepEqual(solution.aggregate(s, [{ $sort: { qty: -1 } }, { $limit: 2 }]).map(d => d._id), [2, 3]); })()",
        },
        {
          name: '$project includes, renames and drops _id',
          assertion:
            "(() => { const s = [{ _id: 1, item: 'apple', store: { city: 'NY' } }]; return deepEqual(solution.aggregate(s, [{ $project: { _id: 0, item: 1, city: '$store.city' } }]), [{ item: 'apple', city: 'NY' }]); })()",
        },
        {
          name: '$unwind expands arrays and drops empty ones',
          assertion:
            "(() => { const s = [{ _id: 1, tags: ['a', 'b'] }, { _id: 2, tags: [] }, { _id: 3, tags: ['c'] }]; const out = solution.aggregate(s, [{ $unwind: '$tags' }]); return out.length === 3 && deepEqual(out.map(d => d.tags), ['a', 'b', 'c']); })()",
        },
        {
          name: 'full pipeline: unwind, group, sort',
          assertion:
            "(() => { const s = [{ item: 'apple', tags: ['fruit', 'red'] }, { item: 'kale', tags: ['veg'] }, { item: 'cherry', tags: ['fruit'] }]; return deepEqual(solution.aggregate(s, [{ $unwind: '$tags' }, { $group: { _id: '$tags', n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }]), [{ _id: 'fruit', n: 2 }, { _id: 'red', n: 1 }, { _id: 'veg', n: 1 }]); })()",
          hidden: true,
        },
        {
          name: 'compound $group key',
          assertion:
            "(() => { const s = [{ c: 'NY', y: 2025, v: 1 }, { c: 'NY', y: 2025, v: 2 }, { c: 'NY', y: 2026, v: 4 }]; return deepEqual(solution.aggregate(s, [{ $group: { _id: { city: '$c', year: '$y' }, v: { $sum: '$v' } } }]), [{ _id: { city: 'NY', year: 2025 }, v: 3 }, { _id: { city: 'NY', year: 2026 }, v: 4 }]); })()",
          hidden: true,
        },
        {
          name: '$push and $max',
          assertion:
            "(() => { const s = [{ g: 'a', v: 1 }, { g: 'a', v: 9 }]; return deepEqual(solution.aggregate(s, [{ $group: { _id: '$g', all: { $push: '$v' }, top: { $max: '$v' } } }]), [{ _id: 'a', all: [1, 9], top: 9 }]); })()",
          hidden: true,
        },
        {
          name: 'unknown stage throws',
          assertion: "throws(() => solution.aggregate([{ a: 1 }], [{ $nope: {} }]))",
          hidden: true,
        },
      ],
      xp: 85,
    },
    {
      slug: 'consistent-hashing-ring',
      title: 'Consistent Hashing Ring with Virtual Nodes',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Cassandra and DynamoDB both place data by hashing a key onto a ring of tokens. Build the ring.

The hash is fixed so results are deterministic — it is already written for you (32-bit FNV-1a):

\`\`\`js
function hash(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
\`\`\`

**\`buildRing(nodes, vnodes = 100)\`** — for each node name, place \`vnodes\` **virtual nodes** on the ring at \`hash(node + '#' + i)\` for \`i\` from \`0\` to \`vnodes - 1\`. Return an array of \`{ hash, node }\` sorted by \`hash\` ascending, breaking ties by node name ascending.

**\`lookup(ring, key)\`** — return the node owning \`key\`: the first ring entry whose \`hash\` is \`>= hash(key)\`, **wrapping around** to \`ring[0]\` if there is none. An empty ring returns \`null\`.

**\`removeNode(ring, node)\`** — return a **new** ring without that node's virtual nodes. Do not mutate the input.

**\`distribution(ring, keys)\`** — an object mapping every node in the ring to how many of \`keys\` it owns (nodes owning nothing map to \`0\`).

Virtual nodes are the whole point: with one token per node the ring is lumpy and removing a node dumps its entire range onto a single neighbour. With 100+ tokens per node the load is even, and removing a node only moves *that node's* keys — every other key keeps its owner.`,
      starterCode: `function hash(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildRing(nodes, vnodes = 100) {
  // your code
}

function lookup(ring, key) {
  // your code
}

function removeNode(ring, node) {
  // your code
}

function distribution(ring, keys) {
  // your code
}

module.exports = { hash, buildRing, lookup, removeNode, distribution };`,
      solutionCode: `function hash(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildRing(nodes, vnodes = 100) {
  const ring = [];
  for (const node of nodes) {
    for (let i = 0; i < vnodes; i++) {
      ring.push({ hash: hash(node + '#' + i), node });
    }
  }
  ring.sort((a, b) => a.hash - b.hash || (a.node < b.node ? -1 : a.node > b.node ? 1 : 0));
  return ring;
}

function lookup(ring, key) {
  if (!ring || ring.length === 0) return null;
  const target = hash(key);

  let lo = 0;
  let hi = ring.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ring[mid].hash >= target) {
      found = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return found === -1 ? ring[0].node : ring[found].node;
}

function removeNode(ring, node) {
  return ring.filter((entry) => entry.node !== node);
}

function distribution(ring, keys) {
  const counts = {};
  for (const entry of ring) counts[entry.node] = 0;
  for (const key of keys) {
    const owner = lookup(ring, key);
    if (owner !== null) counts[owner] += 1;
  }
  return counts;
}

module.exports = { hash, buildRing, lookup, removeNode, distribution };`,
      hints: [
        'Sorting the ring once lets lookup be a binary search for the first hash >= the key hash — that is the whole data structure.',
        'The wrap-around case is when the key hashes above every token: the owner is then ring[0], because the ring is a circle.',
        'removeNode must return a new array. Array.prototype.filter already does that.',
      ],
      tests: [
        {
          name: 'ring has nodes x vnodes entries and is sorted',
          assertion:
            "(() => { const r = solution.buildRing(['a', 'b', 'c'], 10); return r.length === 30 && r.every((e, i) => i === 0 || r[i - 1].hash <= e.hash); })()",
        },
        {
          name: 'lookup returns a node in the ring and is deterministic',
          assertion:
            "(() => { const r = solution.buildRing(['a', 'b', 'c'], 50); const n1 = solution.lookup(r, 'user-42'); const n2 = solution.lookup(r, 'user-42'); return n1 === n2 && ['a', 'b', 'c'].indexOf(n1) !== -1; })()",
        },
        {
          name: 'empty ring returns null',
          assertion: "solution.lookup(solution.buildRing([], 10), 'k') === null && solution.lookup([], 'k') === null",
        },
        {
          name: 'a key hashing above every token wraps to the first entry',
          assertion:
            "(() => { const r = solution.buildRing(['a', 'b', 'c'], 30); const keys = Array.from({ length: 500 }, (_, i) => 'k' + i); const wrapped = keys.filter(k => solution.hash(k) > r[r.length - 1].hash); return wrapped.length > 0 && wrapped.every(k => solution.lookup(r, k) === r[0].node); })()",
        },
        {
          name: 'removeNode returns a new ring without that node',
          assertion:
            "(() => { const r = solution.buildRing(['a', 'b', 'c'], 10); const r2 = solution.removeNode(r, 'b'); return r.length === 30 && r2.length === 20 && r2.every(e => e.node !== 'b'); })()",
        },
        {
          name: "removing a node only moves that node's keys",
          assertion:
            "(() => { const r = solution.buildRing(['a', 'b', 'c'], 100); const keys = Array.from({ length: 300 }, (_, i) => 'key-' + i); const before = keys.map(k => solution.lookup(r, k)); const r2 = solution.removeNode(r, 'b'); const after = keys.map(k => solution.lookup(r2, k)); return keys.every((_, i) => before[i] === 'b' || before[i] === after[i]); })()",
        },
        {
          name: 'virtual nodes spread the load',
          assertion:
            "(() => { const r = solution.buildRing(['a', 'b', 'c'], 150); const keys = Array.from({ length: 3000 }, (_, i) => 'key-' + i); const d = solution.distribution(r, keys); const vals = Object.keys(d).map(k => d[k]); return vals.length === 3 && vals.reduce((s, v) => s + v, 0) === 3000 && vals.every(v => v > 600); })()",
          hidden: true,
        },
        {
          name: 'distribution reports zero for a node that owns nothing',
          assertion:
            "(() => { const r = solution.buildRing(['a', 'b'], 5); const d = solution.distribution(r, []); return d.a === 0 && d.b === 0; })()",
          hidden: true,
        },
      ],
      xp: 80,
    },
    {
      slug: 'dynamodb-query-engine',
      title: 'DynamoDB Composite-Key Query Engine',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Implement the DynamoDB query surface over an in-memory single-table design, so the cost of \`Query\` versus \`Scan\` becomes obvious.

**\`createTable(spec)\`** — \`spec\` is \`{ pk, sk, items, indexes }\` where \`pk\`/\`sk\` name the key attributes and \`indexes\` maps an index name to its own \`{ pk, sk }\`. Return \`{ pk, sk, indexes, items }\` with \`items\` **copied** and sorted by partition key then sort key ascending.

**\`query(table, params)\`** — \`params\` is \`{ indexName?, pk, sk?, scanIndexForward?, limit? }\`.

- Resolve the key schema: the base table, or \`table.indexes[indexName]\` (\`throw\` if the index is unknown).
- \`throw\` if \`pk\` is missing — DynamoDB never scans a partition key.
- Match items whose partition-key attribute equals \`pk\` **and** which actually have the sort-key attribute defined (that is what makes a GSI *sparse*).
- \`sk\` is an optional condition object with **exactly one** of \`eq\`, \`beginsWith\`, \`between\` (a two-element inclusive \`[lo, hi]\`), \`lt\`, \`lte\`, \`gt\`, \`gte\`. Anything else must \`throw\`.
- Sort ascending by sort key; reverse when \`scanIndexForward === false\`.
- Apply \`limit\` last.
- Return \`{ items, count, scannedCount }\` where \`scannedCount\` is the number of items matching the key condition **before** \`limit\`.

**\`scan(table, filter)\`** — \`filter\` is an optional object of attribute/value equality pairs applied *after* the read. Return \`{ items, count, scannedCount }\` with \`scannedCount\` equal to the total number of items in the table, however few come back. That gap is the whole lesson.

\`\`\`js
const table = createTable({
  pk: 'PK', sk: 'SK',
  indexes: { GSI1: { pk: 'GSI1PK', sk: 'GSI1SK' } },
  items: [
    { PK: 'USER#1', SK: 'PROFILE', name: 'Ada', GSI1PK: 'EMAIL', GSI1SK: 'ada@x.io' },
    { PK: 'USER#1', SK: 'ORDER#2026-01', total: 10 },
    { PK: 'USER#1', SK: 'ORDER#2026-02', total: 20 },
  ],
});

query(table, { pk: 'USER#1', sk: { beginsWith: 'ORDER#' } }).count;   // 2
scan(table, { name: 'Ada' });                                        // count 1, scannedCount 3
\`\`\``,
      starterCode: `function createTable(spec) {
  // your code
}

function query(table, params) {
  // your code
}

function scan(table, filter) {
  // your code
}

module.exports = { createTable, query, scan };`,
      solutionCode: `const SK_OPERATORS = ['eq', 'beginsWith', 'between', 'lt', 'lte', 'gt', 'gte'];

function compare(a, b) {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function createTable(spec) {
  const pk = spec.pk;
  const sk = spec.sk;
  const items = (spec.items || [])
    .slice()
    .sort((a, b) => compare(a[pk], b[pk]) || compare(a[sk], b[sk]));
  return { pk, sk, indexes: spec.indexes || {}, items };
}

function keySchema(table, indexName) {
  if (indexName === undefined || indexName === null) return { pk: table.pk, sk: table.sk };
  const index = (table.indexes || {})[indexName];
  if (!index) throw new Error('unknown index ' + indexName);
  return index;
}

function matchSortKey(value, condition) {
  if (condition === undefined || condition === null) return true;
  const ops = Object.keys(condition);
  if (ops.length !== 1 || SK_OPERATORS.indexOf(ops[0]) === -1) {
    throw new Error('sort key condition needs exactly one of ' + SK_OPERATORS.join(', '));
  }
  const op = ops[0];
  const arg = condition[op];
  if (op === 'eq') return value === arg;
  if (op === 'beginsWith') return typeof value === 'string' && value.indexOf(arg) === 0;
  if (op === 'between') return compare(value, arg[0]) >= 0 && compare(value, arg[1]) <= 0;
  if (op === 'lt') return compare(value, arg) < 0;
  if (op === 'lte') return compare(value, arg) <= 0;
  if (op === 'gt') return compare(value, arg) > 0;
  return compare(value, arg) >= 0;
}

function query(table, params) {
  const p = params || {};
  const schema = keySchema(table, p.indexName);
  if (p.pk === undefined || p.pk === null) {
    throw new Error('query requires a partition key value');
  }

  const matched = table.items.filter(
    (item) =>
      item[schema.pk] === p.pk &&
      item[schema.sk] !== undefined &&
      matchSortKey(item[schema.sk], p.sk),
  );

  matched.sort((a, b) => compare(a[schema.sk], b[schema.sk]));
  if (p.scanIndexForward === false) matched.reverse();

  const items = p.limit === undefined || p.limit === null ? matched : matched.slice(0, p.limit);
  return { items, count: items.length, scannedCount: matched.length };
}

function scan(table, filter) {
  const f = filter || {};
  const keys = Object.keys(f);
  const items = table.items.filter((item) => keys.every((k) => item[k] === f[k]));
  return { items, count: items.length, scannedCount: table.items.length };
}

module.exports = { createTable, query, scan };`,
      hints: [
        'Resolve the key schema first — every later step is identical whether you are reading the base table or a GSI, only the attribute names change.',
        'Sparse index behaviour falls straight out of requiring item[schema.sk] !== undefined before any condition is applied.',
        'scannedCount for a query is the size of the matched key range, so compute it before you slice for limit; for a scan it is always the whole table.',
      ],
      tests: [
        {
          name: 'partition-key-only query returns the whole partition, sorted',
          assertion:
            "(() => { const t = solution.createTable({ pk: 'PK', sk: 'SK', items: [{ PK: 'U#1', SK: 'ORDER#b' }, { PK: 'U#2', SK: 'PROFILE' }, { PK: 'U#1', SK: 'ORDER#a' }, { PK: 'U#1', SK: 'PROFILE' }] }); const r = solution.query(t, { pk: 'U#1' }); return r.count === 3 && deepEqual(r.items.map(i => i.SK), ['ORDER#a', 'ORDER#b', 'PROFILE']); })()",
        },
        {
          name: 'begins_with carves out one entity type',
          assertion:
            "(() => { const t = solution.createTable({ pk: 'PK', sk: 'SK', items: [{ PK: 'U#1', SK: 'PROFILE' }, { PK: 'U#1', SK: 'ORDER#1' }, { PK: 'U#1', SK: 'ORDER#2' }] }); const r = solution.query(t, { pk: 'U#1', sk: { beginsWith: 'ORDER#' } }); return r.count === 2 && r.scannedCount === 2; })()",
        },
        {
          name: 'between is inclusive on both ends',
          assertion:
            "(() => { const t = solution.createTable({ pk: 'PK', sk: 'SK', items: [{ PK: 'U#1', SK: 'ORDER#2026-01' }, { PK: 'U#1', SK: 'ORDER#2026-02' }, { PK: 'U#1', SK: 'ORDER#2026-03' }] }); const r = solution.query(t, { pk: 'U#1', sk: { between: ['ORDER#2026-01', 'ORDER#2026-02'] } }); return deepEqual(r.items.map(i => i.SK), ['ORDER#2026-01', 'ORDER#2026-02']); })()",
        },
        {
          name: 'ScanIndexForward false reverses the order',
          assertion:
            "(() => { const t = solution.createTable({ pk: 'PK', sk: 'SK', items: [{ PK: 'U#1', SK: 'a' }, { PK: 'U#1', SK: 'b' }, { PK: 'U#1', SK: 'c' }] }); const r = solution.query(t, { pk: 'U#1', scanIndexForward: false }); return deepEqual(r.items.map(i => i.SK), ['c', 'b', 'a']); })()",
        },
        {
          name: 'limit caps count but not scannedCount',
          assertion:
            "(() => { const t = solution.createTable({ pk: 'PK', sk: 'SK', items: [{ PK: 'U#1', SK: 'a' }, { PK: 'U#1', SK: 'b' }, { PK: 'U#1', SK: 'c' }] }); const r = solution.query(t, { pk: 'U#1', limit: 2 }); return r.count === 2 && r.scannedCount === 3; })()",
        },
        {
          name: 'a sparse GSI only contains items carrying its keys',
          assertion:
            "(() => { const t = solution.createTable({ pk: 'PK', sk: 'SK', indexes: { GSI1: { pk: 'GSI1PK', sk: 'GSI1SK' } }, items: [{ PK: 'U#1', SK: 'PROFILE', GSI1PK: 'EMAIL', GSI1SK: 'ada@x.io' }, { PK: 'U#1', SK: 'ORDER#1' }, { PK: 'U#2', SK: 'PROFILE', GSI1PK: 'EMAIL', GSI1SK: 'grace@x.io' }] }); const r = solution.query(t, { indexName: 'GSI1', pk: 'EMAIL' }); return r.count === 2 && r.scannedCount === 2 && deepEqual(r.items.map(i => i.GSI1SK), ['ada@x.io', 'grace@x.io']); })()",
        },
        {
          name: 'scan is billed for the whole table',
          assertion:
            "(() => { const t = solution.createTable({ pk: 'PK', sk: 'SK', items: [{ PK: 'U#1', SK: 'PROFILE', name: 'Ada' }, { PK: 'U#2', SK: 'PROFILE', name: 'Grace' }, { PK: 'U#3', SK: 'PROFILE', name: 'Alan' }] }); const r = solution.scan(t, { name: 'Ada' }); return r.count === 1 && r.scannedCount === 3; })()",
        },
        {
          name: 'a missing partition key throws',
          assertion:
            "(() => { const t = solution.createTable({ pk: 'PK', sk: 'SK', items: [{ PK: 'U#1', SK: 'a' }] }); return throws(() => solution.query(t, {})) && throws(() => solution.query(t, { indexName: 'nope', pk: 'x' })); })()",
          hidden: true,
        },
        {
          name: 'an unsupported sort key operator throws',
          assertion:
            "(() => { const t = solution.createTable({ pk: 'PK', sk: 'SK', items: [{ PK: 'U#1', SK: 'a' }] }); return throws(() => solution.query(t, { pk: 'U#1', sk: { contains: 'a' } })) && throws(() => solution.query(t, { pk: 'U#1', sk: { gt: 'a', lt: 'z' } })); })()",
          hidden: true,
        },
        {
          name: 'createTable copies and sorts without mutating the input',
          assertion:
            "(() => { const items = [{ PK: 'B', SK: '2' }, { PK: 'A', SK: '1' }]; const t = solution.createTable({ pk: 'PK', sk: 'SK', items }); return items[0].PK === 'B' && t.items !== items && deepEqual(t.items.map(i => i.PK), ['A', 'B']); })()",
          hidden: true,
        },
        {
          name: 'range operators on the sort key',
          assertion:
            "(() => { const t = solution.createTable({ pk: 'PK', sk: 'SK', items: [{ PK: 'U', SK: 'a' }, { PK: 'U', SK: 'b' }, { PK: 'U', SK: 'c' }] }); return solution.query(t, { pk: 'U', sk: { gt: 'a' } }).count === 2 && solution.query(t, { pk: 'U', sk: { lte: 'b' } }).count === 2 && solution.query(t, { pk: 'U', sk: { eq: 'c' } }).count === 1; })()",
          hidden: true,
        },
      ],
      xp: 100,
    },
  ],
  flashcards: [
    {
      front: 'What extra types does BSON add over JSON?',
      back: 'ObjectId, Date (int64 ms UTC), Decimal128, Int32/Int64/Double as distinct number types, and Binary with subtypes. Money goes in Decimal128, never a Double.',
      tags: ['mongodb', 'bson'],
    },
    {
      front: 'Embed or reference?',
      back: 'Embed for one-to-few, bounded, always-read-together data. Reference for large, shared, unbounded or independently queried data. Access pattern decides, not normal form.',
      tags: ['mongodb', 'schema'],
    },
    {
      front: 'Default `$unwind` behaviour on a missing or empty array',
      back: 'The document is dropped. Pass `preserveNullAndEmptyArrays: true` to keep it — otherwise your counts silently lose rows.',
      tags: ['mongodb', 'aggregation'],
    },
    {
      front: 'What is a covered query?',
      back: 'One answered entirely from index keys — `totalDocsExamined: 0` in explain(). Requires projecting only indexed fields, usually with `_id: 0`.',
      tags: ['mongodb', 'indexes'],
    },
    {
      front: 'Compound index prefixes',
      back: '`{a:1,b:1,c:1}` serves queries on a, a+b and a+b+c but not b alone. A separate `{a:1}` index is therefore redundant — drop it.',
      tags: ['mongodb', 'indexes'],
    },
    {
      front: 'Is Mongoose `populate()` a join?',
      back: 'No. It is a second query against the referenced collection using `$in` over the collected ids, so a page of results costs 2 queries — unless you populate inside a loop.',
      tags: ['mongodb', 'mongoose'],
    },
    {
      front: 'What does PACELC add to CAP?',
      back: 'if Partition then (Availability or Consistency) Else (Latency or Consistency). It names the trade-off you pay every day, not just during a rare partition.',
      tags: ['distributed', 'pacelc'],
    },
    {
      front: 'The quorum inequality',
      back: 'R + W > N guarantees the read and write replica sets overlap, so reads see the latest write. Separately, W > N/2 makes concurrent writes overlap each other.',
      tags: ['distributed', 'consistency'],
    },
    {
      front: 'Query-first modelling',
      back: 'List the access patterns first, then build one table per query and duplicate data freely. There is no planner and no cross-partition join to save you at read time.',
      tags: ['cassandra', 'dynamodb', 'modelling'],
    },
    {
      front: 'Partition key vs clustering column in Cassandra',
      back: 'The partition key is hashed to choose the node and must be supplied in full on every query. Clustering columns order rows inside the partition and support range scans.',
      tags: ['cassandra', 'schema'],
    },
    {
      front: 'What does ALLOW FILTERING really mean?',
      back: 'That the query has to read every partition on every node. Treat it as a design error: create a second table modelled on that query instead.',
      tags: ['cassandra', 'anti-patterns'],
    },
    {
      front: 'GSI vs LSI in DynamoDB',
      back: 'GSI: different PK and SK, own capacity, eventually consistent, addable any time, sparse. LSI: same PK, different SK, strongly consistent, must be created with the table, 10 GB per partition cap.',
      tags: ['dynamodb', 'indexes'],
    },
  ],
  resources: [
    { label: 'MongoDB Manual — Aggregation pipeline stages', url: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation-pipeline/', kind: 'DOCS' },
    { label: 'MongoDB Manual — Indexes and the ESR rule', url: 'https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/', kind: 'DOCS' },
    { label: 'Apache Cassandra — Data modelling documentation', url: 'https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/index.html', kind: 'DOCS' },
    { label: 'Amazon DynamoDB — Developer Guide', url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html', kind: 'DOCS' },
    { label: 'Abadi — Consistency Tradeoffs in Modern Distributed Database Design (PACELC)', url: 'https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf', kind: 'ARTICLE' },
  ],
};

export default day;
