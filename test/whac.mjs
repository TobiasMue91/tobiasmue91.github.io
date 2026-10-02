#!/usr/bin/env node
// Test suite for games/whac.html (Prickle Patch).
//
// Runs the page's DOM-free <script id="core"> block in Node: the burrows, the tempo of the evening,
// the boop, the sting and the apple. What a player can feel but cannot see - a burrow holding two
// things, a wasp that is safe to tap, a streak that keeps counting through a miss, a round that a
// spammer wins - all comes from a change to one number somewhere else. No browser, no server.
//
//   node test/whac.mjs                 # everything
//   node test/whac.mjs rules bots      # named suites only
//   node test/whac.mjs --page=path.html
//
// Suites:
//   rules    - every boop, sting, apple, miss and dud against what the rules say it is worth
//   evening  - seeded rounds: one thing per burrow, arrivals warned, wasps never pile up early,
//              the first round teaches one thing at a time, and every round ends
//   bots     - one-fingered bots with a person's reaction time play whole rounds: quicker hands
//              score more, a spammer loses to an average player, and the ranks are reachable

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'whac.html');
const ALL = ['rules', 'evening', 'bots'];
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
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.C = PrickleCore;', ctx);
const C = ctx.C;
const DT = 1 / 120;

const run = (s, secs) => { const ev = []; for (let t = 0; t < secs - 1e-9; t += DT) ev.push(...C.step(s, DT)); return ev; };
// a quiet garden: nothing arrives on its own, so a test can place exactly what it wants
const quiet = (opt = {}) => { const s = C.create({seed: 7, ...opt}); s.nextSpawn = 1e9; return s; };
function place(s, hole, kind, apple = false, up = 1) {
    s.holes[hole] = {id: s.nextId++, kind, apple, hole, phase: 'warn', t0: s.t, warn: 0.2, up, upAt: 0};
    run(s, 0.2 + C.RISE + DT * 2);
    return s.holes[hole];
}
const types = ev => ev.map(e => e.type);

// ------------------------------------------------------------------ rules
function rules() {
    section('rules');
    let s = quiet();
    check(types(C.tap(s, 4)).join() === 'dud', 'a tap on an empty burrow is a dud and nothing else');
    check(s.score === 0 && s.boops === 0, 'a dud earns nothing');

    s = quiet(); s.holes[2] = {id: 1, kind: 'hog', apple: false, hole: 2, phase: 'warn', t0: 0, warn: 0.3, up: 1, upAt: 0};
    check(types(C.tap(s, 2)).join() === 'dud', 'a burrow that is only heaving cannot be booped yet');

    s = quiet(); place(s, 4, 'hog');
    let ev = C.tap(s, 4), b = ev.find(e => e.type === 'boop');
    check(b && b.pts === 150 && b.quick === 50, 'a boop the moment the face is up: 100 and the full 50 for quickness', JSON.stringify(b));
    check(types(C.tap(s, 4)).join() === 'dud', 'a booped hedgehog cannot be booped twice');

    s = quiet(); place(s, 4, 'hog', false, 2); run(s, 0.9);
    b = C.tap(s, 4).find(e => e.type === 'boop');
    check(b && b.quick === 0 && b.pts === 100, 'a slow boop is worth the base and no more', JSON.stringify(b));

    // five boops ink five pips and lift the multiplier; it stops at the top
    s = quiet();
    for (let k = 0; k < 5; k++) { place(s, k, 'hog'); C.tap(s, k); run(s, 0.4); }
    check(s.mult === 2 && s.pips === 0, 'five boops in a row: ×2, pips empty again', `mult ${s.mult} pips ${s.pips}`);
    for (let k = 0; k < 40; k++) { place(s, k % 9, 'hog'); C.tap(s, k % 9); run(s, 0.4); }
    check(s.mult === C.MAX_MULT, `the multiplier tops out at ×${C.MAX_MULT}`, s.mult);
    const top = s.mult; place(s, 0, 'hog'); b = C.tap(s, 0).find(e => e.type === 'boop');
    check(b.pts === 100 * top + 50, 'at the top every quick boop is worth base × top + 50', b.pts);

    // a miss: the hedgehog tucks in, the streak goes, one step of multiplier goes
    s = quiet(); s.mult = 3; s.pips = 2; s.streak = 12;
    place(s, 1, 'hog', false, 0.3); ev = run(s, 0.4);
    check(types(ev).includes('escape') && s.misses === 1, 'a hedgehog left alone escapes and counts as a miss');
    check(s.streak === 0 && s.pips === 0 && s.mult === 2, 'a miss breaks the streak and costs one step of multiplier', `streak ${s.streak} pips ${s.pips} mult ${s.mult}`);

    // the last moment of the tuck still counts, and takes the miss back
    s = quiet(); place(s, 1, 'hog', false, 0.3); run(s, 0.3 + C.GRACE / 2);
    check(s.holes[1].phase === 'tuck', 'test setup: caught mid-tuck');
    b = C.tap(s, 1).find(e => e.type === 'boop');
    check(b && s.misses === 0 && s.boops === 1, 'a boop inside the grace of the tuck counts and is not a miss');
    s = quiet(); place(s, 1, 'hog', false, 0.3); run(s, 0.3 + C.GRACE + 0.03);
    check(types(C.tap(s, 1)).join() === 'dud', 'after the grace the ball cannot be booped');

    // a sting
    s = quiet(); s.mult = 4; s.pips = 3; s.streak = 20; const left = s.left;
    place(s, 5, 'wasp'); const l0 = s.left; ev = C.tap(s, 5);
    check(types(ev).join() === 'sting' && s.stings === 1, 'touching a wasp is a sting');
    check(Math.abs((l0 - s.left) - C.STING_COST) < 1e-9, `a sting burns ${C.STING_COST} s of evening`, l0 - s.left);
    check(s.mult === 1 && s.streak === 0 && s.pips === 0, 'a sting takes the whole multiplier');
    check(s.score === 0, 'a sting is never worth points');
    check(types(C.tap(s, 5)).join() === 'dud', 'a wasp that has been touched flies off and cannot sting twice');
    s = quiet(); place(s, 5, 'wasp', false, 0.5); ev = run(s, 1);
    check(types(ev).includes('leave') && s.stings === 0 && s.misses === 0, 'a wasp left alone leaves, and costs nothing');
    s = quiet(); s.left = 2; place(s, 5, 'wasp'); C.tap(s, 5);
    check(s.left === 0 && !s.over, 'a sting cannot take the evening below nothing');
    run(s, DT * 2); check(s.over, 'and the round ends on the next step');

    // an apple
    s = quiet(); s.left = 20; place(s, 3, 'hog', true); const la = s.left; ev = C.tap(s, 3);
    b = ev.find(e => e.type === 'boop'); const ap = ev.find(e => e.type === 'apple');
    check(b && b.pts === 250 + 50, 'an apple hedgehog is worth 250', b && b.pts);
    check(ap && Math.abs(s.left - la - C.APPLE_GIFT) < 1e-9, `an apple gives back ${C.APPLE_GIFT} s`, s.left - la);
    s = quiet(); s.left = C.ROUND - 0.5; place(s, 3, 'hog', true); C.tap(s, 3);
    check(s.left <= C.ROUND, 'an apple never makes the evening longer than it started');

    // a thump on bare earth spoils a streak in progress but not the multiplier
    s = quiet(); s.mult = 2; s.pips = 3; ev = C.tap(s, 0);
    check(s.pips === 0 && s.mult === 2 && ev[0].lost === 3, 'a dud empties the pips and nothing more', `pips ${s.pips} mult ${s.mult}`);

    check(C.tap(quiet(), 9).length === 0 && C.tap(quiet(), -1).length === 0, 'taps outside the nine burrows do nothing');
    s = quiet(); s.left = 0.01; run(s, 0.05); check(s.over && types(C.tap(s, 0)).length === 0, 'after nightfall nothing can be tapped');

    check(C.rank(0) === C.RANKS[0][1] && C.rank(1e9) === C.RANKS[C.RANKS.length - 1][1], 'every score has a rank');
    check(C.RANKS.every((r, i) => !i || r[0] > C.RANKS[i - 1][0]), 'ranks climb');
}

// ------------------------------------------------------------------ evening
function evening() {
    section('evening');
    let doubled = 0, unwarned = 0, early = 0, overCap = 0, longest = C.ROUND, lazy = 0;
    for (let seed = 1; seed <= 200; seed++) {
        const s = C.create({seed}), seen = new Map();
        let steps = 0, lastArrival = 0, emptySince = 0;
        while (!s.over && steps++ < 1e5) {
            const ev = C.step(s, DT);
            for (const e of ev) if (e.type === 'warn') {
                if (seen.has(e.id)) doubled++;
                seen.set(e.id, s.t); lastArrival = s.t;
            }
            const occ = s.holes.filter(Boolean);
            if (new Set(occ.map(e => e.hole)).size !== occ.length || occ.some((e, i) => s.holes[e.hole] !== e)) doubled++;
            for (const e of occ) if (e.phase === 'rise' && !seen.has(e.id)) unwarned++;
            if (C.dusk(s) < 0.4 && occ.filter(e => e.kind === 'wasp' && e.phase !== 'flee').length > 1) early++;
            const busy = occ.filter(e => e.phase !== 'sink' && e.phase !== 'drop' && e.phase !== 'flee').length;
            if (busy > C.tempo.cap(1) ) overCap++;
            if (occ.length) emptySince = s.t; else if (!s.over && s.t - emptySince > 1.2) { lazy++; emptySince = s.t; }
        }
        if (!s.over || Math.abs(s.t - C.ROUND) > DT * 2) longest = s.t;
    }
    check(!doubled, 'no burrow ever holds two things', doubled);
    check(!unwarned, 'nothing comes up without the burrow heaving first', unwarned);
    check(!early, 'before dusk is under way, wasps come one at a time', early);
    check(!overCap, `never more than ${C.tempo.cap(1)} burrows busy at once`, overCap);
    check(!lazy, 'the garden is never empty for more than 1.2 s', lazy);
    check(longest === C.ROUND, `every untouched round lasts exactly ${C.ROUND} s`, longest);

    // the tempo climbs as the light goes
    const t = C.tempo;
    check(t.hogUp(1) < t.hogUp(0) && t.gap(1) < t.gap(0) && t.warn(1) < t.warn(0) && t.cap(1) > t.cap(0), 'everything quickens towards nightfall');
    check(t.warn(1) >= 0.15, 'even at dark a burrow heaves long enough to see (≥ 0.15 s)', t.warn(1));
    check(t.hogUp(1) >= 0.55, 'even at dark a hedgehog waits long enough for a quick person (≥ 0.55 s)', t.hogUp(1));

    // the first round teaches one thing at a time: hedgehogs alone, then one wasp on its own
    let bad = 0;
    for (let seed = 1; seed <= 50; seed++) {
        const s = C.create({seed, tutorial: true}), order = [];
        while (s.t < 12 && !s.over) {
            for (const e of C.step(s, DT)) if (e.type === 'warn') order.push(e.kind);
            if (s.t < 12 && s.holes.filter(Boolean).length > 1) bad++;
        }
        if (order.slice(0, 3).join() !== 'hog,hog,hog' || order[3] !== 'wasp' || order.slice(4).includes('wasp')) bad++;
    }
    check(!bad, 'the first round: three hedgehogs, then a lone wasp, one burrow at a time for 12 s', bad);
    // later rounds meet a wasp early, so nobody forgets what they are
    let late = 0;
    for (let seed = 1; seed <= 50; seed++) { const s = C.create({seed}); let first = null; while (!s.over && first == null) for (const e of C.step(s, DT)) if (e.type === 'warn' && e.kind === 'wasp') first = s.t; if (first == null || first > 8) late++; }
    check(!late, 'every round shows a wasp within its first 8 s', late);
    // the same seed is the same evening
    const a = C.create({seed: 99}), b = C.create({seed: 99}), ea = [], eb = [];
    while (!a.over) { ea.push(...C.step(a, DT).map(e => e.type + e.hole)); eb.push(...C.step(b, DT).map(e => e.type + e.hole)); }
    check(ea.join() === eb.join(), 'a seed always makes the same evening');
}

// ------------------------------------------------------------------ bots
// one finger: it sees a face, reaches it after its reaction time, then looks for the next one
function bot(seed, react, waspErr, move = 0.16) {
    const s = C.create({seed}), r = C.rng(seed * 7 + 1), seen = new Set(); let target = null, busyTill = 0;
    while (!s.over) {
        C.step(s, DT);
        if (!target && s.t >= busyTill) {
            let best = null;
            for (const e of s.holes) if (e && !seen.has(e.id) && (e.phase === 'rise' || e.phase === 'up') && (!best || e.t0 < best.t0)) best = e;
            if (best) { seen.add(best.id); if (best.kind === 'hog' || r() < waspErr) target = {e: best, at: s.t + react * (0.8 + r() * 0.5) + move}; }
        }
        if (target && s.t >= target.at) { C.tap(s, target.e.hole); busyTill = s.t + 0.05; target = null; }
    }
    return s;
}
function bots() {
    section('bots');
    const N = 40, avg = (list, f) => list.reduce((a, s) => a + f(s), 0) / list.length;
    const skills = [['quick', 0.3, 0.04], ['average', 0.45, 0.1], ['slow', 0.65, 0.15]];
    const res = {};
    for (const [name, react, err] of skills) {
        const list = []; for (let k = 1; k <= N; k++) list.push(bot(k, react, err)); res[name] = list;
        console.log(`  ${name.padEnd(8)} score ${Math.round(avg(list, s => s.score)).toString().padStart(6)}  boops ${avg(list, s => s.boops).toFixed(0).padStart(3)}  missed ${avg(list, s => s.misses).toFixed(0).padStart(3)}  stung ${avg(list, s => s.stings).toFixed(1)}  rank ${C.rank(avg(list, s => s.score))}`);
    }
    const q = avg(res.quick, s => s.score), a = avg(res.average, s => s.score), sl = avg(res.slow, s => s.score);
    check(q > a * 1.4 && a > sl * 1.6, 'quicker hands score clearly more', `${q | 0} > ${a | 0} > ${sl | 0}`);
    check(avg(res.quick, s => s.misses) < avg(res.average, s => s.misses), 'quicker hands miss fewer');
    check(avg(res.slow, s => s.boops) >= 12, 'a slow player still boops a dozen hedgehogs a round', avg(res.slow, s => s.boops));
    check(C.rank(a) !== C.RANKS[0][1] && C.rank(q) !== C.RANKS[C.RANKS.length - 1][1], 'an average player climbs off the bottom rank; the top rank is out of reach of a merely quick one', `${C.rank(a)} / ${C.rank(q)}`);
    // a spammer drums every burrow ten times a second
    const spam = [];
    for (let k = 1; k <= N; k++) { const s = C.create({seed: k}); let n = 0; while (!s.over) { C.step(s, DT); if (++n % 12 === 0) for (let i = 0; i < 9; i++) C.tap(s, i); } spam.push(s); }
    const sp = avg(spam, s => s.score);
    console.log(`  spammer  score ${Math.round(sp).toString().padStart(6)}  stung ${avg(spam, s => s.stings).toFixed(1)}  round ${avg(spam, s => s.t).toFixed(0)} s`);
    check(sp < a * 0.5, 'drumming every burrow scores less than half what an average player does', `${sp | 0} vs ${a | 0}`);
    check(avg(spam, s => s.t) < C.ROUND * 0.7, 'and the stings cut the spammer\'s evening short', avg(spam, s => s.t));
}

const RUN = {rules, evening, bots};
for (const name of suites) { if (!RUN[name]) { console.log('no suite ' + name); process.exit(1); } RUN[name](); }
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
