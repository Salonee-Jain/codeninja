import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 26,
  week: 4,
  pillar: 'DATABASE',
  title: 'Project 4 — Caching with Redis & Memcached',
  summary: 'Put a cache in front of your API and prove the latency win with numbers.',
  estimatedMinutes: 330,
  objectives: [
    'Choose between cache-aside, read-through, write-through and write-behind for a given workload',
    'Pick the right Redis data structure instead of stuffing JSON into every key',
    'Configure TTLs and a maxmemory eviction policy that matches your access pattern',
    'Invalidate correctly on writes and defend against cache stampedes',
    'Implement Redis-backed rate limiting and session storage',
    'Explain when Memcached is the better tool than Redis',
    'Measure p50/p95/p99 latency before and after caching and report the delta',
  ],
  technologies: ['Redis', 'Memcached'],
  lessons: [
    {
      slug: 'caching-strategies',
      title: 'Caching Strategy: What, Where and How Long',
      estimatedMinutes: 70,
      body: `# Caching Strategy: What, Where and How Long

A cache is a bet: *this data will be read far more often than it changes, and a slightly stale answer is cheaper than a fresh one.* When that bet is right you turn a 40 ms database query into a 0.3 ms memory lookup. When it is wrong you serve wrong data and add a second system that can fail.

So before any code: **what are you caching, and what is your tolerance for staleness?**

## The four patterns

### 1. Cache-aside (lazy loading)

The application owns the cache. This is the pattern you will use 90% of the time.

\`\`\`js
async function getProduct(id) {
  const key = 'product:' + id;
  const cached = await redis.get(key);
  if (cached !== null) return JSON.parse(cached);        // HIT

  const row = await db.product.findUnique({ where: { id } }); // MISS
  if (row) await redis.set(key, JSON.stringify(row), { EX: 300 });
  return row;
}
\`\`\`

Properties: only requested data is ever cached, the cache can go down without taking the app with it, and each miss costs one extra round trip. The cost is that **every miss hits the database**, which is exactly the stampede problem we deal with in lesson 3.

### 2. Read-through

Same read path, but the *cache library* fetches on miss, not your handler. Your code calls \`cache.get(key)\` and the loader is registered once. Functionally identical to cache-aside — the difference is where the logic lives. It keeps handlers clean and gives you one place to add single-flight protection and metrics.

### 3. Write-through

Every write goes to the cache **and** the database synchronously, in the same request.

\`\`\`js
async function updateProduct(id, patch) {
  const row = await db.product.update({ where: { id }, data: patch });
  await redis.set('product:' + id, JSON.stringify(row), { EX: 300 });
  return row;
}
\`\`\`

The cache is never stale for that key, and reads after a write are always hits. You pay on every write, and you fill the cache with data nobody may read. Use it for hot, small, read-dominated entities (feature flags, config, user profiles).

> A subtle trap: write-through is only safe if the value you cache is exactly what the read path would produce. If the read path joins in three other tables, caching the bare row makes the next reader wrong.

### 4. Write-behind (write-back)

Write to the cache, acknowledge the client, flush to the database asynchronously in batches. Huge write throughput, and a **real risk of data loss** if the cache dies before the flush. Legitimate for counters, view counts, analytics events, last-seen timestamps. Never for money.

| Pattern | Read latency | Write latency | Staleness | Data-loss risk |
| --- | --- | --- | --- | --- |
| Cache-aside | fast after first read | unchanged | up to TTL | none |
| Read-through | same, centralised | unchanged | up to TTL | none |
| Write-through | fast, always warm | slower | ~zero for that key | none |
| Write-behind | fast | fastest | ~zero | yes |

## Choosing a TTL

The TTL is your staleness budget expressed in seconds. Work backwards from the product requirement, not from a gut feeling:

| Data | Typical TTL | Why |
| --- | --- | --- |
| Currency rates | 60 s | changes constantly, small drift acceptable |
| Product catalogue | 5–15 min | editors expect changes "soon" |
| User profile | 5 min + invalidate on write | correctness on self-edit matters |
| Auth session | 30 min sliding | matches the security policy |
| Rendered marketing page | 1 h | changes rarely |
| Bank balance | **do not cache** | must be exact |

A short TTL plus explicit invalidation on write is the combination that survives production. TTL alone means every editor sees their own change delayed. Invalidation alone means one missed code path leaves a permanently wrong value.

## Cache keys are an API

Design them deliberately: \`entity:id:variant\`.

\`\`\`text
product:1042              -> the entity
product:1042:reviews:p1   -> a related collection, page 1
search:q=laptop&sort=new  -> a derived, expensive result
user:88:cart              -> per-user state
\`\`\`

Include everything that changes the value: locale, currency, tenant, API version, and the schema version of the serialised shape. When you change the serialised shape, bump a prefix (\`v2:product:1042\`) instead of writing a migration — the old keys expire on their own.

## Measure or it did not happen

The number that matters is the **hit ratio**: \`hits / (hits + misses)\`. Below ~80% you are usually paying the cache tax without the benefit — either your TTL is too short, your key space is too fragmented, or you are caching things nobody re-reads.

\`\`\`bash
redis-cli info stats | grep keyspace
# keyspace_hits:918233
# keyspace_misses:41022     -> 95.7% hit ratio
\`\`\`

Track four things from day one: hit ratio, p95 latency with and without the cache, evicted key count, and memory used vs \`maxmemory\`. Everything else in this day is a technique; these numbers are how you know a technique worked.`,
    },
    {
      slug: 'redis-data-structures',
      title: 'Redis Data Structures and What They Are Actually For',
      estimatedMinutes: 80,
      body: `# Redis Data Structures and What They Are Actually For

Most teams use Redis as a hash map of strings to JSON blobs. That works, and it wastes most of what Redis is. Redis is a **data-structure server**: the operations run next to the data, so a leaderboard update is one atomic \`O(log n)\` command instead of read-modify-write over the network.

## Strings

The workhorse. A string can hold up to 512 MB, but you will normally store a serialised object or a counter.

\`\`\`bash
SET product:1042 '{"id":1042,"name":"Keyboard"}' EX 300
GET product:1042
SET lock:job:9 worker-3 NX EX 30      # NX = only if absent -> a lock
INCR page:home:views                  # atomic counter, no race
INCRBY user:88:credits -5
SETRANGE / GETRANGE                   # byte-level edits
\`\`\`

\`INCR\` on a missing key starts from 0, which is why counters need no initialisation. \`SET ... NX EX\` is the primitive behind every distributed lock you will write today.

## Hashes

A map inside a key. Use it when you want to read or update **one field** of an object without deserialising the whole thing.

\`\`\`bash
HSET user:88 name "Ada" plan pro credits 120
HGET user:88 plan            # -> "pro"
HINCRBY user:88 credits -5   # atomic field increment
HGETALL user:88
\`\`\`

Hashes with few, small fields are stored in a compact listpack encoding — thousands of small hashes use dramatically less memory than the same data as JSON strings. Check with \`OBJECT ENCODING user:88\`.

> Gotcha: TTL lives on the **key**, not the field. You cannot expire \`user:88 credits\` alone (hash-field TTLs exist only from Redis 7.4 via \`HEXPIRE\`, and are not available on many managed offerings).

## Lists

A linked list. Push and pop at either end in \`O(1)\`.

\`\`\`bash
LPUSH feed:88 "post:551"
LTRIM feed:88 0 99           # keep only the newest 100 -> bounded memory
LRANGE feed:88 0 9           # newest 10
BRPOP queue:emails 5         # blocking pop, 5s timeout -> a simple work queue
\`\`\`

\`LPUSH\` + \`LTRIM\` is the canonical "recent activity" feed. \`BRPOP\` gives you a job queue in one line — but it is at-most-once: if the worker crashes after popping, the job is gone. Use Streams when that matters.

## Sets

Unordered, unique members. Membership tests and set algebra in the server.

\`\`\`bash
SADD post:551:likes 88 91 104
SISMEMBER post:551:likes 88     # O(1) "did this user like it?"
SCARD post:551:likes            # like count
SINTER user:88:follows user:91:follows   # mutual follows
\`\`\`

## Sorted sets (ZSET)

Every member has a score; the set stays ordered by it. This is the single most useful Redis structure and the one people reach for last.

\`\`\`bash
ZADD leaderboard 1500 ada 1320 grace 1780 linus
ZREVRANGE leaderboard 0 9 WITHSCORES   # top 10
ZINCRBY leaderboard 50 ada             # atomic score bump
ZREVRANK leaderboard ada               # this player's rank, O(log n)
ZRANGEBYSCORE events 1735689600 +inf   # time-range query
\`\`\`

Sorted sets are also how you build a **sliding-window rate limiter** (score = timestamp, \`ZREMRANGEBYSCORE\` to drop the old window, \`ZCARD\` to count) and a **delayed job queue** (score = run-at time).

## Streams

An append-only log with consumer groups — Kafka's model in miniature.

\`\`\`bash
XADD orders '*' id 991 total 42.50
XGROUP CREATE orders billing 0
XREADGROUP GROUP billing worker-1 COUNT 10 STREAMS orders '>'
XACK orders billing 1735689600000-0
\`\`\`

Unlike \`BRPOP\`, an unacknowledged entry stays in the consumer group's pending list, so a crashed worker's message can be claimed by another (\`XAUTOCLAIM\`). That is the difference between at-most-once and at-least-once delivery.

## HyperLogLog

A probabilistic cardinality estimator: count unique items in **12 KB regardless of volume**, with ~0.81% standard error.

\`\`\`bash
PFADD visitors:2026-08-05 user:88 user:91 user:104
PFCOUNT visitors:2026-08-05                 # ~unique visitors
PFMERGE visitors:week visitors:2026-08-05 visitors:2026-08-04
\`\`\`

Counting 50 million unique daily visitors in a Set costs gigabytes. In a HyperLogLog it costs 12 KB. You trade exactness for a rounding error nobody in a dashboard will notice.

## Bitmaps

Strings addressed bit by bit — perfect for dense per-user booleans.

\`\`\`bash
SETBIT active:2026-08-05 88 1
BITCOUNT active:2026-08-05          # daily active users
BITOP AND active:both active:2026-08-05 active:2026-08-04
\`\`\`

## Choosing

| You need | Use |
| --- | --- |
| A cached object read whole | String (JSON) |
| Partial object updates | Hash |
| Recent-N feed / simple queue | List (+ \`LTRIM\`) |
| Tags, membership, mutual friends | Set |
| Leaderboard, rate limit, delayed jobs | Sorted set |
| Durable event log with retries | Stream |
| Unique visitors at scale | HyperLogLog |
| Per-user daily flags | Bitmap |

Everything above is atomic and single-threaded on the server, so no two clients can interleave a read-modify-write. That property — not raw speed — is why Redis replaces so much application code.`,
    },
    {
      slug: 'ttl-eviction-invalidation',
      title: 'TTL, Eviction, Invalidation and Stampedes',
      estimatedMinutes: 80,
      body: `# TTL, Eviction, Invalidation and Stampedes

Two hard problems live here: deciding when data leaves the cache, and surviving the moment it does.

## Expiry is lazy plus sampled

\`\`\`bash
SET session:abc "…" EX 1800     # seconds
SET otp:88 "421990" PX 60000    # milliseconds
TTL session:abc                 # -> 1789 ; -1 = no TTL ; -2 = key gone
PERSIST session:abc             # remove the TTL
EXPIRE session:abc 1800 XX      # only if a TTL already exists (Redis 7+)
\`\`\`

Redis does **not** run a timer per key. It removes expired keys two ways: lazily, when something touches the key, and actively, by sampling 20 random keys with a TTL ~10 times a second and deleting the expired ones — repeating while more than 25% of the sample was expired. Consequence: an expired key that nobody reads can occupy memory for a while. That is fine for correctness (a read never returns an expired value) but matters for capacity planning.

> Any write that does not carry an expiry **removes** the TTL. \`SET key v\` on a key with 300 s left leaves it immortal. Use \`SET key v KEEPTTL\`, or always re-set the TTL.

## Eviction policies

When \`maxmemory\` is reached, the policy decides who dies.

\`\`\`ini
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
maxmemory-samples 5
\`\`\`

| Policy | Candidate pool | Picks |
| --- | --- | --- |
| \`noeviction\` | — | nothing; writes fail with OOM |
| \`allkeys-lru\` | every key | least recently used |
| \`allkeys-lfu\` | every key | least frequently used |
| \`allkeys-random\` | every key | random |
| \`volatile-lru\` | keys with a TTL | least recently used |
| \`volatile-lfu\` | keys with a TTL | least frequently used |
| \`volatile-ttl\` | keys with a TTL | shortest remaining TTL |
| \`volatile-random\` | keys with a TTL | random |

Rules of thumb:

- **Pure cache** → \`allkeys-lru\`, or \`allkeys-lfu\` when a small set of keys is hot forever and LRU keeps flushing them for one-off scans.
- **Mixed store** (sessions and cache in one instance) → \`volatile-*\`, and make sure every disposable key has a TTL. A \`volatile-*\` policy with no expirable keys behaves like \`noeviction\` and your writes start failing.
- **Source of truth** (queues, locks) → \`noeviction\`, and alarm on memory.

Redis's LRU and LFU are **approximate** — it samples \`maxmemory-samples\` keys and evicts the best candidate from the sample. Raising the sample to 10 gets close to true LRU at a small CPU cost.

## Invalidation on write

TTL bounds staleness; invalidation removes it.

\`\`\`js
async function updateProduct(id, patch) {
  const row = await db.product.update({ where: { id }, data: patch });
  await redis.del('product:' + id);              // simple, correct
  await redis.del('product:' + id + ':reviews'); // derived keys too
  return row;
}
\`\`\`

Delete rather than overwrite when the cached shape is derived — a delete is idempotent and cannot store a wrong value. For fan-out (one write invalidating many keys) keep an index set:

\`\`\`js
// on write of the cached value
await redis.sAdd('idx:product:' + id, key);
// on invalidation
const keys = await redis.sMembers('idx:product:' + id);
if (keys.length) await redis.del(keys);
await redis.del('idx:product:' + id);
\`\`\`

Never use \`KEYS product:*\` in production — it is \`O(n)\` over the whole keyspace and blocks the single-threaded server. Use \`SCAN\` with a cursor, or an index set.

## The stampede

A popular key expires. Two hundred concurrent requests miss simultaneously, all two hundred query the database, and the database falls over. This is *cache stampede*, also called dog-piling. Three defences, best used together.

### 1. Jitter the TTL

If you cache 10 000 keys during a deploy with \`EX 300\`, all 10 000 expire in the same second. Randomise:

\`\`\`js
const ttl = 300 + Math.floor(Math.random() * 60); // 300-359s
await redis.set(key, value, { EX: ttl });
\`\`\`

### 2. Single-flight (in-process coalescing)

Within one Node process, only the first miss should call the loader; the rest await the same promise.

\`\`\`js
const inflight = new Map();
function singleFlight(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
\`\`\`

This removes the stampede within a process for free. Across processes you need a lock.

### 3. A distributed lock

\`\`\`js
async function getWithLock(key, loader, ttl = 300) {
  const hit = await redis.get(key);
  if (hit !== null) return JSON.parse(hit);

  const token = crypto.randomUUID();
  const gotLock = await redis.set('lock:' + key, token, { NX: true, PX: 5000 });
  if (!gotLock) {
    await new Promise((r) => setTimeout(r, 50));  // brief backoff
    return getWithLock(key, loader, ttl);         // then re-read the cache
  }
  try {
    const value = await loader();
    await redis.set(key, JSON.stringify(value), { EX: ttl + Math.floor(Math.random() * 30) });
    return value;
  } finally {
    // release only if we still own it
    await redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      { keys: ['lock:' + key], arguments: [token] },
    );
  }
}
\`\`\`

The token check in the release script is not optional: without it, a slow holder whose lock already expired will delete a lock that now belongs to somebody else.

### 4. Early recomputation

Best of all, never let the key expire under load. Store the value with a logical expiry *before* the physical TTL and let a request that arrives in the danger zone refresh it in the background while still serving the old value:

\`\`\`js
const { value, softExpiresAt } = JSON.parse(await redis.get(key));
if (Date.now() > softExpiresAt) void refreshInBackground(key); // don't await
return value;                                                  // stale-while-revalidate
\`\`\`

The probabilistic variant (XFetch) refreshes with probability rising as the soft expiry approaches, which spreads the refresh across requests instead of racing on the first one past the line.`,
    },
    {
      slug: 'redis-ops-and-memcached',
      title: 'Persistence, Pub/Sub, Rate Limiting, Sessions and Memcached',
      estimatedMinutes: 70,
      body: `# Persistence, Pub/Sub, Rate Limiting, Sessions and Memcached

## Persistence: RDB, AOF, or neither

Redis is in-memory, but it can survive a restart.

**RDB (snapshot)** — a point-in-time fork-and-dump of the dataset.

\`\`\`ini
save 900 1      # after 900s if >=1 key changed
save 300 10
save 60 10000
dbfilename dump.rdb
\`\`\`

Compact, fast to load, cheap to back up — and you lose everything written since the last snapshot.

**AOF (append-only file)** — every write command is appended to a log and replayed on start.

\`\`\`ini
appendonly yes
appendfsync everysec   # always | everysec | no
auto-aof-rewrite-percentage 100
\`\`\`

\`appendfsync everysec\` is the practical setting: at most one second of writes lost, minimal throughput cost. \`always\` fsyncs per command — durable and slow. The AOF grows, so Redis periodically rewrites it into the shortest command sequence that reproduces the dataset.

| | RDB | AOF |
| --- | --- | --- |
| Durability | minutes | ≤1 s with \`everysec\` |
| Restart speed | fast | slower (replay) |
| File size | small | larger |
| Fork cost | one big fork | rewrite fork |

Modern default: **both** (\`aof-use-rdb-preamble yes\` writes an RDB header followed by an AOF tail). For a *pure cache*, turn both off — persistence buys you nothing when the data can be rebuilt from the database, and it costs you fork latency spikes.

> \`fork()\` on a 20 GB instance can stall the event loop for hundreds of milliseconds. If you see periodic p99 spikes at exactly your snapshot interval, that is why.

## Pub/Sub

Fire-and-forget fan-out. Subscribers receive only what is published while they are connected — there is no history and no acknowledgement.

\`\`\`js
const sub = redis.duplicate();      // a subscriber connection cannot run other commands
await sub.connect();
await sub.subscribe('cache:invalidate', (message) => {
  localCache.delete(message);       // drop the in-process L1 copy
});

await redis.publish('cache:invalidate', 'product:1042');
\`\`\`

The classic use is exactly that: invalidating a per-process in-memory L1 cache across a fleet. If you need delivery guarantees or replay, use Streams instead.

## Rate limiting

Fixed-window is one command but allows a 2x burst across the boundary:

\`\`\`js
const key = 'rl:' + ip + ':' + Math.floor(Date.now() / 60000);
const n = await redis.incr(key);
if (n === 1) await redis.expire(key, 60);
if (n > 100) throw new TooManyRequests();
\`\`\`

Sliding-window log with a sorted set is exact, and atomic when done in Lua:

\`\`\`lua
-- KEYS[1]=key  ARGV[1]=now_ms  ARGV[2]=window_ms  ARGV[3]=limit
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1] - ARGV[2])
local used = redis.call('ZCARD', KEYS[1])
if used >= tonumber(ARGV[3]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[1] .. '-' .. math.random())
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1
\`\`\`

Running it as a script means the check and the write cannot interleave with another client. Token-bucket sits in between: cheaper than a log, and it allows a controlled burst.

## Sessions

\`\`\`js
import session from 'express-session';
import { RedisStore } from 'connect-redis';

app.use(session({
  store: new RedisStore({ client: redis, prefix: 'sess:', ttl: 1800 }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 1800000 },
}));
\`\`\`

Server-side sessions in Redis give you what a JWT cannot: **instant revocation**. Deleting \`sess:<id>\` logs the user out everywhere, immediately. The cost is a Redis lookup per request — 0.2 ms, and it makes your API stateless across instances anyway.

> Set the eviction policy carefully on a shared instance. \`allkeys-lru\` can evict a live session under memory pressure and log users out at random. Either isolate sessions on their own instance or use \`volatile-lru\` and give every cache key a TTL.

## Redis vs Memcached

| | Redis | Memcached |
| --- | --- | --- |
| Data model | strings, hashes, lists, sets, zsets, streams, HLL, bitmaps | opaque strings only |
| Threading | single-threaded core (I/O threads optional) | multi-threaded |
| Persistence | RDB + AOF | none |
| Replication / HA | replicas, Sentinel, Cluster | none built in (client-side sharding) |
| Eviction | 8 configurable policies | LRU within slab classes |
| Max value | 512 MB | 1 MB by default |
| Pub/Sub, scripting, transactions | yes | no |
| Memory model | jemalloc, fragmentation-sensitive | slab allocator, near-zero fragmentation |

\`\`\`bash
# Memcached is deliberately tiny
telnet localhost 11211
set greeting 0 300 5
hello
STORED
get greeting
\`\`\`

Choose **Memcached** when you want a large, dumb, multi-threaded look-aside cache of similarly sized blobs and nothing else — its slab allocator makes memory use extremely predictable and it scales across cores without configuration. Choose **Redis** for anything that needs a data structure, atomicity, persistence, replication or pub/sub — which, in practice, is most applications. Starting on Redis and never needing Memcached is a perfectly normal career.`,
    },
  ],
  quiz: [
    {
      prompt: 'Which caching pattern acknowledges the client before the data reaches the database?',
      options: ['Cache-aside', 'Read-through', 'Write-through', 'Write-behind'],
      correctIndex: 3,
      explanation:
        'Write-behind (write-back) writes to the cache, returns, and flushes to the database asynchronously. That is why it has the highest write throughput and the only real data-loss risk of the four.',
      difficulty: 'EASY',
    },
    {
      prompt: 'You run `SET product:9 "{...}"` on a key that had 200 seconds of TTL remaining. What happens to the TTL?',
      options: [
        'It is removed — the key now lives forever',
        'It is preserved automatically',
        'It resets to the default TTL from redis.conf',
        'The command fails because the key already has a TTL',
      ],
      correctIndex: 0,
      explanation:
        'A plain SET replaces the value *and* clears any associated expiry. Use `SET key value KEEPTTL`, or always pass EX/PX again. This is one of the most common sources of "why is my cache never refreshing".',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Your Redis instance stores both sessions (no TTL) and cache entries (with TTL) and is configured `maxmemory-policy volatile-lru`. Memory fills up. What happens?',
      options: [
        'Sessions are evicted first because they are oldest',
        'Cache entries are evicted, and once none are left writes start failing with OOM',
        'Redis falls back to allkeys-lru automatically',
        'Redis flushes the whole database',
      ],
      correctIndex: 1,
      explanation:
        'A `volatile-*` policy only considers keys that have an expiry. Sessions without a TTL are never candidates, so once the expirable keys are gone Redis behaves like `noeviction` and rejects writes with an OOM error.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Which Redis structure gives you a leaderboard rank in O(log n) and doubles as a sliding-window rate limiter?',
      options: ['Hash', 'Sorted set', 'List', 'HyperLogLog'],
      correctIndex: 1,
      explanation:
        'A sorted set keeps members ordered by score. `ZREVRANK` gives rank in O(log n); using the timestamp as the score plus `ZREMRANGEBYSCORE`/`ZCARD` gives an exact sliding window.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Why does a distributed lock release use a Lua script comparing a token instead of a plain `DEL`?',
      options: [
        'Lua scripts are faster than DEL',
        'DEL cannot operate on keys with a TTL',
        'Because a holder whose lock already expired would otherwise delete a lock now owned by another client',
        'Because DEL is not replicated to replicas',
      ],
      correctIndex: 2,
      explanation:
        'If the loader takes longer than the lock PX, the lock expires and another worker acquires it. A blind DEL from the first worker would free somebody else’s lock. Compare-and-delete in a single script makes release atomic and owner-safe.',
      difficulty: 'HARD',
    },
    {
      prompt: 'You deploy and warm 20 000 cache keys with `EX 600`. Ten minutes later the database CPU spikes to 100%. What is the fix?',
      options: [
        'Switch the eviction policy to allkeys-lfu',
        'Add random jitter to each TTL so keys do not all expire in the same second',
        'Increase maxmemory',
        'Enable AOF persistence',
      ],
      correctIndex: 1,
      explanation:
        'Uniform TTLs set at the same moment expire at the same moment, producing a synchronised stampede. Jitter (`600 + rand(0..60)`) spreads expiry; single-flight and early recomputation harden it further.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What does `PFCOUNT` on a HyperLogLog return?',
      options: [
        'The exact number of members, like SCARD',
        'The number of bytes used by the key',
        'An approximate distinct count with roughly 0.81% standard error, in ~12 KB',
        'The number of times PFADD was called',
      ],
      correctIndex: 2,
      explanation:
        'HyperLogLog trades exactness for space: it estimates cardinality with ~0.81% standard error using about 12 KB regardless of how many distinct items were added. Ideal for unique-visitor counts, wrong for billing.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which statement about Memcached versus Redis is correct?',
      options: [
        'Memcached is multi-threaded and stores opaque values with no persistence or replication',
        'Memcached supports sorted sets but not hashes',
        'Redis is multi-threaded for command execution while Memcached is single-threaded',
        'Memcached values may be up to 512 MB by default',
      ],
      correctIndex: 0,
      explanation:
        'Memcached is a multi-threaded, slab-allocating, look-aside cache of opaque blobs (1 MB default limit) with no persistence, replication or data structures. Redis executes commands on a single thread but offers data structures, persistence, replication and scripting.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'lru-cache-with-ttl',
      title: 'LRU Cache with TTL',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Build the in-process L1 cache that sits in front of Redis: a bounded LRU with per-entry expiry.

Export \`createCache({ capacity, ttlMs, now })\`:

- \`now\` is an injectable clock returning milliseconds; it defaults to \`() => Date.now()\`. Tests inject a fake clock, so **never call \`Date.now()\` directly**.
- \`get(key)\` — returns the value, or \`undefined\` if missing or expired. A successful get makes the key the **most recently used**.
- \`set(key, value, ttlOverrideMs?)\` — stores the value with \`expiresAt = now() + (ttlOverrideMs ?? ttlMs)\`. Re-setting an existing key also refreshes recency. When the map exceeds \`capacity\`, drop expired entries first, then evict least-recently-used entries until the size fits.
- \`delete(key)\` — returns \`true\` if a key was removed.
- \`keys()\` — live (non-expired) keys, least-recently-used first.
- \`stats()\` — \`{ hits, misses, evictions, expirations, size }\`.

An entry is expired when \`expiresAt <= now()\`. Throw if \`capacity\` is not an integer >= 1.

\`\`\`js
let t = 0;
const c = createCache({ capacity: 2, ttlMs: 100, now: () => t });
c.set('a', 1); c.set('b', 2);
c.get('a');            // 1        -> 'a' is now most recent
c.set('c', 3);         // evicts 'b'
c.keys();              // ['a', 'c']
t = 100;
c.get('a');            // undefined (expired)
\`\`\`

A \`Map\` preserves insertion order, so \`delete\` + \`set\` is a one-line "move to most recent".`,
      starterCode: `function createCache({ capacity, ttlMs, now = () => Date.now() }) {
  // A Map iterates in insertion order: the first key is the least recently used.
  const map = new Map(); // key -> { value, expiresAt }

  return {
    get(key) {},
    set(key, value, ttlOverrideMs) {},
    delete(key) {},
    keys() {},
    stats() {},
  };
}

module.exports = { createCache };`,
      solutionCode: `function createCache({ capacity, ttlMs, now = () => Date.now() }) {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error('capacity must be an integer >= 1');
  }
  const map = new Map();
  let hits = 0;
  let misses = 0;
  let evictions = 0;
  let expirations = 0;

  function sweep() {
    const t = now();
    for (const [k, e] of map) {
      if (e.expiresAt <= t) {
        map.delete(k);
        expirations++;
      }
    }
  }

  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) {
        misses++;
        return undefined;
      }
      if (entry.expiresAt <= now()) {
        map.delete(key);
        expirations++;
        misses++;
        return undefined;
      }
      map.delete(key);
      map.set(key, entry); // move to most-recently-used
      hits++;
      return entry.value;
    },

    set(key, value, ttlOverrideMs) {
      map.delete(key);
      const ttl = ttlOverrideMs === undefined ? ttlMs : ttlOverrideMs;
      map.set(key, { value, expiresAt: now() + ttl });
      if (map.size > capacity) sweep();
      while (map.size > capacity) {
        map.delete(map.keys().next().value);
        evictions++;
      }
      return value;
    },

    delete(key) {
      return map.delete(key);
    },

    keys() {
      sweep();
      return Array.from(map.keys());
    },

    stats() {
      sweep();
      return { hits, misses, evictions, expirations, size: map.size };
    },
  };
}

module.exports = { createCache };`,
      hints: [
        'Map iteration order is insertion order, so `map.keys().next().value` is the least recently used key.',
        'To mark a key as most recently used: `map.delete(key)` then `map.set(key, entry)`.',
        'Expiry is `expiresAt <= now()` — an entry that expires exactly now is gone.',
        'Sweep expired entries before evicting, otherwise you evict a live key to make room for a dead one.',
      ],
      tests: [
        {
          name: 'stores and returns a value',
          assertion:
            "(() => { const c = solution.createCache({ capacity: 2, ttlMs: 1000, now: () => 0 }); c.set('a', 1); return c.get('a') === 1; })()",
        },
        {
          name: 'missing key returns undefined and counts a miss',
          assertion:
            "(() => { const c = solution.createCache({ capacity: 2, ttlMs: 1000, now: () => 0 }); return c.get('nope') === undefined && c.stats().misses === 1; })()",
        },
        {
          name: 'evicts the least recently used key',
          assertion:
            "(() => { const c = solution.createCache({ capacity: 2, ttlMs: 1000, now: () => 0 }); c.set('a',1); c.set('b',2); c.get('a'); c.set('c',3); return deepEqual(c.keys(), ['a','c']); })()",
        },
        {
          name: 'entries expire on the injected clock',
          assertion:
            "(() => { let t = 0; const c = solution.createCache({ capacity: 3, ttlMs: 100, now: () => t }); c.set('a',1); t = 100; return c.get('a') === undefined; })()",
        },
        {
          name: 'per-entry ttl override is honoured',
          assertion:
            "(() => { let t = 0; const c = solution.createCache({ capacity: 3, ttlMs: 1000, now: () => t }); c.set('x',1,10); c.set('y',2); t = 20; return c.get('x') === undefined && c.get('y') === 2; })()",
        },
        {
          name: 'stats report hits, misses and evictions',
          assertion:
            "(() => { const c = solution.createCache({ capacity: 1, ttlMs: 1000, now: () => 0 }); c.set('a',1); c.set('b',2); c.get('b'); c.get('a'); const s = c.stats(); return s.hits === 1 && s.misses === 1 && s.evictions === 1 && s.size === 1; })()",
          hidden: true,
        },
        {
          name: 'delete removes a key',
          assertion:
            "(() => { const c = solution.createCache({ capacity: 2, ttlMs: 1000, now: () => 0 }); c.set('a',1); return c.delete('a') === true && c.delete('a') === false && c.get('a') === undefined; })()",
          hidden: true,
        },
        {
          name: 'rejects an invalid capacity',
          assertion:
            "throws(() => solution.createCache({ capacity: 0, ttlMs: 1000, now: () => 0 }))",
          hidden: true,
        },
      ],
      xp: 60,
    },
    {
      slug: 'cache-aside-single-flight',
      title: 'Cache-Aside with Single-Flight Stampede Protection',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `A popular key expires and 200 concurrent requests miss at once. Every one of them calls the database. Fix it with **single-flight**: the first miss runs the loader, everyone else awaits the same promise.

Export \`createCachedLoader(loader, { ttlMs, now })\`:

- \`get(key)\` — async.
  1. Fresh cache entry (\`expiresAt > now()\`) → return the value, count a **hit**.
  2. A load for this key is already in flight → return that same promise, count a **coalesced** call. Do *not* call the loader again.
  3. Otherwise count a **miss**, call \`loader(key)\`, cache the resolved value with \`expiresAt = now() + ttlMs\`, and return it.
- A rejected load must **not** be cached, must reject every waiter, and must clear the in-flight entry so the next call retries.
- \`invalidate(key)\` — drop the cached entry (returns \`true\`).
- \`set(key, value)\` — write-through: store the value with a fresh expiry.
- \`stats()\` — \`{ hits, misses, coalesced, size, inflight }\`.

Defaults: \`ttlMs = 60000\`, \`now = () => Date.now()\`.

\`\`\`js
let calls = 0;
const c = createCachedLoader(async (k) => { calls++; return 'v:' + k; });
await Promise.all([c.get('a'), c.get('a'), c.get('a')]);
calls; // 1  -- three requests, one database query
\`\`\`

> The loader may be synchronous or asynchronous. Wrap it so both behave identically.`,
      starterCode: `function createCachedLoader(loader, { ttlMs = 60000, now = () => Date.now() } = {}) {
  const cache = new Map();    // key -> { value, expiresAt }
  const inflight = new Map(); // key -> Promise

  return {
    async get(key) {},
    invalidate(key) {},
    set(key, value) {},
    stats() {},
  };
}

module.exports = { createCachedLoader };`,
      solutionCode: `function createCachedLoader(loader, { ttlMs = 60000, now = () => Date.now() } = {}) {
  const cache = new Map();
  const inflight = new Map();
  let hits = 0;
  let misses = 0;
  let coalesced = 0;

  return {
    async get(key) {
      const entry = cache.get(key);
      if (entry && entry.expiresAt > now()) {
        hits++;
        return entry.value;
      }
      if (entry) cache.delete(key); // stale

      const pending = inflight.get(key);
      if (pending) {
        coalesced++;
        return pending;
      }

      misses++;
      const p = (async () => loader(key))()
        .then((value) => {
          cache.set(key, { value, expiresAt: now() + ttlMs });
          return value;
        })
        .finally(() => {
          inflight.delete(key);
        });

      inflight.set(key, p);
      return p;
    },

    invalidate(key) {
      cache.delete(key);
      return true;
    },

    set(key, value) {
      cache.set(key, { value, expiresAt: now() + ttlMs });
      return value;
    },

    stats() {
      return { hits, misses, coalesced, size: cache.size, inflight: inflight.size };
    },
  };
}

module.exports = { createCachedLoader };`,
      hints: [
        'Wrap the loader in `(async () => loader(key))()` so a synchronous loader still produces a promise.',
        'Store the promise in the in-flight map *before* awaiting it — otherwise the second caller arrives before it exists.',
        'Use `.finally()` to delete the in-flight entry so both success and failure clean up.',
        'Cache the value inside `.then()`, never in `.finally()`, or you will cache rejections.',
      ],
      tests: [
        {
          name: 'caches a loaded value',
          assertion:
            "await (async () => { let n = 0; const c = solution.createCachedLoader(async (k) => { n++; return 'v:' + k; }, { ttlMs: 1000 }); const a = await c.get('a'); const b = await c.get('a'); return a === 'v:a' && b === 'v:a' && n === 1; })()",
        },
        {
          name: 'concurrent misses coalesce into one loader call',
          assertion:
            "await (async () => { let n = 0; const c = solution.createCachedLoader(async (k) => { n++; await new Promise((r) => setTimeout(r, 5)); return 'v:' + k; }, { ttlMs: 1000 }); const rs = await Promise.all([c.get('a'), c.get('a'), c.get('a'), c.get('a')]); return n === 1 && rs.every((v) => v === 'v:a'); })()",
        },
        {
          name: 'different keys load independently',
          assertion:
            "await (async () => { let n = 0; const c = solution.createCachedLoader(async (k) => { n++; return k; }, { ttlMs: 1000 }); await Promise.all([c.get('a'), c.get('b')]); return n === 2; })()",
        },
        {
          name: 'entries expire on the injected clock',
          assertion:
            "await (async () => { let t = 0; let n = 0; const c = solution.createCachedLoader(async () => ++n, { ttlMs: 100, now: () => t }); const a = await c.get('k'); t = 100; const b = await c.get('k'); return a === 1 && b === 2; })()",
        },
        {
          name: 'invalidate forces a reload',
          assertion:
            "await (async () => { let n = 0; const c = solution.createCachedLoader(async () => ++n, { ttlMs: 10000 }); await c.get('k'); c.invalidate('k'); const v = await c.get('k'); return v === 2; })()",
        },
        {
          name: 'a rejected load is not cached and waiters all reject',
          assertion:
            "await (async () => { let n = 0; const c = solution.createCachedLoader(async () => { n++; throw new Error('boom'); }, { ttlMs: 1000 }); const rs = await Promise.all([c.get('x').catch((e) => e.message), c.get('x').catch((e) => e.message)]); const again = await c.get('x').catch((e) => e.message); return n === 2 && rs[0] === 'boom' && rs[1] === 'boom' && again === 'boom' && c.stats().size === 0; })()",
          hidden: true,
        },
        {
          name: 'stats track hits, misses and coalesced calls',
          assertion:
            "await (async () => { const c = solution.createCachedLoader(async (k) => k, { ttlMs: 10000 }); await Promise.all([c.get('a'), c.get('a'), c.get('a')]); await c.get('a'); const s = c.stats(); return s.misses === 1 && s.coalesced === 2 && s.hits === 1 && s.inflight === 0; })()",
          hidden: true,
        },
        {
          name: 'set writes through without calling the loader',
          assertion:
            "await (async () => { let n = 0; const c = solution.createCachedLoader(async () => { n++; return 'loaded'; }, { ttlMs: 10000 }); c.set('k', 'written'); const v = await c.get('k'); return v === 'written' && n === 0; })()",
          hidden: true,
        },
      ],
      xp: 90,
    },
    {
      slug: 'sliding-window-rate-limiter',
      title: 'Sliding-Window Rate Limiter',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Reimplement the Redis sorted-set rate limiter in memory. Each key holds a sorted log of hit timestamps; entries older than the window are dropped before every decision.

Export \`createRateLimiter({ limit, windowMs })\`:

- \`hit(key, nowMs)\` — trim the log to entries with timestamp **> \`nowMs - windowMs\`**, then:
  - if the surviving count is \`>= limit\` → \`{ allowed: false, remaining: 0, retryAfterMs, used }\` where \`retryAfterMs\` is how long until the **oldest** surviving entry leaves the window, i.e. \`oldest + windowMs - nowMs\`;
  - otherwise append \`nowMs\` and return \`{ allowed: true, remaining: limit - used, retryAfterMs: 0, used }\` where \`used\` is the count **including** this hit.
- \`peek(key, nowMs)\` — trim and return \`{ remaining, used }\` without consuming.
- \`reset(key)\` — drop the log, returning \`true\` if there was one.
- Keys are independent. Throw if \`limit\` or \`windowMs\` is not positive.

\`\`\`js
const rl = createRateLimiter({ limit: 3, windowMs: 1000 });
rl.hit('ip', 0);    // { allowed: true,  remaining: 2, retryAfterMs: 0,   used: 1 }
rl.hit('ip', 1);    // { allowed: true,  remaining: 1, ... }
rl.hit('ip', 2);    // { allowed: true,  remaining: 0, ... }
rl.hit('ip', 3);    // { allowed: false, remaining: 0, retryAfterMs: 997, used: 3 }
rl.hit('ip', 1000); // allowed again — the entry at t=0 has left the window
\`\`\`

An entry at time \`t\` counts while \`t > nowMs - windowMs\`; at exactly \`nowMs = t + windowMs\` it is gone. Timestamps are appended in non-decreasing order, so trimming is a walk from the front.`,
      starterCode: `function createRateLimiter({ limit, windowMs }) {
  const log = new Map(); // key -> number[] (ascending timestamps)

  return {
    hit(key, nowMs) {},
    peek(key, nowMs) {},
    reset(key) {},
  };
}

module.exports = { createRateLimiter };`,
      solutionCode: `function createRateLimiter({ limit, windowMs }) {
  if (!(limit > 0) || !(windowMs > 0)) {
    throw new Error('limit and windowMs must be positive');
  }
  const log = new Map();

  function live(key, nowMs) {
    const arr = log.get(key) || [];
    const cutoff = nowMs - windowMs;
    let i = 0;
    while (i < arr.length && arr[i] <= cutoff) i++;
    const kept = i === 0 ? arr : arr.slice(i);
    log.set(key, kept);
    return kept;
  }

  return {
    hit(key, nowMs) {
      const kept = live(key, nowMs);
      if (kept.length >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: kept[0] + windowMs - nowMs,
          used: kept.length,
        };
      }
      kept.push(nowMs);
      return {
        allowed: true,
        remaining: limit - kept.length,
        retryAfterMs: 0,
        used: kept.length,
      };
    },

    peek(key, nowMs) {
      const kept = live(key, nowMs);
      return { remaining: Math.max(0, limit - kept.length), used: kept.length };
    },

    reset(key) {
      return log.delete(key);
    },
  };
}

module.exports = { createRateLimiter };`,
      hints: [
        'Trim first, decide second. Every public method starts by dropping entries with `t <= nowMs - windowMs`.',
        'The array is sorted, so walk from index 0 until the first surviving entry and slice once.',
        'retryAfterMs is measured from the oldest surviving entry, not from the newest.',
        '`remaining` after an allowed hit counts the hit you just recorded.',
      ],
      tests: [
        {
          name: 'allows up to the limit',
          assertion:
            "(() => { const rl = solution.createRateLimiter({ limit: 3, windowMs: 1000 }); return [0,1,2].every((t) => rl.hit('ip', t).allowed === true); })()",
        },
        {
          name: 'blocks past the limit with a retryAfterMs',
          assertion:
            "(() => { const rl = solution.createRateLimiter({ limit: 3, windowMs: 1000 }); [0,1,2].forEach((t) => rl.hit('ip', t)); const r = rl.hit('ip', 3); return r.allowed === false && r.remaining === 0 && r.retryAfterMs === 997 && r.used === 3; })()",
        },
        {
          name: 'remaining counts down correctly',
          assertion:
            "(() => { const rl = solution.createRateLimiter({ limit: 3, windowMs: 1000 }); return deepEqual([0,1,2].map((t) => rl.hit('ip', t).remaining), [2,1,0]); })()",
        },
        {
          name: 'the window slides',
          assertion:
            "(() => { const rl = solution.createRateLimiter({ limit: 3, windowMs: 1000 }); [0,1,2].forEach((t) => rl.hit('ip', t)); return rl.hit('ip', 999).allowed === false && rl.hit('ip', 1000).allowed === true; })()",
        },
        {
          name: 'keys are independent',
          assertion:
            "(() => { const rl = solution.createRateLimiter({ limit: 1, windowMs: 1000 }); return rl.hit('a', 0).allowed === true && rl.hit('b', 0).allowed === true && rl.hit('a', 0).allowed === false; })()",
        },
        {
          name: 'peek does not consume',
          assertion:
            "(() => { const rl = solution.createRateLimiter({ limit: 2, windowMs: 1000 }); rl.hit('ip', 0); const p = rl.peek('ip', 0); return p.used === 1 && p.remaining === 1 && rl.peek('ip', 0).used === 1; })()",
          hidden: true,
        },
        {
          name: 'reset clears a key',
          assertion:
            "(() => { const rl = solution.createRateLimiter({ limit: 1, windowMs: 1000 }); rl.hit('ip', 0); return rl.reset('ip') === true && rl.hit('ip', 0).allowed === true && rl.reset('other') === false; })()",
          hidden: true,
        },
        {
          name: 'rejects invalid configuration',
          assertion:
            "throws(() => solution.createRateLimiter({ limit: 0, windowMs: 1000 })) && throws(() => solution.createRateLimiter({ limit: 5, windowMs: 0 }))",
          hidden: true,
        },
      ],
      xp: 110,
    },
  ],
  flashcards: [
    {
      front: 'Cache-aside vs write-through',
      back: 'Cache-aside: the app reads the cache, falls back to the DB on a miss, and populates. Write-through: every write updates the DB and the cache synchronously, so reads after a write are always hits.',
      tags: ['redis', 'caching', 'patterns'],
    },
    {
      front: 'What is the risk unique to write-behind caching?',
      back: 'The client is acknowledged before the data reaches the database, so a cache crash before the flush loses writes. Fine for counters and analytics, never for money.',
      tags: ['redis', 'caching', 'patterns'],
    },
    {
      front: 'What is a cache stampede and the three defences?',
      back: 'Many concurrent requests miss the same expired key and all hit the database. Defend with TTL jitter, single-flight/locking so only one loader runs, and early (background) recomputation before the physical expiry.',
      tags: ['redis', 'caching', 'reliability'],
    },
    {
      front: 'Why must a Redis lock release compare a token?',
      back: 'If the holder overruns the lock TTL, the lock expires and another client takes it. A blind DEL would release somebody else’s lock, so release must be a compare-and-delete Lua script.',
      tags: ['redis', 'locking'],
    },
    {
      front: 'allkeys-lru vs volatile-lru',
      back: 'allkeys-lru can evict any key; volatile-lru only evicts keys that have a TTL. With volatile-* and no expirable keys left, Redis behaves like noeviction and writes fail with OOM.',
      tags: ['redis', 'eviction'],
    },
    {
      front: 'When is LFU better than LRU?',
      back: 'When a small set of keys is hot over a long period and occasional full scans would flush them out. LFU keeps the frequently used keys; LRU would evict them after one sweep of cold data.',
      tags: ['redis', 'eviction'],
    },
    {
      front: 'How does Redis actually delete expired keys?',
      back: 'Lazily on access, plus an active cycle that samples 20 keys with a TTL about 10 times a second and repeats while more than 25% of the sample was expired. Reads never return an expired value.',
      tags: ['redis', 'ttl'],
    },
    {
      front: 'What does a plain SET do to an existing TTL?',
      back: 'It clears it — the key becomes persistent. Use `SET key value KEEPTTL` or re-supply EX/PX.',
      tags: ['redis', 'ttl'],
    },
    {
      front: 'Which structure for a leaderboard, and which commands?',
      back: 'A sorted set: ZADD to insert, ZINCRBY to bump a score atomically, ZREVRANGE ... WITHSCORES for the top N, ZREVRANK for a single player’s rank in O(log n).',
      tags: ['redis', 'data-structures'],
    },
    {
      front: 'Redis Streams vs Pub/Sub vs Lists as a queue',
      back: 'Pub/Sub: fire-and-forget, no history, no ack. List + BRPOP: simple, at-most-once. Streams + consumer groups: persistent, at-least-once, with pending entries a crashed worker’s peer can XAUTOCLAIM.',
      tags: ['redis', 'messaging'],
    },
    {
      front: 'RDB vs AOF',
      back: 'RDB is a periodic snapshot: small, fast to load, loses everything since the last save. AOF appends every write command: with appendfsync everysec you lose at most a second, at the cost of size and slower restarts. Pure caches need neither.',
      tags: ['redis', 'persistence'],
    },
    {
      front: 'When would you actually choose Memcached over Redis?',
      back: 'A large, dumb, multi-threaded look-aside cache of similarly sized blobs where slab-allocated, fragmentation-free memory and multi-core scaling matter more than data structures, persistence or replication.',
      tags: ['memcached', 'redis', 'comparison'],
    },
  ],
  resources: [
    { label: 'Redis — Commands reference', url: 'https://redis.io/docs/latest/commands/', kind: 'DOCS' },
    { label: 'Redis — Key eviction policies', url: 'https://redis.io/docs/latest/develop/reference/eviction/', kind: 'DOCS' },
    { label: 'Redis — Persistence (RDB & AOF)', url: 'https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/', kind: 'DOCS' },
    { label: 'node-redis client documentation', url: 'https://github.com/redis/node-redis', kind: 'DOCS' },
    { label: 'Memcached wiki — Programming and design', url: 'https://github.com/memcached/memcached/wiki', kind: 'DOCS' },
  ],
  project: {
    slug: 'project-4-caching-layer',
    title: 'Project 4 — Add a Measured Caching Layer to the Day-21 API',
    estimatedHours: 8,
    brief: `# Project 4 — Caching Layer with Redis

## Goal

Take the REST + GraphQL API you shipped on **Day 21** and put a real caching layer in front of it. The deliverable is not "I added Redis" — it is a **benchmark report with before/after numbers** that proves the cache earned its place.

## User stories

1. As a reader, product and listing endpoints respond in single-digit milliseconds after the first request.
2. As an editor, when I update a product the very next read reflects my change — no waiting for a TTL.
3. As an operator, I can see hit ratio, p50/p95/p99 latency and eviction counts.
4. As an abusive client, I get \`429\` with a \`Retry-After\` header after exceeding 100 requests per minute.
5. As a logged-in user, my session survives an API restart and can be revoked instantly by an admin.

## Required tech

- **Redis 7** (Docker), \`node-redis\` v4 or \`ioredis\`
- Your Day-21 Express + GraphQL API and its database
- \`autocannon\` (or \`k6\`) for load testing
- Optional: **Memcached** for the comparison appendix

## Architecture you are building

\`\`\`text
client -> express
            |-- rate limit  (Redis sorted set, sliding window)
            |-- session     (Redis, connect-redis, 30 min sliding TTL)
            |-- handler
                  |-- cache.get(key)  --HIT--> respond (~1 ms)
                  |                   --MISS--> single-flight lock -> DB -> cache.set(ttl+jitter)
                  |-- on write: DB -> DEL cache keys + index set
\`\`\`

## Step 1 — Baseline first (do not skip)

Before touching a line of caching code, record the baseline:

\`\`\`bash
npx autocannon -c 50 -d 20 http://localhost:3000/api/products/1042
npx autocannon -c 50 -d 20 http://localhost:3000/api/products?page=1
\`\`\`

Save requests/sec and the latency percentile table into \`benchmarks/before.md\`. A benchmark you cannot repeat is not a benchmark: record the machine, the row count, and the concurrency.

## Step 2 — Cache-aside reads

Write one reusable module — do not scatter \`redis.get\` through your handlers:

\`\`\`js
// src/cache.js
import crypto from 'node:crypto';
import { createClient } from 'redis';

export const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const inflight = new Map();

export async function cached(key, ttlSeconds, loader) {
  const hit = await redis.get(key);
  if (hit !== null) { metrics.hits++; return JSON.parse(hit); }
  metrics.misses++;

  if (inflight.has(key)) return inflight.get(key);          // in-process single-flight
  const p = (async () => {
    const lockKey = 'lock:' + key;
    const token = crypto.randomUUID();
    const locked = await redis.set(lockKey, token, { NX: true, PX: 5000 });
    if (!locked) {
      await new Promise((r) => setTimeout(r, 40));
      const second = await redis.get(key);
      if (second !== null) return JSON.parse(second);
    }
    try {
      const value = await loader();
      const ttl = ttlSeconds + Math.floor(Math.random() * Math.ceil(ttlSeconds * 0.1));
      await redis.set(key, JSON.stringify(value), { EX: ttl });
      return value;
    } finally {
      await redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        { keys: [lockKey], arguments: [token] },
      );
    }
  })().finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}
\`\`\`

## Step 3 — Invalidate on write

Every mutating handler deletes the keys it affects. Track derived keys (list pages, search results) in a per-entity index set so one \`DEL\` clears them all. Prove it with a test: \`PUT\` then immediate \`GET\` must return the new value.

## Step 4 — Rate limiting and sessions

Sliding-window limiter in a Lua script keyed by API key or IP; respond \`429\` with \`Retry-After\`. Sessions via \`connect-redis\` with a 30-minute sliding TTL and an admin route that revokes by deleting \`sess:<id>\`.

## Step 5 — Re-measure and write it up

Re-run the exact same autocannon commands into \`benchmarks/after.md\`, then produce \`benchmarks/README.md\` with a table: endpoint, p50, p95, p99, req/s, hit ratio — before and after. Include one **cold-cache** run so the report is honest about miss-path cost.

## Acceptance criteria

- Cached read endpoints show a p95 improvement of at least 5x over baseline on a warm cache.
- Steady-state hit ratio above 85% under the load test.
- A write followed immediately by a read returns fresh data (automated test).
- 101st request in a minute returns \`429\` with a \`Retry-After\` header.
- Killing and restarting the API keeps users logged in; deleting the session key logs them out instantly.
- Killing **Redis** degrades the API to baseline latency but does not return 5xx.`,
    checklist: [
      'Baseline benchmark for at least two read endpoints recorded in benchmarks/before.md with concurrency, duration and dataset size stated',
      'Redis 7 running via docker compose with a named volume and a healthcheck',
      'A single reusable cached(key, ttl, loader) module — no ad-hoc redis.get calls inside route handlers',
      'Cache keys follow a documented entity:id:variant scheme including locale/version where relevant',
      'Every cached write path sets a TTL with randomised jitter of at least 10%',
      'Single-flight in-process coalescing plus a Redis NX lock with a token-checked Lua release',
      'Mutating endpoints delete the affected keys and their derived keys via a per-entity index set',
      'An automated test asserts that a PUT followed immediately by a GET returns the updated value',
      'Sliding-window rate limiter implemented as a Lua script on a sorted set, returning 429 with Retry-After',
      'Sessions stored in Redis with a 30-minute sliding TTL and an admin revoke endpoint that deletes the session key',
      'A /metrics or /admin/cache route exposes hits, misses, hit ratio, evicted_keys and used_memory',
      'maxmemory and an explicit maxmemory-policy are set in the compose config, with the choice justified in the README',
      'The API survives Redis being stopped: reads fall back to the database, no 5xx, and it recovers when Redis returns',
      'benchmarks/README.md compares p50/p95/p99 and req/s before vs after, including one cold-cache run',
    ],
    stretchGoals: [
      'Add a two-tier cache: an in-process LRU (L1) invalidated across instances via Redis Pub/Sub, in front of Redis (L2)',
      'Implement probabilistic early recomputation (XFetch) and show it flattens the p99 spike at TTL boundaries',
      'Run the same benchmark against Memcached and write a one-page appendix on where each wins',
      'Cache GraphQL responses per persisted-query hash and measure the effect on the N+1 path',
      'Add a Redis Streams consumer group that processes write-behind view-count increments and flushes them to the database in batches',
    ],
    repoStarter: 'https://github.com/redis/node-redis',
  },
};

export default day;
