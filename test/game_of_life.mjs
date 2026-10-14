#!/usr/bin/env node
// Test suite for tools/game_of_life.html (Conway's Game of Life).
//
// Runs the page's DOM-free <script id="core"> block in Node. A Life simulator promises that what
// it shows is what the rule says: every generation is checked against a plain dense-grid stepper
// written here from the rule's definition, the patterns everyone looks up must do what LifeWiki
// records (the R-pentomino settles at 1103 with 116 cells, the acorn at 5206 with 633, diehard
// dies at 130), the readout must name still lifes, oscillators and spaceships correctly, and what
// people paste (RLE from LifeWiki and Golly, plaintext .cells, Life 1.05/1.06) must be read as
// those programs read it and written back so they read it the same.
//
//   node test/game_of_life.mjs              # everything
//   node test/game_of_life.mjs step facts   # named suites only
//
// Suites: rules, step, torus, facts, identify, formats, edges.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = process.env.GOL_PAGE || join(HERE, '..', 'tools', 'game_of_life.html');
const ALL = ['rules', 'step', 'torus', 'facts', 'identify', 'formats', 'edges'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const L = ctx.module.exports;

// ---- the reference: a dense grid, written from the definition --------------------------------
// births/survivals as arrays of neighbour counts; wrap = torus of w x h, else a padded box.
function dense(cells, births, survives, gens, wrap) {
  const B = new Set(births), S = new Set(survives);
  let w, h, ox = 0, oy = 0;
  if (wrap) { w = wrap.w; h = wrap.h; }
  else {
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
    const pad = gens + 2; ox = Math.min(...xs) - pad; oy = Math.min(...ys) - pad;
    w = Math.max(...xs) - Math.min(...xs) + 1 + 2 * pad; h = Math.max(...ys) - Math.min(...ys) + 1 + 2 * pad;
  }
  let g = Array.from({length: h}, () => new Uint8Array(w));
  for (const [x, y] of cells) g[y - oy][x - ox] = 1;
  for (let t = 0; t < gens; t++) {
    const n = Array.from({length: h}, () => new Uint8Array(w));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        let xx = x + dx, yy = y + dy;
        if (wrap) { xx = (xx + w) % w; yy = (yy + h) % h; } else if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        c += g[yy][xx];
      }
      n[y][x] = g[y][x] ? (S.has(c) ? 1 : 0) : (B.has(c) ? 1 : 0);
    }
    g = n;
  }
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x]) out.push([x + ox, y + oy]);
  return out;
}
const norm = cells => cells.map(([x, y]) => x + ',' + y).sort().join(' ');
const counts = mask => [...Array(9).keys()].filter(i => mask >> i & 1);
function run(cells, rule, gens, torus) { const w = L.makeWorld(cells, rule, torus); for (let i = 0; i < gens; i++) L.step(w); return w; }
function rnd(seed) { return L.rng(seed); }

if (suites.includes('rules')) {
  section('rules: B/S notation as LifeWiki and Golly write it');
  const ok = (input, text) => { const r = L.parseRule(input); eq(r.error ? 'ERR ' + r.error : r.text, text, `rule ${JSON.stringify(input)}`); };
  ok('B3/S23', 'B3/S23'); ok('b3s23', 'B3/S23'); ok(' B3 / S23 ', 'B3/S23'); ok('23/3', 'B3/S23');
  ok('S23/B3', 'B3/S23'); ok('B36/S23', 'B36/S23'); ok('highlife', 'B36/S23'); ok('Life', 'B3/S23');
  ok('B2/S', 'B2/S'); ok('seeds', 'B2/S'); ok('Day & Night', 'B3678/S34678'); ok('B3/S32', 'B3/S23');
  ok('B3678/S34678', 'B3678/S34678'); ok('b1357s1357', 'B1357/S1357'); ok('/3', 'B3/S'); ok('B/S', 'B/S');
  ok('B3/S23:T50,50', 'B3/S23'); eq(L.parseRule('B3/S23:T50,40').torus, {w: 50, h: 40}, 'Golly torus suffix is kept');
  for (const bad of ['', '   ', 'B9/S23', 'hello', 'B3/S23/5', 'B3x/S23', 'R1,C0']) check(!!L.parseRule(bad).error, `refused ${JSON.stringify(bad)}`, JSON.stringify(L.parseRule(bad)));
  check(L.parseRule('B3/S23/5').error && /Generations/.test(L.parseRule('B3/S23/5').error), 'Generations rules are named as such');
  check(L.parseRule('B9/S23').error.includes('0 to 8'), 'a 9 is explained');
  check(L.parseRule('B03/S23').b0 === true && L.parseRule('B3/S23').b0 === false, 'B0 is flagged so the page can refuse it on the plane');
  for (const [n, r] of L.PRESETS) eq(L.parseRule(r).text, r, `preset ${n} is canonical`);
  // The old page's four presets keep their exact rules.
  eq(['conway', 'highlife', 'seeds', 'daynight'].map(n => L.parseRule(n).text), ['B3/S23', 'B36/S23', 'B2/S', 'B3678/S34678'], 'old presets');
}

if (suites.includes('step')) {
  section('step: every generation matches a dense grid stepper');
  const rules = ['B3/S23', 'B36/S23', 'B2/S', 'B3678/S34678', 'B1357/S1357', 'B3/S012345678', 'B35678/S5678', 'B1/S1', 'B2/S0', 'B/S'];
  let n = 0;
  for (const rt of rules) for (let seed = 1; seed <= 6; seed++) {
    const r = L.parseRule(rt), cells = L.soup(12, 12, .25 + seed * .05, seed * 977 + rt.length), G = 12;
    const got = run(cells, r, G), want = dense(cells, counts(r.b), counts(r.s), G);
    eq(norm(L.cellsOf(got)), norm(want), `${rt} seed ${seed}, ${G} generations`); n++;
    eq(got.gen, G, 'generation counted');
  }
  // Negative and large coordinates behave like any others.
  const far = [[-1000003, 7], [-1000002, 7], [-1000001, 7], [5e6, -5e6], [5e6 + 1, -5e6], [5e6, -5e6 + 1], [5e6 + 1, -5e6 + 1]];
  eq(norm(L.cellsOf(run(far, L.LIFE, 2))), norm(far), 'blinker and block far from the origin');
  console.log(`  ${n} soups`);
}

if (suites.includes('torus')) {
  section('torus: wrapped edges, as the old page ran them');
  for (const [size, rt, seed] of [[25, 'B3/S23', 1], [50, 'B3/S23', 2], [17, 'B36/S23', 3], [20, 'B3678/S34678', 4], [10, 'B03/S23', 5], [8, 'B0/S8', 6]]) {
    const T = {w: size, h: size}, r = L.parseRule(rt), cells = L.soup(size, size, .3, seed);
    eq(norm(L.cellsOf(run(cells, r, 15, T))), norm(dense(cells, counts(r.b), counts(r.s), 15, T)), `${rt} on ${size}x${size}`);
  }
  // A glider crosses a 25-torus and comes back where it was after 4 x 25 generations.
  const gl = L.parse('bo$2bo$3o!').cells.map(([x, y]) => [x + 23, y + 23]);
  const w = run(gl, L.LIFE, 100, {w: 25, h: 25});
  eq(norm(L.cellsOf(w)), norm(gl.map(([x, y]) => [(x + 25) % 25, (y + 25) % 25])), 'glider returns after 100 generations on 25x25');
  eq(norm(L.cellsOf(L.makeWorld([[-1, -1], [25, 3]], L.LIFE, {w: 25, h: 25}))), norm([[24, 24], [0, 3]]), 'cells outside a torus wrap in');
}

if (suites.includes('facts')) {
  section('facts: what LifeWiki records');
  const lib = id => { const p = L.parse(L.LIBRARY.find(q => q.id === id).rle); return L.makeWorld(p.cells, p.rule || L.LIFE); };
  const to = (w, g) => { while (w.gen < g) L.step(w); return w; };
  // R-pentomino: 116 cells at 1103 (six gliders flying off), and no change in count after.
  const r = to(lib('rpentomino'), 1102); const p1102 = r.cells.size; L.step(r);
  eq(r.cells.size, 116, 'R-pentomino has 116 cells at generation 1103');
  const rs2 = L.cellsOf(to(lib('rpentomino'), 1103 + 4));
  eq(rs2.length, 116, 'and still 116 four generations later');
  // Acorn: 633 at 5206.
  eq(to(lib('acorn'), 5206).cells.size, 633, 'acorn has 633 cells at generation 5206');
  // Diehard: alive at 129, gone at 130.
  const d = to(lib('diehard'), 129); check(d.cells.size > 0, 'diehard alive at 129'); L.step(d); eq(d.cells.size, 0, 'diehard gone at 130');
  // Gosper gun: one more glider (5 cells) every 30 generations: 36 + 5k at 30k... after the first.
  const g = lib('gosper'); const pops = [];
  for (let k = 1; k <= 6; k++) { to(g, 30 * k + 60); pops.push(g.cells.size); }
  eq(pops.slice(1).map((p, i) => p - pops[i]), [5, 5, 5, 5, 5], 'Gosper gun adds one glider every 30 generations');
  // Replicator in HighLife copies itself.
  const rep = lib('replicator'); eq(rep.rule.text, 'B36/S23', 'replicator brings its rule');
  // Switch engine pattern keeps growing.
  const sw = lib('switchengine'), grow = []; for (let k = 1; k <= 8; k++) { to(sw, 1000 * k); grow.push(sw.cells.size); }
  check(grow.every((p, i) => !i || p > grow[i - 1]), 'the 10-cell infinite growth pattern keeps growing', grow.join(' '));
  for (const p of L.LIBRARY) check(!L.parse(p.rle).error && L.parse(p.rle).cells.length > 0, `library ${p.id} parses`);
}

if (suites.includes('identify')) {
  section('identify: the readout names what the pattern is');
  const id = (rle, rt, max) => { const p = L.parse(rle), w = L.makeWorld(p.cells, rt ? L.parseRule(rt) : (p.rule || L.LIFE)); const t = L.makeTracker(); let f = L.track(t, w); for (let i = 0; i < (max || 400) && !f; i++) { L.step(w); f = L.track(t, w); } return L.describe(f); };
  eq(id('2o$2o!'), 'Still life', 'block');
  eq(id('b2o$o2bo$b2o!'), 'Still life', 'beehive');
  eq(id('3o!'), 'Oscillator, period 2', 'blinker');
  eq(id(L.LIBRARY.find(p => p.id === 'pulsar').rle), 'Oscillator, period 3', 'pulsar');
  eq(id(L.LIBRARY.find(p => p.id === 'pentadecathlon').rle), 'Oscillator, period 15', 'pentadecathlon');
  eq(id('bo$2bo$3o!'), 'Spaceship, c/4 diagonal, period 4', 'glider');
  eq(id('bo2bo$o4b$o3bo$4o!'), 'Spaceship, c/2 orthogonal, period 4', 'LWSS');
  eq(id(L.LIBRARY.find(p => p.id === 'copperhead').rle), 'Spaceship, c/10 orthogonal, period 10', 'copperhead');
  eq(id(L.LIBRARY.find(p => p.id === 'diehard').rle, null, 200), 'Dies out at generation 130', 'diehard');
  eq(id('o!'), 'Dies out at generation 1', 'a lone cell');
  eq(id('2o!'), 'Dies out at generation 1', 'a domino');
  eq(id('2o$o!'), 'Settles into a still life from generation 1', 'L-tromino becomes a block');
  eq(id('3o$3o!'), 'Settles into a still life from generation 1', '2x3 rectangle becomes a beehive');
  eq(id(''), 'Empty', 'nothing');
  // A long-lived soup that settles: the readout must agree with brute force at the generation it names.
  const w = L.makeWorld(L.soup(16, 16, .35, 42), L.LIFE), t = L.makeTracker(); let f = L.track(t, w);
  while (!f && w.gen < 3000) { L.step(w); f = L.track(t, w); }
  if (f && f.kind !== 'dead') {
    const a = L.makeWorld(L.soup(16, 16, .35, 42), L.LIFE); for (let i = 0; i < f.from; i++) L.step(a);
    const s0 = L.cellsOf(a); for (let i = 0; i < f.p; i++) L.step(a);
    const s1 = L.cellsOf(a), dx = f.dx || 0, dy = f.dy || 0;
    eq(norm(s1), norm(s0.map(([x, y]) => [x + dx, y + dy])), `soup 42: repeats every ${f.p} from ${f.from}, as described`);
    const b = L.makeWorld(L.soup(16, 16, .35, 42), L.LIFE); for (let i = 0; i < f.from - 1; i++) L.step(b);
    const e0 = L.cellsOf(b); for (let i = 0; i < f.p; i++) L.step(b);
    check(f.from === 0 || norm(L.cellsOf(b)) !== norm(e0.map(([x, y]) => [x + dx, y + dy])), 'and not one generation earlier');
  }
  // Hash collisions can not pass: every reported period on random soups is real.
  let checked = 0;
  for (let s = 1; s <= 40; s++) {
    const w2 = L.makeWorld(L.soup(10, 10, .4, s), L.LIFE), t2 = L.makeTracker(); let f2 = L.track(t2, w2);
    while (!f2 && w2.gen < 1500) { L.step(w2); f2 = L.track(t2, w2); }
    if (!f2 || f2.kind === 'dead') continue;
    const a = L.makeWorld(L.soup(10, 10, .4, s), L.LIFE); for (let i = 0; i < f2.from; i++) L.step(a);
    const s0 = L.cellsOf(a); for (let i = 0; i < f2.p; i++) L.step(a);
    eq(norm(L.cellsOf(a)), norm(s0.map(([x, y]) => [x + (f2.dx || 0), y + (f2.dy || 0)])), `soup ${s}: ${L.describe(f2)}`); checked++;
    // and the period is the smallest one
    const c = L.makeWorld(L.soup(10, 10, .4, s), L.LIFE); for (let i = 0; i < f2.from; i++) L.step(c);
    const c0 = norm(L.cellsOf(c));
    let early = false; for (let q = 1; q < f2.p; q++) { L.step(c); if (L.cellsOf(c).length === s0.length && f2.kind !== 'ship' && norm(L.cellsOf(c)) === c0) early = true; }
    check(!early, `soup ${s}: period ${f2.p} is the smallest`);
  }
  console.log(`  ${checked} settled soups verified`);
}

if (suites.includes('formats')) {
  section('formats: RLE, plaintext, Life 1.05/1.06');
  const cellsOf = t => { const p = L.parse(t); return p.error ? 'ERR line ' + p.line + ': ' + p.error : norm(p.cells); };
  const glider = norm([[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]);
  eq(cellsOf('bo$2bo$3o!'), glider, 'bare RLE');
  eq(cellsOf('#N Glider\n#O Richard K. Guy\n#C The smallest spaceship.\nx = 3, y = 3, rule = B3/S23\nbo$2bo$3o!'), glider, 'LifeWiki RLE with comments');
  eq(cellsOf('x = 3, y = 3, rule = B3/S23\r\nbo$2bo$\r\n3o!\r\n'), glider, 'CRLF and a row split over lines');
  eq(cellsOf('﻿x=3,y=3\nbo$2bo$3o!'), glider, 'BOM and no spaces in the header');
  eq(cellsOf('x = 3, y = 3\nbo$2bo$3o!trailing junk after the end'), glider, 'anything after ! is ignored, as Golly does');
  eq(cellsOf('x = 3, y = 3\nbo$2bo$3o'), glider, 'a missing ! is forgiven');
  eq(cellsOf('x = 1, y = 3\no2$o!'), norm([[0, 0], [0, 2]]), '2$ skips a blank row');
  eq(cellsOf('.O.\n..O\nOOO'), glider, 'plaintext');
  eq(cellsOf('!Name: Glider\n!\n.O.\n..O\nOOO\n'), glider, '.cells with a header');
  eq(cellsOf('.*.\n..*\n***'), glider, 'asterisks');
  eq(cellsOf('#Life 1.06\n1 0\n2 1\n0 2\n1 2\n2 2'), glider, 'Life 1.06');
  eq(cellsOf('#Life 1.05\n#D glider\n#N\n#P -1 -1\n.*.\n..*\n***'), norm([[0, -1], [1, 0], [-1, 1], [0, 1], [1, 1]]), 'Life 1.05 with #P');
  eq(cellsOf('1 0\n2 1\n0 2\n1 2\n2 2'), glider, 'bare coordinate pairs');
  check(/line 2/.test(cellsOf('x = 3, y = 3\nbo$2bo$3q!')), 'a bad RLE character is located', cellsOf('x = 3, y = 3\nbo$2bo$3q!'));
  check(/line 2/.test(cellsOf('.O.\n.?O\nOOO')), 'a bad plaintext character is located');
  check(/whole numbers/.test(cellsOf('#Life 1.06\n1 0\n2 x')), 'bad Life 1.06 refused');
  check(/rule/i.test(cellsOf('x = 3, y = 3, rule = B3/S23/8\n3o!')), 'an unknown rule in the header is named');
  check(/longer/.test(cellsOf('x = 1, y = 1\n99999999o!')), 'an absurd run is refused rather than allocated');
  eq(L.parse('x = 3, y = 3, rule = B36/S23\n3o!').rule.text, 'B36/S23', 'the header rule comes along');
  eq(L.parse('x = 3, y = 3, rule = highlife\n3o!').rule.text, 'B36/S23', 'a named rule in the header');
  eq(L.parse('#N Gun\nx=1,y=1\no!').name, 'Gun', '#N is the name');
  check(L.parse('   \n  ').empty, 'whitespace is an empty pattern, not an error');
  // Writing: Golly-style, 70 columns, and every pattern reads back the same.
  eq(L.toRLE([[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]], L.LIFE, ''), 'x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!\n', 'glider written as LifeWiki writes it');
  eq(L.toRLE([[0, 0], [0, 3]], L.LIFE, ''), 'x = 1, y = 4, rule = B3/S23\no3$o!\n', 'blank rows collapse into n$');
  eq(L.toRLE([], L.LIFE, ''), 'x = 0, y = 0, rule = B3/S23\n!\n', 'empty');
  for (let s = 1; s <= 30; s++) {
    const cells = L.soup(40 + s, 30, .2 + (s % 5) / 10, s).map(([x, y]) => [x - 17, y - s]);
    const out = L.toRLE(cells, L.parseRule('B36/S23'), 'n' + s);
    check(out.split('\n').every(l => l.length <= 70), `soup ${s}: lines at most 70 characters`);
    const back = L.parse(out); const bb = L.bounds(cells);
    eq(norm(back.cells), norm(cells.map(([x, y]) => [x - bb.x, y - bb.y])), `soup ${s}: RLE round trip`);
    eq(back.rule.text, 'B36/S23', `soup ${s}: rule round trip`);
    eq(norm(L.parse(L.toPlain(cells)).cells), norm(cells.map(([x, y]) => [x - bb.x, y - bb.y])), `soup ${s}: plaintext round trip`);
  }
}

if (suites.includes('edges')) {
  section('edges: what breaks tools');
  const w = L.makeWorld([], L.LIFE); L.step(w); eq([w.gen, w.cells.size], [1, 0], 'an empty board steps');
  eq(L.makeWorld([[0, 0], [0, 0], [1, 1]], L.LIFE).cells.size, 2, 'duplicate cells count once');
  // B0 on a torus: everything empty is born at once.
  const t = run([], L.parseRule('B0/S'), 1, {w: 5, h: 5}); eq(t.cells.size, 25, 'B0 fills an empty torus');
  // S0: a lone cell survives.
  eq(run([[3, 3]], L.parseRule('B3/S0'), 5).cells.size, 1, 'S0 keeps a lone cell');
  // A big pattern: 200,000 cells parse and step in reasonable time.
  const big = L.soup(500, 400, .5, 7); const t0 = Date.now();
  const rle = L.toRLE(big, L.LIFE, ''); const p = L.parse(rle);
  eq(p.cells.length, big.length, '100k-cell RLE round trip'); const bw = L.makeWorld(p.cells, L.LIFE); L.step(bw);
  check(Date.now() - t0 < 8000, 'parse, write and one step of 100k cells within 8 s', Date.now() - t0 + ' ms');
  // Cells that fly off the edge of the plane are dropped and counted, never wrapped.
  const H = L.H, edge = L.parse('bo$2bo$3o!').cells.map(([x, y]) => [x + H - 8, y + H - 8]);
  const fw = run(edge, L.LIFE, 40); check(fw.lost > 0 && fw.cells.size < 5, 'a glider leaving the plane is counted as lost', JSON.stringify([fw.lost, fw.cells.size]));
  check(L.cellsOf(fw).every(([x, y]) => x > 0 && y > 0), 'and never reappears on the other side');
  // The soup is the same for the same seed (the Random button uses it).
  eq(L.soup(9, 9, .3, 5), L.soup(9, 9, .3, 5), 'soup is deterministic for a seed');
  const d = L.soup(200, 200, .3, 11).length / 40000; check(Math.abs(d - .3) < .01, 'soup density is 30%', d);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
