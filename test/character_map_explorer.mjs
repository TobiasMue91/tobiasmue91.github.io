#!/usr/bin/env node
// Test suite for tools/character_map_explorer.html (Character Map).
//
// Runs the page's DOM-free <script id="core"> block in Node against the real data file,
// data/character_map/unicode.txt (built by util/character_map/build.py from the Unicode 17.0 UCD, the WHATWG
// entity list and CLDR). A character map promises that the name it shows is the official one, that every notation
// it hands out spells exactly that code point, and that whatever people type or paste (U+2192, &rarr;, →,
// %E2%86%92, bare digits, the character itself, a typo) is read the way they meant. No browser, no server.
//
//   node test/character_map_explorer.mjs             # everything
//   node test/character_map_explorer.mjs names parse # named suites only
//
// Suites:
//   data       the file parses, holds Unicode 17.0's 159,801 characters, blocks cover what they should
//   names      published names and code point labels (Unicode §4.8), Hangul names by §3.12's algorithm
//   cross      every name against Python's unicodedata (an independent copy of the UCD, older version), skipped
//              when python3 is missing
//   notations  every notation decoded again by an independent implementation (Buffer, JSON.parse, eval of JS
//              escapes, decodeURIComponent, the HTML entity list)
//   parse      what people type: every notation, sequences, bare digits, pasted text, errors and typos
//   search     the characters people look for come first
//   text       pasted text taken apart: grapheme clusters, invisibles, huge input
//   storage    the old page's saved favourites and recents are migrated, corrupt values ignored
//   page       in Chromium at phone size, served by a throwaway static server: the worked example on arrival, typing,
//              copying to the clipboard, a pasted invisible found, a typo's suggestion, an impossible code,
//              #U+1F600 links, the old page's favourites, the query surviving a reload, arrow keys, no console
//              errors and no request leaving the page. Skipped when Playwright is missing.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {spawnSync} from 'child_process';
import vm from 'vm';
import http from 'http';
import {createRequire} from 'module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ALL = ['data', 'names', 'cross', 'notations', 'parse', 'search', 'text', 'storage', 'page'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(join(ROOT, 'tools', 'character_map_explorer.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, TextDecoder, Uint8Array, Intl};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;
const db = C.parseData(readFileSync(join(ROOT, 'data', 'character_map', 'unicode.txt'), 'utf8'));
C.buildIndex(db);
const U = cp => C.uplus(cp);
const name = cp => C.info(db, cp).name;
const P = q => { const r = C.parseQuery(q, db); return r; };

if (suites.includes('data')) {
  section('data');
  eq(db.version, '17.0.0', 'Unicode version');
  // Unicode 17.0 encodes 159,801 graphic and format characters; add the 65 controls
  let graphicFormat = 0, controls = 0;
  for (let cp = 0; cp <= 0x10FFFF; cp++) {
    const gc = C.info(db, cp).gc;
    if (gc === 'Cc') controls++;
    else if (gc !== 'Cn' && gc !== 'Co' && gc !== 'Cs') graphicFormat++;
  }
  eq(graphicFormat, 159801, 'graphic and format characters in Unicode 17.0');
  eq(controls, 65, 'control characters');
  eq(db.blocks.length > 330, true, 'blocks listed');
  eq(C.blockOf(db, 0x2192).name, 'Arrows', 'U+2192 in Arrows');
  eq(C.blockOf(db, 0x1F600).name, 'Emoticons', 'U+1F600 in Emoticons');
  eq(C.blockOf(db, 0x10FFFF).name, 'Supplementary Private Use Area-B', 'U+10FFFF block');
  eq(C.info(db, 0x50000).block, 'No block', 'unallocated plane 5 has no block');
  eq(C.blockChars(db, C.blockOf(db, 0x0000)).length, 128, 'Basic Latin browses all 128');
  eq(C.blockChars(db, C.blockOf(db, 0x0370)).includes(0x0378), false, 'browsing leaves unassigned code points out');
  eq(C.blockChars(db, C.blockOf(db, 0xD800)).length, 0, 'surrogates are not browsable characters');
  eq(db.entities.get(0x2192)[0], 'rarr', 'shortest entity name first');
  eq(db.entityCp.get('Eacute'), 0xC9, 'entity names are case-sensitive: Eacute');
  eq(db.entityCp.get('eacute'), 0xE9, 'entity names are case-sensitive: eacute');
}

if (suites.includes('names')) {
  section('names');
  const V = [
    [0x41, 'LATIN CAPITAL LETTER A'], [0xE9, 'LATIN SMALL LETTER E WITH ACUTE'], [0x2192, 'RIGHTWARDS ARROW'],
    [0x2014, 'EM DASH'], [0x1F600, 'GRINNING FACE'], [0x1F44D, 'THUMBS UP SIGN'], [0x20C0, 'SOM SIGN'],
    [0x0301, 'COMBINING ACUTE ACCENT'], [0x200B, 'ZERO WIDTH SPACE'], [0xFEFF, 'ZERO WIDTH NO-BREAK SPACE'],
    [0x10FFFD, '<private-use-10FFFD>'], [0xE000, '<private-use-E000>'], [0xD800, '<surrogate-D800>'], [0xDFFF, '<surrogate-DFFF>'],
    [0x0378, '<reserved-0378>'], [0x50000, '<reserved-50000>'], [0xFFFE, '<noncharacter-FFFE>'], [0xFDD0, '<noncharacter-FDD0>'],
    [0x10FFFF, '<noncharacter-10FFFF>'], [0x1FFFF, '<noncharacter-1FFFF>'],
    [0x0000, '<NULL>'], [0x000A, '<LINE FEED>'], [0x007F, '<DELETE>'], [0x0080, '<control-0080>'], [0x0085, '<NEXT LINE>'],
    [0x4E00, 'CJK UNIFIED IDEOGRAPH-4E00'], [0x9FFF, 'CJK UNIFIED IDEOGRAPH-9FFF'], [0x20000, 'CJK UNIFIED IDEOGRAPH-20000'],
    [0x323B0, 'CJK UNIFIED IDEOGRAPH-323B0'], [0xF900, 'CJK COMPATIBILITY IDEOGRAPH-F900'], [0x17000, 'TANGUT IDEOGRAPH-17000'],
    [0x18B00, 'KHITAN SMALL SCRIPT CHARACTER-18B00'], [0x1B170, 'NUSHU CHARACTER-1B170'],
    // Unicode §3.12 worked example, and the ends of the Hangul range
    [0xD4DB, 'HANGUL SYLLABLE PWILH'], [0xAC00, 'HANGUL SYLLABLE GA'], [0xD7A3, 'HANGUL SYLLABLE HIH'], [0xC544, 'HANGUL SYLLABLE A'],
  ];
  for (const [cp, n] of V) eq(name(cp), n, U(cp));
  eq(C.info(db, 0x0378).gc, 'Cn', 'unassigned is Cn');
  eq(C.info(db, 0xE9).upper, 0xC9, 'é uppercases to É');
  eq(C.info(db, 0xC9).lower, 0xE9, 'É lowercases to é');
  eq(C.info(db, 0x0000).aliases.includes('NUL'), true, 'NULL has its abbreviation');
  eq(C.info(db, 0x01A2).aliases.includes('LATIN CAPITAL LETTER GHA'), true, 'name corrections are aliases (U+01A2)');
  eq(C.info(db, 0x1F600).keywords.includes('smile'), true, 'CLDR keywords for 😀');
  eq(C.display(C.info(db, 0x0301)).text, '◌́', 'combining marks shown on a dotted circle');
  eq(C.display(C.info(db, 0x0007)).text, '␇', 'C0 controls shown as control pictures');
  eq(C.display(C.info(db, 0x200B)).kind, 'invisible', 'ZWSP is invisible');
  eq(C.display(C.info(db, 0x200B)).text, 'ZWSP', 'ZWSP labelled with its abbreviation');
  eq(C.display(C.info(db, 0x00A0)).kind, 'space', 'NBSP is a space');
  eq(C.display(C.info(db, 0xD800)).kind, 'none', 'nothing to draw for a surrogate');
  eq(C.findName(db, 'em dash'), 0x2014, 'find by name, any case');
  eq(C.findName(db, 'LATIN CAPITAL LETTER GHA'), 0x01A2, 'find by alias');
  eq(C.findName(db, 'HANGUL SYLLABLE PWILH'), 0xD4DB, 'find a Hangul name');
  eq(C.findName(db, 'CJK UNIFIED IDEOGRAPH-4E00'), 0x4E00, 'find an ideograph name');
  eq(C.findName(db, 'CJK UNIFIED IDEOGRAPH-A000'), undefined, 'an ideograph name outside the ideographs is no name');
}

if (suites.includes('cross')) {
  section('cross');
  const py = spawnSync('python3', ['-c', `
import unicodedata, sys
out = []
for cp in range(0x110000):
    n = unicodedata.name(chr(cp), '')
    if n: out.append('%X;%s;%s' % (cp, n, unicodedata.category(chr(cp))))
sys.stdout.write(unicodedata.unidata_version + '\\n' + '\\n'.join(out))`], {encoding: 'utf8', maxBuffer: 1 << 26});
  if (py.status !== 0) console.log('  skipped: python3 not available');
  else {
    const [ver, ...lines] = py.stdout.split('\n');
    let same = 0, diff = [];
    for (const l of lines) {
      const [h, n, gc] = l.split(';'), cp = parseInt(h, 16), i = C.info(db, cp);
      // a name only changes by correction alias, never in place (Unicode name stability), so any mismatch is ours
      if (i.name === n && i.gc === gc) same++;
      else if (!(i.gc !== gc && i.name === n)) diff.push(`${h} ours ${i.name}/${i.gc}, python ${n}/${gc}`);
    }
    check(diff.length === 0, `names agree with Python's unicodedata ${ver} (${same} checked)`, diff.slice(0, 5).join('\n          '));
    check(same > 140000, 'cross-check covered most of Unicode', String(same));
  }
}

if (suites.includes('notations')) {
  section('notations');
  const cps = [0x0, 0x9, 0x22, 0x27, 0x3C, 0x41, 0x5C, 0x7F, 0x80, 0xA0, 0xE9, 0x7FF, 0x800, 0x2192, 0xFFFD, 0xFFFF, 0x10000, 0x1F600, 0x10FFFF];
  for (let cp = 0; cp <= 0x10FFFF; cp += 4093) if (!C.isSurrogate(cp)) cps.push(cp);
  for (const cp of cps) {
    const n = C.notations(cp, C.info(db, cp)), ch = String.fromCodePoint(cp);
    eq(n.char, ch, `${U(cp)} char`);
    eq(n.utf8, Buffer.from(ch, 'utf8').toString('hex').toUpperCase().match(/../g).join(' '), `${U(cp)} UTF-8`);
    eq(decodeURIComponent(n.url), ch, `${U(cp)} URL`);
    eq(n.url, encodeURIComponent(ch).replace(/^[A-Za-z0-9\-_.!~*'()]$/, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')), `${U(cp)} URL matches encodeURIComponent`);
    eq(JSON.parse('"' + n.json + '"'), ch, `${U(cp)} JSON`);
    eq(vm.runInNewContext('"' + n.js + '"'), ch, `${U(cp)} JavaScript`);
    eq(vm.runInNewContext('"' + n.jsPair + '"'), ch, `${U(cp)} JavaScript UTF-16`);
    eq(vm.runInNewContext('"' + n.rust + '"'), ch, `${U(cp)} Rust/Swift form also valid JS`);
    eq(n.htmlDec, `&#${cp};`, `${U(cp)} HTML decimal`);
    eq(parseInt(n.htmlHex.slice(3), 16), cp, `${U(cp)} HTML hex`);
    eq(n.utf16, (cp < 0x10000 ? [cp] : [0xD800 + ((cp - 0x10000) >> 10), 0xDC00 + ((cp - 0x10000) & 0x3FF)]).map(u => C.hex(u)).join(' '), `${U(cp)} UTF-16`);
    eq(parseInt(n.css.slice(1), 16), cp, `${U(cp)} CSS`);
    eq(+n.decimal, cp, `${U(cp)} decimal`);
  }
  // every named HTML reference handed out must name the same code point in the WHATWG list
  let bad = 0;
  for (const [cp, list] of db.entities) for (const e of list) if (db.entityCp.get(e) !== cp) bad++;
  eq(bad, 0, 'entity names map back to their code point');
  eq(C.notations(0xE9, C.info(db, 0xE9)).html, '&eacute;', 'é named entity');
  eq(C.notations(0x20AC, C.info(db, 0x20AC)).html, '&euro;', '€ named entity (the old page had none)');
  eq(C.notations(0x1F600, C.info(db, 0x1F600)).html, '&#128512;', 'no named entity: decimal reference');
  eq(C.notations(0x1F600, C.info(db, 0x1F600)).js, '\\u{1F600}', 'astral JS uses \\u{} (the old page wrote \\u1F600, wrong)');
  eq(C.notations(0x1F600, C.info(db, 0x1F600)).python, '\\U0001f600', 'astral Python uses \\U');
  eq(C.notations(0xE9, C.info(db, 0xE9)).pythonName, '\\N{LATIN SMALL LETTER E WITH ACUTE}', 'Python \\N{}');
  eq(C.notations(0x0378, C.info(db, 0x0378)).pythonName, '', 'no \\N{} without a name');
  eq(C.notations(0x22, C.info(db, 0x22)).json, '\\"', 'JSON escapes the quote');
  eq(C.notations(0x41, C.info(db, 0x41)).json, 'A', 'JSON leaves ASCII alone');
  const s = C.notations(0xD800, C.info(db, 0xD800));
  eq([s.char, s.utf8, s.url, s.html], ['', '', '', ''], 'a lone surrogate has no character, UTF-8 or HTML');
}

if (suites.includes('parse')) {
  section('parse');
  const code = (q, cps, how) => { const r = P(q); eq([r.kind, r.cps, how ? r.how : undefined], ['code', cps, how], `“${q}”`); };
  code('U+00E9', [0xE9], 'code point');
  code('u+e9', [0xE9]);
  code('  U+1F600  ', [0x1F600]);
  code('U+0041 U+030A', [0x41, 0x30A]);
  code('U+0041,U+030A', [0x41, 0x30A]);
  code('U+10FFFF', [0x10FFFF]);
  code('0x2192', [0x2192], 'hex number');
  code('&#233;', [0xE9], 'HTML reference');
  code('&#xE9;', [0xE9]);
  code('&#XE9', [0xE9]);
  code('&eacute;', [0xE9]);
  code('&Eacute;', [0xC9]);
  code('&rarr;&larr;', [0x2192, 0x2190]);
  code('&nbsp', [0xA0]);
  code('\\u00e9', [0xE9], 'escape');
  code('\\uD83D\\uDE00', [0x1F600]);
  code('\\u{1F600}', [0x1F600]);
  code('\\U0001F600', [0x1F600]);
  code('\\x41', [0x41]);
  code('\\N{EM DASH}', [0x2014]);
  code('\\E9', [0xE9], 'CSS escape');
  code('\\00E9 ', [0xE9], 'CSS escape');
  code('\\1F600', [0x1F600]);
  code('%E2%86%92', [0x2192], 'URL encoding');
  code('%c3%a9', [0xE9]);
  code('E2 86 92', [0x2192], 'UTF-8 bytes');
  code('F0 9F 98 80', [0x1F600]);
  const num = (q, cps) => { const r = P(q); eq([r.kind, r.cps], ['number', cps], `bare “${q}”`); };
  num('233', [0xE9, 0x233]);       // three digits: decimal first (Alt codes, &#233;)
  num('65', [65, 0x65]);
  num('2192', [0x2192, 2192]);     // four or more: hex first
  num('1F600', [0x1F600]);
  num('e9', [0xE9]);
  num('0', [0]);
  num('1114111', [1114111]);       // 7 digits: too big as hex, fine as decimal
  const err = (q, re) => { const r = P(q); check(r.kind === 'error' && re.test(r.error), `error for “${q}”`, JSON.stringify(r)); };
  err('U+110000', /past the last code point/);
  err('0x110000', /past/);
  err('&#1114112;', /past/);
  err('\\u{110000}', /past/);
  err('&foo;', /not an HTML entity name/);
  err('%C3', /not valid UTF-8/);
  err('\\N{NO SUCH THING}', /No character is named/);
  eq(P('9999999').kind, 'error', 'seven-digit number past both readings');
  const typo = P('&eacut;');
  eq([typo.suggest, typo.suggestCp], ['&eacute;', 0xE9], 'typo &eacut; suggests &eacute;');
  eq(P('&EACUTE;').suggest, '&Eacute;', 'wrong case suggests the real one');
  eq(P('&zzzzzzzz;').suggest, null, 'no wild suggestions');
  eq(C.parseQuery('&eacute;', null).loading, true, 'entity names wait for the data');
  const kind = (q, k) => eq(P(q).kind, k, `“${q}” is ${k}`);
  kind('', 'empty'); kind('   ', 'empty'); kind('\n\t', 'empty');
  kind('arrow', 'words'); kind('check mark', 'words'); kind('left-pointing', 'words'); kind("it's", 'words');
  kind('é', 'text'); kind('<', 'text'); kind('café', 'text'); kind('😀', 'text'); kind(' ', 'text'); kind('​', 'text');
  kind('-', 'text'); kind('\\qq', 'text'); kind('&', 'text');
  eq(P('   ').cps, [0xA0], 'a lone pasted NBSP survives trimming');
  eq(P('a').single, 0x61, 'one letter is also that letter');
  eq(P('naïve café').cps.length, 10, 'pasted text keeps every code point');
  eq(P('é').cps, [0x65, 0x301], 'decomposed text is not normalised');
}

if (suites.includes('search')) {
  section('search');
  const first = (q, cp) => { const r = C.search(db, q.toUpperCase().split(' '), Infinity, q); eq(r.hits[0], cp, `“${q}” → ${U(cp)}`); };
  const within = (q, cp, n) => { const r = C.search(db, q.split(' ')); const i = r.hits.indexOf(cp); check(i >= 0 && i < n, `“${q}” finds ${U(cp)} in the first ${n}`, `at ${i}`); };
  first('em dash', 0x2014); first('EM DASH', 0x2014); first('en dash', 0x2013);
  first('degree', 0xB0); first('check mark', 0x2713); first('copyright', 0xA9); first('euro', 0x20AC);
  first('pi', 0x3C0); first('space', 0x20); first('nbsp', 0xA0); first('zwsp', 0x200B); first('bel', 0x7);
  first('rarr', 0x2192); first('eacute', 0xE9); first('null', 0x0); first('bom', 0xFEFF); first('section', 0xA7);
  first('grinning face', 0x1F600); first('thumbs up', 0x1F44D); first('ellipsis', 0x2026); first('bullet', 0x2022);
  within('arrow', 0x2192, 4); within('right arrow', 0x2192, 3); within('heart', 0x2665, 40); within('smile', 0x1F600, 10);
  within('trademark', 0x2122, 2); within('times', 0xD7, 5); within('infinity', 0x221E, 1); within('star', 0x2605, 6);
  within('e acute', 0xE9, 2); within('yen', 0xA5, 1); within('pound', 0xA3, 3); within('micro', 0xB5, 2);
  eq(C.search(db, ['zzzzqqq']).total, 0, 'nonsense finds nothing');
  eq(C.search(db, ['']).total, 0, 'empty word finds nothing');
  check(!C.search(db, ['arrow']).hits.includes(0x202F), 'words match from their start: “arrow” is not in NARROW (the old page matched it)');
  check(C.search(db, ['arr']).hits.includes(0x2192), 'a word start matches: “arr”');
  eq(C.searchBlocks(db, ['arrows']).map(b => b.name)[0], 'Arrows', 'block search');
  const t = Date.now();
  for (const q of ['a', 'e', 'letter', 'sign', 'arrow']) C.search(db, [q]);
  check(Date.now() - t < 400, 'five broad searches in under 400 ms', `${Date.now() - t} ms`);
}

if (suites.includes('text')) {
  section('text');
  const c = C.clusters('👍🏽ok');
  eq(c.clusters.map(k => k.cps.length), [2, 1, 1], 'thumbs up with skin tone is one cluster of two');
  eq(C.clusters('é').clusters.length, 1, 'e + combining acute is one cluster');
  eq(C.clusters('👨‍👩‍👧').clusters[0].cps.length, 5, 'ZWJ family: one cluster of five');
  eq(C.clusters('🇩🇪').clusters[0].cps, [0x1F1E9, 0x1F1EA], 'a flag is two regional indicators');
  const big = 'x'.repeat(100000);
  const b = C.clusters(big, 1000);
  eq([b.shown, b.total], [1000, 100000], 'huge text: first 1,000 shown, total known');
  eq(C.clusters('').clusters.length, 0, 'empty text');
  const t = Date.now();
  C.parseQuery('é'.repeat(200000), db);
  check(Date.now() - t < 500, 'parsing a 200,000-character paste stays quick', `${Date.now() - t} ms`);
}

if (suites.includes('storage')) {
  section('storage');
  eq(C.migrateList('["é","→"]'), [0xE9, 0x2192], 'old favourites (characters) become code points');
  eq(C.migrateList('["😀","😀","x"]'), [0x1F600, 0x78], 'duplicates dropped, astral kept');
  eq(C.migrateList('["abc",3,null,"é"]'), [0xE9], 'entries that are not one character are ignored');
  eq(C.migrateList('{"a":1}'), [], 'another page’s object under the same key is ignored');
  eq(C.migrateList('not json'), [], 'corrupt value ignored');
  eq(C.migrateList(null), [], 'missing value');
}

if (suites.includes('page')) {
  section('page');
  let chromium;
  try { ({chromium} = createRequire(import.meta.url)('playwright')); } catch (e) { console.log('  skipped: playwright not available'); }
  if (chromium) {
    const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json'};
    const server = http.createServer((req, res) => {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      try {
        const body = readFileSync(join(ROOT, path));
        res.writeHead(200, {'content-type': TYPES[path.slice(path.lastIndexOf('.'))] || 'application/octet-stream'}); res.end(body);
      } catch (e) { res.writeHead(404); res.end(); }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const url = base + '/tools/character_map_explorer.html';
    const browser = await chromium.launch();
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: base});
    const page = await ctx.newPage();
    const errors = [], foreign = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) foreign.push(r.url()); });
    await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('favorites', JSON.stringify(['é', '→'])); sessionStorage.setItem('seeded', '1'); } });
    await page.goto(url);
    await page.waitForFunction(() => document.getElementById('src').textContent.includes('17.0'));
    const text = id => page.locator('#' + id).innerText();
    const inView = async sel => { const b = await page.locator(sel).first().boundingBox(); return !!b && b.y >= 0 && b.y + b.height <= 844; };
    eq(await text('name'), 'RIGHTWARDS ARROW', 'arrival: the worked example');
    check(await inView('#copyChar'), 'arrival: Copy is on screen without scrolling');
    check(await inView('#results button.c'), 'arrival: the first characters to pick are on screen');
    const type = async q => { await page.fill('#q', q); await page.waitForTimeout(120); };
    await type('degree');
    eq(await text('name'), 'DEGREE SIGN', 'typing “degree” shows the degree sign');
    await page.click('#copyChar');
    await page.waitForTimeout(100);
    eq(await page.evaluate(() => navigator.clipboard.readText()), '°', 'Copy puts exactly ° on the clipboard');
    await type('U+00E9');
    eq(await text('name'), 'LATIN SMALL LETTER E WITH ACUTE', 'U+00E9');
    eq(await page.locator('#fmtMain button.v').first().getAttribute('data-copy'), '&eacute;', 'its HTML row');
    await page.locator('#fmtMain button.v').nth(1).click();
    await page.waitForTimeout(100);
    eq(await page.evaluate(() => navigator.clipboard.readText()), '\\00E9', 'the CSS row copies \\00E9');
    await type('naïve café​ ok');
    eq(await text('name'), 'ZERO WIDTH SPACE', 'a pasted zero width space is picked out');
    check((await page.locator('.facts-chips').innerText()).includes('ZWSP'), 'and named in the summary');
    await page.click('[data-copytext="clean"]');
    await page.waitForTimeout(100);
    eq(await page.evaluate(() => navigator.clipboard.readText()), 'naïve café ok', 'copy without the hidden ones');
    await type('&eacut;');
    check((await text('hint')).includes('not an HTML entity name'), 'a typo is explained next to the field');
    await page.click('#guess button');
    await page.waitForTimeout(150);
    eq(await page.inputValue('#q'), '&eacute;', '“Use &eacute;” fixes the field');
    eq(await text('name'), 'LATIN SMALL LETTER E WITH ACUTE', 'and shows é');
    await type('U+110000');
    check((await text('hint')).includes('U+10FFFF'), 'an impossible code says where codes end');
    eq(await page.locator('#card').evaluate(e => e.classList.contains('is-stale')), true, 'and shows no stale character');
    await type('arrow');
    const before = await text('name');
    await page.reload();
    await page.waitForFunction(() => document.getElementById('src').textContent.includes('17.0'));
    eq(await page.inputValue('#q'), 'arrow', 'the query survives a reload');
    eq(await text('name'), before, 'and the same character is shown');
    await page.locator('#results button.c').first().focus();
    await page.keyboard.press('ArrowRight');
    eq(await text('name'), 'UPWARDS ARROW', 'arrow keys move through the results');
    await page.fill('#q', '');
    await page.click('[data-tab="saved"]');
    eq(await page.locator('#results button.c').count(), 2, 'the old page’s favourites are in Saved');
    await page.goto(url + '#U+1F600');
    await page.waitForFunction(() => document.getElementById('src').textContent.includes('17.0'));
    await page.fill('#q', '');
    await page.goto(url + '#U+1F600');
    await page.waitForFunction(() => document.getElementById('name').textContent === 'GRINNING FACE', null, {timeout: 3000}).catch(() => {});
    eq(await text('name'), 'GRINNING FACE', '#U+1F600 opens that character');
    eq(errors, [], 'no console errors');
    eq(foreign, [], 'no request leaves the page');
    await browser.close();
    server.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
