#!/usr/bin/env node
// Test suite for games/push_mine.html.
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that push-ups are
// counted fairly: a held plank and one slow rep calibrate it (and that rep counts), every full rep
// counts once - through camera noise, dropped frames and both camera positions - a half rep is
// called shallow and never counted, a rep without locking out does not let the next one count, and
// the range follows a player who goes deeper. Around it: rock takes the hits it says, the same seed
// is the same mine, a deep rep hits harder and rhythm builds heat, the daily streak survives month
// ends and breaks on a missed day, damaged saves heal, the first Push Mine's save carries over, and
// a player doing a few sets a week reaches a new stratum about every week or two. Knee, incline and wall push-ups
// count on the same cameras and dig a gently discounted share, never less towards the goal and streak.
// No browser, no server.
//
//   node test/push_mine.mjs        (npm run test:pushmine)

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'games', 'push_mine.html'), 'utf8');
const Core = vm.runInNewContext(html.match(/<script id="core">([\s\S]*?)<\/script>/)[1] + ';Core', {});

let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m); } else if (process.env.VERBOSE) console.log('ok  ', m); };
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 0.8;

// a body doing push-ups, seen as a signal: top..bottom, `reps` of them, each `depth` of the range
function session({mode = 'front', top = 0.35, bottom = 0.52, reps = 10, depth = 1, noise = 0.003, period = 2.2, drop = 0, hold = 1.5, fps = 30, shape} = {}) {
    const d = Core.detector(mode), ev = [], dt = 1 / fps;
    let t = 0;
    const push = v => { const e = []; Core.feed(d, rnd() < drop ? null : v + gauss() * noise, t, e); e.forEach(x => ev.push(Object.assign({at: t}, x))); t += dt; };
    for (; t < hold;) push(top);
    for (let r = 0; r < reps; r++) {
        const dd = Array.isArray(depth) ? depth[r] : depth;
        for (let k = 0; k < period * fps; k++) {
            const ph = k / (period * fps);
            const p = shape ? shape(ph, r) : (ph < 0.45 ? (1 - Math.cos(Math.PI * ph / 0.45)) / 2 : ph < 0.55 ? 1 : ph < 0.85 ? (1 + Math.cos(Math.PI * (ph - 0.55) / 0.3)) / 2 : 0);
            push(top + (bottom - top) * p * dd);
        }
    }
    for (let k = 0; k < fps; k++) push(top);
    return {d, ev, reps: ev.filter(e => e.t === 'rep'), counted: ev.filter(e => e.t === 'rep' && e.q >= Core.GOOD)};
}

// ---------- calibration ----------
{
    const s = session({reps: 1});
    ok(s.ev.some(e => e.t === 'calTop'), 'holding the plank takes the top');
    ok(s.ev.some(e => e.t === 'calDone'), 'one rep sets the range');
    ok(s.counted.length === 1, 'and that first rep counts: ' + s.counted.length);
    ok(Math.abs(s.d.bottom - 0.52) < 0.02 && Math.abs(s.d.top - 0.35) < 0.02, 'range is the body\'s range: ' + s.d.top.toFixed(3) + '..' + s.d.bottom.toFixed(3));
}
{
    // fidgeting never finishes the hold
    const d = Core.detector('front'), ev = [];
    for (let t = 0; t < 4; t += 1 / 30) Core.feed(d, 0.35 + Math.sin(t * 9) * 0.03, t, ev);
    ok(!ev.some(e => e.t === 'calTop'), 'a moving body is not a held plank');
}
{
    const s = session({reps: 1, depth: 0.15});
    ok(s.ev.some(e => e.t === 'calShallow') && !s.ev.some(e => e.t === 'calDone'), 'a dip cannot calibrate - it asks for lower');
    // a shallow calibration rep is not a trap: full reps after it deepen the range
    seed = 12; const h = session({reps: 8, depth: [0.5, 1, 1, 1, 1, 1, 1, 1]});
    ok(h.d.bottom > 0.35 + 0.17 * 0.85, 'range grows out of a half-depth calibration: ' + h.d.bottom.toFixed(3));
    ok(Core.grade(h.reps[h.reps.length - 1].q) !== 'perfect' || h.reps.length === 8, 'every rep still counted once: ' + h.reps.length);
}

// ---------- counting ----------
for (const [mode, top, bottom, noise] of [['front', 0.35, 0.52, 0.003], ['front', 0.3, 0.38, 0.002], ['below', Math.log(0.25), Math.log(0.55), 0.012]]) {
    seed = 11;
    const s = session({mode, top, bottom, reps: 20, noise});
    ok(s.counted.length === 20, `${mode} ${top.toFixed(2)}..${bottom.toFixed(2)}: 20 reps counted ${s.counted.length}`);
    ok(s.reps.length === 20, `${mode}: nothing else fired as a rep (${s.reps.length})`);
}
{
    seed = 3; const s = session({reps: 15, drop: 0.15});
    ok(s.counted.length === 15, 'a camera that drops 15% of frames still counts every rep: ' + s.counted.length);
}
{
    seed = 4; const s = session({reps: 12, period: 1.1});
    ok(s.counted.length === 12, 'fast reps (1.1 s) all count: ' + s.counted.length);
}
{
    seed = 5; const s = session({reps: 8, period: 5});
    ok(s.counted.length === 8, 'slow reps (5 s) count once each: ' + s.counted.length);
}
{
    seed = 6; const s = session({reps: 6, depth: [1, 0.45, 1, 0.5, 1, 1]});
    const g = s.reps.map(r => Core.grade(r.q));
    ok(s.counted.length === 4, 'half reps are not counted: ' + s.counted.length);
    ok(g.filter(x => x === 'shallow').length === 2, 'and are called shallow: ' + g.join(','));
}
{
    seed = 8; const s = session({reps: 10, noise: 0.012});
    ok(s.counted.length === 10, 'heavy jitter (4x) does not add or lose reps: ' + s.counted.length);
}
{
    // bounce at the bottom without locking out: one rep, a lockout hint, the bounce does not count
    seed = 9;
    const shape = (ph, r) => r !== 1 ? (ph < 0.45 ? (1 - Math.cos(Math.PI * ph / 0.45)) / 2 : ph < 0.55 ? 1 : ph < 0.85 ? (1 + Math.cos(Math.PI * (ph - 0.55) / 0.3)) / 2 : 0)
        : 1 - 0.6 * Math.sin(Math.PI * ph) * (ph < 0.5 ? 1 : 1);
    const s = session({reps: 3, shape});
    ok(s.ev.some(e => e.t === 'lockout'), 'a rep that never straightens the arms gets a lockout hint');
    ok(s.counted.length <= 3 && s.counted.length >= 2, 'bouncing at the bottom does not farm reps: ' + s.counted.length);
}
{
    // the range follows a player who goes deeper than the calibration rep
    seed = 10; const s = session({reps: 6, depth: [0.7, 1, 1, 1, 1, 1], bottom: 0.52});
    ok(s.d.bottom > 0.35 + (0.52 - 0.35) * 0.7 + 0.03, 'range deepens after deeper reps: ' + s.d.bottom.toFixed(3));
}
{
    const d = Core.detector('front'), ev = [];
    for (let t = 0; t < 1; t += 1 / 30) Core.feed(d, 0.4, t, ev);
    for (let t = 1; t < 3; t += 1 / 30) Core.feed(d, null, t, ev);
    ok(ev.some(e => e.t === 'lost'), 'losing the body is announced');
    Core.feed(d, 0.4, 3.1, ev);
    ok(ev.some(e => e.t === 'found'), 'and so is finding it again');
}
{
    // tap mode needs no calibration and grades by how long you hold
    const d = Core.detector('tap'), ev = []; let v = 0, t = 0;
    const hold = (secs, down) => { for (let k = 0; k < secs * 60; k++) { v += ((down ? 1.12 : -0.05) - v) * (1 - Math.exp(-(1 / 60) / (down ? 0.28 : 0.12))); Core.feed(d, Math.max(0, v), t, ev); t += 1 / 60; } };
    hold(1.0, true); hold(0.8, false); hold(0.25, true); hold(0.8, false); hold(0.5, true); hold(0.8, false);
    const g = ev.filter(e => e.t === 'rep').map(e => Core.grade(e.q));
    ok(g[0] === 'perfect' && g[1] === 'shallow' && g.length === 3, 'tap: a long hold is a full rep, a short press is shallow: ' + g.join(','));
}

{
    // below the face, the detector loses a face that comes very close: the rep still counts, no warning
    seed = 13;
    const top = Math.log(0.25), bottom = Math.log(0.6), d = Core.detector('below'), ev = []; let t = 0;
    const feed = v => { Core.feed(d, v, t, ev); t += 1 / 30; };
    for (let k = 0; k < 45; k++) feed(top);
    for (let r = 0; r < 4; r++) {
        for (let k = 0; k < 30; k++) feed(top + (bottom - top) * k / 30);
        for (let k = 0; k < 45; k++) feed(null);                       // too close to see
        for (let k = 30; k >= 0; k--) feed(top + (bottom - top) * k / 30);
        for (let k = 0; k < 20; k++) feed(top);
    }
    ok(ev.filter(e => e.t === 'rep').length === 4, 'below: a face too close to detect still makes a rep: ' + ev.filter(e => e.t === 'rep').length);
    ok(!ev.some(e => e.t === 'lost'), 'and is not called lost');
}

// ---------- signals ----------
{
    const lm = []; for (let i = 0; i < 33; i++) lm.push({x: .5, y: .5, visibility: .9});
    lm[11] = {x: .4, y: .4, visibility: .9}; lm[12] = {x: .6, y: .5, visibility: .9};
    ok(Math.abs(Core.frontSignal(lm) - 0.45) < 1e-9, 'front signal is shoulder height');
    lm[12].visibility = 0.2;
    ok(Core.frontSignal(lm) === null, 'a hidden shoulder is no signal, not a guess');
    ok(Core.belowSignal({width: 320}, 640) === Math.log(0.5) && Core.belowSignal(null, 640) === null, 'below signal is log face width');
}

// ---------- the mine ----------
{
    let prev = 0, mono = true;
    for (let d = 0; d < 600; d++) { const hp = Core.blockHp(d); if (!(hp > 0)) mono = false; if (hp < prev - 1e-9 && Core.layerIndex(d) === Core.layerIndex(d - 1)) mono = false; prev = hp; }
    ok(mono, 'rock gets no softer within a stratum and every block has hp');
    ok(Core.LAYERS.every((L, i) => i === 0 || Core.blockHp(L.from) > Core.blockHp(Core.LAYERS[i - 1].from)), 'each stratum is harder than the last');
    const a = [], b = [];
    for (let d = 0; d < 300; d++) { a.push(Core.blockOres(42, d).join()); b.push(Core.blockOres(42, d).join()); }
    ok(a.join('|') === b.join('|'), 'same seed, same ore');
    ok(a.join('|') !== Array.from({length: 300}, (_, d) => Core.blockOres(43, d).join()).join('|'), 'another seed, other ore');
    ok(Array.from({length: 300}, (_, d) => Core.blockOres(42, d)).every((o, d) => o.every(x => Core.layerAt(d).ores.some(y => y[0] === x))), 'ore belongs to its stratum');
}
{
    // a block takes exactly the hits it says
    for (const g of [Core.GOOD, Core.PERFECT]) {
        const s = Core.newSave(5), set = Core.newSet(0), ev = [];
        const hits = Math.ceil(Core.blockHp(0) / (Core.PICKS[0].p * Core.qmult(g)));
        let k = 0; while (s.depth === 0 && k < 50) { Core.rep(s, set, g, k * 2, '2026-10-17', ev); k++; }
        ok(k === hits, `${Core.grade(g)} reps break the first block in ${hits}: took ${k}`);
    }
    const s = Core.newSave(5), set = Core.newSet(0), ev = [];
    Core.rep(s, set, 0.3, 0, '2026-10-17', ev);
    ok(s.reps === 0 && set.shallow === 1 && s.dmg > 0 && s.coins === 0, 'a shallow rep only chips: no rep, no coin');
}
{
    // rhythm builds heat, a pause cools it
    const s = Core.newSave(5), set = Core.newSet(0), ev = [];
    for (let k = 0; k < 10; k++) Core.rep(s, set, 0.9, k * 2, '2026-10-17', ev);
    const hot = ev.filter(e => e.t === 'hit').pop().heat;
    Core.rep(s, set, 0.9, 20 + Core.TEMPO + 1, '2026-10-17', ev);
    ok(hot === 2 && ev.filter(e => e.t === 'hit').pop().heat === 1, 'ten reps in rhythm heat to x2, a long pause cools: ' + hot);
    ok(ev.filter(e => e.t === 'break').every(e => e.coins === e.ores.reduce((a, o) => a + Core.ORES[o].v, 0)), 'a break pays exactly its ore');
}
{
    // daily goal and streak
    const s = Core.newSave(5); s.goal = 10;
    const day = (key, n) => { const set = Core.newSet(0), ev = []; for (let k = 0; k < n; k++) Core.rep(s, set, 0.9, k * 2, key, ev); return ev; };
    ok(day('2026-10-30', 10).some(e => e.t === 'goal') && s.day.streak === 1, 'goal met starts a streak');
    day('2026-10-31', 12); day('2026-11-01', 10);
    ok(s.day.streak === 3 && Core.streakNow(s, '2026-11-02') === 3, 'streak runs across a month end: ' + s.day.streak);
    ok(Core.streakNow(s, '2026-11-03') === 0, 'a missed day shows no streak');
    day('2026-11-04', 10);
    ok(s.day.streak === 1, 'and it starts again from one');
    ok(Core.yesterday('2027-01-01') === '2026-12-31' && Core.yesterday('2028-03-01') === '2028-02-29', 'yesterday across years and leap days');
    const ev = day('2026-11-04', 10);
    ok(!ev.some(e => e.t === 'goal'), 'the goal is celebrated once a day');
}
{
    const s = Core.newSave(1); s.coins = 39;
    ok(!Core.buy(s) && s.pick === 0, 'cannot buy what you cannot afford');
    s.coins = 40; ok(Core.buy(s) && s.pick === 1 && s.coins === 0, 'buying takes the cost');
}

// ---------- saves ----------
{
    const bad = {depth: -3, pick: 99, coins: NaN, dmg: 1e9, goal: 7, day: 'x', mode: 'side', seed: 9};
    const f = Core.fix(bad);
    ok(f.depth === 0 && f.pick === Core.PICKS.length - 1 && f.coins === 0 && f.dmg < Core.blockHp(0) && f.goal === 20 && f.mode === null && f.day.reps === 0, 'a damaged save heals');
    const s = Core.newSave(77); const set = Core.newSet(0), ev = [];
    for (let k = 0; k < 40; k++) Core.rep(s, set, 0.9, k * 2, '2026-10-17', ev);
    const back = Core.fix(JSON.parse(JSON.stringify(s)));
    ok(JSON.stringify(back) === JSON.stringify(s), 'a save comes back as it went');
    ok(Core.fix(null).v === 2, 'no save is a new save');
}
{
    const old = {totalPushUps: 250, bestRoundPushups: 41, maxDepthEver: 900, coins: 99999, muted: true, totalRounds: 12};
    const m = Core.migrate(old, 4);
    ok(m.reps === 250 && m.bestSet === 41 && m.muted && m.sets === 12, 'the first Push Mine\'s push-ups, best set and sound carry over');
    ok(m.depth === 100 && m.coins === 1000, 'and a head start in step with those push-ups: ' + m.depth + ' m, ' + m.coins);
    ok(Core.migrate(null, 1) === null && Core.migrate({}, 1).depth === 0, 'nothing to migrate is no migration');
}

// ---------- pacing ----------
{
    // a player doing three sets of 15 a few days a week, buying the next pick when they can
    const s = Core.newSave(99); let day = 0; const reached = {};
    for (let week = 0; week < 16; week++) for (const wd of [0, 2, 4]) {
        day = week * 7 + wd;
        for (let st = 0; st < 3; st++) {
            const set = Core.newSet(0), ev = [];
            for (let k = 0; k < 15; k++) Core.rep(s, set, k % 3 ? 0.9 : 0.7, k * 2.2, new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10), ev);
            while (Core.buy(s));
        }
        const L = Core.layerIndex(s.depth); if (!(L in reached)) reached[L] = day;
    }
    if (process.env.VERBOSE) console.log('pacing', reached, 'depth', s.depth, 'pick', s.pick);
    ok(reached[1] !== undefined && reached[1] <= 7, 'red clay within the first week: day ' + reached[1]);
    ok(reached[3] !== undefined && reached[3] <= 50, 'slate within seven weeks: day ' + reached[3]);
    ok(reached[6] === undefined || reached[6] > 60, 'the crystal hollow is not a two-month walk: ' + reached[6]);
}

// easier push-ups: a little less rock per rep, the same reps, coins, goal and streak
{
    const run = form => { const s = Core.newSave(5); s.form = form; s.goal = 10; const set = Core.newSet(0), ev = [];
        for (let k = 0; k < 10; k++) Core.rep(s, set, 0.9, k * 2, '2026-10-17', ev);
        return {s, dmg: ev.filter(e => e.t === 'hit').reduce((a, e) => a + e.dmg, 0), goal: ev.some(e => e.t === 'goal')}; };
    const full = run('full');
    for (const f of ['knee', 'incline', 'wall']) {
        const r = run(f), k = Core.FORMS[f].k;
        ok(Math.abs(r.dmg - full.dmg * k) < 1e-9, f + ' digs x' + k + ' of a full push-up');
        ok(k >= 0.7 && k < 1, f + ' is discounted, gently: ' + k);
        ok(r.s.reps === 10 && r.s.day.reps === 10 && r.goal && r.s.day.streak === 1, f + ' reps count fully towards the goal and streak');
    }
    ok(Core.FORMS.full.k > Core.FORMS.knee.k && Core.FORMS.knee.k > Core.FORMS.incline.k && Core.FORMS.incline.k > Core.FORMS.wall.k, 'harder forms dig more');
    ok(Core.fix({seed: 1}).form === 'full', 'an old save does full push-ups');
    ok(Core.fix({seed: 1, form: 'handstand'}).form === 'full', 'an unknown form heals to full');
    const w = Core.fix({seed: 1, form: 'wall', mode: 'front'});
    ok(w.form === 'wall' && w.mode === 'below', 'wall push-ups keep the knee-high front camera out: facing camera instead');
    // a wall push-up seen by a phone at face height: the face grows from ~60 cm to ~25 cm away
    ok(Core.fix({seed: 1, mode: 'tap'}).mode === 'tap', 'the camera spot survives a reload');
    const wl = session({mode: 'below', top: Math.log(0.18), bottom: Math.log(0.18 * 60 / 25), reps: 8, noise: 0.02});
    ok(wl.counted.length === 8, 'wall push-ups count on the facing camera');
    // knees and incline move the shoulders less in front view: still counted at ~70% of a full push-up's travel
    const kn = session({mode: 'front', top: 0.38, bottom: 0.38 + 0.17 * 0.7, reps: 8});
    ok(kn.counted.length === 8, 'knee/incline push-ups count in front view');
}

console.log(fails ? `${fails} of ${n} failed` : `all ${n} passed`);
process.exit(fails ? 1 : 0);
