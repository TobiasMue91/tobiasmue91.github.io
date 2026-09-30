#!/usr/bin/env node
// Test suite for games/breakout.html (Vigil).
//
// Runs the page's DOM-free <script id="core"> block in Node: the windows, the physics of the
// spark against glass, lead, stone and the gilded bar, the score and the candles. A window
// that cannot be finished, a spark that slips through a pane or rattles for ever behind lead,
// a save that does not come back - none of these shows on a first look at the page, and all of
// them can come from a change to one number in another corner. No browser, no server.
//
//   node test/breakout.mjs                  # everything
//   node test/breakout.mjs windows physics  # named suites only
//   node test/breakout.mjs --page=path.html # run against another copy of the page
//
// Suites:
//   windows  - twelve windows, every pane inside the arch, every breakable pane reachable
//              without passing through lead, lanterns holding a jewel
//   physics  - thousands of seeded sparks: never inside a pane, never through the arch or a
//              jamb, always at the speed the rules say, never flatter than the least climb
//   rules    - blows per pane, combo and its cap, the bar resetting it, jewels, candles, the
//              bonus and the extra candle for a window, the end of a game
//   save     - a snapshot taken mid-window comes back pane for pane; broken saves are refused
//   bots     - bots of three skills play the whole night: every window is cleared, no rally
//              goes long without touching glass, the steadiest bot never loses a candle

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'breakout.html');
const ALL = ['windows', 'physics', 'rules', 'save', 'bots'];
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
vm.runInContext(core[1] + '\nthis.V = VigilCore;', ctx);
const V = ctx.V;

const live = s => s.bricks.filter(b => b.hp > 0 && b.kind !== 'lead');
const step = (s, secs) => { const ev = []; for (let t = 0; t < secs; t += 1 / 60) ev.push(...V.step(s, 1 / 60)); return ev; };

// ------------------------------------------------------------------ windows
function windows() {
    section('windows');
    check(V.WINDOWS.length === 12, 'twelve windows', V.WINDOWS.length);
    check(new Set(V.WINDOWS.map(w => w.name)).size === 12, 'every window has its own name');
    V.WINDOWS.forEach((win, lv) => {
        const s = V.create({seed: 1, level: lv});
        const top = win.top || V.WALL_TOP;
        check(win.rows.every(r => r.length === V.COLS && /^[.#o*rgbvwaRGBVWA]+$/.test(r)), `${win.name}: rows are ${V.COLS} known cells`);
        const out = s.bricks.filter(b => [b.x, b.x + b.w].some(x => b.y < V.archY(x) + 2) || b.y + b.h > V.PADDLE_Y - 120);
        check(!out.length, `${win.name}: every pane sits inside the arch, well above the bar`, out.map(b => b.r + ',' + b.c).join(' '));
        // reachable: from the open air (outside the glass) through cells that are not lead
        const rows = win.rows.length, R0 = -8, R1 = rows + 4, seen = new Set(), q = [];
        const lead = (r, c) => r >= 0 && r < rows && win.rows[r][c] === '#';
        const inArch = (r, c) => top + r * V.CH + V.CH / 2 > V.archY(c * V.CW + V.CW / 2) + 6;
        for (let c = 0; c < V.COLS; c++) { q.push([R1 - 1, c]); seen.add((R1 - 1) + ',' + c); }
        while (q.length) {
            const [r, c] = q.pop();
            for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const rr = r + dr, cc = c + dc, k = rr + ',' + cc;
                if (rr < R0 || rr >= R1 || cc < 0 || cc >= V.COLS || seen.has(k) || lead(rr, cc)) continue;
                if (rr < 0 && !inArch(rr, cc)) continue;
                seen.add(k); q.push([rr, cc]);
            }
        }
        const stuck = live(s).filter(b => !seen.has(b.r + ',' + b.c));
        check(!stuck.length, `${win.name}: every breakable pane can be reached without passing lead`, stuck.map(b => b.r + ',' + b.c).join(' '));
        // a pane with lead both above and below can only be struck edge-on from the side
        const lidded = live(s).filter(b => (b.r === 0 ? false : lead(b.r - 1, b.c)) && lead(b.r + 1, b.c));
        check(!lidded.length, `${win.name}: no pane is lidded with lead above and below`, lidded.map(b => b.r + ',' + b.c).join(' '));
        const lanterns = s.bricks.filter(b => b.kind === 'lantern');
        check(lanterns.every(b => ['split', 'broad', 'hush'].includes(b.gem)), `${win.name}: every lantern holds a jewel it can show`);
        check(s.remaining === live(s).length && s.remaining > 20, `${win.name}: counts its panes`, s.remaining);
    });
}

// ------------------------------------------------------------------ physics
function physics() {
    section('physics');
    let steps = 0, inside = 0, arch = 0, jamb = 0, pace = 0, flat = 0, worst = '';
    const minRise = Math.sin(20 * Math.PI / 180) - 1e-6;
    for (let n = 0; n < 1500; n++) {
        const R = V.rng(9000 + n), lv = n % 12, s = V.create({seed: n, level: lv});
        // knock a random share of the glass out so sparks meet every shape of hole
        s.bricks.forEach(b => { if (b.kind !== 'lead' && R() < 0.35) { b.hp = 0; s.remaining--; } });
        V.launch(s);
        const b = s.balls[0], a = (R() - 0.5) * 2.6;
        b.x = 20 + R() * 360; b.y = 330 + R() * 220;
        const v = V.speed(s); b.vx = Math.sin(a) * v; b.vy = -Math.cos(a) * v;
        for (let t = 0; t < 900 && s.balls.length && s.mode === 'play'; t++) {
            V.setPaddle(s, s.balls[0].x + (R() - 0.5) * 30);
            V.step(s, 1 / 120);
            steps++;
            for (const k of s.balls) {
                for (const br of s.bricks) if (br.hp > 0 && k.x > br.x + 0.5 && k.x < br.x + br.w - 0.5 && k.y > br.y + 0.5 && k.y < br.y + br.h - 0.5) { inside++; worst = `window ${lv} spark in pane ${br.r},${br.c}`; }
                if (k.y < V.SPRING && k.y < V.archY(k.x) + V.BALL_R - 0.5) { arch++; worst = `window ${lv} spark through the arch at ${k.x.toFixed(1)},${k.y.toFixed(1)}`; }
                if (k.x < V.BALL_R - 0.01 || k.x > V.W - V.BALL_R + 0.01) jamb++;
                const sp = Math.hypot(k.vx, k.vy);
                if (Math.abs(sp - V.speed(s)) > 0.01 * V.speed(s)) pace++;
                if (Math.abs(k.vy) < sp * minRise) flat++;
            }
        }
    }
    check(!inside, 'a spark is never inside a standing pane', `${inside} times; ${worst}`);
    check(!arch, 'a spark never passes through the arch', `${arch} times; ${worst}`);
    check(!jamb, 'a spark never passes a jamb', jamb);
    check(!pace, 'every spark moves at the speed the rules say', pace);
    check(!flat, 'no spark ever flies flatter than the least climb', flat);
    console.log(`  ${steps} frames of play checked`);
}

// ------------------------------------------------------------------ rules
function rules() {
    section('rules');
    const s = V.create({seed: 3, level: 2});
    const kinds = {};
    s.bricks.forEach(b => { kinds[b.kind] = kinds[b.kind] || b; });
    check(kinds.glass.max === 1 && kinds.flashed.max === 2 && kinds.rondel.max === 3 && kinds.lantern.max === 1, 'glass takes one blow, flashed two, a rondel three, a lantern one');

    // the bar sends the spark by where it lands, and the aim sways within its bounds
    const t = V.create({seed: 5, level: 0});
    let lo = 1, hi = -1;
    for (let i = 0; i < 400; i++) { V.step(t, 1 / 60); const a = V.aimAngle(t); lo = Math.min(lo, a); hi = Math.max(hi, a); }
    check(lo < -0.55 && hi > 0.55 && lo >= -0.61 && hi <= 0.61, 'the aim sways across both sides and no further', `${lo.toFixed(2)}..${hi.toFixed(2)}`);
    check(!V.launch(V.create({seed: 1, level: 0})) === false, 'a spark can be cast from the bar');
    const u = V.create({seed: 7, level: 0}); V.launch(u);
    check(!V.launch(u), 'a spark in flight cannot be cast again');
    const angles = [];
    for (const off of [-30, -15, 0, 15, 30]) {
        const w = V.create({seed: 8, level: 0}); V.setPaddle(w, 200); V.launch(w);
        const b = w.balls[0]; b.x = 200 + off; b.y = V.PADDLE_Y - 20; b.vx = 0; b.vy = V.speed(w);
        let got = null;
        for (let i = 0; i < 60 && got === null; i++) for (const e of V.step(w, 1 / 120)) if (e.type === 'paddle') got = Math.atan2(w.balls[0].vx, -w.balls[0].vy);
        angles.push(got);
    }
    check(angles.every(a => a !== null) && angles.every((a, i) => !i || a > angles[i - 1]) && Math.abs(angles[2]) < 1e-6,
        'further right on the bar sends the spark further right; the middle sends it straight', angles.map(a => a && a.toFixed(2)).join(' '));

    // combo: counts panes between touches of the bar, multiplies the score, caps at twenty
    const c = V.create({seed: 11, level: 0}); V.launch(c);
    const glass = live(c).filter(b => b.kind === 'glass');
    let gained = [];
    c.balls[0].x = 200; c.balls[0].y = 500; c.balls[0].vx = 0; c.balls[0].vy = 1;
    for (let i = 0; i < 24 && i < glass.length; i++) {
        const before = c.score, b = glass[i];
        b.hp = 1; c.mode = 'play';
        const ball = c.balls[0]; ball.x = b.x + b.w / 2; ball.y = b.y + b.h + V.BALL_R + 1; ball.vx = 0; ball.vy = -V.speed(c);
        let broke = false;
        for (let k = 0; k < 30 && !broke; k++) for (const e of V.step(c, 1 / 240)) if (e.type === 'break') broke = e;
        if (broke) gained.push([broke.combo, c.score - before, broke.brick.r, broke.brick.kind]);
    }
    const BASE = {glass: 10, flashed: 25, rondel: 50, lantern: 30};
    const ok = gained.length >= 21 && gained.every(([combo, pts, r, kind], i) => combo === i + 1 && pts === (BASE[kind] + (12 - r) * 3) * Math.min(combo, 20));
    check(ok, 'each pane in a rally counts once more, up to twenty times its worth', gained.slice(0, 22).map(g => g[0] + ':' + g[1]).join(' '));
    // touching the bar ends the rally
    const d = V.create({seed: 12, level: 0}); V.launch(d); d.combo = 7;
    const db = d.balls[0]; db.x = d.paddle.x; db.y = V.PADDLE_Y - 30; db.vx = 0; db.vy = V.speed(d);
    step(d, 0.2);
    check(d.combo === 0, 'touching the bar ends the rally', d.combo);

    // lead never breaks
    const l = V.create({seed: 13, level: 3});
    const leadPane = l.bricks.find(b => b.kind === 'lead');
    V.launch(l); const lb = l.balls[0];
    let leadHits = 0;
    for (let i = 0; i < 40; i++) {
        lb.x = leadPane.x + leadPane.w / 2; lb.y = leadPane.y + leadPane.h + V.BALL_R + 0.5; lb.vx = 0; lb.vy = -V.speed(l);
        for (const e of V.step(l, 1 / 60)) if (e.type === 'lead') leadHits++;
    }
    check(leadHits > 20 && leadPane.hp > 0, 'lead and stone never break', `${leadHits} blows, hp ${leadPane.hp}`);

    // a lantern drops the jewel it shows, and each jewel does what it says
    const alive = (j, secs) => { for (let t = 0; t < secs; t += 1 / 60) { const lo = j.balls.filter(b => b.vy > 0).sort((a, b) => b.y - a.y)[0]; if (lo) V.setPaddle(j, lo.x); V.step(j, 1 / 60); } };
    for (const kind of ['split', 'broad', 'hush']) {
        const j = V.create({seed: 20, level: 0}); V.launch(j);
        const lan = j.bricks.find(b => b.kind === 'lantern'); lan.gem = kind;
        j.bricks.forEach(b => { if (b.hp > 0 && ((b.c === lan.c && b.r > lan.r) || (b.kind === 'lantern' && b !== lan))) { b.hp = 0; j.remaining--; } });
        const b = j.balls[0]; b.x = lan.x + lan.w / 2; b.y = lan.y + lan.h + V.BALL_R + 1; b.vx = 0; b.vy = -V.speed(j);
        let dropped = null;
        for (let i = 0; i < 20 && !dropped; i++) for (const e of V.step(j, 1 / 240)) if (e.type === 'jewel') dropped = e.kind;
        check(dropped === kind, `a lantern showing ${kind} drops ${kind}`, dropped);
        j.jewels.length = 0;
        const before = {balls: j.balls.length, w: j.paddle.w, v: V.speed(j)};
        V.grant(j, kind);
        alive(j, 1.5);
        if (kind === 'split') check(j.balls.length >= before.balls * 3 - 1, 'three sparks: each spark becomes three', `${before.balls} -> ${j.balls.length}`);
        if (kind === 'broad') { check(j.paddle.w > before.w * 1.4, 'a broader bar: the bar grows', `${before.w} -> ${j.paddle.w.toFixed(1)}`); alive(j, 15); check(Math.abs(j.paddle.w - before.w) < 1, 'and shrinks back when its time is up', j.paddle.w.toFixed(1)); }
        if (kind === 'hush') { check(V.speed(j) < before.v * 0.8, 'the night slows: the spark slows', `${before.v.toFixed(0)} -> ${V.speed(j).toFixed(0)}`); alive(j, 11); check(V.speed(j) > before.v * 0.97, 'and quickens again when its time is up', `${V.speed(j).toFixed(0)}`); }
    }
    // a broad bar that loses its spark is a plain bar again by the next cast
    const q = V.create({seed: 22, level: 0}); V.launch(q); V.grant(q, 'broad'); step(q, 0.5);
    q.balls[0].x = 10; q.balls[0].y = V.H - 2; q.balls[0].vy = 400; V.setPaddle(q, 380);
    step(q, 1);
    check(q.mode === 'serve' && Math.abs(q.paddle.w - V.PADDLE_W) < 1, 'a lost spark takes the broad bar with it', q.paddle.w.toFixed(1));
    const m = V.create({seed: 21, level: 0}); V.launch(m);
    for (let i = 0; i < 5; i++) V.grant(m, 'split');
    check(m.balls.length === 9, 'no more than nine sparks at once', m.balls.length);

    // candles: a lost spark costs one, the last one ends the game
    const k = V.create({seed: 30, level: 0, lives: 2}); V.launch(k);
    k.balls[0].x = 10; k.balls[0].y = V.H - 2; k.balls[0].vy = 400; k.paddle.x = 380;
    let ev = step(k, 0.3);
    check(k.lives === 1 && k.mode === 'serve' && ev.some(e => e.type === 'lost'), 'a spark lost past the bar costs a candle', `${k.lives} ${k.mode}`);
    V.setPaddle(k, 380); V.launch(k); k.balls[0].x = 10; k.balls[0].y = V.H - 2; k.balls[0].vy = 400;
    ev = step(k, 0.3);
    check(k.lives === 0 && k.mode === 'over' && ev.some(e => e.type === 'over'), 'the last candle ends the game', `${k.lives} ${k.mode}`);
    // one of several sparks lost costs nothing
    const n = V.create({seed: 31, level: 0}); V.launch(n); V.grant(n, 'split');
    n.balls[0].x = 10; n.balls[0].y = V.H - 2; n.balls[0].vy = 400; n.paddle.x = 380;
    step(n, 0.1);
    check(n.lives === 3 && n.mode === 'play', 'losing one of several sparks costs nothing', `${n.lives} ${n.mode}`);

    // a window: its last pane gives the bonus and a candle (never more than five)
    for (const lives of [3, 5]) {
        const w = V.create({seed: 40, level: 4, lives}); V.launch(w);
        const rest = live(w); rest.slice(1).forEach(b => { b.hp = 0; }); w.remaining = 1;
        const last = rest[0], b = w.balls[0];
        b.x = last.x + last.w / 2; b.y = last.y + last.h + V.BALL_R + 1; b.vx = 0; b.vy = -V.speed(w); last.hp = 1;
        const before = w.score;
        let clear = null;
        for (let i = 0; i < 20 && !clear; i++) for (const e of V.step(w, 1 / 240)) if (e.type === 'clear') clear = e;
        check(clear && clear.bonus === 5000 && w.score - before >= 5000 && w.lives === Math.min(5, lives + 1) && w.mode === 'cleared',
            `clearing window V gives 5,000 and a candle (from ${lives})`, clear && `${clear.bonus} lives ${w.lives}`);
        V.next(w);
        check(w.level === 5 && w.mode === 'serve' && w.remaining === live(w).length, 'and the next window is set, ready to cast');
    }
    // the second night is faster than the first
    check(V.speed(V.create({seed: 1, level: 12})) > V.speed(V.create({seed: 1, level: 0})) * 1.05, 'the second night runs faster');
}

// ------------------------------------------------------------------ save
function save() {
    section('save');
    const s = V.create({seed: 50, level: 6, lives: 4});
    V.launch(s);
    const R = V.rng(3);
    s.bricks.forEach(b => { if (b.kind !== 'lead' && R() < 0.4) b.hp = Math.floor(R() * b.max); });
    s.remaining = live(s).length; s.score = 23456;
    const snap = JSON.parse(JSON.stringify(V.snapshot(s)));
    const r = V.restore(snap, 99);
    check(r.level === 6 && r.lives === 4 && r.score === 23456, 'window, candles and score come back');
    check(r.bricks.every((b, i) => b.hp === s.bricks[i].hp || (b.kind === 'lead' && s.bricks[i].kind === 'lead')), 'every pane comes back with its blows');
    check(r.remaining === s.remaining && r.mode === 'serve', 'the restored window counts its panes and waits for a cast');
    check(V.restore(null) === null && V.restore('x') === null, 'no save, no run');
    const bad = V.restore({level: 2, score: -5, lives: 99, glass: 'nonsense'});
    check(bad.level === 2 && bad.score === 0 && bad.lives === 5 && bad.remaining === live(bad).length, 'a broken save gives a whole window, not a broken one');
    const empty = V.restore({level: 1, score: 10, lives: 3, glass: V.snapshot(V.create({level: 1})).glass.replace(/[0-9]/g, '0')});
    check(empty.remaining > 0, 'a save with no glass left starts that window afresh');
}

// ------------------------------------------------------------------ bots
function landing(b) {
    if (b.vy <= 0) return null;
    const t = (V.PADDLE_Y - V.BALL_R - b.y) / b.vy, L = V.BALL_R, span = V.W - 2 * L;
    let x = b.x + b.vx * t - L;
    x = ((x % (2 * span)) + 2 * span) % (2 * span);
    return (x > span ? 2 * span - x : x) + L;
}
function play(seed, maxSpeed, skill) {
    const s = V.create({seed, lives: 3}), r = V.rng(seed ^ 99);
    let t = 0, target = s.paddle.x, aim = 0, stall = 0, maxStall = 0, lt = 0, longest = 0;
    while (t < 5400 && s.mode !== 'over' && s.level < 12) {
        const dt = 1 / 60; t += dt; lt += dt;
        if (s.mode === 'serve' && s.serveT > 0.5 + r() * 1.5) V.launch(s);
        if (s.mode === 'cleared') { longest = Math.max(longest, lt); lt = 0; stall = 0; if (s.level === 11) { s.level = 12; break; } V.next(s); continue; }
        const falling = s.balls.filter(b => b.vy > 0).sort((a, b) => b.y - a.y)[0];
        if (falling) { const x = landing(falling); if (x != null) target = x - aim * s.paddle.w / 2 * 0.8; }
        const m = maxSpeed * dt;
        V.setPaddle(s, s.paddle.x + Math.max(-m, Math.min(m, target - s.paddle.x)));
        for (const e of V.step(s, dt)) { if (e.type === 'paddle') aim = (r() * 2 - 1) * skill; if (e.type === 'break') stall = 0; }
        if (s.mode === 'play') { stall += dt; maxStall = Math.max(maxStall, stall); }
    }
    return {cleared: s.level >= 12 ? 12 : s.level, lost: s.stats.lost, minutes: t / 60, maxStall, longest};
}
function bots() {
    section('bots');
    for (const [name, sp, sk, seeds] of [['steady', 5000, 0.9, [1, 2]], ['quick', 900, 0.8, [3]], ['casual', 450, 0.9, [4]]]) {
        for (const seed of seeds) {
            const p = play(seed, sp, sk);
            console.log(`  ${name} #${seed}: ${p.cleared} windows in ${p.minutes.toFixed(0)} min, ${p.lost} candles lost, longest window ${(p.longest / 60).toFixed(1)} min, longest dry rally ${p.maxStall.toFixed(0)} s`);
            check(p.cleared === 12, `${name} #${seed} keeps the whole vigil`, `${p.cleared} windows`);
            check(p.maxStall < 150, `${name} #${seed}: no rally goes two and a half minutes without glass`, p.maxStall.toFixed(0) + ' s');
            check(p.longest < 600, `${name} #${seed}: no window takes ten minutes`, (p.longest / 60).toFixed(1) + ' min');
            if (name === 'steady') check(p.lost === 0, `${name} #${seed}: a bar that is always there never loses a candle`, p.lost);
        }
    }
}

const RUN = {windows, physics, rules, save, bots};
for (const name of suites) {
    if (!RUN[name]) { console.log('unknown suite ' + name); process.exit(1); }
    RUN[name]();
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
