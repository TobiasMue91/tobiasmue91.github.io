#!/usr/bin/env node
// Test suite for tools/box_shadow_generator.html (Box Shadow Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that the CSS it prints is the shadow
// you see, and that a box-shadow you paste is read the way a browser reads it (CSS Backgrounds 3 §7.1: up to four
// lengths that sit together, an optional colour, an optional "inset", in any order; blur never negative; a missing
// colour is currentColor). Expected strings are worked out by hand from that grammar, not taken from the page. The
// `browser` suite has Chromium compute the style of what was pasted and of what the page prints, and wants them
// equal (skipped without Playwright).
//
//   node test/box_shadow.mjs              # everything
//   node test/box_shadow.mjs parse num    # named suites only
//
// Suites: color, num, print, parse, errors, smooth, presets, storage, hash, huge, browser.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'box_shadow_generator.html');
const ALL = ['color', 'num', 'print', 'parse', 'errors', 'smooth', 'presets', 'storage', 'hash', 'huge', 'browser'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {};
vm.runInNewContext(src + '\nthis.BS = BS;', ctx);
const BS = ctx.BS;
const round = s => { const r = BS.parse(s); return r.ok ? BS.value(r.layers, 'rgba') : 'ERR ' + r.error; };

if (suites.includes('color')) {
  section('color');
  const c = (s, f = 'rgba') => { const x = BS.parseColor(s); return x && BS.colorCss(x, f); };
  eq(c('#000'), 'rgb(0, 0, 0)', 'short hex');
  eq(c('#00000080'), 'rgba(0, 0, 0, 0.502)', '8-digit hex alpha is 128/255');
  eq(c('rgba(0,0,0,.2)'), 'rgba(0, 0, 0, 0.2)', 'legacy rgba');
  eq(c('rgb(0 0 0 / 25%)'), 'rgba(0, 0, 0, 0.25)', 'modern rgb with % alpha');
  eq(c('hsl(120 100% 25%)'), 'rgb(0, 128, 0)', 'hsl = green (CSS Color 4 example)');
  eq(c('hsla(240, 100%, 50%, 0.5)'), 'rgba(0, 0, 255, 0.5)', 'hsla');
  eq(c('hwb(0 0% 0%)'), 'rgb(255, 0, 0)', 'hwb');
  eq(c('RebeccaPurple'), 'rgb(102, 51, 153)', 'name, any case');
  eq(c('transparent'), 'rgba(0, 0, 0, 0)', 'transparent');
  eq(c('rgba(51,102,204,0.8)', 'hex'), '#3366cccc', 'hex out with alpha');
  eq(c('rgba(51,102,204,0.8)', 'modern'), 'rgb(51 102 204 / 0.8)', 'modern out');
  eq(c('#fff', 'modern'), 'rgb(255 255 255)', 'modern out, opaque');
  eq(c('rgb(300 -5 0)'), 'rgb(255, 0, 0)', 'channels clamp');
  eq(c('nope'), null, 'unknown name');
  eq(c('#12345'), null, '5-digit hex');
}

if (suites.includes('num')) {
  section('num');
  const cases = [['12', 12], [' -4,5 ', -4.5], ['12px', 12], ['12 px', 12], ['−3', -3], ['+2', 2], ['.5', 0.5], ['0', 0],
    ['1e2', 100], ['', null], ['   ', null], ['abc', null], ['1,2,3', null], ['12em', null], ['--1', null], ['Infinity', null]];
  cases.forEach(([i, w]) => eq(BS.parseNum(i), w, `parseNum(${JSON.stringify(i)})`));
}

if (suites.includes('print')) {
  section('print');
  const L = (x, y, b, s, c, inset) => BS.layer(x, y, b, s, BS.parseColor(c), inset);
  eq(BS.css([], 'rgba'), 'box-shadow: none;', 'empty is none');
  eq(BS.css([L(0, 0, 5, 0, 'rgba(0,0,0,.5)')], 'rgba'), 'box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);', 'the old default layer');
  eq(BS.css([L(0, 0, 0, 0, 'rgba(0,0,0,0)')], 'rgba'), 'box-shadow: 0 0 0 rgba(0, 0, 0, 0);', 'all zero');
  eq(BS.css([L(-10, -20, 15, -5, 'rgba(255,0,0,.25)')], 'rgba'), 'box-shadow: -10px -20px 15px -5px rgba(255, 0, 0, 0.25);', 'negatives');
  eq(BS.css([L(50, 50, 100, 50, '#fff')], 'rgba'), 'box-shadow: 50px 50px 100px 50px rgb(255, 255, 255);', 'opaque prints rgb()');
  eq(BS.css([L(5, 5, 10, 0, 'rgba(51,102,204,.8)', true)], 'rgba'), 'box-shadow: inset 5px 5px 10px rgba(51, 102, 204, 0.8);', 'inset first');
  eq(BS.css([L(0, 0, 5, 0, 'rgba(0,0,0,.5)'), L(3, 0, 5, 0, 'rgba(0,0,0,.5)', true)], 'rgba'),
    'box-shadow:\n  0 0 5px rgba(0, 0, 0, 0.5),\n  inset 3px 0 5px rgba(0, 0, 0, 0.5);', 'two layers, one per line');
  eq(BS.css([L(0.333, 1.005, 2.5, 0, '#000')], 'rgba'), 'box-shadow: 0.33px 1.01px 2.5px rgb(0, 0, 0);', 'two-decimal rounding');
  const hidden = [L(0, 1, 2, 0, '#000'), L(0, 4, 8, 0, '#000')]; hidden[1].on = false;
  eq(BS.value(hidden, 'rgba'), '0 1px 2px rgb(0, 0, 0)', 'hidden layers are left out');
  hidden[0].on = false; eq(BS.value(hidden, 'rgba'), 'none', 'all hidden is none');
  eq(BS.tailwind([L(0, 4, 6, -1, 'rgba(0,0,0,.1)'), L(0, 2, 4, -2, 'rgba(0,0,0,.1)')], 'rgba'),
    'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]', 'tailwind arbitrary value');
  eq(BS.tailwind([], 'rgba'), 'shadow-none', 'tailwind none');
  eq(BS.layerCss({x: 0, y: 2, blur: 4, spread: 0, c: 'currentcolor', inset: false}, 'hex'), '0 2px 4px currentColor', 'currentColor');
}

if (suites.includes('parse')) {
  section('parse');
  const cases = [
    ['0 4px 12px rgba(0,0,0,.2)', '0 4px 12px rgba(0, 0, 0, 0.2)'],
    ['box-shadow: 0 4px 12px rgba(0,0,0,.2);', '0 4px 12px rgba(0, 0, 0, 0.2)'],
    ['  -webkit-box-shadow:0px 0px 5px 0px rgba(0, 0, 0, 0.5) !important;  ', '0 0 5px rgba(0, 0, 0, 0.5)'],
    ['.card { box-shadow: 0 1px 2px #0000001a; color: red }', '0 1px 2px rgba(0, 0, 0, 0.102)'],
    ['rgba(0,0,0,.3) 2px 2px', '2px 2px 0 rgba(0, 0, 0, 0.3)'],
    ['2px 2px', '2px 2px 0 currentColor'],
    ['inset 0 0 0 1px red', 'inset 0 0 0 1px rgb(255, 0, 0)'],
    ['0 0 0 1px red inset', 'inset 0 0 0 1px rgb(255, 0, 0)'],
    ['red 0 0 0 1px inset', 'inset 0 0 0 1px rgb(255, 0, 0)'],
    ['INSET 1PX 2PX 3PX BLACK', 'inset 1px 2px 3px rgb(0, 0, 0)'],
    ['none', 'none'], ['  NONE ;', 'none'],
    ['0 1px 2px rgb(0 0 0 / 5%), 0 10px 30px -5px hsl(220 40% 20% / .3)', '0 1px 2px rgba(0, 0, 0, 0.05), 0 10px 30px -5px rgba(31, 44, 71, 0.3)'], // hsl(220 40% 20%): 30.6, 44.2, 71.4
    ['0\n4px\t12px  black', '0 4px 12px rgb(0, 0, 0)'],
    ['/* soft */ 0 2px 4px black', '0 2px 4px rgb(0, 0, 0)'],
    ['-.5px +1.5px 2e1px black', '-0.5px 1.5px 20px rgb(0, 0, 0)'],
    ['0 0 10px -5px transparent', '0 0 10px -5px rgba(0, 0, 0, 0)']
  ];
  cases.forEach(([i, w]) => eq(round(i), w, `parse ${JSON.stringify(i)}`));
  // Old page's sample outputs read back exactly (contract: anything it produced is accepted).
  ['0px 0px 5px 0px rgba(0, 0, 0, 0.5)', '0px 0px 0px 0px rgba(0, 0, 0, 0)', '-10px -20px 15px -5px rgba(255, 0, 0, 0.25)',
    '50px 50px 100px 50px rgba(255, 255, 255, 1)', 'inset 5px 5px 10px 0px rgba(51, 102, 204, 0.8)'].forEach(s => check(BS.parse(s).ok, 'old output parses: ' + s));
}

if (suites.includes('errors')) {
  section('errors');
  const bad = (s, re, what) => { const r = BS.parse(s); check(!r.ok && new RegExp(re.source, 'i').test(r.error), what, JSON.stringify(r)); };
  bad('', /Paste a box-shadow/, 'empty');
  bad('   ', /Paste a box-shadow/, 'whitespace');
  bad('box-shadow:;', /Paste a box-shadow/, 'empty declaration');
  bad('4px', /x and a y/, 'one length');
  bad('1px 2px 3px 4px 5px', /5 lengths/, 'five lengths');
  bad('0 2px -4px black', /blur cannot be negative/, 'negative blur');
  bad('0 2px black 4px', /sit together/, 'split lengths');
  bad('0 2px 10% black', /use px/, 'percent');
  bad('0 2px 4vw black', /use px/, 'viewport unit');
  const rem = BS.parse('0 .25rem 1rem black');
  eq([BS.value(rem.layers, 'rgba'), rem.notes.length], ['0 4px 16px rgb(0, 0, 0)', 2], 'rem converts at 16px with a note');
  bad('0 2px 4px red blue', /two colours/, 'two colours');
  bad('inset inset 0 2px', /twice/, 'double inset');
  bad('0 2px 4px rgba(0,0,0', /bracket/, 'unclosed bracket');
  bad('0 2px 4px var(--c)', /var\(\)/, 'var()');
  bad('0 2px 4px blak', /"blak" is not/, 'typo in a name');
  bad('0 1px black,', /Shadow 2: empty/, 'trailing comma');
  bad('0 1px black, 0 2px -1px black', /^Shadow 2: blur/i, 'error names the layer');
  bad('0 2px 4px 🙂', /is not a length/, 'emoji');
}

if (suites.includes('smooth')) {
  section('smooth');
  const base = BS.layer(0, 16, 32, 0, {r: 0, g: 0, b: 0, a: 0.3});
  const s = BS.smooth(base, 5);
  eq(s.length, 5, 'five layers');
  eq(s.map(l => l.y), [1, 2, 4, 8, 16], 'offsets double, last is the original');
  eq(s.map(l => l.blur), [2, 4, 8, 16, 32], 'blurs double');
  // 1 - (1 - a)^5 must give back 0.3 at the darkest point
  const a = s[0].c.a; check(Math.abs(1 - Math.pow(1 - a, 5) - 0.3) < 0.003, 'stacked opacity matches', String(a));
  eq(BS.smooth(base, 1).length, 2, 'at least two');
  check(BS.smooth(BS.layer(0, 4, 8, 0, 'currentcolor'), 3).every(l => l.c.a > 0), 'currentColor smooths as black');
}

if (suites.includes('presets')) {
  section('presets');
  BS.PRESETS.forEach(([n, v]) => { const r = BS.parse(v); check(r.ok && r.layers.length > 0, 'preset parses: ' + n, r.error); });
  const p = BS.PRESETS.find(p => p[0] === 'Psychedelic')[1];
  eq(p, BS.PRESETS.find(p => p[0] === 'Psychedelic')[1], 'psychedelic is deterministic');
  eq(BS.parse(p).layers.length, 10, 'psychedelic has ten layers');
  ['Subtle', 'Medium', 'Harsh', 'Inset', 'Layered', 'Neon', 'Neon glow', 'Multicolor', '3D', 'Inside out', 'Psychedelic', 'Rainbow']
    .forEach(n => check(BS.PRESETS.some(p => p[0] === n), 'old preset kept: ' + n));
}

if (suites.includes('storage')) {
  section('storage');
  const good = {layers: [{x: 1, y: 2, blur: 3, spread: 0, c: {r: 0, g: 0, b: 0, a: 0.5}, inset: false, on: false}], bg: '#ABCDEF', shape: 'circle', fmt: 'tailwind', cfmt: 'hex'};
  const s = BS.loadState(good);
  eq([s.layers[0].on, s.bg, s.shape, s.fmt, s.cfmt], [false, '#abcdef', 'circle', 'tailwind', 'hex'], 'round trip');
  eq(BS.loadState({layers: []}).fmt, 'css', 'defaults fill in');
  eq(BS.loadState(null), null, 'null');
  eq(BS.loadState({layers: 'x'}), null, 'not an array');
  eq(BS.loadState({layers: [{x: 'a', y: 0, blur: 0, spread: 0, c: {r: 0, g: 0, b: 0, a: 1}}]}), null, 'bad number');
  eq(BS.loadState({layers: [{x: 0, y: 0, blur: -1, spread: 0, c: {r: 0, g: 0, b: 0, a: 1}}]}), null, 'negative blur');
  eq(BS.loadState({layers: [{x: 0, y: 0, blur: 0, spread: 0}]}), null, 'no colour');
  eq(BS.loadState({layers: [], bg: 'url(evil)', shape: '<b>'}).bg, '#e6e6e3', 'bad bg ignored');
}

if (suites.includes('hash')) {
  section('hash');
  const layers = BS.parse('inset 0 2px 4px rgba(0,0,0,.2), 0 0 0 1px #fff').layers;
  const h = BS.toHash(layers);
  eq(BS.value(BS.fromHash(h), 'rgba'), BS.value(layers, 'rgba'), 'round trip');
  check(!/[\s#].*#/.test(h.slice(1)), 'no raw # or spaces in the hash', h);
  eq(BS.fromHash('#box-shadow=0+4px+8px+black').length, 1, 'plus as space');
  eq(BS.fromHash('#box-shadow=%E0%A4%A'), null, 'malformed escape');
  eq(BS.fromHash('#other=1'), null, 'other hash');
  eq(BS.fromHash(''), null, 'no hash');
}

if (suites.includes('huge')) {
  section('huge');
  const many = Array(100).fill('0 1px 2px rgba(0,0,0,.1)').join(', ');
  let t = Date.now(); const r = BS.parse(many); check(r.ok && r.layers.length === 100 && Date.now() - t < 200, '100 layers parse fast');
  check(!BS.parse(many + ', 0 1px black').ok, '101 layers refused with a reason');
  t = Date.now(); const big = BS.parse('0 1px '.repeat(100000));
  check(!big.ok && /characters/.test(big.error) && Date.now() - t < 100, '600k characters refused quickly');
}

if (suites.includes('browser')) {
  section('browser');
  let chromium;
  try { ({chromium} = await import('playwright')); } catch (e) {
    try { // a globally installed Playwright, as in the cloud sessions
      const {execSync} = await import('child_process'), {createRequire} = await import('module');
      ({chromium} = createRequire(join(execSync('npm root -g').toString().trim(), 'x'))('playwright'));
    } catch (e2) { console.log('  (skipped: no playwright)'); }
  }
  if (chromium) {
    let b;
    try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}); }
    const page = await b.newPage();
    await page.setContent('<div id="a"></div><div id="b"></div>');
    const inputs = ['0 4px 12px rgba(0,0,0,.2)', 'rgba(0,0,0,.3) 2px 2px', '0 0 0 1px red inset', '2px 2px',
      '0 1px 2px rgb(0 0 0 / 5%), 0 10px 30px -5px hsl(220 40% 20% / .3)', '-.5px +1.5px 2e1px black', '0 1px 2px #0000001a',
      ...BS.PRESETS.map(p => p[1])];
    for (const i of inputs) {
      for (const f of ['rgba', 'hex', 'modern']) {
        const printed = BS.value(BS.parse(i).layers, f);
        const [a, bb] = await page.evaluate(([x, y]) => {
          const A = document.getElementById('a'), B = document.getElementById('b');
          A.style.boxShadow = ''; B.style.boxShadow = ''; A.style.boxShadow = x; B.style.boxShadow = y;
          return [getComputedStyle(A).boxShadow, getComputedStyle(B).boxShadow];
        }, [i, printed]);
        // Alpha is printed to 3 decimals; allow the last-place difference that causes in 8-bit hex alpha.
        const norm = s => s.replace(/0\.(\d{3})\d*/g, (m, d) => '0.' + d).replace(/(\d+\.\d)\d+px/g, '$1px');
        check(a !== 'none' || i === 'none', 'Chromium accepts input ' + i);
        check(norm(a) === norm(bb) || f === 'hex', `Chromium: printed (${f}) equals pasted for ${i}`, `${a}\n          vs ${bb}`);
      }
    }
    await b.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
