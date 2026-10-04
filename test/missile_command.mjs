#!/usr/bin/env node
// Test suite for games/missile_command.html (Lights On).
//
// Runs the page's DOM-free <script id="core"> block in Node: the bursts, the chains, the shells, the waves
// and the count at the end of each. A burst that misses what it visibly touches, a chain that pays the
// wrong amount, a bunker that fires its eleventh shell or a wave that never ends all come from one
// number somewhere else - and none of them shows up on a screenshot. No browser, no server.
//
//   node test/missile_command.mjs              # everything
//   node test/missile_command.mjs rules bots   # named suites only
//   node test/missile_command.mjs --page=path.html
//
// Suites:
//   rules  - a burst catches exactly what is inside its radius, chains pay 1x, 2x, 3x..., ten shells a
//            bunker, the nearest bunker answers, impacts take cities and bunkers, the count adds up
//   waves  - seeded waves: the right number of warheads, each aimed at something still standing,
//            splitters only from wave 3, every wave ends, and the same seed plays the same game
//   bots   - players with a person's reaction time: one who never fires loses early, a careful one
//            outlasts a sloppy one, and a careful one gets well into the waves

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'missile_command.html');
const ALL = ['rules', 'waves', 'bots'];
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
vm.runInContext(core[1] + '\nthis.C = LightsCore;', ctx);
const C = ctx.C;
const DT = 1 / 120;

// the geometry of a desktop and of a phone, as the page hands them over
const GEOS = {
    desktop: {W: 1000, H: 582, blast: 50, cities: [173, 286, 399, 601, 714, 827], bats: [{x: 51, y: 545}, {x: 500, y: 545}, {x: 949, y: 545}]},
    phone: {W: 1000, H: 1548, blast: 92, cities: [168, 281, 394, 606, 719, 832], bats: [{x: 44, y: 1480}, {x: 500, y: 1480}, {x: 956, y: 1480}]},
};
const fresh = (seed = 1, geo = GEOS.desktop) => C.create(seed, geo);
const run = (s, secs) => { const ev = []; for (let t = 0; t < secs - 1e-9; t += DT) ev.push(...C.step(s, DT)); return ev; };
// a still sky: a wave has begun but nothing more will arrive on its own
function still(geo) { const s = fresh(1, geo); C.startWave(s); s.plan = []; return s; }
// a warhead parked at (x, y), aimed at city ci; spd 0 keeps it there
function park(s, x, y, ci = 0, spd = 0) {
    const tx = s.cities[ci].x, len = Math.hypot(tx - x, s.H - y);
    const m = {id: s.nextId++, x0: x, y0: y, x, y, tx, ty: s.H, target: {kind: 'city', i: ci, x: tx}, len, d: 0, spd, split: 0};
    s.incoming.push(m);
    return m;
}
const types = ev => ev.map(e => e.type);

// ------------------------------------------------------------------ rules
function rules() {
    section('rules');
    for (const [name, geo] of Object.entries(GEOS)) {
        // a burst catches what it touches, and nothing a hair beyond
        let s = still(geo);
        const R = s.blast, x = 500, y = s.H * 0.4;
        park(s, x + R * 0.97, y);
        const far = park(s, x - R * 1.04, y);
        C.fire(s, x, y);
        const ev = run(s, 3);
        const caught = ev.filter(e => e.type === 'catch');
        check(caught.length === 1 && caught[0].m.x > x, `${name}: a burst catches inside its radius only`, `caught ${caught.length}`);
        check(s.incoming.includes(far), `${name}: the warhead just outside is still flying`);
        check(caught.length && caught[0].pts === C.CATCH, `${name}: a lone catch is worth ${C.CATCH} on wave 1`, caught[0] && caught[0].pts);

        // a chain: each caught warhead bursts smaller and can catch the next; the n-th pays n times
        s = still(geo);
        const gap = R * C.CHAIN_SCALE * 0.8;
        [0, 1, 2, 3].forEach(k => park(s, 300 + R * 0.5 + k * gap, s.H * 0.3));
        C.fire(s, 300, s.H * 0.3);
        const ch = run(s, 6).filter(e => e.type === 'catch');
        check(ch.map(e => e.n).join() === '1,2,3,4', `${name}: a chain counts 1,2,3,4`, ch.map(e => e.n).join());
        check(s.score === C.CATCH * (1 + 2 + 3 + 4), `${name}: a chain of four pays 1+2+3+4 catches`, s.score);
        check(s.stats.bestChain === 4, `${name}: the best chain is remembered`);
        // a chain links bursts that touch, never through empty sky
        s = still(geo);
        park(s, 300 + R * 0.5, s.H * 0.3);
        const lonely = park(s, 300 + R * 0.5 + R * 2.5, s.H * 0.3);
        C.fire(s, 300, s.H * 0.3);
        run(s, 6);
        check(s.incoming.includes(lonely), `${name}: a chain does not jump empty sky`);
    }

    // ten shells a bunker, nearest bunker first, the eleventh tap from the left goes to the middle
    let s = still(GEOS.desktop);
    const used = [];
    for (let k = 0; k < 10; k++) used.push(C.fire(s, 60, 100).bat);
    check(used.every(b => b === 0) && s.bats[0].ammo === 0, 'the nearest bunker answers until it is empty');
    check(C.fire(s, 60, 100).bat === 1, 'then the next nearest takes over');
    for (let k = 0; k < 19; k++) C.fire(s, 500, 100);
    check(s.bats.every(b => b.ammo === 0) && s.stats.fired === 30, 'thirty shells a wave, no more', s.stats.fired);
    const dry = C.fire(s, 500, 100);
    check(dry && dry.type === 'dry', 'a tap with nothing left is a dry click, not a shot');
    s = still(GEOS.desktop);
    check(C.fire(s, 60, 100, 2).bat === 2, 'A/S/D picks the bunker when it can');
    s.bats[2].ammo = 0;
    check(C.fire(s, 60, 100, 2).bat === 0, 'and falls back to the nearest when it cannot');
    const low = C.fire(s, 500, s.H * 0.999);
    check(low.shot.ty <= s.H * (1 - C.FLOOR) + 1e-9, 'nothing bursts in the streets');
    const quick = C.fire(s, 500, 0).shot;
    check(Math.abs(quick.dist / quick.spd - quick.dist / (s.H * C.SHOT_SPEED)) < 1e-9 && quick.dist / quick.spd < 0.75,
        'an interceptor crosses the sky in well under a second');

    // impacts: a city goes dark, a bunker loses its shells for the wave and comes back
    s = still(GEOS.desktop);
    const m = park(s, s.cities[2].x, s.H * 0.9, 2, 400);
    let ev = run(s, 1);
    check(!s.cities[2].alive && ev.some(e => e.type === 'impact' && e.hit), 'a warhead that lands takes its city');
    s = still(GEOS.desktop);
    park(s, 900, 40);   // keeps the wave open
    const bm = park(s, s.bats[1].x, s.H * 0.9, 0, 400);
    bm.target = {kind: 'bat', i: 1, x: s.bats[1].x}; bm.tx = s.bats[1].x; bm.len = s.H * 0.1;
    run(s, 1);
    check(!s.bats[1].alive && s.bats[1].ammo === 0, 'a bunker that is hit loses its shells');
    check(C.fire(s, 500, 100).bat !== 1, 'and cannot fire');
    C.startWave(s);
    check(s.bats[1].alive && s.bats[1].ammo === C.SHELLS, 'it is rebuilt and refilled for the next wave');
    // the last city ends the run
    s = still(GEOS.desktop);
    s.cities.forEach((c, i) => { c.alive = i === 4; });
    park(s, s.cities[4].x, s.H * 0.95, 4, 400);
    ev = run(s, 1);
    check(s.phase === 'over' && types(ev).includes('over'), 'losing the last city ends the run');

    // the count at the end of a wave
    s = still(GEOS.desktop);
    C.fire(s, 500, 100); C.fire(s, 500, 100); C.fire(s, 40, 100);
    s.cities[0].alive = false;
    ev = run(s, 3);
    check(s.phase === 'tally' && types(ev).includes('clear'), 'an empty sky ends the wave');
    let before = s.score, r = C.tally(s);
    check(r.shells === 27 && r.standing === 5 && r.total === 27 * C.SHELL_BONUS + 5 * C.CITY_BONUS && s.score === before + r.total,
        'the count pays every shell and every standing city', JSON.stringify(r));
    s = still(GEOS.desktop);
    s.wave = 5;
    r = C.tally(s);
    check(r.mult === 3 && r.total === 3 * (30 * C.SHELL_BONUS + 6 * C.CITY_BONUS), 'wave 5 counts at x3', r.total);
    // every 10,000 points a dark city is relit at the count
    s = still(GEOS.desktop);
    s.cities[1].alive = false; s.cities[3].alive = false;
    s.score = C.REBUILD_EVERY - 10;
    park(s, 300, 200);
    C.fire(s, 300, 200);
    ev = run(s, 3);
    check(types(ev).includes('spare') && s.spare === 1, 'crossing 10,000 earns a city');
    r = C.tally(s);
    check(r.rebuilt.length === 1 && s.cities.filter(c => c.alive).length === 5 && s.spare === 0, 'and the count relights one', JSON.stringify(r.rebuilt));
    // the multiplier table
    check([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 20].map(C.mult).join() === '1,1,2,2,3,3,4,4,5,5,6,6', 'x1 x1 x2 x2 ... x6 from wave 11');
}

// ------------------------------------------------------------------ waves
function waves() {
    section('waves');
    for (const [name, geo] of Object.entries(GEOS)) {
        for (let seed = 1; seed <= 40; seed++) {
            const s = C.create(seed * 977, geo);
            for (let w = 1; w <= 12; w++) {
                C.startWave(s);
                let top = 0, kids = 0, badTarget = 0, splitsEarly = 0, t = 0;
                while (s.phase === 'play' && t < 200) {
                    // a careful defender clears the sky every few seconds so the wave runs to its end
                    for (const e of C.step(s, DT)) {
                        if (e.type === 'spawn') {
                            top++;
                            const tg = e.m.target;
                            if (tg.kind === 'city' ? !s.cities[tg.i].alive : !s.bats[tg.i].alive) badTarget++;
                        }
                        if (e.type === 'split') { kids += e.kids.length; if (s.wave < 3) splitsEarly++; }
                    }
                    t += DT;
                    s.incoming.filter(m => m.d / m.len > 0.6).forEach(m => { s.incoming.splice(s.incoming.indexOf(m), 1); });
                    s.cities.forEach(c => { c.alive = true; });
                }
                if (!(top === C.waveSize(w))) { fail(`${name} seed ${seed} wave ${w}: ${top} warheads, wanted ${C.waveSize(w)}`); break; }
                if (badTarget) { fail(`${name} seed ${seed} wave ${w}: ${badTarget} aimed at a ruin`); break; }
                if (splitsEarly) { fail(`${name} seed ${seed}: a splitter before wave 3`); break; }
                if (s.phase !== 'tally') { fail(`${name} seed ${seed} wave ${w}: the wave never ended`); break; }
                C.tally(s);
            }
        }
        pass(`${name}: forty seeds x twelve waves - right count, live targets, no early splitters, every wave ends`);
    }
    // a warhead takes its wave's fall time to land, whatever its angle
    const s = still(GEOS.phone);
    s.wave = 4;
    for (let k = 0; k < 20; k++) {
        const m = C.opener(s, 50 * k, k % 6, 0);
        const T = m.len / m.spd;
        if (Math.abs(T - C.fallTime(1)) > 1e-6) { fail('fall time does not depend on the angle', T); break; }
    }
    pass('a warhead reaches the ground in its wave\'s fall time at any angle');
    check(C.fallTime(1) > C.fallTime(5) && C.fallTime(5) > C.fallTime(12) && C.fallTime(30) >= 6, 'later waves fall faster, never faster than 6 s');
    // determinism: the same seed and the same taps play the same game
    const trace = () => {
        const s = C.create(4242, GEOS.desktop), out = [];
        C.startWave(s);
        for (let i = 0; i < 120 * 60; i++) {
            if (i % 90 === 0 && s.incoming.length) { const m = s.incoming[0]; C.fire(s, m.x, m.y + 40); }
            const ev = C.step(s, DT);
            if (s.phase === 'tally') { C.tally(s); C.startWave(s); }
            if (ev.length) out.push(i + ':' + ev.map(e => e.type).join('/') + ':' + s.score);
            if (s.phase === 'over') break;
        }
        return out.join('|');
    };
    check(trace() === trace(), 'the same seed and the same taps play the same game');
}

// ------------------------------------------------------------------ bots
// A bot taps where a warhead will be when the burst is up - with a person's reaction time, a limit on
// how fast a thumb can tap, and an aiming error. It ignores what is already covered.
function play(seed, geo, {react = 0.35, every = 0.28, err = 0, lead = 1, idle = false} = {}) {
    const s = C.create(seed, geo);
    let r = seed >>> 0;
    const rand = () => { r = (Math.imul(r ^ r >>> 15, 0x2c1b3c6d) + 0x9E3779B9) >>> 0; return r / 4294967296; };
    const seen = new Map(), covered = new Set();
    let next = 0;
    C.startWave(s);
    for (let i = 0; i < 120 * 60 * 25; i++) {
        const ev = C.step(s, DT);
        for (const e of ev) if (e.type === 'spawn' || e.type === 'split') (e.kids || [e.m]).forEach(m => seen.set(m.id, s.t));
        if (s.phase === 'over') break;
        if (s.phase === 'tally') { C.tally(s); C.startWave(s); covered.clear(); continue; }
        if (idle || s.t < next) continue;
        // the lowest warhead the bot has noticed and not yet answered
        const cand = s.incoming.filter(m => !covered.has(m.id) && s.t - (seen.get(m.id) || 0) >= react).sort((a, b) => b.y - a.y)[0];
        if (!cand) continue;
        // when will a shell get there? iterate twice on the meeting point
        const bi = s.bats.reduce((best, b, j) => b.alive && b.ammo > 0 && (best < 0 || Math.abs(b.x - cand.x) < Math.abs(s.bats[best].x - cand.x)) ? j : best, -1);
        if (bi < 0) continue;
        const b = s.bats[bi], ux = (cand.tx - cand.x0) / cand.len, uy = (cand.ty - cand.y0) / cand.len;
        let px = cand.x, py = cand.y;
        for (let k = 0; k < 3; k++) {
            const T = Math.hypot(px - b.x, py - b.y) / (s.H * C.SHOT_SPEED) + C.GROW * 0.6;
            px = cand.x + ux * cand.spd * T * lead; py = cand.y + uy * cand.spd * T * lead;
        }
        if (py > s.H * (1 - C.FLOOR)) { covered.add(cand.id); continue; }
        const shot = C.fire(s, px + (rand() * 2 - 1) * err * s.blast, py + (rand() * 2 - 1) * err * s.blast);
        if (!shot || shot.type !== 'launch') continue;
        // anything the burst will cover counts as answered
        s.incoming.forEach(m => { if (Math.hypot(m.x - px, m.y - py) < s.blast * 1.5) covered.add(m.id); });
        next = s.t + every;
    }
    return {wave: s.wave, score: s.score, stopped: s.stats.stopped, fired: s.stats.fired, chain: s.stats.bestChain};
}
const median = a => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
function bots() {
    section('bots');
    for (const [name, geo] of Object.entries(GEOS)) {
        const seeds = Array.from({length: 15}, (_, i) => 1000 + i * 31);
        const idle = seeds.map(sd => play(sd, geo, {idle: true}));
        const sloppy = seeds.map(sd => play(sd, geo, {err: 1.1, react: 0.6, every: 0.45}));
        const careful = seeds.map(sd => play(sd, geo, {err: 0.25}));
        const W = r => median(r.map(x => x.wave)), Sc = r => median(r.map(x => x.score));
        console.log(`  ${name.padEnd(7)} waves reached (median)  idle ${W(idle)}  sloppy ${W(sloppy)}  careful ${W(careful)}` +
            `   score  sloppy ${Sc(sloppy)}  careful ${Sc(careful)}   careful best chain ${Math.max(...careful.map(x => x.chain))}`);
        check(W(idle) <= 3, `${name}: a player who never fires is gone by wave 3`, W(idle));
        check(W(sloppy) < W(careful) && Sc(sloppy) < Sc(careful), `${name}: a careful player outlasts a sloppy one`);
        check(W(careful) >= 7, `${name}: a careful player gets past wave 6`, W(careful));
        check(W(careful) <= 30, `${name}: but the night still ends`, W(careful));
        check(careful.some(x => x.chain >= 3), `${name}: chains of three happen in ordinary play`);
    }
}

const RUN = {rules, waves, bots};
for (const s of suites) { if (!RUN[s]) { console.log('unknown suite ' + s); process.exit(1); } RUN[s](); }
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
