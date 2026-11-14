#!/usr/bin/env node
// Test suite for tools/markdown_converter.html (Markdown to HTML Converter).
//
// Runs the page's DOM-free <script id="core"> block in Node with the same markdown-it the page loads (14.1.0).
// The page promises HTML a stranger can paste into a CMS or a template without checking it elsewhere, so the
// expected values come from the published specs, not from the page:
//   spec      all 652 examples of the CommonMark 0.31.2 spec (test/fixtures/commonmark-0.31.2.json, from
//             spec.commonmark.org), with the GFM extensions switched on - tables, strikethrough and task lists
//             must not change a single CommonMark result. Autolinks and the sanitizer are what the page adds on
//             top, so the run with the defaults lists exactly which examples they change and why.
//   gfm       the table, strikethrough, autolink and task-list examples of the GFM spec (test/fixtures/
//             gfm-extensions.json, cut from github/cmark-gfm test/spec.txt). Five autolink edge cases differ
//             because linkify-it is stricter than cmark-gfm; they are pinned below so a change shows up.
//   safety    the "Keep safe HTML" default against the usual XSS vectors (OWASP filter-evasion list and friends)
//   contract  the old page's outputs for the inventory's sample inputs, which define what must keep working
//   options   breaks, linkify, typographer, heading ids, raw-HTML modes and the old 'markpro-settings' migration
//   hints     the warning for rows that look like a table but are not one, and its one-tap fix
//   indent    the indented layout (on by default) only adds leading spaces, never inside <pre>, on every spec example
//   rich      the inline styles the "Copy for e-mail / Docs" copy adds, since mail clients drop <style>
//   edges     empty, whitespace, BOM, CRLF, tabs, non-ASCII, a 1 MB input, counts, file names, the document wrapper
//   editor    the toolbar's text transforms
//
//   npm i --no-save markdown-it@14.1.0          # once (CYPRESS_INSTALL_BINARY=0 skips Cypress)
//   node test/markdown_converter.mjs            # everything
//   node test/markdown_converter.mjs spec gfm   # named suites only
//
// Suites: spec, gfm, safety, contract, options, hints, indent, rich, edges, editor.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let markdownit;
try { markdownit = require('markdown-it'); } catch (e) {
  console.log('markdown-it is not installed: npm i --no-save markdown-it@14.1.0'); process.exit(1);
}
const html = readFileSync(join(HERE, '..', 'tools', 'markdown_converter.html'), 'utf8');
const pinned = html.match(/markdown-it@([\d.]+)\/dist/)[1];
const installed = require('markdown-it/package.json').version;
if (pinned !== installed) console.log(`WARNING: the page loads markdown-it ${pinned}, node_modules has ${installed}`);
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;

const ALL = ['spec', 'gfm', 'safety', 'contract', 'options', 'hints', 'indent', 'rich', 'edges', 'editor'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;
let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(got === want, what, `got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);
// The spec's own test runner compares normalised HTML; whitespace between tags and XHTML-style void tags do not count.
const norm = s => s.replace(/>\s+</g, '><').replace(/ \/>/g, '>').trim();
// The old page's contract is compared looser still: a newline next to a tag is layout, not content.
const loose = s => s.replace(/\s*(<\/?(?:ul|ol|li|br|tbody|tr|table|thead)\b[^>]*>)\s*/g, '$1').trim();
const cache = new Map();
const md = o => { const k = JSON.stringify(o || {}); if (!cache.has(k)) cache.set(k, C.create(markdownit, o)); return cache.get(k); };
const conv = (s, o) => C.convert(md(o), s, o).html;

if (suites.includes('spec')) {
  section('spec - CommonMark 0.31.2, 652 examples');
  const spec = JSON.parse(readFileSync(join(HERE, 'fixtures', 'commonmark-0.31.2.json'), 'utf8'));
  eq(spec.length, 652, 'fixture holds every example');
  const pure = {linkify: false, html: 'all'};
  let bad = [];
  for (const e of spec) if (norm(conv(e.markdown, pure)) !== norm(e.html)) bad.push(e.example);
  eq(bad.join(','), '', 'GFM tables, strikethrough and task lists change no CommonMark example');
  // With autolinks on, these four contain bare www./https:// text that GFM links (spec examples 602-612 are
  // about <autolinks> and show the literal text).
  bad = [];
  for (const e of spec) if (norm(conv(e.markdown, {html: 'all'})) !== norm(e.html)) bad.push(e.example);
  eq(bad.join(','), '602,608,611,612', 'autolinks change only the examples with bare URLs');
  // The safe default additionally removes script/style/textarea-like raw HTML from these examples.
  bad = [];
  for (const e of spec) if (norm(conv(e.markdown)) !== norm(e.html)) bad.push(e.example);
  eq(bad.join(','), '152,156,157,158,163,170,172,173,176,178,180,181,182,596,598,599,601,602,608,611,612,623,627,628,629',
    'safe HTML changes only examples with raw script/style/on*/javascript: HTML');
  // ...and in each of those, nothing dangerous survives
  for (const n of [152, 156, 157, 158, 163, 170, 172, 173, 176, 178, 180, 181, 182, 596, 598, 599, 601, 623, 627, 628, 629]) {
    const out = conv(spec[n - 1].markdown);
    check(!/<(script|style)\b|\son\w+=|javascript:/i.test(out), `example ${n} safe`, out);
  }
}

if (suites.includes('gfm')) {
  section('gfm - GitHub Flavored Markdown extension examples');
  const gfm = JSON.parse(readFileSync(join(HERE, 'fixtures', 'gfm-extensions.json'), 'utf8'));
  // linkify-it ends a www. link at an unbalanced ")" and at "&hl" before ";" differently, and only links
  // e-mail addresses whose domain ends in a real TLD (.baz, .b and .example are not).
  const KNOWN = {625: 'unbalanced ) in www. link', 626: 'entity-like &hl; after link', 629: 'unknown TLD .baz',
    630: 'unknown TLD .example', 631: 'unknown TLD .b'};
  for (const e of gfm) {
    const got = norm(conv(e.markdown, {html: 'all'}));
    if (KNOWN[e.example]) check(got !== norm(e.html), `example ${e.example} still differs (${KNOWN[e.example]}) - update KNOWN`);
    else check(got === norm(e.html), `example ${e.example} (${e.extension})`, `got  ${JSON.stringify(got)}\n          want ${JSON.stringify(norm(e.html))}`);
  }
  eq(gfm.filter(e => e.extension === 'table').length, 8, 'eight table examples');
  eq(conv('- [ ]\n- [x]'), '<ul>\n<li>[ ]</li>\n<li>[x]</li>\n</ul>\n', 'a bare [ ] with nothing after it is not a task');
  eq(conv('- [x] **done** it'), '<ul>\n<li><input checked="" disabled="" type="checkbox"> <strong>done</strong> it</li>\n</ul>\n', 'task with inline markup');
  eq(conv('1. [X] up'), '<ol>\n<li><input checked="" disabled="" type="checkbox"> up</li>\n</ol>\n', 'ordered task, capital X');
  eq(conv('- [ ] a\n\n  more'), '<ul>\n<li>\n<p><input disabled="" type="checkbox"> a</p>\n<p>more</p>\n</li>\n</ul>\n', 'loose task item');
  eq(conv('> - [ ] q'), '<blockquote>\n<ul>\n<li><input disabled="" type="checkbox"> q</li>\n</ul>\n</blockquote>\n', 'task inside a quote');
  eq(conv('[ ] not in a list'), '<p>[ ] not in a list</p>\n', 'brackets outside a list stay text');
  eq(conv('| a |\n|---|\n| `x\\|y` |'), '<table>\n<thead>\n<tr>\n<th>a</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td><code>x|y</code></td>\n</tr>\n</tbody>\n</table>\n', 'escaped pipe in a code span');
}

if (suites.includes('safety')) {
  section('safety - Keep safe HTML');
  const bad = /<(script|style|iframe|object|embed|svg|math|base|meta|link|form|template)\b|\son[a-z]+\s*=|(?:href|src|action|formaction|data|xlink:href|poster|background)\s*=\s*["']?\s*(?:javascript|vbscript|data:text)/i;
  const vectors = [
    '<script>alert(1)</script>', '<SCRIPT SRC=//x.example/x.js></SCRIPT>', '<scr<script>ipt>alert(1)</script>',
    '<img src=x onerror=alert(1)>', '<IMG SRC="javascript:alert(1);">', '<img src=JaVaScRiPt:alert(1)>',
    '<a href="jav&#x09;ascript:alert(1)">x</a>', '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">x</a>',
    '<a href="&#x6A&#x61&#x76&#x61&#x73&#x63&#x72&#x69&#x70&#x74&#x3A;alert(1)">x</a>', '<a href=" javascript:alert(1)">x</a>',
    '<a href="javascript&colon;alert(1)">x</a>', '<a href="java\nscript:alert(1)">x</a>',
    '<svg onload=alert(1)>', '<svg><animate attributeName=href values=javascript:alert(1) /><a><text>x</text></a></svg>',
    '<math><mtext><img src=x onerror=alert(1)></mtext></math>', '<iframe src="javascript:alert(1)"></iframe>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>', '<object data="javascript:alert(1)"></object>',
    '<embed src="data:text/html,<script>alert(1)</script>">', '<body onload=alert(1)>', '<BODY BACKGROUND="javascript:alert(1)">',
    '<style>@import "//x.example/x.css";</style>', '<div style="width:expression(alert(1))">x</div>', '<div style="background:url(javascript:alert(1))">x</div>',
    '<form action="javascript:alert(1)"><button>go</button></form>', '<button formaction="javascript:alert(1)">x</button>',
    '<base href="//x.example/">', '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">', '<link rel=stylesheet href=//x.example/x.css>',
    '<details open ontoggle=alert(1)>', '<input onfocus=alert(1) autofocus>', '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
    '<img src="data:image/svg+xml,<svg onload=alert(1)>">', '<template><script>alert(1)</script></template>', '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
    '<a/href="javascript:alert(1)">x</a>', '<img """><script>alert(1)</script>">', '<<script>script>alert(1)//<</script>',
    'hi <script>\nalert(1)\n</script> there', '<div\nonmouseover=alert(1)>x</div>', '<a href=javascript:alert(1)>x</a>',
    '[x](javascript:alert(1))', '![x](javascript:alert(1))', '<javascript:alert(1)>', '[x]: javascript:alert(1)\n\n[x]',
  ];
  for (const v of vectors) {
    const out = conv(v);
    check(!bad.test(out), `neutralised: ${JSON.stringify(v).slice(0, 70)}`, out);
  }
  // ...while ordinary HTML in Markdown survives untouched
  const keep = ['<details><summary>More</summary>\n\nHidden *text*\n\n</details>', '<kbd>Ctrl</kbd>+<kbd>C</kbd>', 'H<sub>2</sub>O and x<sup>2</sup>',
    '<p align="center"><img src="logo.png" width="120" alt="Logo"></p>', '<a href="https://example.com/?a=1&amp;b=2" title="t">x</a>',
    '<a href="mailto:a@b.example">mail</a> <a href="#top">top</a> <a href="../x.html">rel</a>', '<img src="data:image/png;base64,iVBORw0KGgo=" alt="dot">',
    '<span style="color:#c00">red</span>', '<!-- a comment -->', '<video src="clip.mp4" controls></video>', '<mark>hi</mark> <abbr title="HyperText">HTML</abbr>'];
  for (const k of keep) eq(conv(k), conv(k, {html: 'all'}), `kept: ${JSON.stringify(k).slice(0, 60)}`);
  eq(conv('see <a href="javascript:x">t</a> and <a href="javascript:x" title="y">u</a>'), '<p>see t and <a title="y">u</a></p>\n', 'an <a> left empty is unwrapped, one with other attributes kept');
  eq(C.sanitize('<b onclick="x()" class="y">a</b>').html, '<b class="y">a</b>', 'only the bad attribute goes');
  eq(C.sanitize('<script>a</script>b<script>c').html, 'b', 'unclosed script drops the rest');
  eq(C.sanitize('<script>x</script>').removed, 1, 'removals are counted');
  eq(C.sanitize('a < b and <3 and <-').html, 'a &lt; b and &lt;3 and &lt;-', 'stray < is escaped');
  eq(C.sanitize('<svg><svg></svg>inner</svg>after').html, 'after', 'nested dropped elements');
  eq(C.sanitize('<img src="a.png" srcset="b.png 2x, javascript:alert(1) 3x">').html, '<img src="a.png">', 'srcset with a bad candidate');
  eq(conv('<script>alert(1)</script>', {html: 'escape'}), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n', 'escape mode shows tags as text');
  eq(conv('<script>alert(1)</script>', {html: 'all'}), '<script>alert(1)</script>', 'all mode passes through');
  eq(conv('[x](javascript:alert(1))', {html: 'all'}), '<p>[x](javascript:alert(1))</p>\n', 'markdown links never get javascript:, even in all mode');
  eq(C.convert(md(), '<b onclick=x>a</b> <script>x</script>').removed, 2, 'convert reports how much was removed');
  eq(C.convert(md(), '<script>x</script><a href="javascript:x" onclick=y>t</a><iframe></iframe><script>z</script>').what.join(' | '),
    '<script> | unsafe href | onclick | <iframe>', 'convert names what was removed, once each');
  eq(conv('a\n\n<script>t()</script>\n\nb'), '<p>a</p>\n<p>b</p>\n', 'a removed block leaves no blank line');
}

if (suites.includes('contract')) {
  section('contract - the old page (marked 15 + DOMPurify) for the inventory inputs');
  // Exact strings where markdown-it and marked agree. Whitespace-only differences (marked writes <tbody><tr>,
  // markdown-it <tbody>\n<tr>) are compared normalised.
  const old = [
    ['', ''],
    ['   \n\t\n  ', ''],
    ['# Title\n\nSome *em* and **strong** and `code`.', '<h1>Title</h1>\n<p>Some <em>em</em> and <strong>strong</strong> and <code>code</code>.</p>\n'],
    ['- a\n  - b\n- c', '<ul>\n<li>a<ul>\n<li>b</li>\n</ul>\n</li>\n<li>c</li>\n</ul>\n'],
    ['```html\n<script>alert(1)</script>\n```', '<pre><code class="language-html">&lt;script&gt;alert(1)&lt;/script&gt;\n</code></pre>\n'],
    ['| L | C | R |\n|:--|:-:|--:|\n| 1 | 2 | 3 |', '<table>\n<thead>\n<tr>\n<th align="left">L</th>\n<th align="center">C</th>\n<th align="right">R</th>\n</tr>\n</thead>\n<tbody><tr>\n<td align="left">1</td>\n<td align="center">2</td>\n<td align="right">3</td>\n</tr>\n</tbody></table>\n'],
    ['<script>alert(1)</script>', ''],
    ['Ünïcödé — 日本語 😀', '<p>Ünïcödé — 日本語 😀</p>\n'],
    ['~~strike~~ and - [ ] task', '<p><del>strike</del> and - [ ] task</p>\n'],
    ['- [ ] task\n- [x] done', '<ul>\n<li><input disabled="" type="checkbox"> task</li>\n<li><input checked="" disabled="" type="checkbox"> done</li>\n</ul>\n'],
    ['line one  \nline two', '<p>line one<br>line two</p>\n'],
    ['1. one\n1. two', '<ol>\n<li>one</li>\n<li>two</li>\n</ol>\n'],
    ['a\nb', '<p>a\nb</p>\n'],
    ['3. x\n4. y', '<ol start="3">\n<li>x</li>\n<li>y</li>\n</ol>\n'],
    ['see https://example.com and <b onclick="x()">hi</b>', '<p>see <a href="https://example.com">https://example.com</a> and <b>hi</b></p>\n'],
    ['<b>x</b> &amp; & <', '<p><b>x</b> &amp; &amp; &lt;</p>\n'],
    ['![img](x.png "t")', '<p><img src="x.png" alt="img" title="t"></p>\n'],
    ['> quote\n\n***\n\n<details><summary>s</summary>x</details>', '<blockquote>\n<p>quote</p>\n</blockquote>\n<hr>\n<details><summary>s</summary>x</details>'],
  ];
  for (const [i, o] of old) eq(loose(conv(i)), loose(o), `old output: ${JSON.stringify(i).slice(0, 50)}`);
  eq(conv('a\nb', {breaks: true}), '<p>a<br>\nb</p>\n', 'breaks on (old: <p>a<br>b</p>, whitespace only)');
  eq(conv('see https://example.com and <b onclick="x()">hi</b>', {html: 'all'}), '<p>see <a href="https://example.com">https://example.com</a> and <b onclick="x()">hi</b></p>\n', 'sanitize off keeps onclick, as before');
  eq(conv('<script>alert(1)</script>', {html: 'all'}), '<script>alert(1)</script>', 'sanitize off keeps script, as before');
  // Deliberate difference: the old page turned [link](javascript:alert(1)) into a dead <a>link</a>; CommonMark
  // says an invalid destination is not a link, so the text stays as typed.
  eq(conv('[link](javascript:alert(1))'), '<p>[link](javascript:alert(1))</p>\n', 'javascript: link stays text (old: <a>link</a>)');
  // Deliberate difference: footnotes were read as a reference link to "Note"; GitHub renders footnotes, and
  // without the footnote extension the honest output is the text.
  eq(conv('Text[^1]\n\n[^1]: Note'), '<p>Text<a href="Note">^1</a></p>\n', 'footnote syntax as CommonMark reads it (same as old)');
  eq(C.stats('  one two\nthree  ').words, 3, 'word count as before');
  eq(C.stats('  one two\nthree  ').chars, 13, 'character count on the trimmed text, as before');
}

if (suites.includes('options')) {
  section('options');
  eq(JSON.stringify(C.options({})), JSON.stringify({breaks: false, linkify: true, typographer: false, html: 'safe', ids: 'auto'}), 'defaults');
  eq(C.options({sanitize: false}).html, 'all', 'old sanitize:false -> keep all HTML');
  eq(C.options({sanitize: true}).html, 'safe', 'old sanitize:true -> safe');
  eq(C.options({sanitize: false, html: 'escape'}).html, 'escape', 'new html wins over old sanitize');
  eq(C.options({breaks: true, realtime: false, autosave: true, theme: 'dark'}).breaks, true, 'old breaks carried over');
  eq(C.options({html: 'nonsense', breaks: 'yes', ids: 'x'}).html, 'safe', 'junk ignored');
  eq(C.options({ids: 'x'}).ids, 'auto', 'junk ids ignored');
  eq(C.options({ids: false}).ids, false, 'ids off kept');
  eq(C.options(null).breaks, false, 'null options');
  eq(conv('a\nb\\\nc', {breaks: true}), '<p>a<br>\nb<br>\nc</p>\n', 'breaks');
  eq(conv('see www.example.com', {linkify: false}), '<p>see www.example.com</p>\n', 'linkify off');
  eq(conv('see www.example.com'), '<p>see <a href="http://www.example.com">www.example.com</a></p>\n', 'www. links');
  eq(conv('example.com and x.org'), '<p>example.com and x.org</p>\n', 'bare domains are not links (GFM)');
  eq(conv('"Hi" -- it\'s (c)', {typographer: true}), '<p>“Hi” – it’s ©</p>\n', 'typographer');
  eq(conv('"Hi" -- it\'s', {}), '<p>&quot;Hi&quot; -- it\'s</p>\n', 'typographer off by default');
  eq(conv('# Hello World\n## Hello World\n### C++ & C#\n#### `code` *em*\n# Ünïcödé 日本語', {ids: true}),
    '<h1 id="hello-world">Hello World</h1>\n<h2 id="hello-world-1">Hello World</h2>\n<h3 id="c--c">C++ &amp; C#</h3>\n<h4 id="code-em"><code>code</code> <em>em</em></h4>\n<h1 id="ünïcödé-日本語">Ünïcödé 日本語</h1>\n',
    'heading ids, GitHub slugs, de-duplicated');
  eq(conv('# A\n# A'), '<h1>A</h1>\n<h1>A</h1>\n', 'no ids by default when nothing links to a heading');
  eq(conv('- [Install](#install)\n\n## Install'), '<ul>\n<li><a href="#install">Install</a></li>\n</ul>\n<h2 id="install">Install</h2>\n', 'auto: a #link turns ids on');
  eq(conv('[x][r]\n\n[r]: #usage\n\n# Usage'), '<p><a href="#usage">x</a></p>\n<h1 id="usage">Usage</h1>\n', 'auto: reference definition to #');
  eq(conv('<a href="#top">up</a>\n\n# Top'), '<p><a href="#top">up</a></p>\n<h1 id="top">Top</h1>\n', 'auto: raw HTML href="#"');
  eq(conv('[Install](#install)\n\n# Install', {ids: false}), '<p><a href="#install">Install</a></p>\n<h1>Install</h1>\n', 'never');
  eq(conv('C# is a language\n\n# A'), '<p>C# is a language</p>\n<h1>A</h1>\n', 'auto: a # in prose is not a link');
  eq(C.slug('  Snake_case and-dash!  '), 'snake_case-and-dash', 'slug keeps _ and -');
}

if (suites.includes('hints')) {
  section('hints - text that looks like a table but is not one');
  const h = s => C.convert(md(), s).hints.map(x => x.line + ': ' + x.text).join(' / ');
  eq(h('| a | b\n|--|\n| 1 | 2 |'), '2: Line 2 looks like a table divider, but it has 1 column and the header above has 2. Give both the same number of columns.', 'divider with too few columns');
  eq(h('| a | b |\n|---|---|\n| 1 | 2 |'), '', 'a real table has no hint');
  eq(h('| a |\n|---|---|'), '2: Line 2 looks like a table divider, but it has 2 columns and the header above has 1. Give both the same number of columns.', 'too many');
  eq(h('```\n| a |\n|---|---|\n```'), '', 'not inside code');
  eq(h('    | a |\n    |---|---|'), '', 'not inside indented code');
  eq(h('a | b\n--|--'), '', 'pipe-less edges that do form a table');
  eq(h('| `a\\|b` | c\n|---|'), '2: Line 2 looks like a table divider, but it has 1 column and the header above has 2. Give both the same number of columns.', 'escaped pipe is not a column');
  eq(h('no table here\n---'), '', 'setext heading is not a table');
  eq(C.convert(md(), '| a | b | c |\n|---|---:|').hints[0].fix, '| --- | ---: | ---: |', 'the fix keeps alignment and adds columns');
  eq(C.fixDivider('|:-|-:|--|--|', 2), '| :- | -: |', 'the fix drops extra columns');
  eq(C.fixDivider('|---|---:|', 3), '| --- | ---: | ---: |', 'a missing column takes the alignment of the last one');
  const fixed = '| a | b | c |\n' + C.convert(md(), '| a | b | c |\n|---|---:|').hints[0].fix + '\n| 1 | 2 | 3 |';
  check(/<table>/.test(conv(fixed)) && C.convert(md(), fixed).hints.length === 0, 'the fixed text is a table with no hint');
  eq(h('x|y\n-|-\n'.repeat(1) + ('| a | b\n|-|\n\n').repeat(5)).split(' / ').length, 3, 'at most three hints');
}

if (suites.includes('indent')) {
  section('indent - the indented layout changes whitespace between tags only');
  const spec = JSON.parse(readFileSync(join(HERE, 'fixtures', 'commonmark-0.31.2.json'), 'utf8'))
    .concat(JSON.parse(readFileSync(join(HERE, 'fixtures', 'gfm-extensions.json'), 'utf8')));
  const pres = h => (h.match(/<(pre|textarea)\b[\s\S]*?<\/\1>/g) || []).join('\u0000');
  let bad = [];
  for (const e of spec) {
    const h = conv(e.markdown, {html: 'all'}), i = C.indent(h);
    // only leading spaces were added, and every <pre> is byte-identical
    if (i.replace(/^ +/gm, '') !== h.replace(/^ +/gm, '') || pres(i) !== pres(h) || i.split('\n').length !== h.split('\n').length) bad.push(e.example);
  }
  eq(bad.join(','), '', 'on every spec example');
  eq(C.indent(conv('- a\n  - b\n- c')), '<ul>\n  <li>a\n    <ul>\n      <li>b</li>\n    </ul>\n  </li>\n  <li>c</li>\n</ul>\n', 'nested list');
  eq(C.indent(conv('> - x\n>\n>   ```\n>   y\n>     z\n>   ```')), '<blockquote>\n  <ul>\n    <li>\n      <p>x</p>\n<pre><code>y\n  z\n</code></pre>\n    </li>\n  </ul>\n</blockquote>\n'.replace('<pre>', '      <pre>'), 'code inside a list inside a quote keeps its text');
  eq(C.indent(''), '', 'empty');
  eq(C.indent(conv('<div>\n<div>\n\nx\n\n</div>\n</div>', {html: 'all'})), '<div>\n  <div>\n    <p>x</p>\n  </div>\n</div>', 'raw nested divs');
}

if (suites.includes('rich')) {
  section('rich - the formatted copy for e-mail and word processors');
  const r = C.richHtml(conv('| a | b |\n|---|--:|\n| 1 | 2 |\n\n`x` and\n\n```js\ny\n```\n\n> q'));
  check(r.includes('<table style="border-collapse:collapse">'), 'table collapses borders');
  check(r.includes('<th style="border:1px solid #c8c8c8;padding:4px 10px;background:#f3f3f3">a</th>'), 'header cell styled');
  check(r.includes('<td align="right" style="border:1px solid #c8c8c8;padding:4px 10px;text-align:right">2</td>'), 'aligned cell keeps align and gets text-align');
  check(r.includes('<code style="font-family:Consolas,Menlo,monospace">x</code>') && r.includes('<code style="font-family:Consolas,Menlo,monospace">y'), 'inline and fenced code in monospace');
  check(r.includes('<blockquote style='), 'quote styled');
  eq(C.richHtml('<p>&lt;table&gt; <span>x</span></p>'), '<p>&lt;table&gt; <span>x</span></p>', 'text that only looks like a tag is untouched');
}

if (suites.includes('edges')) {
  section('edges');
  eq(conv('﻿# BOM'), '<h1>BOM</h1>\n', 'byte-order mark');
  eq(conv('# a\r\n\r\ntext\r\nmore'), '<h1>a</h1>\n<p>text\nmore</p>\n', 'CRLF');
  eq(conv('a\rb'), '<p>a\nb</p>\n', 'bare CR');
  eq(conv('\tcode'), '<pre><code>code\n</code></pre>\n', 'tab-indented code');
  eq(conv('null \u0000 char'), '<p>null � char</p>\n', 'NUL becomes U+FFFD (spec 2.3)');
  eq(conv(null), '', 'null input');
  eq(conv(undefined), '', 'undefined input');
  eq(conv('🎉 **ç** ☃'), '<p>🎉 <strong>ç</strong> ☃</p>\n', 'astral and accented');
  eq(conv('<'), '<p>&lt;</p>\n', 'lone <');
  const r = C.convert(md(), '# Title *one*\n\n## Sub');
  eq(r.title, 'Title one', 'title from the first h1');
  eq(C.convert(md(), '## Only h2\n# Later h1').title, 'Later h1', 'an h1 later on wins');
  eq(C.convert(md(), 'no heading').title, '', 'no title');
  eq(C.convert(md(), 'ä').bytes, 10, 'bytes count UTF-8 (<p>ä</p>\\n)');
  eq(C.convert(md(), '😀').bytes, 12, 'bytes count astral as 4');
  eq(C.fileName('Release Notes 2.0!'), 'release-notes-20.html', 'file name from title');
  eq(C.fileName(''), 'markdown.html', 'file name without title');
  eq(C.fileName('???'), 'markdown.html', 'file name from punctuation only');
  const doc = C.documentHtml('<p>x</p>\n', 'A <b> & "c"');
  check(doc.startsWith('<!DOCTYPE html>\n<html lang="en">'), 'document doctype');
  check(doc.includes('<title>A &lt;b&gt; &amp; &quot;c&quot;</title>'), 'document title escaped');
  check(doc.includes('<meta charset="utf-8">') && doc.includes('<main>\n<p>x</p>\n</main>'), 'document charset and body');
  check(!C.documentHtml('<p>x</p>', 't', false).includes('<style>'), 'unstyled document');
  // ~1 MB: must finish, and quickly (the page moves inputs this large to a worker anyway)
  const big = readFileSync(join(HERE, '..', 'README.md'), 'utf8').repeat(Math.ceil(1e6 / readFileSync(join(HERE, '..', 'README.md'), 'utf8').length));
  const t0 = performance.now(); const out = C.convert(md(), big); const ms = performance.now() - t0;
  check(out.html.length > big.length / 2 && ms < 3000, `1 MB converted in ${ms.toFixed(0)} ms`);
  const deep = '>'.repeat(5000) + ' x';
  check(C.convert(md(), deep).html.length > 0, 'very deep nesting does not throw');
  check(C.convert(md(), '*'.repeat(20000)).html.length > 0, '20 000 asterisks do not hang');
  check(C.convert(md(), '[a]('.repeat(5000)).html.length > 0, 'unclosed links do not hang');
}

if (suites.includes('editor')) {
  section('editor - toolbar transforms');
  const w = (k, s, a) => { const r = C.wrap(k, s, a); return r.text + ' |' + r.text.slice(r.start, r.end) + '|'; };
  eq(w('bold', 'x', true), '**x** |x|', 'bold selection');
  eq(w('bold', '', true), '**bold text** |bold text|', 'bold placeholder selected');
  eq(w('italic', 'x', true), '*x* |x|', 'italic');
  eq(w('code', 'x', true), '`x` |x|', 'inline code');
  eq(w('code', 'a\nb', true), '```\na\nb\n```\n |a\nb|', 'multi-line selection -> fence');
  eq(w('link', 'site', true), '[site](https://) |https://|', 'link selects the URL');
  eq(w('link', '', true), '[link text](https://) |link text|', 'link placeholder');
  eq(w('image', '', true), '![alt text](https://) |https://|', 'image');
  eq(w('heading', '# old', true), '## old |## old|', 'heading replaces existing #');
  eq(w('quote', 'a\nb', true), '> a\n> b |> a\n> b|', 'quote each line');
  eq(w('list', 'a\nb', false), '\n- a\n- b |- a\n- b|', 'list on a new line');
  eq(w('ordered', 'a\nb\nc', true), '1. a\n2. b\n3. c |1. a\n2. b\n3. c|', 'ordered');
  eq(w('task', 'a', true), '- [ ] a |- [ ] a|', 'task');
  eq(w('table', '', true), '| Column | Column |\n| ------ | ------ |\n| Cell   | Cell   |\n |Column|', 'table');
  check(/<table>/.test(conv(C.wrap('table', '', true).text)), 'the inserted table is a real table');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
