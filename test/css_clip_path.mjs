#!/usr/bin/env node
// Test suite for tools/css_clip_path_generator.html (CSS clip-path Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises three things: a clip-path you paste is
// read the way a browser reads it (CSS Shapes 1 polygon/circle/ellipse/inset, Shapes 2 rect/xywh, CSS Values 4
// <position>); the line it writes is the shortest correct form of what you see; and the outline it draws over the
// preview is exactly the area the browser clips. Expected numbers are worked out by hand from the specs, not read
// back from the page. The `browser` suite has Chromium clip a box with each value and compares it pixel for pixel
// with a canvas filling the page's own outline, then drives the real page (skipped without Playwright; it serves
// the page itself, no server needed).
//
//   node test/css_clip_path.mjs              # everything
//   node test/css_clip_path.mjs parse geo    # named suites only
//
// Suites: parse, position, errors, format, geo, edits, units, presets, huge, fuzz, browser.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createServer} from 'http';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PAGE = join(ROOT, 'tools', 'css_clip_path_generator.html');
const ALL = ['parse', 'position', 'errors', 'format', 'geo', 'edits', 'units', 'presets', 'huge', 'fuzz', 'browser'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ±${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const CORE = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {};
vm.runInNewContext(CORE + '\nthis.CP = CP;', ctx);
const CP = ctx.CP;
const out = (s, W = 600, H = 400) => { const r = CP.parse(s, W, H); return r.ok ? CP.format(r.model) : 'ERR ' + r.error; };
const model = (s, W = 600, H = 400) => { const r = CP.parse(s, W, H); if (!r.ok) throw new Error(s + ': ' + r.error); return r.model; };
const plain = o => JSON.parse(JSON.stringify(o));

if (suites.includes('parse')) {
  section('parse');
  const same = [
    'polygon(50% 0%, 100% 100%, 0% 100%)',
    'polygon(evenodd, 0% 0%, 100% 0%, 0% 100%)',
    'polygon(10px 20px, 300px 0, 0 390.5px)',
    'circle(40% at 50% 50%)', 'circle(closest-side at 50% 50%)', 'circle(farthest-side at 10% 90%)',
    'ellipse(40% 25% at 30% 70%)', 'ellipse(closest-side farthest-side at 50% 50%)',
    'inset(10%)', 'inset(10% 20%)', 'inset(10% 20% 30%)', 'inset(10% 20% 30% 40%)',
    'inset(10% round 12px)', 'inset(5px 10px round 4px 8px)', 'inset(0 round 10px / 20px)', 'inset(0 round 1px 2px 3px 4px / 5px)',
    'polygon(0% 0%, 100% 0%, 50% 100%) content-box',
  ];
  for (const s of same) eq(out(s), s, `round trip ${s}`);
  const cases = [
    // what people actually paste
    ['clip-path: polygon(50% 0%, 100% 100%, 0% 100%);', 'polygon(50% 0%, 100% 100%, 0% 100%)'],
    ['  CLIP-PATH :  Polygon( 50%  0% ,100% 100%,0% 100% ) ;  ', 'polygon(50% 0%, 100% 100%, 0% 100%)'],
    ['-webkit-clip-path: circle(50% at 50% 50%);', 'circle(50% at 50% 50%)'],
    ['.hero {\n  -webkit-clip-path: polygon(0 0, 100% 0, 100% 85%, 0 100%);\n  clip-path: polygon(0 0, 100% 0, 100% 85%, 0 100%);\n}', 'polygon(0% 0%, 100% 0%, 100% 85%, 0% 100%)'],
    ['clip-path: inset(10px) !important;', 'inset(10px)'],
    ['polygon(\n  50% 0%,\n  100% 100%,\n  0% 100%\n)', 'polygon(50% 0%, 100% 100%, 0% 100%)'],
    ['polygon(nonzero, 0 0, 100% 0, 0 100%)', 'polygon(0% 0%, 100% 0%, 0% 100%)'],
    ['polygon(.5% 1e1%, +10% -0%, 3.25% 99.999%)', 'polygon(0.5% 10%, 10% 0%, 3.25% 99.999%)'],
    ['polygon(0% 0%, 100% 0%, 50% 100%) border-box', 'polygon(0% 0%, 100% 0%, 50% 100%) border-box'],
    ['padding-box polygon(0% 0%, 100% 0%, 50% 100%)', 'polygon(0% 0%, 100% 0%, 50% 100%) padding-box'],
    ['circle()', 'circle(closest-side at 50% 50%)'],
    ['circle(20px)', 'circle(20px at 300px 200px)'],
    ['ellipse()', 'ellipse(closest-side closest-side at 50% 50%)'],
    ['inset(10% 10% 10% 10%)', 'inset(10%)'],
    ['inset(1% 2% 1% 2%)', 'inset(1% 2%)'],
    ['inset(1% 2% 3% 2%)', 'inset(1% 2% 3%)'],
    ['inset(0 round 8px 8px 8px 8px)', 'inset(0 round 8px)'],
    ['inset(0 round 8px 0 8px 0)', 'inset(0 round 8px 0)'],
    ['inset(0 round 8px/8px)', 'inset(0 round 8px)'],
    ['inset(0 round 0)', 'inset(0%)'],
    ['inset(-10px)', 'inset(-10px)'],
    // rect() and xywh() (CSS Shapes 2) become the inset() they draw
    ['rect(10% 90% 80% 20%)', 'inset(10% 10% 20% 20%)'],
    ['rect(auto auto auto auto)', 'inset(0%)'],
    ['rect(20px 580px 380px 20px round 6px)', 'inset(20px round 6px)'],
    ['xywh(10% 20% 50% 30%)', 'inset(20% 40% 50% 10%)'],
    ['xywh(10px 20px 100px 50px)', 'inset(20px 490px 330px 10px)'],
    ['xywh(0 0 100% 100% round 50%)', 'inset(0% round 50%)'],
  ];
  for (const [i, w] of cases) eq(out(i), w, `parse ${JSON.stringify(i).slice(0, 70)}`);
  check(/rewritten as the inset/.test(CP.parse('rect(0 100% 100% 0)').note), 'rect() says it was rewritten');
  check(CP.parse('polygon(0 0, 1px 1px, 2% 2%)').note.length > 0, 'mixed units say so');
  eq(CP.parse('polygon(0 0, 1px 1px, 2px 2px)').note, '', 'unitless zeros are not mixed units');
  eq(model('polygon(evenodd, 0 0, 1% 0, 0 1%)').fill, 'evenodd', 'fill rule kept');
  eq(model('circle(farthest-side)').r, 'farthest-side', 'radius keyword kept, not resolved');
}

if (suites.includes('position')) {
  section('position');
  // CSS Values 4 <position>: one value (other axis center), two values (keywords in either order), four values
  // (edge offsets). 600 x 400 box.
  const cases = [
    ['circle(10% at center)', 'circle(10% at 50% 50%)'],
    ['circle(10% at left)', 'circle(10% at 0% 50%)'],
    ['circle(10% at top)', 'circle(10% at 50% 0%)'],
    ['circle(10% at bottom)', 'circle(10% at 50% 100%)'],
    ['circle(10% at 30%)', 'circle(10% at 30% 50%)'],
    ['circle(10% at left top)', 'circle(10% at 0% 0%)'],
    ['circle(10% at top left)', 'circle(10% at 0% 0%)'],
    ['circle(10% at bottom right)', 'circle(10% at 100% 100%)'],
    ['circle(10% at center top)', 'circle(10% at 50% 0%)'],
    ['circle(10% at top center)', 'circle(10% at 50% 0%)'],
    ['circle(10% at left 25%)', 'circle(10% at 0% 25%)'],
    ['circle(10% at 25% bottom)', 'circle(10% at 25% 100%)'],
    ['circle(10% at right 10% bottom 20%)', 'circle(10% at 90% 80%)'],
    ['circle(10% at bottom 20% right 10%)', 'circle(10% at 90% 80%)'],
    ['circle(10% at left 10% top 5%)', 'circle(10% at 10% 5%)'],
    ['circle(10px at right 10px bottom 20px)', 'circle(10px at 590px 380px)'],
    ['circle(10% at right 60px top 0%)', 'circle(10% at 90% 0%)'],      // 600 - 60 = 540 = 90%
    ['ellipse(10% 20% at 100px 100px)', 'ellipse(60px 80px at 100px 100px)'], // tie of units goes to %? no: 2 % vs 2 px
  ];
  for (const [i, w] of cases.slice(0, -1)) eq(out(i), w, i);
  // two % and two px is a tie, which stays %: 100px of 600 = 16.6667%, of 400 = 25%
  eq(out('ellipse(10% 20% at 100px 100px)'), 'ellipse(10% 20% at 16.6667% 25%)', 'unit tie stays %');
  for (const bad of ['circle(1% at left right)', 'circle(1% at top bottom)', 'circle(1% at 10% left)', 'circle(1% at top 10%)',
    'circle(1% at 1% 2% 3%)', 'circle(1% at center 10% top 5%)', 'circle(1% at left 10% left 5%)', 'circle(1% at right top 10% 5%)', 'circle(1% at)'])
    check(!CP.parse(bad).ok, `rejects ${bad}`);
}

if (suites.includes('errors')) {
  section('errors');
  // every rejection names the problem and what would be accepted, and nothing throws
  const cases = [
    ['', /Paste a clip-path/], ['   ', /Paste a clip-path/], ['clip-path: ;', /Paste a clip-path/],
    ['none', /clips nothing/], ['url(#mask)', /SVG/], ['border-box', /no shape/],
    ['polygon(0 0, 50 50, 1px 1px)', /“50” needs a unit: 50% or 50px/],
    ['polygon(1em 0, 0 0, 1px 1px)', /em can't be edited.*% or px/],
    ['polygon(10vw 0, 0 0, 1px 1px)', /vw can't be edited/],
    ['polygon(calc(100% - 10px) 0, 0 0, 1px 1px)', /calc\(\) can't be edited/],
    ['polygon(var(--x) 0, 0 0, 1px 1px)', /var\(\) can't be edited/],
    ['polygon(0 0, 100% 0)', /at least 3 points; this one has 2/],
    ['polygon()', /empty/],
    ['polygon(0 0 0, 1px 1px, 2px 2px)', /Point 1 .*two values.*comma missing/],
    ['polygon(0 0, , 1px 1px, 2px 2px)', /empty point after point 1/],
    ['polygon(0 0, 1px 1px, 2px 2px,)', /empty point/],
    ['polygon(0 0, 100% 0, 50% 100%', /closing \) is missing/],
    ['polygon(0 0, 100% 0, 50% 100%))', /one \) too many/],
    ['polygon(50%,0%, 100% 100%, 0% 100%)', /needs exactly two values/],
    ['polygon(50% 0%; 100% 100%; 0% 100%)', /./],
    ['polygon(5O% 0%, 100% 100%, 0% 100%)', /“5o%” isn't a length/i],
    ['polygon(0,5% 0%, 1% 1%, 2% 2%)', /needs exactly two values/],
    ['circle(-10px)', /can't be negative/], ['circle(10% 20%)', /one radius/], ['ellipse(10%)', /two radii/],
    ['circle(10%, 20%)', /no commas/], ['inset()', /1 to 4 values/], ['inset(1% 2% 3% 4% 5%)', /1 to 4 values/],
    ['inset(10% round)', /needs a radius/], ['inset(10% round 1px 2px 3px 4px 5px)', /corner radius/],
    ['inset(10% round 1px / 2px / 3px)', /corner radius/], ['inset(10% round -2px)', /can't be negative/],
    ['rect(1px 2px 3px)', /4 values/], ['xywh(0 0 -1px 10px)', /can't be negative/],
    ['path("M0 0 L10 10 Z")', /path\(\) can't be edited/], ['shape(from 0 0, line to 10px 10px)', /shape\(\) can't be edited/],
    ['polygon(0 0, 1px 1px, 2px 2px) margin-box border-box', /reference box|isn't a shape/],
    ['triangle(1px)', /isn't a clip-path shape/], ['banana', /isn't a shape/],
    ['polygon(0 0, 1px 1px, 2px 2px) left', /reference box/],
  ];
  for (const [i, re] of cases) {
    let r; try { r = CP.parse(i); } catch (e) { r = {ok: true, error: 'THREW ' + e.message}; }
    check(!r.ok && re.test(r.error), `error for ${JSON.stringify(i)}`, r.ok ? 'accepted: ' + CP.format(r.model) : r.error);
  }
  check(CP.parse(null).ok === false && CP.parse(undefined).ok === false && CP.parse(42).ok === false, 'non-strings do not throw');
  // a decimal comma cannot be told apart from the point separator; it must fail loudly rather than misread
  const dc = CP.parse('polygon(12,5% 0%, 100% 100%, 0% 100%)');
  check(!dc.ok, 'decimal comma is not silently misread', dc.ok ? CP.format(dc.model) : '');
}

if (suites.includes('format')) {
  section('format');
  eq(CP.num(0, '%'), '0%', 'zero percent');
  eq(CP.num(0, 'px'), '0', 'zero px is bare 0');
  eq(CP.num(-0, '%'), '0%', 'negative zero');
  eq(CP.num(33.333333, '%'), '33.3333%', 'four decimals at most');
  eq(CP.num(1e-7, 'px'), '0', 'float dust is zero');
  eq(CP.num(12.5, 'px'), '12.5px', 'decimals kept');
  eq(CP.num('closest-side', '%'), 'closest-side', 'keywords pass through');
  eq(CP.declaration(model('circle(10% at 1% 2%)')), 'clip-path: circle(10% at 1% 2%);', 'declaration');
  // parts glue back to the value and carry the keys a page highlights
  const m = model('polygon(evenodd, 1% 2%, 3% 4%, 5% 6%) content-box');
  const P = CP.parts(m);
  eq(P.map(p => p.t).join(''), CP.format(m), 'parts join to the value');
  eq(P.filter(p => p.k).map(p => p.k + '=' + p.t), ['p0=1% 2%', 'p1=3% 4%', 'p2=5% 6%'], 'point keys');
  eq(CP.parts(model('circle(1% at 2% 3%)')).filter(p => p.k).map(p => p.k), ['r', 'c'], 'circle keys');
  eq(CP.parts(model('inset(1% round 2px)')).filter(p => p.k).map(p => p.k), ['sides', 'round'], 'inset keys');
  // whatever is written parses back to the same thing
  for (const s of ['polygon(1.5px 2px, 3px 4px, 5px 6px)', 'inset(1px 2px 3px 4px round 1px 2px 3px / 4px)', 'ellipse(farthest-side 10% at 0% 100%)']) {
    const m1 = model(s), m2 = model(CP.format(m1));
    eq(plain(m2), plain(m1), `stable ${s}`);
  }
}

if (suites.includes('geo')) {
  section('geo');
  const W = 600, H = 400;
  // circle % radius is of sqrt(W^2 + H^2) / sqrt(2) (CSS Shapes 1, 3.1): sqrt(520000) / 1.41421356 = 509.9020
  let g = CP.geo(model('circle(40% at 50% 50%)'), W, H);
  near(g.r, 203.9608, 1e-3, 'circle 40% of 600x400'); near(g.cx, 300, 1e-9, 'cx'); near(g.cy, 200, 1e-9, 'cy');
  near(CP.geo(model('circle(50%)'), 300, 300).r, 150, 1e-9, 'circle 50% of a square is half the side');
  near(CP.geo(model('circle()'), W, H).r, 200, 1e-9, 'closest-side at center');
  near(CP.geo(model('circle(farthest-side at 20% 30%)'), W, H).r, 480, 1e-9, 'farthest-side: 600 - 120');
  near(CP.geo(model('circle(closest-side at 10% 90%)'), W, H).r, 40, 1e-9, 'closest-side: 400 - 360');
  near(CP.geo(model('circle(closest-side at -10% 50%)'), W, H).r, 60, 1e-9, 'closest-side outside the box uses the distance');
  g = CP.geo(model('ellipse(50% 25% at 50% 50%)'), W, H);
  near(g.rx, 300, 1e-9, 'ellipse rx % of width'); near(g.ry, 100, 1e-9, 'ellipse ry % of height');
  g = CP.geo(model('ellipse(closest-side farthest-side at 70% 40%)'), W, H);
  near(g.rx, 180, 1e-9, 'ellipse closest-side x'); near(g.ry, 240, 1e-9, 'ellipse farthest-side y');
  g = CP.geo(model('inset(10% 20% 30% 40%)'), W, H);
  eq([g.x, g.y, g.w, g.h].map(v => +v.toFixed(6)), [240, 40, 240, 240], 'inset rectangle');
  // insets that overlap are reduced proportionally (Shapes 1): 75% + 75% of 600 -> 300 + 300
  g = CP.geo(model('inset(0 75%)'), W, H);
  eq([g.x, g.w], [300, 0], 'overlapping insets meet in the middle');
  // round percentages: horizontal of the reference box width, vertical of its height (checked against Chromium)
  g = CP.geo(model('inset(10% 20% round 10%)'), W, H);
  eq(g.rad[0].map(v => +v.toFixed(6)), [60, 40], 'round % of the reference box');
  // radii larger than a side are scaled down together (CSS Backgrounds 3, 5.5): 200+200 on a 100-wide box -> f = 0.25
  g = CP.geo(model('inset(0 round 200px)'), 100, 300);
  eq(g.rad.map(r => r.map(v => +v.toFixed(6))), [[50, 50], [50, 50], [50, 50], [50, 50]], 'radii scaled to fit');
  g = CP.geo(model('inset(0 round 60px 0 0 0)'), 100, 100);
  eq(g.rad[0], [60, 60], 'one big corner alone fits');
  g = CP.geo(model('polygon(50% 0%, 100% 100%, 0% 100%)'), W, H);
  eq(g.pts, [[300, 0], [600, 400], [0, 400]], 'polygon to px');
  eq(CP.pathD(g), 'M300 0L600 400L0 400Z', 'polygon path');
  eq(CP.pathD(g, 0.5), 'M150 0L300 200L0 200Z', 'path at a scale');
  eq(CP.pathD(CP.geo(model('circle(0px)'), W, H)), '', 'zero circle draws nothing');
  check(/^M240 40L/.test(CP.pathD(CP.geo(model('inset(10% 20% 30% 40%)'), W, H))), 'square inset path starts at its corner');
  check(CP.selfIntersects([[0, 0], [10, 10], [10, 0], [0, 10]]), 'bow tie intersects');
  check(!CP.selfIntersects([[0, 0], [10, 0], [10, 10], [0, 10]]), 'square does not');
}

if (suites.includes('edits')) {
  section('edits');
  const W = 600, H = 400;
  const tri = model('polygon(50% 0%, 100% 100%, 0% 100%)');
  eq(CP.format(CP.setPoint(tri, 0, 123, 77, W, H, 1)), 'polygon(21% 19%, 100% 100%, 0% 100%)', 'drag snaps to 1%: 123/600 = 20.5 -> 21, 77/400 = 19.25 -> 19');
  eq(CP.format(CP.setPoint(tri, 0, 123, 77, W, H, 0.1)), 'polygon(20.5% 19.3%, 100% 100%, 0% 100%)', 'drag at 0.1%');
  eq(CP.format(CP.setPoint(tri, 0, -50, 999, W, H, 1)), 'polygon(0% 100%, 100% 100%, 0% 100%)', 'drag clamps to the box');
  check(CP.format(tri) === 'polygon(50% 0%, 100% 100%, 0% 100%)', 'edits do not mutate');
  const px = model('polygon(10px 10px, 100px 10px, 10px 100px)');
  eq(CP.format(CP.setPoint(px, 1, 200.4, 30.6, W, H, 1)), 'polygon(10px 10px, 200px 31px, 10px 100px)', 'px model stays px');
  eq(CP.format(CP.addPoint(tri, 1, 300, 400, W, H, 1)), 'polygon(50% 0%, 100% 100%, 50% 100%, 0% 100%)', 'add after point 2');
  eq(CP.format(CP.addPoint(tri, 2, 150, 200, W, H, 1)), 'polygon(50% 0%, 100% 100%, 0% 100%, 25% 50%)', 'add on the closing edge');
  eq(CP.format(CP.removePoint(model('polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'), 2)), 'polygon(0% 0%, 100% 0%, 0% 100%)', 'remove');
  eq(CP.format(CP.removePoint(tri, 0)), CP.format(tri), 'never below 3 points');
  // the arrow keys move by model units
  eq(CP.format(CP.nudge(tri, 'p0', 1, 0, W, H)), 'polygon(51% 0%, 100% 100%, 0% 100%)', 'nudge right');
  eq(CP.format(CP.nudge(tri, 'p0', 0, -10, W, H)), 'polygon(50% 0%, 100% 100%, 0% 100%)', 'nudge clamps at 0');
  const c = model('circle(40% at 50% 50%)');
  eq(CP.format(CP.setCenter(c, 150, 100, W, H, 1)), 'circle(40% at 25% 25%)', 'move centre');
  eq(CP.format(CP.setR(c, 254.951, W, H, 1)), 'circle(50% at 50% 50%)', 'radius in % of the diagonal basis');
  eq(CP.format(CP.setR(c, -5, W, H, 1)), 'circle(0% at 50% 50%)', 'radius not negative');
  eq(CP.format(CP.setR(model('circle(closest-side)'), 100, W, H, 1)), 'circle(20% at 50% 50%)', 'dragging a keyword radius makes it a number');
  const e = model('ellipse(10% 10% at 50% 50%)');
  eq(CP.format(CP.setRx(e, 150, W, H, 1)), 'ellipse(25% 10% at 50% 50%)', 'rx');
  eq(CP.format(CP.setRy(e, 150, W, H, 1)), 'ellipse(10% 37.5% at 50% 50%)'.replace('37.5', '38'), 'ry snaps');
  const ins = model('inset(10% round 20px)');
  eq(CP.format(CP.setSide(ins, 't', 100, W, H, 1)), 'inset(25% 10% 10% round 20px)', 'top side');
  eq(CP.format(CP.setSide(ins, 'l', 1000, W, H, 1)), 'inset(10% 10% 10% 90% round 20px)', 'a side stops at the opposite one');
  eq(CP.format(CP.setRound(ins, 35.4, W, H, 1)), 'inset(10% round 35px)', 'round in px');
  eq(CP.format(CP.setRound(ins, 9999, W, H, 1)), 'inset(10% round 160px)', 'round stops at half the short side');
  eq(CP.format(CP.setRound(model('inset(0 round 1%)'), 60, W, H, 1)), 'inset(0% round 10% / 15%)', 'round in % stays circular on screen');
  // handles sit where the shape is
  const hs = CP.handles(tri, W, H);
  eq(hs.filter(h => h.kind === 'vertex').map(h => [h.x, h.y]), [[300, 0], [600, 400], [0, 400]], 'vertex handles');
  eq(hs.filter(h => h.kind === 'mid').map(h => [h.x, h.y]), [[450, 200], [300, 400], [150, 200]], 'midpoint handles');
  const ch = CP.handles(model('circle(10% at 95% 50%)'), W, H).find(h => h.key === 'r');
  check(ch.x <= W, 'radius handle flips inside the box', JSON.stringify(ch));
  eq(CP.handles(model('inset(10%)'), W, H).map(h => h.key), ['t', 'r_', 'b', 'l', 'round'], 'inset handles');
}

if (suites.includes('units')) {
  section('units');
  const W = 600, H = 400;
  eq(CP.format(CP.convert(model('polygon(50% 0%, 100% 100%, 0% 100%)'), 'px', W, H)), 'polygon(300px 0, 600px 400px, 0 400px)', '% to px');
  eq(CP.format(CP.convert(model('polygon(300px 0, 600px 400px, 0 400px)'), '%', W, H)), 'polygon(50% 0%, 100% 100%, 0% 100%)', 'px to %');
  eq(CP.format(CP.convert(model('circle(50% at 50% 50%)'), 'px', W, H)), 'circle(254.951px at 300px 200px)', 'circle radius uses the diagonal basis');
  eq(CP.format(CP.convert(model('circle(farthest-side at 50% 50%)'), 'px', W, H)), 'circle(farthest-side at 300px 200px)', 'keyword survives');
  eq(CP.format(CP.convert(model('inset(10% 20% round 10px)'), 'px', W, H)), 'inset(40px 120px round 10px)', 'inset sides convert, px radius stays');
  eq(CP.format(CP.convert(model('ellipse(10% 10% at 0% 0%)'), 'px', W, H)), 'ellipse(60px 40px at 0 0)', 'ellipse');
  const m = model('polygon(33.3333% 0%, 100% 66.6667%, 0% 100%)');
  eq(CP.format(CP.convert(CP.convert(m, 'px', W, H), '%', W, H)), CP.format(m), '% -> px -> % is stable');
  // a % shape keeps its numbers when the box changes, so it scales (CSS semantics)
  eq(CP.geo(m, 300, 300).pts[0][0], 99.9999, 'same % on another box');
}

if (suites.includes('presets')) {
  section('presets');
  check(CP.PRESETS.length >= 16, 'enough presets');
  const names = new Set();
  for (const [name, val] of CP.PRESETS) {
    check(!names.has(name), `unique name ${name}`); names.add(name);
    const r = CP.parse(val);
    check(r.ok, `${name} parses`, r.error);
    if (r.ok) {
      eq(CP.format(r.model), val, `${name} is written in canonical form`);
      if (r.model.type === 'polygon') check(r.model.pts.every(([x, y]) => x >= 0 && x <= 100 && y >= 0 && y <= 100), `${name} inside the box`);
      if (r.model.type === 'polygon' && r.model.fill !== 'evenodd') check(!CP.selfIntersects(r.model.pts), `${name} does not cross itself`);
    }
  }
}

if (suites.includes('huge')) {
  section('huge');
  const N = 20000, pts = [];
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; pts.push(`${(50 + 50 * Math.cos(a)).toFixed(3)}% ${(50 + 50 * Math.sin(a)).toFixed(3)}%`); }
  const s = 'clip-path: polygon(' + pts.join(', ') + ');';
  let t = performance.now();
  const r = CP.parse(s);
  const parseMs = performance.now() - t;
  check(r.ok && r.model.pts.length === N, `${N} points parse`);
  t = performance.now(); const f = CP.format(r.model); const fmtMs = performance.now() - t;
  check(f.length > 300000, 'and write back');
  check(parseMs < 400 && fmtMs < 400, `fast enough: parse ${parseMs.toFixed(0)} ms, write ${fmtMs.toFixed(0)} ms`);
  t = performance.now(); CP.selfIntersects(r.model.pts); check(performance.now() - t < 400, 'self-intersection check is bounded');
  const junk = 'polygon(' + 'x'.repeat(500000) + ')';
  t = performance.now(); const j = CP.parse(junk); check(!j.ok && performance.now() - t < 200, 'half a megabyte of junk fails fast');
  check(j.ok || j.error.length < 200, 'and the error does not echo it all');
}

if (suites.includes('fuzz')) {
  section('fuzz');
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const bits = ['polygon', 'circle', 'ellipse', 'inset', 'rect', 'xywh', '(', ')', ',', ' ', 'at', 'round', '/', '%', 'px', '10', '-3', '.5', 'e2', 'left', 'top', 'center', 'evenodd', 'closest-side', 'é', '\n', ';', 'clip-path:', 'calc(', 'nan', 'Infinity'];
  let threw = 0, okButBad = 0;
  for (let i = 0; i < 4000; i++) {
    let s = ''; const n = 1 + Math.floor(rnd() * 14); for (let k = 0; k < n; k++) s += bits[Math.floor(rnd() * bits.length)];
    try {
      const r = CP.parse(s);
      if (r.ok) { const again = CP.parse(CP.format(r.model)); if (!again.ok || CP.format(again.model) !== CP.format(r.model)) okButBad++;
        const d = CP.pathD(CP.geo(r.model, 600, 400)); if (/NaN|Infinity/.test(d)) okButBad++; }
      else if (typeof r.error !== 'string' || !r.error) okButBad++;
    } catch (e) { threw++; if (threw < 3) console.log('   threw on', JSON.stringify(s), e.message); }
  }
  eq(threw, 0, 'random input never throws');
  eq(okButBad, 0, 'whatever is accepted writes back stably and draws without NaN');
}

if (suites.includes('browser')) {
  section('browser');
  let chromium;
  try { ({chromium} = await import('playwright')); } catch (e) {
    try { const {createRequire} = await import('module'); ({chromium} = createRequire(import.meta.url)('playwright')); } catch (_) {}
  }
  if (!chromium) console.log('  (skipped: no playwright)');
  else {
    const types = {html: 'text/html', js: 'text/javascript', svg: 'image/svg+xml', png: 'image/png'};
    const srv = createServer((req, res) => {
      const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      try { const b = readFileSync(p); res.writeHead(200, {'content-type': types[p.split('.').pop()] || 'application/octet-stream'}); res.end(b); }
      catch (e) { res.writeHead(404); res.end(); }
    }).listen(0);
    const port = srv.address().port;
    const browser = await chromium.launch();
    const page = await browser.newPage({viewport: {width: 1000, height: 1000}, deviceScaleFactor: 1});
    await page.setContent(`<body style="margin:0;background:#fff"><script>${CORE}</script></body>`);
    // Chromium clips a black box with the value; a canvas fills the page's outline; the pixels must agree.
    const cases = [
      ...CP.PRESETS.map(([, v]) => [v, 600, 400]),
      ['inset(10% 20% round 25%)', 600, 400], ['inset(10% 20% round 10% / 30%)', 600, 400], ['inset(5% round 50%)', 300, 500],
      ['inset(10px 20px 30px 40px round 10px 60px 5px 0)', 300, 200], ['inset(60% 60% round 20px)', 400, 300], ['inset(0 round 200px)', 100, 300],
      ['circle(40% at 30% 60%)', 600, 400], ['circle(farthest-side at 20% 30%)', 500, 300], ['circle()', 300, 500],
      ['circle(30% at right 10% bottom 20%)', 600, 400], ['ellipse(closest-side farthest-side at 70% 40%)', 600, 400],
      ['ellipse(30% 40% at left 25% top 75%)', 500, 350], ['polygon(10px 20px, 290px 0, 150px 190px)', 300, 200],
      ['polygon(evenodd, 0% 0%, 100% 100%, 100% 0%, 0% 100%)', 400, 300], ['polygon(0% 0%, 100% 100%, 100% 0%, 0% 100%)', 400, 300],
      ['rect(10% 90% 80% 20% round 12px)', 600, 400], ['xywh(10% 20% 50% 30% round 8px)', 600, 400],
    ];
    let worst = 0;
    for (const [css, W, H] of cases) {
      await page.evaluate(([css, W, H]) => {
        document.body.innerHTML = `<div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:#000;clip-path:${css}"></div>`;
      }, [css, W, H]);
      const shot = await page.screenshot({clip: {x: 0, y: 0, width: W, height: H}});
      const res = await page.evaluate(async ([css, W, H, b64]) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d'); };
        const a = mk(); a.drawImage(img, 0, 0); const A = a.getImageData(0, 0, W, H).data;
        const b = mk(); b.fillStyle = '#fff'; b.fillRect(0, 0, W, H); b.fillStyle = '#000';
        const r = CP.parse(css, W, H); if (!r.ok) return {err: r.error};
        // what the page prints is what gets compared: re-read the printed line
        const m = CP.parse(CP.format(r.model), W, H).model, g = CP.geo(m, W, H);
        b.fill(new Path2D(CP.pathD(g)), g.fill === 'evenodd' ? 'evenodd' : 'nonzero');
        const B = b.getImageData(0, 0, W, H).data;
        let bad = 0, ink = 0; for (let i = 0; i < A.length; i += 4) { if (Math.abs(A[i] - B[i]) > 128) bad++; if (A[i] < 128) ink++; }
        return {bad, ink};
      }, [css, W, H, shot.toString('base64')]);
      if (res.err) { check(false, `browser: ${css}`, res.err); continue; }
      worst = Math.max(worst, res.bad);
      check(res.bad <= 4 && (res.ink > 0 || /60% 60%/.test(css)), `outline = Chromium clip: ${css} @ ${W}x${H}`, `${res.bad} pixels differ, ${res.ink} clipped-in`);
    }
    console.log(`   worst case: ${worst} pixels differ`);

    // The real page: first visit shows a worked example and a result; editing the code updates the preview; errors
    // keep the text; a drag writes the line; undo works; nothing is requested from anywhere else.
    for (const vp of [{width: 1280, height: 800}, {width: 390, height: 844, isMobile: true, hasTouch: true}]) {
      const c2 = await browser.newContext({viewport: {width: vp.width, height: vp.height}, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch});
      const p = await c2.newPage();
      const errs = [], foreign = [];
      p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      p.on('request', r => { const u = new URL(r.url()); if (u.port !== String(port) && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) foreign.push(r.url()); });
      await p.addInitScript(() => { try { localStorage.setItem('hideLogo', 'true'); } catch (e) {} });
      await p.goto(`http://localhost:${port}/tools/css_clip_path_generator.html`);
      await p.waitForTimeout(300);
      const tag = vp.width < 500 ? 'phone' : 'desktop';
      const first = await p.evaluate(() => ({code: document.getElementById('code').value, clip: getComputedStyle(document.getElementById('stage')).clipPath,
        handles: document.querySelectorAll('.h.vertex').length, copyTop: document.getElementById('copy').getBoundingClientRect().bottom, vh: innerHeight}));
      check(/^clip-path: polygon\(/.test(first.code) && first.handles >= 3, `${tag}: first visit shows a worked example`, JSON.stringify(first));
      check(first.copyTop <= first.vh, `${tag}: Copy is on screen without scrolling`, `${first.copyTop} > ${first.vh}`);
      await p.fill('#code', 'clip-path: circle(30% at 25% 50%);');
      let clip = await p.evaluate(() => getComputedStyle(document.getElementById('stage')).clipPath);
      eq(clip, 'circle(30% at 25% 50%)', `${tag}: the preview applies the typed value`);
      await p.fill('#code', 'clip-path: circle(30% at 25% 50%;');
      const st = await p.evaluate(() => ({msg: document.getElementById('msg').textContent, clip: getComputedStyle(document.getElementById('stage')).clipPath,
        code: document.getElementById('code').value, copy: document.getElementById('copy').disabled}));
      check(/missing/.test(st.msg) && st.clip === 'circle(30% at 25% 50%)' && st.code.endsWith('50%;') && st.copy, `${tag}: an error keeps the text and the last good preview`, JSON.stringify(st));
      await p.reload(); await p.waitForTimeout(200);
      eq(await p.inputValue('#code'), 'clip-path: circle(30% at 25% 50%;', `${tag}: unfinished text survives a reload`);
      await p.click('.pre[aria-label="Triangle"]');
      eq(await p.inputValue('#code'), 'clip-path: polygon(50% 0%, 100% 100%, 0% 100%);', `${tag}: preset`);
      // drag the apex to the left edge
      const hb = await p.locator('.h[data-key="p0"]').boundingBox();
      const fb = await p.locator('#fitbox').boundingBox();
      await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down();
      await p.mouse.move(fb.x + fb.width * 0.25, fb.y + fb.height * 0.4, {steps: 6}); await p.mouse.up();
      const dragged = await p.inputValue('#code');
      eq(dragged, 'clip-path: polygon(25% 40%, 100% 100%, 0% 100%);', `${tag}: dragging writes the line`);
      clip = await p.evaluate(() => getComputedStyle(document.getElementById('stage')).clipPath);
      eq(clip, 'polygon(25% 40%, 100% 100%, 0% 100%)', `${tag}: and the preview is that line`);
      // drag a midpoint to add a point
      const mb = await p.locator('.h[data-key="m1"]').boundingBox();
      await p.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2); await p.mouse.down();
      await p.mouse.move(fb.x + fb.width * 0.5, fb.y + fb.height * 0.8, {steps: 4}); await p.mouse.up();
      eq(await p.inputValue('#code'), 'clip-path: polygon(25% 40%, 100% 100%, 50% 80%, 0% 100%);', `${tag}: dragging a midpoint adds a point`);
      await p.keyboard.press('Control+z');
      eq(await p.inputValue('#code'), dragged, `${tag}: undo`);
      await p.keyboard.press('Control+Shift+z');
      eq((await p.inputValue('#code')).includes('50% 80%'), true, `${tag}: redo`);
      // keyboard: focus point 1 and nudge it
      await p.focus('.h[data-key="p0"]'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Shift+ArrowDown');
      eq(await p.inputValue('#code'), 'clip-path: polygon(26% 50%, 100% 100%, 50% 80%, 0% 100%);', `${tag}: arrow keys move the focused point`);
      await p.keyboard.press('Delete');
      eq(await p.inputValue('#code'), 'clip-path: polygon(100% 100%, 50% 80%, 0% 100%);', `${tag}: Delete removes it`);
      // units
      await p.click('#more summary');
      await p.click('#units button[data-unit="px"]');
      eq(await p.inputValue('#code'), 'clip-path: polygon(600px 400px, 300px 320px, 0 400px);', `${tag}: switch to px`);
      // element size changes px shapes not at all, and is validated
      await p.fill('#bw', '30x'); check(await p.evaluate(() => document.getElementById('bw').classList.contains('bad')), `${tag}: bad width is flagged`);
      await p.fill('#bw', '800,0');
      eq(await p.evaluate(() => document.getElementById('stage').style.width), '800px', `${tag}: decimal comma width`);
      // a huge paste: no handles, still a preview, page stays responsive
      const big = 'polygon(' + Array.from({length: 5000}, (_, i) => { const a = i / 5000 * 6.2832; return `${(50 + 50 * Math.cos(a)).toFixed(2)}% ${(50 + 50 * Math.sin(a)).toFixed(2)}%`; }).join(', ') + ')';
      const t0 = Date.now();
      await p.evaluate(v => { const c = document.getElementById('code'); c.value = v; c.dispatchEvent(new Event('input')); }, big);
      const hb2 = await p.evaluate(() => ({n: document.querySelectorAll('.h').length, info: document.getElementById('selinfo').textContent}));
      check(hb2.n === 0 && /too many to drag/.test(hb2.info) && Date.now() - t0 < 1500, `${tag}: 5000 points render as text only, quickly`, JSON.stringify(hb2) + ' ' + (Date.now() - t0) + 'ms');
      eq(errs, [], `${tag}: no console errors`);
      eq(foreign, [], `${tag}: no request leaves the page`);
      await c2.close();
    }
    await browser.close();
    srv.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
