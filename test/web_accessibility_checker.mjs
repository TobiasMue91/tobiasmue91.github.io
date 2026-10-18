#!/usr/bin/env node
// Test suite for tools/web_accessibility_checker.html (Web Accessibility Checker).
//
// Runs the page's DOM-free <script id="core"> block in Node against documents parsed by linkedom, so the
// rules are checked without a browser. Expected values come from the sources, not the page: the WCAG 2.2
// contrast formula and its 4.5:1 / 3:1 thresholds (with independently computed ratios such as #767676 on
// white = 4.54:1 and #777777 = 4.48:1), "large text" as 18pt / 14pt bold, the WAI-ARIA 1.2 role list and
// required states, the accessible-name rules of accname 1.2 / HTML-AAM (label for, wrapping label,
// aria-labelledby, alt, title, placeholder as last resort), and BCP 47 for lang. Also the inputs that
// break checkers: empty, whitespace, fragments, malformed markup, non-ASCII, a 200 000-element page,
// comments and scripts that contain tag-like text (line numbers), and CSV injection in exports.
//
// The `browser` suite opens the real page in headless Chromium and checks that the rendered copy measures
// <style> contrast, that the page makes no request outside its origin while checking, and logs no errors.
//
//   npm i --no-save linkedom@0.18.13              # needed by every suite
//   npm i --no-save playwright-core@1.64.1        # browser suite only; uses /opt/pw-browsers/chromium
//   npx http-server -p 8099                       # browser suite only
//   node test/web_accessibility_checker.mjs                 # everything
//   node test/web_accessibility_checker.mjs contrast names  # named suites only
//
// Suites: contrast, names, rules, document, locate, edges, output, browser.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'web_accessibility_checker.html');
const ALL = ['contrast', 'names', 'rules', 'document', 'locate', 'edges', 'output', 'browser'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ±${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

let DOMParser;
try { ({DOMParser} = await import('linkedom')); } catch (e) { console.log('linkedom missing: npm i --no-save linkedom@0.18.13'); process.exit(2); }

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const A = ctx.module.exports;

// linkedom, unlike a browser, makes the first element of a fragment the root; give fragments the
// <html><body> a browser would imply (that adds no tags to the source the line numbers are read from).
const parse = s => new DOMParser().parseFromString(/<(html|head|body)[\s>]/i.test(s) ? s : '<html><head></head><body>' + s + '</body></html>', 'text/html');
const run = (s, env) => A.audit(parse(s), Object.assign({source: s, fullDocument: A.isFullDocument(s)}, env || {}));
const rules = r => ['errors', 'warnings', 'notices'].flatMap(k => r[k].map(i => i.rule));
const has = (s, rule, what) => check(rules(run(s)).includes(rule), what || `${rule} in ${s.slice(0, 60)}`, 'got ' + JSON.stringify(rules(run(s))));
const lacks = (s, rule, what) => check(!rules(run(s)).includes(rule), what || `no ${rule} in ${s.slice(0, 60)}`, 'got ' + JSON.stringify(rules(run(s))));
const sev = (s, rule) => { const r = run(s); for (const k of ['errors', 'warnings', 'notices']) { const i = r[k].find(x => x.rule === rule); if (i) return i.severity; } return null; };
const PAGE_OK = b => `<!doctype html><html lang="en"><head><title>Test page</title></head><body><header>h</header><nav>n</nav><main><h1>T</h1>${b}</main></body></html>`;

// Contrast env: a stub computed style. Each element's style comes from data-* attributes, inherited like CSS.
function stubStyle(el) {
  const get = (k, inh, def) => { for (let e = el; e; e = inh ? e.parentElement : null) { const v = e.getAttribute && e.getAttribute('data-' + k); if (v != null) return v; } return def; };
  return {color: get('color', true, 'rgb(0, 0, 0)'), backgroundColor: get('bg', false, 'rgba(0, 0, 0, 0)'), backgroundImage: get('bgimg', false, 'none'),
    fontSize: get('size', true, '16px'), fontWeight: get('weight', true, '400'), opacity: get('opacity', false, '1'),
    display: get('display', false, 'block'), visibility: get('visibility', true, 'visible')};
}
const runC = s => run(PAGE_OK(s), {style: stubStyle, rendered: () => true});
const contrastIssues = s => { const r = runC(s); return r.errors.concat(r.notices).filter(i => /contrast/.test(i.rule)); };

if (suites.includes('contrast')) {
  section('contrast');
  const c = A.parseColor;
  eq(c('#fff'), [255, 255, 255, 1], 'parse #fff');
  eq(c('#11223380').map(v => Math.round(v * 100) / 100), [17, 34, 51, 0.5], 'parse #rrggbbaa');
  eq(c('rgb(1, 2, 3)'), [1, 2, 3, 1], 'parse rgb()');
  eq(c('rgba(1, 2, 3, 0.5)'), [1, 2, 3, 0.5], 'parse rgba()');
  eq(c('rgb(1 2 3 / 50%)'), [1, 2, 3, 0.5], 'parse space syntax');
  eq(c('color(srgb 1 0 0)'), [255, 0, 0, 1], 'parse color(srgb)');
  eq(c('transparent'), [0, 0, 0, 0], 'parse transparent');
  eq(c('oklch(0.5 0.1 200)'), null, 'unknown syntax is null, not black');
  eq(c('#12'), null, 'bad hex');
  // Ratios from the WCAG formula, checked against WebAIM's contrast checker.
  near(A.ratio([0, 0, 0], [255, 255, 255]), 21, 1e-9, 'black/white = 21');
  near(A.ratio([255, 255, 255], [255, 255, 255]), 1, 1e-9, 'same colour = 1');
  near(A.ratio([0x76, 0x76, 0x76], [255, 255, 255]), 4.54, 0.005, '#767676 on white = 4.54');
  near(A.ratio([0x77, 0x77, 0x77], [255, 255, 255]), 4.4776, 0.0005, '#777 on white = 4.4776 (WebAIM shows it rounded, 4.48)');
  near(A.ratio([0x99, 0x99, 0x99], [255, 255, 255]), 2.85, 0.005, '#999 on white = 2.85');
  near(A.ratio([255, 255, 255], [0x2f, 0x9e, 0x44]), 3.445, 0.001, 'white on #2f9e44 = 3.445');
  near(A.ratio([0, 0, 255], [255, 255, 255]), 8.59, 0.005, 'blue on white = 8.59');
  near(A.ratio([255, 0, 0], [255, 255, 255]), 4.00, 0.005, 'red on white = 4.00');
  near(A.luminance([255, 255, 255]), 1, 1e-12, 'white luminance 1');
  eq(A.fmtRatio(4.4999), '4.49', 'ratio truncates, never rounds up to the threshold');
  eq(A.fmtRatio(21), '21.00', 'ratio format');
  eq([A.isLarge(24, 400), A.isLarge(23.9, 400), A.isLarge(18.67, 700), A.isLarge(18.67, 600), A.isLarge(18, 700)], [true, false, true, false, false], 'large text = 18pt, or 14pt bold');

  eq(contrastIssues('<p data-color="#777">Grey text</p>').map(i => i.ratio), [4.47], '#777 fails, shown as 4.47 (truncated)');
  eq(contrastIssues('<p data-color="#767676">Grey text</p>').length, 0, '#767676 passes');
  eq(contrastIssues('<p data-color="#949494" data-size="24px">Big</p>').length, 0, '#949494 large text passes 3:1');
  eq(contrastIssues('<p data-color="#999" data-size="24px">Big</p>').map(i => i.required), [3], '#999 large text fails 3:1');
  eq(contrastIssues('<p data-color="#949494" data-size="18.6667px" data-weight="700">Bold</p>').length, 0, '14pt bold counts as large');
  eq(contrastIssues('<div data-bg="#000"><p data-color="#333">Dark on black</p></div>').map(i => i.background), ['#000000'], 'background found on ancestor');
  const half = contrastIssues('<div data-bg="rgba(0, 0, 0, 0.5)"><p data-color="#777">x</p></div>');
  eq(half.map(i => i.background), ['#808080'], 'semi-transparent background composited over white');
  eq(contrastIssues('<p data-color="rgba(0, 0, 0, 0.3)">faint</p>').map(i => i.foreground), ['#b3b3b3'], 'translucent text composited');
  eq(contrastIssues('<div data-opacity="0.4"><p>Faded</p></div>').length, 1, 'ancestor opacity lowers contrast');
  eq(contrastIssues('<div data-bgimg="url(x.png)"><p data-color="#fff">On photo</p></div>').map(i => i.rule), ['contrast-unknown'], 'background image: cannot measure, says so');
  eq(contrastIssues('<p data-color="#777">a</p><p data-color="#777">b</p><span data-color="#777">c</span>').map(i => i.count), [3], 'same colours grouped');
  eq(contrastIssues('<button disabled data-color="#bbb">Off</button>').length, 0, 'disabled control exempt');
  eq(contrastIssues('<p data-color="#777">   </p>').length, 0, 'whitespace-only text ignored');
  eq(contrastIssues('<p data-color="#bbb">→ ·</p>').length, 0, 'text without letters or digits ignored');
  eq(contrastIssues('<p data-color="#777">日本語</p>').length, 1, 'non-Latin text is measured');
  const fix = contrastIssues('<p data-color="#999">x</p>')[0].fix;
  const m = fix.match(/color: #([0-9a-f]{6})/);
  check(m && A.ratio(A.parseColor('#' + m[1]), [255, 255, 255]) >= 4.5, 'suggested text colour really passes', fix);
  const f2 = contrastIssues('<button data-color="#fff" data-bg="#4a90e2">Sign up</button>')[0].fix;
  const bm = f2.match(/background-color: #([0-9a-f]{6})/);
  check(bm && A.ratio([255, 255, 255], A.parseColor('#' + bm[1])) >= 4.5 && A.ratio([255, 255, 255], A.parseColor('#' + bm[1])) < 5.2, 'suggested background keeps white text and passes by a small margin', f2);
  check(run(PAGE_OK('<p style="color:#eee">x</p>')).errors.every(i => i.rule !== 'low-contrast'), 'no style lookup → contrast skipped, not guessed');
}

if (suites.includes('names')) {
  section('names');
  lacks('<label for="a">Name</label><input id="a">', 'missing-label', 'label[for]');
  lacks('<label>Name <input></label>', 'missing-label', 'wrapping label');
  lacks('<span id="l">Name</span><input aria-labelledby="l">', 'missing-label', 'aria-labelledby');
  lacks('<input aria-label="Search">', 'missing-label', 'aria-label');
  lacks('<input title="Search">', 'missing-label', 'title');
  has('<input aria-label="   ">', 'missing-label', 'blank aria-label is no name');
  has('<span id="l"></span><input aria-labelledby="l">', 'missing-label', 'labelledby an empty element');
  has('<label for="b">Name</label><input id="a">', 'missing-label', 'label for another id');
  has('<input placeholder="Email">', 'placeholder-only-label', 'placeholder only: warned, not failed');
  lacks('<input placeholder="Email">', 'missing-label', 'placeholder is a (weak) name');
  lacks('<input type="hidden"><input type="submit"><input type="reset">', 'missing-label', 'hidden/submit/reset need no label');
  has('<input type="button">', 'empty-button', 'input type=button without value');
  lacks('<input type="submit">', 'empty-button', 'submit has a default name');
  has('<select><option>A</option></select>', 'missing-label', 'select');
  has('<textarea></textarea>', 'missing-label', 'textarea');
  has('<div role="checkbox" aria-checked="false"></div>', 'missing-label', 'custom checkbox needs a name');
  lacks('<input type="checkbox" id="c"><label for="c">Agree</label>', 'missing-label', 'label after the input');
  lacks('<div aria-hidden="true"><input></div>', 'missing-label', 'inside aria-hidden');
  lacks('<input hidden>', 'missing-label', 'hidden attribute');
  const cms = run('<p>Your name</p><input type=text name=name>\n<label for="mail">E-mail</label> <input type="email" id="email">\n<input type="checkbox" id=terms> I accept the terms');
  const ml = cms.errors.filter(i => i.rule === 'missing-label');
  eq(ml.map(i => i.line), [1, 2, 3], 'messy form: three unlabelled fields on their lines');
  check(/for="mail".*id="email"/.test(ml[1].description) && ml[1].fix === '<label for="email">E-mail</label>', 'mistyped label for is named and fixed', JSON.stringify(ml[1]));
  check(!rules(cms).includes('label-for-broken'), 'the mismatch is reported once, not twice');
  eq(ml[0].fix, '<label for="name">Your name</label>\n<input id="name" type="text" name="name">', 'fix reuses the text before the field');
  eq(ml[2].fix, '<label><input type="checkbox" id="terms"> I accept the terms</label>', 'checkbox fix wraps its text');
  eq(run('<select name="country"><option>A</option></select>').errors[0].fix, '<label for="country">Country</label>\n<select id="country" name="country"><option>A</option></select>', 'fix borrows id and words from name');
  has('<label for="x">A</label><input id="email">', 'label-for-broken', 'unrelated broken for still reported');
  check(/about our team/.test(run('<h2>Our team</h2><a href="/t">Read more</a>').warnings[0].suggestion), 'link advice names the section');
  check(/browser default white/.test(contrastIssues('<p data-color="#aaa">x</p>')[0].description), 'assumed white background is said');
  check(!/default white/.test(contrastIssues('<div data-bg="#fff"><p data-color="#aaa">x</p></div>')[0].description), 'declared background is not called assumed');
  has('<a href="/"></a>', 'empty-link');
  has('<a href="/"><img src="x.png"></a>', 'empty-link', 'image link without alt');
  lacks('<a href="/"><img src="x.png" alt="Home"></a>', 'empty-link', 'image link with alt');
  lacks('<a href="/"><svg><title>Home</title></svg></a>', 'empty-link', 'svg title names a link');
  lacks('<a href="/" aria-label="Home"><i class="icon"></i></a>', 'empty-link', 'aria-label on link');
  has('<a href="/"><span aria-hidden="true">★</span></a>', 'empty-link', 'aria-hidden content is no name');
  lacks('<a>placeholder</a><a></a>', 'empty-link', 'an <a> without href is not a link');
  has('<button><svg viewBox="0 0 1 1"></svg></button>', 'empty-button', 'icon button');
  lacks('<button>✓</button>', 'empty-button', 'symbol counts as text');
  lacks('<button><img src="x" alt="Close"></button>', 'empty-button', 'alt names button');
  has('<div role="button"></div>', 'empty-button', 'role=button');
  has('<iframe src="x"></iframe>', 'iframe-no-title');
  lacks('<iframe src="x" title="Map"></iframe>', 'iframe-no-title');
  has('<svg role="img"></svg>', 'svg-img-alt');
  lacks('<svg role="img" aria-label="Chart"></svg>', 'svg-img-alt');
}

if (suites.includes('rules')) {
  section('rules');
  has('<img src="a.png">', 'missing-alt');
  eq(sev('<img src="a.png">', 'missing-alt'), 'error', 'missing alt is an error');
  lacks('<img src="a.png" aria-label="Chart">', 'missing-alt', 'aria-label names an image');
  lacks('<img src="a.png" role="presentation">', 'missing-alt', 'role=presentation');
  lacks('<div aria-hidden="true"><img src="a.png"></div>', 'missing-alt', 'aria-hidden image');
  eq(sev('<img src="a.png" alt="">', 'decorative-image'), 'notice', 'alt="" is valid decoration: notice only');
  has('<img src="a.png" alt="IMG_2041.JPG">', 'alt-filename');
  has('<img src="a.png" alt="image">', 'alt-generic');
  lacks('<img src="a.png" alt="Team photo at the 2024 summit">', 'alt-generic');
  has('<input type="image" src="go.png">', 'input-image-alt');
  has('<map><area href="/a"></map>', 'area-alt');
  has('<h1>a</h1><h3>b</h3>', 'skipped-heading');
  lacks('<h1>a</h1><h2>b</h2><h3>c</h3><h2>d</h2><h2>e</h2><h1>f</h1>', 'skipped-heading', 'going back up is fine');
  eq(sev('<h1>a</h1><h3>b</h3>', 'skipped-heading'), 'warning', 'skipped heading is a warning (best practice)');
  has('<h1>a</h1><div role="heading" aria-level="4">x</div>', 'skipped-heading', 'role=heading with aria-level');
  has('<h2></h2>', 'empty-heading');
  has('<h1>a</h1><h1>b</h1>', 'multiple-h1');
  has('<div role="foo">x</div>', 'invalid-role');
  has('<div role="widget">x</div>', 'invalid-role', 'abstract role');
  lacks('<div role="switch foo" aria-checked="true" aria-label="x">x</div>', 'invalid-role', 'fallback list with a valid token');
  lacks('<div role="BUTTON">OK</div>', 'invalid-role', 'roles are case-insensitive');
  lacks('<div role="doc-chapter">x</div>', 'invalid-role', 'DPUB role');
  has('<div role="checkbox" aria-label="x"></div>', 'missing-aria-attr');
  lacks('<input type="checkbox" role="checkbox" aria-label="x">', 'missing-aria-attr', 'native checkbox carries its own state');
  eq(run('<div role="slider" aria-label="v"></div>').errors.filter(i => i.rule === 'missing-aria-attr').map(i => i.description), ['role="slider" is missing aria-valuenow'], 'slider needs only valuenow in ARIA 1.2');
  lacks('<div role="progressbar"></div>', 'missing-aria-attr', 'progressbar requires nothing');
  has('<div role="combobox" aria-label="x"></div>', 'missing-aria-attr');
  has('<div aria-labeledby="x">x</div>', 'invalid-aria-attr', 'misspelt aria attribute');
  has('<div aria-describedby="nope">x</div>', 'broken-aria-reference');
  has('<div aria-hidden="true"><a href="/">x</a></div>', 'aria-hidden-focusable');
  lacks('<div aria-hidden="true"><a href="/" tabindex="-1">x</a></div>', 'aria-hidden-focusable');
  has('<table><tr><td>a</td><td>b</td></tr><tr><td>1</td><td>2</td></tr></table>', 'table-no-headers');
  lacks('<table role="presentation"><tr><td>a</td><td>b</td></tr><tr><td>1</td><td>2</td></tr></table>', 'table-no-headers', 'layout table');
  lacks('<table><tr><td>a</td></tr></table>', 'table-no-headers', 'one-cell table is not a data table');
  has('<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>', 'table-no-caption');
  lacks('<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>', 'th-no-scope', 'simple table needs no scope');
  has('<table><tr><td></td><th>Q1</th></tr><tr><th>Sales</th><td>2</td></tr></table>', 'th-no-scope', 'two-way table needs scope');
  has('<div onclick="go()">Go</div>', 'onclick-without-keyboard');
  has('<span tabindex="0" onclick="go()">Go</span>', 'onclick-no-role');
  lacks('<span tabindex="0" role="button" onclick="go()">Go</span>', 'onclick-no-role');
  lacks('<button onclick="go()">Go</button>', 'onclick-without-keyboard');
  lacks('<body onclick="x()"><p>x</p></body>', 'onclick-without-keyboard', 'handler on body');
  has('<span tabindex="3">x</span>', 'positive-tabindex');
  lacks('<span tabindex="0">x</span><span tabindex="-1">y</span>', 'positive-tabindex');
  has('<a href="javascript:void(0)">Open</a>', 'javascript-link');
  has('<a href=" JavaScript:go()">Open</a>', 'javascript-link', 'javascript: case-insensitive');
  has('<a href="/r">Click here</a>', 'generic-link-text', 'generic text with any href');
  has('<a href="/r">Read more…</a>', 'generic-link-text', 'trailing ellipsis');
  lacks('<a href="/r" aria-label="Read more about pricing">Read more</a>', 'generic-link-text');
  has('<p id="a">x</p><p id="a">y</p>', 'duplicate-id');
  eq(sev('<p id="a">x</p><p id="a">y</p>', 'duplicate-id'), 'notice', 'unreferenced duplicate id: notice');
  eq(sev('<label for="a">N</label><input id="a"><input id="a" aria-label="x">', 'duplicate-id'), 'error', 'duplicate id a label points to: error');
  has('<p lang="english">x</p>', 'invalid-lang');
}

if (suites.includes('document')) {
  section('document');
  eq(A.isFullDocument('<p>x</p>'), false, 'fragment');
  eq(A.isFullDocument('<!-- <html> --><p>x</p>'), false, 'html in a comment does not count');
  eq(A.isFullDocument('<!DOCTYPE html><p>x</p>'), true, 'doctype');
  eq(A.isFullDocument('<title>x</title>'), true, 'title');
  eq(rules(run('<p>x</p>')), [], 'clean fragment: nothing, no page-level noise');
  eq(rules(run(PAGE_OK('<p>x</p>'))), [], 'clean page: nothing');
  has('<html><title>t</title><main><h1>x</h1></main></html>', 'missing-lang');
  has('<html lang=""><title>t</title></html>', 'empty-lang');
  has('<html lang=" "><title>t</title></html>', 'empty-lang');
  has('<html lang="english"><title>t</title></html>', 'invalid-lang');
  for (const l of ['en', 'en-GB', 'de-CH-1996', 'zh-Hant-TW', 'sr-Latn', 'es-419', 'x-klingon', 'i-klingon'])
    check(A.validLang(l), 'valid lang ' + l);
  for (const l of ['english', 'en_GB', 'e', '123', 'en-', 'de--DE'])
    check(!A.validLang(l), 'invalid lang ' + l);
  has('<html lang="en"><head></head><body><p>x</p></body></html>', 'missing-title');
  has('<html lang="en"><title> </title></html>', 'empty-title');
  has('<html lang="en"><title>Untitled Document</title></html>', 'empty-title');
  lacks('<html lang="en"><title>Pricing – Acme</title></html>', 'empty-title');
  has('<html lang="en"><title>t</title><body><p>x</p></body></html>', 'missing-main');
  lacks('<html lang="en"><title>t</title><body><div role="main">x</div></body></html>', 'missing-main', 'role=main counts');
  has('<html lang="en"><title>t</title><main>a</main><main>b</main></html>', 'multiple-main');
  has('<html lang="en"><title>t</title><meta name="viewport" content="width=device-width, user-scalable=no"></html>', 'viewport-zoom-disabled');
  has('<html lang="en"><title>t</title><meta name="viewport" content="maximum-scale=1.0"></html>', 'viewport-zoom-disabled');
  lacks('<html lang="en"><title>t</title><meta name="viewport" content="width=device-width, initial-scale=1"></html>', 'viewport-zoom-disabled');
  has('<html lang="en"><title>t</title><meta http-equiv="refresh" content="30"></html>', 'meta-refresh');
  lacks('<html lang="en"><title>t</title><meta http-equiv="refresh" content="0; url=/new"></html>', 'meta-refresh', 'instant redirect is allowed');
  has('<html lang="en"><title>t</title><h2>x</h2></html>', 'first-heading-not-h1');
  const ps = run(PAGE_OK('<img src="a" alt="A"><label>N <input></label><a href="/">Home</a>')).passed;
  check(ps.includes('Page language is set (en)') && ps.includes('Every form field has a label') && ps.includes('1 link has text') && ps.includes('Every image has alt text or is marked decorative'), 'passed checks listed', JSON.stringify(ps));
  check(!run(PAGE_OK('<img src="a">')).passed.some(p => /image/.test(p)), 'failed check not listed as passed');
  check(!run('<p>x</p>').passed.some(p => /image|form|link/.test(p)), 'checks with nothing to look at are not claimed');
  eq(run('<h1>Book a table</h1><html lang="en"><title>Untitled</title></html>').errors.find(i => i.rule === 'empty-title').fix, '<title>Book a table</title>', 'title fix uses the h1');
  eq(run('<img src="logo.png">').errors[0].fix, '<img src="logo.png" alt="…">', 'alt fix keeps the tag as written');
  lacks('<h2>x</h2>', 'first-heading-not-h1', 'a fragment may start at h2');
}

if (suites.includes('locate')) {
  section('locate');
  const s = '<!doctype html>\n<html>\n<head><title>t</title></head>\n<body>\n<!-- <img src="c.png"> -->\n<script>let s = "<img>";</script>\n<p>x</p>\n<img src="a.png">\n\n<img src="b.png" alt="">\n</body></html>';
  const r = run(s);
  const alt = r.errors.find(i => i.rule === 'missing-alt');
  eq(alt.line, 8, 'line skips images in comments and scripts');
  eq(s.slice(alt.offset, alt.offset + alt.length), '<img src="a.png">', 'offset and length select the tag');
  eq(r.notices.find(i => i.rule === 'decorative-image').line, 10, 'second image line');
  eq(r.errors.find(i => i.rule === 'missing-lang').line, 2, '<html> line');
  eq(run('<img src="a.png">').errors[0].line, 1, 'single line');
  eq(run('<table><tr><td>a</td><td>b</td></tr><tr><td>1</td><td>2</td></tr></table>').warnings[0].line, 1, 'table line despite implied tbody');
  eq(run('<p>x</p><img src="x.png">').errors[0].code, '<img src="x.png">', 'snippet is the element');
  const long = run('<a href="/">' + '<span></span>'.repeat(40) + '</a>').errors[0].code;
  eq(long, '<a href="/">…', 'long element shortened to its start tag');
  const order = run('<img src="1"><div role="nope">x</div><img src="2">').errors.map(i => i.rule);
  eq(order, ['missing-alt', 'missing-alt', 'invalid-role'], 'same line: rule order');
  const ml = run('<img src="1">\n<div role="nope">x</div>\n<img src="2">').errors.map(i => i.line);
  eq(ml, [1, 2, 3], 'errors sorted by line');
}

if (suites.includes('edges')) {
  section('edges');
  eq(rules(run('')), [], 'empty');
  eq(rules(run('   \n\t ')), [], 'whitespace');
  eq(rules(run('just text')), [], 'plain text');
  const mal = rules(run('<div><p>unclosed <b>bold<a href="javascript:void(0)">click</a><div onclick="x()">y</div><span tabindex="3">t</span>'));
  eq(mal.sort(), ['generic-link-text', 'javascript-link', 'onclick-without-keyboard', 'positive-tabindex'].sort(), 'malformed markup still checked');
  eq(rules(run('<html lang="ja"><title>日本語 😀</title><main><h1>こんにちは</h1><a href="/x">詳細を見る</a><button>✓</button></main></html>')).filter(r => !/missing-(header|nav)/.test(r)), [], 'non-ASCII page');
  has('<img src="x" alt="😀.png">', 'alt-filename', 'emoji in alt does not throw');
  const big = '<p>x</p>'.repeat(200000) + '<img src=z>';
  const t0 = Date.now();
  const rb = run(big);
  const dt = Date.now() - t0;
  eq(rb.errors.map(i => i.rule), ['missing-alt'], '200 000 elements: still finds the one image');
  check(dt < 20000, `200 000 elements in ${dt} ms`);
  eq(rules(run('<<<>>><img/src=x>')), ['missing-alt'], 'garbage around a tag');
  eq(run('<p>x</p>').meta.fullDocument, false, 'meta reports fragment');
  const steps = [...A.auditSteps(parse('<img src=a>'), {source: '<img src=a>', fullDocument: false})];
  check(steps.length >= A.RULES_COUNT && steps.every(s => s.done >= 0 && s.done <= 1), 'auditSteps reports progress in [0,1]');
  const rd = A.renderable(parse('<!doctype html><img src="x.png" onerror="alert(1)"><link rel="stylesheet" href="a.css"><script src="a.js"></script><p style="background:url(x.png)">t</p><meta http-equiv="refresh" content="5">'));
  check(!/\ssrc=|\shref=|\sonerror=|url\(x/.test(rd) && /type="text\/x-inert"/.test(rd), 'render copy has no fetchable or runnable attribute', rd);
  const rr = run(rd.replace(/^<!DOCTYPE html>/, ''), {fullDocument: true});
  check(rules(rr).includes('meta-refresh'), 'meta refresh still detected on the render copy');
  eq(A.sandboxSource('<!doctype html><p>x</p>').indexOf('<meta'), 15, 'CSP goes after the doctype');
  eq(A.sandboxSource('<p>x</p>').indexOf('<meta'), 0, 'CSP first without doctype');
}

if (suites.includes('output')) {
  section('output');
  const r = run('<img src="a.png" alt="=HYPERLINK(&quot;x&quot;)">\n<input>');
  const csv = A.toCSV(r);
  eq(csv.split('\r\n')[0], 'Severity,Rule,WCAG,Line,Element,Issue,How to fix,Code', 'CSV header names its columns');
  check(csv.includes('"Fails WCAG"') || csv.includes('Fails WCAG,'), 'severity in plain words');
  check(!/,=HYPERLINK/.test(csv) && !/,"=HYPERLINK/.test(csv), 'formula-looking cells are defused', csv);
  check(/"[^"]*""[^"]*"/.test(A.toCSV(run('<p id="a&quot;b">x</p><p id="a&quot;b">y</p>'))), 'quotes doubled');
  const h = A.toHTML(run('<img src="x.png" alt="<script>alert(1)</script>.png">'), {date: '2026-10-17'});
  check(!/<script>alert/.test(h), 'HTML report escapes content');
  const t = A.toText(r, {});
  check(/^Accessibility check\n\d+ fail WCAG/.test(t) && /Fix: /.test(t) && !/Suggestion: Suggestion/.test(t), 'text report', t);
  const issue = r.errors[0];
  eq(Object.keys(issue).filter(k => ['type', 'element', 'description', 'suggestion', 'code', 'fix'].includes(k)).length, 6, 'JSON issues keep the old fields (type, element, description, suggestion, code, fix)');
  eq(issue.sc && issue.sc.url, 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html'.replace('labels-or-instructions', issue.sc.url.split('/').pop().replace('.html', '')), 'SC link points to WCAG 2.2 Understanding');
}

if (suites.includes('browser')) {
  section('browser');
  let chromium;
  try { ({chromium} = await import('playwright-core')); } catch (e) { try { ({chromium} = await import('playwright')); } catch (e2) { console.log('  skip: npm i --no-save playwright-core@1.64.1'); } }
  if (chromium) {
    const b = await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});
    const p = await b.newPage();
    const errs = [], ext = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', e => errs.push(String(e)));
    p.on('request', r => { const u = r.url(); if (!u.startsWith('http://localhost:8099') && !u.startsWith('data:') && !u.startsWith('about:') && !u.startsWith('blob:')) ext.push(u); });
    try {
      await p.goto('http://localhost:8099/tools/web_accessibility_checker.html');
      await p.evaluate(() => localStorage.clear());
      await p.reload();
      await p.waitForFunction(() => document.querySelector('#ne').textContent !== '0' && document.querySelector('#ne').textContent !== '–', null, {timeout: 8000});
      const first = await p.$$eval('.it.error h3', h => h.map(x => x.textContent));
      check(first.some(t => /Text contrast 2\.84:1 is below 4\.5:1/.test(t)), 'example: <style> contrast measured (#999 on white = 2.84 truncated)', JSON.stringify(first));
      check(first.some(t => /3\.44:1 is below 4\.5:1: #ffffff on #2f9e44/.test(t)), 'example: class-styled button contrast', JSON.stringify(first));
      await p.fill('#src', '<!doctype html><html lang="en"><head><title>T</title><link rel="stylesheet" href="https://cdn.example.com/x.css"><style>body{background:url(https://example.com/bg.png)}</style></head><body><main><h1>x</h1><img src="https://example.com/a.png" alt="A"><iframe src="https://example.com" title="x"></iframe><script src="https://example.com/x.js"></script><p style="color:#eee">faint</p></main></body></html>');
      await p.waitForTimeout(1500);
      eq(ext, [], 'checking makes no request outside the page');
      const h3 = await p.$$eval('.it h3', h => h.map(x => x.textContent));
      check(h3.some(t => /Contrast could not be measured: background image/.test(t)), 'background image reported as unmeasurable', JSON.stringify(h3));
      await p.fill('#src', '<p>a</p>'.repeat(5) + '\n<img src="q.png">');
      await p.waitForTimeout(900);
      await p.click('.ln');
      eq(await p.evaluate(() => [document.querySelector('#src').selectionStart, document.querySelector('#src').selectionEnd]), [41, 58], 'Line button selects the tag');
      await p.reload();
      eq(await p.inputValue('#src'), '<p>a</p>'.repeat(5) + '\n<img src="q.png">', 'input survives reload');
      eq(errs, [], 'no console errors');
    } catch (e) { check(false, 'browser run', String(e)); }
    await b.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
