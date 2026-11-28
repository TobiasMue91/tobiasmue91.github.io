#!/usr/bin/env node
// Test suite for games/duck_hunt.html (Flyway).
//
// The page is painting - the engraved plate, birds, reeds, feathers, cards, sound - around a small
// DOM-free core in <script id="core">: a seeded plan of birds per stop, a fixed-step flight model,
// three shells a flush, a quota of ten, perks from banded birds and a goose every third stop. The
// promise is that those rules hold however the painting changes. This runs the core in Node and:
//
//   rules   - the tables: quota, speed, flush time, roster, goose stops, points, the stop plan
//   shot    - the one verb: pattern radius, doubles, shells, dry fire, the goose's three hits,
//             clean-flush bonus, perks
//   flight  - every bird that flies is resolved (down or gone) in time, stays inside the plate
//             sideways, keeps clear of the treeline while flying, and falls into the water band;
//             same seed and same shots give the same season; a daily seed gives everyone the
//             same birds; resizing mid-flush keeps birds in place
//   pacing  - deterministic bots of three skills play whole seasons on a wide (desktop) and a tall
//             (phone) plate: the reach of each must stay in its band and the two plates must agree,
//             and misses are counted by cause so a cause that should be rare shows up
//
//   node test/duck_hunt.mjs              # everything
//   node test/duck_hunt.mjs shot flight  # named suites only
//   node test/duck_hunt.mjs --page=x.html
//
// No browser, no server.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'duck_hunt.html');
const ALL = ['rules', 'shot', 'flight', 'pacing'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => {
    if (ok) { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); }
    else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); }
};
const section = n => console.log(`\n=== ${n} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const m = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!m) { console.log('no <script id="core"> in ' + PAGE); process.exit(1); }
const sandbox = {module: {exports: null}};
vm.runInNewContext(m[1], sandbox);
const Core = sandbox.module.exports;

// plate sizes in plate units, as the page computes them
const DESK = {w: 768, h: 408, hz: 269};
const PHONE = {w: 310, h: 640, hz: 500};

function newGame(seed, dims, extra) { return Core.Game(Object.assign({seed}, dims, extra || {})); }
// run until a phase (or a bird state) shows up, at most `max` seconds of game time
function until(g, fn, max = 30) {
    for (let t = 0; t < max; t += Core.STEP) { if (fn(g)) return true; g.advance(Core.STEP); }
    return fn(g);
}
const flying = g => g.birds.filter(b => b.state === 'fly' || b.state === 'rise');

if (suites.includes('rules')) {
    section('rules');
    check(Core.quota(0) === 5 && Core.quota(8) === 9 && Core.quota(30) === 9, 'quota climbs 5 -> 9 and stays there');
    let mono = true;
    for (let i = 1; i < 40; i++) {
        if (Core.quota(i) < Core.quota(i - 1) || Core.speedMul(i) < Core.speedMul(i - 1) || Core.flushTime(i) > Core.flushTime(i - 1)) mono = false;
    }
    check(mono, 'quota and speed never fall, flush time never grows');
    check(Core.speedMul(100) <= 2.4 && Core.flushTime(100) >= 4.4, 'speed and flush time have floors and ceilings');
    check(JSON.stringify(Core.roster(0)) === '["mallard"]' && Core.roster(4).length === 4, 'species arrive: mallard first, four by stop V');
    check([2, 5, 8].every(Core.hasGander) && ![0, 1, 3, 4].some(Core.hasGander), 'the goose closes every third stop');
    check(Core.pts(100, 0) === 100 && Core.pts(100, 4) === 200, 'points scale a quarter per stop');
    check(Core.roman(14) === 'XIV' && Core.roman(9) === 'IX', 'roman numerals');
    for (let i = 0; i < 12; i++) {
        const p = Core.planStop(1234, i);
        const birds = p.filter(f => !f[0].gander);
        const ok = birds.length === 5 && birds.every(f => f.length === 2) && p.length === (Core.hasGander(i) ? 6 : 5)
            && birds.flat().every(b => Core.roster(i).includes(b.kind));
        if (!ok) check(false, 'stop plan shape at stop ' + i);
        const bands = birds.flat().filter(b => b.band).length;
        if (bands > 2) check(false, 'at most two banded birds a stop', 'stop ' + i + ': ' + bands);
    }
    check(Core.planStop(1, 0).slice(0, 2).flat().every(b => !b.band), 'no banded bird in the first two flushes of a season');
    check(JSON.stringify(Core.planStop(99, 3)) === JSON.stringify(Core.planStop(99, 3)), 'the plan is a function of seed and stop');
    check(Core.dailySeed('2026-11-27') === Core.dailySeed('2026-11-27') && Core.dailySeed('2026-11-27') !== Core.dailySeed('2026-11-28'), 'daily seed is the date');
    // the newest species is met on its own stop
    let met = 0;
    for (let s = 1; s <= 40; s++) if (Core.planStop(s, 1).flat().some(b => b.kind === 'teal')) met++;
    check(met >= 36, 'the newly arrived species shows up on its stop', met + ' of 40 seeds');
}

if (suites.includes('shot')) {
    section('shot');
    const g = newGame(7, DESK);
    g.shoot(100, 100);
    check(g.drain().some(e => e.type === 'dry') && g.log.shots === 0, 'a shot during the intro is a dry click, not a shell');
    g.skip();
    until(g, g => g.phase === 'flush');
    check(g.shells === 3, 'three shells a flush');
    until(g, g => flying(g).length === 2 && flying(g).every(b => b.state === 'fly'));
    const [a, b] = flying(g);
    const ra = Core.SPECIES[a.kind].r;
    // just outside the pattern misses, just inside hits
    const res1 = g.shoot(a.x + Core.R + ra + 1, a.y);
    check(res1 && res1.kills.length === 0 && g.shells === 2, 'a shot one unit beyond pattern + body misses and spends a shell');
    const res2 = g.shoot(a.x + Core.R + ra - 1, a.y);
    check(res2 && res2.kills.length === 1 && a.state === 'fall' && g.tally[0] === 'hit', 'one unit inside the pattern takes the bird');
    check(g.freeze > 0, 'a hit holds the frame for a moment');
    const sb = g.score;
    g.shoot(b.x, b.y);
    check(g.score - sb === Core.pts(Core.SPECIES[b.kind].pts, 0), 'a single pays the species price');
    until(g, g => g.phase === 'gap' || g.phase === 'tally');
    const clean = g.drain().find(e => e.type === 'clean');
    check(!clean, 'no clean-flush bonus when every shell was spent');

    // a double: put both birds under one shot
    const g2 = newGame(11, DESK);
    g2.skip();
    until(g2, g => flying(g).length === 2 && flying(g).every(b => b.state === 'fly'));
    const [c, d] = flying(g2);
    d.x = c.x + 10; d.y = c.y;
    const s0 = g2.score;
    const r = g2.shoot(c.x + 5, c.y);
    const want = 2 * (Core.pts(Core.SPECIES[c.kind].pts, 0) + Core.pts(Core.SPECIES[d.kind].pts, 0));
    check(r.double && r.kills.length === 2 && g2.score - s0 === want, 'two birds in one pattern is a double at twice the price', `${g2.score - s0} vs ${want}`);
    until(g2, g => g.phase === 'gap');
    const cl = g2.drain().find(e => e.type === 'clean');
    check(cl && cl.shells === 2 && cl.pts === 2 * Core.pts(100, 0), 'a clean flush pays for each shell left');
    // out of shells: the birds leave
    const g3 = newGame(12, DESK);
    g3.skip();
    until(g3, g => flying(g).length === 2);
    g3.shoot(-500, -500); g3.shoot(-500, -500); g3.shoot(-500, -500);
    check(g3.shells === 0, 'shells run out');
    g3.shoot(10, 10);
    check(g3.drain().some(e => e.type === 'dry') && g3.log.shots === 3, 'an empty gun clicks');
    until(g3, g => g.birds.every(b => b.state === 'escape' || b.state === 'gone'), 1);
    check(g3.birds.every(b => b.state === 'escape' || b.state === 'gone'), 'with no shells left the flush flies off at once');

    // the goose: three hits
    const gg = newGame(5, DESK);
    gg.stop = 2; gg.next = gg.next; // jump straight to a goose stop
    gg.plan = Core.planStop(5, 2); gg.flush = 4; gg.phase = 'gap'; gg.pt = 0;
    until(gg, g => g.phase === 'flush' && flying(g).length === 1);
    const goose = flying(gg)[0];
    check(goose.kind === 'goose' && gg.shells === Core.GANDER_SHELLS, 'the goose flush has six shells');
    until(gg, g => goose.state === 'fly');
    gg.shoot(goose.x, goose.y); gg.advance(0.2);
    gg.shoot(goose.x, goose.y); gg.advance(0.2);
    check(goose.state === 'fly' && goose.hp === 1, 'two hits only wound the goose');
    const n0 = gg.tally.length;
    gg.shoot(goose.x, goose.y);
    check(goose.state === 'fall' && gg.tally.length === n0, 'the third hit brings it down, and it never counts toward the ten');

    // perks
    const gp = newGame(3, DESK);
    gp.skip();
    until(gp, g => flying(g).length === 2 && flying(g).every(b => b.state === 'fly'));
    const bb = flying(gp)[0];
    bb.band = true;
    bb.rnd = () => 0.99; // pick the last perk on the list: a fourth shell
    gp.shoot(bb.x, bb.y);
    check(gp.perk.shell, 'a banded bird gives its perk');
    until(gp, g => g.phase === 'flush' && g.flush === 1);
    check(gp.shells === 4, 'the fourth shell arrives with the next flush');
    const gc = newGame(3, DESK);
    gc.perk.calm = 2;
    gc.skip();
    until(gc, g => g.phase === 'flush');
    const calmFlush = gc.calmNow;
    until(gc, g => g.phase === 'flush' && g.flush === 1, 60);
    until(gc, g => g.phase === 'flush' && g.flush === 2, 60);
    check(calmFlush && gc.perk.calm === 0 && !gc.calmNow, 'calm air lasts two flushes');
}

// a bot that aims where a bird was `lag` seconds ago, with gaussian error
function play(seed, dims, lag, sigma, react, opts = {}) {
    const g = newGame(seed, dims, opts);
    const R = Core.mulberry(seed * 13 + 1);
    const nrm = () => { let u = 0; for (let i = 0; i < 6; i++) u += R(); return (u - 3) / 0.707; };
    const past = [];
    let cool = 0, t = 0;
    const trace = [], bad = [], flushStart = {};
    const why = {time: 0, shells: 0};
    while (g.phase !== 'over' && t < 2400 && g.stop < 25) {
        g.advance(1 / 60); t += 1 / 60;
        for (const e of g.drain()) {
            if (e.type === 'escaping') why[e.why] += g.birds.filter(b => b.state === 'escape').length;
            if (e.type === 'rustle') flushStart[g.stop + '.' + g.flush] = t;
            if (e.type === 'tally') {
                trace.push([e.summary.stop, e.summary.hits, e.summary.score].join(':'));
                if (g.tally.length !== 10) bad.push('tally of ' + g.tally.length + ' at stop ' + g.stop);
            }
            if (e.type === 'splash' && (e.y < g.hz || e.y > g.h)) bad.push('landed outside the water at y ' + e.y.toFixed(0));
        }
        if (g.phase === 'tally') { g.next(); continue; }
        for (const b of g.birds) {
            const sp = Core.SPECIES[b.kind];
            if (b.state !== 'gone' && b.state !== 'wait' && (b.x < -1 || b.x > g.w + 1)) bad.push(`${b.kind} left the plate sideways at x ${b.x.toFixed(0)}`);
            if (b.state === 'fly' && b.y > g.hz - Math.max(sp.len * 0.6, g.hz * 0.22) + 40) bad.push(`${b.kind} flew into the treeline at y ${b.y.toFixed(0)}`);
        }
        if (g.phase === 'flush') {
            const st = flushStart[g.stop + '.' + g.flush];
            if (st && t - st > Core.flushTime(g.stop) + 4 + 6) bad.push('flush ' + g.stop + '.' + g.flush + ' never ended');
        }
        past.push(new Map(g.birds.map(b => [b.id, {x: b.x, y: b.y, st: b.state}])));
        if (past.length > 40) past.shift();
        cool -= 1 / 60;
        const L = Math.round(lag * 60);
        if (g.phase === 'flush' && cool <= 0 && g.shells > 0 && past.length > L) {
            const old = past[past.length - 1 - L];
            const fl = g.birds.filter(b => (b.state === 'fly' || b.state === 'rise') && old.get(b.id) && old.get(b.id).st !== 'wait' && b.t > react);
            if (fl.length) { const o = old.get(fl[0].id); g.shoot(o.x + nrm() * sigma, o.y + nrm() * sigma); cool = react; }
        }
    }
    return {g, stops: g.stopsCleared, score: g.score, trace, bad, why, t};
}

if (suites.includes('flight')) {
    section('flight');
    const bads = [];
    for (const dims of [DESK, PHONE]) for (let s = 1; s <= 6; s++) bads.push(...play(s * 31, dims, 0.14, 14, 0.4).bad);
    check(bads.length === 0, 'birds resolve in time, stay on the plate, clear the treeline, land in the water', bads.slice(0, 4).join('; '));
    const a = play(4242, DESK, 0.15, 15, 0.45), b = play(4242, DESK, 0.15, 15, 0.45);
    check(a.trace.join() === b.trace.join() && a.trace.length > 1, 'same seed and same shots: the same season', a.trace.slice(0, 3).join(' '));
    // daily: the first flush's birds and flight paths match whatever the player does in between
    const d1 = newGame(Core.dailySeed('2026-11-27'), DESK, {daily: true});
    const d2 = newGame(Core.dailySeed('2026-11-27'), DESK, {daily: true});
    d1.skip(); d2.skip();
    until(d1, g => flying(g).length === 2); until(d2, g => flying(g).length === 2);
    d1.shoot(-99, -99);
    d1.advance(0.5); d2.advance(0.5);
    check(d1.birds.every((bd, i) => Math.abs(bd.x - d2.birds[i].x) < 1e-9 && bd.kind === d2.birds[i].kind), "a missed shot does not change today's birds");
    // resize mid-flush
    const gr = newGame(77, DESK);
    gr.skip();
    until(gr, g => flying(g).length === 2 && flying(g).every(b => b.state === 'fly'));
    const fx = flying(gr).map(b => b.x / gr.w);
    gr.resize(PHONE.w, PHONE.h, PHONE.hz);
    check(flying(gr).every((b, i) => Math.abs(b.x / gr.w - fx[i]) < 1e-9 && b.y < gr.hz), 'a resize keeps each bird at the same place on the plate');
}

if (suites.includes('pacing')) {
    section('pacing');
    // skill: lag (s), aim error (units), time between shots (s); bands are mean stops cleared
    const skills = [['sharp', 0.12, 12, 0.4, 6, 16], ['average', 0.16, 16, 0.5, 3, 8], ['new', 0.2, 20, 0.6, 1.5, 5.5]];
    for (const [name, lag, sig, react, lo, hi] of skills) {
        const res = {};
        for (const [label, dims] of [['desk', DESK], ['phone', PHONE]]) {
            const runs = [];
            for (let s = 1; s <= 16; s++) runs.push(play(s * 77, dims, lag, sig, react));
            const mean = runs.reduce((a, r) => a + r.stops, 0) / runs.length;
            const why = runs.reduce((a, r) => ({time: a.time + r.why.time, shells: a.shells + r.why.shells}), {time: 0, shells: 0});
            res[label] = mean;
            if (process.env.VERBOSE) console.log(`  ${name} ${label}: ${mean.toFixed(1)} stops, escapes by time ${why.time}, by empty gun ${why.shells}`);
            check(mean >= lo && mean <= hi, `${name} bot on ${label} clears ${lo}-${hi} stops`, mean.toFixed(1));
            if (name === 'average') check(why.time + why.shells > 0 && why.time < why.shells * 4, 'average bot: escapes come mostly from spent shells, not a timer too short', JSON.stringify(why));
        }
        check(Math.abs(res.desk - res.phone) <= Math.max(1.2, res.desk * 0.2), `${name}: phone and desktop plates play alike`, res.desk.toFixed(1) + ' vs ' + res.phone.toFixed(1));
    }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
