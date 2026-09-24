#!/usr/bin/env node
// Test suite for games/downhill_dreamer.html.
//
// The page is a one-button game whose whole appeal is feel: whether a player who dives into
// the downhills gets a few slides, whether one who reads the landing guide gets long chains,
// whether anyone ever crawls. None of that is visible in a diff, and every number in the
// tuning table pulls on all of it. So the page keeps its terrain, flight and rules in a
// <script id="core"> block with no DOM, and this runs that block in Node: bots play whole
// days on fixed seeds, and the rules are poked one landing at a time. No browser, no server.
//
//   node test/downhill_dreamer.mjs                  # everything (about 30 seconds)
//   node test/downhill_dreamer.mjs rules guide      # named suites only
//   node test/downhill_dreamer.mjs --record         # print a fresh GOLDEN table
//   node test/downhill_dreamer.mjs --page=old.html  # run against another copy of the page
//
// Suites: world, rules, guide, feel, golden.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'downhill_dreamer.html');
const RECORD = args.includes('--record');
const ALL = ['world', 'rules', 'guide', 'feel', 'golden'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = RECORD ? ['golden'] : picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => {
    failures++;
    console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`);
};
const pass = what => {
    passes++;
    if (process.env.VERBOSE) console.log(`  ok    ${what}`);
};
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) {
    console.log('no <script id="core"> block in ' + PAGE);
    process.exit(1);
}
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.DD = DD;', ctx);
const DD = ctx.DD, P = DD.P;

/* ---------------- players ----------------
   Each looks at the run the way a person could see it on screen and answers "hold?". They
   decide 60 times a second, and what they decide reaches the bird `lag` seconds later. */
const RANK = {perfect: 0, great: 1, good: 2, hop: 2, bump: 3, crash: 4};
const BOTS = {
    // never touches the button
    idle: {lag: 0, decide: () => false},
    // dives whenever the bird is going down: into every downhill and every fall
    diver: {lag: 0.12, decide: s => s.p.onGround ? s.world.slope(s.p.x) > 0 : s.p.vy > 0},
    // plays by the guide ring, ten looks a second, a fifth of a second slow: on the ground it
    // dives downhill and lets go as it sees the valley floor coming; in the air it floats
    // until the ring (the dive landing) turns green, then holds to the ground
    reader: {lag: 0.2, every: 0.1, decide: s => {
        const p = s.p, W = s.world;
        if (p.onGround) return W.slope(p.x) > 0.03 && W.slope(p.x + p.vx * 0.25) > -0.05;
        if (s.readerDiving === s.airStart) return true;
        const r = DD.predict(s, true, P.GUIDE_LEAD);
        if (r && (r.kind === 'perfect' || r.kind === 'great')) { s.readerDiving = s.airStart; return true; }
        return false;
    }},
    // compares both answers every frame and takes the better one
    sharp: {lag: 0.12, decide: s => {
        const p = s.p;
        if (p.onGround) return s.world.slope(p.x) > 0.03;
        const r = DD.predict(s, false), h = DD.predict(s, true);
        return (h ? RANK[h.kind] : 3) < (r ? RANK[r.kind] : 3);
    }},
};

function play(botName, seed, maxT = 300, watch) {
    const bot = BOTS[botName], world = DD.makeWorld(seed), s = DD.newRun(world);
    const per = Math.round(1 / 60 / P.STEP), lagSteps = Math.round(bot.lag / P.STEP);
    const queue = [];
    let want = false, nextLook = 0, n = 0, sumV = 0, slow = 0;
    const stats = {kinds: {}, events: {}, minV: Infinity, nan: false, sunk: 0};
    while (!s.over && s.t < maxT) {
        if (n % per === 0 && s.t >= nextLook) {
            want = bot.decide(s);
            if (bot.every) nextLook = s.t + bot.every;
        }
        queue.push(want);
        const hold = queue.length > lagSteps ? queue.shift() : false;
        const evs = DD.step(s, hold);
        n++;
        const p = s.p;
        sumV += p.vx;
        if (p.vx < 420) slow++;
        if (!Number.isFinite(p.x + p.y + p.vx + p.vy + s.score)) stats.nan = true;
        if (p.y > world.y(p.x) - P.R + 0.5) stats.sunk++;
        if (p.onGround) stats.minV = Math.min(stats.minV, Math.hypot(p.vx, p.vy));
        for (const e of evs) stats.events[e.kind] = (stats.events[e.kind] || 0) + 1;
        if (watch) watch(s, evs, hold);
    }
    return Object.assign(stats, {
        s, t: s.t, score: s.score, isle: s.isle, x: s.p.x, slides: s.slides, perfects: s.perfects,
        landings: s.landings, bestCombo: s.bestCombo, avgV: sumV / n, slow: slow / n,
        slidePct: s.landings ? s.slides / s.landings : 0
    });
}

/* ---------------- world ---------------- */
if (suites.includes('world')) {
    section('world');
    const a = DD.makeWorld(0), b = DD.makeWorld(0), c = DD.makeWorld(1);
    let same = true, differ = false;
    for (let x = 0; x < 200000; x += 997) {
        if (a.y(x) !== b.y(x)) same = false;
        if (Math.abs(a.y(x) - c.y(x)) > 1) differ = true;
    }
    check(same, 'the same seed builds the same hills');
    check(differ, 'another seed builds other hills');

    let order = true;
    for (let i = 1; i < 80; i++) {
        const st = a.start(i);
        if (a.islandAt(st) !== i || a.islandAt(st - 0.5) !== i - 1 || a.start(i + 1) - st <= a.start(i) - a.start(i - 1)) order = false;
    }
    check(order, 'islands start where islandAt says, and each is longer than the last');

    // No seams: the ground is continuous and never steeper than a ramp should be, across
    // the opening ramp and every island border out past Dreamland.
    for (const w of [a, c]) {
        let worstStep = 0, worstSlope = 0, where = 0;
        const spots = [[0, 3000]];
        for (let i = 1; i < 40; i++) spots.push([w.start(i) - 1500, w.start(i) + 1500]);
        for (const [x0, x1] of spots) {
            for (let x = x0; x < x1; x += 1) {
                const d = Math.abs(w.y(x + 1) - w.y(x));
                if (d > worstStep) { worstStep = d; where = x; }
                worstSlope = Math.max(worstSlope, Math.abs(w.slope(x)));
            }
        }
        check(worstStep < 1.6, `seed ${w.seed}: no step in the ground at an island border`, `${worstStep.toFixed(2)}px at x=${where}`);
        check(worstSlope < 1.6, `seed ${w.seed}: no hill steeper than 58°`, `slope ${worstSlope.toFixed(2)}`);
    }
    const early = [], late = [];
    for (let x = 20000; x < 60000; x += 5) early.push(Math.abs(a.slope(x)));
    for (let x = a.start(12); x < a.start(12) + 40000; x += 5) late.push(Math.abs(a.slope(x)));
    const mean = v => v.reduce((m, q) => m + q, 0) / v.length;
    check(mean(late) < mean(early), 'Dreamland hills are wider and flatter than the first islands',
        `mean slope ${mean(early).toFixed(2)} early, ${mean(late).toFixed(2)} in Dreamland`);
}

/* ---------------- rules ----------------
   Put the bird a hair above the hill at x, flying `off` radians steeper than the slope, a
   second into its flight, and take one step. */
function landAt(s, x, off, speed = 900, air = 1) {
    const W = s.world, th = Math.atan(W.slope(x)) + off;
    Object.assign(s.p, {x, y: W.y(x) - P.R - 0.01, vx: speed * Math.cos(th), vy: speed * Math.sin(th), onGround: false});
    s.airStart = s.t - air;
    const evs = DD.step(s, false);
    return {evs, land: evs.find(e => 'ia' in e)};
}
function findSlope(W, from, test) {
    for (let x = from; ; x += 7) if (test(W.slope(x)) && test(W.slope(x - 30)) && test(W.slope(x + 30))) return x;
}

if (suites.includes('rules')) {
    section('rules');
    const W = DD.makeWorld(0);
    const down = findSlope(W, 3000, k => k > 0.5), up = findSlope(W, 3000, k => k < -0.5);
    const crest = findSlope(W, 3000, k => Math.abs(k) < 0.03);

    let s = DD.newRun(W);
    check(landAt(s, down, 0.05).land.kind === 'perfect', 'along a downhill: perfect');
    s = DD.newRun(W);
    check(landAt(s, down, 0.45).land.kind === 'great', 'a little steep onto a downhill: great');
    s = DD.newRun(W);
    check(landAt(s, crest, 0.5).land.kind === 'good', 'a shallow touchdown on a crest: good');
    s = DD.newRun(W);
    check(landAt(s, up, 1.4).land.kind === 'crash', 'falling into a ramp: crash');
    s = DD.newRun(W);
    check(!landAt(s, down, 0.05, 900, 0.1).land && s.combo === 0 && s.landings === 0, 'a skip shorter than the hop limit is not judged');

    // a perfect slide keeps the whole fall and adds a boost
    s = DD.newRun(W);
    const before = 1200;
    landAt(s, down, 0.1, before);
    check(Math.hypot(s.p.vx, s.p.vy) > before, 'a perfect slide comes out faster than it went in',
        `${before} -> ${Math.round(Math.hypot(s.p.vx, s.p.vy))}`);
    s = DD.newRun(W);
    landAt(s, up, 1.45, before);
    const kept = Math.hypot(s.p.vx, s.p.vy);
    check(kept >= P.KEEP_CRASH * before * 0.95 && kept < before * 0.8, 'a crash costs speed but never stops the bird',
        `${before} -> ${Math.round(kept)}`);

    // three slides light the fever, and not two
    s = DD.newRun(W);
    const fevers = [];
    for (let i = 0; i < 3; i++) fevers.push(landAt(s, down, 0.05).evs.some(e => e.kind === 'fever'));
    check(fevers.join() === 'false,false,true', 'the fever starts on the third slide in a row', fevers.join());
    check(DD.mult(s) === 2 && s.fever > 0, 'fever doubles the score', `mult ${DD.mult(s)}`);
    const vtFever = DD.vterm(s);
    // a smooth landing keeps the chain
    landAt(s, crest, 0.5);
    check(s.combo === 3 && s.fever > 0, 'a smooth landing keeps chain and fever', `combo ${s.combo}`);
    for (let i = 0; i < P.SUPER_AT - 3; i++) landAt(s, down, 0.05);
    check(s.superFever && DD.mult(s) === 3 && DD.vterm(s) > vtFever, `super fever at ${P.SUPER_AT} in a row: triple score, higher speed limit`);
    const r = landAt(s, up, 1.4);
    check(s.combo === 0 && s.fever === 0 && !s.superFever && r.evs.some(e => e.kind === 'feverEnd') && r.land.lost === P.SUPER_AT,
        'a crash ends the chain and the fever, and says how long the chain was', JSON.stringify(r.land));
    check(landAt(s, down, 0.05).evs.every(e => e.kind !== 'fever') && s.charge === 1, 'after a crash the pips count from one again');

    // the fever burns down on its own
    s = DD.newRun(W);
    for (let i = 0; i < 3; i++) landAt(s, down, 0.05);
    const steps = Math.ceil(P.FEVER_T / P.STEP) + 2;
    let ended = false;
    for (let i = 0; i < steps && !ended; i++) ended = DD.step(s, false).some(e => e.kind === 'feverEnd');
    check(ended && s.fever === 0 && DD.mult(s) === 1, `an unfed fever goes out after ${P.FEVER_T}s`);

    // islands, milestones, night
    s = DD.newRun(W);
    s.day = 0.5;
    Object.assign(s.p, {x: W.start(1) - 1, y: W.y(W.start(1) - 1) - P.R, vx: 800, vy: 0, onGround: true});
    const sc = s.score, isl = DD.step(s, false).find(e => e.kind === 'island');
    check(isl && isl.isle === 1 && s.score - sc >= 500 && s.day > 0.69, 'a new island: +500 and the sun climbs back');
    // later islands give back less, Dreamland's gate three times an island's share
    const refill = i => {
        const r = DD.newRun(W);
        r.day = 0.1; r.isle = i - 1;
        Object.assign(r.p, {x: W.start(i) - 1, y: W.y(W.start(i) - 1) - P.R, vx: 800, vy: 0, onGround: true});
        DD.step(r, false);
        return r.day - 0.1;
    };
    check(refill(2) > refill(9) && refill(9) > P.DAY_ISLE_MIN * 0.99, 'each island gives back a little less of the day',
        `${refill(2).toFixed(3)} then ${refill(9).toFixed(3)}`);
    check(refill(10) > refill(9) * 2.5, 'Dreamland\'s gate gives back much more', `${refill(10).toFixed(3)}`);
    s = DD.newRun(W);
    Object.assign(s.p, {x: crest, y: W.y(crest) - P.R, vx: DD.BOOMS[0] + 60, vy: 0, onGround: true});
    const boom = DD.step(s, false).find(e => e.kind === 'boom');
    check(boom && boom.tier === 0 && s.boom === 1, 'passing the first speed milestone booms once');
    s = DD.newRun(W);
    s.day = 1e-6;
    const night = DD.step(s, false);
    check(s.over && night.some(e => e.kind === 'night') && DD.step(s, true).length === 0, 'when the day runs out the run is over and stays over');
}

/* ---------------- guide ----------------
   The ring promises "dive now and you land here, like this". Check it, and the other
   predictions it is built from, against the real flight from hundreds of moments in the
   air. */
if (suites.includes('guide')) {
    section('guide');
    const moments = [];
    for (const seed of [0, 4]) {
        let k = 0;
        play('reader', seed, 150, s => {
            if (!s.p.onGround && s.t - s.airStart > 0.15 && ++k % 53 === 0) moments.push(JSON.parse(JSON.stringify({...s, world: undefined, seed})));
        });
    }
    // three promises: letting go now, diving now, and the ring itself (float a reaction
    // time more, then dive)
    const CASES = [['letting go', false, 0], ['diving now', true, 0], ['the ring (dive after the lead)', true, P.GUIDE_LEAD]];
    const worlds = {0: DD.makeWorld(0), 4: DD.makeWorld(4)};
    for (const [what, hold, lead] of CASES) {
        let n = 0, near = 0, same = 0, worst = 0;
        for (const m of moments) {
            const world = worlds[m.seed];
            const s = Object.assign(DD.newRun(world), m, {world});
            s.p = {...m.p};
            const guess = DD.predict(s, hold, lead);
            if (!guess) continue;
            // the first touch of the ground, judged or not (a skip is a 'hop')
            let land = null;
            const t0 = s.t;
            for (let i = 0; i < 3 / P.STEP && !s.p.onGround && !s.over; i++) {
                const evs = DD.step(s, hold && s.t - t0 >= lead - 1e-9);
                if (s.p.onGround) land = evs.find(e => 'ia' in e) || {kind: 'hop', x: s.p.x};
            }
            if (!land) continue;
            n++;
            const err = Math.abs(land.x - guess.x) / Math.max(200, guess.x - m.p.x);
            worst = Math.max(worst, err);
            if (err < 0.03) near++;
            if (land.kind === guess.kind) same++;
        }
        check(n > 300, `${what}: enough moments in the air to judge (${n})`);
        check(near / n > 0.97, `${what}: the ring is within 3% of where the bird lands (${near}/${n})`, `worst ${(worst * 100).toFixed(1)}%`);
        check(same / n > 0.97, `${what}: the ring's colour matches the landing (${same}/${n})`);
    }
}

/* ---------------- feel ----------------
   What each kind of player gets out of a day. The numbers are floors with room to spare,
   read off the bots when the tuning went in. */
if (suites.includes('feel')) {
    section('feel');
    const SEEDS = [0, 3, 8];
    const runs = {};
    for (const b of Object.keys(BOTS)) runs[b] = SEEDS.map(seed => play(b, seed, b === 'sharp' ? 360 : 300));
    const avg = (b, k) => runs[b].reduce((m, r) => m + r[k], 0) / SEEDS.length;
    const min = (b, k) => Math.min(...runs[b].map(r => r[k]));
    for (const b of Object.keys(BOTS)) {
        console.log(`  ${b.padEnd(7)} ` + runs[b].map(r =>
            `${Math.round(r.t)}s i${r.isle + 1} ${Math.round(r.slidePct * 100)}% slid, chain ${r.bestCombo}, ${Math.round(r.avgV * 0.18)} km/h, ${Math.round(r.score)}`).join(' | '));
    }
    for (const b of Object.keys(BOTS)) for (const r of runs[b]) {
        if (r.nan || r.sunk || !(r.minV >= P.MINV - 1)) {
            fail(`${b}: the bird stays on top of the hills, moving, with finite numbers`, `nan ${r.nan}, sunk ${r.sunk}, min speed ${r.minV}`);
        }
    }
    pass('the bird stays on top of the hills, moving, with finite numbers');

    check(min('diver', 'slidePct') > 0.25 && min('diver', 'bestCombo') >= 2,
        'diving into everything still slides now and then', `slid ${runs.diver.map(r => r.slidePct.toFixed(2))}`);
    check(min('reader', 'slidePct') > 0.7, 'reading the guide slides seven landings in ten',
        runs.reader.map(r => r.slidePct.toFixed(2)).join(' '));
    check(min('reader', 'bestCombo') >= 12 && runs.reader.every(r => r.events.fever > 5),
        'reading the guide lights the fever again and again and chains a dozen', runs.reader.map(r => r.bestCombo).join(' '));
    check(min('sharp', 'bestCombo') >= 15 && min('sharp', 'slidePct') > 0.8, 'a sharp player slides eight in ten and chains fifteen',
        runs.sharp.map(r => `${r.bestCombo} ${r.slidePct.toFixed(2)}`).join(' | '));
    check(avg('reader', 'slow') < 0.3 && avg('sharp', 'slow') < 0.1, 'nobody who plays spends long crawling',
        `reader ${avg('reader', 'slow').toFixed(2)}, sharp ${avg('sharp', 'slow').toFixed(2)}`);

    // skill pays, in score, distance and time
    for (const k of ['score', 'x', 't']) {
        const [i, d, r, sh] = ['idle', 'diver', 'reader', 'sharp'].map(b => avg(b, k));
        check(i < d && d * 3 < r && d * 3 < sh || (k === 't' && i < d && d * 1.5 < r && d * 1.5 < sh),
            `${k}: idle < diver, and both good players far ahead`, [i, d, r, sh].map(Math.round).join(' / '));
    }
    check(avg('diver', 't') > 90 && avg('diver', 't') < 240, 'a clumsy day lasts between one and a half and four minutes', `${Math.round(avg('diver', 't'))}s`);
    check(Math.max(avg('reader', 't'), avg('sharp', 't')) < 420, 'even a machine loses to the night within seven minutes',
        `${Math.round(avg('reader', 't'))}s, ${Math.round(avg('sharp', 't'))}s`);
    check(runs.reader.every(r => r.isle >= 10) && runs.sharp.every(r => r.isle >= 10), 'good players reach Dreamland',
        [...runs.reader, ...runs.sharp].map(r => r.isle + 1).join(' '));
}

/* ---------------- golden ----------------
   The reader's first 90 seconds on three seeds, to the point. Any change to the flight, the
   hills or the rules moves these; if it was meant to, re-record with --record. */
const GOLDEN = [
    // seed, score, x, slides, landings, best chain
    [0, 93570, 132358, 45, 60, 11],
    [1, 71192, 136899, 47, 61, 7],
    [2, 90972, 142165, 49, 61, 9],
];
if (suites.includes('golden')) {
    section('golden');
    const rows = [0, 1, 2].map(seed => {
        const r = play('reader', seed, 90);
        return [seed, Math.round(r.score), Math.round(r.x), r.slides, r.landings, r.bestCombo];
    });
    if (RECORD) {
        console.log('const GOLDEN = [\n    // seed, score, x, slides, landings, best chain');
        for (const row of rows) console.log(`    [${row.join(', ')}],`);
        console.log('];');
    } else {
        for (const row of rows) {
            const want = GOLDEN.find(g => g[0] === row[0]);
            check(want && want.join() === row.join(), `seed ${row[0]}: ${want ? want.join(', ') : '(not recorded)'}`, `got ${row.join(', ')}`);
        }
    }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
