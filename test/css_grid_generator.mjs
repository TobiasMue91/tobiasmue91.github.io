#!/usr/bin/env node
// Test suite for tools/css_grid_generator.html (CSS Grid Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that the CSS it prints is valid and lays
// out the picture you drew: one <track-size> per box read the way CSS Grid Layout 1 §7.2 reads it (lengths and
// percentages never negative, fr only as a flexible maximum, minmax()/fit-content()), area names that are valid
// <custom-ident>s (§7.3, CSS Values 4: not auto/span/inherit/...), template rows that are rectangles, and pasted CSS read
// back into the same grid. Expected strings are worked out by hand from those specs, not taken from the page. The
// `browser` suite has Chromium check every printed declaration with CSS.supports and lay out names and line numbers
// side by side, wanting identical boxes (skipped without Playwright).
//
//   node test/css_grid_generator.mjs              # everything
//   node test/css_grid_generator.mjs track parse  # named suites only
//
// Suites: track, gap, names, edit, print, html, parse, storage, hash, presets, contract, huge, browser.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import {execSync} from 'child_process';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'css_grid_generator.html');
const ALL = ['track', 'gap', 'names', 'edit', 'print', 'html', 'parse', 'storage', 'hash', 'presets', 'contract', 'huge', 'browser'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {Buffer};
vm.runInNewContext(src + '\nthis.CG = CG;', ctx);
const CG = ctx.CG;
const T = s => { const r = CG.parseTrack(s); return r.ok ? r.value : 'ERR'; };
const plain = o => JSON.parse(JSON.stringify(o));

if (suites.includes('track')) {
  section('track');
  const ok = [
    ['1fr', '1fr'], ['2.5FR', '2.5fr'], [' 1fr ', '1fr'], ['1fr;', '1fr'], ['0.5fr', '0.5fr'], ['.5fr', '0.5fr'],
    ['200px', '200px'], ['200 px', '200px'], ['12.50rem', '12.5rem'], ['25%', '25%'], ['10vw', '10vw'], ['3ch', '3ch'], ['50dvh', '50dvh'],
    ['auto', 'auto'], ['AUTO', 'auto'], ['min-content', 'min-content'], ['max-content', 'max-content'],
    ['minmax(100px, 1fr)', 'minmax(100px, 1fr)'], ['MinMax(100px,1fr)', 'minmax(100px, 1fr)'], ['minmax(0,1fr)', 'minmax(0, 1fr)'],
    ['minmax(min-content, 300px)', 'minmax(min-content, 300px)'], ['minmax(auto, max-content)', 'minmax(auto, max-content)'],
    ['fit-content(300px)', 'fit-content(300px)'], ['fit-content(40%)', 'fit-content(40%)'],
    ['calc(100% - 20px)', 'calc(100% - 20px)'], ['clamp(100px,20vw,300px)', 'clamp(100px, 20vw, 300px)'], ['min(300px, 50%)', 'min(300px, 50%)'],
    ['var(--side)', 'var(--side)'], ['0', '0'], ['0px', '0px'], ['1e2px', '100px']
  ];
  ok.forEach(([i, o]) => eq(T(i), o, `track ${JSON.stringify(i)}`));
  // decimal comma: outside brackets it is a decimal point; inside minmax() a lone digit pair is merged back
  eq(T('1,5fr'), '1.5fr', 'decimal comma');
  eq(T('12,5 rem'), '12.5rem', 'decimal comma with a space before the unit');
  eq(T('minmax(12,5rem, 1fr)'), 'minmax(12.5rem, 1fr)', 'decimal comma inside minmax, first argument');
  eq(T('minmax(100px, 1,5fr)'), 'minmax(100px, 1.5fr)', 'decimal comma inside minmax, second argument');
  eq(T('minmax(100,1fr)'), 'minmax(100px, 1fr)', 'bare number inside minmax is px, not a decimal comma');
  eq(T('−10px'), 'ERR', 'unicode minus is read as minus, and negative is refused');
  // bare numbers: a share up to 12, px beyond; flagged so the page can show what it chose
  eq(T('3'), '3fr', 'bare 3 -> 3fr'); eq(T('12'), '12fr', 'bare 12 -> 12fr'); eq(T('13'), '13px', 'bare 13 -> 13px'); eq(T('250'), '250px', 'bare 250 -> 250px');
  eq(CG.parseTrack('250').guessed, true, 'bare number is marked as guessed');
  eq(CG.parseTrack('250px').guessed, undefined, 'a unit is not a guess');
  const bad = ['', '   ', 'abc', '-1fr', '-20px', '10pxx', '200 pxx', 'minmax(1fr, 1fr)', 'minmax(100px)', 'minmax(100px, 1fr', 'repeat(3, 1fr)',
    '1fr 1fr', 'calc(1fr + 10px)', 'calc(100% - 10px', 'fit-content(1fr)', 'fit-content(-5px)', 'calc(10px; color: red)', 'url(x)', 'NaNpx', '∞px'];
  bad.forEach(b => eq(T(b), 'ERR', `refused ${JSON.stringify(b)}`));
  check(/unit/.test(CG.parseTrack('10pxx').error), 'unknown unit says so', CG.parseTrack('10pxx').error);
  check(/negative/.test(CG.parseTrack('-1fr').error), 'negative fr says so');
  check(/first value in minmax/.test(CG.parseTrack('minmax(1fr, 1fr)').error), 'fr minimum says so');
  check(/One size per box/.test(CG.parseTrack('repeat(3, 1fr)').error), 'repeat in a box points to +');
  check(/Try 1fr, 200px/.test(CG.parseTrack('abc').error), 'garbage lists what is accepted');
}

if (suites.includes('gap')) {
  section('gap');
  const G = s => { const r = CG.parseGap(s); return r.ok ? [r.row, r.col] : 'ERR'; };
  eq(G('16px'), ['16px', '16px'], 'one value is both');
  eq(G('16'), ['16px', '16px'], 'bare number is px');
  eq(G('1rem 2rem'), ['1rem', '2rem'], 'row then column');
  eq(G('1,5rem'), ['1.5rem', '1.5rem'], 'decimal comma');
  eq(G('1,5rem 2rem'), ['1.5rem', '2rem'], 'decimal comma in a pair');
  eq(G(''), ['0', '0'], 'empty is no gap');
  eq(G('0'), ['0', '0'], 'zero');
  eq(G('5%'), ['5%', '5%'], 'percent');
  eq(G('-4px'), 'ERR', 'negative refused');
  eq(G('1fr'), 'ERR', 'fr refused');
  eq(G('1px 2px 3px'), 'ERR', 'three values refused');
  eq(CG.gapText({rowGap: '8px', colGap: '8px'}), '8px', 'equal gaps print once');
  eq(CG.gapText({rowGap: '8px', colGap: '1rem'}), '8px 1rem', 'unequal gaps print row then column');
}

if (suites.includes('names')) {
  section('names');
  const N = s => { const r = CG.normName(s); return r.ok ? r.value : 'ERR'; };
  eq(N('header'), 'header', 'plain');
  eq(N('Main Content'), 'Main-Content', 'spaces become hyphens, case kept (idents are case-sensitive)');
  eq(N('  side bar  '), 'side-bar', 'trimmed');
  eq(N('nav!@#'), 'nav', 'punctuation dropped');
  eq(N('product.image'), 'product-image', 'dots would read as empty cells in a template, so they become hyphens');
  eq(N('größe'), 'größe', 'non-ASCII letters are valid ident characters');
  eq(N('_x'), '_x', 'underscore start');
  eq(N('-x'), '-x', 'hyphen then letter is a valid ident');
  eq(N('2col'), 'ERR', 'digit start refused');
  eq(N('-2'), 'ERR', 'hyphen-digit start refused');
  eq(N('auto'), 'ERR', 'auto is reserved in grid-area'); eq(N('SPAN'), 'ERR', 'span is reserved, any case'); eq(N('inherit'), 'ERR', 'CSS-wide keyword');
  eq(N(''), 'ERR', 'empty'); eq(N('!!!'), 'ERR', 'nothing usable');
  eq(N('a'.repeat(80)).length, 40, 'capped at 40 characters');
  eq(CG.normClass('.layout').value, 'layout', 'class: leading dot accepted');
  eq(CG.normClass('9grid').error ? 'ERR' : 'ok', 'ERR', 'class: digit start refused');
  eq(CG.nextName([]), 'header', 'first suggestion');
  eq(CG.nextName(['header', 'sidebar', 'main', 'footer', 'aside', 'nav', 'hero', 'content', 'banner', 'extra'].map(n => ({name: n}))), 'area-1', 'after the list: area-1');
}

if (suites.includes('edit')) {
  section('edit');
  let s = CG.defaultState();
  eq(plain(CG.matrix(s)), [['header', 'header'], ['sidebar', 'main'], ['footer', 'footer']], 'default picture');
  let r = CG.addArea(s, 1, 1, 1, 1);
  eq(r.removed, ['main'], 'drawing over main replaces it');
  eq(r.name, 'main', 'the free suggestion is reused');
  r = CG.addArea(s, 2, 1, 0, 1);
  eq(plain(r.removed), ['header', 'main', 'footer'], 'a column through three areas removes all three');
  eq(plain(CG.matrix(r.state)).map(x => x[1]), ['header', 'header', 'header'], 'corner order does not matter; the first free suggestion (header, just freed) names it');
  r = CG.addArea(s, 0, 0, 0, 1, 'top bar');
  eq(r.name, 'top-bar', 'a given name is normalised');
  r = CG.addArea(s, 1, 0, 1, 0, 'main');
  eq(r.name, 'sidebar', 'a name already taken falls back to the first free suggestion');
  r = CG.addArea(s, 5, 5, 9, 9);
  check(r.state === s, 'a rectangle outside the grid changes nothing');
  eq(CG.removeArea(s, 'main').areas.map(a => a.name), ['header', 'sidebar', 'footer'], 'remove');
  eq(CG.renameArea(s, 'main', 'content').state.areas[2].name, 'content', 'rename');
  eq(CG.renameArea(s, 'main', 'header').ok, false, 'rename onto an existing name refused');
  eq(CG.renameArea(s, 'main', 'main').ok, true, 'rename to itself is fine');
  eq(CG.renameArea(s, 'main', 'span').ok, false, 'rename to a keyword refused');
  // inserting and deleting tracks keeps areas rectangular and in place
  let t = CG.insertTrack(s, 'cols', 1, 'auto');
  eq(plain(t.cols), ['220px', 'auto', '1fr'], 'insert a column in the middle');
  eq(plain(CG.matrix(t)), [['header', 'header', 'header'], ['sidebar', null, 'main'], ['footer', 'footer', 'footer']], 'spanning areas grow, others shift');
  t = CG.deleteTrack(s, 'cols', 0);
  eq(plain(CG.matrix(t)), [['header'], ['main'], ['footer']], 'deleting column 1 drops sidebar and shrinks the spans');
  t = CG.deleteTrack(s, 'rows', 1);
  eq(plain(CG.matrix(t)), [['header', 'header'], ['footer', 'footer']], 'deleting the middle row drops sidebar and main');
  check(CG.deleteTrack(CG.setCount(s, 'cols', 1), 'cols', 0).cols.length === 1, 'the last column cannot be deleted');
  eq(CG.setCount(s, 'cols', 4).cols, ['220px', '1fr', '1fr', '1fr'], 'grow adds 1fr tracks at the end');
  eq(CG.setCount(s, 'rows', 0).rows.length, 1, 'count below 1 clamps to 1');
  eq(CG.setCount(s, 'rows', 99).rows.length, CG.MAX_TRACKS, 'count clamps to the maximum');
  eq(CG.setCount(s, 'rows', 2.7).rows.length, 2, 'fractional count floors');
  const shrunk = CG.setCount(s, 'cols', 1);
  eq(plain(CG.matrix(shrunk)), [['header'], ['sidebar'], ['footer']], 'shrinking to one column keeps what fits');
  check(JSON.stringify(s) === JSON.stringify(CG.defaultState()), 'edits never mutate the state they are given');
}

if (suites.includes('print')) {
  section('print');
  const s = CG.defaultState();
  eq(CG.css(s), `.grid-container {
  display: grid;
  grid-template-columns: 220px 1fr;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header  header"
    "sidebar main"
    "footer  footer";
  gap: 16px;
}

.header  { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main    { grid-area: main; }
.footer  { grid-area: footer; }`, 'default CSS');
  const lines = Object.assign(CG.clone(s), {place: 'lines'});
  eq(CG.css(lines).split('\n\n')[1], `.header  { grid-area: 1 / 1 / 2 / 3; }
.sidebar { grid-area: 2 / 1 / 3 / 2; }
.main    { grid-area: 2 / 2 / 3 / 3; }
.footer  { grid-area: 3 / 1 / 4 / 3; }`, 'line numbers: row-start / column-start / row-end / column-end, 1-based');
  check(!/grid-template-areas/.test(CG.css(lines)), 'line numbers print no template');
  const stacked = Object.assign(CG.clone(s), {stack: 640});
  eq(CG.css(stacked).split('\n\n')[2], `@media (max-width: 640px) {
  .grid-container {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    grid-template-areas:
      "header"
      "sidebar"
      "main"
      "footer";
  }
}`, 'stacking: one column, areas in reading order');
  eq(CG.css(Object.assign(CG.clone(lines), {stack: 500})).split('\n\n')[2], `@media (max-width: 500px) {
  .grid-container {
    grid-template-columns: 1fr;
    grid-template-rows: none;
  }
  .header  { grid-area: auto; }
  .sidebar { grid-area: auto; }
  .main    { grid-area: auto; }
  .footer  { grid-area: auto; }
}`, 'stacking with line numbers releases each item');
  const empty = CG.addArea(s, 0, 0, 0, 0).state;  // header shrinks to one cell, leaving a hole
  eq(CG.templateRows(CG.matrix(empty)), ['"header  ."', '"sidebar main"', '"footer  footer"'], 'empty cells are "." and columns line up');
  const plainGrid = Object.assign(CG.clone(s), {areas: [], cols: ['1fr', '1fr', '1fr'], rows: ['100px', '100px'], rowGap: '0', colGap: '0'});
  eq(CG.css(plainGrid), `.grid-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: 100px 100px;
  }`.replace('  }', '}'), 'no areas: no template, no item rules, zero gap left out; three equal tracks use repeat()');
  const aligned = Object.assign(CG.clone(plainGrid), {alignItems: 'center', justifyContent: 'space-between', autoFlow: 'row dense', justifyItems: 'start', alignContent: 'end'});
  eq(CG.css(aligned).split('\n').slice(4, 9), ['  align-items: center;', '  justify-items: start;', '  justify-content: space-between;', '  align-content: end;', '  grid-auto-flow: row dense;'], 'alignment printed only when not the default');
  const bp = Object.assign(CG.clone(plainGrid), {breakpoints: [{min: 1024, cols: 4}, {min: 600, cols: 2}]});
  eq(CG.css(bp).split('\n\n').slice(1), ['@media (min-width: 600px) {\n  .grid-container {\n    grid-template-columns: repeat(2, 1fr);\n  }\n}',
    '@media (min-width: 1024px) {\n  .grid-container {\n    grid-template-columns: repeat(4, 1fr);\n  }\n}'], 'breakpoints sorted by width');
  const fit = Object.assign(CG.clone(s), {fit: 'auto-fit', fitMin: '240px', fitMax: '1fr', autoRows: '180px', breakpoints: [{min: 600, cols: 2}]});
  eq(CG.css(fit), `.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  grid-auto-rows: 180px;
  gap: 16px;
}`, 'card grid: auto-fit, no template, areas and breakpoints set aside');
  eq(CG.trackList(['1fr', '1fr']), '1fr 1fr', 'two equal tracks are written out');
  eq(CG.trackList(['1fr', '1fr', '2fr']), '1fr 1fr 2fr', 'unequal tracks are written out');
  const cls = Object.assign(CG.clone(s), {cls: 'page'});
  check(CG.css(cls).startsWith('.page {'), 'container class used');
}

if (suites.includes('html')) {
  section('html');
  eq(CG.html(CG.defaultState()), `<div class="grid-container">
  <div class="header">header</div>
  <div class="sidebar">sidebar</div>
  <div class="main">main</div>
  <div class="footer">footer</div>
</div>`, 'one element per area, reading order');
  const p = CG.preset('basic');
  eq(CG.html(p).split('\n').length, 6, 'plain 2x2: four numbered items');
  eq(CG.html(Object.assign(CG.preset('gallery'), {items: 3})).split('\n')[3], '  <div class="grid-item">3</div>', 'card grid: item count from the field');
}

if (suites.includes('parse')) {
  section('parse');
  const P = s => CG.parseCss(s);
  let r = P(`.wrap {
  display: grid;
  grid-template-columns: repeat(3, 1fr) 200px;
  grid-template-areas: "a a . b" "c c c b";
  gap: 1,5rem 2rem;
}`);
  eq(r.ok, true, 'a real rule');
  eq(r.state.cls, 'wrap', 'class name taken from the selector');
  eq(plain(r.state.cols), ['1fr', '1fr', '1fr', '200px'], 'repeat() expanded');
  eq(plain(r.state.rows), ['auto', 'auto'], 'rows nobody sized are auto, as the implicit grid makes them');
  eq([r.state.rowGap, r.state.colGap], ['1.5rem', '2rem'], 'gap pair with a decimal comma');
  eq(plain(CG.matrix(r.state)), [['a', 'a', null, 'b'], ['c', 'c', 'c', 'b']], 'template read');
  // round trip: what we print, we read back to the same CSS
  for (const id of CG.PRESETS.map(p => p[0])) {
    const st = CG.preset(id), back = P(CG.css(st));
    eq(back.ok && CG.css(back.state), CG.css(st), `round trip: ${id}`);
  }
  r = P('grid-template-columns: 1fr 2fr; gap: 10px');
  eq(r.ok && plain(r.state.cols), ['1fr', '2fr'], 'bare declarations, no selector');
  eq(r.state.cls, 'grid-container', 'no selector keeps the default class');
  r = P('.g { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); grid-auto-rows: 200px; }');
  eq([r.state.fit, r.state.fitMin, r.state.fitMax, r.state.autoRows], ['auto-fill', '180px', '1fr', '200px'], 'auto-fill card grid');
  r = P('.g { grid-template-columns: [full-start] 1fr [content-start] 2fr; }');
  eq(r.ok && plain(r.state.cols), ['1fr', '2fr'], 'line names dropped');
  check(r.warnings.length === 1, 'and the drop is reported');
  r = P('.g{grid-template-areas:"a b" "b a"}');
  eq(r.ok, false, 'non-rectangular area refused');
  check(/isn’t a rectangle/.test(r.error), 'and says why', r.error);
  eq(P('.g{grid-template-areas:"a b" "c"}').ok, false, 'ragged rows refused');
  eq(plain(CG.matrix(P('.g{grid-template-areas:"a...b"}').state)), [['a', null, 'b']], 'dots touching names: "a...b" is a, empty, b (§7.3 tokens)');
  eq(P('.g{grid-gap: 8px; grid-row-gap: 4px}').state.rowGap, '4px', 'legacy grid-gap / grid-row-gap');
  eq(P('.g{display:grid; grid-template-columns: 1fr !important}').state.cols[0], '1fr', '!important ignored');
  eq(P('/* x */ .g { /* y */ grid-template-columns: 100px /* z */ 1fr }').state.cols.length, 2, 'comments ignored');
  eq(P('.g{grid-auto-flow: dense}').state.autoFlow, 'row dense', 'dense alone means row dense');
  eq(P('.g{display:grid; justify-content: flex-start}').state.justifyContent, 'start', 'flex-start read as start');
  eq(P('.g{grid-template-columns: subgrid}').ok, false, 'subgrid refused with a reason');
  eq(P('color: red').ok, false, 'no grid at all');
  eq(P('').ok, false, 'empty');
  eq(P('.g{grid-template-columns: -1fr}').ok, false, 'invalid track refused');
  eq(P('.g{grid-template-columns: repeat(0, 1fr)}').ok, false, 'repeat(0) refused');
  eq(P('.g{grid-template-columns: 1fr 1fr; grid-template-areas: "a"}').state.cols.length, 2, 'template narrower than the tracks keeps the tracks');
  eq(plain(P('.g{grid-template-columns: 1fr; grid-template-areas: "a b c"}').state.cols), ['1fr', 'auto', 'auto'], 'template wider than the tracks adds auto columns');
}

if (suites.includes('storage')) {
  section('storage');
  const d = CG.defaultState();
  eq(CG.sanitize(null), d, 'nothing stored -> example');
  eq(CG.sanitize('junk'), d, 'junk -> example');
  eq(CG.sanitize(JSON.parse(JSON.stringify(CG.preset('dashboard')))), CG.preset('dashboard'), 'a valid state survives unchanged');
  const evil = Object.assign(CG.clone(d), {cls: 'x{}</style><script>', cols: ['1fr', 'expression(alert(1))'], rowGap: '-5px', areas: [{name: '<b>', r0: 0, c0: 0, r1: 1, c1: 1}]});
  const s = CG.sanitize(evil);
  eq(s.cls, 'xstylescript', 'class stripped to an ident');
  eq(plain(s.cols), plain(d.cols), 'any bad track resets the list');
  eq(s.rowGap, d.rowGap, 'bad gap resets');
  eq(s.areas.length, 0, 'bad area names dropped');
  const out = CG.sanitize(Object.assign(CG.clone(d), {areas: [{name: 'a', r0: 0, c0: 0, r1: 9, c1: 1}, {name: 'b', r0: 0, c0: 0, r1: 1, c1: 1}, {name: 'b', r0: 1, c0: 0, r1: 2, c1: 1}, {name: 'c', r0: 0, c0: 0, r1: 1, c1: 2}]}));
  eq(out.areas.map(a => a.name), ['b'], 'out-of-range, duplicate and overlapping areas dropped');
  eq(CG.sanitize({alignItems: 'sideways'}).alignItems, 'stretch', 'unknown option -> default');
  eq(CG.sanitize({breakpoints: [{min: -5, cols: 99}]}).breakpoints, [{min: 768, cols: 24}], 'breakpoints clamped');
}

if (suites.includes('hash')) {
  section('hash');
  for (const id of ['holy-grail', 'gallery', 'masonry']) {
    const st = CG.preset(id);
    eq(CG.decode('#' + CG.encode(st)), st, `link round trip: ${id}`);
  }
  const uni = Object.assign(CG.defaultState(), {areas: [{name: 'größe', r0: 0, c0: 0, r1: 1, c1: 1}]});
  eq(CG.decode('#' + CG.encode(uni)).areas[0].name, 'größe', 'non-ASCII names survive the link');
  check(/^g=[A-Za-z0-9_-]+$/.test(CG.encode(uni)), 'link is URL-safe base64');
  eq(CG.decode(''), null, 'no hash');
  eq(CG.decode('#other=1'), null, 'someone else’s hash');
  eq(CG.decode('#g=!!!'), null, 'broken link -> null, page keeps its state');
}

if (suites.includes('presets')) {
  section('presets');
  for (const [id] of CG.PRESETS) {
    const st = CG.preset(id);
    check(st && JSON.stringify(CG.sanitize(plain(st))) === JSON.stringify(st), `${id} is a valid state`);
  }
  eq(CG.preset('nope'), null, 'unknown preset');
  eq(plain(CG.matrix(CG.preset('holy-grail'))), [['header', 'header', 'header'], ['sidebar', 'main', 'aside'], ['footer', 'footer', 'footer']], 'holy grail keeps its areas (the old page lost them)');
  eq(CG.preset('product').areas.length, 6, 'product page keeps its six areas');
}

if (suites.includes('contract')) {
  section('contract');
  // The old page's outputs for its own sample inputs (recorded before the rewrite). Same grid, newer formatting:
  // grid-template-columns now comes before -rows, and three equal tracks print as repeat().
  const oldDefault = { cols: ['1fr', '1fr'], rows: ['1fr', '1fr'], gap: '10px' };
  const s = Object.assign(CG.preset('basic'), {});
  check(CG.css(s).includes('grid-template-columns: ' + oldDefault.cols.join(' ')) && CG.css(s).includes('grid-template-rows: 1fr 1fr') && CG.css(s).includes('gap: 10px;'), 'old default 2x2 / 10px gap');
  check(CG.css(CG.preset('gallery')).includes('grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));'), 'old gallery columns');
  check(CG.css(CG.preset('cards')).includes('repeat(auto-fill, minmax(250px, 1fr))') && CG.css(CG.preset('cards')).includes('gap: 20px;'), 'old card layout');
  check(CG.css(CG.preset('masonry')).includes('grid-template-rows: 200px 250px 150px 300px;') && CG.css(CG.preset('masonry')).includes('grid-auto-flow: row dense;'), 'old masonry');
  const bp = Object.assign(CG.preset('basic'), {breakpoints: [{min: 768, cols: 2}]});
  check(CG.css(bp).endsWith('@media (min-width: 768px) {\n  .grid-container {\n    grid-template-columns: repeat(2, 1fr);\n  }\n}'), 'old breakpoint block, same shape');
  // inputs the old page passed through as invalid CSS are now refused or repaired
  eq(T('1,5fr'), '1.5fr', 'old printed "1,5fr" (invalid); now 1.5fr');
  eq(T(' '), 'ERR', 'old printed a blank track; now refused');
  eq(CG.lengthPct('', 'x').error ? 'ERR' : 'ok', 'ERR', 'old printed minmax(, 1fr); now an empty minimum is refused');
}

if (suites.includes('huge')) {
  section('huge');
  let s = CG.setCount(CG.setCount(CG.defaultState(), 'cols', 24), 'rows', 24);
  for (let r = 0; r < 24; r += 2) for (let c = 0; c < 24; c += 2) s = CG.addArea(s, r, c, r + 1, c + 1).state;
  eq(s.areas.length, 144, '144 areas on a 24x24 grid');
  const t0 = Date.now(); const css = CG.css(s); const back = CG.parseCss(css);
  check(Date.now() - t0 < 500, 'print + read back a 24x24 grid in under half a second', `${Date.now() - t0} ms`);
  eq(back.ok && CG.css(back.state), css, '24x24 round trip');
  eq(CG.parseCss('.g{grid-template-columns: repeat(1000, 1fr)}').ok, false, 'a thousand tracks refused with a reason');
  eq(CG.parseCss('x'.repeat(300000)).ok, false, 'a 300 KB paste refused');
  const t1 = Date.now(); CG.parseCss('.g{grid-template-columns:1fr} ' + 'a{color:red}'.repeat(10000)); check(Date.now() - t1 < 500, '120 KB of other CSS reads fast');
  eq(T('9'.repeat(400) + 'px'), 'ERR', 'a 400-digit number is not a size');
}

if (suites.includes('browser')) {
  section('browser');
  let chromium;
  try { ({chromium} = await import('playwright')); } catch (e) {
    try { ({chromium} = createRequire(join(execSync('npm root -g').toString().trim(), 'x'))('playwright')); } catch (e2) { console.log('  (skipped: no playwright)'); }
  }
  if (chromium) {
    const browser = await chromium.launch();
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    const states = CG.PRESETS.map(([id]) => [id, CG.preset(id)]);
    let st = CG.defaultState();
    st.cols = ['minmax(120px, 1fr)', 'fit-content(300px)', '12.5rem', 'calc(100% - 10px)'];
    st = CG.addArea(st, 0, 2, 2, 3, 'related articles').state;
    states.push(['awkward', Object.assign(st, {alignItems: 'center', justifyContent: 'space-evenly', rowGap: '1.5rem', colGap: '4%'})]);
    for (const [id, s] of states) {
      const css = CG.css(s);
      // every declaration the page prints must be one Chromium accepts
      const decls = [...css.matchAll(/^\s*([a-z-]+):\s*([\s\S]*?);/gm)].map(m => [m[1], m[2].replace(/\s+/g, ' ')]);
      const bad = await page.evaluate(d => d.filter(([p, v]) => !CSS.supports(p, v)), decls);
      eq(bad, [], `${id}: every declaration is valid CSS`);
      if (!CG.usesAreas(s)) continue;
      // names and line numbers must place every area in the same box
      const boxes = async place => {
        const t = Object.assign(CG.clone(s), {place});
        await page.setContent(`<style>body{margin:0}.${t.cls}{height:600px}.${t.cls}>*{min-height:10px}</style><style>${CG.css(t)}</style>${CG.html(t)}`);
        return page.evaluate(names => names.map(n => { const r = document.querySelector('.' + n).getBoundingClientRect(); return [n, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }), t.areas.map(a => a.name));
      };
      eq(await boxes('lines'), await boxes('names'), `${id}: names and line numbers lay out the same`);
    }
    // stacking really stacks below the width, and does not above it
    const s = Object.assign(CG.defaultState(), {stack: 640});
    for (const [w, want] of [[600, 1], [800, 2]]) {
      await page.setViewportSize({width: w, height: 700});
      await page.setContent(`<style>${CG.css(s)}</style>${CG.html(s)}`);
      const xs = await page.evaluate(() => new Set([...document.querySelectorAll('.grid-container > *')].map(e => Math.round(e.getBoundingClientRect().x))).size);
      eq(xs, want, `stack at 640px: ${want} column(s) at ${w}px`);
    }
    await browser.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
