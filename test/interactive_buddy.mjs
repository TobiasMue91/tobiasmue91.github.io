#!/usr/bin/env node
// Test suite for games/interactive_buddy.html (Interactive Buddy).
//
// Runs the page's DOM-free <script id="core"> block in Node: a ragdoll of thirteen particles, ten tools that act on it and
// the money they pay. A toy has no win state, so what is worth testing is what a player cannot see from the page: a buddy
// that always holds together and comes to rest, tools that do what their pictures promise (a bomb pushes away from itself
// and not beyond its reach, a rocket burns out, an anvil only hurts what it lands on), a record that is the true peak,
// and an economy in which variety pays, spamming does not, and nothing pays while the player does nothing.
// No browser, no server.
//
//   node test/interactive_buddy.mjs                # everything
//   node test/interactive_buddy.mjs body tools     # named suites only
//   node test/interactive_buddy.mjs --page=path.html
//
// Suites:
//   body    - the stick lengths and joint stops hold under abuse, he comes to rest and stays there, a slide stops,
//             the same room plays out the same at 30 and 144 fps
//   hand    - grabbing, dragging and the throw a release gives
//   tools   - every tool against what its picture promises
//   money   - pay follows the hit, variety beats repetition, nothing pays for nothing, buying is exact
//   flight  - the best height is the true peak, a dropped-in buddy and a lifted-and-dropped one pay no height
//   saves   - a save is trusted for nothing
//   bots    - people-paced bots play whole sittings: the first toy comes quickly, every toy within a sitting,
//             spamming one tool falls behind, doing nothing earns nothing
//   page    - the real page in Chromium (desktop and phone; skipped without Playwright): no console errors through a
//             tap, a pull-and-throw, a purchase and a skin; a reload keeps everything; the old page's progress migrates;
//             a lying save is clamped; reduced motion runs

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join, resolve} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'interactive_buddy.html');
const ALL = ['body', 'hand', 'tools', 'money', 'flight', 'saves', 'bots', 'page'];
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
vm.runInContext(core[1] + '\nthis.C = BuddyCore;', ctx);
const C = ctx.C;
const DT = C.DT;

const f2 = v => v.toFixed(2);
const run = (w, secs) => { const ev = []; for (let t = 0; t < secs - 1e-9; t += DT) { C.tick(w); ev.push(...w.events); w.events.length = 0; } return ev; };
const types = ev => ev.map(e => e.type);
const count = (ev, t) => ev.filter(e => e.type === t).length;
// a settled buddy in a room 3.5 m wide (or as asked), everything unlocked, nothing queued
function fresh(opt = {}) {
    const w = C.create({width: 3.5, seed: 11, ...opt});
    for (const t of C.TOOLS) w.tools[t.id] = 1;
    run(w, 1.5); w.events.length = 0; w.cash = 0; w.chain = 0; w.chainT = 0; w.fatigue = {}; w.best = 0;
    return w;
}
const comOf = w => C.com(w);
const hi = w => Math.max(...w.P.map(p => p.y));
function stickError(w) { let m = 0; for (const s of C.STICKS) m = Math.max(m, Math.abs(Math.hypot(w.P[s.a].x - w.P[s.b].x, w.P[s.a].y - w.P[s.b].y) - s.len) / s.len); return m; }
function sane(w) { return w.P.every(p => isFinite(p.x) && isFinite(p.y) && p.x >= p.r - 1e-6 && p.x <= w.w - p.r + 1e-6 && p.y >= p.r - 1e-6); }
function bend(w, a, b, c) { const A = w.P[a], B = w.P[b], Cc = w.P[c]; const ux = B.x - A.x, uy = B.y - A.y, vx = Cc.x - B.x, vy = Cc.y - B.y; return Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)); }
const N = C.IDX;

// ------------------------------------------------------------------ body
function body() {
    section('body');
    let w = fresh();
    check(sane(w) && stickError(w) < .02, 'a settled buddy is whole and inside the room', 'err ' + stickError(w));
    check(C.speedMax(w) < .12, 'the opening heap is at rest', 'speed ' + f2(C.speedMax(w)));
    check(w.P[N.head].y > 1.5 && w.asleep, 'he starts standing at attention, and stays standing until something touches him');
    run(w, 8); check(w.P[N.head].y > 1.5, 'left alone he is still standing eight seconds later');

    // abuse: random kicks of every size, for a minute of play; every 100 ticks look at the body
    let worst = 0, ok = true, bad = '';
    for (const seed of [1, 2, 3]) {
        w = C.create({width: 3.5, seed}); let s = seed * 977;
        const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
        for (let i = 0; i < 6000; i++) {
            if (i % 90 === 0) { const p = w.P[(r() * 13) | 0], v = r() * 30; p.px -= (r() - .5) * v * DT; p.py -= (r() - .3) * v * DT; }
            C.tick(w); w.events.length = 0;
            if (i % 100 === 0) { worst = Math.max(worst, stickError(w)); if (!sane(w)) { ok = false; bad = `seed ${seed} tick ${i}`; break; } }
        }
    }
    check(ok, 'a minute of random abuse never leaves the room or makes a NaN', bad);
    check(worst < .06, 'no stick ever stretches more than 6 % under abuse', 'worst ' + (worst * 100).toFixed(1) + ' %');

    // joint stops hold once things calm down: no knee or elbow folded past its stop
    w = C.create({width: 3.5, seed: 9}); C.reset(w); run(w, 6);
    const stops = [[N.shL, N.elL, N.haL, 2.55], [N.shR, N.elR, N.haR, 2.55], [N.hpL, N.knL, N.ftL, 2.3], [N.hpR, N.knR, N.ftR, 2.3]];
    check(stops.every(([a, b, c, m]) => bend(w, a, b, c) <= m + .15), 'knees and elbows rest inside their stops after a fall', stops.map(s => f2(bend(w, s[0], s[1], s[2]))).join(' '));

    // dropped from three metres: comes to rest and stays there
    w = C.create({width: 3.5, seed: 4}); for (const p of w.P) { p.y += 2.2; p.py += 2.2; }
    run(w, 6); const rested = C.speedMax(w); const before = w.P.map(p => [p.x, p.y]); run(w, 3);
    const moved = Math.max(...w.P.map((p, i) => Math.hypot(p.x - before[i][0], p.y - before[i][1])));
    check(rested < .12 && moved < .01, 'dropped from three metres he is at rest within six seconds and stays put', `speed ${f2(rested)}, moved ${moved.toFixed(4)}`);

    // a round thing that never stops: shove everything along the floor
    w = fresh(); C.wake(w); for (const p of w.P) p.px -= 6 * DT; run(w, 5);
    check(C.speedMax(w) < .12, 'a slide along the floor comes to a stop (rolling and sliding both resist)', 'speed ' + f2(C.speedMax(w)));
    w = fresh(); C.wake(w); w.P[N.head].px -= 8 * DT; run(w, 5);
    check(C.speedMax(w) < .12, 'a head shoved along the floor stops too');

    // frame rate: the same two seconds of falling, sliced three ways
    const outs = [];
    for (const fps of [30, 60, 144]) { const w2 = C.create({width: 3.5, seed: 21}); C.reset(w2); for (let i = 0; i < 4 * fps; i++) C.advance(w2, 1 / fps); outs.push(comOf(w2)); }
    check(outs.every(o => Math.hypot(o[0] - outs[0][0], o[1] - outs[0][1]) < .08), 'the same room plays out the same at 30, 60 and 144 fps', outs.map(o => o.map(f2).join(',')).join(' | '));

    // the room can be resized under him
    w = fresh(); const x0 = w.P[0].x; C.setWidth(w, 2.2); const inside = w.P.every(p => p.x <= 2.2 - p.r + 1e-9); C.setWidth(w, 5);
    check(inside && w.w === 5, 'narrowing the room pushes him inside it; widening leaves him be', 'x ' + f2(x0));
}

// ------------------------------------------------------------------ hand
function hand() {
    section('hand');
    let w = fresh(); const h = w.P[N.head];
    check(C.grab(w, h.x + .1, h.y + .05) && w.grab.i === N.head, 'a finger on the head grabs the head');
    C.release(w); run(w, 1);
    w = fresh(); check(C.grab(w, 3, 3) === false, 'a finger in empty air grabs nothing');
    w = fresh(); const p = w.P[N.haL];
    C.grab(w, p.x, p.y); for (let i = 0; i < 90; i++) { C.drag(w, 1.2, 2.5); C.tick(w); }
    check(Math.hypot(w.P[N.haL].x - 1.2, w.P[N.haL].y - 2.5) < .08, 'a held hand follows the finger to where it is', 'at ' + f2(w.P[N.haL].x) + ',' + f2(w.P[N.haL].y));
    check(stickError(w) < .05, 'and he hangs from it with his lengths intact', 'err ' + f2(stickError(w)));
    // a throw: drag fast, let go; the body leaves with the finger's speed, capped
    w = fresh(); const q = w.P[N.shL]; C.grab(w, q.x, q.y);
    for (let i = 0; i < 12; i++) { C.drag(w, q.x + .07 * i, q.y + .15 * i); C.tick(w); }
    C.release(w); w.events.length = 0; const vy = (w.P[N.shL].y - w.P[N.shL].py) / DT;
    check(vy > 8 && vy <= 20.01, 'a quick flick up leaves at a speed that fits the flick and never above 20 m/s', 'vy ' + f2(vy));
    run(w, 1.5); check(comOf(w)[1] > .9 || hi(w) > 1.5, 'and it carries him up');
    // a hostile finger
    w = fresh(); C.grab(w, w.P[0].x, w.P[0].y); C.drag(w, 1e9, -1e9); run(w, 1);
    check(sane(w), 'a finger thrown a million metres away does not throw him out of the world');
}

// ------------------------------------------------------------------ tools
function tools() {
    section('tools');
    let w = fresh(), ev;
    // glove: pushes away from the side you tapped on, and only when it is close
    for (const side of [-1, 1]) {
        w = fresh({width: 9}); const c = comOf(w), x0 = c[0]; C.useTool(w, 'glove', c[0] + side * .3, c[1]); ev = run(w, .5);
        const dx = comOf(w)[0] - x0;
        check(count(ev, 'hit') === 1 && dx * side < -.01, `a tap on the ${side < 0 ? 'left' : 'right'} sends him the other way`, 'dx ' + f2(dx));
    }
    w = fresh(); ev = []; C.useTool(w, 'glove', 3.4, 3); ev = run(w, .6);
    check(count(ev, 'whiff') === 1 && count(ev, 'hit') === 0 && w.cash === 0, 'a punch at nothing whiffs and pays nothing');
    const e = [];
    for (const d of [.05, .15, .3]) { w = fresh(); const p = w.P[N.shL]; C.useTool(w, 'glove', p.x - d - .1, p.y); ev = run(w, .3); const h = ev.find(x => x.type === 'hit'); e.push(h ? h.energy : 0); }
    check(e.every(v => v > 0), 'a glove lands from touching distance out to a finger\'s reach', e.map(Math.round).join(' '));
    w = fresh(); { const p = w.P[N.shL]; C.useTool(w, 'glove', p.x - 1.2, p.y + .8); ev = run(w, .3); }
    check(count(ev, 'whiff') === 1 && count(ev, 'hit') === 0, 'and whiffs from a metre away');
    w = fresh(); C.useTool(w, 'glove', comOf(w)[0] - .3, comOf(w)[1]); ev = run(w, .3); const hit = ev.find(x => x.type === 'hit');
    check(hit && Math.abs(Math.hypot(hit.dx, hit.dy) - 1) < 1e-6 && hit.cash > 0 && hit.kn > 0, 'every hit event names a unit direction, a strength and a payout');

    // mallet: pays once, at the rebound
    w = fresh(); const c = comOf(w); C.useTool(w, 'mallet', c[0], c[1]); ev = run(w, 1);
    check(count(ev, 'squash') === 1 && count(ev, 'hit') === 1 && ev.find(x => x.type === 'hit').rebound, 'a mallet flattens once and pays once, when he springs back');

    // crackers: exactly twelve pops, none before the fuse, then it is over
    w = fresh(); C.useTool(w, 'crackers', comOf(w)[0], comOf(w)[1]); ev = run(w, 3);
    check(count(ev, 'pop') === 12, 'a bundle of crackers pops exactly twelve times', 'pops ' + count(ev, 'pop'));
    check(w.objs.length === 0, 'and then there is nothing left in the room');
    w = fresh(); C.useTool(w, 'crackers', comOf(w)[0], comOf(w)[1]); ev = run(w, .1); check(count(ev, 'pop') === 0, 'no pop before the first fuse has burned');

    // bomb: a blast pushes away from itself, reaches no further than it says, and waits for its fuse
    w = fresh({width: 14}); { const p = w.P[N.hpL]; for (const q of w.P) { q.x += 0; } }
    C.useTool(w, 'bomb', 1, .3); ev = run(w, 1.2);
    check(count(ev, 'boom') === 0, 'a bomb does not go off before its fuse is out', 'fuse');
    ev = run(w, .8); const boom = ev.find(x => x.type === 'boom');
    check(boom && boom.R > 2, 'it goes off once the fuse is out');
    const far = Math.min(...w.P.map(p => Math.hypot(p.x - 1, p.y - .3)));
    check(far > boom.R, 'the test buddy was out of reach of that blast', f2(far));
    check(C.speedMax(w) < .3 && w.P[N.head].y > 1.5, 'and a blast out of reach does not touch him');
    w = fresh({width: 14}); { const c = comOf(w); C.useTool(w, 'bomb', c[0] - 1.2, .4); } const x0 = comOf(w)[0]; ev = run(w, 3);
    check(comOf(w)[0] > x0 + .3 || w.best > 0, 'a bomb on his left sends him to the right', 'dx ' + f2(comOf(w)[0] - x0));
    check(w.cash > 0 && ev.some(x => x.type === 'hit' && x.boom), 'and it pays');
    w = fresh(); { const i = N.shL; C.useTool(w, 'bomb', w.P[i].x, w.P[i].y); } ev = run(w, 2.2);
    check(w.soot.some(s => s > .1) && w.fire.some((f, i) => f > 0 || w.soot[i] > 0), 'a bomb that goes off on him scorches him');

    // torch: sets him alight where it touches, burns out, never lights what it does not touch
    w = fresh({width: 14}); C.useTool(w, 'torch', 1, 1); ev = run(w, 1);
    check(count(ev, 'ignite') === 0 && w.fire.every(f => f === 0), 'a torch held out in the air lights nothing');
    w = fresh(); C.useTool(w, 'torch', comOf(w)[0], comOf(w)[1]); ev = run(w, .5);
    check(w.fire.some(f => f > 0) && count(ev, 'ignite') > 0, 'a torch on him lights him');
    ev = run(w, 15); check(w.fire.every(f => f <= 0), 'and the fire is out inside fifteen seconds', w.fire.map(f2).join(' '));
    const paid = w.cash; check(paid > 0 && paid < 400, 'burning pays a little, by the second, not a fortune', '$' + paid);
    run(w, 5); check(w.cash === paid, 'and nothing at all once it is out');
    w = fresh(); C.useTool(w, 'torch', comOf(w)[0], comOf(w)[1]); run(w, 1); const a = w.cash; C.useTool(w, 'torch', comOf(w)[0], comOf(w)[1]); ev = run(w, .3);
    check(count(ev, 'whiff') === 1, 'a second torch on a buddy already burning is a whiff, not a second payday');

    // anvil: lands where tapped, and only hurts what is underneath
    w = fresh({width: 14}); C.useTool(w, 'anvil', 2, 1); ev = run(w, 2.5);
    check(count(ev, 'thump') === 1 && count(ev, 'hit') === 0, 'an anvil dropped on empty floor makes a thump and no money');
    w = fresh(); { const c = comOf(w); C.useTool(w, 'anvil', c[0], c[1]); } ev = run(w, 2.5);
    check(count(ev, 'squash') === 1 && count(ev, 'hit') === 1 && w.cash > 0, 'an anvil on him squashes him once and pays once');

    // rocket: strapped on, burns for a while, burns out, takes him up
    w = fresh(); C.useTool(w, 'rocket', 0, 0); ev = run(w, .3); check(count(ev, 'launch') === 0, 'the rocket waits for its fuse');
    ev = run(w, 5); const peak = Math.max(...[0].map(() => 0));
    check(count(ev, 'launch') === 1 && count(ev, 'burnout') === 1, 'it lights once and burns out once');
    w = fresh(); C.useTool(w, 'rocket', 0, 0); let top = 0; for (let t = 0; t < 7; t += DT) { C.tick(w); top = Math.max(top, comOf(w)[1]); w.events.length = 0; }
    check(top > 5 && top < 60, 'a rocket takes him up between five and sixty metres', 'top ' + f2(top));
    w = fresh(); C.useTool(w, 'rocket', 0, 0); run(w, .2); C.useTool(w, 'rocket', 0, 0); ev = run(w, .2);
    check(count(ev, 'whiff') === 1, 'a second rocket while one is strapped on is refused');

    // pad: launches only what comes down on it
    w = fresh(); C.wake(w); C.useTool(w, 'pad', comOf(w)[0], 0); for (const p of w.P) { p.y += 3; p.py += 3; } C.useTool(w, 'pad', comOf(w)[0], 0); ev = run(w, 2.5);
    check(count(ev, 'boing') === 1, 'a pad under him boings him once');
    w = fresh({width: 9}); C.wake(w); C.useTool(w, 'pad', comOf(w)[0] + 3, 0); for (const p of w.P) { p.y += 3; p.py += 3; } ev = run(w, 2.5);
    check(count(ev, 'boing') === 0, 'a pad he does not land on does nothing');

    // tesla: a spasm of under a second, never a launch
    w = fresh(); C.useTool(w, 'tesla', 0, 0); let vmax = 0; for (let t = 0; t < 2; t += DT) { C.tick(w); vmax = Math.max(vmax, C.speedMax(w)); w.events.length = 0; }
    check(vmax > 2 && vmax < 30, 'the Tesla shakes him hard but never fires him off', 'peak speed ' + f2(vmax));
    check(w.zap <= 0, 'and it stops within a second');

    // big red button: whole room, one launch, never past the roof
    w = fresh(); C.useTool(w, 'button', 1, 0); ev = run(w, 0.3); check(count(ev, 'quake') === 0, 'the button takes half a second to land');
    let topB = 0; ev = []; for (let t = 0; t < 9; t += DT) { C.tick(w); topB = Math.max(topB, hi(w)); ev.push(...w.events); w.events.length = 0; }
    check(count(ev, 'quake') === 1 && topB > 20 && topB < C.CEIL, 'it quakes once and sends him between 20 m and the roof', 'top ' + f2(topB));
    // a tool you do not own does nothing
    w = C.create({width: 3.5, seed: 2}); check(C.useTool(w, 'bomb', 1, 1) === false && w.objs.length === 0, 'a tool you have not bought cannot be used');
}

// ------------------------------------------------------------------ money
function money() {
    section('money');
    let w = fresh(); run(w, 30); check(w.cash === 0, 'sitting still for half a minute pays nothing');
    // pay follows the hit: stronger punches pay more, never less than nothing
    const pays = [];
    for (const d of [.0, .2, .4]) { w = fresh(); const p = w.P[N.hpL]; C.useTool(w, 'glove', p.x - .05 - d * 0, p.y); const ev = run(w, .3); pays.push(ev.find(x => x.type === 'hit') ? ev.find(x => x.type === 'hit').cash : 0); }
    check(pays.every(v => v >= 1), 'every landed hit pays at least a dollar', pays.join(' '));
    // the chain: a second hit inside the window earns a multiplier; the cap is x3
    w = fresh(); const c = comOf(w); C.useTool(w, 'glove', c[0] - .3, c[1]); run(w, .3); const m1 = w.chain;
    C.useTool(w, 'crackers', w.P[N.shL].x, w.P[N.shL].y); run(w, .8);
    check(m1 === 1 && w.chain >= 3, 'a different tool inside the window counts double towards the chain', `chain ${m1} -> ${w.chain}`);
    check(C.multOf(0) === 1 && C.multOf(1) === 1 && C.multOf(C.CHAIN_MAX) <= 3 + 1e-9 && C.multOf(99) <= 3 + 1e-9, 'the multiplier starts at x1 and never goes above x3');
    run(w, 5); check(w.chain === 0, 'and the chain is gone after the window');
    // variety beats repetition
    const total = (seq) => { const w2 = fresh({seed: 5}); let t = 0; for (const id of seq) { const cc = comOf(w2); C.useTool(w2, id, cc[0] - .2, cc[1]); run(w2, .9); } return w2.cash; };
    const same = total(['glove', 'glove', 'glove', 'glove', 'glove', 'glove']);
    const mixed = total(['glove', 'mallet', 'glove', 'mallet', 'glove', 'mallet']);
    check(mixed > same * 1.05, 'six hits with two tools pay more than six with one', `${mixed} vs ${same}`);
    // fatigue: the same tool again and again pays less each time
    w = fresh(); const pp = []; for (let i = 0; i < 5; i++) { const cc = comOf(w); C.useTool(w, 'glove', cc[0] - .3, cc[1]); const ev = run(w, 2.6); const h = ev.find(x => x.type === 'hit'); pp.push(h ? h.cash / h.mult : 0); }
    check(pp[4] < pp[0] * 1.02 || pp.slice(1).every(v => v <= pp[0] * 1.6), 'hammering one tool does not pay more and more', pp.map(v => v.toFixed(1)).join(' '));
    // buying is exact
    w = fresh(); w.cash = 149; check(C.buy(w, 'mallet').ok === false && w.cash === 149 && !(w.tools.mallet && false), 'a toy one dollar short is refused and costs nothing');
    w = C.create({width: 3.5, seed: 1}); w.cash = 1000; const r = C.buy(w, 'mallet');
    check(r.ok && w.cash === 850 && w.tools.mallet === 1, 'buying costs exactly the price');
    check(C.buy(w, 'mallet').ok === false && w.cash === 850, 'a toy cannot be bought twice');
    check(C.buy(w, 'nonsense').ok === false, 'a toy that does not exist cannot be bought');
    w.cash = 100000; for (const t of C.TOOLS) C.buy(w, t.id); check(C.TOOLS.every(t => w.tools[t.id]) && C.nextTool(w) === null, 'with money enough everything can be bought and there is no next');
    w = C.create({width: 3.5, seed: 1}); w.cash = 950; check(C.affordable(w) === 'mallet' && C.nextTool(w) === 'mallet', 'the page is told which toy to point at: the next one in the row');
    // skins
    w = C.create({width: 3.5, seed: 1}); w.cash = 5000; const s1 = C.buySkin(w, 'sack'); check(s1.ok && w.skin === 'sack' && w.cash === 4100, 'a skin is bought and worn');
    check(C.buySkin(w, 'dummy').worn && w.skin === 'dummy' && w.cash === 4100, 'wearing one you own is free');
    check(C.buySkin(w, 'night').ok === false && w.cash === 4100, 'a skin you cannot afford is refused');
}

// ------------------------------------------------------------------ flight
function flight() {
    section('flight');
    // the best height is the real peak of the centre of mass, minus where it rests
    let w = fresh(); C.useTool(w, 'rocket', 0, 0); let top = 0, ev = [];
    for (let t = 0; t < 8; t += DT) { C.tick(w); top = Math.max(top, comOf(w)[1]); ev.push(...w.events); w.events.length = 0; }
    const land = ev.find(e => e.type === 'land');
    check(land && Math.abs(land.height - (top - .62)) < .15, 'the height on the wall is the true peak', land ? `${land.height} vs ${f2(top - .62)}` : 'no landing');
    check(land && land.record && w.best === land.height, 'the first big flight is a new best and is kept');
    const best = w.best; w.cash = 0; C.reset(w); run(w, 4);
    check(count(w.events, 'land') === 0 && w.cash === 0, 'a buddy dropped in through the hatch pays nothing for the fall', '$' + w.cash);
    // lifted and dropped is not a throw
    w = fresh(); w.best = 0; const p = w.P[N.head]; C.grab(w, p.x, p.y); for (let i = 0; i < 180; i++) { C.drag(w, 1.75, 6); C.tick(w); w.events.length = 0; }
    C.release(w); w.events.length = 0; ev = run(w, 4);
    check(w.best === 0 && !ev.some(e => e.type === 'land' && e.counts), 'lifting him to six metres and letting go is not a record');
    // thrown, it is
    w = fresh(); w.best = 0; C.grab(w, w.P[N.shL].x, w.P[N.shL].y);
    for (let i = 0; i < 16; i++) { C.drag(w, 1.75, .5 + i * .35); C.tick(w); w.events.length = 0; }
    C.release(w); ev = run(w, 9);
    check(w.best > 3 && w.best < 25 && ev.some(e => e.type === 'land' && e.counts && e.cash > 0), 'a real throw is a flight, pays, and sets the record (and a hand cannot throw him past 25 m)', 'best ' + w.best);
    // landing never pays a second time for the same flight
    check(count(ev, 'land') === 1, 'one flight, one landing');
    // the record is never lowered by a smaller flight
    w = fresh(); w.best = 12; C.useTool(w, 'glove', comOf(w)[0] - .3, comOf(w)[1]); run(w, 4); check(w.best === 12, 'a smaller flight does not lower the best');
    // the roof
    w = fresh(); for (const q of w.P) { q.py = q.y - 60 * DT; } ev = run(w, 3); check(hi(w) <= C.CEIL, 'nothing goes through the roof');
}

// ------------------------------------------------------------------ saves
function saves() {
    section('saves');
    let s = C.sanitize({cash: 'a lot', tools: {bomb: 1, nonsense: 1, mallet: 2}, skins: {sack: 1, chrome: true}, skin: 'chrome', best: -5, seen: {tap: 'yes'}, tool: 'mallet', stats: {hits: 1e99}});
    check(s.cash === 0 && s.tools.bomb === 1 && !s.tools.nonsense && !s.tools.mallet, 'junk values are dropped, owned tools kept only when exactly 1', JSON.stringify(s.tools));
    check(s.skin === 'dummy' && s.best === 0 && s.tool === 'glove', 'a worn skin or selected tool you do not own falls back; a negative best is zero', `${s.skin} ${s.best} ${s.tool}`);
    check(s.stats.hits <= 1e12 && s.seen.tap === 1, 'huge numbers are clamped and truthy flags become flags');
    s = C.sanitize({cash: 1e30, best: 1e9}); check(s.cash === 1e9 && s.best === C.CEIL, 'cash and best are clamped to what could be earned');
    check(JSON.stringify(C.sanitize(null)) === JSON.stringify(C.newSave()) && JSON.stringify(C.sanitize('x')) === JSON.stringify(C.newSave()), 'no save, or a string, is a fresh save');
    check(C.sanitize({tools: {}}).tools.glove === 1 && C.sanitize({skins: {}}).skins.dummy === 1, 'the glove and the test dummy are always yours');
    const w = C.create({width: 3.5, seed: 1, save: {cash: 321, tools: {mallet: 1}, skin: 'dummy', best: 7.5}});
    const back = C.sanitize(JSON.parse(JSON.stringify(C.exportSave(w))));
    check(back.cash === 321 && back.tools.mallet === 1 && back.best === 7.5, 'a save written and read back is the same save');
    const w2 = C.create({width: 3.5, seed: 1}); w2.cash = 123.9; check(C.exportSave(w2).cash === 123, 'cash is whole dollars in the file');
}

// ------------------------------------------------------------------ bots
function sitting({seed = 1, minutes = 20, pace = .9, style = 'variety'}) {
    const w = C.create({width: 3.5, seed});
    let s = seed * 7919; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const lastAt = {}, bought = []; let t = 0, nextAct = 1, at10 = 0;
    const owned = () => C.TOOLS.filter(x => w.tools[x.id]);
    while (t < minutes * 60) {
        if (style !== 'idle' && t >= nextAct) {
            const nx = C.nextTool(w); if (nx && C.canBuy(w, nx)) { C.buy(w, nx); bought.push([nx, Math.round(t)]); }
            const pick = style === 'spam' ? owned()[0] : owned().sort((a, b) => (lastAt[a.id] || -99) - (lastAt[b.id] || -99))[0];
            lastAt[pick.id] = t; const c = C.com(w), id = pick.id;
            let x = c[0] + (r() - .5) * .5, y = c[1] + (r() - .5) * .4;
            if (id === 'pad') { x = w.w * (.3 + .4 * r()); y = 0; } else if (id === 'rocket' || id === 'tesla' || id === 'button') { x = c[0]; y = c[1]; }
            if (!(id === 'rocket' && w.objs.some(o => o.kind === 'rocket'))) C.useTool(w, id, x, y);
            nextAct = t + pace * (.7 + r() * .6);
        }
        C.tick(w); t += DT; w.events.length = 0;
        if (!at10 && t >= 600) at10 = w.stats.earned;
    }
    return {w, bought, earned: w.stats.earned, at10};
}
function bots() {
    section('bots');
    const idle = sitting({style: 'idle', minutes: 10}); check(idle.w.cash === 0 && idle.earned === 0, 'a player who does nothing for ten minutes earns nothing');
    const v = sitting({minutes: 19});
    const first = v.bought[0] ? v.bought[0][1] : 1e9;
    check(first >= 8 && first <= 90, 'the first toy is bought inside the first minute and a half, and not in the first few seconds', 'first at ' + first + ' s');
    const allAt = v.bought.length === C.TOOLS.length - 1 ? v.bought[v.bought.length - 1][1] : 1e9;
    check(allAt >= 480 && allAt <= 1130, 'a player who mixes tools has every toy within eight to twenty minutes', 'last at ' + allAt + ' s; ' + v.bought.map(b => b[0] + '@' + b[1]).join(' '));
    check(v.bought.every((b, i) => i === 0 || b[1] >= v.bought[i - 1][1]), 'toys open in the order of the row');
    const gaps = v.bought.map((b, i) => b[1] - (i ? v.bought[i - 1][1] : 0));
    check(Math.max(...gaps) < 330, 'no wait between two toys is longer than five and a half minutes', 'longest ' + Math.max(...gaps) + ' s');
    const sp = sitting({style: 'spam', minutes: 10});
    check(sp.earned < v.at10 * .35, 'ten minutes of tapping one tool earns under a third of ten minutes of variety', `${sp.earned} vs ${v.at10}`);
    check(sp.bought.length < C.TOOLS.length - 1, 'and does not buy everything');
    check(v.w.best > 20 && v.w.best <= C.CEIL, 'the variety player\'s best height is a real, reachable number', String(v.w.best));
}

// ------------------------------------------------------------------ page
async function page() {
    section('page');
    let chromium;
    try { ({chromium} = await import('playwright')); } catch (e) { try { ({chromium} = await import('/opt/node-tools/node_modules/playwright/index.mjs')); } catch (e2) { try { ({chromium} = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch (e3) { console.log('  skipped: playwright is not installed'); return; } } }
    const url = 'file://' + resolve(PAGE), KEY = 'gptgames.interactive_buddy.v2';
    let browser; try { browser = await chromium.launch(); } catch (e) { console.log('  skipped: no Chromium to launch (' + String(e.message).split('\n')[0] + ')'); return; }
    const open = async (opt, init) => {
        const ctx = await browser.newContext({deviceScaleFactor: 1, ...opt}); const p = await ctx.newPage(); const errs = [];
        p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
        if (init) await p.addInitScript(init);
        await p.goto(url); await p.waitForTimeout(700);
        return {ctx, p, errs};
    };
    const state = p => p.evaluate(() => { const B = window.__buddy; return {cash: B.world.cash, tools: Object.keys(B.world.tools), skins: Object.keys(B.world.skins), skin: B.world.skin, best: B.world.best, tool: B.tool, seen: B.world.seen, w: B.world.w}; });
    const where = (p, i = -1) => p.evaluate(i => { const B = window.__buddy, V = B.V; const q = i < 0 ? (c => ({x: c[0], y: c[1]}))(B.C.com(B.world)) : B.world.P[i]; return {x: V.X0 + q.x * V.S, y: V.floorY - (q.y - V.cam) * V.S}; }, i);
    for (const [name, opt] of [['phone', {viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true}], ['desktop', {viewport: {width: 1280, height: 720}}]]) {
        // a first visit: a tap with the glove pays, a throw is a throw, nothing logs an error
        let {ctx, p, errs} = await open(opt);
        let s = await state(p); check(s.cash === 0 && s.tools.join() === 'glove' && s.w > 2.9, `${name}: a first visit starts with the glove and no money`, JSON.stringify(s));
        const c = await where(p); await p.mouse.click(c.x - 25, c.y); await p.waitForTimeout(1400);
        s = await state(p); check(s.cash > 0 && s.seen.tap === 1, `${name}: a tap with the glove pays and counts as seen`, 'cash ' + s.cash);
        await p.waitForTimeout(2200);
        const h = await where(p, 0); await p.mouse.move(h.x, h.y); await p.mouse.down();
        for (let i = 1; i <= 8; i++) { await p.mouse.move(h.x + i * 4, h.y - i * 22); await p.waitForTimeout(16); }
        const held = await p.evaluate(() => !!window.__buddy.world.grab); await p.mouse.up(); await p.waitForTimeout(500);
        s = await state(p); check(held && s.seen.drag === 1, `${name}: pressing on him and pulling lifts him, and letting go throws him`);
        // sheet: open, close with Escape
        await p.click('#btnSkins'); await p.waitForTimeout(450); const open1 = await p.evaluate(() => document.getElementById('sheet').classList.contains('open'));
        await p.keyboard.press('Escape'); await p.waitForTimeout(450); const open2 = await p.evaluate(() => document.getElementById('sheet').classList.contains('open'));
        check(open1 && !open2, `${name}: the wardrobe opens and Escape closes it`);
        check(errs.length === 0, `${name}: no console errors through all that`, errs.join(' | '));
        // a reload keeps what he earned
        const cash0 = (await state(p)).cash; await p.reload(); await p.waitForTimeout(500); s = await state(p);
        check(s.cash === cash0 && s.cash > 0, `${name}: a reload keeps the cash`, `${cash0} -> ${s.cash}`);
        await ctx.close();
        // a purchase from the rack, then a skin
        ({ctx, p, errs} = await open(opt, `if (!localStorage.getItem('${KEY}')) localStorage.setItem('${KEY}', JSON.stringify({v:1,cash:1100,tools:{glove:1},skins:{dummy:1},skin:'dummy',best:0,seen:{tap:1,drag:1},tool:'glove'}))`));
        await p.locator('.slot.next').click({force: true}); await p.waitForTimeout(500); s = await state(p);
        check(s.tools.includes('mallet') && s.cash === 950 && s.tool === 'mallet', `${name}: tapping the next toy buys it for exactly its price and picks it up`, JSON.stringify([s.tools, s.cash, s.tool]));
        await p.click('#btnSkins'); await p.waitForTimeout(450); await p.locator('.card[data-id="sack"]').click({force: true}); await p.waitForTimeout(300); s = await state(p);
        check(s.skin === 'sack' && s.cash === 50, `${name}: a skin is bought and worn`, JSON.stringify([s.skin, s.cash]));
        check(errs.length === 0, `${name}: no console errors through a purchase and a skin`, errs.join(' | '));
        await ctx.close();
    }
    // the old page's progress carries over
    let r = await open({viewport: {width: 390, height: 844}}, `if (!localStorage.getItem('${KEY}')) localStorage.setItem('gptgames_interactive_buddy_v2', JSON.stringify({cash: 777, totalCash: 5000, unlocked: {grab:true, fist:true, baseball:true, icecream:true, bowling:true, bouncy:true, baby:true, knife:true, pistol:true, shotgun:true, grenade:true, mine:true, molotov:true, fireball:true, vortex:true, radio:true, orb:true}, ownedSkins: {default:true, classic:true, mint:true, pirate:true, goth:true, strawberry:true, sunny:true, robot:true}, stats: {punches: 42}}))`);
    let s = await state(r.p);
    check(s.cash === 777 && s.tools.length === 10 && s.skins.length === 6, 'the old page\'s cash carries over and a player who had everything has everything', JSON.stringify([s.cash, s.tools.length, s.skins.length]));
    await r.ctx.close();
    r = await open({viewport: {width: 390, height: 844}}, `if (!localStorage.getItem('${KEY}')) localStorage.setItem('gptgames_interactive_buddy_v2', JSON.stringify({cash: 20, unlocked: {icecream:true, bowling:true, bouncy:true}, ownedSkins: {mint:true}}))`);
    s = await state(r.p);
    check(s.cash === 20 && s.tools.length > 1 && s.tools.length < 5 && s.skins.length >= 1 && s.skins.length < 3, 'a player who had a few toys starts with the first few', JSON.stringify([s.tools, s.skins]));
    await r.ctx.close();
    // a save that lies is clamped, not trusted
    r = await open({viewport: {width: 390, height: 844}}, `localStorage.setItem('${KEY}', JSON.stringify({cash: 'lots', tools: {bomb: 1, nope: 1}, skins: {chrome: 1}, skin: 'night', best: -3, tool: 'bomb'}))`);
    s = await state(r.p);
    check(s.cash === 0 && s.tool === 'bomb' && s.skin === 'dummy' && s.best === 0 && r.errs.length === 0, 'a lying save is clamped and the page still opens', JSON.stringify(s) + r.errs.join(' | '));
    await r.ctx.close();
    // garbage that is not even JSON
    r = await open({viewport: {width: 390, height: 844}}, `localStorage.setItem('${KEY}', '{not json')`);
    s = await state(r.p); check(s.cash === 0 && r.errs.length === 0, 'a save that is not even JSON is a fresh start, not a crash');
    await r.ctx.close();
    // reduced motion
    r = await open({viewport: {width: 390, height: 844}, reducedMotion: 'reduce'});
    { const c = await where(r.p); await r.p.mouse.click(c.x - 25, c.y); await r.p.waitForTimeout(1000); s = await state(r.p); check(s.cash > 0 && r.errs.length === 0, 'with reduced motion the game still plays and logs nothing'); }
    await r.ctx.close();
    await browser.close();
}

const table = {body, hand, tools, money, flight, saves, bots, page};
for (const s of suites) { if (!table[s]) { console.log('unknown suite ' + s); process.exit(2); } }
const t0 = Date.now();
for (const s of suites) await table[s]();
console.log(`\n${passes} passed, ${failures} failed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failures ? 1 : 0);
