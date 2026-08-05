/**
 * Unit tests for the judge, the SRS scheduler and the CSS shim.
 * No framework — `npm test -w @codeninja/api`.
 */
import assert from 'node:assert/strict';
import { judge, type JudgeProblem } from './judge';
import { NEW_CARD, schedule } from './srs';
import { levelFor } from './gamify';

let passed = 0;
const failures: string[] = [];

async function it(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (e) {
    failures.push(`${name}: ${(e as Error).message}`);
    console.log(`  \x1b[31m✕\x1b[0m ${name}\n      ${(e as Error).message.split('\n')[0]}`);
  }
}

const jsProblem = (tests: { name: string; assertion: string; hidden?: boolean }[]): JudgeProblem => ({
  runtime: 'javascript',
  tests: tests.map((t) => ({ ...t, hidden: t.hidden ?? false, points: 1 })),
});

async function main() {
  console.log('\n\x1b[1mjavascript sandbox\x1b[0m');

  await it('passes a correct solution', async () => {
    const r = await judge(jsProblem([{ name: 'adds', assertion: 'solution.add(2,3) === 5' }]), 'module.exports = { add: (a,b) => a+b };');
    assert.equal(r.status, 'PASSED');
    assert.equal(r.passedCount, 1);
  });

  await it('fails a wrong solution with a readable message', async () => {
    const r = await judge(jsProblem([{ name: 'adds', assertion: 'solution.add(2,3) === 5' }]), 'module.exports = { add: (a,b) => a*b };');
    assert.equal(r.status, 'FAILED');
    assert.match(r.results[0].message ?? '', /expected true/);
  });

  await it('reports a syntax error instead of crashing', async () => {
    const r = await judge(jsProblem([{ name: 'x', assertion: 'true' }]), 'const = ;;;');
    assert.equal(r.status, 'ERROR');
  });

  await it('supports async assertions', async () => {
    const r = await judge(
      jsProblem([{ name: 'resolves', assertion: 'await solution.later() === 7' }]),
      'module.exports = { later: () => new Promise(r => setTimeout(() => r(7), 5)) };',
    );
    assert.equal(r.status, 'PASSED');
  });

  await it('exposes deepEqual, close and throws', async () => {
    const r = await judge(
      jsProblem([
        { name: 'deepEqual', assertion: 'deepEqual(solution.pair(), {a:[1,2]})' },
        { name: 'close', assertion: 'close(solution.third(), 0.3333333, 1e-6)' },
        { name: 'throws', assertion: 'throws(() => solution.boom())' },
      ]),
      `module.exports = {
         pair: () => ({ a: [1, 2] }),
         third: () => 1 / 3,
         boom: () => { throw new Error('nope'); },
       };`,
    );
    assert.equal(r.status, 'PASSED', JSON.stringify(r.results));
  });

  await it('blocks require()', async () => {
    const r = await judge(jsProblem([{ name: 'x', assertion: 'true' }]), "module.exports = { fs: require('fs') };");
    assert.equal(r.status, 'ERROR');
  });

  await it('kills an infinite loop', async () => {
    const started = Date.now();
    const r = await judge(jsProblem([{ name: 'x', assertion: 'true' }]), 'while (true) {}');
    assert.equal(r.status, 'ERROR');
    assert.ok(Date.now() - started < 15_000, 'should time out quickly');
  });

  await it('rejects an empty submission', async () => {
    const r = await judge(jsProblem([{ name: 'x', assertion: 'true' }]), '   ');
    assert.equal(r.status, 'ERROR');
  });

  // Regression: the sandbox used to receive the host's Object/Array/JSON, which shadowed
  // the vm context's own intrinsics. Plain objects then failed prototype identity checks.
  await it('object literals in the sandbox have the sandbox Object.prototype', async () => {
    const r = await judge(
      jsProblem([{ name: 'plain', assertion: 'solution.isPlain({ a: 1 }) === true' }]),
      `module.exports = {
         isPlain: (v) => Object.getPrototypeOf(v) === Object.prototype,
       };`,
    );
    assert.equal(r.status, 'PASSED', JSON.stringify(r.results));
  });

  await it('distinguishes a class instance from a plain object', async () => {
    const r = await judge(
      jsProblem([
        { name: 'class is not plain', assertion: 'solution.check() === true' },
      ]),
      `class Repo {}
       module.exports = {
         check: () => Object.getPrototypeOf(new Repo()) !== Object.prototype
                   && Object.getPrototypeOf({}) === Object.prototype,
       };`,
    );
    assert.equal(r.status, 'PASSED', JSON.stringify(r.results));
  });

  await it('an object built in an assertion is the same realm as the solution', async () => {
    const r = await judge(
      jsProblem([{ name: 'cross', assertion: 'solution.isPlain({ nested: { x: 1 } }) === true' }]),
      `module.exports = { isPlain: (v) => Object.getPrototypeOf(v.nested) === Object.prototype };`,
    );
    assert.equal(r.status, 'PASSED', JSON.stringify(r.results));
  });

  await it('deepEqual handles Date, Map, Set and RegExp built inside the sandbox', async () => {
    const r = await judge(
      jsProblem([
        { name: 'date', assertion: 'deepEqual(solution.d(), new Date(0))' },
        { name: 'map', assertion: 'deepEqual(solution.m(), new Map([["a", 1]]))' },
        { name: 'set', assertion: 'deepEqual(solution.s(), new Set([1, 2]))' },
        { name: 're', assertion: 'deepEqual(solution.r(), /ab+/g)' },
        { name: 'mismatched types are not equal', assertion: 'deepEqual([1], {0:1}) === false' },
      ]),
      `module.exports = {
         d: () => new Date(0),
         m: () => new Map([['a', 1]]),
         s: () => new Set([1, 2]),
         r: () => /ab+/g,
       };`,
    );
    assert.equal(r.status, 'PASSED', JSON.stringify(r.results));
  });

  await it('structuredClone is available and realm-native', async () => {
    const r = await judge(
      jsProblem([{ name: 'clone', assertion: 'solution.check() === true' }]),
      `module.exports = {
         check: () => {
           const c = structuredClone({ a: [1, 2] });
           return c.a[1] === 2 && Object.getPrototypeOf(c) === Object.prototype;
         },
       };`,
    );
    assert.equal(r.status, 'PASSED', JSON.stringify(r.results));
  });

  await it('captures console output', async () => {
    const r = await judge(jsProblem([{ name: 'x', assertion: 'true' }]), "console.log('hello from the sandbox'); module.exports = {};");
    assert.match(r.stderr ?? '', /hello from the sandbox/);
  });

  console.log('\n\x1b[1mhtml sandbox\x1b[0m');

  await it('asserts against the parsed document', async () => {
    const r = await judge(
      { runtime: 'html', tests: [{ name: 'has a main', assertion: "doc.querySelectorAll('main').length === 1", hidden: false, points: 1 }] },
      '<main><h1>Hi</h1></main>',
    );
    assert.equal(r.status, 'PASSED');
  });

  await it('resolves custom properties through inheritance', async () => {
    const r = await judge(
      {
        runtime: 'html',
        tests: [{ name: 'token resolves', assertion: "css('.card', 'padding-top') === '16px'", hidden: false, points: 1 }],
      },
      '<style>:root{--pad:16px}.card{padding:var(--pad)}</style><div class="card">x</div>',
    );
    assert.equal(r.status, 'PASSED', JSON.stringify(r.results));
  });

  await it('does not let a @media override defeat the base rule', async () => {
    const r = await judge(
      {
        runtime: 'html',
        tests: [{ name: 'row on desktop', assertion: "css('.bar', 'align-items') === 'center'", hidden: false, points: 1 }],
      },
      '<style>.bar{display:flex;align-items:center}@media (max-width:40rem){.bar{align-items:stretch}}</style><div class="bar">x</div>',
    );
    assert.equal(r.status, 'PASSED', JSON.stringify(r.results));
  });

  await it('expands the gap shorthand', async () => {
    const r = await judge(
      {
        runtime: 'html',
        tests: [{ name: 'column-gap', assertion: "css('.g', 'column-gap') === '12px'", hidden: false, points: 1 }],
      },
      '<style>.g{display:flex;gap:12px}</style><div class="g"></div>',
    );
    assert.equal(r.status, 'PASSED', JSON.stringify(r.results));
  });

  console.log('\n\x1b[1msql sandbox\x1b[0m');

  await it('runs a query on SQLite and compares result sets', async () => {
    const r = await judge(
      {
        runtime: 'sql',
        sqlSetup: `CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, n INTEGER);
                   INSERT INTO t (name, n) VALUES ('a', 1), ('b', 2), ('a', 3);`,
        tests: [{ name: 'grouped', assertion: '[{"name":"a","total":4},{"name":"b","total":2}]', hidden: false, points: 1 }],
      },
      'SELECT name, SUM(n) AS total FROM t GROUP BY name ORDER BY name',
    );
    assert.equal(r.status, 'PASSED', JSON.stringify(r.results));
  });

  await it('flags a wrong result set', async () => {
    const r = await judge(
      {
        runtime: 'sql',
        sqlSetup: 'CREATE TABLE t (n INTEGER); INSERT INTO t VALUES (1),(2);',
        tests: [{ name: 'sum', assertion: '[{"s":3}]', hidden: false, points: 1 }],
      },
      'SELECT COUNT(*) AS s FROM t',
    );
    assert.equal(r.status, 'FAILED');
  });

  await it('blocks ATTACH and PRAGMA', async () => {
    const r = await judge(
      { runtime: 'sql', sqlSetup: 'CREATE TABLE t (n INTEGER);', tests: [{ name: 'x', assertion: '[]', hidden: false, points: 1 }] },
      "ATTACH DATABASE 'other.db' AS o; SELECT 1",
    );
    assert.equal(r.status, 'ERROR');
  });

  console.log('\n\x1b[1mSM-2 scheduler\x1b[0m');

  await it('first "Good" schedules one day out', () => {
    const n = schedule(NEW_CARD, 4);
    assert.equal(n.repetitions, 1);
    assert.equal(n.intervalDays, 1);
  });

  await it('second "Good" schedules six days out', () => {
    const n = schedule(schedule(NEW_CARD, 4), 4);
    assert.equal(n.repetitions, 2);
    assert.equal(n.intervalDays, 6);
  });

  await it('third review multiplies by the ease factor', () => {
    const n = schedule(schedule(schedule(NEW_CARD, 4), 4), 4);
    assert.equal(n.repetitions, 3);
    assert.ok(n.intervalDays >= 14 && n.intervalDays <= 16, `got ${n.intervalDays}`);
  });

  await it('"Again" resets and returns in ~10 minutes', () => {
    const mature = schedule(schedule(schedule(NEW_CARD, 4), 4), 4);
    const lapsed = schedule(mature, 1);
    assert.equal(lapsed.repetitions, 0);
    assert.equal(lapsed.lapses, 1);
    assert.ok(lapsed.easeFactor < mature.easeFactor);
    const mins = (lapsed.dueAt.getTime() - Date.now()) / 60_000;
    assert.ok(mins > 5 && mins < 15, `due in ${mins} minutes`);
  });

  await it('the ease factor never drops below 1.3', () => {
    let s = NEW_CARD;
    for (let i = 0; i < 30; i++) s = schedule(s, 0);
    assert.ok(s.easeFactor >= 1.3);
  });

  await it('"Easy" raises the ease factor, "Hard" lowers it', () => {
    assert.ok(schedule(NEW_CARD, 5).easeFactor > 2.5);
    assert.ok(schedule(NEW_CARD, 3).easeFactor < 2.5);
  });

  console.log('\n\x1b[1mlevelling\x1b[0m');

  await it('0 XP is level 1', () => assert.equal(levelFor(0).level, 1));
  await it('100 XP is level 2', () => assert.equal(levelFor(100).level, 2));
  await it('levels increase monotonically', () => {
    let last = 0;
    for (let xp = 0; xp < 50_000; xp += 137) {
      const l = levelFor(xp).level;
      assert.ok(l >= last);
      last = l;
    }
  });
  await it('intoLevel never exceeds nextLevelAt', () => {
    for (let xp = 0; xp < 20_000; xp += 91) {
      const l = levelFor(xp);
      assert.ok(l.intoLevel < l.nextLevelAt, `xp ${xp}`);
    }
  });

  console.log(`\n\x1b[1m${passed} passed, ${failures.length} failed\x1b[0m\n`);
  if (failures.length) {
    for (const f of failures) console.log(`  \x1b[31m·\x1b[0m ${f}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
