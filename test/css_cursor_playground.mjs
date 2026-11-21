#!/usr/bin/env node
// Test suite for tools/css_cursor_playground.html (CSS Cursor Types).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that the CSS it prints is valid and that a
// cursor value someone pastes is judged the way a browser judges it. The grammar is CSS Basic User Interface Module
// Level 4, §5.1: [ [ <url> | <url-set> ] [ <x> <y> ]? ]#? followed by exactly one keyword, of which there are 36. Every
// image needs a comma after it, <x> <y> are unit-less numbers and a hotspot outside the image is clamped to it. Expected
// strings are worked out from that text, not taken from the page. The `browser` suite has Chromium's CSS.supports judge
// every string the core accepts or rejects (skipped without Playwright).
//
//   node test/css_cursor_playground.mjs              # everything
//   node test/css_cursor_playground.mjs parse errors # named suites only
//
// Suites: keywords, parse, errors, fix, search, hotspot, image, storage, contract, huge, browser.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'css_cursor_playground.html');
const ALL = ['keywords', 'parse', 'errors', 'fix', 'search', 'hotspot', 'image', 'storage', 'contract', 'huge', 'browser'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {};
vm.runInNewContext(src + '\nthis.CUR = CUR;', ctx);
const CUR = ctx.CUR;
const css = s => { const r = CUR.parse(s); return r.ok ? r.css : 'ERR ' + r.error; };
const ok = s => CUR.parse(s).ok;
const err = s => { const r = CUR.parse(s); return r.ok ? null : r.error; };

// The 36 keywords of CSS UI 4 §5.1, copied from the spec's grammar.
const SPEC = ('auto default none context-menu help pointer progress wait cell crosshair text vertical-text alias copy move ' +
  'no-drop not-allowed grab grabbing e-resize n-resize ne-resize nw-resize s-resize se-resize sw-resize w-resize ' +
  'ew-resize ns-resize nesw-resize nwse-resize col-resize row-resize all-scroll zoom-in zoom-out').split(' ');

if (suites.includes('keywords')) {
  section('keywords');
  eq(CUR.KEYWORDS.length, 36, '36 keywords');
  eq([...CUR.KEYWORDS.map(o => o.k)].sort(), [...SPEC].sort(), 'exactly the spec list');
  eq(new Set(CUR.KEYWORDS.map(o => o.k)).size, 36, 'no duplicates (the old fallback list had auto, default, pointer twice)');
  const groups = new Set(CUR.GROUPS.map(g => g[0]));
  check(CUR.KEYWORDS.every(o => groups.has(o.group)), 'every keyword in a known group');
  check(CUR.KEYWORDS.every(o => o.use && o.use.length > 10 && /\.$/.test(o.use)), 'every keyword has a one-line use');
  for (const k of SPEC) eq(css(k), `cursor: ${k};`, k);
}

if (suites.includes('parse')) {
  section('parse');
  eq(css('pointer'), 'cursor: pointer;', 'bare keyword');
  eq(css('  POINTER  '), 'cursor: pointer;', 'case and spaces');
  eq(css('cursor: grab;'), 'cursor: grab;', 'a whole declaration');
  eq(css('Cursor : grab ;;'), 'cursor: grab;', 'declaration, odd spacing, two semicolons');
  eq(css('grab !important'), 'cursor: grab !important;', '!important kept');
  eq(css('grab ! IMPORTANT;'), 'cursor: grab !important;', '! important spaced, upper case');
  eq(css('/* hand */ pointer'), 'cursor: pointer;', 'comment removed');
  eq(css('pointer /* unclosed'), 'cursor: pointer;', 'unclosed comment at the end');
  eq(css('url(a.png), auto'), 'cursor: url("a.png"), auto;', 'image without hotspot');
  eq(css('url(a.png) 4 12, crosshair'), 'cursor: url("a.png") 4 12, crosshair;', 'image with hotspot');
  eq(css("url('a.png') 4 12, crosshair"), 'cursor: url("a.png") 4 12, crosshair;', 'single quotes');
  eq(css('URL( a.png ) 01 2,POINTER'), 'cursor: url("a.png") 1 2, pointer;', 'upper case URL, inner spaces, leading zero');
  eq(css('url(a.png)1 1,auto'), 'cursor: url("a.png") 1 1, auto;', 'no spaces at all');
  eq(css('url(a.png) 1e1 .5, auto'), 'cursor: url("a.png") 10 0.5, auto;', 'exponent and leading dot');
  eq(css('url(a.png) +3 -2, auto'), 'cursor: url("a.png") 3 -2, auto;', 'signs: valid CSS, the browser clamps');
  eq(css('url(a.png) -0 0, auto'), 'cursor: url("a.png") 0 0, auto;', 'no -0');
  eq(css('url(a.png) calc(1 + 2) 2, auto'), 'cursor: url("a.png") calc(1 + 2) 2, auto;', 'calc() kept as written');
  eq(css('url(a.png) 1 2, url(b.cur), pointer'), 'cursor: url("a.png") 1 2, url("b.cur"), pointer;', 'two images');
  eq(css('url("a\\"b.png"), auto'), 'cursor: url("a\\"b.png"), auto;', 'escaped quote stays escaped');
  eq(css('url(a\\ b.png), auto'), 'cursor: url("a b.png"), auto;', 'escaped space');
  eq(css('url("a\\\\b.png"), auto'), 'cursor: url("a\\\\b.png"), auto;', 'backslash');
  eq(css('url("\\41 .png"), auto'), 'cursor: url("A.png"), auto;', 'hex escape');
  eq(css('url("curseur-é.png") 0 0, auto'), 'cursor: url("curseur-é.png") 0 0, auto;', 'non-ASCII file name');
  eq(css('url(data:image/png;base64,AAA=) 1 2, auto'), 'cursor: url("data:image/png;base64,AAA="), auto;'.replace('"), auto', '") 1 2, auto'), 'data URI');
  eq(css('url() , auto'), 'cursor: url(""), auto;', 'empty url() is valid syntax');
  eq(css('image-set(url(a.png) 1x, url(b.png) 2x) 3 3, auto'), 'cursor: image-set(url(a.png) 1x, url(b.png) 2x) 3 3, auto;', 'image-set kept verbatim');
  eq(css('-webkit-image-set(url(a.png) 1x), auto'), 'cursor: -webkit-image-set(url(a.png) 1x), auto;', '-webkit-image-set');
  eq(css('url(a.png) 1 2, none'), 'cursor: url("a.png") 1 2, none;', 'none as fallback');
  const pre = CUR.parse('-webkit-grab');
  check(pre.ok && /plain grab/i.test(pre.warn), 'prefixed: valid with a warning', JSON.stringify(pre));
  check(ok('url(a.png), -webkit-zoom-in'), 'prefixed as fallback');
  for (const g of ['inherit', 'initial', 'unset', 'revert', 'revert-layer']) {
    const r = CUR.parse(g);
    check(r.ok && r.warn, g + ' alone is valid, with a note');
  }
  const r = CUR.parse('url(a.png) 4 12, crosshair');
  eq(r.images.length, 1, 'images read');
  eq([r.images[0].url, r.images[0].x, r.images[0].y, r.keyword], ['a.png', '4', '12', 'crosshair'], 'image fields');
}

if (suites.includes('errors')) {
  section('errors');
  const has = (s, re, what) => { const e = err(s); check(e && re.test(e), what, `got ${JSON.stringify(e)}`); };
  check(CUR.parse('').empty && CUR.parse('   ').empty && CUR.parse('cursor: ;').empty, 'empty, spaces, empty declaration');
  has('url(a.png)', /needs a keyword after it.*url\(a\.png\), auto/, 'image without keyword (the classic mistake)');
  has('url(a.png) 4 4', /url\(a\.png\) 4 4, auto/, 'image and hotspot without keyword');
  has('url(a.png) pointer', /comma between the image and pointer: url\(a\.png\), pointer/, 'missing comma');
  has('url(a.png) 4 4 pointer', /url\(a\.png\) 4 4, pointer/, 'missing comma after hotspot');
  has('url(a.png) 4 4 hand', /comma between the image and pointer/, 'missing comma and wrong keyword');
  has('pointer, url(a.png)', /goes last/, 'keyword first');
  has('auto, pointer', /Only one keyword/, 'two keywords');
  has('url(a.png) 4, auto', /two numbers/, 'one hotspot number');
  has('url(a.png) 1 2 3, auto', /not 3/, 'three hotspot numbers');
  has('url(a.png) 4px 4px, auto', /no unit: write 4 4, not 4px 4px/, 'units on the hotspot');
  has('url(a.png) 4,5 6, auto', /./, 'decimal comma in a hotspot is an error, not a silent misread');
  has('url(a.png) top left, auto', /not a number/, 'words as hotspot');
  has('"a.png", auto', /Wrap the image address in url/, 'bare string');
  has('src("a.png"), auto', /src\(\)/, 'src() not supported yet');
  has('url(a.png) 4 4,', /after the last comma/, 'trailing comma');
  has('url(a.png),, auto', /two commas/, 'double comma');
  has('url(a.png', /Missing \) to close url\(/, 'unclosed bracket');
  has('url(a.png)), auto', /\) without a matching/, 'extra bracket');
  has('url("a.png), auto', /never closed/, 'unclosed quote');
  has('url(my file.png), auto', /url\("my file\.png"\)/, 'space in an unquoted url');
  has('url(a.png), inherit', /stands alone/, 'global keyword after an image');
  has('inherit, auto', /./, 'global keyword as an image');
  has('hand', /Did you mean pointer/, 'hand');
  has('Hand', /Did you mean pointer/, 'Hand');
  has('arrow', /Did you mean default/, 'arrow');
  has('grabing', /Did you mean grabbing/, 'typo');
  has('not allowed', /Did you mean not-allowed/, 'space instead of hyphen');
  has('not_allowed', /Did you mean not-allowed/, 'underscore');
  has('-moz-grab', /no longer works.*grab/, '-moz-grab');
  has('busy', /Did you mean wait/, 'busy');
  has('xyzzy', /Pick one of the 36/, 'nonsense');
  has('12', /number on its own/, 'number');
  has('background: red', /background property/, 'another property pasted');
  has('url(a.png) 4 4, url(b.png)', /needs a keyword after it/, 'list ending in an image');
  check(CUR.parse('hand').suggest === 'pointer', 'suggest field for the "Use pointer" button');
  // no error message may carry the raw value back as HTML; the page escapes it, but keep it short too
  check(err('x'.repeat(5000)).length < 5200, 'long nonsense gives a bounded message');
}

if (suites.includes('fix')) {
  section('fix');
  // "Fix it" offers a corrected value for the common mistakes; it must parse, and it must never guess wildly.
  const cases = [
    ['url(my-cursor.png) 4 4 pointer', 'url("my-cursor.png") 4 4, pointer'],
    ['url(a.png)', 'url("a.png"), auto'],
    ['url(a.png) 4 4', 'url("a.png") 4 4, auto'],
    ['url(a.png) 4px 4px, auto', 'url("a.png") 4 4, auto'],
    ['"a.png", auto', 'url("a.png"), auto'],
    ['url(a.png) 4 4,', 'url("a.png") 4 4, auto'],
    ['url(a.png) hand', 'url("a.png"), pointer'],
    ['url(a.png) 4 4, hand', 'url("a.png") 4 4, pointer'],
    ['pointer, url(a.png)', 'url("a.png"), pointer'],
    ['url(a.png', 'url("a.png"), auto'],
    ['cursor: url(a.png) 2 2;', 'url("a.png") 2 2, auto'],
    ['hand', 'pointer'],
    ['xyzzy', null],
    ['url(a.png) 4, auto', null],
    ['pointer', null],
    ['', null],
  ];
  for (const [i, o] of cases) eq(CUR.fix(i), o, 'fix ' + JSON.stringify(i));
  for (const [i, o] of cases) if (o) check(ok(o), 'fix parses: ' + o);
}

if (suites.includes('search')) {
  section('search');
  eq(CUR.search('').length, 36, 'empty query: all');
  eq(CUR.search('grab'), ['grab', 'grabbing'], 'prefix: exact first');
  eq(CUR.search('resize').length, 14, 'all 14 resize values');
  eq(CUR.search('hand')[0], 'pointer', 'everyday word');
  eq(CUR.search('drag')[0], 'grab', 'drag -> grab first');
  eq(CUR.search('loading'), ['wait'], 'loading');
  eq(CUR.search('zoom'), ['zoom-in', 'zoom-out'], 'zoom');
  eq(CUR.search('  Text '), CUR.search('text'), 'trimmed, case-insensitive');
  eq(CUR.search('text')[0], 'text', 'exact match first');
  eq(CUR.search('cursor: wait;')[0], 'wait', 'a pasted declaration searches by its value');
  eq(CUR.search('spreadsheet'), ['cell'], 'words of the use line');
  eq(CUR.search('qqq'), [], 'nothing');
}

if (suites.includes('hotspot')) {
  section('hotspot');
  eq(CUR.clampHotspot(4, 12, 32, 32), {x: 4, y: 12}, 'inside');
  eq(CUR.clampHotspot(-5, -5, 32, 32), {x: 0, y: 0}, 'negative clamps to 0 (old page printed -5 -5)');
  eq(CUR.clampHotspot(1000, 1000, 32, 32), {x: 31, y: 31}, 'beyond the image clamps to the last pixel');
  eq(CUR.clampHotspot(2.5, 9.49, 32, 32), {x: 3, y: 9}, 'rounded to whole pixels');
  eq(CUR.clampHotspot('7', ' 3 ', 32, 32), {x: 7, y: 3}, 'strings');
  eq(CUR.clampHotspot('', 'x', 32, 32), {x: 0, y: 0}, 'empty and junk are 0 (as the old page)');
  eq(CUR.clampHotspot(NaN, Infinity, 32, 32), {x: 0, y: 0}, 'NaN, Infinity');
  eq(CUR.clampHotspot(5, 5, 1, 1), {x: 0, y: 0}, '1 x 1 image');
  eq(CUR.fitSize(512, 512, 32), {w: 32, h: 32}, 'square down');
  eq(CUR.fitSize(300, 100, 32), {w: 32, h: 11}, 'aspect kept');
  eq(CUR.fitSize(20, 24, 32), {w: 20, h: 24}, 'never enlarged');
  eq(CUR.fitSize(1000, 1, 32), {w: 32, h: 1}, 'at least 1 px');
  eq(CUR.fitSize(0, 10, 32), {w: 0, h: 0}, 'no size');
  eq(CUR.scaleHotspot(256, 256, 512, 512, 32, 32), {x: 16, y: 16}, 'hotspot follows a shrink');
  eq(CUR.scaleHotspot(511, 0, 512, 512, 32, 32), {x: 31, y: 0}, 'and stays inside');
  eq(CUR.sizeAdvice(32, 32), 'ok', '32 ok');
  eq(CUR.sizeAdvice(33, 10), 'large', '33 large');
  eq(CUR.sizeAdvice(128, 128), 'large', '128 still accepted');
  eq(CUR.sizeAdvice(129, 20), 'too-big', '129 ignored by browsers');
}

if (suites.includes('image')) {
  section('image');
  eq(CUR.imageCss({url: 'https://example.com/c.png', x: 4, y: 12, w: 32, h: 32, fallback: 'crosshair'}), 'cursor: url("https://example.com/c.png") 4 12, crosshair;', 'old page case c');
  eq(CUR.imageCss({url: 'https://example.com/c.png', x: '', y: '', w: 32, h: 32, fallback: 'auto'}), 'cursor: url("https://example.com/c.png") 0 0, auto;', 'old page case d: empty hotspot is 0 0');
  eq(CUR.imageCss({url: 'c.png', x: -5, y: -5, w: 32, h: 32, fallback: 'auto'}), 'cursor: url("c.png") 0 0, auto;', 'negative clamped');
  eq(CUR.imageCss({url: 'c.png', x: 1000, y: 1000, w: 32, h: 32, fallback: 'auto'}), 'cursor: url("c.png") 31 31, auto;', 'outside clamped');
  eq(CUR.imageCss({url: 'c.png', x: 2.5, y: '1e1', w: 32, h: 32, fallback: 'auto'}), 'cursor: url("c.png") 3 10, auto;', 'decimals and exponent become whole pixels');
  eq(CUR.imageCss({url: 'c.png', x: 0, y: 0, fallback: 'none'}), 'cursor: url("c.png") 0 0, none;', 'none fallback');
  eq(CUR.imageCss({url: 'c.png', x: 0, y: 0, fallback: 'hand'}), 'cursor: url("c.png") 0 0, auto;', 'unknown fallback becomes auto');
  eq(CUR.imageCss({url: 'https://x.test/a"b.png', x: 0, y: 0, fallback: 'auto'}), 'cursor: url("https://x.test/a\\"b.png") 0 0, auto;', 'quote escaped (old page broke here)');
  eq(CUR.imageCss({url: 'a\\b.png', x: 0, y: 0, fallback: 'auto'}), 'cursor: url("a\\\\b.png") 0 0, auto;', 'backslash escaped');
  eq(CUR.imageCss({url: 'a\nb', x: 0, y: 0, fallback: 'auto'}), 'cursor: url("a\\a b") 0 0, auto;', 'newline escaped');
  for (const u of ['c.png', 'https://x.test/a"b.png', 'a\\b', 'é ü.png', 'data:image/svg+xml,%3Csvg%3E']) {
    const out = CUR.imageCss({url: u, x: 1, y: 2, fallback: 'pointer'});
    const back = CUR.parse(out);
    check(back.ok && back.images[0].url === u, 'what it prints reads back: ' + u, JSON.stringify(back));
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="3" fill="#e5243b"/></svg>';
  const uri = CUR.svgDataUri(svg);
  check(/^data:image\/svg\+xml,/.test(uri) && !/[<>#"]/.test(uri.slice(19)), 'svg data URI escapes < > # and "');
  eq(decodeURIComponent(uri.slice(19)).replace(/'/g, '"'), svg, 'and decodes back');
  check(ok(CUR.imageCss({url: uri, x: 16, y: 16, fallback: 'crosshair'})), 'example rule parses');
}

if (suites.includes('storage')) {
  section('storage');
  eq(CUR.themeFromLegacy('true'), 'dark', 'old darkMode "true"');
  eq(CUR.themeFromLegacy('false'), 'light', 'old darkMode "false"');
  eq(CUR.themeFromLegacy(null), null, 'no saved theme: follow the system');
  eq(CUR.themeFromLegacy('yes'), null, 'junk');
  check(html.includes("localStorage.getItem('darkMode')") && html.includes("localStorage.setItem('darkMode'"), 'the page still reads and writes darkMode');
}

if (suites.includes('contract')) {
  section('contract');
  // The old page's outputs (inventory of the Alpine version), as its copy button produced them.
  eq(css('nwse-resize'), 'cursor: nwse-resize;', 'n: standard copy');
  eq(css('not-allowed'), 'cursor: not-allowed;', 'standard copy');
  eq(CUR.imageCss({url: 'cursor.png', x: 0, y: 0, fallback: 'auto'}), 'cursor: url("cursor.png") 0 0, auto;', 'i: relative URL');
  eq(CUR.imageCss({url: 'https://example.com/c.png', x: 0, y: 0, fallback: 'none'}), 'cursor: url("https://example.com/c.png") 0 0, none;', 'h: fallback none');
  // every old fallback option is still offered
  for (const k of SPEC) check(CUR.BY[k], 'fallback option ' + k);
}

if (suites.includes('huge')) {
  section('huge');
  const big = 'url("data:image/png;base64,' + 'A'.repeat(400000) + '") 3 4, pointer';
  let t = Date.now();
  const r = CUR.parse(big);
  check(r.ok && r.images[0].url.length === 400022, 'a 400 kB data URI parses');
  check(Date.now() - t < 300, 'quickly', (Date.now() - t) + ' ms');
  t = Date.now();
  const many = Array.from({length: 2000}, (_, i) => `url(c${i}.png) ${i} ${i}`).join(', ') + ', auto';
  check(CUR.parse(many).ok, '2000 images');
  check(Date.now() - t < 500, 'quickly', (Date.now() - t) + ' ms');
  t = Date.now();
  CUR.parse('('.repeat(20000));
  CUR.parse('url(' + 'x'.repeat(100000));
  CUR.search('x'.repeat(100000));
  check(Date.now() - t < 500, 'malformed giants return quickly', (Date.now() - t) + ' ms');
}

if (suites.includes('browser')) {
  section('browser');
  let chromium = null;
  try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch (e) {
    try { chromium = createRequire('/usr/lib/node_modules/')('playwright').chromium; } catch (e2) {}
  }
  if (!chromium) console.log('  (skipped: no Playwright)');
  else {
    const b = await chromium.launch();
    const p = await b.newPage();
    const cases = [...SPEC, '-webkit-grab', '-webkit-zoom-out', 'inherit', 'unset', 'revert-layer',
      'url(a.png), auto', 'url(a.png) 1 2, auto', 'url(a.png) -1 2, auto', 'url(a.png) 1.5 2, auto', 'url(a.png) 1e1 .5, auto',
      'url(a.png)1 1,auto', 'url(a.png) 1 2, url(b.png), pointer', 'url("a\\"b.png"), auto', 'url(a\\ b.png), auto',
      'image-set(url(a.png) 1x) 2 2, auto', '-webkit-image-set(url(a.png) 1x), auto', 'url() , auto', 'url(a.png) calc(1 + 2) 2, auto',
      'url(a.png)', 'url(a.png) pointer', 'pointer, url(a.png)', 'auto, pointer', 'url(a.png) 1, auto', 'url(a.png) 1px 2px, auto',
      '"a.png", auto', 'url(a.png) 1 2 3, auto', 'url(a.png) 0 0,', 'hand', '-moz-grab', 'url(a.png), inherit', 'inherit, auto',
      'url(a b.png), auto', 'src("a.png"), auto', 'url(a.png) 4,5 6, auto', 'url(a.png),, auto', 'url(a.png', '12', 'not allowed'];
    for (const s of cases) {
      const browser = await p.evaluate(v => CSS.supports('cursor', v), s);
      eq(ok(s), browser, 'Chromium agrees on ' + JSON.stringify(s));
      const r = CUR.parse(s);
      if (r.ok) eq(await p.evaluate(v => CSS.supports('cursor', v), r.value), true, '  and on what is printed for it');
    }
    for (const k of SPEC) {
      const out = CUR.imageCss({url: 'x.png', x: 3, y: 4, fallback: k}).replace(/^cursor: |;$/g, '');
      check(await p.evaluate(v => CSS.supports('cursor', v), out), 'image rule valid with fallback ' + k);
    }
    await b.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
