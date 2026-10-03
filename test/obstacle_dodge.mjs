#!/usr/bin/env node
// Test suite for games/obstacle_dodge.html (point & line).
//
// Runs the page's DOM-free <script id="core"> block in Node: the shapes, where they wait, when they may
// cross, how they move and what touching or grazing them means. A dodge game makes one promise - you
// were warned, and what you saw is what hit you - and every part of it is a number somewhere that a
// change elsewhere can quietly break. No browser, no server.
//
//   node test/obstacle_dodge.mjs                 # everything
//   node test/obstacle_dodge.mjs geometry fair   # named suites only
//   node test/obstacle_dodge.mjs --page=path.html
//
// Suites:
//   geometry - the distance every collision and graze is judged by, against brute force on a grid
//   fair     - seeded runs on portrait and landscape sheets: every shape waits in the bleed for its
//              warning without touching the trim, nothing hurts before it has waited, every line keeps a
//              gap the point fits through, the triangle darts exactly where its line pointed when it
//              locked, circles bounce as often as they say and then leave, and stages come on time
//   rules    - a run is the same run for the same seed whatever the player does, a flung point cannot
//              pass through a shape between two frames, grazes count once per shape
//   bots     - planners with a person's reaction time play whole runs: standing still loses early, a
//              careful player outlasts a hasty one, and both reach the black lines on both sheets

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'obstacle_dodge.html');
const ALL = ['geometry', 'fair', 'rules', 'bots'];
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
vm.runInContext(core[1] + '\nthis.K = PointCore;', ctx);
const K = ctx.K;
const SHEETS = [{W: 400, H: 640, name: 'portrait'}, {W: 648, H: 400, name: 'landscape'}];
const clone = s => JSON.parse(JSON.stringify(s));

// ------------------------------------------------------------------ geometry
function inside(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
}
function geometry() {
    section('geometry');
    const s = K.create({seed: 1});
    let bad = 0, n = 0;
    // brute force: the true distance to a shape is the distance to the nearest of its sampled inked cells
    const shapes = [];
    for (let i = 0; i < 12; i++) shapes.push({kind: 'square', x: 200, y: 300, size: 30 + i * 3, ang: i * 0.37});
    for (let i = 0; i < 12; i++) shapes.push({kind: 'triangle', x: 200, y: 300, size: 22, ang: i * 0.53 - 2});
    for (let i = 0; i < 4; i++) shapes.push({kind: 'circle', x: 200, y: 300, r: 14 + i * 5});
    for (const e of shapes) {
        const inked = [], h = 0.5;
        const p = e.kind === 'circle' ? null : K.poly(e);
        for (let x = 120; x <= 280; x += h) for (let y = 220; y <= 380; y += h) {
            const on = p ? inside(p, x, y) : Math.hypot(x - e.x, y - e.y) <= e.r;
            if (on) inked.push([x, y]);
        }
        if (p) for (const v of p) inked.push(v);   // the corners are ink too, and a grid misses a sharp tip
        for (let k = 0; k < 160; k++) {
            const a = k * 2.399, rr = 2 + (k % 40) * 1.3, px = 200 + Math.cos(a) * rr, py = 300 + Math.sin(a) * rr;
            const d = K.dist(e, px, py, s);
            let bf = 1e9; for (const [x, y] of inked) bf = Math.min(bf, Math.hypot(x - px, y - py));
            n++;
            // the grid only ever overestimates (most at a triangle's sharp tip), and the core must never say farther
            if (d - bf > 0.4 || bf - d > 0.75) { bad++; if (bad < 4) fail(`${e.kind} distance at (${px.toFixed(1)}, ${py.toFixed(1)})`, `core ${d.toFixed(2)} vs brute force ${bf.toFixed(2)}`); }
        }
    }
    check(bad === 0, `${n} distances to squares, triangles and circles match brute force within the grid`, `${bad} off`);
    // lines: two bars and a gap; inside the gap the point is clear, on a bar it is hit
    const ln = {kind: 'line', horiz: true, x: 200, y: 300, gap: 150, gw: 60, edge: 0};
    check(K.dist(ln, 150, 300, s) > K.R_HIT + 20, 'the middle of a line\'s gap is clear of it');
    check(K.dist(ln, 150 - 30 + K.R_HIT + 1, 300, s) > K.R_HIT - 1e-9, 'a point hugging the gap\'s edge is not touching');
    check(K.dist(ln, 50, 300, s) === 0 && K.dist(ln, 390, 300, s) === 0, 'either bar is ink');
    const lv = {kind: 'line', horiz: false, x: 200, y: 300, gap: 400, gw: 60, edge: 3};
    check(K.dist(lv, 200, 400, s) > 20 && K.dist(lv, 200, 100, s) === 0, 'an upright line works the same way');
    // the triangle points where its angle says: its tip is the vertex furthest along the heading
    for (let i = 0; i < 8; i++) {
        const e = {kind: 'triangle', x: 0, y: 0, size: 22, ang: i * 0.8}, p = K.poly(e);
        const along = p.map(v => v[0] * Math.cos(e.ang) + v[1] * Math.sin(e.ang));
        if (along[0] !== Math.max(...along)) { fail('the triangle\'s first vertex is its tip', `angle ${e.ang}`); break; }
        if (i === 7) pass('the triangle\'s first vertex is its tip');
    }
}

// ------------------------------------------------------------------ fair
// a run with a scripted player: still, or wandering, or a planner (below)
function wanderer(seed) {
    let a = seed % 7, next = 0;
    return s => { if (s.t >= next) { a += 2.1; next = s.t + 0.6; } return [s.px + Math.cos(a) * 6, s.py + Math.sin(a) * 6]; };
}
function run(sheet, seed, who, cap = 80, watch, ghost) {
    const s = K.create({seed, W: sheet.W, H: sheet.H, ghost});   // a ghost sees the whole run through
    const dt = 1 / 60;
    while (s.alive && s.t < cap) {
        const tgt = who ? who(s) : [s.px, s.py];
        const ev = K.step(s, dt, tgt[0], tgt[1]);
        if (watch) watch(s, ev);
    }
    return s;
}
function fair() {
    section('fair');
    let waits = 0, early = 0, inTrim = 0, gaps = 0, badGap = 0, darts = 0, crooked = 0, circles = 0, overBounce = 0;
    let stages = 0, lateStage = 0, enters = 0, shortWait = 0, hits = 0;
    for (const sheet of SHEETS) for (let seed = 1; seed <= 24; seed++) {
        const seen = new Map();
        run(sheet, seed * 7919, seed % 2 ? wanderer(seed) : null, 75, (s, ev) => {
            for (const e of s.ents) {
                if (!seen.has(e.id)) seen.set(e.id, {born: e.born, warn: e.warn, bounces: e.bounces});
                if (e.phase === 'wait') {
                    waits++;
                    // nothing waiting may reach into the trim
                    if (e.kind === 'line') { if (e.horiz ? (e.y + K.BAR / 2 > 1e-6 && e.y - K.BAR / 2 < s.H - 1e-6) : (e.x + K.BAR / 2 > 1e-6 && e.x - K.BAR / 2 < s.W - 1e-6)) inTrim++; }
                    else {
                        // the trim's interior, shrunk by a hair: touching the dieline is waiting, crossing it is not
                        const inner = (x, y) => x > 1e-6 && x < s.W - 1e-6 && y > 1e-6 && y < s.H - 1e-6;
                        let intr;
                        if (e.kind === 'circle') {
                            const dx = Math.max(0 - e.x, 0, e.x - s.W), dy = Math.max(0 - e.y, 0, e.y - s.H);
                            intr = Math.hypot(dx, dy) < e.r - 1e-6;
                        } else {
                            const p = K.poly(e); intr = false;
                            for (let a = 0; a < p.length && !intr; a++) { const q = p[(a + 1) % p.length]; for (let u = 0; u <= 1; u += 0.05) if (inner(p[a][0] + (q[0] - p[a][0]) * u, p[a][1] + (q[1] - p[a][1]) * u)) intr = true; }
                        }
                        if (intr) inTrim++;
                    }
                }
                if (e.kind === 'line' && !e._checked) {
                    e._checked = true; gaps++;
                    const len = e.horiz ? s.W : s.H;
                    if (e.gw < 2 * K.R_HIT + 40 || e.gap - e.gw / 2 < 10 || e.gap + e.gw / 2 > len - 10) badGap++;
                }
                if (e.kind === 'circle' && e.bounces < 0) overBounce++;
            }
            for (const x of ev) {
                if (x.type === 'enter') { enters++; const m = seen.get(x.id); if (m && x.t - m.born < m.warn - 1e-9) shortWait++; }
                if (x.type === 'hit') { hits++; const m = seen.get(x.id); if (m && x.t - m.born < m.warn - 1e-9) early++; }
                if (x.type === 'lock') { const e = s.ents.find(q => q.id === x.id); if (e) e._lockAng = e.ang; }
                if (x.type === 'dart') {
                    const e = s.ents.find(q => q.id === x.id); darts++;
                    if (!e || Math.abs(Math.atan2(e.vy, e.vx) - e._lockAng) > 1e-9 && Math.abs(Math.abs(Math.atan2(e.vy, e.vx) - e._lockAng) - 2 * Math.PI) > 1e-9) crooked++;
                }
                if (x.type === 'stage') { stages++; if (Math.abs(x.t - K.STAGES[x.stage].t) > K.FIXED * 1.5) lateStage++; }
            }
        }, true);
        for (const m of seen.values()) if (m.bounces !== undefined) circles++;
    }
    check(inTrim === 0, `no waiting shape reaches into the trim (${waits} waiting frames)`, `${inTrim} did`);
    check(shortWait === 0 && enters > 200, `every shape waits its whole warning before crossing (${enters} crossings)`, `${shortWait} came early`);
    check(early === 0 && hits > 100, `nothing ever hits before it has waited (${hits} hits)`);
    check(badGap === 0 && gaps > 10, `every line keeps a gap the point fits through, clear of the sheet's edges (${gaps} lines)`, `${badGap} too tight`);
    check(crooked === 0 && darts > 10, `every triangle darts along the line it locked on (${darts} darts)`, `${crooked} veered`);
    check(overBounce === 0 && circles > 20, `circles never bounce more often than they were given (${circles} circles)`);
    check(lateStage === 0 && stages > 30, 'every stage starts on the second it is printed at');
    // a circle given n bounces bounces n times and then leaves the sheet
    {
        const s = K.create({seed: 3, W: 400, H: 640});
        s.due = {square: 1e9, circle: 1e9, triangle: 1e9, line: 1e9}; s.t = 11; s.stage = 1;
        const e = {kind: 'circle', r: 20, x: 200, y: -20, vx: 90, vy: 160, bounces: 3, inside: false, ang: 0, edge: 0, id: 99, born: 11, warn: 0, phase: 'wait'};
        s.ents.push(e); s.px = 5.5; s.py = 634; s.tx = s.px; s.ty = s.py;
        let b = 0; const dt = 1 / 60;
        for (let i = 0; i < 60 * 30 && s.ents.length; i++) for (const x of K.step(s, dt)) if (x.type === 'bounce') b++;
        check(b === 3 && s.ents.length === 0, 'a circle with three bounces bounces three times and leaves', `bounced ${b}, still there: ${s.ents.length}`);
    }
}

// ------------------------------------------------------------------ rules
function rules() {
    section('rules');
    const geo = (s, id) => { const e = s.ents.find(q => q.id === id); return e ? `@${e.x.toFixed(3)},${e.y.toFixed(3)}` : '?'; };
    // the same seed is the same run: the shapes do not depend on where the player goes
    for (const sheet of SHEETS) {
        const a = [], b = [];
        const ra = run(sheet, 4242, null, 60, (s, ev) => ev.forEach(x => x.type === 'wait' && a.push(x.t.toFixed(4) + x.kind + geo(s, x.id))), true);
        const rb = run(sheet, 4242, wanderer(5), 60, (s, ev) => ev.forEach(x => x.type === 'wait' && b.push(x.t.toFixed(4) + x.kind + geo(s, x.id))), true);
        const n = Math.min(a.length, b.length);
        check(n > 40 && a.slice(0, n).join() === b.slice(0, n).join(), `${sheet.name}: what comes, and when, is the seed's alone (${n} shapes compared)`);
        const c = []; const rc = run(sheet, 4242, wanderer(3), 60, (s, ev) => ev.forEach(x => c.push(x.type + x.t.toFixed(4))));
        const d = []; const rd = run(sheet, 4242, wanderer(3), 60, (s, ev) => ev.forEach(x => d.push(x.type + x.t.toFixed(4))));
        check(c.length > 5 && c.join() === d.join() && rc.t === rd.t && rc.px === rd.px, `${sheet.name}: a run replays exactly`);
    }
    // a flung point cannot pass through a square between two frames
    {
        let tunnels = 0;
        for (let i = 0; i < 40; i++) {
            const s = K.create({seed: 9, W: 400, H: 640});
            s.due = {square: 1e9, circle: 1e9, triangle: 1e9, line: 1e9};
            s.ents.push({kind: 'square', size: 30, ang: i * 0.3, x: 200, y: 320, vx: 0, vy: 0, id: 1, born: -5, warn: 0, phase: 'live', edge: 0});
            s.px = 60; s.py = 320 + (i % 5) * 3; s.tx = s.px; s.ty = s.py;
            for (let f = 0; f < 12 && s.alive; f++) K.step(s, 1 / 30, 340, s.py);   // the far side, as fast as the point goes
            if (s.alive) tunnels++;
        }
        check(tunnels === 0, 'a point flung across a square in a single frame is caught by it', `${tunnels} of 40 slipped through`);
    }
    // grazes: once per shape, and only without contact
    {
        const s = K.create({seed: 9, W: 400, H: 640});
        s.due = {square: 1e9, circle: 1e9, triangle: 1e9, line: 1e9};
        s.ents.push({kind: 'circle', r: 20, x: 200, y: 320, vx: 0, vy: 0, id: 1, born: -5, warn: 0, phase: 'live', edge: 0, inside: true, bounces: 0});
        s.px = 200; s.py = 200; s.tx = s.px; s.ty = s.py;
        let gz = 0;
        const go = (x, y) => { for (let i = 0; i < 60; i++) K.step(s, 1 / 60, x, y).forEach(e => e.type === 'graze' && gz++); };
        go(200 + 20 + K.R_HIT + 6, 320); go(200, 200); go(200 + 20 + K.R_HIT + 6, 320);
        check(s.alive && gz === 1 && s.grazes === 1, 'passing close twice grazes a shape once, and does not hurt', `grazes ${gz}, alive ${s.alive}`);
        go(200 + 20 + K.R_HIT - 1, 320);
        check(!s.alive && s.death.kind === 'circle', 'touching it ends the run, and says what did it');
    }
}

// ------------------------------------------------------------------ bots
// a planner: every `react` seconds it tries 17 headings for `look` seconds on a copy of the run and keeps
// the one that lives longest, stays clearest and lines up with any line's gap. It moves at `speed`.
function planner({react, look, speed}) {
    let dir = [0, 0], next = 0;
    const heads = [[0, 0]]; for (let i = 0; i < 16; i++) heads.push([Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)]);
    return s => {
        if (s.t >= next) {
            let bs = -1e9;
            for (const [ox, oy] of heads) {
                const c = clone(s); let t = 0, ok = true, clear = 1e9; const dt = 1 / 20;
                while (t < look) {
                    K.step(c, dt, c.px + ox * speed * dt * 3, c.py + oy * speed * dt * 3); t += dt;
                    if (!c.alive) { ok = false; break; }
                    for (const e of c.ents) if (K.hazardous(e)) clear = Math.min(clear, K.dist(e, c.px, c.py, c));
                }
                let gp = 0;
                for (const e of c.ents) if (e.kind === 'line') {
                    const lat = e.horiz ? c.px : c.py, d = e.horiz ? Math.abs(e.y - c.py) : Math.abs(e.x - c.px);
                    if (d < 260) gp += Math.max(0, Math.abs(lat - e.gap) - e.gw * .3) * (260 - d) / 260 * .5;
                }
                const edge = Math.min(c.px, c.W - c.px, c.py, c.H - c.py);
                const sc = (ok ? 1000 : t * 100) + Math.min(clear, 60) + Math.min(edge, 40) * .3 - gp;
                if (sc > bs) { bs = sc; dir = [ox, oy]; }
            }
            next = s.t + react;
        }
        return [s.px + dir[0] * speed / 20, s.py + dir[1] * speed / 20];
    };
}
const median = a => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
function bots() {
    section('bots');
    const SEEDS = +(process.env.SEEDS || 3);
    for (const sheet of SHEETS) {
        const still = [], blind = [], hasty = [], careful = [];
        for (let i = 1; i <= SEEDS; i++) {
            const seed = i * 104729 + sheet.W;
            still.push(run(sheet, seed, null, 90).t);
            blind.push(run(sheet, seed, wanderer(i), 90).t);
            hasty.push(run(sheet, seed, planner({react: .3, look: .35, speed: 320}), 90).t);
            careful.push(run(sheet, seed, planner({react: .15, look: .6, speed: 420}), 90).t);
        }
        const [ms, mb, mh, mc] = [median(still), median(blind), median(hasty), median(careful)];
        console.log(`  ${sheet.name}: median seconds - still ${ms.toFixed(1)}, blind ${mb.toFixed(1)}, hasty ${mh.toFixed(1)}, careful ${mc.toFixed(1)}`);
        check(ms < 25 && mb < 25, `${sheet.name}: standing still, or moving without looking, loses within the first two stages`, `still ${ms.toFixed(1)}, blind ${mb.toFixed(1)}`);
        check(mh > Math.max(ms, mb) + 15 && mc > Math.max(ms, mb) + 15, `${sheet.name}: looking is what keeps a player alive - both planners far outlast both`);
        check(mh > K.STAGES[3].t, `${sheet.name}: even a hasty player who looks reaches the black lines`, `median ${mh.toFixed(1)}`);
        check(mc > K.STAGES[3].t, `${sheet.name}: a careful player reaches the black lines`, `median ${mc.toFixed(1)}`);
        check(careful.some(t => t < 90), `${sheet.name}: the careful player does not simply last forever`);
    }
}

const RUN = {geometry, fair, rules, bots};
for (const name of suites) { if (!RUN[name]) { console.log('no suite ' + name); process.exit(1); } RUN[name](); }
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
