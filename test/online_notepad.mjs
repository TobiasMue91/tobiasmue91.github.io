#!/usr/bin/env node
// Test suite for tools/online_notepad.html (Online Notepad).
//
// Runs the page's DOM-free <script id="core"> block in Node. A notepad promises that what you
// type is what you get back: what is pasted is cleaned to plain formatting and never to script,
// the text you copy or download is the text on the sheet (Chrome's <div> lines, lists, line
// breaks, entities), Markdown means the same, nothing an old version of the page saved is lost
// or crashes it, and a backup brought back in adds what is missing and nothing twice. Expected
// values are written by hand from the HTML spec and CommonMark, not copied from the page.
//
//   node test/online_notepad.mjs              # everything
//   node test/online_notepad.mjs clean text   # named suites only
//
// Suites: clean, text, markdown, count, storage, import, files, time, find.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'online_notepad.html');
const ALL = ['clean', 'text', 'markdown', 'count', 'storage', 'import', 'files', 'time', 'find'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, Intl};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;

let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = a => a[Math.floor(rnd() * a.length)];

if (suites.includes('clean')) {
  section('clean');
  const S = [
    ['plain', 'plain'],
    ['<b>a</b><strong>b</strong><i>c</i><em>d</em><u>e</u><s>f</s><del>g</del>', '<b>a</b><b>b</b><i>c</i><i>d</i><u>e</u><s>f</s><s>g</s>'],
    ['<script>alert(1)</script>x', 'x'],
    ['<SCRIPT src=x>alert(1)</SCRIPT >y', 'y'],
    ['<style>body{display:none}</style>z', 'z'],
    ['<img src=x onerror=alert(1)>ok', 'ok'],
    ['<a href="javascript:alert(1)" onclick="x()">link</a>', 'link'],
    ['<span style="color:red" class=a>red</span>', 'red'],
    ['<div onmouseover="x()" id=a>line</div>', '<div>line</div>'],
    ['<p>one</p><p>two</p>', '<div>one</div><div>two</div>'],
    ['<h1>Head</h1>', '<div>Head</div>'],
    ['<ul><li>a<li>b</ul>', '<ul><li>a</li><li>b</li></ul>'],
    ['<li>stray</li>', '<div>stray</div>'],
    ['<b>unclosed', '<b>unclosed</b>'],
    ['stray</b> close', 'stray close'],
    ['<!-- secret -->x<!--', 'x'],
    ['a &lt;b&gt; &amp; &quot;q&quot; &#39; &#x1F600; &nbsp;', 'a &lt;b&gt; &amp; "q" \' 😀 \u00a0'],
    ['&bogus; &#xD800; &#0;', '&amp;bogus; \ufffd \ufffd'],
    ['1 < 2 and 3 > 2', '1 &lt; 2 and 3 &gt; 2'],
    ['<iframe src=x>inside</iframe>after', 'after'],
    ['<svg><script>x</script></svg>after', 'after'],
    ['<textarea><b>x</b></textarea>t', 't'],
    ['<b title="a>b">x</b>', '<b>x</b>'],
    ['line<br>next<br/>last<BR >', 'line<br>next<br>last<br>'],
    ['<meta charset=utf-8><html><body><!--StartFragment--><b>w</b><!--EndFragment--></body></html>', '<b>w</b>'],
    ['<o:p></o:p>word', 'word'],
    ['<?xml version="1.0"?>x', 'x'],
    ['<script>never closed', ''],
    ['', ''],
  ];
  S.forEach(([i, o]) => eq(C.sanitize(i), o, `sanitize ${JSON.stringify(i).slice(0, 60)}`));
  eq(C.sanitize(null), '', 'sanitize(null)');
  // whatever comes in, what goes out holds only the allowed tags, no attribute, and is stable
  const bits = ['<b>', '</b>', '<i>', '<div>', '</div>', '<ul>', '<li>', '</ul>', '<ol>', '<br>', '<script>', '</script>', '<img src=x onerror=1>',
    '<a href=x>', '</a>', '<span style=x>', 'text', ' ', '&amp;', '&', '<', '>', '"', "'", '<!--', '-->', 'é', '😀', '<p>', '</p>', '<style>', '</style>', '<x-y z=1>', '<b', '</', '\n'];
  let bad = 0, unstable = 0;
  for (let k = 0; k < 4000; k++) {
    let s = ''; const n = 1 + Math.floor(rnd() * 14);
    for (let j = 0; j < n; j++) s += pick(bits);
    const o = C.sanitize(s);
    const tags = o.match(/<[^>]*>/g) || [];
    if (tags.some(t => !/^<\/?(b|i|u|s|ul|ol|li|div)>$|^<br>$/.test(t)) || /<[^>]*$/.test(o)) bad++;
    if (C.sanitize(o) !== o) unstable++;
  }
  eq(bad, 0, 'random markup never leaves a tag outside b i u s ul ol li div br');
  eq(unstable, 0, 'sanitize(sanitize(x)) == sanitize(x) over random markup');
}

if (suites.includes('text')) {
  section('text');
  const T = [
    // what Chrome's contenteditable produces for typed lines
    ['first<div>second</div><div>third</div>', 'first\nsecond\nthird'],
    ['a<div><br></div><div>c</div>', 'a\n\nc'],
    ['<div>x<br></div><div>y</div>', 'x\ny'],
    ['a<br><br>b', 'a\n\nb'],
    ['<div><b>bold</b> and <i>it</i></div>', 'bold and it'],
    ['<ul><li>one</li><li>two</li></ul>', '- one\n- two'],
    ['<ol><li>one</li><li>two</li></ol>', '1. one\n2. two'],
    ['<ul><li>a<ol><li>x</li><li>y</li></ol></li><li>b</li></ul>', '- a\n    1. x\n    2. y\n- b'],
    ['intro<ul><li>a</li></ul>outro', 'intro\n- a\noutro'],
    ['a&nbsp;&nbsp;b', 'a  b'],
    ['&lt;tag&gt; &amp;', '<tag> &'],
    ['trailing   <div>spaces  </div>', 'trailing\nspaces'],
    ['<div><br></div><div><br></div>x<div><br></div>', 'x'],
    ['', ''],
  ];
  T.forEach(([i, o]) => eq(C.toText(i), o, `toText ${JSON.stringify(i).slice(0, 60)}`));
  const R = ['hello', 'two\nlines', 'gap\n\nhere', 'Grüße 😀 👨‍👩‍👧', '<script>alert(1)</script>', 'a & b < c > d "e"', '  indented', 'tab\tseparated', '漢字かな', 'x\n\n\n\ny'];
  R.forEach(t => eq(C.toText(C.fromText(t)), t, `fromText then toText keeps ${JSON.stringify(t)}`));
  eq(C.toText(C.fromText('windows\r\nline\rmac')), 'windows\nline\nmac', 'CRLF and CR become line breaks');
  eq(C.fromText(''), '', 'fromText of nothing is nothing');
  eq(C.fromText('<b>'), '<div>&lt;b&gt;</div>', 'fromText escapes markup');
  eq(C.sanitize(C.fromText('a\n\nb')), C.fromText('a\n\nb'), 'fromText output is already clean');
}

if (suites.includes('markdown')) {
  section('markdown');
  const M = [
    ['<b>bold</b> <i>it</i> <s>gone</s> <u>under</u>', '**bold** *it* ~~gone~~ under\n'],
    ['<b>bold </b>next', '**bold** next\n'],
    ['<b> </b>x', ' x\n'],
    ['2*3_4 [x]', '2\\*3\\_4 \\[x\\]\n'],
    ['# not a heading', '\\# not a heading\n'],
    ['> not a quote', '\\> not a quote\n'],
    ['<ul><li><b>a</b></li></ul>', '- **a**\n'],
    ['a<br>b', 'a\nb\n'],
    ['&lt;div&gt;', '\\<div>\n'],
  ];
  M.forEach(([i, o]) => eq(C.toMarkdown(i, ''), o, `toMarkdown ${JSON.stringify(i)}`));
  eq(C.toMarkdown('<div>body</div>', 'My *title*'), '# My \\*title\\*\n\nbody\n', 'title becomes an escaped heading');
  eq(C.toMarkdown('', 'Only title'), '# Only title\n', 'title alone');
  eq(C.toMarkdown('', ''), '', 'nothing at all');
}

if (suites.includes('count')) {
  section('count');
  const K = [
    ['', 0, 0, 0],
    ['   ', 0, 3, 1],
    ['hello world', 2, 11, 1],
    ['one\ntwo', 2, 6, 2],
    ["don't stop", 2, 10, 1],
    ['Grüße 😀', 1, 7, 1],
    ['👨‍👩‍👧 family', 1, 8, 1],
    ['e\u0301', 1, 1, 1],
    ['state-of-the-art', 4, 16, 1],
    ['2.940,00 €', 1, 10, 1],
    ['a\r\nb', 2, 2, 2],
  ];
  K.forEach(([t, w, c, l]) => eq(C.stats(t), {words: w, chars: c, lines: l}, `stats ${JSON.stringify(t)}`));
  const big = 'word '.repeat(200000);
  const t0 = Date.now(), s = C.stats(big);
  eq(s.words, 200000, 'a megabyte of words counted');
  check(Date.now() - t0 < 3000, 'a megabyte counts in under 3 s', `${Date.now() - t0} ms`);
}

if (suites.includes('storage')) {
  section('storage');
  const now = '2026-10-15T12:00:00.000Z';
  eq(C.load(null, now), {notes: [], error: null}, 'nothing stored');
  eq(C.load('', now), {notes: [], error: null}, 'empty string stored');
  eq(C.load('{broken', now).error, 'unreadable', 'corrupt JSON is reported, not thrown');
  eq(C.load('"text"', now).error, 'unreadable', 'a string is not notes');
  eq(C.load('null', now).error, 'unreadable', 'null is not notes');
  // the old page's own shape
  const old = JSON.stringify([
    {title: 'Shopping', body: 'milk<div><b>eggs</b></div>', created: '2026-10-15T09:00:00.000Z', lastModified: '2026-10-15T09:05:00.000Z'},
    {created: '2026-10-14T09:00:00.000Z', title: 'Untitled', body: 'just text', lastModified: '2026-10-14T09:00:00.000Z'},
    {title: 'Untitled', body: '', created: '2026-10-13T09:00:00.000Z', lastModified: '2026-10-13T09:00:00.000Z'},
    {title: '<img src=x onerror=alert(1)>', body: '<script>alert(2)</script>safe', created: '2026-10-12T09:00:00.000Z', lastModified: '2026-10-16T09:00:00.000Z'},
    {body: 'no title key'},
    {title: 'bad dates', body: 'x', created: 'yesterday', lastModified: 42},
    7, null, 'string', [1],
  ]);
  const L = C.load(old, now);
  eq(L.error, null, 'old notes load');
  eq(L.notes.length, 6, 'every note-shaped entry is kept, junk dropped');
  const byBody = b => L.notes.find(n => C.toText(n.body) === b);
  eq(byBody('milk\neggs').body, 'milk<div><b>eggs</b></div>', 'formatting survives');
  eq(byBody('just text').title, '', 'old "Untitled" placeholder title on a note with text becomes blank (shown from its first line)');
  eq(C.displayTitle(byBody('just text')), 'just text', 'and is shown by its first line');
  eq(byBody('safe').body, 'safe', 'stored script is dropped');
  eq(byBody('safe').title, '<img src=x onerror=alert(1)>', 'a title is text, kept verbatim (the page writes it with textContent)');
  eq(byBody('no title key').title, '', 'missing title does not crash');
  eq(byBody('x').created, now, 'unreadable dates fall back to now');
  eq(L.notes[0].body, 'safe', 'sorted newest first by lastModified');
  eq(new Set(L.notes.map(n => n.id)).size, 6, 'every note gets a distinct id');
  eq(C.load(old, now).notes.map(n => n.id), L.notes.map(n => n.id), 'ids are stable across loads');
  const stored = C.store(L.notes);
  eq(JSON.parse(stored).length, 5, 'the blank old note is not written back');
  const again = C.load(stored, now).notes;
  eq(again.map(n => [n.id, n.title, n.body, n.created, n.lastModified]), L.notes.filter(n => !C.isBlank(n)).map(n => [n.id, n.title, n.body, n.created, n.lastModified]), 'store then load is exact');
  check(JSON.parse(stored).every(n => 'title' in n && 'body' in n && 'created' in n && 'lastModified' in n), 'stored notes keep the old page\'s fields');
  const dup = JSON.stringify([{id: 'a', title: 'x', body: '1'}, {id: 'a', title: 'y', body: '2'}]);
  eq(new Set(C.load(dup, now).notes.map(n => n.id)).size, 2, 'duplicate ids are separated');
  eq(C.load(JSON.stringify({notes: [{title: 't', body: 'b'}]}), now).notes.length, 1, '{notes:[...]} is read too');
  eq(C.displayTitle({title: '', body: '<ul><li>milk</li></ul>'}), 'milk', 'title from a list line drops the bullet');
  eq(C.displayTitle({title: '', body: ''}), 'Untitled', 'empty note');
  eq(Array.from(C.displayTitle({title: '', body: 'x'.repeat(100)})).length, 60, 'long first line is cut to 60');
  eq(C.preview({title: '', body: 'first<div>second</div>'}), 'second', 'preview skips the line used as the title');
  eq(C.preview({title: 'T', body: 'a'.repeat(95)}, 90), 'a'.repeat(90) + '…', 'preview is cut');
  eq(C.preview({title: 'T', body: '😀'.repeat(95)}, 90), '😀'.repeat(90) + '…', 'preview never splits an emoji');
}

if (suites.includes('import')) {
  section('import');
  const now = '2026-10-15T12:00:00.000Z';
  const have = C.load(JSON.stringify([{id: 'a', title: 'Kept', body: 'one', lastModified: '2026-10-01T00:00:00.000Z'}]), now).notes;
  const file = JSON.stringify([
    {title: 'Kept', body: 'one', created: '2026-01-01T00:00:00.000Z', lastModified: '2026-01-01T00:00:00.000Z'},
    {title: '', body: 'no title'},
    {title: 'New', body: '<b>x</b>'},
    {title: '', body: ''},
    'junk',
  ], null, 2);
  const r = C.importJSON(have, file, now);
  eq([r.added, r.duplicates, r.invalid], [2, 1, 2], 'adds what is new, skips what is here, counts the rest');
  eq(r.notes.length, 3, 'notes after import');
  const r2 = C.importJSON(r.notes, file, now);
  eq(r2.added, 0, 'importing the same file twice adds nothing');
  eq(C.importJSON([], '\ufeff' + file, now).added, 3, 'a byte-order mark is fine');
  eq(C.importJSON([], JSON.stringify({notes: [{title: 'w', body: 'b'}]}), now).added, 1, '{notes:[...]}');
  eq(C.importJSON([], JSON.stringify({title: 'single', body: 'b'}), now).added, 1, 'a single note object');
  eq(C.importJSON([], JSON.stringify([{title: 't', text: 'plain\ntext'}]), now).notes[0].body, '<div>plain</div><div>text</div>', 'a note with text instead of body');
  check(!!C.importJSON([], 'not json', now).error, 'not JSON names the problem');
  check(!!C.importJSON([], '42', now).error, 'JSON without notes names the problem');
  const exp = C.exportJSON(r.notes);
  eq(C.importJSON([], exp, now).added, 3, 'an export imports back whole');
  check(JSON.parse(exp).every(n => n.title), 'export gives every note a title the old page will import');
  eq(C.importJSON([], C.exportJSON(r.notes), now).notes.map(n => C.toText(n.body)).sort(), r.notes.map(n => C.toText(n.body)).sort(), 'export and import keep the text');
  const n = C.noteFromFile('Meeting notes.txt', '\ufeffline 1\r\nline <2>\r\n', now);
  eq([n.title, C.toText(n.body)], ['Meeting notes', 'line 1\nline <2>'], '.txt file becomes a note');
  eq(C.noteFromFile('readme.md', '# x', now).title, 'readme', '.md file');
}

if (suites.includes('files')) {
  section('files');
  const d = new Date(2026, 0, 5, 23, 59);
  const F = [
    ['Shopping list', 'txt', 'Shopping list.txt'],
    ['a/b\\c:d*e?f"g<h>i|j', 'md', 'a b c d e f g h i j.md'],
    ['  spaced   out  ', 'txt', 'spaced out.txt'],
    ['', 'txt', 'note-2026-01-05.txt'],
    ['Untitled', 'txt', 'note-2026-01-05.txt'],
    ['...', 'txt', 'note-2026-01-05.txt'],
    ['ends with dot.', 'txt', 'ends with dot.txt'],
    ['Grüße 😀', 'md', 'Grüße 😀.md'],
    ['x'.repeat(200), 'txt', 'x'.repeat(80) + '.txt'],
    ['tab\there\nnewline', 'txt', 'tab here newline.txt'],
  ];
  F.forEach(([t, e, o]) => eq(C.fileName(t, e, d), o, `fileName ${JSON.stringify(t).slice(0, 30)}`));
  eq(C.exportName(d), 'notes-2026-01-05.json', 'backup name uses the local date, not UTC');
}

if (suites.includes('time')) {
  section('time');
  const now = new Date(2026, 9, 15, 14, 30);
  const ago = m => new Date(now - m * 60000).toISOString();
  eq(C.when(ago(0.5), now), 'just now', '30 s');
  eq(C.when(ago(5), now), '5 min ago', '5 min');
  eq(C.when(ago(59), now), '59 min ago', '59 min');
  eq(C.when(new Date(2026, 9, 15, 9, 5).toISOString(), now), '09:05', 'earlier today');
  eq(C.when(new Date(2026, 9, 14, 23, 0).toISOString(), now), 'yesterday', 'yesterday');
  eq(C.when(new Date(2026, 8, 1).toISOString(), now), '1 Sep', 'this year');
  eq(C.when(new Date(2025, 1, 28).toISOString(), now), '28 Feb 2025', 'another year');
  eq(C.when('nonsense', now), '', 'no date');
  eq(C.when(new Date(2024, 1, 29).toISOString(), new Date(2024, 2, 1, 1)), 'yesterday', 'across a leap day');
}

if (suites.includes('find')) {
  section('find');
  eq(C.findAll('Café cafe CAFÉ', 'cafe'), [[0, 4], [5, 9], [10, 14]], 'case and accent do not matter');
  eq(C.findAll('aaaa', 'aa'), [[0, 2], [2, 4]], 'matches do not overlap');
  eq(C.findAll('x😀y😀', '😀'), [[1, 3], [4, 6]], 'emoji');
  eq(C.findAll('İstanbul', 'stan'), [[1, 5]], 'a letter whose lower case is longer keeps positions');
  eq(C.findAll('anything', '   '), [], 'blank finds nothing');
  eq(C.findAll('', 'x'), [], 'empty text');
  eq(C.findAll('a.b*c', '.b*'), [[1, 4]], 'search text is literal, not a pattern');
  const notes = [{title: 'Groceries', body: 'oat <b>milk</b>'}, {title: 'Work', body: 'Résumé draft'}, {title: 'div', body: 'x'}];
  eq(C.search(notes, 'resume').map(n => n.title), ['Work'], 'accents');
  eq(C.search(notes, 'milk oat').map(n => n.title), ['Groceries'], 'every word, any order');
  eq(C.search(notes, 'b').map(n => n.title), [], 'markup is not searched');
  eq(C.search(notes, '').length, 3, 'empty search lists all');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
