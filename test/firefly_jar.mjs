#!/usr/bin/env node
// Test suite for games/firefly_jar.html.
//
// Firefly Jar is an incremental: every number pulls on every other, and the ways it goes wrong
// are invisible on the page. A season that takes three times as long as the one before, a
// multiplier that feeds another until a night earns fifty nights' worth, a wall of saving
// before a gate, a passive helper that plays better than the player. So the page keeps its
// rules in a <script id="core"> block with no DOM, and this runs that block in Node: bots with
// a person's reaction time and pointer speed play the whole year, on a phone-sized meadow and
// a desktop one, and the pacing targets are checked against what they did.
//
//   node test/firefly_jar.mjs                 # everything (about a minute)
//   node test/firefly_jar.mjs rules skill     # named suites only
//   node test/firefly_jar.mjs pace --report   # print the bots' year night by night
//   node test/firefly_jar.mjs pace --seed=7   # the same year on other seeds
//   node test/firefly_jar.mjs --page=old.html # run against another copy of the page
//
// Suites: rules, skill, pace.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'firefly_jar.html');
const REPORT = args.includes('--report');
const seedArg = args.find(a => a.startsWith('--seed='));
const SEED = seedArg ? +seedArg.slice(7) : 3;
const ALL = ['rules', 'skill', 'pace'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

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
vm.runInContext(core[1] + '\nthis.FJ = FJ;', ctx);
const FJ = ctx.FJ;
const fmt = FJ.fmt, min = s => (s / 60).toFixed(1) + ' min';

const PHONE = {name: 'phone', W: 390, H: 844, vmax: 650};
const DESK = {name: 'desktop', W: 1280, H: 800, vmax: 1000};
const DT = 1 / 30, OVERHEAD = 8;       // seconds a person spends on the summary and the tree per night

/* ---------------- players ----------------
   A player looks at the meadow every `react` seconds, decides where to go, and moves the
   pointer there no faster than `vmax` pixels a second. The jar follows the pointer the way
   it does on the page. */
function player(opt) {
    const o = Object.assign({react: .3, vmax: 700, style: 'hunter'}, opt);
    let px = null, py = null, aim = null, look = 0;
    return (G, N) => {
        const P = N.P, jar = N.jar, d = (x, y) => Math.hypot(x - jar.x, y - jar.y);
        if (px === null) { px = jar.x; py = jar.y; }
        if (o.style === 'idle') return {x: jar.x, y: jar.y};
        look -= DT;
        if (look <= 0) {
            look = o.react;
            aim = decide(G, N, o, d);
        }
        let tx = px, ty = py;
        if (aim) {
            if (aim.f) { tx = aim.f.x; ty = aim.f.y; }
            else if (aim.aurora) { tx = jar.x + 60 > N.W - 30 ? 30 : jar.x + 60; ty = N.aurora ? FJ.auroraY(N, tx) : jar.y; }
            else { tx = aim.x; ty = aim.y; }
        }
        const dx = tx - px, dy = ty - py, dd = Math.hypot(dx, dy), st = o.vmax * DT;
        if (dd > st) { px += dx / dd * st; py += dy / dd * st; } else { px = tx; py = ty; }
        return {x: px, y: py};
    };
}
function decide(G, N, o, d) {
    const P = N.P, jar = N.jar, left = N.T - N.t, bank = N.lay.bank;
    // where the jar can be emptied: the lantern, flowers, the first stone of a path, and on
    // every other night a bud
    let drops = [{x: bank.x, y: bank.y}].concat(N.flowers, o.style === 'hunter' ? N.paths.map(p => p.pts[0]) : []);
    if (N.buds.length && G.seasonNights % 2 === 0) drops = drops.concat(N.buds);
    const near = drops.reduce((b, q) => !b || d(q.x, q.y) < d(b.x, b.y) ? q : b, null);
    const atBank = jar.n > 0 && (d(bank.x, bank.y) < bank.r || N.flowers.some(f => d(f.x, f.y) < 42));
    if (atBank) return {x: jar.x, y: jar.y};
    if (jar.n >= P.cap || (jar.n > 0 && P.keep < 1 && left < d(near.x, near.y) / o.vmax + 1)) return {x: near.x, y: near.y};
    if (o.style === 'hunter') {
        if (N.aurora && N.aurora.dur - N.aurora.t > 1.5) return {aurora: true};
        if (N.trail) {
            const p = FJ.wispPos(N, N.trail.w[N.trail.next]);
            if (d(p.x, p.y) / o.vmax + .4 < N.trail.life - N.trail.t) return {x: p.x, y: p.y};
        }
        if (N.meteor) {
            const m = N.meteor, tt = d(m.x, m.y) / o.vmax + o.react;
            if (m.t + tt < 1.5) return {x: m.x + m.vx * tt, y: m.y + m.vy * tt};
        }
    }
    let best = null, bs = -1;
    for (const f of N.flies) {
        const tt = d(f.x, f.y) / o.vmax + o.react;
        let s;
        if (o.style === 'hunter') {
            // is it still (or already again) glowing when the jar gets there?
            const p = f.ph % 1, on = P.on;
            const glow = f.k !== 'n' || (p < on && (on - p) * f.T > tt) || ((1 - p) * f.T < tt && (1 - p + on) * f.T > tt);
            let v = f.k === 'b' ? 4 : f.k === 'g' ? 10 : 1;
            if (glow) v *= P.glow;
            if (N.crystals.length) v *= Math.pow(P.beamMul, FJ.beamsAt(N, f.x, f.y));
            s = v / (tt + .25);
        } else s = 1 / (tt + .01);
        if (s > bs) { bs = s; best = f; }
    }
    return best ? {f: best} : null;
}

// spends like a person who lights whatever is cheapest, and turns the season once nothing
// cheaper than the gate is left to buy
function shop(G) {
    for (;;) {
        const r = FJ.ROOTS.filter(q => FJ.canBuy(G, q)).sort((a, b) => FJ.cost(G, a) - FJ.cost(G, b) || (a.id === 'deep' ? -1 : 1))[0];
        if (!r) break;
        FJ.buy(G, r.id);
    }
    if (G.roots.memory) FJ.relight(G);
    for (;;) {
        const c = FJ.NODES.filter(q => !q.gate && !q.final && FJ.canBuy(G, q)).sort((a, b) => FJ.cost(G, a) - FJ.cost(G, b))[0];
        if (!c) break;
        FJ.buy(G, c.id);
    }
    const gate = FJ.NODES.find(q => (q.gate || q.final) && FJ.canBuy(G, q));
    return gate ? FJ.buy(G, gate.id) : false;
}
function night(G, size, seed, style) {
    const N = FJ.newNight(G, size.W, size.H, seed), act = player({vmax: size.vmax, style});
    while (!N.over) { FJ.step(G, N, act(G, N), DT); N.events.length = 0; }
    return {N, s: FJ.endNight(G, N)};
}
function playYear(size, seed) {
    const G = FJ.newGame(seed), log = [];
    let wall = 0, k = 0;
    while (!G.done && k < 400) {
        const {N, s} = night(G, size, seed * 1000 + k++, 'hunter');
        wall += N.T + OVERHEAD;
        const season = G.season, before = G.bought;
        const summerLv = FJ.NODES.filter(q => q.s === 0 && !q.gate).reduce((a, q) => a + FJ.lvl(G, q.id), 0);
        const r = shop(G);
        log.push({k, season, T: N.T, total: s.total, buds: s.buds, budsIn: s.budsIn, bought: G.bought - before, turned: !!r && r !== 'lit', wall,
            summerLv: FJ.NODES.filter(q => q.s === 0 && !q.gate).reduce((a, q) => a + FJ.lvl(G, q.id), 0), summerBefore: summerLv});
    }
    return {G, log, wall};
}

/* ---------------- rules ---------------- */
function rules() {
    section('rules');
    const W = 800, H = 700;
    const fresh = () => { const G = FJ.newGame(7); return {G, N: FJ.newNight(G, W, H, 11)}; };
    const at = (N, f, dark) => { f.x = N.jar.x; f.y = N.jar.y; f.ph = dark ? .8 : N.P.on / 2; f.sp = 0; };

    // the fix for the prototype's frustration: a dark firefly is always there for the taking
    {
        const {G, N} = fresh(); N.flies = [N.flies[0]]; N.flies[0].k = 'n'; at(N, N.flies[0], true);
        FJ.step(G, N, {x: N.jar.x, y: N.jar.y}, DT);
        check(N.jar.n === 1, 'a dark firefly inside the jar is caught at once', `jar holds ${N.jar.n}`);
        const dark = N.jar.val;
        const b = fresh(); b.N.flies = [b.N.flies[0]]; b.N.flies[0].k = 'n'; at(b.N, b.N.flies[0], false);
        FJ.step(b.G, b.N, {x: b.N.jar.x, y: b.N.jar.y}, DT);
        check(Math.abs(b.N.jar.val / dark - b.N.P.glow) < 1e-9, `one caught in the glow is worth ×${b.N.P.glow}`, `ratio ${b.N.jar.val / dark}`);
    }
    // a full jar catches nothing and says so
    {
        const {G, N} = fresh(); N.jar.n = N.P.cap; at(N, N.flies[0], true);
        FJ.step(G, N, {x: N.jar.x, y: N.jar.y}, DT);
        check(N.jar.n === N.P.cap && N.events.some(e => e.e === 'full'), 'a full jar leaves fireflies alone and warns');
    }
    // the lantern empties the jar into the night's light; dawn takes what is left unless kept
    {
        const {G, N} = fresh(); N.flies = [];
        N.jar.items = [{v: 1}, {v: 3}, {v: 1}]; N.jar.n = 3; N.jar.val = 5;
        const b = N.lay.bank; N.jar.x = b.x; N.jar.y = b.y;
        for (let i = 0; i < 30; i++) FJ.step(G, N, {x: b.x, y: b.y}, DT);
        check(N.jar.n === 0 && N.earned === 5, 'the lantern takes the whole jar', `jar ${N.jar.n}, earned ${N.earned}`);
        const c = fresh(); c.N.jar.items = [{v: 2}, {v: 2}]; c.N.jar.n = 2; c.N.jar.val = 4; c.N.flies = []; c.N.earned = 0;
        c.N.over = true; const s = FJ.endNight(c.G, c.N);
        check(s.lost === 2 && s.total === 0, 'at sunrise an unkept jar flies away', `lost ${s.lost}, total ${s.total}`);
        const d = fresh(); d.G.lv.night = 1; d.G.lv.dawn = 2; const N2 = FJ.newNight(d.G, W, H, 3);
        N2.jar.items = [{v: 2}, {v: 2}]; N2.jar.n = 2; N2.jar.val = 4; N2.over = true;
        check(FJ.endNight(d.G, N2).total === 4, 'Late Homecoming keeps the jar at sunrise');
    }
    // nights have an end, however the tree is lit
    {
        const G = FJ.newGame(1);
        for (const n of FJ.NODES) if (!n.gate && !n.final) G.lv[n.id] = n.max;
        for (const r of FJ.ROOTS) G.roots[r.id] = r.max;
        const T = FJ.params(G).time;
        check(T <= 80, `the longest night is ${T} s (limit 80)`);
    }
    // turning the season: crown dark, gates and roots kept, rings paid, memory of levels kept
    {
        const G = FJ.newGame(1); G.lv = {night: 3, bright: 5, sync: 1}; G.ever = {night: 3, bright: 5, sync: 1};
        const gate = FJ.byId.gate1; G.light = FJ.cost(G, gate);
        const r = FJ.buy(G, 'gate1');
        check(r === 'season' && G.season === 1, 'the Autumn gate turns the season');
        check(FJ.lvl(G, 'night') === 0 && FJ.lvl(G, 'gate1') === 1, 'the crown goes dark, the gate stays lit');
        check(G.rings === FJ.RINGS[0] && G.light === Math.round(gate.base * .02), `closing Summer pays ${FJ.RINGS[0]} rings and starts Autumn with 2% of the gate`);
        const full = FJ.byId.bright.base;
        check(FJ.cost(G, FJ.byId.bright) === Math.ceil(full * .25), 'a lantern lit before costs a quarter to light again');
        G.roots.oldwood = 1;
        check(FJ.cost(G, FJ.byId.bright) === Math.ceil(full * .1), 'Old Wood brings it down to a tenth');
        G.light = 1e6; G.roots.memory = 1; FJ.relight(G);
        check(FJ.lvl(G, 'bright') === 5 && FJ.lvl(G, 'night') === 3 && FJ.lvl(G, 'glass') === 0, 'Relight lights what burned before, and nothing else');
        const G2 = FJ.newGame(1); G2.roots.embers = 1; G2.light = FJ.byId.gate1.base; G2.lv.sync = 1; G2.lv.eye = 1; G2.lv.bright = 1;
        FJ.buy(G2, 'gate1');
        check(G2.light === Math.round(FJ.byId.gate1.base * .06), 'Embers starts the season with 6% of the last gate', `light ${G2.light}`);
    }
    // the same seed plays the same night
    {
        const a = FJ.newGame(5), b = FJ.newGame(5);
        const ra = night(a, PHONE, 99, 'hunter').s.total, rb = night(b, PHONE, 99, 'hunter').s.total;
        check(ra === rb, 'a night is reproducible from its seed', `${ra} vs ${rb}`);
    }
    // will-o'-wisps: a finished trail lays a path; the catch dropped at its stone walks home
    {
        const G = FJ.newGame(2); G.season = 1; G.gates.gate1 = 1; G.lv.wisp = 1;
        const N = FJ.newNight(G, W, H, 5); N.flies = []; N.spawnQ = []; N.trailT = 0;
        FJ.step(G, N, null, DT);
        check(!!N.trail, 'a trail rises when its time comes');
        let guard = 0;
        while (N.trail && guard++ < 50) { const p = FJ.wispPos(N, N.trail.w[N.trail.next]); N.jar.x = p.x; N.jar.y = p.y; FJ.step(G, N, {x: p.x, y: p.y}, DT); N.flies = []; }
        check(N.paths.length === 1 && N.st.trails === 1, 'touching the wisps in order lays a path', `paths ${N.paths.length}`);
        const s0 = N.paths[0].pts[0], before = N.earned;
        N.jar.items = [{v: 10}, {v: 10}]; N.jar.n = 2; N.jar.val = 20; N.jar.x = s0.x; N.jar.y = s0.y;
        FJ.step(G, N, {x: s0.x, y: s0.y}, DT);
        check(N.jar.n === 0 && N.paths[0].items.length === 2, 'the first stone takes the jar');
        for (let i = 0; i < 30 * 20 && N.paths[0].items.length; i++) { FJ.step(G, N, {x: 5, y: 5}, DT); N.flies = []; if (N.trail) N.trail = null; }
        check(Math.abs(N.earned - before - 20 * N.P.pathMul) < 1e-6, 'and what it took arrives at the lantern', `+${N.earned - before}`);
    }
    // buds keep light for three nights and give it back grown
    {
        const G = FJ.newGame(3); G.season = 3; for (let i = 1; i <= 3; i++) G.gates['gate' + i] = 1; G.light = 1e9;
        G.lv.bud = 0; FJ.buy(G, 'bud');
        check(G.buds.length === 2, 'Buds plants two buds');
        let N = FJ.newNight(G, W, H, 1); const bd = N.buds[0];
        N.jar.items = [{v: 100}]; N.jar.n = 1; N.jar.val = 100; N.jar.x = bd.x; N.jar.y = bd.y; N.flies = [];
        FJ.step(G, N, {x: bd.x, y: bd.y}, DT);
        check(G.buds[0].stored === 100, 'emptying the jar over a bud stores it');
        const grow = N.P.budGrow; let bloom = 0;
        for (let k = 0; k < 3; k++) { N.over = true; bloom = FJ.endNight(G, N).buds; N = FJ.newNight(G, W, H, 2 + k); }
        check(Math.abs(bloom - 100 * Math.pow(1 + grow, 3)) < 1e-6, `after three nights it blooms: 100 → ${bloom.toFixed(1)}`);
    }
}

/* ---------------- skill ----------------
   The catch rule has to reward attention without punishing hurry. Three players on the same
   meadow with the same lanterns lit: one hunts the glow, one sweeps up whatever is nearest,
   one leaves the jar where it is. */
function skill() {
    section('skill');
    const setups = [
        ['early summer', G => { G.lv.night = 1; G.lv.bright = 2; G.lv.cap = 1; }],
        ['mid summer', G => Object.assign(G.lv, {night: 3, bright: 4, cap: 3, glass: 2, meadow: 3, eye: 1})],
        ['late summer', G => { for (const n of FJ.NODES) if (n.s === 0 && !n.gate) G.lv[n.id] = n.max; }],
    ];
    const ratios = [];
    for (const size of [PHONE, DESK]) for (const [name, lit] of setups) {
        const res = {};
        for (const style of ['hunter', 'sweeper', 'idle']) {
            let sum = 0;
            for (let k = 0; k < 4; k++) { const G = FJ.newGame(1); lit(G); sum += night(G, size, 500 + k, style).s.total; }
            res[style] = sum / 4;
        }
        const r = res.hunter / res.sweeper;
        ratios.push(r);
        // late in a season the meadow glows so often that there is little left to hunt; that is
        // the reward for the lanterns, and it must not turn into a penalty for paying attention
        if (name === 'late summer') check(r >= .95, `${size.name}, ${name}: hunting the glow costs nothing (×${r.toFixed(2)})`);
        else check(r >= 1.08, `${size.name}, ${name}: hunting the glow pays (×${r.toFixed(2)})`);
        check(res.sweeper >= res.hunter * .6, `${size.name}, ${name}: sweeping is not punished (${(100 * res.sweeper / res.hunter).toFixed(0)}% of the hunter)`);
        check(res.idle <= res.hunter * .12, `${size.name}, ${name}: the jars in the grass never play the game for you (${(100 * res.idle / res.hunter).toFixed(1)}%)`);
    }
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    check(mean >= 1.12, `across the summer, hunting the glow earns ×${mean.toFixed(2)} of sweeping`);
}

/* ---------------- pace ---------------- */
// minutes of bot time; a person takes about half as long again
const TARGET = {first: [11, 20], season: [9, 22], total: [60, 105]};
function pace() {
    section('pace');
    for (const size of [PHONE, DESK]) {
        const {G, log, wall} = playYear(size, SEED);
        const tag = size.name;
        check(G.done, `${tag}: the bot reaches the Milky Way`, `stuck in ${FJ.SEASONS[G.season]} after ${log.length} nights`);
        // season lengths
        let start = 0, starts = [0];
        const lens = [];
        for (const l of log) if (l.turned || (G.done && l === log[log.length - 1])) { lens.push(l.wall - start); start = l.wall; starts.push(l.k); }
        lens.forEach((t, s) => {
            const [lo, hi] = s === 0 ? TARGET.first : TARGET.season;
            check(t / 60 >= lo && t / 60 <= hi, `${tag}: ${FJ.SEASONS[s]} takes ${min(t)} (${lo}–${hi})`);
        });
        check(wall / 60 >= TARGET.total[0] && wall / 60 <= TARGET.total[1], `${tag}: the whole year takes ${min(wall)} (${TARGET.total.join('–')})`);
        check(log.every(l => l.T <= 80), `${tag}: no night is longer than 80 s`);
        // after a turn, the lanterns of summer come back three times as fast as they first did
        const first = log.filter(l => l.season === 0), lvEnd = Math.max(...first.map(l => l.summerBefore));
        const aim = Math.ceil(lvEnd * .8);
        const tFirst = first.find(l => l.summerLv >= aim).wall;
        for (let s = 1; s < 5; s++) {
            const ls = log.filter(l => l.season === s);
            if (!ls.length) continue;
            const s0 = ls[0].wall - ls[0].T - OVERHEAD, hit = ls.find(l => l.summerLv >= aim);
            const t = hit ? hit.wall - s0 : Infinity;
            check(tFirst / t >= 3, `${tag}: ${FJ.SEASONS[s]} relights summer ${(tFirst / t).toFixed(1)}× as fast as the first summer`);
        }
        // a curve, not a jump: once the old lanterns are relit, no night earns more than four
        // times the night before. Light put into a bud counts for the night that earned it, and a
        // bud blooming is the harvest of earlier nights, so it is left out. Midsummer is the
        // finale and is meant to run away (a bloom there can pay for three levels at once), but
        // over a week of nights rather than in one.
        let worst = 0, where = '', worstMid = 0;
        for (let s = 0; s < 5; s++) {
            const ls = log.filter(l => l.season === s).slice(5);
            for (let i = 1; i < ls.length; i++) {
                const made = l => l.total - l.buds + l.budsIn, r = made(ls[i]) / Math.max(1, made(ls[i - 1]));
                if (s === 4) worstMid = Math.max(worstMid, r);
                else if (r > worst) { worst = r; where = `${FJ.SEASONS[s]}, night ${ls[i].k}`; }
            }
        }
        check(worst <= 4, `${tag}: the steepest night-to-night rise is ×${worst.toFixed(1)} (${where})`);
        const midNights = log.filter(l => l.season === 4).length;
        check(worstMid <= 16 && midNights >= 7, `${tag}: Midsummer runs away over ${midNights} nights, at most ×${worstMid.toFixed(1)} a night`);
        // no wall of saving before a gate
        let dry = 0, longest = 0;
        for (const l of log) { dry = l.bought ? 0 : dry + 1; longest = Math.max(longest, dry); }
        check(longest <= 4, `${tag}: at most ${longest} nights in a row with nothing to light`);
        if (REPORT) {
            console.log(`\n  ${tag}: ${log.length} nights, ${min(wall)}`);
            for (const l of log) console.log(`    #${String(l.k + 1).padStart(3)} ${FJ.SEASONS[l.season].padEnd(9)} ${String(l.T).padStart(2)} s  ✦ ${fmt(l.total).padStart(7)}  lit ${String(l.bought).padStart(2)}${l.turned ? '  → season turns' : ''}`);
        }
    }
}

const RUN = {rules, skill, pace};
for (const s of suites) {
    if (!RUN[s]) { console.log(`unknown suite ${s}; suites are ${ALL.join(', ')}`); process.exit(1); }
    RUN[s]();
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
