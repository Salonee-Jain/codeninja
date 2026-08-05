/**
 * End-to-end smoke test against a running API.
 *   node scripts/smoke.mjs [baseUrl]
 *
 * Registers a throwaway learner and walks the whole learning loop: roadmap →
 * day → lesson progress → quiz → code run/submit (a correct AND an incorrect
 * solution) → flashcard review → project checklist → dashboard.
 */
const BASE = process.argv[2] ?? 'http://localhost:4000';

let token = null;
let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  \x1b[31m✕\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

async function main() {
  section('health');
  const health = await call('GET', '/health');
  check('GET /health returns ok', health.data?.ok === true);

  section('auth');
  const email = `smoke-${Date.now()}@codeninja.dev`;
  const reg = await call('POST', '/api/auth/register', {
    name: 'Smoke Test',
    email,
    password: 'ninja1234',
  });
  check('register creates a user', reg.status === 201, `status ${reg.status}`);
  token = reg.data?.accessToken;
  check('register returns an access token', typeof token === 'string');
  check('new user starts at level 1 with 0 XP', reg.data?.user?.xp === 0 && reg.data?.user?.level === 1);

  const dupe = await call('POST', '/api/auth/register', { name: 'x', email, password: 'ninja1234' });
  check('duplicate email is rejected', dupe.status === 400);

  const badLogin = await call('POST', '/api/auth/login', { email, password: 'wrongpassword' });
  check('wrong password is rejected', badLogin.status === 401);

  const me = await call('GET', '/api/auth/me');
  check('GET /me returns the caller', me.data?.user?.email === email);

  const refreshed = await call('POST', '/api/auth/refresh', { refreshToken: reg.data.refreshToken });
  check('refresh token rotates', refreshed.status === 200 && refreshed.data.refreshToken !== reg.data.refreshToken);
  const replay = await call('POST', '/api/auth/refresh', { refreshToken: reg.data.refreshToken });
  check('the old refresh token is revoked after rotation', replay.status === 401);

  section('curriculum');
  const track = await call('GET', '/api/tracks/full-stack-30');
  check('track has 30 days', track.data?.days?.length === 30, `got ${track.data?.days?.length}`);
  check('day 1 is HTML5', track.data?.days?.[0]?.title?.includes('HTML5'));
  const allTech = new Set(track.data.days.flatMap((d) => d.technologies));
  const REQUIRED = [
    'HTML5', 'CSS3', 'JavaScript (ES6+)', 'TypeScript',
    'Tailwind CSS', 'Bootstrap', 'Sass/SCSS',
    'React.js', 'Vue.js', 'Next.js',
    'Redux Toolkit', 'Zustand', 'Pinia', 'TanStack Query', 'React Hook Form',
    'Node.js', 'Express.js', 'NestJS', 'Fastify', 'RESTful APIs', 'GraphQL', 'tRPC', 'Zod',
    'JWT', 'OAuth', 'bcrypt',
    'PostgreSQL', 'MySQL', 'SQL Server', 'MongoDB', 'Cassandra', 'DynamoDB',
    'Redis', 'Memcached', 'Prisma', 'Drizzle ORM', 'Mongoose', 'TypeORM',
    'Python', 'Django', 'FastAPI', 'Go',
    'AWS', 'Google Cloud', 'Azure', 'Docker', 'Kubernetes',
    'GitHub Actions', 'GitLab CI', 'Jenkins', 'Prometheus', 'Grafana', 'ELK Stack',
  ];

  const missing = REQUIRED.filter((t) => !allTech.has(t));
  check(`all ${REQUIRED.length} roadmap technologies are covered`, missing.length === 0, missing.join(', '));

  const REMOVED = ['Angular', 'Java', 'Spring Boot', 'PHP', 'Laravel', 'C++'];
  const stillPresent = REMOVED.filter((t) => allTech.has(t));
  check('removed technologies are gone from the track', stillPresent.length === 0, stillPresent.join(', '));

  const nextDays = track.data.days.filter((d) => d.technologies.includes('Next.js'));
  check('Next.js gets three dedicated days', nextDays.length >= 3, `found ${nextDays.length}`);
  check('day 19 is NestJS', track.data.days[18].title.includes('NestJS'), track.data.days[18].title);
  check('day 20 is tRPC', track.data.days[19].title.includes('tRPC'), track.data.days[19].title);

  const day1 = await call('GET', '/api/tracks/full-stack-30/days/1');
  check('day 1 has lessons', day1.data?.day?.lessons?.length >= 3);
  check('day 1 has problems', day1.data?.day?.problems?.length >= 1);
  check('solutionCode is never exposed', !JSON.stringify(day1.data).includes('solutionCode'));
  check('hidden tests are not exposed', day1.data.day.problems[0].visibleTests.length < day1.data.day.problems[0].testCount);

  const missingDay = await call('GET', '/api/tracks/full-stack-30/days/99');
  check('day 99 is a 400/404', missingDay.status >= 400);

  section('lessons');
  const lesson = day1.data.day.lessons[0];
  const prog = await call('POST', `/api/learn/lessons/${lesson.id}/progress`, {
    completed: true,
    secondsSpent: 900,
    scrollPct: 100,
  });
  check('completing a lesson awards XP', prog.data?.xpAwarded === 20, `got ${prog.data?.xpAwarded}`);
  const again = await call('POST', `/api/learn/lessons/${lesson.id}/progress`, { completed: true });
  check('re-completing awards no further XP', again.data?.xpAwarded === 0);
  check('streak started at 1', prog.data?.totals?.streak === 1);

  const note = await call('PUT', `/api/learn/lessons/${lesson.id}/note`, { body: 'remember: defer vs async' });
  check('lesson note saves', note.data?.note?.body?.includes('defer'));

  section('quiz');
  const quiz = await call('GET', '/api/tracks/full-stack-30/days/1/quiz');
  check('quiz questions load', quiz.data?.questions?.length >= 6);
  check('the answer key is withheld', !JSON.stringify(quiz.data).includes('correctIndex'));

  const allWrong = await call('POST', `/api/learn/days/${quiz.data.dayId}/quiz/submit`, {
    answers: quiz.data.questions.map((q) => ({ questionId: q.id, selectedIndex: 0 })),
  });
  check('a submitted quiz is graded', typeof allWrong.data?.pct === 'number');
  check('review includes explanations', allWrong.data.review.every((r) => r.explanation?.length > 0));

  const key = new Map(allWrong.data.review.map((r) => [r.questionId, r.correctIndex]));
  const allRight = await call('POST', `/api/learn/days/${quiz.data.dayId}/quiz/submit`, {
    answers: quiz.data.questions.map((q) => ({ questionId: q.id, selectedIndex: key.get(q.id) })),
  });
  check('a perfect quiz scores 100%', allRight.data?.pct === 100, `got ${allRight.data?.pct}`);
  check('passing awards 50 XP', allRight.data?.xpAwarded === 50, `got ${allRight.data?.xpAwarded}`);
  const repeat = await call('POST', `/api/learn/days/${quiz.data.dayId}/quiz/submit`, {
    answers: quiz.data.questions.map((q) => ({ questionId: q.id, selectedIndex: key.get(q.id) })),
  });
  check('passing twice awards XP once', repeat.data?.xpAwarded === 0);

  section('code judge');
  const problem = day1.data.day.problems[0];
  const bad = await call('POST', `/api/learn/problems/${problem.id}/submit`, {
    code: '<div>nope</div>',
  });
  check('a wrong submission fails', bad.data?.status === 'FAILED', bad.data?.status);
  check('a wrong submission awards no XP', bad.data?.xpAwarded === 0);

  const locked = await call('GET', `/api/learn/problems/${problem.id}/solution`);
  check('the solution is locked before 3 attempts', locked.status === 400);

  // Pull the real solution from the seeded content package to prove the judge passes it.
  const { days } = await import('../packages/content/dist/index.js');
  const spec = days[0].problems.find((p) => p.slug === problem.slug);
  const good = await call('POST', `/api/learn/problems/${problem.id}/submit`, { code: spec.solutionCode });
  check('the reference solution passes every test', good.data?.status === 'PASSED',
    JSON.stringify(good.data?.results?.filter((r) => !r.passed)));
  check('first solve awards the problem XP', good.data?.xpAwarded === problem.xp, `got ${good.data?.xpAwarded}`);
  const resolve = await call('POST', `/api/learn/problems/${problem.id}/submit`, { code: spec.solutionCode });
  check('re-solving awards no further XP', resolve.data?.xpAwarded === 0);

  const unlocked = await call('GET', `/api/learn/problems/${problem.id}/solution`);
  check('the solution unlocks after solving', unlocked.status === 200 && !!unlocked.data.solutionCode);

  const dry = await call('POST', `/api/learn/problems/${problem.id}/run`, { code: spec.solutionCode });
  check('dry run grades visible tests only', dry.data?.totalCount === problem.visibleTests.length);

  const loop = await call('POST', `/api/learn/problems/${problem.id}/run`, {
    code: 'while(true){}',
  });
  check('an infinite loop is killed, not hung', loop.status === 200 && loop.data.status !== 'PASSED');

  // A JavaScript problem, to exercise the vm path.
  const day3 = await call('GET', '/api/tracks/full-stack-30/days/3');
  const jsProblem = day3.data.day.problems.find((p) => p.runtime === 'javascript');
  if (jsProblem) {
    const jsSpec = days[2].problems.find((p) => p.slug === jsProblem.slug);
    const jsRun = await call('POST', `/api/learn/problems/${jsProblem.id}/submit`, { code: jsSpec.solutionCode });
    check('a javascript problem passes in the vm sandbox', jsRun.data?.status === 'PASSED',
      JSON.stringify(jsRun.data?.results?.filter((r) => !r.passed)?.slice(0, 2)));
    const escape = await call('POST', `/api/learn/problems/${jsProblem.id}/submit`, {
      code: "module.exports = { x: require('fs') };",
    });
    check('require() is blocked in the sandbox', escape.data?.status === 'ERROR');
  }

  // A SQL problem, to exercise sql.js.
  const day22 = await call('GET', '/api/tracks/full-stack-30/days/22');
  const sqlProblem = day22.data.day.problems.find((p) => p.runtime === 'sql');
  if (sqlProblem) {
    const sqlSpec = days[21].problems.find((p) => p.slug === sqlProblem.slug);
    const sqlRun = await call('POST', `/api/learn/problems/${sqlProblem.id}/submit`, { code: sqlSpec.solutionCode });
    check('a SQL problem runs on SQLite and passes', sqlRun.data?.status === 'PASSED',
      JSON.stringify(sqlRun.data?.results?.filter((r) => !r.passed)?.slice(0, 1)));
  }

  section('spaced repetition');
  const due = await call('GET', '/api/learn/flashcards/due?limit=5&upToDay=3');
  check('new cards are served when nothing is due', due.data?.cards?.length === 5, `got ${due.data?.cards?.length}`);
  const card = due.data.cards[0];
  const goodGrade = await call('POST', `/api/learn/flashcards/${card.id}/review`, { grade: 4 });
  check('a "Good" review schedules 1 day out', goodGrade.data?.review?.intervalDays === 1,
    `interval ${goodGrade.data?.review?.intervalDays}`);
  const lapse = await call('POST', `/api/learn/flashcards/${card.id}/review`, { grade: 1 });
  check('a lapse resets repetitions and lowers ease',
    lapse.data?.review?.repetitions === 0 && lapse.data?.review?.easeFactor < 2.5);
  const dueNow = new Date(lapse.data.review.dueAt).getTime() - Date.now();
  check('a lapsed card comes back in ~10 minutes', dueNow > 0 && dueNow < 15 * 60_000);

  section('projects');
  const day7 = await call('GET', '/api/tracks/full-stack-30/days/7');
  check('day 7 has a milestone project', !!day7.data?.day?.project);
  const projectId = day7.data.day.project.id;
  const proj = await call('GET', `/api/learn/projects/${projectId}`);
  check('the project has a checklist', proj.data?.project?.tasks?.length >= 8);
  const task = proj.data.project.tasks[0];
  await call('POST', `/api/learn/projects/tasks/${task.id}/toggle`, { done: true });
  const proj2 = await call('GET', `/api/learn/projects/${projectId}`);
  check('ticking a checklist item persists', proj2.data.project.tasks[0].done === true);
  check('completion percentage updates', proj2.data.completionPct > 0);
  const sub = await call('PUT', `/api/learn/projects/${projectId}/submission`, {
    repoUrl: 'https://github.com/kayyyy/day7',
    liveUrl: 'https://day7.example.com',
    notes: 'Lighthouse 97.',
  });
  check('project submission saves', sub.data?.progress?.repoUrl?.includes('github.com'));

  section('dashboard & leaderboard');
  const dash = await call('GET', '/api/learn/dashboard');
  const { stats } = await import('../packages/content/dist/index.js');
  check('dashboard lesson total matches the content package', dash.data?.totals?.lessons?.total === stats.lessons,
    `api ${dash.data?.totals?.lessons?.total} vs content ${stats.lessons}`);
  check('dashboard problem total matches the content package', dash.data?.totals?.problems?.total === stats.problems,
    `api ${dash.data?.totals?.problems?.total} vs content ${stats.problems}`);
  check('dashboard suggests a next day', typeof dash.data?.nextDay?.number === 'number');
  check('XP accumulated across activities', dash.data?.user?.xp > 100, `xp ${dash.data?.user?.xp}`);
  check('heatmap has today', dash.data?.heatmap?.length >= 1);

  const board = await call('GET', '/api/learn/leaderboard');
  check('leaderboard is ranked', board.data?.leaderboard?.[0]?.rank === 1);

  section('authorisation');
  const savedToken = token;
  token = null;
  const anon = await call('GET', '/api/learn/dashboard');
  check('the dashboard requires auth', anon.status === 401);
  token = 'not.a.real.token';
  const bogus = await call('GET', '/api/learn/dashboard');
  check('a forged token is rejected', bogus.status === 401);
  token = savedToken;

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
