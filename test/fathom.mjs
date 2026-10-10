// Fathom (games/fathom.html): runs the DOM-free <script id="core"> block in Node.
// Promises: a letter only ever goes to the creature it can belong to (first letters never collide),
// every metre is paid for by a finished word, hull and flares count the way the HUD shows,
// a seed is the same dive, every specimen takes the same time to arrive from any bearing on any screen,
// and typists sink deeper in order of their speed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../games/fathom.html', import.meta.url)), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const g = {}; new Function('globalThis', 'window', src)(g, undefined);
const C = g.FathomCore;

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log('  FAIL', msg); } }
const suites = {};

suites.words = () => {
  const set = new Set(C.WORDS);
  ok(set.size === C.WORDS.length, 'no duplicate words (' + (C.WORDS.length - set.size) + ')');
  ok(C.WORDS.every(w => /^[a-z]{3,13}$/.test(w)), 'every word is 3-13 lowercase letters');
  for (const k of C.KINDS) for (let n = k.len[0]; n <= k.len[1]; n++) {
    const letters = new Set(C.WORDS.filter(w => w.length === n).map(w => w[0]));
    ok(letters.size >= (n <= 7 ? 10 : 4), `${k.id}: length ${n} words start with ${letters.size} letters`);
  }
};

suites.rules = () => {
  const s = C.newRun(7, 800, 800);
  const f = C.spawn(s, C.KINDS[2], { ang: -1.2, p: 0.3, word: 'coral' });
  C.spawn(s, C.KINDS[0], { ang: -2, p: 0.3, word: 'reef' });
  ok(C.key(s, 'x').some(e => e.type === 'miss') && s.chain === 0, 'a letter nothing starts with is a miss');
  ok(C.key(s, 'c').some(e => e.type === 'lock') && s.target === f.id, 'first letter locks the one creature it starts');
  ok(C.key(s, 'r').some(e => e.type === 'miss') && s.target === f.id && f.typed === 1, 'a locked word refuses another word\'s letter and keeps its progress');
  C.back(s); ok(s.target === 0 && f.typed === 0, 'backspace abandons the word and clears its letters');
  C.key(s, 'r'); ok(s.target !== f.id, 'after letting go, a letter can pick another creature');
  C.back(s);
  const d0 = s.depth;
  const s2 = C.newRun(7, 800, 800); C.spawn(s2, C.KINDS[2], { ang: -1.2, p: 0.3, word: 'coral' });
  let e2 = []; for (const ch of 'coral') e2 = e2.concat(C.key(s2, ch));
  const c2 = e2.find(e => e.type === 'catch');
  ok(c2 && s2.depth === C.START + C.fathomsFor('coral', 0) && c2.fathoms === s2.depth - C.START, 'a finished word pays exactly fathomsFor');
  ok(s2.foes.length === 0 && s2.chain === 1 && s2.caught.jelly === 1, 'the catch is removed, chained and logged');
  ok(d0 === C.START, 'nothing pays before a word is finished');
  ok(C.fathomsFor('abcdefghij', 20) === 2 * C.fathomsFor('abcdefghij', 0) && C.fathomsFor('abcde', 99) === C.fathomsFor('abcde', 20), 'chain doubles pay at 20 and stops there');
  // squid sheds two lanternfish
  const s3 = C.newRun(3, 800, 800); C.spawn(s3, C.KINDS.find(k => k.id === 'squid'), { ang: -1, p: 0.3, word: 'velvet' });
  for (const ch of 'velvet') C.key(s3, ch);
  ok(s3.foes.length === 2 && s3.foes.every(f => f.kind === 'lantern'), 'a vampire squid sheds two lanternfish');
};

suites.hull = () => {
  const s = C.newRun(1, 600, 900);
  let breaches = 0, over = false;
  for (let i = 0; i < 20000 && !over; i++) for (const e of C.step(s, 1 / 60)) { if (e.type === 'breach') { breaches++; ok(e.hull === C.HULL - breaches, 'hull falls by one per breach'); } if (e.type === 'over') over = true; }
  ok(over && breaches === C.HULL && s.hull === 0, 'an idle player is breached exactly HULL times and the dive ends');
  ok(s.t > 12 && s.t < 60, 'idle dive lasts ' + s.t.toFixed(1) + 's (12-60)');
  ok(C.step(s, 1).length === 0 && C.key(s, 'a').length === 0, 'nothing happens after the end');
  // flares
  const f = C.newRun(2, 800, 800);
  for (let i = 0; i < 300; i++) C.step(f, 1 / 60);
  const n = f.foes.length; const ev = C.flare(f);
  ok(n > 0 && f.foes.length === 0 && f.flares === 0 && ev[0].foes.length === n, 'a flare clears every creature and costs one charge');
  ok(f.depth === C.START, 'a flare pays no fathoms');
  C.spawn(f); C.flare(f); ok(f.foes.length === 1 && f.flares === 0, 'no charge, no flare');
};

// the same arrival time wherever a specimen starts and whatever the screen: fair on a phone and a wide monitor
suites.arrival = () => {
  const times = [];
  for (const [w, h] of [[1280, 800], [1920, 1080], [390, 760], [390, 420], [844, 390], [1024, 1366]]) {
    for (let k = 0; k < 12; k++) {
      const s = C.newRun(k, w, h); s.spawnIn = 1e9;
      const [a0, a1] = C.arc(s), f = C.spawn(s, C.KINDS[2], { ang: a0 + (a1 - a0) * (k + 0.5) / 12, word: 'coral' });
      f.spd = C.KINDS[2].spd;
      const b = C.bell(s), br = C.bellR(s);
      let t = 0, touched = false;
      while (!s.over && t < 60) {
        const ev = C.step(s, 1 / 120); t += 1 / 120;
        if (ev.some(e => e.type === 'breach')) { touched = true; ok(Math.hypot(ev[0].x - b.x, ev[0].y - b.y) < br + 30, 'a breach happens at the bell'); break; }
        if (s.foes[0] && Math.hypot(s.foes[0].x - b.x, s.foes[0].y - b.y) < br - 2) { ok(false, 'a specimen passed inside the bell without a breach'); break; }
      }
      ok(touched, `${w}x${h} bearing ${k}: arrives`); times.push(t);
    }
  }
  const lo = Math.min(...times), hi = Math.max(...times);
  ok(hi / lo < 1.12, `arrival time ${lo.toFixed(2)}-${hi.toFixed(2)} s is the same within 12% everywhere`);
};

suites.letters = () => {
  // over many random dives with random typing, live first letters never collide and a lock is always the only candidate
  for (let seed = 1; seed <= 60; seed++) {
    const s = C.newRun(seed, seed % 2 ? 390 : 1280, seed % 2 ? 560 : 800, { speedMul: 0.5 });
    const r = C.rng(seed * 99);
    for (let i = 0; i < 6000 && !s.over; i++) {
      C.step(s, 1 / 60);
      if (r() < 0.25) {
        const tg = C.find(s, s.target);
        const ch = tg && r() < 0.9 ? tg.word[tg.typed] : s.foes.length && r() < 0.8 ? s.foes[Math.floor(r() * s.foes.length)].word[0] : 'abcdefghijklmnopqrstuvwxyz'[Math.floor(r() * 26)];
        C.key(s, ch);
      }
      const firsts = s.foes.map(f => f.word[0]);
      if (new Set(firsts).size !== firsts.length) { ok(false, 'seed ' + seed + ': first letters collide ' + firsts); break; }
      if (s.foes.some(f => f.word.length > (s.w < 420 ? 10 : 12))) { ok(false, 'seed ' + seed + ': word too long for the screen'); break; }
    }
  }
  ok(true, 'letters');
};

suites.seed = () => {
  const go = () => { const s = C.newRun(42, 800, 800); const out = [];
    for (let i = 0; i < 3000; i++) { C.step(s, 1 / 60); out.push(s.foes.map(f => f.word + (f.x | 0)).join()); } return out.join('|'); };
  ok(go() === go(), 'a seed is the same dive');
  // a phone's keyboard opening mid-dive: every specimen keeps its bearing and how far along it is
  const s = C.newRun(5, 390, 760); for (let i = 0; i < 200; i++) C.step(s, 1 / 60);
  const before = s.foes.map(f => [f.ang, f.p]); C.resize(s, 390, 420);
  ok(s.foes.length > 0 && s.foes.every((f, i) => f.ang === before[i][0] && f.p === before[i][1]), 'resize keeps bearing and progress');
  ok(C.low({ w: 390, h: 420 }) && !C.low({ w: 390, h: 760 }), 'a short window hangs the bell low');
  const a = C.arc({ w: 390, h: 420 });
  ok(s.foes.every(f => C.onScreen(s, f) || f.p < 0.5), 'nothing is stranded off screen after the resize');
  ok(a[0] > -Math.PI && a[1] < 0, 'with the bell low, specimens come only from above');
};

// A typist: reacts after `react` s, picks the creature closest to the bell, types at `wpm` with `slip` chance per key.
function typist(seed, wpm, slip, react, w = 1000, h = 800) {
  const s = C.newRun(seed, w, h), r = C.rng(seed + 1000), dt = 1 / 60;
  let wait = react, nextKey = 0;
  const per = 60 / (wpm * 5);
  while (!s.over && s.t < 900) {
    C.step(s, dt);
    nextKey -= dt;
    if (nextKey > 0) continue;
    let tg = C.find(s, s.target);
    if (!tg) {
      const b = C.bell(s);
      const vis = s.foes.filter(f => C.onScreen(s, f)).sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y));
      if (!vis.length) continue;
      if (wait > 0) { wait -= dt; continue; }
      if (s.flares && vis.length >= 5 && Math.hypot(vis[0].x - b.x, vis[0].y - b.y) < h * 0.2) { C.flare(s); continue; }
      tg = vis[0]; wait = react;
      C.key(s, tg.word[tg.typed]); nextKey = per; continue;
    }
    C.key(s, r() < slip ? 'q' : tg.word[tg.typed]);
    nextKey = per * (0.7 + r() * 0.6);
  }
  return C.stats(s);
}
suites.bots = () => {
  const levels = [[20, 0.08, 0.6], [40, 0.05, 0.45], [65, 0.03, 0.35], [95, 0.02, 0.3]];
  const res = levels.map(([wpm, slip, rt]) => {
    let d = 0, t = 0; const N = 12;
    for (let i = 0; i < N; i++) { const st = typist(100 + i, wpm, slip, rt); d += st.depth; t += st.time; }
    return { wpm, depth: d / N, time: t / N };
  });
  for (const r of res) console.log(`    ${r.wpm} wpm: ${Math.round(r.depth)} fathoms in ${(r.time / 60).toFixed(1)} min`);
  for (let i = 1; i < res.length; i++) ok(res[i].depth > res[i - 1].depth * 1.15, `${res[i].wpm} wpm dives deeper than ${res[i - 1].wpm}`);
  ok(res[0].time > 45 && res[0].time < 240, 'a 20 wpm dive lasts 0.75-4 minutes');
  ok(res[1].depth > 550, 'an average typist reaches the midnight zone');
  ok(res[1].depth < 3300, 'an average typist does not reach the hadal zone');
  ok(res[3].depth > 2200, 'a fast typist reaches the abyss');
  ok(res[3].time < 900, 'even a fast typist is caught eventually');
};

const want = process.argv.slice(2);
for (const [name, fn] of Object.entries(suites)) {
  if (want.length && !want.includes(name)) continue;
  console.log(name); fn();
}
console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
