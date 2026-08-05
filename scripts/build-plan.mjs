/**
 * Renders the 30-day plan to a single self-contained HTML page.
 *   node scripts/build-plan.mjs > out/study-plan.html
 */
import { days, stats, track } from '../packages/content/dist/index.js';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const WEEKS = [
  { week: 1, title: 'Frontend Core' },
  { week: 2, title: 'Frameworks & State' },
  { week: 3, title: 'Backend & APIs' },
  { week: 4, title: 'Data Layer' },
  { week: 5, title: 'DevOps & Capstone' },
];

const PILLARS = ['FOUNDATIONS', 'FRONTEND', 'BACKEND', 'DATABASE', 'DEVOPS'];

const dayCard = (d) => `
<article class="day" data-pillar="${d.pillar}" data-tech="${esc(d.technologies.join('|').toLowerCase())}">
  <button class="day-head" aria-expanded="false">
    <span class="num">${d.day}</span>
    <span class="head-text">
      <span class="title">${esc(d.title)}</span>
      <span class="summary">${esc(d.summary)}</span>
    </span>
    <span class="meta">
      <span class="pill p-${d.pillar.toLowerCase()}">${d.pillar.toLowerCase()}</span>
      <span class="hours">${Math.round(d.estimatedMinutes / 60)}h</span>
      <span class="chev" aria-hidden="true">▾</span>
    </span>
  </button>
  <div class="day-body" hidden>
    <div class="techs">${d.technologies.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <div class="cols">
      <section>
        <h4>By the end of the day you can</h4>
        <ul class="obj">${d.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
      </section>
      <section>
        <h4>Lessons <span class="c">${d.lessons.length}</span></h4>
        <ol class="lessons">${d.lessons
          .map((l) => `<li>${esc(l.title)} <span class="mins">${l.estimatedMinutes}m</span></li>`)
          .join('')}</ol>
      </section>
      <section>
        <h4>Practice <span class="c">${d.problems.length}</span></h4>
        <ul class="probs">${d.problems
          .map(
            (p) =>
              `<li><span class="d-${p.difficulty.toLowerCase()}">${p.difficulty.toLowerCase()}</span> ${esc(p.title)} <span class="mins">+${p.xp} XP</span></li>`,
          )
          .join('')}</ul>
        <p class="extra">${d.quiz.length}-question quiz · ${d.flashcards.length} flashcards</p>
        ${
          d.project
            ? `<p class="proj">🏗 <strong>${esc(d.project.title)}</strong> — ${d.project.estimatedHours}h, ${d.project.checklist.length} acceptance criteria</p>`
            : ''
        }
      </section>
    </div>
  </div>
</article>`;

const coverage = () => {
  const map = new Map();
  for (const d of days) for (const t of d.technologies) {
    if (!map.has(t)) map.set(t, []);
    map.get(t).push(d.day);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tech, ds]) => `<tr><td>${esc(tech)}</td><td class="days">${ds.join(', ')}</td></tr>`)
    .join('');
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(track.title)} — Study Plan</title>
<style>
  :root {
    color-scheme: dark;
    --bg:#0a0c12; --card:#0f1219; --card2:#141821; --line:#252b3a; --line2:#1a1f2b;
    --text:#e2e8f0; --muted:#94a3b8; --dim:#64748b;
    --blue:#3b82f6; --green:#22c55e; --purple:#a855f7; --orange:#f97316; --slate:#94a3b8;
  }
  * { box-sizing:border-box; }
  body {
    margin:0; background:var(--bg); color:var(--text);
    font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Inter,sans-serif;
  }
  .wrap { max-width:1100px; margin:0 auto; padding:40px 20px 80px; }
  header h1 { font-size:2rem; margin:0 0 6px; letter-spacing:-.02em; }
  header p { margin:0; color:var(--muted); max-width:60ch; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:12px; margin:28px 0 8px; }
  .stat { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .stat b { display:block; font-size:1.6rem; line-height:1.2; }
  .stat span { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--dim); }

  .controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:28px 0 20px;
              position:sticky; top:0; background:var(--bg); padding:12px 0; z-index:5; border-bottom:1px solid var(--line2); }
  .controls input { flex:1; min-width:200px; background:var(--bg); border:1px solid var(--line);
                    border-radius:8px; padding:8px 12px; color:var(--text); font:inherit; font-size:14px; }
  .controls input:focus { outline:none; border-color:var(--blue); }
  .filter { background:var(--card2); border:1px solid var(--line); color:var(--muted);
            border-radius:999px; padding:5px 12px; font-size:12px; cursor:pointer; }
  .filter[aria-pressed="true"] { background:var(--blue); border-color:var(--blue); color:#fff; }
  .ghost { background:none; border:1px solid var(--line); color:var(--muted); border-radius:8px;
           padding:6px 12px; font-size:12px; cursor:pointer; }
  .ghost:hover { color:var(--text); }

  h2.week { display:flex; align-items:center; gap:12px; font-size:12px; text-transform:uppercase;
            letter-spacing:.08em; color:var(--muted); margin:34px 0 12px; font-weight:600; }
  h2.week::after { content:""; flex:1; height:1px; background:var(--line2); }
  h2.week .r { color:var(--dim); font-weight:400; letter-spacing:0; text-transform:none; }

  .day { background:var(--card); border:1px solid var(--line); border-radius:12px; margin-bottom:8px; overflow:hidden; }
  .day-head { width:100%; display:flex; gap:14px; align-items:center; padding:14px 16px; background:none;
              border:0; color:inherit; font:inherit; text-align:left; cursor:pointer; }
  .day-head:hover { background:var(--card2); }
  .num { flex:none; width:34px; height:34px; display:grid; place-items:center; border-radius:9px;
         background:var(--card2); color:var(--muted); font-weight:700; font-size:14px; }
  .head-text { flex:1; min-width:0; }
  .title { display:block; font-weight:600; }
  .summary { display:block; font-size:13px; color:var(--dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .meta { flex:none; display:flex; align-items:center; gap:10px; }
  .hours { font-size:12px; color:var(--dim); }
  .chev { color:var(--dim); transition:transform .18s; font-size:12px; }
  .day-head[aria-expanded="true"] .chev { transform:rotate(180deg); }

  .pill { font-size:11px; border-radius:999px; padding:2px 9px; border:1px solid; }
  .p-foundations { color:var(--slate); border-color:#94a3b866; background:#94a3b81a; }
  .p-frontend   { color:var(--blue);   border-color:#3b82f666; background:#3b82f61a; }
  .p-backend    { color:var(--green);  border-color:#22c55e66; background:#22c55e1a; }
  .p-database   { color:var(--purple); border-color:#a855f766; background:#a855f71a; }
  .p-devops     { color:var(--orange); border-color:#f9731666; background:#f973161a; }

  .day-body { padding:0 16px 18px; border-top:1px solid var(--line2); }
  .techs { display:flex; flex-wrap:wrap; gap:6px; margin:14px 0 16px; }
  .tag { font-size:11px; background:var(--card2); border:1px solid var(--line); border-radius:999px;
         padding:2px 9px; color:var(--muted); }
  .cols { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:22px; }
  .cols h4 { margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--dim); font-weight:600; }
  .cols .c { color:var(--muted); }
  .cols ul, .cols ol { margin:0; padding-left:18px; font-size:13.5px; color:var(--muted); }
  .cols li { margin-bottom:5px; }
  .obj li::marker { color:var(--blue); }
  .mins { color:var(--dim); font-size:11px; }
  .d-easy   { color:#34d399; font-size:11px; }
  .d-medium { color:#fbbf24; font-size:11px; }
  .d-hard   { color:#fb7185; font-size:11px; }
  .extra { margin:10px 0 0; font-size:12px; color:var(--dim); }
  .proj { margin:8px 0 0; font-size:13px; color:#fcd34d; }

  table { width:100%; border-collapse:collapse; font-size:13.5px; margin-top:12px; }
  th, td { text-align:left; padding:7px 10px; border-bottom:1px solid var(--line2); }
  th { color:var(--dim); font-size:11px; text-transform:uppercase; letter-spacing:.06em; }
  td.days { color:var(--muted); font-variant-numeric:tabular-nums; }
  details > summary { cursor:pointer; color:var(--muted); font-weight:600; margin-top:40px; }

  .empty { color:var(--dim); font-size:14px; padding:24px 0; display:none; }
  footer { margin-top:50px; padding-top:20px; border-top:1px solid var(--line2); color:var(--dim); font-size:12.5px; }
  @media print { .controls { position:static; } .day-body { display:block !important; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${esc(track.title)}</h1>
    <p>${esc(track.tagline)} Four to six focused hours a day, every box on the roadmap.</p>
  </header>

  <div class="stats">
    <div class="stat"><b>${stats.days}</b><span>days</span></div>
    <div class="stat"><b>${stats.lessons}</b><span>lessons</span></div>
    <div class="stat"><b>${stats.problems}</b><span>coding problems</span></div>
    <div class="stat"><b>${stats.quizQuestions}</b><span>quiz questions</span></div>
    <div class="stat"><b>${stats.flashcards}</b><span>flashcards</span></div>
    <div class="stat"><b>${stats.projects}</b><span>projects</span></div>
    <div class="stat"><b>${Math.round(stats.totalMinutes / 60)}h</b><span>study time</span></div>
  </div>

  <div class="controls">
    <input id="q" type="search" placeholder="Filter by technology or topic — try “react”, “docker”, “sql”…" aria-label="Filter days">
    ${PILLARS.map((p) => `<button class="filter" data-pillar="${p}" aria-pressed="false">${p.toLowerCase()}</button>`).join('')}
    <button class="ghost" id="expand">Expand all</button>
    <button class="ghost" id="collapse">Collapse all</button>
  </div>

  <p class="empty" id="empty">Nothing matches that filter.</p>

  ${WEEKS.map((w) => {
    const ds = days.filter((d) => d.week === w.week);
    if (!ds.length) return '';
    return `<section class="week-block" data-week="${w.week}">
      <h2 class="week">Week ${w.week} · ${esc(w.title)} <span class="r">days ${ds[0].day}–${ds[ds.length - 1].day}</span></h2>
      ${ds.map(dayCard).join('')}
    </section>`;
  }).join('')}

  <details>
    <summary>Roadmap coverage — every technology and the day it is taught</summary>
    <table><thead><tr><th>Technology</th><th>Day(s)</th></tr></thead><tbody>${coverage()}</tbody></table>
  </details>

  <footer>
    Generated from the CodeNinja content package. Each day pairs lessons with an in-browser IDE,
    a server-graded quiz and spaced-repetition flashcards.
  </footer>
</div>

<script>
  const days = [...document.querySelectorAll('.day')];
  const q = document.getElementById('q');
  const empty = document.getElementById('empty');
  const active = new Set();

  days.forEach((d) => {
    const head = d.querySelector('.day-head');
    head.addEventListener('click', () => {
      const open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', String(!open));
      d.querySelector('.day-body').hidden = open;
    });
  });

  function apply() {
    const term = q.value.trim().toLowerCase();
    let shown = 0;
    days.forEach((d) => {
      const okPillar = active.size === 0 || active.has(d.dataset.pillar);
      const hay = (d.dataset.tech + ' ' + d.innerText).toLowerCase();
      const okTerm = !term || hay.includes(term);
      const show = okPillar && okTerm;
      d.style.display = show ? '' : 'none';
      if (show) shown++;
    });
    document.querySelectorAll('.week-block').forEach((w) => {
      const any = [...w.querySelectorAll('.day')].some((d) => d.style.display !== 'none');
      w.style.display = any ? '' : 'none';
    });
    empty.style.display = shown ? 'none' : 'block';
  }

  q.addEventListener('input', apply);
  document.querySelectorAll('.filter').forEach((b) => {
    b.addEventListener('click', () => {
      const p = b.dataset.pillar;
      if (active.has(p)) { active.delete(p); b.setAttribute('aria-pressed', 'false'); }
      else { active.add(p); b.setAttribute('aria-pressed', 'true'); }
      apply();
    });
  });
  document.getElementById('expand').addEventListener('click', () => {
    days.forEach((d) => { d.querySelector('.day-head').setAttribute('aria-expanded','true'); d.querySelector('.day-body').hidden = false; });
  });
  document.getElementById('collapse').addEventListener('click', () => {
    days.forEach((d) => { d.querySelector('.day-head').setAttribute('aria-expanded','false'); d.querySelector('.day-body').hidden = true; });
  });
</script>
</body>
</html>`;

process.stdout.write(html);
