#!/usr/bin/env node
// Test suite for tools/online_color_palette_generator.html (Color Palette Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node. Expected values come from sources, not the page:
// CSS Color 4's OKLab/OKLCH examples and its hslToRgb, WCAG 2.2's contrast formula with known ratios, the
// Machado et al. 2009 matrices (white stays white, rows sum to one), and the CSS named-colour table.
// Also: what people paste, every palette type at every size, locks, exports, links and the old page's saves.
//
//   node test/color_palette.mjs                 # everything
//   node test/color_palette.mjs parse palettes  # named suites only
//
// Suites: spaces, contrast, parse, palettes, locks, export, saves.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'online_color_palette_generator.html');
const ALL = ['spaces', 'contrast', 'parse', 'palettes', 'locks', 'export', 'saves'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ±${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, URLSearchParams};
vm.runInNewContext(src, ctx);
const P = ctx.module.exports;
const HEX = /^#[0-9a-f]{6}$/;
let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rhex = () => P.rgbToHex([rand() * 255, rand() * 255, rand() * 255]);

if (suites.includes('spaces')) {
  section('spaces');
  // CSS Color 4, section 9 examples / Ottosson's reference values.
  const lab = P.rgbToOklab([255, 0, 0]);
  near(lab[0], 0.62796, 2e-4, 'red L'); near(lab[1], 0.22486, 2e-4, 'red a'); near(lab[2], 0.12585, 2e-4, 'red b');
  const w = P.rgbToOklab([255, 255, 255]); near(w[0], 1, 1e-4, 'white L'); near(Math.hypot(w[1], w[2]), 0, 1e-4, 'white is neutral');
  const g = P.hexToOklch('#00ff00'); near(g[0], 0.86644, 3e-4, 'lime L'); near(g[1], 0.29483, 3e-4, 'lime C'); near(g[2], 142.5, 0.1, 'lime H');
  let worst = 0;
  for (let i = 0; i < 3000; i++) { const h = rhex(), o = P.hexToOklch(h); if (P.oklchToHex(o[0], o[1], o[2]) !== h) worst++; }
  eq(worst, 0, 'every sRGB colour survives OKLCH and back');
  for (let i = 0; i < 300; i++) { const h = P.oklchToHex(rand(), rand() * 0.5, rand() * 720 - 360); check(HEX.test(h), 'out-of-gamut OKLCH maps to a real colour', h); }
  const m = P.hexToOklch(P.oklchToHex(0.7, 0.4, 30)); near(m[0], 0.7, 0.01, 'gamut mapping keeps lightness'); near(m[2], 30, 3, 'and hue');
  // CSS Color 4 hslToRgb examples.
  eq(P.rgbToHex(P.hslToRgb(0, 1, 0.5)), '#ff0000', 'hsl red'); eq(P.rgbToHex(P.hslToRgb(120, 1, 0.25)), '#008000', 'hsl green');
  eq(P.rgbToHex(P.hslToRgb(240, 1, 0.5)), '#0000ff', 'hsl blue'); eq(P.rgbToHex(P.hslToRgb(0, 0, 0.5)), '#808080', 'hsl grey');
  let bad = 0;
  for (let i = 0; i < 3000; i++) { const h = rhex(), x = P.rgbToHsl(P.hexToRgb(h)); if (P.rgbToHex(P.hslToRgb(x[0], x[1], x[2])) !== h) bad++; }
  eq(bad, 0, 'every colour survives HSL and back');
  eq(P.formats('#4361ee'), {hex: '#4361ee', rgb: 'rgb(67, 97, 238)', hsl: 'hsl(229, 83%, 60%)', oklch: P.formats('#4361ee').oklch}, 'formats');
  check(/^oklch\(\d+\.\d% 0\.\d{3} \d+\.\d\)$/.test(P.formats('#4361ee').oklch), 'oklch format');
}

if (suites.includes('contrast')) {
  section('contrast');
  near(P.contrast('#000000', '#ffffff'), 21, 1e-9, 'black on white is 21');
  near(P.contrast('#ffffff', '#ffffff'), 1, 1e-9, 'same colour is 1');
  near(P.contrast('#777777', '#ffffff'), 4.478, 1e-3, '#777 on white (WebAIM 4.47)');
  near(P.contrast('#767676', '#ffffff'), 4.542, 1e-3, '#767676 on white (WebAIM 4.54)');
  eq(P.ratioText(4.4999), '4.49', 'never rounded up into a pass'); eq(P.ratioText(21), '21.00', '21');
  eq([7, 6.99, 4.5, 4.49, 3, 2.99].map(P.grade), ['AAA', 'AA', 'AA', 'AA large', 'AA large', 'Fail'], 'grades at the boundaries');
  for (let i = 0; i < 500; i++) { const h = rhex(); check(P.contrast(h, P.inkFor(h)) >= 4.5, 'label ink always readable', h); }
  for (const t of ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia']) {
    eq(P.simulate('#ffffff', t), '#ffffff', t + ' keeps white'); eq(P.simulate('#000000', t), '#000000', t + ' keeps black');
    const gy = P.simulate('#808080', t), r = P.hexToRgb(gy); check(Math.max(...r) - Math.min(...r) <= 2, t + ' keeps grey grey', gy);
  }
  const pr = P.hexToRgb(P.simulate('#ff0000', 'protanopia')), dr = P.hexToRgb(P.simulate('#00ff00', 'deuteranopia'));
  check(Math.abs(pr[0] - pr[1]) < 40, 'red and green merge for protanopes', pr); check(Math.abs(dr[0] - dr[1]) < 40, 'and for deuteranopes', dr);
  const a = P.hexToRgb(P.simulate('#4361ee', 'achromatopsia')); check(a[0] === a[1] && a[1] === a[2], 'achromatopsia is grey');
}

if (suites.includes('parse')) {
  section('parse');
  const ok = {
    '#4361ee': '#4361ee', '4361ee': '#4361ee', '#4361EE': '#4361ee', '  #4361ee  ': '#4361ee', '#43e': '#4433ee', 'abc': '#aabbcc',
    '#4361eeff': '#4361ee', '#43e8': '#4433ee', '0x4361ee': '#4361ee', '"#4361ee";': '#4361ee', 'color: #4361ee;': '#4361ee',
    'background-color:#4361ee !important;': '#4361ee', 'rgb(67, 97, 238)': '#4361ee', 'rgb(67 97 238)': '#4361ee',
    'rgba(67,97,238,0.5)': '#4361ee', 'rgb(67 97 238 / 50%)': '#4361ee', 'RGB(67,97,238)': '#4361ee', '67, 97, 238': '#4361ee',
    'rgb(100%, 0%, 0%)': '#ff0000', 'hsl(229, 84%, 60%)': '#4363ef', 'hsl(229deg 84% 60%)': '#4363ef', 'hsl(0.5turn 100% 50%)': '#00ffff',
    'hsla(120, 100%, 25%, .3)': '#008000', 'teal': '#008080', 'Rebecca Purple': '#663399', 'TEAL': '#008080', 'light-blue': '#add8e6'
  };
  for (const [k, v] of Object.entries(ok)) { const r = P.parseColor(k); eq(r.ok ? r.hex : r.error, v, 'reads ' + JSON.stringify(k)); }
  eq(Object.keys(P.NAMES).length, 148, 'all 148 CSS named colours');
  const bad = ['', '   ', '#', '#ab', '#abcde', '#gggggg', '#43g1ee', 'rgb(300,1,2)', 'rgb(1,2)', 'rgb(1,2,3', 'hsl(10, 200%, 50%)', 'blurple', 'transparent',
    '#4361ee #ffffff', '日本', '🎨', 'x'.repeat(100000), null, undefined];
  for (const b of bad) { const r = P.parseColor(b); check(!r.ok && typeof r.error === 'string' && r.error.length < 90, 'refuses ' + JSON.stringify(String(b).slice(0, 20)), JSON.stringify(r)); }
  check(/“g”/.test(P.parseColor('#43g1ee').error), 'names the wrong hex digit');
  check(/300/.test(P.parseColor('rgb(300,1,2)').error), 'names the out-of-range number');
  check(P.parseColor('').empty && P.parseColor('  ').empty, 'empty is not an error to shout about');
  eq(['5', ' 7 ', '7 colours', '12,0', '3', '20'].map(s => P.parseCount(s).value), [5, 7, 7, 12, 3, 20], 'counts');
  eq(['2', '21', '-4', 'many', ''].map(s => P.parseCount(s).ok), [false, false, false, false, false], 'bad counts');
}

if (suites.includes('palettes')) {
  section('palettes');
  const bases = ['#4361ee', '#ff0000', '#000000', '#ffffff', '#808080', '#ffff00', '#0b3d2e', '#f2e8cf'];
  for (let i = 0; i < 30; i++) bases.push(rhex());
  for (const base of bases) for (const type of P.TYPES) for (const dist of type === 'designer' ? P.DISTS : ['balanced']) for (const count of [3, 4, 5, 7, 10, 13, 20]) {
    const g = P.generate({base, type, dist, count}), want = type === 'ui' ? 12 : type === 'brand' ? Math.min(count, 10) : count;
    const tag = `${type}/${dist} ${base} n=${count}`;
    if (g.colors.length !== want) check(false, tag + ' length', g.colors.length);
    if (!g.colors.every(c => HEX.test(c))) check(false, tag + ' valid hex', g.colors.join());
    if (g.baseAt >= 0 && g.colors[g.baseAt] !== base) check(false, tag + ' base marked where it is');
    const keeps = !(type === 'designer' && ['pastel', 'vivid', 'muted'].includes(dist)) && type !== 'accessible';
    if (keeps && g.colors.indexOf(base) < 0) check(false, tag + ' contains the base colour exactly', g.colors.join());
    if (g.roles && g.roles.length !== g.colors.length) check(false, tag + ' a role per colour');
    if (type === 'accessible') { if (P.contrast(g.colors[0], '#ffffff') < 4.5 || P.contrast(g.colors[1], '#ffffff') < 4.5) check(false, tag + ' primary and secondary pass on white');
      if (count >= 5 && (P.contrast(g.colors[2], g.colors[3]) < 4.5 || P.contrast(g.colors[4], g.colors[3]) < 4.5)) check(false, tag + ' text and muted text pass on background'); }
    eq(JSON.stringify(P.generate({base, type, dist, count})), JSON.stringify(g), tag + ' deterministic');
  }
  check(true, 'all types, sizes and bases');
  const mono = P.generate({base: '#4361ee', type: 'monochrome', count: 9}).colors.map(c => P.hexToOklch(c)[0]);
  check(mono.every((l, i) => !i || l < mono[i - 1]), 'tints & shades run light to dark', mono);
  const ui = P.generate({base: '#22aa44', type: 'ui', count: 5});
  near(P.hexToOklch(ui.colors[5])[2], 27, 8, 'error stays red on a green brand'); near(P.hexToOklch(ui.colors[3])[2], 150, 8, 'success stays green');
  check(P.generate({base: '#808080', type: 'triadic', count: 5}).grey, 'grey harmonies are flagged');
  check(!P.generate({base: '#808080', type: 'monochrome', count: 5}).grey, 'not for tints & shades');
  const yel = P.generate({base: '#ffff00', type: 'accessible', count: 5});
  check(P.hexToOklch(yel.colors[0])[0] < P.hexToOklch('#ffff00')[0], 'a light base is darkened to pass, not lightened');
  const sat = P.generate({base: '#4361ee', type: 'monochrome', count: 5, sat: -100}).colors;
  check(sat.every(c => P.hexToOklch(c)[1] < 0.01), 'saturation -100 is grey', sat);
  const spread = c => { const l = c.map(x => P.hexToOklch(x)[0]); return Math.max(...l) - Math.min(...l); };
  check(spread(P.generate({base: '#4361ee', type: 'analogous', count: 5, light: 100}).colors) >= spread(P.generate({base: '#4361ee', type: 'analogous', count: 5}).colors), 'lightness range widens');
  for (let i = 0; i < 200; i++) { const b = P.randomBase(rand); check(HEX.test(b), 'random base', b); }
}

if (suites.includes('locks')) {
  section('locks');
  const a = P.generate({base: '#4361ee', type: 'designer', count: 5}).colors, b = P.generate({base: '#ff0000', type: 'designer', count: 5}).colors;
  eq(P.mergeLocks(a, [false, true], b), [b[0], a[1], b[2], b[3], b[4]], 'a locked colour stays');
  eq(P.mergeLocks(a, [0, 0, 0, 0, 0, 0, 0, true], P.generate({base: '#ff0000', type: 'designer', count: 8}).colors)[7], P.generate({base: '#ff0000', type: 'designer', count: 8}).colors[7], 'a lock beyond the old palette has nothing to keep');
  eq(P.mergeLocks(a, [true, true, true], b.slice(0, 3)), a.slice(0, 3), 'shrinking keeps locks in range');
}

if (suites.includes('export')) {
  section('export');
  const c = ['#4361ee', '#899cf4', '#1334d2'];
  eq(P.exportText('css', c, null), ':root {\n  --color-1: #4361ee;\n  --color-2: #899cf4;\n  --color-3: #1334d2;\n}\n\n.bg-color-1 { background-color: #4361ee; }\n.text-color-1 { color: #4361ee; }\n.bg-color-2 { background-color: #899cf4; }\n.text-color-2 { color: #899cf4; }\n.bg-color-3 { background-color: #1334d2; }\n.text-color-3 { color: #1334d2; }\n', 'css: the old page\'s file');
  const br = P.generate({base: '#4361ee', type: 'brand', count: 7});
  const css = P.exportText('css', br.colors, br.roles);
  for (const v of ['--color-primary:', '--color-primary-light:', '--color-primary-dark:', '--color-secondary:', '--color-accent:']) check(css.includes(v), 'brand css has ' + v);
  const ui = P.generate({base: '#4361ee', type: 'ui', count: 5}), uc = P.exportText('css', ui.colors, ui.roles);
  for (const v of ['--color-success:', '--color-warning:', '--color-error:', '--color-info:']) check(uc.includes(v), 'ui css has ' + v);
  eq(P.exportText('scss', c, null), '$color-1: #4361ee;\n$color-2: #899cf4;\n$color-3: #1334d2;\n', 'scss');
  eq(JSON.parse(P.exportText('json', c, null)), c, 'json list'); eq(JSON.parse(P.exportText('json', ui.colors, ui.roles)).success, ui.colors[3], 'json roles');
  eq(P.exportText('tailwind', c, null), '@theme {\n  --color-palette-1: #4361ee;\n  --color-palette-2: #899cf4;\n  --color-palette-3: #1334d2;\n}\n', 'tailwind v4');
  eq(P.exportText('hex', c, null), '#4361ee\n#899cf4\n#1334d2\n', 'hex list');
  eq(P.shareQuery(c), '?colors=4361ee-899cf4-1334d2', 'share link: the old page\'s format');
  eq(P.readQuery('?colors=4361ee-899cf4-1334d2'), c, 'reads it back'); eq(P.readQuery('?colors=4361EE-abc'), ['#4361ee', '#aabbcc'], 'case, short hex');
  for (const q of ['', '?colors=', '?colors=zzzzzz', '?colors=' + Array(21).fill('ffffff').join('-'), '?colors=<script>', '?x=1']) eq(P.readQuery(q), null, 'refuses ' + q.slice(0, 30));
}

if (suites.includes('saves')) {
  section('saves');
  const old = JSON.stringify([{id: 1715500000000, name: 'Ocean', colors: ['#4361ee', '#899CF4', '#1334d2']}, {id: 2, name: '<img src=x onerror=alert(1)>', colors: ['#000000']}]);
  const s = P.readSaved(old);
  eq(s[0], {id: 1715500000000, name: 'Ocean', colors: ['#4361ee', '#899cf4', '#1334d2']}, 'old page\'s savedPalettes');
  eq(s[1].name, '<img src=x onerror=alert(1)>', 'a hostile name is kept as text (the page sets it with textContent)');
  for (const raw of ['{', 'null', '"x"', '{"a":1}', '[1,2,null,{"colors":"no"},{"colors":[]},{"colors":[5,"zz"]}]']) eq(P.readSaved(raw), [], 'survives ' + raw);
  eq(P.readSaved('[{"colors":["#fff"],"name":"  "}]')[0].name, 'Palette 1', 'blank names get one');
  eq(P.readSaved('[{"id":3,"colors":["#fff"]},{"id":3,"colors":["#000"]}]').map(p => p.id), [3, 4], 'duplicate ids are made unique');
  eq(P.readSaved(JSON.stringify([{name: 'x'.repeat(500), colors: Array(40).fill('#123456')}]))[0].colors.length, 20, 'clamped');
  const st = P.readState(JSON.stringify({base: '#4361EE', type: 'evil', count: 999, sat: '50', light: -1e9, colors: ['#123456'], locks: [1], roles: ['<b>']}));
  eq([st.base, st.type, st.count, st.sat, st.light, st.colors, st.locks], ['#4361ee', 'designer', 20, 50, -100, ['#123456'], [true]], 'state is clamped');
  for (const raw of ['', '{', '[]', '{"base":"nope"}']) eq(P.readState(raw), null, 'state survives ' + raw);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
