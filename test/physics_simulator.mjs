#!/usr/bin/env node
// Test suite for tools/physics_simulator.html (Physics Simulator).
//
// Runs the page's DOM-free <script id="core"> block (the rigid-body engine, presets, scene links and
// number parsing) in Node. The page promises motion a student can check with a calculator, so the
// expected values come from the textbook formulas, not from the engine: free fall t = √(2h/g),
// projectile range 2·vx·vy/g, a box sliding to rest after v²/(2μg), the incline threshold tan θ = μ
// and its acceleration g(sin θ − μ cos θ), rebound height e²·h, the pendulum period 2π√(L/g), and
// momentum conserved in every collision. Then what makes sandboxes fall apart: stacks that must stand,
// balls that must stop rolling, a Newton's cradle that must pass the swing along the row, every preset
// run for 10 s, and the inputs that break tools (bad shapes, 400+ bodies, hostile scene links, typed
// numbers with commas and units).
//
//   node test/physics_simulator.mjs                 # everything
//   node test/physics_simulator.mjs motion stacks   # named suites only
//
// Suites: motion, contact, stacks, cradle, presets, parse, scenes, edges.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'physics_simulator.html');
const ALL = ['motion', 'contact', 'stacks', 'cradle', 'presets', 'parse', 'scenes', 'edges'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ±${tol}`);
const rel = (got, want, frac, what) => near(got, want, Math.abs(want) * frac, what);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const P = ctx.module.exports;
const g = 9.81, dt = P.STEP;
const run = (w, seconds, each) => { const n = Math.round(seconds / dt); for (let i = 0; i < n; i++) { P.step(w); if (each && each(i * dt + dt) === false) break; } };
const big = opt => P.createWorld(Object.assign({width: 60, height: 40}, opt));
const user = w => P.userBodies(w);
const allFinite = w => w.bodies.every(b => [b.x, b.y, b.a, b.vx, b.vy, b.w].every(Number.isFinite));

if (suites.includes('motion')) {
  section('motion');
  // free fall from 10 m: the centre of a small ball drops 10 m in √(2h/g)
  {
    const w = big(); const b = P.addBody(w, {shape: 'circle', r: 0.1, x: 5, y: 10.1});
    let t = 0; run(w, 3, tt => { t = tt; return b.y > 0.1 + 1e-3; });
    near(t, Math.sqrt(2 * 10 / g), 2 * dt, 'free fall 10 m takes √(2h/g) = 1.428 s');
    near(Math.abs(b.vy), g * t, 0.02, 'speed after the fall is g·t');
  }
  // gravity is what the world says: on the Moon a 2 m drop takes √(4/1.62)
  {
    const w = big({gravity: 1.62}); const b = P.addBody(w, {shape: 'circle', r: 0.1, x: 5, y: 2.1});
    let t = 0; run(w, 3, tt => { t = tt; return b.y > 0.1 + 1e-3; });
    near(t, Math.sqrt(4 / 1.62), 2 * dt, 'Moon gravity: 2 m in 1.571 s');
  }
  // projectile: launched at 45° with 5 m/s each way, it comes back to its height 2·vx·vy/g further on
  {
    const w = big(); const b = P.addBody(w, {shape: 'circle', r: 0.05, x: 2, y: 10, vx: 5, vy: 5});
    let x = 0, prev = b.y; run(w, 2, () => { if (b.vy < 0 && prev >= 10 && b.y < 10) { x = b.x; return false; } prev = b.y; });
    near(x - 2, 2 * 5 * 5 / g, 0.03, 'range at launch height 2·vx·vy/g = 5.097 m');
    near(b.vx, 5, 1e-9, 'horizontal speed never changes in flight');
  }
  // pendulum: small swings of a 2 m string take 2π√(L/g), and the swing neither grows nor dies
  {
    const w = big(); const L = 2, th = 0.1;
    const b = P.addBody(w, {shape: 'circle', r: 0.05, x: 30 + L * Math.sin(th), y: 30 - L * Math.cos(th), fixedRotation: true});
    P.addJoint(w, {type: 'rope', a: b, px: 30, py: 30, len: L});
    const cross = []; let prev = b.x - 30, amp = 0;
    run(w, 30, t => { const c = b.x - 30; if (prev > 0 && c <= 0) cross.push(t); prev = c; if (t > 25) amp = Math.max(amp, Math.abs(c)); });
    const T = (cross[cross.length - 1] - cross[0]) / (cross.length - 1);
    rel(T, 2 * Math.PI * Math.sqrt(L / g) * (1 + th * th / 16), 0.003, 'pendulum period 2π√(L/g)(1+θ²/16) = 2.839 s');
    rel(amp, L * Math.sin(th), 0.03, 'amplitude after 25 s within 3% of the start');
  }
  // energy: with no losses (e = 1, no friction) a bouncing ball keeps its total energy within 2%
  {
    const w = big({restitution: 1, friction: 0}); const b = P.addBody(w, {shape: 'circle', r: 0.2, x: 5, y: 3});
    const E0 = P.measure(w, b).total; let worst = 0;
    run(w, 8, () => { const E = P.measure(w, b).total; worst = Math.max(worst, Math.abs(E - E0) / E0); });
    check(worst < 0.02, 'elastic bouncing keeps energy within 2%', `worst drift ${(worst * 100).toFixed(2)}%`);
  }
  // measure() reports exactly the textbook terms
  {
    const w = big(); const b = P.addBody(w, {shape: 'circle', r: 0.3, x: 5, y: 2, vx: 3, vy: 4, w0: 2});
    const m = P.measure(w, b);
    near(m.mass, Math.PI * 0.09 * 100, 1e-9, 'mass = πr²·100 kg/m² (28.27 kg)');
    near(m.speed, 5, 1e-12, 'speed √(3²+4²) = 5');
    near(m.lin, 0.5 * m.mass * 25, 1e-9, 'kinetic ½mv²');
    near(m.rot, 0.5 * (0.5 * m.mass * 0.09) * 4, 1e-9, 'spin ½Iω² with I = ½mr²');
    near(m.pe, m.mass * g * 2, 1e-9, 'potential mgh from the floor');
    near(m.total, m.lin + m.rot + m.pe, 1e-9, 'total is the sum shown');
    const box = P.addBody(w, {shape: 'box', w: 2, h: 1, x: 20, y: 5});
    near(box.m, 200, 1e-9, '2 × 1 m box weighs 200 kg');
    near(box.I, 200 * (4 + 1) / 12, 1e-9, 'box inertia m(w²+h²)/12');
  }
}

if (suites.includes('contact')) {
  section('contact');
  // bounce: dropped from 1 m, a ball rises again to e²·h
  for (const e of [0.3, 0.6, 0.9]) for (const shape of ['circle', 'box']) {
    const w = big({restitution: e});
    const b = P.addBody(w, shape === 'circle' ? {shape, r: 0.1, x: 5, y: 1.1} : {shape, w: 0.2, h: 0.2, x: 5, y: 1.1});
    let hit = false, up = false, peak = 0;
    run(w, 3, () => { if (b.y < 0.13) hit = true; if (hit && b.vy > 0.1) up = true; if (up) { peak = Math.max(peak, b.y - 0.1); if (b.vy < 0) return false; } });
    near(peak, e * e, 0.03, `${shape} with bounce ${e} rises to e²·h = ${(e * e).toFixed(2)} m`);
  }
  {
    const w = big({restitution: 0}); const b = P.addBody(w, {shape: 'circle', r: 0.1, x: 5, y: 1.1});
    let maxUp = 0; run(w, 2, () => { if (b.y < 0.2) maxUp = Math.max(maxUp, b.vy); });
    check(maxUp < 0.15, 'bounce 0 does not bounce', `rebound ${maxUp.toFixed(3)} m/s`);
  }
  // sliding: a box at 5 m/s on μ = 0.5 stops after v²/(2μg) and does not tip
  for (const mu of [0.2, 0.5, 1]) {
    const w = big({friction: mu}); const b = P.addBody(w, {shape: 'box', w: 0.4, h: 0.4, x: 2, y: 0.2, vx: 5});
    run(w, 6);
    rel(b.x - 2, 25 / (2 * mu * g), 0.02, `μ ${mu}: slides v²/(2μg) = ${(25 / (2 * mu * g)).toFixed(2)} m`);
    near(b.a, 0, 0.01, `μ ${mu}: box stays flat`);
  }
  {
    const w = big({friction: 0}); const b = P.addBody(w, {shape: 'box', w: 0.4, h: 0.4, x: 2, y: 0.2, vx: 2});
    run(w, 3); near(b.vx, 2, 0.01, 'friction 0: a sliding box keeps its speed');
  }
  // incline: a box holds where tan θ < μ and slides at g(sin θ − μ cos θ) where tan θ > μ
  for (const deg of [20, 35, 45]) {
    const th = deg * Math.PI / 180, mu = 0.5;
    const w = big({friction: mu});
    const ramp = P.addBody(w, {shape: 'box', w: 30, h: 1, x: 30, y: 15, a: th, fixed: true});
    const nx = -Math.sin(th), ny = Math.cos(th), s = 0.4;
    const b = P.addBody(w, {shape: 'box', w: s, h: s, x: 30 + nx * (0.5 + s / 2), y: 15 + ny * (0.5 + s / 2), a: th});
    run(w, 0.3);
    const x0 = b.x, y0 = b.y; let v0 = Math.hypot(b.vx, b.vy);
    run(w, 1);
    const d = Math.hypot(b.x - x0, b.y - y0), v1 = Math.hypot(b.vx, b.vy);
    if (Math.tan(th) < mu) check(d < 0.01, `${deg}°: tan θ < μ, the box holds`, `moved ${d.toFixed(4)} m`);
    else rel(v1 - v0, g * (Math.sin(th) - mu * Math.cos(th)), 0.04, `${deg}°: slides at g(sin θ − μ cos θ) = ${(g * (Math.sin(th) - mu * Math.cos(th))).toFixed(2)} m/s²`);
    void ramp;
  }
  // a ball rolls down without slipping: a = g sin θ / (1 + I/mr²) = (2/3) g sin θ for a disc
  {
    const th = 20 * Math.PI / 180, w = big({friction: 0.8});
    P.addBody(w, {shape: 'box', w: 30, h: 1, x: 30, y: 15, a: th, fixed: true});
    const r = 0.2, nx = -Math.sin(th), ny = Math.cos(th);
    const b = P.addBody(w, {shape: 'circle', r, x: 30 + nx * (0.5 + r), y: 15 + ny * (0.5 + r)});
    run(w, 0.2); const v0 = Math.hypot(b.vx, b.vy); run(w, 1); const v1 = Math.hypot(b.vx, b.vy);
    // m·a = mg sin θ − f and (I/r²)·a = f − c·mg cos θ, with I = ½mr²: a = g(sin θ − c cos θ)/1.5
    rel(v1 - v0, g * (Math.sin(th) - P.ROLL * Math.cos(th)) / 1.5, 0.02, `disc rolls at g(sin θ − c·cos θ)/1.5 = ${(g * (Math.sin(th) - P.ROLL * Math.cos(th)) / 1.5).toFixed(2)} m/s² (c = ${P.ROLL} rolling resistance)`);
    rel(Math.abs(b.w) * r, v1, 0.02, 'rolling without slipping: ωr = v');
  }
  // collisions: equal masses swap velocities at e = 1; momentum is conserved at any e
  for (const e of [1, 0.5, 0]) {
    const w = big({gravity: 0, restitution: e, friction: 0});
    const a = P.addBody(w, {shape: 'circle', r: 0.2, x: 10, y: 10, vx: 3}), b = P.addBody(w, {shape: 'circle', r: 0.2, x: 12, y: 10});
    run(w, 2);
    near(a.m * a.vx + b.m * b.vx, a.m * 3, 1e-6, `e ${e}: momentum conserved`);
    near(b.vx - a.vx, 3 * e, 0.02, `e ${e}: separation speed = e × approach speed`);
  }
  {
    const w = big({gravity: 0, restitution: 1, friction: 0});
    const a = P.addBody(w, {shape: 'circle', r: 0.2, x: 10, y: 10, vx: 3}), b = P.addBody(w, {shape: 'circle', r: 0.4, x: 12, y: 10});
    run(w, 2);
    const m1 = a.m, m2 = b.m;
    near(a.vx, 3 * (m1 - m2) / (m1 + m2), 0.02, 'unequal elastic collision: v1 = u(m1−m2)/(m1+m2)');
    near(b.vx, 3 * 2 * m1 / (m1 + m2), 0.02, 'unequal elastic collision: v2 = 2u·m1/(m1+m2)');
  }
  // round things stop: a ball rolling at 3 m/s on the flat comes to rest
  {
    // decelerates at c·g/(1 + I/mr²) = c·g/1.5, so from 2 m/s it stops after v²·1.5/(2·c·g)
    const w = P.createWorld({width: 80, height: 10}); const b = P.addBody(w, {shape: 'circle', r: 0.25, x: 2, y: 0.25, vx: 2});
    run(w, 60);
    check(Math.abs(b.vx) < 1e-3 && Math.abs(b.w) < 1e-2, 'a rolling ball comes to rest', `vx ${b.vx}, ω ${b.w}`);
    // it starts sliding; friction brings it to rolling at v0/(1 + I/mr²) = (2/3)·v0, then it rolls (2v0/3)²·1.5/(2·c·g)
    const want = (4 / 3) ** 2 * 1.5 / (2 * P.ROLL * g);
    rel(b.x - 2, want, 0.05, `after rolling (2v0/3)²·1.5/(2cg) = ${want.toFixed(1)} m`);
  }
  // fixed shapes never move, however hard they are hit
  {
    const w = big(); const f = P.addBody(w, {shape: 'box', w: 1, h: 1, x: 5, y: 3, fixed: true});
    P.addBody(w, {shape: 'circle', r: 0.3, x: 5, y: 8, vy: -20});
    run(w, 2); eq([f.x, f.y, f.a], [5, 3, 0], 'fixed box stays put when hit');
  }
}

if (suites.includes('stacks')) {
  section('stacks');
  for (const n of [5, 10, 14]) {
    const w = big(); for (let i = 0; i < n; i++) P.addBody(w, {shape: 'box', w: 0.5, h: 0.5, x: 5, y: 0.25 + i * 0.5});
    run(w, 10);
    const top = w.bodies[w.bodies.length - 1];
    check(Math.abs(top.x - 5) < 0.02 && Math.abs(top.y - (n - 0.5) * 0.5) < 0.05 && Math.abs(top.a) < 0.01, `column of ${n} boxes stands for 10 s`, `top at ${top.x.toFixed(3)}, ${top.y.toFixed(3)}, ${top.a.toFixed(3)} rad`);
  }
  {
    const d = P.buildPreset('tower', 8, 5), {world: w} = P.deserialize(d, 8, 5), b0 = user(w).map(b => [b.x, b.y]);
    run(w, 10);
    const moved = Math.max(...user(w).map((b, i) => Math.hypot(b.x - b0[i][0], b.y - b0[i][1])));
    check(moved < 0.03, 'Tower stack preset stands untouched for 10 s', `moved up to ${moved.toFixed(3)} m`);
  }
  {
    // the starter's frame stands until the ball arrives, then falls
    const d = P.buildPreset('starter', 8, 5); d.bodies.splice(1, 1);
    const {world: w} = P.deserialize(d, 8, 5), b0 = user(w).map(b => [b.x, b.y]);
    run(w, 8);
    const moved = Math.max(...user(w).map((b, i) => Math.hypot(b.x - b0[i][0], b.y - b0[i][1])));
    check(moved < 0.03, 'starter frame stands on its own', `moved ${moved.toFixed(3)} m`);
    const {world: w2} = P.deserialize(P.buildPreset('starter', 8, 5), 8, 5), c0 = user(w2).slice(2).map(b => b.y);
    run(w2, 12);
    check(user(w2).slice(2).filter((b, i) => c0[i] - b.y > 0.3).length >= 4, 'starter: the ball brings the frame down');
    const still = user(w2).filter(b => Math.hypot(b.vx, b.vy) > 0.01);
    check(!still.length, 'starter: everything has come to rest after 12 s', still.map(b => `${b.shape} ${Math.hypot(b.vx, b.vy).toFixed(3)} m/s`).join('; '));
  }
}

if (suites.includes('cradle')) {
  section('cradle');
  const {world: w} = P.deserialize(P.buildPreset('cradle', 8, 5), 8, 5);
  const bobs = user(w).filter(b => b.label === 'bob');
  eq(bobs.length, 5, 'five balls');
  let first = null;
  run(w, 3, t => { if (first === null && Math.abs(bobs[4].vx) > 0.5) { first = bobs.map(b => b.vx); return false; } });
  check(first && first.slice(0, 4).every(v => Math.abs(v) < 0.1), 'first impact: the four balls on the left are left at rest', first && first.map(v => v.toFixed(2)).join(' '));
  const L = 2.25, v = Math.sqrt(2 * g * L * (1 - Math.cos(Math.PI / 4)));
  rel(first ? first[4] : 0, v, 0.02, `and the last flies off with the speed the first arrived at, √(2gL(1−cos45°)) = ${v.toFixed(2)} m/s`);
  let drift = 0;
  run(w, 20, t => { if (t > 10) for (let q = 1; q < 4; q++) drift = Math.max(drift, Math.abs(bobs[q].x - w.joints[q].px)); });
  check(drift < 0.5, 'from 10 s to 20 s the middle three still hang nearly still: the swing stays at the ends', `middle balls strayed up to ${drift.toFixed(2)} m`);
  const E = () => bobs.reduce((s, b) => s + P.measure(w, b).total, 0);
  const {world: w2} = P.deserialize(P.buildPreset('cradle', 8, 5), 8, 5), b2 = P.userBodies(w2).filter(b => b.label === 'bob');
  const E0 = b2.reduce((s, b) => s + P.measure(w2, b).total, 0); run(w2, 10);
  rel(b2.reduce((s, b) => s + P.measure(w2, b).total, 0), E0, 0.01, 'the cradle keeps its energy within 1% for 10 s'); void E;
}

if (suites.includes('presets')) {
  section('presets');
  eq(Object.keys(P.PRESETS), ['starter', 'dominoes', 'cradle', 'tower', 'slingshot', 'pinball', 'pool'], 'the seven scenes');
  for (const id of Object.keys(P.PRESETS)) {
    const d = P.buildPreset(id, 8, 5), r = P.deserialize(d, 8, 5), w = r.world;
    eq(user(w).length, d.bodies.length, `${id}: every body built`);
    run(w, 10);
    check(allFinite(w), `${id}: no NaN after 10 s`);
    const out = user(w).filter(b => b.x < -0.01 || b.x > 8.01 || b.y < -0.01 || b.y > 5.01);
    check(!out.length, `${id}: nothing leaves the 8 × 5 m box`, out.map(b => `${b.label} ${b.x.toFixed(2)},${b.y.toFixed(2)}`).join('; '));
  }
  eq(P.buildPreset('pool', 8, 5).g, 0, 'pool sets gravity to 0 (seen from above)');
  eq(['starter', 'dominoes', 'cradle', 'tower', 'slingshot'].map(id => P.buildPreset(id, 8, 5).g), [9.81, 9.81, 9.81, 9.81, 9.81], 'other scenes bring Earth gravity back');
  {
    // dominoes: the ball topples the whole row
    const {world: w} = P.deserialize(P.buildPreset('dominoes', 8, 5), 8, 5); run(w, 8);
    const dom = user(w).filter(b => b.shape === 'poly');
    check(dom.every(b => Math.abs(b.a) > 0.6), 'dominoes: every domino falls', dom.map(b => b.a.toFixed(2)).join(' '));
  }
  {
    // slingshot: pulled back 1.5 m and released, the stone leaves the band and flies
    const d = P.buildPreset('slingshot', 8, 5), {world: w, extra} = P.deserialize(d, 8, 5);
    const stone = user(w).find(b => b.label === 'stone'), s = extra.sling;
    stone.x = s.x - 1.5; stone.y = s.y + 0.2;
    let released = false;
    w.onStep = () => { const j = w.joints.find(j => j.type === 'spring'); if (j && (stone.x - s.x) > 0) { w.joints.splice(w.joints.indexOf(j), 1); released = true; } };
    run(w, 0.6);
    check(released && stone.vx > 6, 'slingshot: the band lets go and the stone flies', `released ${released}, vx ${stone.vx.toFixed(2)}`);
  }
  eq(P.buildPreset('nope', 8, 5), null, 'unknown preset -> null');
}

if (suites.includes('parse')) {
  section('parse');
  const ok = (s, v) => { const r = P.parseNumber(s, 0, 50, 'gravity'); check(r.ok && Math.abs(r.value - v) < 1e-12, `"${s}" -> ${v}`, JSON.stringify(r)); };
  const bad = (s, what) => { const r = P.parseNumber(s, 0, 50, 'gravity'); check(!r.ok && /0 to 50/.test(r.error), `"${s}" is refused (${what})`, JSON.stringify(r)); };
  ok('9.81', 9.81); ok('9,81', 9.81); ok(' 9.81 ', 9.81); ok('9.81 m/s²', 9.81); ok('9.81m/s^2', 9.81); ok('9.81 m/s2', 9.81);
  ok('1.62', 1.62); ok('0', 0); ok('+3', 3); ok('.5', 0.5); ok(',5', 0.5); ok('50', 50); ok('24.79', 24.79);
  bad('', 'empty'); bad('   ', 'blank'); bad('abc', 'not a number'); bad('-1', 'negative'); bad('51', 'too big');
  bad('9.81.2', 'two points'); bad('1e3', 'exponent'); bad('9 81', 'space inside'); bad('NaN', 'NaN'); bad('Infinity', 'Infinity');
  check(/like 9\.81/.test(P.parseNumber('abc', 0, 50, 'gravity').error), 'the error gives an example of what works');
}

if (suites.includes('scenes')) {
  section('scenes');
  // a scene survives save -> load: same shapes, same places, same motion afterwards
  {
    const {world: w} = P.deserialize(P.buildPreset('starter', 8, 5), 8, 5); run(w, 0.8);
    const json = JSON.parse(JSON.stringify(P.serialize(w)));
    const {world: w2} = P.deserialize(json, 8, 5);
    eq(user(w2).length, user(w).length, 'round trip keeps every body');
    const d = Math.max(...user(w).map((b, i) => Math.hypot(b.x - user(w2)[i].x, b.y - user(w2)[i].y)));
    check(d < 1e-3, 'round trip keeps positions to the millimetre', `${d}`);
    check(user(w2).every((b, i) => Math.abs(b.vx - user(w)[i].vx) < 2e-3), 'and velocities');
    eq([w2.gravity, w2.restitution, w2.friction], [w.gravity, w.restitution, w.friction], 'and the world settings');
  }
  {
    const {world: w} = P.deserialize(P.buildPreset('cradle', 8, 5), 8, 5);
    const {world: w2} = P.deserialize(JSON.parse(JSON.stringify(P.serialize(w))), 8, 5);
    eq(w2.joints.length, 5, 'cradle strings survive the round trip');
    const {world: w3, extra} = P.deserialize(P.buildPreset('slingshot', 8, 5), 8, 5);
    eq([w3.joints[0].type, !!extra.sling], ['spring', true], 'slingshot band and its rules survive');
  }
  // hostile or broken scene data never throws and never builds a broken body
  const hostile = [null, 1, 'x', [], {}, {bodies: 'no'}, {bodies: [null, 1, 'a', {}]},
    {bodies: [{s: 'c', r: -1, x: 1, y: 1}, {s: 'c', r: 'x', x: 1, y: 1}, {s: 'c', r: 1e9, x: 1, y: 1}, {s: 'c', r: 0.2, x: NaN, y: 1}]},
    {bodies: [{s: 'p', v: [[0, 0], [1, 0]], x: 1, y: 1}, {s: 'p', v: [[0, 0], [0, 0], [0, 0]], x: 1, y: 1}, {s: 'p', v: 'zz', x: 1, y: 1}, {s: 'p', v: Array(500).fill([1, 2]), x: 1, y: 1}]},
    {g: 1e9, e: -5, mu: 'a', bodies: [{s: 'c', r: 0.2, x: 2, y: 2, c: 'red;background:url(x)', l: '<img src=x onerror=alert(1)>'.repeat(10)}]},
    {bodies: [{s: 'c', r: 0.2, x: 2, y: 2}], joints: [{a: 5}, {a: 0, len: -1}, {a: 0, b: 99, len: 1}, null, {a: '__proto__'}]},
    {bodies: Array(5000).fill({s: 'c', r: 0.1, x: 2, y: 2})}];
  hostile.forEach((d, i) => {
    let r = null, threw = null;
    try { r = P.deserialize(d, 8, 5); if (r) run(r.world, 0.2); } catch (e) { threw = e; }
    check(!threw, `hostile scene ${i} does not throw`, threw && threw.stack);
    if (r) check(allFinite(r.world) && user(r.world).length <= P.MAX_BODIES, `hostile scene ${i} builds only sound bodies`);
  });
  {
    const r = P.deserialize({g: 1e9, e: -5, mu: 'a', bodies: [{s: 'c', r: 0.2, x: 2, y: 2, c: 'red;x', l: 'y'.repeat(100)}]}, 8, 5);
    eq([r.world.gravity, r.world.restitution, r.world.friction], [50, 0, 0.5], 'out-of-range settings are clamped or defaulted');
    eq(user(r.world)[0].color, P.PALETTE[0], 'a colour that is not #rrggbb is replaced');
    eq(user(r.world)[0].label.length, 24, 'labels are cut to 24 characters');
  }
  // a scene from a wider box is scaled to fit rather than piled at the wall
  {
    const r = P.deserialize({W: 16, H: 10, bodies: [{s: 'c', r: 0.4, x: 15, y: 9}]}, 8, 5), b = user(r.world)[0];
    eq([b.x, b.y, b.r], [7.5, 4.5, 0.2], 'scene from a 16 × 10 m box is halved');
  }
  // hash links
  eq(JSON.stringify(P.parseHash('#preset=cradle')), '{"preset":"cradle"}', '#preset=cradle');
  eq(JSON.stringify(P.parseHash('#preset=newton&g=1,62')), '{"preset":"cradle","g":1.62}', 'aliases and a decimal comma');
  eq(JSON.stringify(P.parseHash('#preset=Pool')), '{"preset":"pool"}', 'case does not matter');
  eq(JSON.stringify(P.parseHash('#preset=moonbase')), '{"badPreset":"moonbase"}', 'unknown scene is reported, not loaded');
  eq(JSON.stringify(P.parseHash('#preset=cradle&g=1.62&e=0.9&mu=0,2')), '{"preset":"cradle","g":1.62,"e":0.9,"mu":0.2}', 'bounce and friction travel in a preset link');
  eq(JSON.stringify(P.parseHash('#e=2&mu=-1')), '{}', 'out-of-range bounce and friction in a link are ignored');
  eq(JSON.stringify(P.parseHash('#g=abc')), '{}', 'bad gravity in a link is ignored');
  eq(JSON.stringify(P.parseHash('#g=99')), '{}', 'out-of-range gravity in a link is ignored');
  eq(JSON.stringify(P.parseHash('')), '{}', 'no hash');
  eq(P.parseHash('#s=zABC').scene, 'zABC', 'scene code is passed through for the page to decode');
}

if (suites.includes('edges')) {
  section('edges');
  const w = P.createWorld();
  eq([w.width, w.height], [8, 5], 'the world is 8 × 5 m');
  eq(P.addBody(w, {shape: 'circle', r: 0, x: 1, y: 1}), null, 'zero radius refused');
  eq(P.addBody(w, {shape: 'circle', r: -1, x: 1, y: 1}), null, 'negative radius refused');
  eq(P.addBody(w, {shape: 'box', w: 0.01, h: 1, x: 1, y: 1}), null, 'a box thinner than 3 cm refused');
  eq(P.addBody(w, {shape: 'poly', sides: 2, r: 1, x: 1, y: 1}), null, 'a 2-sided polygon refused');
  eq(P.addBody(w, {shape: 'poly', sides: 99, r: 1, x: 1, y: 1}), null, 'a 99-sided polygon refused');
  eq(P.addBody(w, {shape: 'blob', x: 1, y: 1}), null, 'unknown shape refused');
  eq(P.addBody(w, {shape: 'circle', r: 0.2, x: Infinity, y: 1}), null, 'infinite position refused');
  const tri = P.addBody(w, {shape: 'poly', verts: [[0, 0], [1, 0], [0, 1], [0.2, 0.2]], x: 2, y: 2});
  eq(tri.verts.length, 3, 'a dent in a polygon is filled (convex hull)');
  const cw = P.addBody(w, {shape: 'poly', verts: [[0, 0], [0, 1], [1, 0]], x: 4, y: 2});
  check(cw && cw.area > 0, 'clockwise corners are accepted');
  for (const k of ['circle', 'poly']) check(P.userBodies(w).every(b => b.m > 0), `${k}: masses positive`);
  // limit
  const w2 = P.createWorld(); let made = 0;
  for (let i = 0; i < P.MAX_BODIES + 50; i++) if (P.addBody(w2, {shape: 'circle', r: 0.05, x: 0.1 + (i % 70) * 0.11, y: 0.1 + Math.floor(i / 70) * 0.11})) made++;
  eq(made, P.MAX_BODIES, `no more than ${P.MAX_BODIES} shapes`);
  const t0 = Date.now(); run(w2, 1); const ms = Date.now() - t0;
  check(allFinite(w2), '400 shapes in a heap: no NaN');
  check(ms < 4000, '400 shapes: one simulated second in under 4 s of CPU', `${ms} ms`);
  // pin and release
  const w3 = P.createWorld(); const b = P.addBody(w3, {shape: 'box', w: 0.5, h: 0.5, x: 4, y: 3});
  const m0 = b.m;
  P.setFixed(w3, b, true); run(w3, 1); eq([b.x, b.y, b.invM], [4, 3, 0], 'a pinned box hangs where it was');
  P.setFixed(w3, b, false); eq(b.m, m0, 'released, it has its mass back'); run(w3, 4); check(b.y < 0.3, 'and falls to the floor', `y ${b.y}`);
  eq(P.setFixed(w3, w3.bodies[0], true), false, 'walls cannot be pinned or released');
  // removing a body also removes its strings and contacts
  const {world: w4} = P.deserialize(P.buildPreset('cradle', 8, 5), 8, 5);
  P.removeBody(w4, P.userBodies(w4).find(b => b.label === 'bob'));
  eq(w4.joints.length, 4, 'erasing a cradle ball takes its string with it');
  run(w4, 1); check(allFinite(w4), 'and the rest carries on');
  // zero gravity: nothing falls; the ceiling keeps a drifting body in
  const w5 = P.createWorld({gravity: 0}); const d = P.addBody(w5, {shape: 'circle', r: 0.2, x: 4, y: 2.5, vy: 3});
  run(w5, 5); check(d.y <= 5 - 0.19 && d.y > 0, 'zero g: a body drifting up stays under the ceiling', `y ${d.y}`);
  // huge gravity and huge speed do not tunnel through the floor
  const w6 = P.createWorld({gravity: 50}); const f = P.addBody(w6, {shape: 'circle', r: 0.1, x: 4, y: 4.5, vy: -20});
  run(w6, 2); check(f.y > 0.05, 'g = 50 and 20 m/s down: still above the floor', `y ${f.y}`);
  // advance(): fixed steps whatever the frame time; a long stall runs slow instead of locking up
  const w7 = P.createWorld(); P.addBody(w7, {shape: 'circle', r: 0.2, x: 4, y: 3});
  eq(P.advance(w7, 1 / 60), 4, '1/60 s is 4 steps of 1/240 s');
  eq(P.advance(w7, 1 / 120), 2, '1/120 s (a 120 Hz screen) is 2 steps: the same speed of time');
  eq(P.advance(w7, 10, 24), 24, 'a 10 s stall runs at most 24 steps');
  eq(P.advance(w7, NaN), 0, 'NaN time does nothing');
  eq(P.advance(w7, -1), 0, 'negative time does nothing');
  // a shape made inside another is eased out, not fired out; a tapped one is lifted to sit on top
  const w9 = P.createWorld(); P.addBody(w9, {shape: 'box', w: 3, h: 0.12, x: 3, y: 2, a: -0.6, fixed: true});
  const deep = P.addBody(w9, {shape: 'circle', r: 0.25, x: 3, y: 2}); let vmax = 0;
  run(w9, 0.15, () => { vmax = Math.max(vmax, Math.hypot(deep.vx, deep.vy)); });
  check(vmax < 3.5, 'a ball made half inside a ramp is pushed out gently: at most 1.5 m/s plus what gravity adds (it was 10.9 m/s)', `reached ${vmax.toFixed(2)} m/s in 0.15 s`);
  const lifted = P.addBody(w9, {shape: 'circle', r: 0.25, x: 2.5, y: 2.3});
  const up = P.settle(w9, lifted, 1.5);
  check(up > 0 && up < 1, 'settle() lifts a tapped ball clear of the ramp', `lifted ${up.toFixed(2)} m`);
  eq(P.settle(w9, P.addBody(w9, {shape: 'circle', r: 0.2, x: 7, y: 4}), 1.5), 0, 'a ball in open air is not moved');
  eq(P.settle(w9, P.addBody(w9, {shape: 'circle', r: 0.2, x: 7, y: 3}), 1.5, 0.4), 0, 'nor with a drop allowed, when nothing is within reach below');
  {
    const w = P.createWorld(); P.addBody(w, {shape: 'box', w: 4, h: 0.12, x: 3, y: 2, a: -0.5, fixed: true});
    const ball = P.addBody(w, {shape: 'circle', r: 0.25, x: 2.5, y: 2.9});
    const d = P.settle(w, ball, 1.5, 0.4);
    // centre of a ball resting on the plank's top face: on the face's normal, r + half the thickness away
    const nx = -Math.sin(-0.5), ny = Math.cos(-0.5), dist = (ball.x - 3) * nx + (ball.y - 2) * ny;
    check(d < 0 && Math.abs(dist - (0.25 + 0.06)) < 0.01, 'a ball tapped just above a slope is set down onto it', `moved ${d.toFixed(3)}, gap ${(dist - 0.31).toFixed(4)} m`);
    const y0 = ball.y; run(w, 0.05); check(Math.abs(ball.y - y0) < 0.02, 'and starts rolling from there without a drop');
  }
  // picking
  const w8 = P.createWorld(); const c = P.addBody(w8, {shape: 'circle', r: 0.3, x: 2, y: 2});
  eq(P.bodyAt(w8, 2.2, 2.1), c, 'a tap inside a ball finds it');
  eq(P.bodyAt(w8, 2.35, 2, 0), null, 'just outside, no');
  eq(P.bodyAt(w8, 2.35, 2, 0.1), c, 'just outside, with a finger’s slack, yes');
  eq(P.bodyAt(w8, 4, 0.01), null, 'the floor is never picked');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
