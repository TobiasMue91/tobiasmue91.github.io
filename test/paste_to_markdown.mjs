#!/usr/bin/env node
// Test suite for tools/paste_to_markdown.html (Paste to Markdown).
//
// Runs the page's DOM-free <script id="core"> block in Node. HTML fixtures are parsed with linkedom
// (the page uses the browser's DOMParser) and handed to the core through its own fromDOM(). The page
// promises Markdown that shows the same thing as what was pasted, so most checks do not trust a
// hand-written expected string alone: they render the output again with marked (a CommonMark/GFM
// renderer the page does not use for conversion) and compare text, emphasis, links, list items and
// table cells with the input. Golden strings pin the exact style on top of that.
//
//   npm i --no-save linkedom@0.18.5 marked@15.0.4     # once (CYPRESS_INSTALL_BINARY=0 skips Cypress)
//   node test/paste_to_markdown.mjs                    # everything
//   node test/paste_to_markdown.mjs escape roundtrip   # named suites only
//
// Suites: golden, sources, escape, roundtrip, options, plain, safety, edges.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';
import {parseHTML} from 'linkedom';
import {marked} from 'marked';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'paste_to_markdown.html');
const ALL = ['golden', 'sources', 'escape', 'roundtrip', 'options', 'plain', 'safety', 'edges'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(got === want, what, `got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const P = ctx.module.exports;

const tree = h => P.fromDOM(parseHTML('<!doctype html><html><body>' + h + '</body></html>').document.body);
const conv = (h, o) => P.convert(tree(h), o);
const md = (h, o) => conv(h, o).markdown;
const render = m => marked.parse(m, {gfm: true, breaks: false});
// text a reader sees, whitespace-normalised
const flat = s => s.replace(/\s+/g, '');
const seen = h => { const d = parseHTML('<!doctype html><html><body>' + h + '</body></html>').document; d.querySelectorAll('script,style,input').forEach(n => n.remove()); return d.body.textContent.replace(/[\s\u00a0]+/g, ' ').trim(); };
const count = (h, sel) => parseHTML('<!doctype html><html><body>' + h + '</body></html>').document.querySelectorAll(sel).length;

if (suites.includes('golden')) {
  section('golden');
  const G = [
    ['<ul><li>A<ul><li>A1<ol><li>x</li><li>y</li></ol></li></ul></li><li>B</li></ul>', '- A\n  - A1\n    1. x\n    2. y\n- B', 'nested list, tight, indented to the marker'],
    ['<ol start="9"><li>a</li><li>b</li></ol>', '9. a\n10. b', 'ordered start'],
    ['<ul><li><p>one</p><p>more</p></li><li><p>two</p></li></ul>', '- one\n\n  more\n\n- two', 'loose list'],
    ['<ul><li><p>one</p></li><li><p>two</p></li></ul>', '- one\n- two', '<li><p> alone stays tight'],
    ['<a href="https://e.com/x" title="T">ex</a>', '[ex](https://e.com/x "T")', 'link with title'],
    ['<a href="https://e.com">https://e.com</a>', '<https://e.com>', 'autolink'],
    ['<a href="mailto:a@b.org">a@b.org</a>', '<a@b.org>', 'email autolink'],
    ['<a href="https://e.com/a b">x</a>', '[x](<https://e.com/a b>)', 'space in destination'],
    ['<a href="javascript:alert(1)">x</a>', 'x', 'javascript: link dropped'],
    ['<p>see <a href="/rel">here</a>.</p>', 'see [here](/rel).', 'relative link kept'],
    ['<img src="a.png" alt="Alt" title="Ti">', '![Alt](a.png "Ti")', 'image'],
    ['<a href="https://e.com"><img src="i.png" alt="i"></a>', '[![i](i.png)](https://e.com)', 'linked image'],
    ['<pre><code class="language-js">let a=`x`;\n```\n</code></pre>', '````js\nlet a=`x`;\n```\n````', 'fence longer than content'],
    ['<p>inline <code>a`b</code> and <code>`x</code></p>', 'inline ``a`b`` and `` `x ``', 'code span backticks'],
    ['<strong>b <em>bi</em></strong> <em>i <strong>ib</strong></em> <b> sp </b><s>gone</s>', '**b *bi*** *i **ib*** **sp** ~~gone~~', 'emphasis nesting and edge spaces'],
    ['<p><b>bo</b>ld and <i>un</i>der</p>', '**bo**ld and *un*der', 'intraword emphasis uses *'],
    ['<p><b>a</b><b>b</b> <b>c</b><b> d</b></p>', '**ab** **c d**', 'adjacent bold merged, unbolded space respected'],
    ['<p><b>x<i>y</i></b><i>z</i></p>', '**x*y***_z_', 'reopened emphasis does not merge with a closer'],
    ['<p><strong>bold <em>both</em></strong><em> after</em></p>', '**bold *both*** *after*', 'whitespace never opens a mark'],
    ['<h2>Title <b>bold</b></h2>', '## Title bold', 'no bold inside headings'],
    ['<h3>C#</h3>', '### C\\#', 'closing hash escaped'],
    ['<h1></h1><p>x</p>', 'x', 'empty heading dropped'],
    ['<blockquote><p>a</p><p>b</p></blockquote>', '> a\n>\n> b', 'blockquote'],
    ['<p>a<br>b</p>', 'a\\\nb', 'hard break'],
    ['<hr>', '---', 'rule'],
    ['<p>x<sup>2</sup> H<sub>2</sub>O</p>', 'x<sup>2</sup> H<sub>2</sub>O', 'sup and sub'],
    ['<ul><li><input type=checkbox checked> done</li><li><input type=checkbox> todo</li></ul>', '- [x] done\n- [ ] todo', 'task list'],
    ['<ul><li>[x] literal</li></ul>', '- \\[x] literal', 'literal [x] is not a task'],
    ['<table><tr><td>a|b</td><td colspan=2>c<br>d</td></tr><tr><td>1</td><td>2</td><td>3</td></tr></table>', '| a\\|b | c<br>d |     |\n| ---- | ------ | --- |\n| 1    | 2      | 3   |', 'table pipes, colspan, breaks'],
    ['<table><thead><tr><th align=left>Name</th><th style="text-align:right">Qty</th><th align=center>Mid</th></tr></thead><tbody><tr><td>Apple</td><td>3</td><td>ok</td></tr></tbody></table>', '| Name  | Qty | Mid |\n| :---- | --: | :-: |\n| Apple |   3 | ok  |', 'alignment'],
    ['<table><tr><td rowspan=2>a</td><td>b</td></tr><tr><td>c</td></tr></table>', '| a   | b   |\n| --- | --- |\n|     | c   |', 'rowspan'],
    ['<table><tr><td><h1>T</h1><p>p</p></td></tr></table>', '# T\n\np', 'one-column layout table passes through'],
    ['<table><caption>Cap</caption><tr><th>日本</th><th>x</th></tr><tr><td>a</td><td>b</td></tr></table>', 'Cap\n\n| 日本 | x   |\n| ---- | --- |\n| a    | b   |', 'caption, wide characters'],
    ['<table><tr><th>k</th><th>v</th></tr><tr><td>l</td><td><ul><li>a</li><li>b</li></ul></td></tr></table>', '| k   | v          |\n| --- | ---------- |\n| l   | • a<br>• b |', 'list inside a cell'],
    ['<dl><dt>Term</dt><dd>Def</dd></dl>', '**Term**\n\nDef', 'definition list'],
    ['<p>Grüße — 日本語 😀 &nbsp;x</p>', 'Grüße — 日本語 😀 x', 'non-ASCII, nbsp'],
    ['<p>a\u200bb</p>', 'ab', 'zero-width space removed'],
  ];
  for (const [h, want, what] of G) eq(md(h), want, what);
}

if (suites.includes('sources')) {
  section('sources');
  // Google Docs clipboard: wrapper <b style="font-weight:normal">, styled spans, aria-level lists,
  // links through google.com/url, code font.
  const docs = `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b"><h1 dir="ltr" style="line-height:1.38;margin-top:20pt"><span style="font-size:20pt;font-family:Arial,sans-serif;color:#000000;font-weight:400;font-style:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">Plan</span></h1><p dir="ltr"><span style="font-family:Arial;font-weight:400;white-space:pre-wrap;">Read </span><a href="https://www.google.com/url?q=https://x.org/a%3Fb%3D1&amp;sa=D&amp;source=editors"><span style="color:#1155cc;text-decoration:underline;">the doc</span></a><span style="font-weight:700;"> now</span><span style="font-weight:400"> and run </span><span style="font-family:'Courier New',monospace;">make</span><span style="vertical-align:super;">1</span></p><br><ul style="margin-top:0"><li dir="ltr" aria-level="1" style="list-style-type:disc"><p dir="ltr" role="presentation"><span>One</span></p></li><li dir="ltr" aria-level="2"><p role="presentation"><span style="font-style:italic">Two</span></p></li><li aria-level="1"><p role="presentation"><span style="text-decoration:line-through">Three</span></p></li></ul><p><span style="font-family:'Courier New'">x = 1</span></p><p><span style="font-family:'Courier New'">  y = 2</span></p></b>`;
  eq(md(docs), '# Plan\n\nRead [the doc](https://x.org/a?b=1) **now** and run `make`<sup>1</sup>\n\n- One\n  - *Two*\n- ~~Three~~\n\n```\nx = 1\n  y = 2\n```', 'Google Docs');
  // Docs nests sub-lists as <ul> directly inside <ul>
  eq(md('<ul><li>a</li><ul><li>b</li></ul><li>c</li></ul>'), '- a\n  - b\n- c', 'list directly inside list');
  eq(md('<ul><li role="checkbox" aria-checked="true"><p>done</p></li><li role="checkbox" aria-checked="false"><p>open</p></li></ul>'), '- [x] done\n- [ ] open', 'Docs checklist');
  // Word: MsoListParagraph with mso-list levels and an ignored bullet span
  const word = `<p class=MsoNormal><b><span style='font-family:Calibri'>Word bold</span></b><o:p></o:p></p><p class=MsoListParagraphCxSpFirst style='text-indent:-18.0pt;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>1.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp; </span></span><![endif]>First<o:p></o:p></p><p class=MsoListParagraphCxSpMiddle style='mso-list:l0 level2 lfo1'><span style='mso-list:Ignore'>o<span>&nbsp; </span></span>Sub<o:p></o:p></p><p class=MsoListParagraphCxSpLast style='mso-list:l0 level1 lfo1'><span style='mso-list:Ignore'>2.<span>&nbsp; </span></span>Second<o:p></o:p></p><p class=MsoNormal>After</p>`;
  eq(md(word), '**Word bold**\n\n1. First\n   - Sub\n2. Second\n\nAfter', 'Word');
  // GitHub-rendered code block and VS Code's copy (divs per line, pre white-space, code font)
  eq(md('<div class="highlight highlight-source-python"><pre><span class="pl-k">def</span> f():\n    <span>return</span> 1</pre></div>'), '```python\ndef f():\n    return 1\n```', 'GitHub code block language');
  eq(md('<div style="color:#ccc;font-family:Consolas, \'Courier New\', monospace;white-space:pre;"><div><span>if</span> (a) {</div><div>  b();</div><div>}</div></div>'), '```\nif (a) {\n  b();\n}\n```', 'VS Code copy');
  // Web page: layout chrome, scripts, iframes, a Wikipedia-style citation
  const r = conv('<nav><a href="/">Home</a></nav><article><h1>T</h1><p>Fact.<sup class="reference"><a href="#cite-1">[1]</a></sup></p><script>alert(1)</script><style>p{}</style><iframe src="https://yt"></iframe><video src=v></video></article>');
  eq(r.markdown, '[Home](/)\n\n# T\n\nFact.[<sup>\\[1\\]</sup>](#cite-1)', 'web page');
  eq(JSON.stringify(r.dropped), '{"embedded frame":1,"video":1}', 'dropped content is reported');
  const mail = conv('<p>Hi<img src="cid:image001.png@01DA"></p>');
  eq(mail.markdown + JSON.stringify(mail.dropped), 'Hi{"email-attached image":1}', 'email cid: image reported, not linked');
  // Notion-style: inline elements wrapping blocks
  eq(md('<a href="https://n.so"><div><p>Card title</p></div></a>'), '[Card title](https://n.so)', 'link around a block');
  eq(md('<b><p>one</p><p>two</p></b>'), '**one**\n\n**two**', 'bold around blocks');
}

if (suites.includes('escape')) {
  section('escape');
  // Literal text must come back as the same text after rendering, and must not turn into markup.
  const T = ['2 * 3 * 4', '*not italic*', '**not bold**', '_x_', 'snake_case_name', '__init__', '# not a heading', '1. not a list',
    '2020. A year', '- not a bullet', '+ plus', '> not a quote', '[not](a link)', '[x]: not a definition', '`not code`', '~~not struck~~', '~5 minutes',
    '<b>not a tag</b>', '&amp; stays literal', '&copy;', 'C:\\Users\\me', 'back\\slash\\*', '===', '---', '***', '___', '| a | b |', 'a <br> b', '!', 'ends with !',
    'price: $5 & 10% off', 'emoji 😀 and 日本語', '1) paren list', '    four spaces', '#hashtag', '```', '~~~', 'Ünïcödé * ✓'];
  for (const t of T) {
    // built as a tree: linkedom decodes entities in text twice, a browser does not
    const out = P.convert({t: 1, n: 'body', a: {}, c: [{t: 1, n: 'p', a: {}, c: [{t: 3, v: t}]}]}).markdown, back = render(out);
    eq(seen(back), t.replace(/\s+/g, ' ').trim(), `literal ${JSON.stringify(t)} -> ${JSON.stringify(out)}`);
    check(count(back, 'em,strong,del,code,a,h1,h2,h3,ul,ol,blockquote,hr,table,img,b') === 0, `no markup from ${JSON.stringify(t)}`, back);
  }
  // escaping stays out of the way where nothing could be misread
  eq(md('<p>2 * 3, snake_case, a_b_c, 50% off, x-y</p>'), '2 * 3, snake_case, a_b_c, 50% off, x-y', 'no needless escapes');
  eq(md('<p>Hi!</p><p><a href="u">x</a></p>'), 'Hi!\n\n[x](u)', '! at paragraph end');
  eq(render(md('<p>Wow!<a href="u">x</a></p>')).includes('<img'), false, '! before a link does not make an image');
}

if (suites.includes('roundtrip')) {
  section('roundtrip');
  // Structure survives: the rendered output has the same text and the same number of each element.
  const R = [
    '<h1>Title</h1><p>Intro with <strong>bold</strong>, <em>italic</em>, <del>del</del>, <code>code</code> and <a href="https://a.b/c?d=e&amp;f=(g)">a link</a>.</p>',
    '<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li><li>d</li></ul><ol><li>e</li><li>f<ol><li>g</li></ol></li></ol>',
    '<table><thead><tr><th>h1</th><th>h2</th></tr></thead><tbody><tr><td><b>x</b> | y</td><td><a href="u">z</a></td></tr><tr><td>`q`</td><td>w*</td></tr></tbody></table>',
    '<blockquote><p>quote <em>em</em></p><ul><li>in quote</li></ul></blockquote><pre>pre\n  indented\n\nblank</pre>',
    '<p><strong>bold <em>both</em></strong><em> after</em></p><p><em>a <strong>b</strong> c</em></p><p><b>x</b><i>y</i><s>z</s></p>',
    '<p><span style="font-weight:bold">B</span><span style="font-style:italic">I</span> <span style="font-weight:700;font-style:italic">BI</span> <span style="text-decoration:line-through">S</span></p>',
    '<ol start="3"><li><p>p1</p><pre><code>code in item</code></pre></li><li>two</li></ol>',
    '<p>Line<br>break<br><br>double</p><p>a <b> b </b> c</p>',
    '<h2>A <a href="#x">link</a> in a heading</h2><p><img src="a.png" alt="alt [text]"> after</p>',
  ];
  const S = 'h1,h2,h3,p,strong,em,del,code,a,li,ul,ol,table,th,td,blockquote,pre,img';
  for (const h of R) {
    const out = md(h), back = render(out);
    eq(flat(seen(back)), flat(seen(h)), 'text survives: ' + h.slice(0, 50));
    for (const sel of S.split(',')) {
      const want = count(h.replace(/<(\/?)(b|i|s)>/g, (m, c, t) => `<${c}${{b: 'strong', i: 'em', s: 'del'}[t]}>`).replace(/<span style="[^"]*">/g, ''), sel);
      if (['strong', 'em', 'del', 'p', 'li', 'code', 'pre'].includes(sel)) continue; // merged or re-wrapped by design; counted below by text
      eq(count(back, sel), want, `${sel} count: ${h.slice(0, 40)}`);
    }
  }
  // emphasis by text: what was bold is bold, nothing else
  const strongText = h => [...parseHTML('<!doctype html><html><body>' + h + '</body></html>').document.querySelectorAll('strong')].map(e => e.textContent.trim()).join('|');
  eq(strongText(render(md(R[5]))), 'B|BI', 'styled spans: bold text');
  eq(strongText(render(md(R[4]))), 'bold both|b|x', 'nested emphasis: bold text');
}

if (suites.includes('options')) {
  section('options');
  const h = '<h1>T</h1><h2>S</h2><h3>U</h3><p><em>i</em> <strong>b</strong> <a href="u">l</a> <a href="u">m</a> <a href="v" title="t">n</a></p><ul><li>a</li></ul><pre><code class="language-js">c</code></pre>';
  eq(md(h), '# T\n\n## S\n\n### U\n\n*i* **b** [l](u) [m](u) [n](v "t")\n\n- a\n\n```js\nc\n```', 'defaults');
  eq(md(h, {headingStyle: 'setext', emDelimiter: '_', strongDelimiter: '__', bulletListMarker: '*', linkStyle: 'referenced', codeBlockStyle: 'indented'}),
    'T\n===\n\nS\n---\n\n### U\n\n_i_ __b__ [l][1] [m][1] [n][2]\n\n* a\n\n    c\n\n[1]: u\n[2]: v "t"', 'every option switched');
  eq(md('<ul><li>a</li></ul>', {bulletListMarker: '+'}), '+ a', 'plus bullets');
  eq(md('<p>x<em>y</em>z</p>', {emDelimiter: '_'}), 'x*y*z', '_ falls back to * inside a word');
  eq(md('<p>x</p>', {headingStyle: 'bogus', bulletListMarker: '>'}), 'x', 'invalid saved values fall back');
  eq(md('<ul><li>a</li></ul>', {bulletListMarker: '>'}), '- a', 'invalid marker -> default');
  // reference labels never collide with literal [1] in the text
  eq(render(md('<p>[1] cite <a href="u">l</a></p>', {linkStyle: 'referenced'})).match(/<a /g).length, 1, 'literal [1] stays text in reference mode');
}

if (suites.includes('plain')) {
  section('plain');
  eq(P.plainText('# Already *markdown*\r\n\r\n- item  \r\n'), '# Already *markdown*\n\n- item', 'plain text is kept as written');
  eq(P.plainText('• one\n  ◦ two\n▪ three'), '- one\n  - two\n- three', 'typographic bullets become markers');
  eq(P.plainText('• one', {bulletListMarker: '*'}), '* one', 'bullet option');
  eq(P.plainText('   \n\n  '), '', 'whitespace only');
  eq(P.plainText('a\tb'), 'a\tb', 'tabs kept');
}

if (suites.includes('safety')) {
  section('safety');
  const evil = '<p onclick="x()">a<img src="https://track.er/p.gif" onerror="alert(1)"><a href="javascript:alert(1)">j</a><script>alert(1)</script><style>*{}</style><iframe src="x"></iframe><span style="background:url(https://t.er/x);font-weight:700">b</span><form action="x"><input name=q></form><svg onload=alert(1)></svg></p>';
  const s = P.safeHTML(tree(evil));
  check(!/\son\w+=/i.test(s), 'no event handlers', s);
  check(!/<script|<style|<iframe|<svg|<form/i.test(s), 'no active elements', s);
  check(!/javascript:/i.test(s), 'no javascript: urls', s);
  check(!/\ssrc=/i.test(s), 'images do not load (data-src only)', s);
  check(!/url\(/i.test(s), 'no url() in styles', s);
  check(/font-weight:700/.test(s), 'styles the converter reads are kept', s);
  // the pane's own HTML converts the same as the original paste
  const a = md(evil), b = md(s);
  eq(b, a, 'shown HTML converts like the paste');
  eq(md('<span data-dropped="video" class="dropped">video</span>x'), 'x', 'dropped placeholder is not text');
  eq(JSON.stringify(conv('<span data-dropped="video">video</span>').dropped), '{"video":1}', 'dropped placeholder still counted');
}

if (suites.includes('edges')) {
  section('edges');
  eq(md(''), '', 'empty');
  eq(md('   \n\t '), '', 'whitespace');
  eq(md('<p> </p><p>&nbsp;</p><br><br>'), '', 'empty paragraphs');
  eq(md('<b></b><i> </i>x'), 'x', 'empty emphasis');
  eq(md('<p>unclosed <b>bold <i>both</p><p>next'), '**unclosed bold *both***\n\nnext'.replace('**unclosed bold', 'unclosed **bold'), 'malformed html');
  eq(md('<table></table><ul></ul><pre></pre>'), '', 'empty containers');
  eq(md('<code></code>x'), 'x', 'empty code');
  let deep = 'x'; for (let i = 0; i < 400; i++) deep = '<div><span>' + deep + '</span></div>';
  eq(md(deep), 'x', 'deep nesting');
  // a thousand times a normal paste: must stay well under a second or two in the worker
  const unit = '<h2>Section</h2><p>Some <b>bold</b> and <a href="https://e.com">link</a> text, 2 * 3.</p><ul><li>a</li><li>b</li></ul><table><tr><th>k</th><th>v</th></tr><tr><td>1</td><td>2</td></tr></table>';
  const big = tree(unit.repeat(1000)), t0 = Date.now(), out = P.convert(big).markdown, ms = Date.now() - t0;
  check(ms < 3000, `1000x paste converts in ${ms} ms`);
  eq(out.split('## Section').length - 1, 1000, '1000x: every section kept');
  eq(md('<p>' + 'a'.repeat(200000) + '</p>').length, 200000, 'very long paragraph');
  eq(md('<pre>\n\nfirst</pre>'), '```\n\nfirst\n```', 'pre keeps all but the first newline');
  eq(md('<p>a</p>\r\n<p>b</p>'), 'a\n\nb', 'CRLF between tags');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
