#!/usr/bin/env node
// Test suite for games/flappy_bird.html (Fugue).
//
// Runs the page's DOM-free <script id="core"> block in Node. A flapper's one promise is that a death is the player's
// own: the physics is the same at any frame rate, the hitbox is the geometry you see, and every course a seed deals can
// be flown. The second promise is the tune: the course is the melody. The `page` suite plays the real page in Chromium.
//
//   node test/fugue.mjs                  # everything
//   node test/fugue.mjs physics fair     # named suites only
//   node test/fugue.mjs --page=path.html
//
// Suites: physics, hits, course, fair, bots, tune, score, save, page.

import {readFileSync} from 'fs';
import {fileURLToPath, pathToFileURL} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import {execSync} from 'child_process';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'flappy_bird.html'));
const ALL = ['physics', 'hits', 'course', 'fair', 'bots', 'tune', 'score', 'save', 'page'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const load = () => { const c = vm.createContext({}); vm.runInContext(core[1] + '\nthis.F = FUGUE;', c); return c.F; };
const F = load(), K = F.K, STEP = F.STEP;

// a small seeded PRNG so every run of the suite is the same run
const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const gauss = r => { let u = 0, v; while (!u) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const clear = p => p.cx + (p.w + K.COLLAR_EXTRA) / 2 + K.R;       // where the bird has cleared a pair
// the pipe the bird should be aiming at: the one it is in, until it is clear of it
const target = s => F.pipeAt(s.course, s.score);        // a pair is the target until it has been cleared

if (suites.includes('physics')) {
  section('physics: the same flight at any frame rate, and nothing to argue with');
  // one schedule of presses, three display speeds: presses land on the same physics step, so the bird must end in the same place
  const presses = [8, 56, 92, 140, 204, 264, 332, 400];       // physics steps, all multiples of 4
  const fly = frameSteps => { const s = F.create('phys'); for (let i = 0; i < 480; i += frameSteps) { if (presses.includes(i)) F.flap(s); F.advance(s, frameSteps * STEP); } return s; };
  const r1 = fly(1), r2 = fly(2), r4 = fly(4);
  check(near(r1.y, r2.y) && near(r1.y, r4.y) && near(r1.vy, r4.vy) && near(r1.x, r4.x) && r1.alive === r4.alive, 'the same presses at 120, 60 and 30 fps end in the same place');
  // the 'dt' the display hands over never runs time backwards or too far
  const s = F.create('x'); F.advance(s, -5); check(s.t === 0 && s.x === 0, 'negative time does nothing');
  const s2 = F.create('x'); F.advance(s2, 100); check(s2.t <= .26, 'a long stall (a hidden tab) advances at most a quarter second', 't=' + s2.t);
  // a flap is the same flap each time: it sets the speed, it does not add to it
  const f1 = F.create('f'); F.flap(f1); F.advance(f1, STEP); const v1 = f1.vy;
  const f2 = F.create('f'); for (let i = 0; i < 5; i++) { F.flap(f2); F.advance(f2, STEP); }
  check(near(v1, K.FLAP + K.G * STEP), 'a flap sets the vertical speed to a fixed value');
  check(f2.vy > K.FLAP && f2.vy < 0, 'five flaps are not a bigger flap');
  // how high a single flap takes the bird: v^2 / 2g
  const h = F.create('h'); h.y = 400; F.flap(h); let top = h.y; for (let i = 0; i < 120; i++) { F.advance(h, STEP); top = Math.min(top, h.y); }
  check(Math.abs((400 - top) - K.FLAP * K.FLAP / (2 * K.G)) < 2, 'one flap rises v^2/2g (about 59 units)', 'rose ' + (400 - top).toFixed(1));
  // terminal velocity, the ceiling, the floor
  const t = F.create('t'); t.y = -100; t.y = K.CEIL; for (let i = 0; i < 400; i++) { F.advance(t, STEP); if (!t.alive) break; }
  check(t.vy <= K.VMAX + 1e-9, 'a fall never exceeds terminal speed');
  const ce = F.create('c'); ce.y = 20; for (let i = 0; i < 30; i++) { F.flap(ce); F.advance(ce, STEP * 3); }
  check(ce.y >= K.CEIL - 1e-9 && ce.alive, 'the ceiling holds the bird in and does not kill it');
  // idle and masher die on their own
  const idle = F.create('i'); let tt = 0; while (idle.alive && tt < 30) { F.advance(idle, STEP); tt += STEP; }
  check(!idle.alive && idle.cause === 'floor' && idle.score === 0, 'a bird left alone falls to the floor before the first pipe');
  const mash = F.create('m'); tt = 0; let n = 0; while (mash.alive && tt < 30) { if (n++ % 8 === 0) F.flap(mash); F.advance(mash, STEP); tt += STEP; }
  check(!mash.alive && mash.score === 0, 'a bird flapping flat out hits the first pipe on the ceiling');
  // death is final: the world stops, the bird falls and rests, a flap is refused
  const d = F.create('d'); while (d.alive) F.advance(d, STEP);
  const dx = d.x; check(F.flap(d) === false, 'a flap after death is refused');
  let settled = false, evs = []; for (let i = 0; i < 600; i++) { evs.push(...F.advance(d, STEP)); if (d.settled) { settled = true; break; } }
  check(near(d.x, dx) && settled && near(d.y, K.FLOOR - K.R), 'after death the world stops and the bird comes to rest on the floor');
  check(evs.filter(e => e.type === 'settle').length === 1, 'it settles exactly once');
  // continuity: the bird never moves further than its own radius in one step
  const sp = F.create('sp'); let maxMove = 0, py = sp.y;
  for (let i = 0; i < 2000 && sp.alive; i++) { if (i % 40 === 0) F.flap(sp); F.advance(sp, STEP); maxMove = Math.max(maxMove, Math.abs(sp.y - py), K.SPEED * STEP); py = sp.y; }
  check(maxMove < K.R / 2, 'no step is long enough to tunnel through a pipe', 'max ' + maxMove.toFixed(2));
  // the picture between steps: view() lies between the last two states
  const vw = F.create('v'); F.flap(vw); F.advance(vw, STEP * 1.5);
  const vv = F.view(vw); check(vv.y <= Math.max(vw.py, vw.y) + 1e-9 && vv.y >= Math.min(vw.py, vw.y) - 1e-9, 'the drawn position lies between the last two physics steps');
}

if (suites.includes('hits')) {
  section('hits: the hitbox is the geometry the page draws');
  // an independent reference: sample the bird's disc densely and ask each sample whether it is inside any rectangle of the pipe
  const course = F.makeCourse('hits');
  const inside = (px, py, p) => {
    const hw = p.w / 2, cw = hw + K.COLLAR_EXTRA / 2;
    if (px >= p.cx - hw && px <= p.cx + hw && (py <= p.top || py >= p.bot)) return true;
    if (px >= p.cx - cw && px <= p.cx + cw && ((py >= p.top - K.COLLAR_H && py <= p.top) || (py >= p.bot && py <= p.bot + K.COLLAR_H))) return true;
    return false;
  };
  const ref = (x, y) => {
    let best = 1e9; // signed margin: positive when clear
    for (let i = 0; i < 4; i++) {
      const p = F.pipeAt(course, i);
      for (let a = 0; a < 720; a++) for (const rr of [K.R, K.R * .5, 0]) {
        const px = x + Math.cos(a / 720 * 6.2832) * rr, py = y + Math.sin(a / 720 * 6.2832) * rr;
        if (inside(px, py, p)) return true;
      }
    }
    return false;
  };
  const r = rng(7); let n = 0, bad = 0, ex;
  for (let i = 0; i < 1500; i++) {
    const p = F.pipeAt(course, Math.floor(r() * 3));
    const x = p.cx + (r() - .5) * 150, y = r() < .5 ? p.top + (r() - .5) * 90 : p.bot + (r() - .5) * 90;
    // skip the knife edge, where a sampled disc and an exact one may differ by a hair
    const exact = F.collides(course, x, y), a = ref(x, y);
    F.K.R += .6; const bigger = F.collides(course, x, y); F.K.R -= 1.2; const smaller = F.collides(course, x, y); F.K.R += .6;
    if (bigger === smaller) { n++; if (exact !== a) { bad++; ex = ex || `(${x.toFixed(1)}, ${y.toFixed(1)}) core ${exact} reference ${a}`; } }
  }
  check(bad === 0 && n > 800, `${n} random bird positions agree with a reference that samples the disc`, ex);
  // the middle of a gap is always safe, a pipe's body always deadly
  let ok = true; for (let i = 0; i < 40; i++) { const p = F.pipeAt(course, i); if (F.collides(course, p.cx, p.cy)) ok = false; if (!F.collides(course, p.cx, p.top - 20)) ok = false; if (!F.collides(course, p.cx, p.bot + 20)) ok = false; }
  check(ok, 'the centre of every gap is clear and the pipes either side of it are solid');
  // the gap is the gap: a bird that just fits goes through, a hair wider does not
  const p0 = F.pipeAt(course, 0), half = K.GAP / 2 - K.R;
  check(!F.collides(course, p0.cx, p0.cy + half - .01) && F.collides(course, p0.cx, p0.cy + half + .5 + K.COLLAR_H * 0), 'the bird fits the gap down to its radius');
  // the collar is wider than the pipe, and hits are judged on it
  const wide = p0.cx + p0.w / 2 + K.COLLAR_EXTRA / 2 - .5;
  check(F.collides(course, wide + K.R * .9, p0.top - K.COLLAR_H / 2) && !F.collides(course, p0.cx + p0.w / 2 + K.R + 1, p0.top - 60), 'the brass collar is solid and wider than the pipe');
  // the first pipe is where the page says, and further out on a wide screen
  const wideRun = F.create('w', 900); check(F.pipeAt(wideRun.course, 0).cx === 900, 'a wide screen pushes the first pipe past its right edge');
  check(F.pipeAt(F.create('w', 10).course, 0).cx === K.FIRST, 'it never pulls it nearer than the standard distance');
}

if (suites.includes('course')) {
  section('course: a seed is a course, and a course is a tune');
  const a = F.makeCourse('alpha'), b = F.makeCourse('alpha');
  const fw = Array.from({length: 120}, (_, i) => a.row(i));
  const bw = []; for (let i = 119; i >= 0; i--) bw[i] = b.row(i);
  check(fw.join() === bw.join(), 'a seed deals the same course however its pipes are asked for');
  check(F.makeCourse('beta').row(5) !== undefined && Array.from({length: 40}, (_, i) => F.makeCourse('beta').row(i)).join() !== fw.slice(0, 40).join(), 'different seeds deal different courses');
  let ok = true, tonic = true, steps = {}, upMax = 0, downMax = 0, lead = true, sum = 0, cnt = 0, cadenceOk = true;
  for (let s = 0; s < 300; s++) {
    const c = F.makeCourse('s' + s);
    if (c.row(0) !== 3) lead = false;
    for (let i = 0; i < 100; i++) {
      const r = c.row(i); if (r < 0 || r >= K.ROWS || !Number.isInteger(r)) ok = false;
      sum += r; cnt++;
      if ((i + 1) % F.PHRASE === 0 && r !== F.TONIC_ROW) tonic = false;
      if (i > 0) { const d = r - c.row(i - 1); steps[d] = (steps[d] || 0) + 1; if (d > upMax) upMax = d; if (-d > downMax) downMax = -d; }
    }
  }
  check(ok, 'every row is a whole row of the eight');
  check(lead, 'the first gap is where the bird starts');
  check(tonic, 'every eighth gap lands on the tonic (a phrase ends)');
  check(upMax <= F.UP_MAX && downMax <= F.DOWN_MAX, `no step is larger than the bird can make (up ${upMax} <= ${F.UP_MAX}, down ${downMax} <= ${F.DOWN_MAX})`);
  const total = Object.values(steps).reduce((x, y) => x + y, 0);
  check([-4, -3, -2, -1, 0, 1, 2, 3].every(d => (steps[d] || 0) / total > .01), 'every step size from a fall of four to a rise of three occurs');
  check(((steps[1] || 0) + (steps[-1] || 0) + (steps[2] || 0) + (steps[-2] || 0)) / total > .55, 'most steps are one or two rows (a tune, not noise)');
  const mean = sum / cnt; check(mean > 2.8 && mean < 4.2, 'the melody wanders but comes back to the middle', 'mean row ' + mean.toFixed(2));
  check(F.cleanSeed('  Ab-c.d/<script>') === 'Ab-c.dscript' && F.cleanSeed(null) === '' && F.cleanSeed('x'.repeat(100)).length === 24, 'seeds are cleaned to a short, safe string');
  check(F.randomSeed(() => .5).length === 6 && /^[a-z2-9]+$/.test(F.randomSeed()), 'a random seed is six easy characters');
  check(F.dateKey(new Date(Date.UTC(2026, 9, 9, 23, 59))) === '2026-10-09' && F.dailySeed('2026-10-09') === 'day-2026-10-09', 'a day is the same day everywhere (UTC)');
  const pw = Array.from({length: 8}, (_, r) => F.pipeW(r));
  check(pw.every((w, i) => i === 0 || w < pw[i - 1]) && pw[0] - pw[7] > 25, 'pipes get narrower as they get higher, by a width you can see');
}

if (suites.includes('fair')) {
  section('fair: every course can be flown');
  // exhaustive depth-first search over flap / no flap every 4 physics steps (30 Hz), with memoised dead ends. If it finds a way,
  // a way exists. It is run on the real core, so the check cannot disagree with the game.
  const passable = (seed, count, D, first) => {
    const course = F.makeCourse(seed, first), goal = clear(F.pipeAt(course, count - 1)) + 1, dead = new Set();
    const go = (s, k) => {
      if (s.x >= goal) return true;
      const key = k + '|' + Math.round(s.y / 2) + '|' + Math.round(s.vy / 12);
      if (dead.has(key)) return false;
      const p = target(s), pref = s.y > p.cy + 25 ? 1 : 0;
      for (const act of [pref, 1 - pref]) {
        const c = {...s}; if (act) F.flap(c); let alive = true;
        for (let i = 0; i < D; i++) { F.advance(c, STEP); if (!c.alive) { alive = false; break; } }
        if (alive && go(c, k + 1)) return true;
      }
      dead.add(key); return false;
    };
    const s0 = F.create(seed, first); s0.course = course;
    return go(s0, 0);
  };
  let bad = [];
  for (let i = 0; i < 40; i++) if (!passable('seed' + i, 40, 4, 330)) bad.push(i);
  check(bad.length === 0, '40 seeds, 40 pipes each: a way through exists at 30 Hz decisions', 'unflyable: ' + bad.join());
  bad = []; for (let i = 0; i < 10; i++) if (!passable('long' + i, 100, 4, 330)) bad.push(i);
  check(bad.length === 0, 'a hundred pipes on 10 more seeds: still flyable to the end', 'unflyable: ' + bad.join());
  bad = []; for (let i = 0; i < 12; i++) if (!passable('wide' + i, 24, 4, 900)) bad.push(i);
  check(bad.length === 0, 'and with the first pipe pushed out for a wide screen', 'unflyable: ' + bad.join());
  // slack: a bird 8 units fatter and a player who can only decide every 67 ms must still get through, so the way is not a knife edge
  const R0 = K.R; K.R = R0 + 8; bad = [];
  for (let i = 0; i < 20; i++) if (!passable('slack' + i, 30, 8, 330)) bad.push(i);
  K.R = R0;
  check(bad.length === 0, 'a bird 8 units fatter, deciding every 67 ms, still gets through 30 pipes on 20 seeds', 'unflyable: ' + bad.join());
}

// bots: a player reads the next gap and flaps when the bird would fall below the middle of it, a little after they meant to
const bot = (seed, sigma, delay, rs, maxScore = 60) => {
  const s = F.create(seed), r = rng(rs); let q = null, tt = 0;
  while (s.alive && s.score < maxScore && tt < 200) {
    const p = target(s);
    const yp = s.y + s.vy * delay + .5 * K.G * delay * delay;     // they know where the bird will be by the time their finger lands
    if (q === null && yp > p.cy + 25 && s.vy > -120) q = tt + Math.max(0, delay + gauss(r) * sigma);
    if (q !== null && tt >= q) { F.flap(s); q = null; }
    F.advance(s, STEP); tt += STEP;
  }
  return s;
};

if (suites.includes('bots')) {
  section('bots: skill is paid in order');
  const med = (sigma, delay) => { const sc = []; for (let i = 0; i < 60; i++) sc.push(bot('b' + i, sigma, delay, i + 3).score); sc.sort((a, b) => a - b); return {m: sc[30], lo: sc[6], hi: sc[53]}; };
  const steady = med(.02, .1), avg = med(.04, .1), sloppy = med(.07, .1), poor = med(.11, .1);
  console.log(`  medians (10th/50th/90th pct): steady ${steady.lo}/${steady.m}/${steady.hi}, average ${avg.lo}/${avg.m}/${avg.hi}, sloppy ${sloppy.lo}/${sloppy.m}/${sloppy.hi}, poor ${poor.lo}/${poor.m}/${poor.hi}`);
  check(steady.m > avg.m && avg.m > sloppy.m && sloppy.m >= poor.m, 'a steadier hand scores more: steady > average > sloppy >= poor');
  check(steady.m >= 8, 'a steady player gets well into double figures', 'median ' + steady.m);
  check(avg.m >= 2 && avg.m <= 14, 'an average player is hooked, not walled: a few gaps, not none and not fifty', 'median ' + avg.m);
  check(poor.m <= 4, 'a very loose hand does not walk through the course', 'median ' + poor.m);
  // a player with perfect timing and the same simple rule goes a long way (the exhaustive `fair` suite is the proof that a way exists)
  const sc = []; for (let i = 0; i < 40; i++) sc.push(bot('p' + i, 0, 0, 1, 100).score); sc.sort((a, b) => a - b);
  check(sc[20] >= 25, 'perfect timing and a plain rule fly a median of 25 gaps or more', 'median ' + sc[20]);
  // time never helps: the pace never changes, so a run of 100 is not easier or harder than a run of 10
  check(K.SPEED === 140 && F.create('x').x === 0, 'the hall goes by at one speed from the first gap to the last');
}

if (suites.includes('tune')) {
  section('tune: the pipes you pass are the notes you hear');
  const f = r => F.freq(r);
  check(Array.from({length: 7}, (_, r) => f(r + 1) > f(r)).every(Boolean), 'a higher gap is a higher note');
  check(near(f(0), 261.6256, 1e-3) && near(f(5) / f(0), 2, 1e-9), 'row 0 is middle C and the tonic row is an octave above it');
  const pcs = new Set(F.SCALE.map(x => x % 12)); check([...pcs].sort((a, b) => a - b).join() === '0,2,4,7,9', 'the eight rows are a pentatonic scale: no semitone, no tritone');
  const c = F.makeCourse('tune');
  check(F.chord(c, 0).length === 1 && F.chord(c, 7).length === 1, 'the first eight gaps are one voice');
  check(F.chord(c, 8).length === 2 && F.chord(c, 16).length === 3 && F.chord(c, 24).length === 4 && F.chord(c, 80).length === 4, 'a voice comes in at 8, 16 and 24 gaps and no more');
  let ok = true, canon = true, pitch = true;
  for (let n = 0; n < 120; n++) {
    const ch = F.chord(c, n);
    if (ch[0].voice !== 0 || ch[0].row !== c.row(n) || ch[0].semis !== 0) ok = false;
    for (const v of ch) { const def = F.VOICES[v.voice]; if (v.row !== c.row(n - def.delay)) canon = false; if (n - def.delay < 0) ok = false; }
    for (const v of ch) if (!pcs.has(((F.SCALE[v.row] + v.semis) % 12 + 12) % 12)) pitch = false;
  }
  check(ok, 'voice one is the pipe you are passing; no voice sings a pipe that has not been passed');
  check(canon, 'each later voice repeats the melody that many pipes late (a canon)');
  check(pitch, 'every note of every voice is in the scale, in whatever octave');
  check(F.VOICES.every(v => v.gain > 0 && v.gain <= 1), 'every voice has a sane volume');
  const freqs = []; for (let n = 0; n < 120; n++) for (const v of F.chord(c, n)) freqs.push(F.freq(v.row, v.semis));
  check(Math.min(...freqs) > 30 && Math.max(...freqs) < 4200, 'every note is inside what a speaker and an ear take', `${Math.min(...freqs).toFixed(0)}-${Math.max(...freqs).toFixed(0)} Hz`);
  // the page's own sound code only asks the core for notes
  check(/FUGUE\.chord\(run\.course, e\.n\)/.test(HTML) && /FUGUE\.freq\(v\.row, v\.semis\)/.test(HTML), 'the page plays exactly the chord the core names');
}

if (suites.includes('score') || suites.includes('physics')) {
  section('score: a point is a pair cleared, once, in order');
  let ok = true, seq = true, evCount = 0, final = true;
  for (let i = 0; i < 12; i++) {
    const s = F.create('sc' + i), r = rng(i + 1); let q = null, tt = 0, last = -1, passes = 0;
    while (s.alive && tt < 90) {
      const p = target(s); if (s.y > p.cy + 25 && s.vy > -120 && r() < .9) F.flap(s);
      for (const e of F.advance(s, STEP)) if (e.type === 'pass') { passes++; if (e.n !== last + 1) seq = false; last = e.n; if (e.score !== passes) ok = false; const pp = F.pipeAt(s.course, e.n); if (s.x < clear(pp) || s.x > clear(pp) + K.SPEED * STEP + 1e-9) ok = false; }
      tt += STEP;
    }
    if (s.score !== passes) final = false; evCount += passes;
  }
  check(ok, 'a pass is reported the moment the bird has cleared the pair, with the running score');
  check(seq, 'passes come in order, none skipped, none twice');
  check(final && evCount > 20, 'the score is the number of passes');
  // a pair that has scored can no longer kill you: nobody dies inside a pair they were credited for
  let unjust = 0, deaths = 0;
  for (let i = 0; i < 60; i++) {
    const s = bot('j' + i, .05, .1, i + 1, 60); if (s.alive) continue; deaths++;
    for (let n = 0; n < s.score; n++) { const p = F.pipeAt(s.course, n); if (Math.abs(s.x - p.cx) < p.w / 2 + K.COLLAR_EXTRA / 2 + K.R) unjust++; }
  }
  check(deaths > 30 && unjust === 0, 'a bird is never killed by a pair it has already been credited for', `${unjust} of ${deaths} deaths`);
}

if (suites.includes('save')) {
  section('save: what is kept, and trusting nothing');
  const today = '2026-10-09';
  let s = F.sanitize(null, today);
  check(s.best === 0 && s.sound === true && s.mode === 'free' && s.daily.best === 0 && s.daily.played === false, 'no save is a fresh one');
  check(F.sanitize('{not json', today).best === 0 && F.sanitize(42, today).best === 0 && F.sanitize([], today).best === 0, 'garbage is a fresh save');
  s = F.sanitize({best: 12.9, runs: -3, mode: 'daily', sound: false, daily: {key: today, best: 7}}, today);
  check(s.best === 12 && s.runs === 0 && s.mode === 'daily' && s.sound === false && s.daily.best === 7 && s.daily.played, 'good numbers are kept and floored, bad ones clamped');
  s = F.sanitize({best: 'lots', daily: {key: '<b>', best: 1e12}, mode: 'cheat'}, today);
  check(s.best === 0 && s.daily.key === '' && s.daily.best === 0 && s.mode === 'free', 'hostile values are refused');
  check(F.sanitize({best: 1e12}, today).best === 99999 && F.sanitize({best: Infinity}, today).best === 0, 'a best has a ceiling and is never infinite');
  // recording runs
  let r = F.record(null, 'free', today, 5); check(r.isBest && r.save.best === 5 && r.save.runs === 1, 'the first run is a best');
  r = F.record(r.save, 'free', today, 5); check(!r.isBest && r.save.best === 5, 'equalling a best is not beating it');
  r = F.record(r.save, 'free', today, 3); check(!r.isBest && r.save.best === 5, 'a worse run leaves it');
  r = F.record(r.save, 'free', today, 9); check(r.isBest && r.save.best === 9, 'a better run takes it');
  r = F.record(r.save, 'free', today, 0); check(!r.isBest, 'a run of nothing is never a best');
  // daily, and the day rolling over
  r = F.record(r.save, 'daily', today, 4); check(r.isBest && r.save.daily.best === 4 && r.save.daily.played && r.save.best === 9, 'the daily best is kept apart from the free best');
  check(F.bestFor(r.save, 'daily', today) === 4 && F.bestFor(r.save, 'daily', '2026-10-10') === 0 && F.bestFor(r.save, 'free', today) === 9, 'a new day starts the daily best at nothing');
  const next = F.sanitize(r.save, '2026-10-10'); check(next.daily.played === false && next.best === 9, 'and has not been played yet');
  r = F.record(r.save, 'daily', '2026-10-10', 2); check(r.isBest && r.save.daily.key === '2026-10-10' && r.save.daily.best === 2, 'playing it files today\'s best under today');
  r = F.record(r.save, 'seed', today, 50); check(!r.isBest && r.save.best === 9 && r.save.daily.best === 2, 'a shared course keeps no record');
  // round trip
  const again = F.sanitize(JSON.stringify(r.save), today); check(JSON.stringify(again) === JSON.stringify(r.save), 'a save survives being written and read back');
}

if (suites.includes('page')) {
  section('page: the real page in Chromium');
  let chromium = null;
  try { ({chromium} = await import('playwright')); } catch (e) {
    try { chromium = createRequire(join(execSync('npm root -g').toString().trim(), 'x'))('playwright').chromium; } catch (e2) { /* none */ }
  }
  if (!chromium) console.log('  skipped: Playwright is not installed');
  else {
    const browser = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
    const url = pathToFileURL(PAGE).href;
    const errors = [];
    const mk = async (opts, init) => {
      const ctx = await browser.newContext(opts); await ctx.route(/^https?:/, r => r.abort());
      if (init) await ctx.addInitScript(init);
      const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
      return {ctx, p};
    };
    const phase = p => p.evaluate(() => window.__fugue.phase);
    const until = async (p, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(f)) return true; await p.waitForTimeout(40); } return false; };
    for (const [name, opts] of [['desktop', {viewport: {width: 1280, height: 800}}], ['phone', {viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true}]]) {
      const {ctx, p} = await mk(opts);
      await p.goto(url); await p.waitForTimeout(500);
      check(await phase(p) === 'ready', `${name}: opens on the ready screen`);
      const lay = await p.evaluate(() => ({sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth,
        chips: document.getElementById('modes').getBoundingClientRect().height, word: getComputedStyle(document.getElementById('word')).opacity}));
      check(lay.sh <= lay.ih && lay.sw <= lay.iw, `${name}: nothing scrolls`);
      check(lay.chips > 0 && lay.chips < 62, `${name}: the course switch is one line`, 'height ' + lay.chips);
      check(await p.evaluate(() => getComputedStyle(document.getElementById('word')).opacity) === '1', `${name}: the title is showing`);
      // first input starts the run in the same step, and the wordmark leaves
      if (name === 'phone') await p.touchscreen.tap(200, 500); else await p.keyboard.press('Space');
      await p.waitForTimeout(60);
      check(await phase(p) === 'play' && await p.evaluate(() => window.__fugue.run.flaps >= 1), `${name}: the first tap starts the run and flaps`);
      await p.waitForTimeout(500);
      check(await p.evaluate(() => getComputedStyle(document.getElementById('word')).opacity) === '0', `${name}: the title has gone`);
      // keep the bird up for a while: a simple flapper, then let it die
      const y0 = await p.evaluate(() => window.__fugue.run.y);
      for (let i = 0; i < 6; i++) { if (name === 'phone') await p.touchscreen.tap(200, 500); else await p.keyboard.press('Space'); await p.waitForTimeout(110); }
      const y1 = await p.evaluate(() => window.__fugue.run.y); check(y1 < y0 + 60, `${name}: taps hold the bird up`, `${y0.toFixed(0)} -> ${y1.toFixed(0)}`);
      // pause: losing focus pauses, a tap resumes, the bird has not moved in between
      await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.waitForTimeout(100);
      const px = await p.evaluate(() => window.__fugue.run.x); await p.waitForTimeout(300); const px2 = await p.evaluate(() => window.__fugue.run.x);
      check(await p.evaluate(() => document.getElementById('pause').classList.contains('on')) && near(px, px2, 1e-6), `${name}: losing focus pauses the run`);
      if (name === 'phone') await p.touchscreen.tap(200, 500); else await p.keyboard.press('Space');
      await p.waitForTimeout(200); check(!(await p.evaluate(() => document.getElementById('pause').classList.contains('on'))), `${name}: a tap resumes it`);
      // now die, the card, the lock, retry
      check(await until(p, () => window.__fugue.phase === 'over', 9000), `${name}: the run ends and the card comes up`);
      const card = await p.evaluate(() => ({shown: document.getElementById('card').classList.contains('show'), num: document.getElementById('num').textContent, score: window.__fugue.run.score, rect: document.getElementById('card').getBoundingClientRect().toJSON(), iw: innerWidth, ih: innerHeight}));
      await p.waitForTimeout(1100);
      const num2 = await p.evaluate(() => document.getElementById('num').textContent);
      check(card.shown && num2 === String(card.score), `${name}: the card shows the score`, `card ${num2} run ${card.score}`);
      check(card.rect.left >= 0 && card.rect.right <= card.iw && card.rect.top >= 0 && card.rect.bottom <= card.ih, `${name}: the card sits inside the screen`);
      check(await p.evaluate(() => JSON.parse(localStorage.getItem('fugue.v1')).runs >= 1), `${name}: the run was filed`);
      if (name === 'phone') await p.touchscreen.tap(30, 30); else await p.keyboard.press('Enter');
      await p.waitForTimeout(500);
      check(await phase(p) === 'ready' && !(await p.evaluate(() => document.getElementById('card').classList.contains('show'))), `${name}: one more tap or Enter and it is ready to fly again`);
      check(await p.evaluate(() => getComputedStyle(document.getElementById('word')).opacity) === '0', `${name}: the title does not come back on a retry`);
      await ctx.close();
    }
    // the card cannot be skipped by the tap that killed you
    {
      const {ctx, p} = await mk({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
      await p.goto(url); await p.waitForTimeout(300); await p.touchscreen.tap(200, 500);
      await until(p, () => window.__fugue.phase === 'dying' || window.__fugue.phase === 'over', 6000);
      await p.touchscreen.tap(200, 500); await p.touchscreen.tap(200, 500); await p.waitForTimeout(120);
      const ph = await phase(p); check(ph === 'dying' || ph === 'over', 'tapping through your own death does not skip the card', ph);
      await ctx.close();
    }
    // a shared course, the daily course and what is remembered
    {
      const {ctx, p} = await mk({viewport: {width: 800, height: 700}});
      await p.goto(url + '?seed=Tune-1'); await p.waitForTimeout(300);
      const a = await p.evaluate(() => ({mode: window.__fugue.mode, seed: window.__fugue.run.seed, hidden: document.getElementById('modes').hidden, rows: Array.from({length: 12}, (_, i) => window.__fugue.run.course.row(i)).join('')}));
      check(a.mode === 'seed' && a.seed === 'Tune-1' && a.hidden, 'a ?seed= link plays that course and hides the switch');
      const c = F.makeCourse('Tune-1'); check(a.rows === Array.from({length: 12}, (_, i) => c.row(i)).join(''), 'and it is the same course the core deals offline');
      await p.goto(url + '?seed=%3Cb%3E'); await p.waitForTimeout(200);
      check(await p.evaluate(() => window.__fugue.run.seed) === 'b', 'a hostile seed is cleaned');
      await p.goto(url); await p.waitForTimeout(300);
      await p.click('#m-daily'); await p.waitForTimeout(100);
      const d = await p.evaluate(() => ({mode: window.__fugue.mode, seed: window.__fugue.run.seed, fresh: document.getElementById('m-daily').classList.contains('fresh')}));
      check(d.mode === 'daily' && /^day-\d{4}-\d\d-\d\d$/.test(d.seed) && d.fresh, 'the Daily switch deals today\'s course and marks it unplayed');
      await p.reload(); await p.waitForTimeout(300);
      check(await p.evaluate(() => window.__fugue.mode) === 'daily', 'the choice is remembered');
      await p.click('#m-free'); await p.waitForTimeout(50);
      const s1 = await p.evaluate(() => window.__fugue.run.seed); await p.click('#m-daily'); await p.click('#m-free'); await p.waitForTimeout(50);
      check(s1 !== await p.evaluate(() => window.__fugue.run.seed), 'a free flight deals a fresh course each time');
      await ctx.close();
    }
    // the hall moves rigidly: the ground is itself shifted by the camera step, and gliding the camera never makes the backdrop pop
    for (const [name, vp] of [['desktop', {width: 1280, height: 800}], ['phone', {width: 390, height: 844}]]) {
      const {ctx, p} = await mk({viewport: vp});
      await p.goto(url); await p.waitForTimeout(400);
      const r = await p.evaluate(() => {
        const cv = document.getElementById('c'), g = cv.getContext('2d');
        const frame = cam => { draw({cam, view: {x: 0, y: 300}, t: 0, course: null, winA: .62, feathers: [], notes: [], ready: 0, dim: 0, flash: 0, shake: null, bird: {y: -999, ang: 0, wing: 0, dead: false}, bloom: () => 0}); return g.getImageData(0, 0, cv.width, cv.height); };
        const s = V.s, dx = 20 / s, A = frame(1000), B = frame(1000 + dx), W = cv.width, H = cv.height, fy = Math.round(V.floorY);
        let bad = 0;
        for (let y = fy + 6; y < H; y++) for (let x = 0; x < W - 30; x++) { const i = (y * W + x) * 4, j = i + 80; if (Math.abs(B.data[i] - A.data[j]) + Math.abs(B.data[i + 1] - A.data[j + 1]) + Math.abs(B.data[i + 2] - A.data[j + 2]) > 24) bad++; }
        const diffs = []; let prev = frame(2000);
        for (let k = 1; k <= 240; k++) { const f = frame(2000 + k * 1.5); let sum = 0, n = 0; for (let y = 0; y < fy - 4; y += 3) for (let x = 0; x < W; x += 3) { const i = (y * W + x) * 4; sum += Math.abs(f.data[i] - prev.data[i]) + Math.abs(f.data[i + 1] - prev.data[i + 1]); n++; } diffs.push(sum / n); prev = f; }
        const sorted = diffs.slice().sort((a, b) => a - b);
        return {bad, ratio: sorted[sorted.length - 1] / sorted[sorted.length >> 1]};
      });
      check(r.bad === 0, `${name}: the ground band equals itself shifted by the camera step`, r.bad + ' pixels differ');
      check(r.ratio < 2, `${name}: gliding the camera, the frame-to-frame change of the hall has no spikes`, 'peak/median ' + r.ratio.toFixed(2));
      await ctx.close();
    }
    // the card must fit on every screen shape, with a real run's staff on it: a bot flies a few gaps and the card is measured
    for (const [name, vp, upTo] of [['landscape phone', {width: 844, height: 390}, 3], ['small phone', {width: 320, height: 568}, 12], ['tablet', {width: 768, height: 1024}, 12]]) {
      const {ctx, p} = await mk({viewport: vp, hasTouch: true});
      await p.goto(url + '?seed=card2'); await p.waitForTimeout(300);
      await p.evaluate(upTo => { setInterval(() => { const g = window.__fugue, s = g.run; if (g.phase === 'play' && s.alive && s.score < upTo) { const q = FUGUE.pipeAt(s.course, s.score); if (s.y > q.cy + 25 && s.vy > -120) document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})); } }, 8); }, upTo);
      await p.keyboard.press('Space');
      const done = await until(p, () => window.__fugue.phase === 'over', 30000); await p.waitForTimeout(900);
      const c = await p.evaluate(() => ({score: window.__fugue.run.score, r: document.getElementById('card').getBoundingClientRect().toJSON(), iw: innerWidth, ih: innerHeight, staff: !!document.querySelector('#staffbox svg')}));
      check(done && c.score >= 1 && c.staff, `${name}: a bot flies a few gaps and the staff is drawn`, 'score ' + c.score);
      check(c.r.left >= 0 && c.r.right <= c.iw && c.r.top >= 0 && c.r.bottom <= c.ih, `${name}: the card with its staff fits the screen`, JSON.stringify([c.r.top | 0, c.r.bottom | 0, c.ih]));
      await ctx.close();
    }
    // a lying save and a blocked one
    {
      const {ctx, p} = await mk({viewport: {width: 800, height: 700}}, () => { localStorage.setItem('fugue.v1', JSON.stringify({best: 'x', daily: {key: 5, best: -1}, mode: {}, sound: 3})); });
      await p.goto(url); await p.waitForTimeout(300);
      check(await phase(p) === 'ready', 'a lying save does not break the page');
      await ctx.close();
      const b = await mk({viewport: {width: 800, height: 700}}, () => { Object.defineProperty(window, 'localStorage', {get() { throw new Error('blocked'); }}); });
      await b.p.goto(url); await b.p.waitForTimeout(300); await b.p.keyboard.press('Space'); await b.p.waitForTimeout(200);
      check(await phase(b.p) === 'play', 'with storage blocked it still plays');
      await b.ctx.close();
    }
    // reduced motion
    {
      const {ctx, p} = await mk({viewport: {width: 390, height: 844}, reducedMotion: 'reduce'});
      await p.goto(url); await p.waitForTimeout(300); await p.keyboard.press('Space');
      check(await until(p, () => window.__fugue.phase === 'over', 9000), 'reduced motion: a run still plays through to the card');
      await ctx.close();
    }
    check(errors.length === 0, 'no console errors', errors.slice(0, 3).join(' | '));
    await browser.close();
  }
}

console.log(`\n${failures ? 'FAILED' : 'passed'}: ${passes} ok, ${failures} failed`);
process.exit(failures ? 1 : 0);
