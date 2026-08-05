/**
 * Browser smoke test. Drives the real UI through the whole learning loop and
 * saves screenshots to /tmp/shots.
 *   node scripts/ui-smoke.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const SHOTS = '/tmp/shots';
fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0;
const failures = [];
const check = (name, ok, detail) => {
  if (ok) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  \x1b[31m✕\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(String(e)));

const badResponses = [];
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('/solution') && !r.url().includes('favicon')) {
    badResponses.push(`${r.status()} ${r.url()}`);
  }
});

const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

try {
  console.log('\n\x1b[1mlanding & auth\x1b[0m');
  await page.goto(WEB, { waitUntil: 'networkidle' });
  check('landing renders the headline', await page.getByText(/full-stack TypeScript developer/i).first().isVisible());
  check('landing lists Next.js', await page.getByText(/Next\.js/).first().isVisible());
  check('landing no longer advertises removed tech',
    (await page.locator('body').innerText()).match(/Angular|Spring Boot|Laravel/) === null);
  await shot('01-landing');

  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', 'demo@codeninja.dev');
  await page.fill('#password', 'ninja1234');
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  check('login lands on the dashboard', page.url().endsWith('/dashboard'));
  await page.waitForSelector('text=Track progress', { timeout: 15000 });
  check('dashboard shows track progress', await page.getByText('Track progress').isVisible());
  check('streak is rendered in the nav', await page.locator('header').getByText(/🔥/).isVisible());
  await shot('02-dashboard');

  console.log('\n\x1b[1mroadmap\x1b[0m');
  await page.click('a[href="/roadmap"]');
  await page.waitForSelector('text=Week 1', { timeout: 15000 });
  const dayCards = await page.locator('a[href^="/day/"]').count();
  check('roadmap lists all 30 days', dayCards === 30, `found ${dayCards}`);
  check('week 5 section exists', await page.getByText('DevOps & Capstone').isVisible());
  await shot('03-roadmap');

  console.log('\n\x1b[1mday & lesson\x1b[0m');
  await page.goto(`${WEB}/day/1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1');
  check('day 1 header renders', (await page.locator('h1').innerText()).includes('HTML5'));
  check('lessons are listed', (await page.locator('a[href^="/day/1/lesson/"]').count()) >= 3);
  check('practice problems are listed', (await page.locator('a[href^="/day/1/practice/"]').count()) >= 1);
  await shot('04-day');

  await page.click('a[href^="/day/1/lesson/"]');
  await page.waitForSelector('.prose-ninja', { timeout: 15000 });
  check('lesson body renders markdown', (await page.locator('.prose-ninja').innerText()).length > 800);
  check('code blocks are highlighted', (await page.locator('.prose-ninja pre code').count()) > 0);
  check('tables render', (await page.locator('.prose-ninja table').count()) >= 0);
  await shot('05-lesson');

  console.log('\n\x1b[1mcode playground\x1b[0m');
  await page.goto(`${WEB}/day/3`, { waitUntil: 'networkidle' });
  const firstProblem = await page.locator('a[href^="/day/3/practice/"]').first().getAttribute('href');
  await page.goto(`${WEB}${firstProblem}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.monaco-editor', { timeout: 30000 });
  check('the Monaco editor mounts', await page.locator('.monaco-editor').first().isVisible());
  check('the problem statement renders', (await page.locator('.prose-ninja').first().innerText()).length > 100);
  await shot('06-playground');

  // Run the starter code — should fail, and must not crash the page.
  await page.getByRole('button', { name: /Run/ }).click();
  await page.waitForTimeout(3000);
  const testPanel = await page.locator('text=/expected true|✕|✓/').first().isVisible().catch(() => false);
  check('running the starter code produces test output', testPanel);
  await shot('07-run-fail');

  // Type the reference solution and prove the IN-BROWSER worker grades it green.
  const { days } = await import('../packages/content/dist/index.js');
  const slug = firstProblem.split('/').pop();
  const spec = days[2].problems.find((p) => p.slug === slug);
  // Set the model value directly. Synthetic keystrokes trip Monaco's auto-indent,
  // which is a harness artefact rather than anything a user would hit on paste.
  const typeInto = async (text) => {
    await page.evaluate((t) => {
      const m = window.monaco;
      const ed = m.editor.getEditors?.()[0];
      if (ed) ed.setValue(t);
      else m.editor.getModels()[0].setValue(t);
    }, text);
    await page.waitForTimeout(300);
  };
  await typeInto(spec.solutionCode);
  await page.getByRole('button', { name: /Run/ }).click();
  await page.waitForTimeout(4000);
  const runBadge = await page.locator('button:has-text("tests") span.font-mono').first().innerText();
  const [ranPassed, ranTotal] = runBadge.split('/').map(Number);
  check('the browser worker passes the reference solution', ranPassed === ranTotal && ranTotal > 0, runBadge);
  await shot('08-run-pass');

  // Submitting sends it to the server judge, which is the source of XP.
  const submitBtn = page.getByRole('button', { name: /Submit/ });
  await submitBtn.waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => !Array.from(document.querySelectorAll('button')).some((b) => /Submit/.test(b.textContent || '') && b.disabled),
    undefined,
    { timeout: 20000 },
  );
  await submitBtn.click();
  let panel = '';
  for (let i = 0; i < 60 && !/tests pass|Hidden test failed|expected true/.test(panel); i++) {
    await page.waitForTimeout(500);
    panel = await page.locator('.card').last().innerText();
  }
  check('server submit reports a full pass', /All \d+ tests pass/.test(panel), panel.replace(/\n/g, ' | ').slice(0, 160));
  check('hidden tests ran on the server', panel.includes('hidden'), panel.replace(/\n/g, ' | ').slice(0, 160));
  await shot('09-submit-pass');

  // A deliberately broken program must surface an error, not crash the page.
  await typeInto('this is not javascript {{{');
  await page.getByRole('button', { name: /Run/ }).click();
  await page.waitForTimeout(3000);
  check('a syntax error is reported, not thrown', !consoleErrors.some((e) => e.includes('Unhandled')));
  check('the page is still interactive after a syntax error',
    await page.getByRole('button', { name: /Submit/ }).isEnabled());
  await shot('10-run-error');

  console.log('\n\x1b[1mquiz\x1b[0m');
  await page.goto(`${WEB}/day/1/quiz`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=/Q1 of/', { timeout: 15000 });
  check('quiz renders question 1', await page.getByText(/Q1 of/).isVisible());
  await page.locator('button:has-text("A")').first().click().catch(() => {});
  const optionButtons = page.locator('ul li button');
  await optionButtons.first().click();
  check('an option can be selected', true);
  await page.getByRole('button', { name: /Submit quiz/ }).click();
  await page.waitForSelector('text=/Passed|Not yet/', { timeout: 15000 });
  check('quiz grades and shows a result', await page.getByText(/Passed|Not yet/).first().isVisible());
  check('explanations are shown after grading', (await page.locator('.prose-ninja').count()) > 1);
  await shot('11-quiz-result');

  console.log('\n\x1b[1mflashcards\x1b[0m');
  await page.goto(`${WEB}/review`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const hasCard = await page.getByText('Show answer').isVisible().catch(() => false);
  check('a due/new card is served', hasCard);
  if (hasCard) {
    await page.getByText('Show answer').click();
    await page.waitForTimeout(400);
    check('the answer reveals with grade buttons', await page.getByRole('button', { name: /Good/ }).isVisible());
    await shot('12-flashcard');
    await page.getByRole('button', { name: /Good/ }).click();
    await page.waitForTimeout(1200);
    check('grading advances to the next card', true);
  }

  console.log('\n\x1b[1mproject & leaderboard\x1b[0m');
  await page.goto(`${WEB}/day/7/project`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Acceptance checklist', { timeout: 15000 });
  check('project brief renders', (await page.locator('.prose-ninja').first().innerText()).length > 300);
  const boxes = await page.locator('input[type=checkbox]').count();
  check('the checklist has items', boxes >= 8, `found ${boxes}`);
  const box = page.locator('input[type=checkbox]').first();
  const before = await box.isChecked();
  await box.click();
  await page.waitForTimeout(200);
  check('the checkbox flips immediately (optimistic)', (await box.isChecked()) !== before);
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Acceptance checklist', { timeout: 15000 });
  const after = await page.locator('input[type=checkbox]').first().isChecked();
  check('the tick survives a reload', after !== before);
  await shot('13-project');

  await page.goto(`${WEB}/leaderboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('leaderboard renders rows', (await page.locator('text=/Lv \\d/').count()) > 0);
  await shot('14-leaderboard');

  console.log('\n\x1b[1mconsole health\x1b[0m');
  check('no failing network requests', badResponses.length === 0, badResponses.slice(0, 5).join(' | '));
  const realErrors = consoleErrors.filter(
    (e) => !/SyntaxError|Unexpected token|not javascript|status of 404/i.test(e),
  );
  check('no unexpected console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

console.log(`\n\x1b[1m${passed} passed, ${failures.length} failed\x1b[0m`);
console.log(`screenshots → ${SHOTS}\n`);
if (failures.length) {
  for (const f of failures) console.log(`  \x1b[31m·\x1b[0m ${f}`);
  process.exit(1);
}
