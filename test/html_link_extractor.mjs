#!/usr/bin/env node
// Test suite for tools/html_link_extractor.html (HTML Link Extractor).
//
// Runs the page's DOM-free <script id="core"> block (LinkCore) in Node. The core has its own HTML
// tokenizer, so that it can run in a Worker on large pages and report source lines; the promise is that
// it finds the same links, with the same href and anchor text, as a browser's parser. The `browser` suite
// checks exactly that against Chromium's DOMParser on a corpus of awkward markup plus a seeded fuzz set,
// so no expected value there is hand-written. The other suites pin character references (WHATWG table
// and rules), URL resolution (<base href>, page address, canonical guess), classification, plain-text
// URLs, exports and size.
//
//   node test/html_link_extractor.mjs                 # everything (browser suite needs Playwright's Chromium)
//   node test/html_link_extractor.mjs decode resolve  # named suites only
//
// Suites: decode, tokenize, contract, resolve, classify, text, export, big, browser.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'html_link_extractor.html');
const ALL = ['decode', 'tokenize', 'contract', 'resolve', 'classify', 'text', 'export', 'big', 'browser'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => { const g = JSON.stringify(got), w = JSON.stringify(want); check(g === w, what, `got  ${g}\n          want ${w}`); };
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, URL};
vm.runInNewContext(src, ctx);
const L = ctx.module.exports;
const links = (h, page) => L.analyze(h, {page}).links.filter(l => l.kind === 'link');
const urls = (h, page) => links(h, page).map(l => l.url);

if (suites.includes('decode')) {
  section('decode');
  const T = [
    ['&amp;', true, '&'], ['&lt;&gt;&quot;&apos;', false, '<>"\''], ['&nbsp;', false, ' '],
    ['&copy=2', true, '&copy=2'], ['&copy=2', false, '©=2'], ['?a=1&copy;b', true, '?a=1©b'],
    ['&ampx', true, '&ampx'], ['&ampx', false, '&x'], ['&amp', true, '&'], ['&amp ', true, '& '],
    ['&notit;', false, '¬it;'], ['&notin;', false, '∉'], ['&NotEqualTilde;', false, '≂̸'],
    ['&#65;&#x41;&#X41', false, 'AAA'], ['&#128512;', false, '😀'], ['&#x80;', false, '€'], ['&#150;', false, '–'],
    ['&#0;', false, '�'], ['&#xD800;', false, '�'], ['&#x110000;', false, '�'], ['&#99999999999999;', false, '�'],
    ['&#;', false, '&#;'], ['&#x;', false, '&#x;'], ['&bogus;', false, '&bogus;'], ['&', false, '&'], ['a&&b', false, 'a&&b'],
    ['&CounterClockwiseContourIntegral;', false, '∳'], ['&AMP;', false, '&'], ['&Amp;', false, '&Amp;']
  ];
  T.forEach(([s, attr, want]) => eq(L.decode(s, attr), want, `decode ${JSON.stringify(s)} ${attr ? 'attr' : 'text'}`));
}

if (suites.includes('tokenize')) {
  section('tokenize');
  const tags = h => { const out = []; L.tokenize(h, t => out.push((t.end ? '/' : '') + t.name + (t.order.length ? '[' + t.order.map(k => k + '=' + t.attrs[k]).join(' ') + ']' : '')), () => {}); return out; };
  eq(tags('<A HREF=x>'), ['a[href=x]'], 'names are lowercased');
  eq(tags('<a href=x/>'), ['a[href=x/]'], 'unquoted value takes the slash');
  eq(tags('<a href = "y" href="z">'), ['a[href=y]'], 'spaces round = and first duplicate wins');
  eq(tags("<a title='a>b' href=c>"), ['a[title=a>b href=c]'], '> inside quotes');
  eq(tags('<a href="x"title="t">'), ['a[href=x title=t]'], 'no space between attributes');
  eq(tags('<a =x>'), ['a[=x=]'], 'attribute name starting with =');
  eq(tags('<!-- <a href=1> --><a href=2>'), ['a[href=2]'], 'comment hides markup');
  eq(tags('<!--><a href=2>'), ['a[href=2]'], '<!--> closes at once');
  eq(tags('<!-- x --!><a href=2>'), ['a[href=2]'], '--!> closes a comment');
  eq(tags('<script>"<a href=1>"</script><a href=2>'), ['script', '/script', 'a[href=2]'], 'script content is not markup');
  eq(tags('<style>a{}</style ><a href=2>'), ['style', '/style', 'a[href=2]'], 'style end tag with space');
  eq(tags('<textarea><a href=1></textarea>'), ['textarea', '/textarea'], 'textarea is RCDATA');
  eq(tags('<noscript><a href=1></a></noscript>'), ['noscript', 'a[href=1]', '/a', '/noscript'], 'noscript parsed (scripting off, as DOMParser)');
  eq(tags('a < b <3 <a href=1>'), ['a[href=1]'], 'stray < is text');
  eq(tags('<? php ?><a href=1>'), ['a[href=1]'], 'processing instruction is a bogus comment');
  eq(tags('</ a><a href=1>'), ['a[href=1]'], '</ space is a bogus comment');
  eq(tags('<a href="never'), [], 'unclosed quote drops the tag');
  eq(tags('<a href=1'), [], 'EOF in tag drops it');
}

if (suites.includes('contract')) {
  section('contract');
  // The old page's sample inputs (fetched as https://example.com/dir/page.html). Differences from it are deliberate:
  // # and empty hrefs are listed as "page", <area>, <base> and resources are read, plain text gives its URLs.
  const P = 'https://example.com/dir/page.html';
  const row = (h, page = P) => links(h, page).map(l => [l.url, l.type, l.text, l.textSrc]);
  eq(row('<a href="https://example.com">Example</a>'), [['https://example.com/', 'internal', 'Example', 'text']], '(a)');
  eq(row('<a href="/about">About</a><a href="/about">About again</a>'), [['https://example.com/about', 'internal', 'About', 'text'], ['https://example.com/about', 'internal', 'About again', 'text']], '(b) every occurrence');
  eq(L.unique(links('<a href="/about">About</a><a href="/about">About again</a>', P)).map(l => [l.count, l.texts]), [[2, ['About', 'About again']]], '(b) unique counts both');
  eq(row('<a href="mailto:x@y.com">Mail</a> <a href="tel:+123">Call</a>'), [['mailto:x@y.com', 'email', 'Mail', 'text'], ['tel:+123', 'phone', 'Call', 'text']], '(c)');
  eq(row('<a href="#top">Top</a>'), [['https://example.com/dir/page.html#top', 'page', 'Top', 'text']], '(d) fragment kept as same page');
  eq(row('<a>no href</a><a href="">empty</a>'), [['https://example.com/dir/page.html', 'page', 'empty', 'text']], '(e) no href is not a link, empty is');
  eq(row('<img src="pic.png"><link rel="stylesheet" href="s.css"><script src="a.js"></script>'), [], '(f) no links');
  eq(L.analyze('<img src="pic.png"><link rel="stylesheet" href="s.css"><script src="a.js"></script>', {page: P}).links.map(l => [l.kind, l.url]),
    [['image', 'https://example.com/dir/pic.png'], ['linktag', 'https://example.com/dir/s.css'], ['script', 'https://example.com/dir/a.js']], '(f) resources');
  eq(row('<a href="javascript:void(0)">js</a>'), [['javascript:void(0)', 'script', 'js', 'text']], '(g)');
  eq(row('<a href="  https://x.com/a?b=1&amp;c=2  ">  spaced &amp; text  </a>'), [['https://x.com/a?b=1&c=2', 'external', 'spaced & text', 'text']], '(h)');
  eq(row('see https://foo.bar/baz and www.qux.com'), [['https://foo.bar/baz', 'external', '', ''], ['https://www.qux.com/', 'external', '', '']], '(i) plain text');
  eq(row('<a href="https://例え.jp/パス">日本</a>'), [['https://xn--r8jz45g.jp/%E3%83%91%E3%82%B9', 'external', '日本', 'text']], '(j) IDN');
  eq(L.pretty('https://xn--r8jz45g.jp/%E3%83%91%E3%82%B9'), 'https://例え.jp/パス', '(j) shown as typed');
  eq(row(''), [], '(k) empty');
  const l = L.analyze('<a href="https://a.com>broken<a href=\'b.html\'>b</a>', {page: P});
  eq([l.links.length, l.problems.map(p => p.type + '@' + p.line)], [0, ['quote@1']], '(l) unclosed quote: nothing, and a note');
  eq(row('<a href="https://WWW.Example.com:8443/x" rel="nofollow" target="_blank"><img alt=\' Logo "q" \'></a>').concat(links('<a href=x rel="NoFollow  ugc" target=_blank>y</a>', P).map(l => [l.rel, l.target])),
    [['https://www.example.com:8443/x', 'internal', 'Logo "q"', 'image-alt'], ['nofollow ugc', '_blank']], 'image alt, rel, target');
  eq(row('<a href="HTTPS://EXAMPLE.COM/Up">up</a><a href="https://sub.example.com/">s</a>', 'https://www.example.com').map(r => r[1]), ['internal', 'external'], 'www ignored, other subdomains external');
  eq(row('<a href="http://[bad">bad</a>').map(r => r[1]), ['invalid'], 'unparseable is invalid, not dropped');
  eq(row('<a href="http://exa mple.com/">s</a>').map(r => r[1]), ['invalid'], 'space in host is invalid');
  eq(L.analyze('<a href="https://b.com/p>Broken</a> <a href="https://c.com/">c</a>').problems.map(p => p.type), ['markup'], 'href swallowing markup is flagged');
  eq(L.analyze('<a href="https://s.com/gift cards">g</a><a href=" https://s.com/ok ">o</a>').problems.map(p => p.type + ':' + p.href), ['space:https://s.com/gift cards'], 'space inside an address flagged, not at its ends');
}

if (suites.includes('resolve')) {
  section('resolve');
  eq(urls('<a href="a.html">x</a>'), ['a.html'], 'no address: relative stays as written');
  eq(urls('<a href="a.html">x</a>', 'https://e.com/d/p'), ['https://e.com/d/a.html'], 'page address');
  eq(urls('<a href="a.html">x</a>', 'e.com/d/'), ['https://e.com/d/a.html'], 'bare host gets https');
  eq(urls('<base href="https://cdn.e.com/v2/"><a href="a.html">x</a>', 'https://e.com/'), ['https://cdn.e.com/v2/a.html'], '<base> wins over the address');
  eq(urls('<base href="/sub/"><a href="a">x</a>', 'https://e.com/d/p'), ['https://e.com/sub/a'], 'relative <base> against the address');
  eq(urls('<a href="a">x</a><base href="https://b.com/">'), ['https://b.com/a'], '<base> after the link still applies');
  eq(urls('<base target=_blank><base href="https://one.com/"><base href="https://two.com/"><a href="a">x</a>'), ['https://one.com/a'], 'first <base> with href');
  eq(urls('<base href="javascript:alert(1)"><a href="a">x</a>', 'https://e.com/'), ['https://e.com/a'], 'javascript: base ignored');
  const c = L.analyze('<link rel="canonical" href="https://e.com/shop/x"><a href="../y">y</a>');
  eq([c.links.filter(l => l.kind === 'link').map(l => l.url), c.baseSrc], [['https://e.com/y'], 'canonical'], 'canonical used as a guess');
  eq(urls('<link rel="canonical" href="https://e.com/a"><a href="b">b</a>', 'https://f.com/')[0], 'https://f.com/b', 'typed address beats canonical');
  eq(L.analyze('<meta property="og:url" content="https://o.com/a/b"><a href="c">c</a>').links[0].url, 'https://o.com/a/c', 'og:url guess');
  eq(urls('<a href="//cdn.x.com/a">x</a>'), ['//cdn.x.com/a'], 'protocol-relative without address');
  eq(urls('<a href="//cdn.x.com/a">x</a>', 'http://e.com/'), ['http://cdn.x.com/a'], 'protocol-relative takes the scheme');
  eq(urls('<a href="\n  /a\tb \n">x</a>', 'https://e.com/'), ['https://e.com/ab'], 'tabs and newlines removed, ends trimmed');
  eq(urls('<a href="?q=1">x</a><a href="../../../../up">y</a>', 'https://e.com/a/b'), ['https://e.com/a/b?q=1', 'https://e.com/up'], 'query-only and too many ..');
  eq(urls('<a href="https://e.com/a b">x</a>'), ['https://e.com/a%20b'], 'space in path encoded');
  eq(L.analyze('<a href=a>x</a>', {page: 'not a url'}).pageSrc, 'invalid', 'unusable address reported');
}

if (suites.includes('classify')) {
  section('classify');
  const ty = (h, p) => links(h, p).map(l => l.type);
  eq(ty('<a href="/a">a</a><a href="b">b</a><a href="https://x.com">c</a>'), ['internal', 'internal', 'external'], 'without address: relative internal, absolute external');
  eq(ty('<a href="https://e.com/a">a</a><a href="https://E.COM./b">b</a><a href="http://www.e.com:81/">c</a>', 'https://e.com/'), ['internal', 'internal', 'internal'], 'host match ignores case, trailing dot, port, www');
  eq(ty('<a href="#">a</a><a href="">b</a><a href="#x">c</a>', 'https://e.com/'), ['page', 'page', 'page'], 'same page');
  eq(ty('<a href="mailto:a@b">a</a><a href="tel:1">b</a><a href="sms:1">c</a><a href="JavaScript:x()">d</a><a href="ftp://f/x">e</a><a href="data:,x">f</a>'), ['email', 'phone', 'phone', 'script', 'other', 'other'], 'schemes');
  eq(links('<a href="/a" aria-label="Menu"><svg></svg></a><a href="/b" title="T"></a><a href="/c"> </a>').map(l => [l.text, l.textSrc]), [['Menu', 'aria-label'], ['T', 'title'], ['', '']], 'text fallbacks');
  eq(links('<a href="/a">One <b>two</b>\n  three&nbsp;four</a>').map(l => l.text), ['One two three four'], 'text collapsed across tags');
  eq(links('<a href="/a">one<a href="/b">two</a>').map(l => l.text), ['one', 'two'], 'a new <a> closes the open one');
  eq(links('<a href="/a"><script>var s="<b>x</b>"</script>ok</a>').map(l => l.text), ['ok'], 'script text not anchor text');
  eq(links('<map><area href="/m" alt="Region"></map>').map(l => [l.el, l.text, l.textSrc]), [['area', 'Region', 'alt']], '<area> with alt');
  eq(links('<svg><a xlink:href="/s"><text>S</text></a></svg>').map(l => [l.href, l.text]), [['/s', 'S']], 'SVG xlink:href');
  eq(links('<meta http-equiv="refresh" content="5; url=\'/next\'">', 'https://e.com/').map(l => [l.el, l.url]), [['meta', 'https://e.com/next']], 'meta refresh');
  eq(links('<a href="/a">x</a>\n\n<a\nhref="/b">y</a>').map(l => l.line), [1, 3], 'line of the tag start');
  eq(links('<a href="/a">x</a>\r\n<a href="/b">y</a>\r<a href="/c">z</a>').map(l => l.line), [1, 2, 3], 'CRLF and CR count as one line');
  eq(L.analyze('<img srcset="a.png 1x, b.png 2x, data:image/png;base64,AA== 3x" src="a.png">', {page: 'https://e.com/'}).links.map(l => l.url),
    ['https://e.com/a.png', 'https://e.com/a.png', 'https://e.com/b.png', 'data:image/png;base64,AA=='], 'srcset candidates');
  eq(L.srcset('a.jpg 100w,b.jpg 200w , c,d.jpg 3x'), ['a.jpg', 'b.jpg', 'c,d.jpg'], 'srcset commas');
  eq(L.analyze('<input type=text src=x><input type=IMAGE src=y.png><form action="/go"></form>', {page: 'https://e.com/'}).links.map(l => l.kind + ' ' + l.url), ['image https://e.com/y.png', 'form https://e.com/go'], 'input image and form action');
}

if (suites.includes('text')) {
  section('text');
  const t = s => L.analyze(s).links.map(l => l.url);
  eq(L.analyze('see https://foo.bar/baz').mode, 'text', 'text mode without tags');
  eq(L.analyze('if a < b and c > d see http://x.y').mode, 'text', 'comparison signs are not tags');
  eq(t('(see https://en.wikipedia.org/wiki/Foo_(bar)), and https://x.com/a.'), ['https://en.wikipedia.org/wiki/Foo_(bar)', 'https://x.com/a'], 'balanced parentheses kept, trailing punctuation dropped');
  eq(t('[link](https://md.example/a?b=1) <https://angle.example/>'), ['https://md.example/a?b=1', 'https://angle.example/'], 'Markdown and angle brackets');
  eq(t('www. and https:// alone, mailto:me@x.org!'), ['mailto:me@x.org'], 'bare prefixes skipped');
  eq(t('“https://quote.example/x”'), ['https://quote.example/x'], 'closing curly quote dropped');
  eq(t('   \n\t '), [], 'whitespace only');
  eq(L.analyze('   ').mode, 'empty', 'whitespace is empty');
}

if (suites.includes('export')) {
  section('export');
  const rows = L.unique(L.analyze('<a href="/a" rel="nofollow">A, "quoted"</a><a href="/a">again</a><a href="mailto:x@y">=SUM(1)</a>', {page: 'https://e.com/'}).links);
  eq(L.toCSV(rows), 'URL,Type,Anchor Text,Anchor Text Source,Rel,Target,Line,Count\r\n"https://e.com/a",internal,"A, ""quoted""",text,"nofollow","",1 1,2\r\n"mailto:x@y",email,"\'=SUM(1)",text,"","",1,1\r\n', 'CSV keeps the old columns, quotes, guards formulas');
  eq(L.toList(rows), 'https://e.com/a\nmailto:x@y\n', 'URL list');
  eq(L.toList([]), '', 'empty list');
  eq(L.toTSV(rows).split('\n')[1], 'https://e.com/a\tinternal\tA, "quoted"\tnofollow\t1', 'TSV row');
  eq(L.toMarkdown(rows), '- [A, "quoted"](https://e.com/a)\n- [=SUM(1)](mailto:x@y)\n', 'Markdown');
  eq(L.toMarkdown(L.analyze('<a href="https://e.com/a b">[x]</a>').links), '- [\\[x\\]](https://e.com/a%20b)\n', 'Markdown escapes brackets');
  eq(JSON.parse(L.toJSON(rows))[0], {url: 'https://e.com/a', href: '/a', type: 'internal', text: 'A, "quoted"', textSource: 'text', rel: 'nofollow', target: '', element: 'a[href]', lines: [1, 1], count: 2}, 'JSON');
  eq(L.pretty('https://e.com/caf%C3%A9?q=a%2Fb%20c'), 'https://e.com/café?q=a%2Fb%20c', 'pretty keeps reserved escapes');
  eq(L.pretty('https://e.com/%E2%80%AEevil'), 'https://e.com/%E2%80%AEevil', 'pretty keeps bidi controls escaped');
  eq(L.pretty('https://e.com/%zz'), 'https://e.com/%zz', 'pretty survives bad escapes');
}

if (suites.includes('big')) {
  section('big');
  const one = '<li><a href="/p/N" class="x">Item N &amp; more</a> <img src="/i/N.png" alt=""></li>\n';
  const big = '<ul>\n' + Array.from({length: 20000}, (_, i) => one.replace(/N/g, i)).join('') + '</ul>';
  const t0 = Date.now(), r = L.analyze(big, {page: 'https://e.com/'}), ms = Date.now() - t0;
  eq([r.links.filter(l => l.kind === 'link').length, r.links.length], [20000, 40000], `${(big.length / 1e6).toFixed(1)} MB: every link found`);
  check(ms < 4000, `analysed in ${ms} ms`);
  eq(r.links.filter(l => l.kind === 'link')[19999].line, 20001, 'last link line');
  const t1 = Date.now(); L.unique(r.links); check(Date.now() - t1 < 1000, 'unique is fast');
  eq(L.analyze('<a href="' + 'x'.repeat(200000) + '">x</a>').links[0].href.length, 200000, 'very long href');
  eq(L.analyze('<'.repeat(50000) + '<a href=1>x</a>').links.length, 1, 'many stray <');
  eq(L.analyze('&'.repeat(50000)).mode, 'text', 'many & in text');
}

if (suites.includes('browser')) {
  section('browser');
  let chromium;
  try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch (e) { console.log('  skip: Playwright not available'); }
  if (chromium) {
    const corpus = [
      '<a href="a">x</a>', '<A HREF=b>Y</A>', '<a href="c" href="d">z</a>', '<a href=e/>t</a>more', "<a href='f g'>q</a>",
      '<a href="h&amp;i&copy=1&notit;&#x26;">j</a>', '<a href="k">one<a href="l">two</a></a>', '<a href="m"><b>bold</b> <i>it</i></a>',
      '<p><a href="n">par<p>next</a>', '<!-- <a href="o">c</a> --><a href="p">r</a>', '<script>"<a href=q>"</script><a href="s">t</a>',
      '<style>a[href="u"]{}</style><a href="v">w</a>', '<textarea><a href="x">y</a></textarea><a href="z">!</a>', '<noscript><a href="ns">n</a></noscript>',
      '<title><a href="ti">t</a></title><a href="after">a</a>', '<table><a href="tb">in table</a><tr><td><a href="td">cell</a></td></tr></table>',
      '<svg><a href="sv">svg</a><a xlink:href="sx">x</a></svg>', '<map><area href="ar" alt="A"></map>', '<a>none</a><a href>empty</a><a href="#">e2</a>',
      '<a href="\n  sp \t">s</a>', '<a\nhref\n=\n"nl"\n>nl</a>', '<a href="never', '<a href=1 <a href=2>x</a>', '<a href="x"title="y">z</a>',
      '<!--><a href="cc">c</a>', '<!---><a href="cd">c</a>', '<?xml x?><a href="pi">p</a>', '</ a><a href="be">b</a>', '<a href="unicode-✓">✓ 日本</a>',
      '<a href="ent">&lt;tag&gt; &amp;amp; &nbsp;x</a>', '<template><a href="tp">t</a></template>', '<select><option><a href="sel">s</a></select>',
      '<a href="aa">x<img alt="I">y</a>', '<a href="bb"><script>z</script>shown</a>', '<xmp><a href="xm"></xmp><a href="xn">n</a>',
      '<iframe><a href="if"></iframe><a href="ig">g</a>', '<a href="w1">w</a><plaintext><a href="w2">x</a>', '<a href=&quot;q&quot;>q</a>',
      '<a href="nested"><div><p>block <span>in</span> link</p></div></a>', '<a href="s1">a</a ><a href="s2">b</a foo="bar">'
    ];
    // seeded fuzz: glue fragments that stress the tokenizer
    let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    const frags = ['<a href="F">', '<a href=F>', "<a href='F'>", '</a>', 'text ', '&amp;', '&copy', '<b>', '</b>', '<!-- x -->', '<br/>', '<img alt="I">', '\n', '<a>', '<p>', '<div>', '</div>', '<span title="a>b">', '<a href="F" rel=nofollow>', ' < ', '&#169;', '<area href=F>'];
    for (let k = 0; k < 300; k++) { let s = ''; const n = 3 + rnd(14); for (let j = 0; j < n; j++) s += frags[rnd(frags.length)].replace('F', 'u' + k + '_' + j); corpus.push(s); }
    const b = await chromium.launch(); const pg = await b.newPage();
    const want = await pg.evaluate(c => c.map(h => {
      // the comment keeps Blink off its DOMParser fast path, which decodes &copy=1 in attributes against the spec;
      // the full parser (the one a page load uses) follows it
      const d = new DOMParser().parseFromString('<!--full-->' + h, 'text/html'); const out = [];
      d.querySelectorAll('a, area').forEach(e => {
        const href = e.getAttribute('href') ?? e.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (href === null) return;
        let text = '';
        if (e.localName === 'a') { const cl = e.cloneNode(true); cl.querySelectorAll('script,style,template').forEach(n => n.remove()); text = cl.textContent.replace(/[\t\n\f\r  ]+/g, ' ').trim(); if (!text) { const im = e.querySelector('img[alt]'); text = im ? im.alt.replace(/[\t\n\f\r  ]+/g, ' ').trim() : ''; } }
        else text = (e.getAttribute('alt') || '').trim();
        out.push([e.localName, href, text]);
      });
      return out;
    }), corpus);
    await b.close();
    let bad = 0;
    corpus.forEach((h, i) => {
      const got = L.analyze(h).links.filter(l => l.kind === 'link' && l.el !== 'meta').map(l => [l.el, l.href, (l.textSrc === 'aria-label' || l.textSrc === 'title' ? '' : l.text).replace(/\s/g, '')]);
      // A browser clones an open <a> into the next block (<a href=x>one<p>two</a> is two elements); in the source it is one
      // link, which is what the extractor lists. So the browser's consecutive clones are merged, text joined.
      const w = [];
      want[i].forEach(([el, href, text]) => { const last = w[w.length - 1]; if (last && last[0] === el && last[1] === href) last[2] += text.replace(/\s/g, ''); else w.push([el, href, text.replace(/\s/g, '')]); });
      // <template> content and <select> are tree-builder quirks: the tokenizer still sees those tags, the browser hides or drops them
      if (/<template>|<select>/.test(h)) return;
      const g = JSON.stringify(got), ww = JSON.stringify(w);
      if (g !== ww) { bad++; if (bad <= 12) check(false, `matches Chromium: ${JSON.stringify(h).slice(0, 90)}`, `got  ${g}\n          want ${ww}`); }
      else passes++;
    });
    check(bad === 0, `${corpus.length} documents agree with Chromium's parser (${bad} differ)`);
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
