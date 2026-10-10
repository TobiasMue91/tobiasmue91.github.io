// Suika suite. Runs the DOM-free <script id="core"> block of games/suika.html in Node.
// The page promises things nobody can see from it: a seed drops the same fruit for everyone, fruit never leaves the
// jar or sinks into each other, a jar left alone comes to rest (round fruit does not roll for ever), every point
// is paid for a merge, the jar overflows only when a landed fruit stays over the line, and saves trust nothing.
// Suites: seed, physics, rest, merge, score, overflow, save, migrate, bots. `node test/suika.mjs [suite...]`
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(HERE, '..', 'games', 'suika.html'), 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block'); process.exit(1); }
const load = () => { const ctx = {}; vm.createContext(ctx); vm.runInContext(core[1] + '\nthis.S = SUIKA;', ctx); return ctx.S; };
const S = load();

let fails = 0, passes = 0;
const check = (ok, msg) => { if (ok) passes++; else { fails++; console.log('  FAIL ' + msg); } };
const lcg = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
const run = (st, sec) => { const ev = []; for (let i = 0; i < Math.round(sec / S.STEP); i++) ev.push(S.step(st)); return ev; };
// a player who drops as soon as allowed, at x chosen by `pick`
function play(seed, pick, maxDrops = 2000) {
  const st = S.create(seed); let steps = 0, merges = [];
  while (!st.over && st.drops < maxDrops) { const ev = S.step(st); merges.push(...ev.merges); if (++steps % 66 === 0 && S.canDrop(st)) S.drop(st, pick(st)); }
  return {st, merges};
}

const suites = {
  seed() {
    const a = S.create(42), b = S.create(42), c = S.create(43), seq = st => { const o = []; for (let i = 0; i < 60; i++) { o.push(st.cur); st.cool = 0; S.drop(st, 200); st.bodies = []; } return o.join(''); };
    check(seq(a) === seq(b), 'a seed drops the same fruit');
    check(seq(S.create(42)) !== seq(c), 'another seed drops other fruit');
    const counts = Array(S.DROPS).fill(0); const st = S.create(7); for (let i = 0; i < 5000; i++) { counts[st.cur]++; st.cool = 0; S.drop(st, 200); st.bodies = []; }
    check(counts.every(n => n > 800 && n < 1200), 'drops are cherry to dekopon, evenly: ' + counts);
    for (let s = 1; s < 200; s++) check(S.create(s).cur <= 2, 'the first fruit is small');
    const r = lcg(3), p1 = play(99, () => r() * 400, 120), r2 = lcg(3), p2 = play(99, () => r2() * 400, 120);
    check(JSON.stringify(S.save(p1.st)) === JSON.stringify(S.save(p2.st)), 'a seed and the same moves give the same jar');
  },
  physics() {
    for (let seed = 1; seed <= 12; seed++) {
      const r = lcg(seed), st = S.create(seed); let worst = 0, out = 0, steps = 0;
      while (!st.over && st.drops < 160) {
        S.step(st); steps++;
        if (steps % 50 === 0 && S.canDrop(st)) S.drop(st, r() < 0.2 ? (r() < .5 ? -50 : 450) : r() * 400);
        for (const b of st.bodies) { const rr = S.rad(b); if (b.x - rr < -0.01 || b.x + rr > S.W + 0.01 || b.y + rr > S.H + 0.01) out++; }
      }
      run(st, 0.5);
      for (const a of st.bodies) for (const b of st.bodies) if (a !== b) worst = Math.max(worst, S.rad(a) + S.rad(b) - Math.hypot(a.x - b.x, a.y - b.y));
      check(out === 0, `seed ${seed}: no fruit leaves the jar (${out})`);
      check(worst < 2.5, `seed ${seed}: fruit does not sink into fruit (${worst.toFixed(2)} px)`);
    }
    for (let seed = 1; seed <= 4; seed++) {   // a player who keeps dropping onto the highest fruit, even once it is over the rim
      const st = S.create(seed); let hi = -Infinity, n = 0;
      while (!st.over && n < 30000) { S.step(st); n++; if (n % 36 === 0 && S.canDrop(st)) { const t = st.bodies.length ? st.bodies.reduce((a, b) => b.y < a.y ? b : a) : {x: 200}; S.drop(st, t.x); }
        for (const b of st.bodies) if (b.touched) hi = Math.max(hi, -b.vy); }
      check(hi <= S.MAX_UP + 1e-6 && st.over, `seed ${seed}: crowded drops never launch fruit (${hi.toFixed(0)} up)`);
    }
    const st = S.create(1); st.cool = 0; const b = S.drop(st, 999); check(b.x === S.W - S.RADII[b.lv], 'an aim past the wall drops against it');
  },
  rest() {
    for (let seed = 1; seed <= 8; seed++) {
      const r = lcg(seed), st = S.create(seed);
      for (let k = 0; k < 26; k++) { run(st, 0.55); S.drop(st, r() * 400); }
      run(st, 6); const v = Math.max(...st.bodies.map(b => Math.hypot(b.vx, b.vy)));
      const before = st.bodies.map(b => [b.x, b.y]); run(st, 2);
      const drift = Math.max(...st.bodies.map((b, i) => Math.hypot(b.x - before[i][0], b.y - before[i][1])));
      check(v < 1 && drift < 0.5, `seed ${seed}: a jar left alone comes to rest (v ${v.toFixed(2)}, drift ${drift.toFixed(2)})`);
    }
    const st = S.create(1); st.cur = 3; const b = S.drop(st, 60); run(st, 1); b.vx = 700; run(st, 4);
    check(Math.abs(b.vx) < 0.5 && b.x < S.W - S.RADII[3] - 1, 'a fruit pushed along the floor stops before the far wall');
  },
  merge() {
    for (let lv = 0; lv < S.TOP; lv++) {
      const st = S.create(1); st.bodies.push({id: 90, lv, x: 150, y: S.H - S.RADII[lv], vx: 0, vy: 0, a: 0, g: 1, touched: true, chain: 0, hot: 0},
        {id: 91, lv, x: 150 + 2 * S.RADII[lv] - 1, y: S.H - S.RADII[lv], vx: 0, vy: 0, a: 0, g: 1, touched: true, chain: 0, hot: 0});
      const ev = run(st, 1).flatMap(e => e.merges);
      check(ev.length === 1 && st.bodies.length === 1 && st.bodies[0].lv === lv + 1 && st.score === S.POINTS[lv], `two level ${lv} make one level ${lv + 1}`);
    }
    const st = S.create(1); for (const x of [120, 280]) st.bodies.push({id: x, lv: S.TOP, x, y: S.H - 102, vx: x < 200 ? 50 : -50, vy: 0, a: 0, g: 1, touched: true, chain: 0, hot: 0});
    run(st, 2); check(st.bodies.length === 0 && st.score === S.POINTS[S.TOP], 'two watermelons leave the jar and pay ' + S.POINTS[S.TOP]);
    const s3 = S.create(1); for (const x of [100, 129, 300]) s3.bodies.push({id: x, lv: 0, x, y: S.H - 15, vx: 0, vy: 0, a: 0, g: 1, touched: true, chain: 0, hot: 0});
    run(s3, 1); check(s3.bodies.length === 2 && s3.score === 1 && s3.bodies.some(b => b.lv === 1), 'two touching cherries merge, a cherry apart is left alone');
    const s4 = S.create(1); s4.bodies.push({id: 1, lv: 2, x: 100, y: S.H - 26, vx: 0, vy: 0, a: 0, g: 1, touched: true, chain: 0, hot: 0}, {id: 2, lv: 3, x: 150, y: S.H - 32, vx: 0, vy: 0, a: 0, g: 1, touched: true, chain: 0, hot: 0});
    run(s4, 1); check(s4.bodies.length === 2 && s4.score === 0, 'different fruit never merge');
  },
  score() {
    for (let seed = 1; seed <= 6; seed++) {
      const r = lcg(seed), {st, merges} = play(seed, () => r() * 400, 300);
      const paid = merges.reduce((a, m) => a + S.POINTS[m.from], 0);
      check(paid === st.score, `seed ${seed}: every point is a merge (${paid} vs ${st.score})`);
      check(merges.every(m => m.chain >= 1), 'every merge has a chain');
    }
  },
  overflow() {
    const st = S.create(1); st.cool = 0; S.drop(st, 200); run(st, 0.3);
    check(!st.over && st.overT === 0, 'a fruit falling through the line does not count');
    for (let seed = 1; seed <= 4; seed++) {
      const r = lcg(seed), s2 = S.create(seed); const hot = new Map(); let fair = true;
      while (!s2.over && s2.drops < 2000) { S.step(s2); for (const b of s2.bodies) { const above = b.touched && b.y - S.rad(b) < S.LINE; hot.set(b.id, above ? (hot.get(b.id) || 0) + S.STEP : 0); } if (s2.t % 0.55 < S.STEP && S.canDrop(s2)) S.drop(s2, r() * 400); }
      check(s2.over, `seed ${seed}: a jar played without care overflows`);
      const worst = Math.max(...hot.values());
      check(worst >= S.OVER - 0.02, `seed ${seed}: only once a landed fruit sat over the line for ${S.OVER} s (${worst.toFixed(2)})`);
      check(S.danger(s2) === 1, 'the warning is full');
      const n = s2.bodies.length; S.step(s2); check(s2.bodies.length === n && S.drop(s2, 100) === null, 'a full jar takes no more fruit and stops');
    }
    const s3 = S.create(5); check(S.danger(s3) === 0, 'an empty jar is calm');
  },
  save() {
    const r = lcg(4), {st} = play(8, () => r() * 400, 60); run(st, 5);
    const sv = JSON.parse(JSON.stringify(S.save(st))), back = S.load(sv);
    check(back && back.score === st.score && back.cur === st.cur && back.next === st.next && back.bodies.length === st.bodies.length, 'a save comes back fruit for fruit');
    run(back, 2); const moved = Math.max(...back.bodies.map((b, i) => Math.hypot(b.x - sv.bodies[i][1], b.y - sv.bodies[i][2])));
    check(moved < 1.5, `a reloaded jar stays put (${moved.toFixed(2)} px)`);
    const a = S.load(sv), b = S.load(sv); a.cool = b.cool = 0; S.drop(a, 133); S.drop(b, 133); run(a, 3); run(b, 3);
    check(JSON.stringify(S.save(a)) === JSON.stringify(S.save(b)) && a.next === st.next ? true : a.cur === b.cur, 'a reloaded jar carries on identically');
    const lies = [null, 5, {}, {...sv, v: 2}, {...sv, score: -1}, {...sv, score: 1.5}, {...sv, cur: 7}, {...sv, bodies: [[11, 1, 1]]}, {...sv, bodies: [[1, NaN, 1]]}, {...sv, bodies: 'x'}, {...sv, seed: -3}, {...sv, bodies: Array(300).fill([0, 100, 100])}];
    for (const l of lies) check(S.load(l) === null, 'a lying save is refused: ' + JSON.stringify(l).slice(0, 60));
    const out = S.load({...sv, bodies: [[3, -500, 9e9]]}); check(out && out.bodies[0].x === S.RADII[3] && out.bodies[0].y === S.H - S.RADII[3], 'a fruit saved outside the jar is put back inside');
  },
  migrate() {
    const none = o => JSON.stringify(o) === '{}';
    check(none(S.fromOld(null)) && none(S.fromOld('{{')) && none(S.fromOld('[5]')), 'nothing to carry over is nothing');
    const m = S.fromOld(JSON.stringify({fruits: 812, underwater: 1300, dessert: 640, garden: 90, winter: 900, sports: 700, x: 'y'}));
    check(m.fruit === 900 && m.sea === 1300 && m.sweets === 640 && m.garden === 90 && !m.space, 'each old skin\'s best goes to its jar, the rest to Fruit: ' + JSON.stringify(m));
    check(none(S.fromOld(JSON.stringify({fruits: 1e9, underwater: -4, dessert: 2.5}))), 'impossible old scores are not carried');
  },
  bots() {
    const avg = pick => { let tot = 0, top = 0; for (let s = 1; s <= 6; s++) { const {st} = play(s * 13, pick(s)); tot += st.score; top += st.top; } return [tot / 6, top / 6]; };
    const random = s => { const r = lcg(s); return () => r() * 400; };
    // a careful bot: drop where a same fruit is nearest the surface, else into the lowest spot
    const careful = () => st => {
      let best = 200, bs = -Infinity; const r = S.RADII[st.cur];
      for (let x = r; x <= 400 - r; x += 5) {
        let y = S.H - r, on = null;
        for (const b of st.bodies) { const rr = r + S.rad(b), dx = Math.abs(b.x - x); if (dx < rr) { const yy = b.y - Math.sqrt(rr * rr - dx * dx); if (yy < y) { y = yy; on = b; } } }
        let sc = y * 0.3;
        for (const b of st.bodies) if (b.lv === st.cur && Math.hypot(b.x - x, b.y - y) < r + S.rad(b) + 3) sc += 300;
        if (on && on.lv < st.cur) sc -= 80 * (st.cur - on.lv);
        sc -= Math.abs(x - (st.cur >= 3 ? r : 400 - r)) * 0.05;
        if (sc > bs) { bs = sc; best = x; }
      }
      return best;
    };
    const [rs, rt] = avg(random), [cs, ct] = avg(careful);
    console.log(`    random: ${rs.toFixed(0)} pts, top fruit ${rt.toFixed(1)}; careful: ${cs.toFixed(0)} pts, top fruit ${ct.toFixed(1)}`);
    check(cs > rs * 1.3, 'a careful player scores well above a random one');
    check(ct >= 8, 'a careful player reaches the pineapple');
    check(rs > 300, 'a random player is not shut out at once');
  }
};

const want = process.argv.slice(2), names = want.length ? want : Object.keys(suites);
for (const n of names) { if (!suites[n]) { console.log('no suite ' + n); process.exit(1); } const f0 = fails; console.log(n); suites[n](); if (fails === f0) console.log('  ok'); }
console.log(`${passes} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
