#!/usr/bin/env node
// Test suite for tools/pdf_merger.html (PDF Merger).
//
// Runs the page's DOM-free <script id="core"> block in Node. A merger promises that the file it hands
// back holds exactly the pages asked for, in the order shown, turned the way shown, and that a range
// like "1-3, 5, 8-" means what a person means by it. The merge suite builds source PDFs whose every
// page has its own size, merges them with pdf-lib (the library the page loads) and reads the result
// back page by page. No browser, no server.
//
//   npm i --no-save pdf-lib@1.17.1   # once, for the inspect and merge suites
//   node test/pdf_merger.mjs              # everything
//   node test/pdf_merger.mjs ranges       # named suites only
//
// Suites: sniff, ranges, plan, names, inspect, merge.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'pdf_merger.html');
const ALL = ['sniff', 'ranges', 'plan', 'names', 'inspect', 'merge'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => { const g = JSON.stringify(got), w = JSON.stringify(want); check(g === w, what, `got ${g}, want ${w}`); };
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
// Run in this realm, not a vm context: pdf-lib checks `instanceof Array` on what the core hands it.
const module_ = {exports: {}};
new Function('module', src)(module_);
const C = module_.exports;

let PDFLib = null;
for (const base of [join(HERE, '..'), process.env.PDFLIB_DIR || '/tmp/claude-0/deps']) {
  try { PDFLib = createRequire(join(base, 'x.js'))('pdf-lib'); break; } catch (e) {}
}

const enc = s => new TextEncoder().encode(s);
const pages = (t, n) => { const r = C.parseRange(t, n); return r.ok ? Array.from(r.pages, p => p + 1) : 'ERR'; };

if (suites.includes('sniff')) {
  section('sniff');
  check(C.isPdf(enc('%PDF-1.7\n...')), 'plain header');
  check(C.isPdf(enc('\xEF\xBB\xBF   junk\r\n%PDF-1.4')), 'leading junk within 1024 bytes (readers accept it)');
  check(!C.isPdf(enc(' '.repeat(1100) + '%PDF-1.4')), 'header past 1024 bytes is not a PDF');
  check(!C.isPdf(enc('\x89PNG\r\n\x1a\n')), 'PNG is not a PDF');
  check(!C.isPdf(enc('')), 'empty file');
  check(!C.isPdf(enc('%PDF')), 'truncated header');
  check(!C.isPdf(enc('%pdf-1.4')), 'lower case is not the header');
}

if (suites.includes('ranges')) {
  section('ranges');
  eq(pages('', 4), [1, 2, 3, 4], 'empty is all');
  eq(pages('   ', 4), [1, 2, 3, 4], 'whitespace is all');
  eq(pages('all', 3), [1, 2, 3], 'all');
  eq(pages('ALL', 2), [1, 2], 'All in caps');
  eq(pages('1-3, 5', 6), [1, 2, 3, 5], 'range and single');
  eq(pages('8-', 10), [8, 9, 10], 'open end');
  eq(pages('-3', 10), [1, 2, 3], 'open start');
  eq(pages('5-1', 6), [5, 4, 3, 2, 1], 'descending run reverses');
  eq(pages('3,1,2', 3), [3, 1, 2], 'order as written');
  eq(pages('1,1', 3), [1, 1], 'a page twice stays twice');
  eq(pages('1 3 5', 5), [1, 3, 5], 'spaces separate');
  eq(pages('1;2', 5), [1, 2], 'semicolons separate');
  eq(pages('1 - 3', 5), [1, 2, 3], 'spaces round the dash');
  eq(pages('1–3', 5), [1, 2, 3], 'en dash (what Word types)');
  eq(pages('1—3', 5), [1, 2, 3], 'em dash');
  eq(pages('1−3', 5), [1, 2, 3], 'Unicode minus');
  eq(pages('１-３', 5), [1, 2, 3], 'fullwidth digits');
  eq(pages('2-last', 4), [2, 3, 4], 'last');
  eq(pages('last', 4), [4], 'last alone');
  eq(pages('pages 2-3', 4), [2, 3], '"pages" prefix');
  eq(pages('p. 2', 4), [2], '"p." prefix');
  eq(pages('2 to 3', 4), [2, 3], '"to"');
  eq(pages('1,,2,', 4), [1, 2], 'stray commas');
  eq(pages('007', 9), [7], 'leading zeros');
  eq(pages('1', 1), [1], 'one-page file');
  eq(pages('0', 3), 'ERR', 'page 0');
  eq(pages('4', 3), 'ERR', 'past the end');
  eq(pages('2-9', 3), 'ERR', 'range past the end');
  eq(pages('-', 3), 'ERR', 'lone dash');
  eq(pages('1-2-3', 5), 'ERR', 'double range');
  eq(pages('x', 3), 'ERR', 'letters');
  eq(pages('1.5', 3), 'ERR', 'decimal');
  eq(pages('-1', 3), [1], '-1 is "up to 1", as in print dialogs');
  const r = C.parseRange('2-9, x', 3);
  check(!r.ok && /2-9/.test(r.error) && /"x"/.test(r.error) && /3 pages/.test(r.error), 'error names every bad part and the page count', r.error);
  check(!/\b5\b|8-/.test(r.error), 'the example in the error fits the file', r.error);
  const big = C.parseRange('1-100000', 100000);
  check(big.ok && big.pages.length === 100000, 'a 100,000-page range');
  eq(pages('1-3', 0), 'ERR', 'no pages at all');
}

if (suites.includes('plan')) {
  section('plan');
  const S = [{id: 'a', pages: 3, range: '', rotate: 0}, {id: 'b', pages: 2, range: '2', rotate: 90},
             {id: 'c', pages: 5, range: 'oops', rotate: 0}, {id: 'd', pages: 4, broken: true}];
  eq(C.plan(S).map(s => s.id + (s.page + 1) + '@' + s.rotate), ['a1@0', 'a2@0', 'a3@0', 'b2@90'], 'invalid and broken files contribute nothing');
  eq(C.plan([{id: 'c', pages: 5, range: '9', lastGood: '2-3'}]).map(s => [s.page + 1, !!s.stale]), [[2, true], [3, true]], 'invalid range shows the last good one, marked stale');
  eq(C.plan([{id: 'x', pages: 1, range: '', rotate: -90}])[0].rotate, 270, 'rotation normalised');
  eq(C.plan([{id: 'x', pages: 1, range: '', rotate: 450}])[0].rotate, 90, 'rotation wraps');
  eq(C.plan([]), [], 'no files, no pages');
}

if (suites.includes('names')) {
  section('names');
  eq(C.fileName(''), 'merged.pdf', 'empty');
  eq(C.fileName('  '), 'merged.pdf', 'spaces');
  eq(C.fileName('report'), 'report.pdf', 'adds .pdf');
  eq(C.fileName('report.PDF'), 'report.pdf', 'no double extension');
  eq(C.fileName('a.pdf.pdf'), 'a.pdf', 'repeated extension');
  eq(C.fileName('Q3/Q4: final?'), 'Q3 Q4 final.pdf', 'characters no file system takes');
  eq(C.fileName('..\\..\\etc'), 'etc.pdf', 'no path tricks');
  eq(C.fileName('Überweisung März'), 'Überweisung März.pdf', 'non-ASCII kept');
  eq(C.fileName('x'.repeat(300)).length, 124, 'long names cut to 120 + .pdf');
  eq(C.bytesLabel(0), '0 B', '0 bytes');
  eq(C.bytesLabel(1023), '1023 B', 'under a KB');
  eq(C.bytesLabel(1536), '1.5 KB', 'KB with a decimal');
  eq(C.bytesLabel(50 * 1024 * 1024), '50 MB', 'MB');
}

async function sized(dims) {
  const d = await PDFLib.PDFDocument.create();
  for (const [w, h] of dims) d.addPage([w, h]);
  return d.save({useObjectStreams: false});
}
const sizes = async bytes => (await PDFLib.PDFDocument.load(bytes)).getPages().map(p => {
  const {width, height} = p.getSize(); return [Math.round(width), Math.round(height), p.getRotation().angle];
});

if (suites.includes('inspect') || suites.includes('merge')) {
  if (!PDFLib) { console.log('\n(pdf-lib not installed: inspect and merge skipped - npm i --no-save pdf-lib@1.17.1)'); }
}

if (PDFLib && suites.includes('inspect')) {
  section('inspect');
  eq(await C.inspect(PDFLib, await sized([[100, 200], [101, 200]])), {ok: true, pages: 2}, 'two pages');
  eq(await C.inspect(PDFLib, enc('hello')), {ok: false, why: 'notpdf'}, 'text file');
  eq(await C.inspect(PDFLib, enc('%PDF-1.4\n%%garbage that is no PDF at all')), {ok: false, why: 'corrupt'}, 'header with nothing behind it');
  // An encrypted file: give a real PDF an /Encrypt entry in its trailer.
  const d = await PDFLib.PDFDocument.create(); d.addPage([100, 100]);
  const encRef = d.context.register(d.context.obj({Filter: 'Standard', V: 1, R: 2, O: PDFLib.PDFHexString.of('00'), U: PDFLib.PDFHexString.of('00'), P: -4}));
  d.context.trailerInfo.Encrypt = encRef;
  const locked = await d.save({useObjectStreams: false});
  check(/\/Encrypt/.test(new TextDecoder('latin1').decode(locked)), 'test file really has /Encrypt');
  eq(await C.inspect(PDFLib, locked), {ok: false, why: 'locked'}, 'encrypted file is refused, not merged garbled');
}

if (PDFLib && suites.includes('merge')) {
  section('merge');
  const A = await sized([[101, 300], [102, 300], [103, 300]]);
  const B = await sized([[201, 400], [202, 400]]);
  const R = await sized([[301, 500]]);
  // a page already rotated in its source
  const rd = await PDFLib.PDFDocument.load(R); rd.getPage(0).setRotation(PDFLib.degrees(90)); const R90 = await rd.save();
  const src = {a: A, b: B, r: R90};
  const run = async (S, opts) => sizes(await C.merge(PDFLib, src, C.plan(S), opts));
  eq(await run([{id: 'a', pages: 3, range: ''}, {id: 'b', pages: 2, range: ''}]),
     [[101, 300, 0], [102, 300, 0], [103, 300, 0], [201, 400, 0], [202, 400, 0]], 'everything, in order');
  eq(await run([{id: 'b', pages: 2, range: ''}, {id: 'a', pages: 3, range: ''}]).then(x => x.map(p => p[0])),
     [201, 202, 101, 102, 103], 'reordered files');
  eq(await run([{id: 'a', pages: 3, range: '3, 1'}, {id: 'b', pages: 2, range: '2'}]).then(x => x.map(p => p[0])),
     [103, 101, 202], 'page picks in the order written');
  eq(await run([{id: 'a', pages: 3, range: '1-2', rotate: 90}]).then(x => x.map(p => p[2])), [90, 90], 'rotation applied');
  eq(await run([{id: 'r', pages: 1, range: '', rotate: 90}]).then(x => x[0][2]), 180, 'rotation adds to a page already turned');
  eq(await run([{id: 'r', pages: 1, range: '', rotate: 270}]).then(x => x[0][2]), 0, 'and wraps to 0');
  eq(await run([{id: 'a', pages: 3, range: '1'}, {id: 'b', pages: 2, range: ''}, {id: 'a', pages: 3, range: '2'}]).then(x => x.map(p => p[0])),
     [101, 201, 202, 102], 'the same file twice');
  const one = await C.merge(PDFLib, src, C.plan([{id: 'a', pages: 3, range: '2'}]), {title: 'Kündigung'});
  eq((await PDFLib.PDFDocument.load(one)).getTitle(), 'Kündigung', 'title set from the file name');
  let prog = [];
  await C.merge(PDFLib, src, C.plan([{id: 'a', pages: 3, range: ''}, {id: 'b', pages: 2, range: ''}]), {onProgress: (d, t) => prog.push(d + '/' + t)});
  eq(prog, ['1/5', '2/5', '3/5', '4/5', '5/5'], 'progress counts every page once');
  // sources are left untouched (the page keeps them for the next merge)
  eq(await sizes(A), [[101, 300, 0], [102, 300, 0], [103, 300, 0]], 'source bytes unchanged');
  // a large job: 60 files of 50 pages
  const big = await sized(Array.from({length: 50}, (_, i) => [100 + i, 200]));
  const many = {}; const S = [];
  for (let i = 0; i < 60; i++) { many['f' + i] = big; S.push({id: 'f' + i, pages: 50, range: ''}); }
  const t0 = Date.now(); const out = await C.merge(PDFLib, many, C.plan(S));
  const n = (await PDFLib.PDFDocument.load(out)).getPageCount();
  eq(n, 3000, '3,000 pages from 60 files');
  console.log(`  (3,000 pages in ${Date.now() - t0} ms)`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
