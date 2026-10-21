#!/usr/bin/env node
// Test suite for tools/favicon_generator.html (Favicon Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node. A favicon tool promises files that
// every browser and OS reads: the .ico is checked by decoding it with Pillow (an independent ICO
// reader), the .zip by Python's zipfile (CRC and structure), CRC-32 against its published check
// value. It also promises that the HTML names exactly the files the package contains, that colours
// people paste are understood or refused in plain words, and that non-square images are placed
// right. Needs python3 with Pillow for the `ico` and `zip` suites; no browser, no server.
//
//   node test/favicon_generator.mjs            # everything
//   node test/favicon_generator.mjs color fit  # named suites only
//
// Suites: crc, zip, ico, color, fit, text, migrate, svg.

import {readFileSync, writeFileSync, mkdtempSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {tmpdir} from 'os';
import {execFileSync} from 'child_process';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'favicon_generator.html');
const ALL = ['crc', 'zip', 'ico', 'color', 'fit', 'mark', 'text', 'migrate', 'svg'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, what) => check(Math.abs(got - want) < 1e-9, what, `got ${got}, want ${want}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, TextEncoder, Intl, Uint8Array, Uint32Array, DataView, ArrayBuffer, JSON};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;
const TMP = mkdtempSync(join(tmpdir(), 'favicon-'));
const py = code => execFileSync('python3', ['-c', code], {encoding: 'utf8'}).trim();

if (suites.includes('crc')) {
  section('crc');
  eq(C.crc32(C.utf8('123456789')), 0xCBF43926, 'CRC-32 check value of "123456789"');
  eq(C.crc32(new Uint8Array(0)), 0, 'empty input');
  eq(C.crc32(C.utf8('The quick brown fox jumps over the lazy dog')), 0x414FA339, 'quick brown fox');
}

if (suites.includes('zip')) {
  section('zip');
  const big = new Uint8Array(300000).map((_, i) => (i * 7919) & 255);
  const z = C.zip([{name: 'favicon.ico', data: C.utf8('ico')}, {name: 'größe ✓.txt', data: C.utf8('ü')}, {name: 'empty', data: new Uint8Array(0)}, {name: 'big.bin', data: big}], new Date(2026, 9, 21, 13, 37, 42));
  const f = join(TMP, 'a.zip'); writeFileSync(f, z);
  const out = JSON.parse(py(`import zipfile,json,hashlib;z=zipfile.ZipFile(${JSON.stringify(f)});print(json.dumps({'bad':z.testzip(),'names':z.namelist(),'u':z.read('größe ✓.txt').decode(),'big':hashlib.md5(z.read('big.bin')).hexdigest(),'t':z.getinfo('empty').date_time}))`));
  eq(out.bad, null, 'every CRC matches');
  eq(out.names, ['favicon.ico', 'größe ✓.txt', 'empty', 'big.bin'], 'names, in order, UTF-8');
  eq(out.u, 'ü', 'UTF-8 content');
  eq(out.big, py(`import hashlib;print(hashlib.md5(bytes([(i*7919)&255 for i in range(300000)])).hexdigest())`), '300 kB entry intact');
  eq(out.t, [2026, 10, 21, 13, 37, 42], 'DOS timestamp');
  const e = join(TMP, 'e.zip'); writeFileSync(e, C.zip([]));
  eq(py(`import zipfile;print(len(zipfile.ZipFile(${JSON.stringify(e)}).namelist()))`), '0', 'empty archive is valid');
}

if (suites.includes('ico')) {
  section('ico');
  // Each size: top-left red opaque, top-right fully transparent, bottom-left half-transparent green, rest blue.
  const mk = s => { const a = new Uint8Array(s * s * 4); for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const i = (y * s + x) * 4; let p = [0, 0, 255, 255]; if (x === 0 && y === 0) p = [255, 0, 0, 255]; if (x === s - 1 && y === 0) p = [0, 0, 0, 0]; if (x === 0 && y === s - 1) p = [0, 255, 0, 128]; a.set(p, i); } return {size: s, rgba: a}; };
  for (const sizes of [[16, 32, 48], [1], [7], [256]]) {
    const f = join(TMP, `t${sizes.join('-')}.ico`); writeFileSync(f, C.ico(sizes.map(mk)));
    const r = JSON.parse(py(`from PIL import Image;import json
im=Image.open(${JSON.stringify(f)});out={}
for s in im.info['sizes']:
  im.size=s;i=im.convert('RGBA');w=s[0]
  out[w]=[i.getpixel((0,0)),i.getpixel((w-1,0)),i.getpixel((0,w-1)),i.getpixel((w//2,w//2)) if w>2 else None]
print(json.dumps({'sizes':sorted(int(k) for k in out),'px':out}))`));
    eq(r.sizes, [...sizes].sort((a, b) => a - b), `sizes ${sizes} declared and readable`);
    for (const s of sizes) {
      const px = r.px[s];
      if (s === 1) { eq(px[0], [0, 255, 0, 128], '1 px: the single pixel keeps its partial alpha'); continue; }
      eq(px[0], [255, 0, 0, 255], `${s}px top-left is red (rows not flipped)`);
      eq(px[1][3], 0, `${s}px top-right is transparent`);
      eq(px[2], [0, 255, 0, 128], `${s}px bottom-left keeps partial alpha`);
      if (s > 2) eq(px[3], [0, 0, 255, 255], `${s}px centre is blue (BGR order right)`);
    }
  }
  const b = C.ico([mk(16)]); eq([b[0], b[1], b[2], b[3], b[4], b[5]], [0, 0, 1, 0, 1, 0], 'ICONDIR header: reserved 0, type 1, count 1');
  eq(b.length, 6 + 16 + 40 + 16 * 16 * 4 + 4 * 16, '16px entry size incl. padded AND mask');
}

if (suites.includes('color')) {
  section('color');
  const ok = {'#4361ee': '#4361ee', '#4361EE': '#4361ee', '4361ee': '#4361ee', '#fff': '#ffffff', 'FFF': '#ffffff', '  #abc  ': '#aabbcc',
    'rgb(67, 97, 238)': '#4361ee', 'rgb(67 97 238)': '#4361ee', 'rgba(0,0,0,0.5)': '#000000', 'rgb(255,255,255)': '#ffffff', 'White': '#ffffff', '#0a0b0c;': '#0a0b0c'};
  for (const [k, v] of Object.entries(ok)) eq(C.parseColor(k).hex, v, `accepts ${JSON.stringify(k)}`);
  for (const k of ['', '   ', '#ggg', '#12345', '#1234567', 'rgb(256,0,0)', 'blau', '#', null, 'rgb(1,2)', '＃fff'])
    check(!!C.parseColor(k).error, `refuses ${JSON.stringify(k)}`, JSON.stringify(C.parseColor(k)));
  check(/#4361ee/.test(C.parseColor('#ggg').error), 'error says what would be accepted');
}

if (suites.includes('fit')) {
  section('fit');
  let r = C.fitRect(1000, 500, 512, 0, 'contain'); eq([r.x, r.y, r.w, r.h], [0, 128, 512, 256], '2:1 contained: bands above and below');
  r = C.fitRect(1000, 500, 512, 0, 'cover'); eq([r.x, r.y, r.w, r.h], [-256, 0, 1024, 512], '2:1 covered: cropped left and right');
  r = C.fitRect(3000, 1000, 300, 0, 'cover', 0, 0.5, 1); eq([r.x, r.w], [0, 900], 'cover, left edge kept');
  r = C.fitRect(3000, 1000, 300, 0, 'cover', 1, 0.5, 1); eq([r.x, r.w], [-600, 900], 'cover, right edge kept');
  r = C.fitRect(3000, 1000, 300, 0, 'cover', 0, 0.5, 1.25); eq([r.w, r.h, r.y], [1125, 375, -37.5], 'zoom 1.25 from the left: just the red square of a banner');
  r = C.fitRect(3000, 1000, 300, 0, 'cover', -3, 9, 1); eq([r.x, r.y], [0, 0], 'position clamped to the image');
  r = C.fitRect(3000, 1000, 300, 0, 'contain', 0, 0, 3); eq([r.x, r.y, r.w], [0, 100, 300], 'contain ignores position and zoom');
  r = C.fitRect(500, 1000, 100, 0.1, 'contain'); near(r.w, 40, 'tall + 10% padding: width'); near(r.h, 80, 'height'); near(r.x, 30, 'x'); near(r.y, 10, 'y');
  r = C.fitRect(16, 16, 1024, 0, 'contain'); eq([r.w, r.h], [1024, 1024], 'tiny source scales up to fill');
  r = C.fitRect(1, 8000, 1024, 0.4, 'contain'); near(r.h, 204.8, 'extreme aspect at max padding');
  eq(C.fitRect(0, 100, 512, 0, 'contain'), null, 'zero width refused, no Infinity');
  eq(C.fitRect(NaN, 100, 512, 0, 'contain'), null, 'NaN refused');
  const g = C.fitGlyph({left: 10, right: 90, ascent: 140, descent: 0}, 200, 100, 0); near(g.size, 200 * 100 / 140, 'glyph limited by height');
  near(g.x, 50 - 40 * 100 / 140, 'glyph centred on its ink, not its advance'); near(g.y, 50 + 70 * 100 / 140, 'baseline puts ink centre in the middle');
  eq(C.fitGlyph({left: 0, right: 0, ascent: 0, descent: 0}, 200, 100, 0), null, 'blank glyph (space) draws nothing');
  eq(C.steps(1024, 16), [512, 256, 128, 64, 32, 16], 'halving steps to 16');
  eq(C.steps(1024, 512), [512], 'one step to 512');
  eq(C.steps(1024, 180), [512, 180], 'steps to 180 (under 3x is one step)');
}

if (suites.includes('mark')) {
  section('mark');
  const mask = (w, h, rects) => { const m = new Uint8Array(w * h); for (const [x0, y0, x1, y1] of rects) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * w + x] = 1; return m; };
  eq(C.findMark(mask(300, 100, [[10, 10, 90, 90]]), 300, 100), {x: 10, y: 10, w: 80, h: 80}, 'banner: lone square on the left');
  eq(C.findMark(mask(200, 80, [[4, 4, 76, 76], [88, 30, 190, 56]]), 200, 80), {x: 4, y: 4, w: 72, h: 72}, 'symbol + wordmark: the symbol');
  eq(C.findMark(mask(200, 80, [[10, 30, 60, 50], [70, 30, 190, 50]]), 200, 80), {x: 10, y: 30, w: 180, h: 20}, 'two flat words: no symbol, whole text');
  eq(C.findMark(mask(100, 300, [[20, 10, 80, 70], [10, 120, 90, 290]]), 100, 300), {x: 20, y: 10, w: 60, h: 60}, 'tall: symbol on top');
  eq(C.findMark(mask(100, 100, [[30, 30, 60, 50]]), 100, 100), {x: 30, y: 30, w: 30, h: 20}, 'square image: content box');
  eq(C.findMark(new Uint8Array(400), 20, 20), null, 'blank image: nothing found');
  eq(C.findMark(mask(300, 100, [[0, 0, 2, 2], [40, 0, 300, 100]]), 300, 100), {x: 0, y: 0, w: 300, h: 100}, 'speck before the content is not a symbol');
  let f = C.frame(3000, 1000, {x: 100, y: 100, w: 800, h: 800}, 0);
  near(f.zoom, 1.25, 'banner square: zoom'); near(f.fx, 100 / 2200, 'banner square: position');
  const r = C.fitRect(3000, 1000, 300, 0, 'cover', f.fx, f.fy, f.zoom); near(r.x + 100 * r.w / 3000, 0, 'square starts at the left edge'); near(r.y + 100 * r.h / 1000, 0, 'and at the top');
  f = C.frame(3000, 1000, {x: 1400, y: 0, w: 200, h: 1000}, 0); eq([f.zoom, f.fx], [1, 0.5], 'tall subject: no zoom, centred');
  f = C.frame(1000, 1000, {x: 0, y: 0, w: 2, h: 2}, 0); eq(f.zoom, 5, 'zoom capped at 5x');
}

if (suites.includes('text')) {
  section('text');
  eq(C.graphemes(''), 0, 'empty'); eq(C.graphemes('F'), 1, 'one letter'); eq(C.graphemes('👨‍👩‍👧'), 1, 'ZWJ family is one'); eq(C.graphemes('🇩🇪'), 1, 'flag is one'); eq(C.graphemes('é'), 1, 'combining accent is one');
  const s = C.snippet({theme: '#4361ee'});
  eq(s, '<link rel="icon" href="/favicon.ico" sizes="32x32">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">\n<meta name="theme-color" content="#4361ee">', 'snippet');
  check(!/theme-color/.test(C.snippet({})), 'no theme colour, no meta');
  check(/favicon\.svg/.test(C.snippet({svg: true})), 'svg link only with svg');
  for (const svg of [false, true]) {
    const named = [...C.snippet({svg, theme: '#000'}).matchAll(/href="\/([^"]+)"/g)].map(m => m[1]);
    const m = JSON.parse(C.manifest({name: 'x'}));
    const files = C.fileList({svg}).map(f => f[0]);
    for (const n of named.concat(m.icons.map(i => i.src.slice(1)))) check(files.includes(n), `svg=${svg}: ${n} is named and shipped`);
  }
  const m = JSON.parse(C.manifest({name: '  Acme Rocket Supplies  ', theme: '#123456', background: '#ffffff'}));
  eq([m.name, m.short_name, m.theme_color, m.display], ['Acme Rocket Supplies', 'Acme Rocket', '#123456', 'standalone'], 'manifest fields, short name cut at 12');
  check(!('name' in JSON.parse(C.manifest({name: '   '}))), 'blank name left out, not an empty string');
  eq(JSON.parse(C.manifest({name: '"<x>"'})).name, '"<x>"', 'quotes survive JSON');
  check(!/<x>/.test(C.snippet({theme: '"><x>'})), 'theme colour escaped in HTML');
}

if (suites.includes('migrate')) {
  section('migrate');
  const raw = JSON.stringify([{id: '1', name: '<img src=x onerror=alert(1)>', preview: 'data:image/png;base64,AAAA', state: '{}', created: '2025-01-01'}, {id: '2', preview: 'data:image/png;base64,BBBB'}, {id: '3', name: 'bad', preview: 'javascript:alert(1)'}, null]);
  eq(C.migrateSaved(raw), [{name: '<img src=x onerror=alert(1)>', preview: 'data:image/png;base64,AAAA'}, {name: 'Untitled Design', preview: 'data:image/png;base64,BBBB'}], 'keeps image previews, drops non-images');
  eq(C.migrateSaved(null), [], 'nothing saved'); eq(C.migrateSaved('{oops'), [], 'corrupt JSON'); eq(C.migrateSaved('{"a":1}'), [], 'not an array');
}

if (suites.includes('svg')) {
  section('svg');
  let r = C.sizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 12"><path/></svg>'); eq([r.width, r.height], [1024, 512], 'viewBox only: sized from it');
  check(/^<svg width="1024" height="512"/.test(r.text), 'width and height written', r.text);
  r = C.sizeSvg('<?xml version="1.0"?>\n<svg width="64px" height="32" viewBox="0 0 2 1"></svg>'); eq([r.width, r.height], [64, 32], 'explicit size kept');
  r = C.sizeSvg('<svg width="100%" viewBox="0,0,10,20"></svg>'); eq([r.width, r.height], [512, 1024], 'percent width ignored, viewBox commas');
  r = C.sizeSvg('<svg></svg>'); eq([r.width, r.height], [1024, 1024], 'no size at all: square fallback');
  eq(C.sizeSvg('hello'), null, 'not an SVG');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
