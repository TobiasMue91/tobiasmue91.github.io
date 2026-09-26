#!/usr/bin/env node
// Test suite for tools/code_minifier.html (The Crusher) and tools/minify.html.
//
// A minifier makes one promise: the file it hands back does what the file it was given did.
// Nothing on either page can show whether it kept that promise - a stylesheet that lost its
// calc()s looks like every other minified stylesheet - so this runs each page's minifiers (the
// <script id="core"> blocks, which have no DOM) in Node's vm and judges what they return with
// something that does not come from the pages: Chromium's own CSS parser and layout for CSS and
// HTML, Python's ast module for Python, PHP's own tokenizer for PHP, and written-out
// expectations for SQL.
//
//   node test/code_minifier.mjs                          # everything
//   node test/code_minifier.mjs css sql                  # named suites only
//   node test/code_minifier.mjs css --css=a.css,b.css    # more stylesheets for the css suite
//   node test/code_minifier.mjs --page=old.html --minify-page=old.html
//
// Suites: css, html, python, sql, php. css and html need Playwright's Chromium (a dev
// dependency); python needs python3 and php needs php - without them those suites run their
// written-out cases only and say what they skipped. With terser installed
// (npm i --no-save terser@5.16.1) the html suite also checks minify.html's own JavaScript
// scanner against every inline script on the site.

import {readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync, existsSync, statSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join, extname} from 'path';
import {tmpdir} from 'os';
import {spawnSync} from 'child_process';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const args = process.argv.slice(2);
const arg = name => (args.find(a => a.startsWith(`--${name}=`)) || '').slice(name.length + 3) || null;
const PAGE = arg('page') || join(ROOT, 'tools', 'code_minifier.html');
const MINIFY_PAGE = arg('minify-page') || join(ROOT, 'tools', 'minify.html');
const EXTRA_CSS = (arg('css') || '').split(',').filter(Boolean);
const EXE = process.env.CHROMIUM_PATH || undefined;
const ALL = ['css', 'html', 'python', 'sql', 'php'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0, skips = 0;
const fail = (what, detail) => {
    failures++;
    console.log(`  FAIL  ${what}${detail ? '\n          ' + String(detail).replace(/\n/g, '\n          ') : ''}`);
};
const pass = what => {
    passes++;
    if (process.env.VERBOSE) console.log(`  ok    ${what}`);
};
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const skip = (what, why) => {
    skips++;
    console.log(`  skip  ${what}  (${why})`);
};
const section = name => console.log(`\n=== ${name} ===`);
const show = s => JSON.stringify(s.length > 160 ? s.slice(0, 160) + '…' : s);

// ---------- the pages' cores ----------
function loadCore(page, globals) {
    const html = readFileSync(page, 'utf8');
    const core = html.match(/<script id="core">([\s\S]*?)<\/script>/);
    if (!core) {
        console.log('no <script id="core"> block in ' + page);
        process.exit(1);
    }
    const ctx = vm.createContext(globals);
    vm.runInContext(core[1], ctx);
    return ctx;
}

let terser = null;
try {
    terser = await import('terser');
} catch {
}
// With scripts off in the browser, what Terser does to an inline script cannot show; a stand-in
// that returns the script unchanged keeps the suite independent of it.
const Crusher = loadCore(PAGE, {Terser: {minify: async code => ({code})}});
const HtmlMinifier = loadCore(MINIFY_PAGE, {});
// The Crusher's defaults, with the one option that is off by default switched on as well.
const CRUSH = {comments: true, whitespace: true, shortHex: true, zeroUnits: true, inline: true, attrQuotes: true};

const pagesOnSite = () => ['games', 'tools'].flatMap(dir => readdirSync(join(ROOT, dir))
    .filter(f => f.endsWith('.html')).map(f => `${dir}/${f}`)).sort();
const source = page => readFileSync(join(ROOT, page), 'utf8');

let browser = null;
async function chromium() {
    if (!browser) {
        const {chromium} = await import('playwright');
        browser = await chromium.launch(EXE ? {executablePath: EXE} : {});
    }
    return browser;
}

// ---------- css ----------
// A stylesheet as the list of what it says: every rule's selector in order, and every
// declaration's value as Chromium computes it on an empty element. A value that leans on var()
// or env() cannot be computed out of context, so it is compared as written, allowing only what
// is allowed anywhere - a space around ( ) , / separates nothing, case and three-digit hex are
// spelling, and a zero length at the top level is the same with or without its unit - and never
// inside a quoted string. Custom properties get only the first of those, because pages read
// them back from script.
const CANONICAL_CSS = () => {
    const probe = document.body.appendChild(document.createElement('div'));
    const asWritten = (v, loose) => {
        let depth = 0;
        return v.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/).map((part, k) => {
            if (k % 2) return part;
            let s = part.replace(/[ \t\n\r\f]+/g, ' ').replace(/ ?([(),\/]) ?/g, '$1');
            if (!loose) return s;
            s = s.toLowerCase().replace(/#([0-9a-f])([0-9a-f])([0-9a-f])\b/g, '#$1$1$2$2$3$3');
            let out = '';
            for (let i = 0; i < s.length; i++) {
                if (s[i] === '(') depth++;
                else if (s[i] === ')') depth--;
                const m = depth === 0 && (i === 0 || /[ ,\/]/.test(s[i - 1])) && /^0(px|em|rem|vh|vw|pt|ex|ch|vmin|vmax)(?![\w%])/.exec(s.slice(i));
                if (m) {
                    out += '0';
                    i += m[0].length - 1;
                } else out += s[i];
            }
            return out;
        }).join('').replace(/^ +| +$/g, '');
    };
    const value = (prop, v, priority) => {
        if (prop.startsWith('--')) return 'as written: ' + asWritten(v, false) + priority;
        if (/var\(|env\(/i.test(v)) return 'as written: ' + asWritten(v, true) + priority;
        probe.style.cssText = '';
        probe.style.setProperty(prop, v);
        return getComputedStyle(probe).getPropertyValue(prop) + priority;
    };
    window.canonicalCSS = css => {
        const sheet = new CSSStyleSheet();
        try {
            sheet.replaceSync(css);
        } catch (e) {
            return ['unparsable: ' + e.message];
        }
        const out = [];
        const walk = (rules, at) => {
            for (const r of rules) {
                if (r instanceof CSSStyleRule || r instanceof CSSKeyframeRule) {
                    const sel = at + (r.selectorText || r.keyText);
                    out.push('rule ' + sel);
                    for (let i = 0; i < r.style.length; i++) {
                        const p = r.style[i];
                        out.push(sel + ' | ' + p + ': ' + value(p, r.style.getPropertyValue(p), r.style.getPropertyPriority(p)));
                    }
                    if (r.cssRules) walk(r.cssRules, sel + ' > ');
                } else if (r.cssRules) {
                    const name = String(r.conditionText ?? r.name ?? r.constructor.name).replace(/\s+/g, '');
                    out.push('at ' + at + name);
                    walk(r.cssRules, at + name + ' > ');
                } else out.push(at + r.cssText);
            }
        };
        walk(sheet.cssRules, '');
        return out;
    };
};

// Sheets that each hold one thing a text-level minifier gets wrong, with what must survive.
const CSS_CASES = [
    ['calc() keeps the spaces around + and -', 'h1 { font-size: calc(1.375rem + 1.5vw); width: calc(100% - (2 * 10px)) }', ['calc(1.375rem + 1.5vw)', 'calc(100% - (2 * 10px))']],
    ['a descendant combinator before a pseudo-class', '.was-validated :valid ~ .valid-feedback { display: block }', ['.was-validated :valid~']],
    ['0% stays 0% where it is not a length', ':root { --l: 0% } .a { color: hsl(0 0% var(--l)); flex-basis: 0%; background-position: 0% 0% }', ['--l:0%', 'flex-basis:0%']],
    ['a zero inside calc() keeps its unit', ':root { --pad: 0px } .a { padding: calc(var(--pad) + 4px); top: calc(env(safe-area-inset-top, 0px) + 10px) }', ['--pad:0px', 'env(safe-area-inset-top,0px) + 10px']],
    ['flex: 0px is not flex: 0', '.a { flex: 0px } .b { margin: 0px auto; padding: 0.0em }', ['flex:0px', 'margin:0 auto', 'padding:0}']],
    ['keyframe selectors', '@keyframes k { 0% { opacity: 0 } 100% { opacity: 1 } }', ['0%{', '100%{']],
    ['strings are kept as written', '.a::before { content: "a  :  b ,  c" } .b::after { content: "\\201C  q  \\201D" }', ['"a  :  b ,  c"', '"\\201C  q  \\201D"']],
    ['strings inside custom properties and var()', ':root { --label: "a  :  b" } .x::before { content: var(--label, "c  ,  d") }', ['"a  :  b"', '"c  ,  d"']],
    ['a no-break space is not whitespace', '.b::before { content: "—\u00a0" } .c::after { content: "\u00a0\u00a0" }', ['"—\u00a0"', '"\u00a0\u00a0"']],
    ['escapes, including the space that ends one', '.\\31 0\\% { width: 10% } .md\\:flex { display: flex } .w-1\\/2 { width: 50% } .hover\\:x:hover { color: red }', ['.\\31 0\\%', '.md\\:flex', '.w-1\\/2', '.hover\\:x:hover']],
    ['an unquoted url() is one token', '.a { background: url(data:image/svg+xml;charset=utf8,%3Csvg%20a%3D%22b%20c%22%3E) no-repeat }', ['url(data:image/svg+xml;charset=utf8,%3Csvg%20a%3D%22b%20c%22%3E)']],
    ['a selector inside @supports', '@supports selector(a :hover) { .x { color: red } }', ['selector(a :hover)']],
    ['a media query keeps "and ("', '@media screen and (max-width: 600px) { .a { color: red } }', ['screen and (max-width:600px)']],
    ['a comment between two words keeps them apart', '.a { border: 1px/**/solid red }', ['1px/**/solid']],
    ['!important', '.a { color: red !important; margin: 0 ! important }', ['red!important', 'margin:0!important']],
    ['hex is shortened in values, never in custom properties', ':root { --accent: #aabbcc } .a { color: #aabbcc }', ['--accent:#aabbcc', 'color:#abc']],
    ['grid areas and line names', '.a { grid-template-areas: "a  b" "c d"; grid-template-columns: [full-start] minmax(1rem, 1fr) [content-start] 2fr }', ['"a  b" "c d"', '[full-start] minmax(1rem,1fr) [content-start] 2fr']],
    ['An+B', '.a:nth-child( 2n + 1 ) { color: red } .b:nth-child(2n - 1) { color: blue }', [':nth-child(2n+1)', ':nth-child(2n - 1)']],
    ['combinators', '.a > .b + .c ~ .d .e { color: red }', ['.a>.b+.c~.d .e{']],
    ['transform arguments', '.a { transform: translate(-50%, calc(100% + 2rem)) rotate(0deg) }', ['translate(-50%,calc(100% + 2rem))']],
    ['a media range', '@media (400px <= width <= 700px) { .a { color: red } }', ['(400px <= width <= 700px)']],
    ['an empty custom property', '.a { --empty: ; --tw: /*!*/ /*!*/ ; color: red }', ['--empty: ;', '--tw: ;']],
    ['the font shorthand', '.a { font: 12px / 1.5 "Helvetica Neue", Arial, sans-serif }', ['font:12px/1.5 "Helvetica Neue",Arial,sans-serif']],
    ['nesting', '.card { color: red; & .title { color: blue } &:hover { color: green } .x & { color: gray } }', ['& .title{', '&:hover{', '.x &{']],
    ['attribute selectors', 'a[href$=".pdf" i], [data-x ~= "y"] { color: red }', ['a[href$=".pdf" i]']],
    ['a comment inside a selector', '.a/* c */ .b { color: red } .c/* d */.e { color: blue }', ['.a .b{']],
    ['@font-face descriptors are left alone', '@font-face { font-family: X; src: url(x.woff2) format("woff2"); size-adjust: 0% }', ['size-adjust:0%']],
    ['@page', '@page :first { margin: 1in }', ['@page :first{']],
    ['container queries and layers', '@layer base, components; @container sidebar (min-width: 400px) { .a { color: red } }', ['@layer base,components;', 'sidebar (min-width:400px)']],
    ['CRLF line endings', '.a {\r\n  color: red;\r\n}\r\n', ['.a{color:red}']],
    ['an unclosed comment at the end', '.a { color: red } /* unfinished', ['.a{color:red}']]
];

// The page's CSS before this suite existed, kept here only to show the judge failing.
const OLD_CSS = css => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1').replace(/;}/g, '}').trim()
    .replace(/(^|[\s:,(])0(?:px|em|rem|%|vh|vw|pt|ex|ch|vmin|vmax)/g, '$10')
    .replace(/#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3\b/g, '#$1$2$3');

async function cssSuite() {
    section('css');
    const sheets = [];
    for (const page of pagesOnSite()) {
        [...source(page).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].forEach((m, k) => {
            if (m[1].trim()) sheets.push([`${page} <style> ${k + 1}`, m[1]]);
        });
    }
    for (const file of EXTRA_CSS) sheets.push([file, readFileSync(file, 'utf8')]);
    const minifiers = [
        ['The Crusher', css => Crusher.minifyCSS(css, CRUSH)],
        ['The Crusher, comments kept', css => Crusher.minifyCSS(css, {whitespace: true, shortHex: true, zeroUnits: true})],
        ['minify.html', css => HtmlMinifier.minifyStyle(css, true, true)]
    ];
    const page = await (await chromium()).newPage();
    await page.setContent('<!doctype html><body></body>');
    await page.evaluate(CANONICAL_CSS);
    const judge = async pairs => page.evaluate(list => list.map(([a, b]) => {
        const x = canonicalCSS(a), y = canonicalCSS(b);
        for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return [x[i] || '(nothing)', y[i] || '(nothing)'];
        return null;
    }), pairs);

    for (const [name, minify] of minifiers) {
        const outs = sheets.map(([, css]) => minify(css));
        const verdicts = [];
        for (let i = 0; i < sheets.length; i += 25) verdicts.push(...await judge(sheets.slice(i, i + 25).map(([, css], k) => [css, outs[i + k]])));
        const broken = verdicts.map((v, i) => v && `${sheets[i][0]}: ${v[0]}  ->  ${v[1]}`).filter(Boolean);
        const size = outs.reduce((a, o) => a + o.length, 0) / sheets.reduce((a, [, css]) => a + css.length, 0);
        console.log(`  ${name}: ${sheets.length} stylesheets, minified to ${(size * 100).toFixed(1)}% of their size`);
        check(!broken.length, `${name}: all ${sheets.length} stylesheets mean the same minified`,
            broken.slice(0, 5).join('\n') + (broken.length > 5 ? `\n… and ${broken.length - 5} more` : ''));
        const caseVerdicts = await judge(CSS_CASES.map(([, css]) => [css, minify(css)]));
        CSS_CASES.forEach(([what], i) => check(!caseVerdicts[i], `${name}: ${what}`, caseVerdicts[i] && caseVerdicts[i].join('  ->  ')));
    }
    for (const [what, css, expect] of CSS_CASES) {
        const out = Crusher.minifyCSS(css, CRUSH);
        const missing = expect.filter(e => !out.includes(e));
        check(!missing.length, `The Crusher writes it as expected: ${what}`, `missing ${missing.map(show).join(', ')} in ${show(out)}`);
    }
    // The judge has to be seen failing: the old text-level minifier breaks most of the cases.
    const caught = (await judge(CSS_CASES.map(([, css]) => [css, OLD_CSS(css)]))).filter(Boolean).length;
    check(caught >= 10, `the judge catches the old minifier on ${caught} of ${CSS_CASES.length} cases`);
    await page.close();
}

// ---------- html ----------
// A page as it is drawn: the text a reader sees and the box of every element, with scripts
// off (the pages build much of themselves in script, but that is not what a minifier touches)
// and every animation stopped at its start, at a desktop and a phone width.
const DRAWN = () => {
    document.getAnimations().forEach(a => {
        try {
            a.pause();
            a.currentTime = 0;
        } catch (e) {
        }
    });
    const hidden = getComputedStyle(document.body).display === 'none';
    return {
        text: hidden ? '(body not drawn)' : document.body.innerText.replace(/\s+/g, ' ').trim(),
        boxes: [...document.querySelectorAll('body *')].map(e => {
            const r = e.getBoundingClientRect();
            return `${e.tagName}${e.id ? '#' + e.id : ''} ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
        }),
        attributes: [...document.querySelectorAll('*')].map(e => e.getAttributeNames().map(n => `${n}=${e.getAttribute(n)}`).join(' '))
    };
};
const TYPES = {html: 'text/html', css: 'text/css', js: 'application/javascript', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', json: 'application/json'};

async function drawnPages(documents, widths) {
    // documents: [[name, html], ...] - each served from site.test beside the real pages, so
    // relative links resolve; nothing leaves the machine.
    const results = [];
    for (const width of widths) {
        const ctx = await (await chromium()).newContext({javaScriptEnabled: false, viewport: {width, height: 800}});
        const served = new Map();
        await ctx.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.host !== 'site.test') return route.abort();
            if (served.has(url.pathname + url.search)) return route.fulfill({status: 200, contentType: 'text/html', body: served.get(url.pathname + url.search)});
            const file = join(ROOT, decodeURIComponent(url.pathname));
            if (!existsSync(file) || statSync(file).isDirectory()) return route.fulfill({status: 404, body: ''});
            return route.fulfill({status: 200, contentType: TYPES[extname(file).slice(1)] || 'application/octet-stream', body: readFileSync(file)});
        });
        const queue = documents.map((d, i) => [i, ...d]);
        const worker = async () => {
            for (let job = queue.shift(); job; job = queue.shift()) {
                const [i, name, path, html] = job;
                const key = `/${path}?${i}`;
                served.set(key, html);
                const page = await ctx.newPage();
                try {
                    await page.goto('http://site.test' + key, {timeout: 20000});
                    results.push({width, i, name, drawn: await page.evaluate(DRAWN)});
                } catch (e) {
                    results.push({width, i, name, error: String(e.message || e).split('\n')[0]});
                }
                await page.close();
                served.delete(key);
            }
        };
        await Promise.all([worker(), worker(), worker(), worker()]);
        await ctx.close();
    }
    return results;
}

function compareDrawn(a, b) {
    if (a.error || b.error) return a.error || b.error;
    if (a.drawn.text !== b.drawn.text) {
        let i = 0;
        while (a.drawn.text[i] === b.drawn.text[i]) i++;
        return `text ${show(a.drawn.text.slice(Math.max(0, i - 25), i + 25))} -> ${show(b.drawn.text.slice(Math.max(0, i - 25), i + 25))}`;
    }
    const box = a.drawn.boxes.findIndex((x, i) => x !== b.drawn.boxes[i]);
    if (box >= 0 || a.drawn.boxes.length !== b.drawn.boxes.length) return `layout ${a.drawn.boxes[box]} -> ${b.drawn.boxes[box]}`;
    const attr = a.drawn.attributes.findIndex((x, i) => x !== b.drawn.attributes[i]);
    if (attr >= 0) return `attributes ${show(a.drawn.attributes[attr])} -> ${show(b.drawn.attributes[attr] || '')}`;
    return null;
}

const HTML_CASES = [
    ['inline elements keep the space between them', '<p><b>a</b> <i>b</i> <span>c</span>\n<a href="#">d</a></p>', ['<b>a</b> <i>b</i> <span>c</span> <a']],
    ['a no-break space is text', '<p>10\u00a0km \u00a0 \u00a0away</p>', ['10\u00a0km \u00a0 \u00a0away']],
    ['pre and textarea are kept', '<pre>  a\n   b</pre>\n<textarea>  x\n y</textarea>', ['<pre>  a\n   b</pre>', '<textarea>  x\n y</textarea>']],
    ['an element the page sets to pre-wrap', '<style>.out { white-space: pre-wrap }</style><div class="out">  a\n  <b>b</b>  </div>', ['<div class="out">  a\n  <b>b</b>  </div>']],
    ['an element the page makes inline-block', '<style>.btn { display: inline-block }</style><div class="btn">A</div>\n<div class="btn">B</div>', ['A</div> <div']],
    ['whitespace between two blocks goes', '<div>a</div>\n    <div>b</div>\n<ul>\n  <li>x</li>\n</ul>', ['</div><div>', '<ul><li>x</li></ul>']],
    ['text beside a script or style keeps its space', 'a <script>x()</script> b <style>.x{}</style> c', ['a <script>', '</script> b <style>', '</style> c']],
    ['a data block is not rewritten', '<script type="application/ld+json">{"name": "a  b", "n": 1}</script><script type="x-shader/x-fragment">#define A 1\nvoid main() {}</script>', ['"a  b"', '#define A 1\nvoid main() {}']],
    ['a conditional comment is markup', '<!--[if IE]><p>old</p><![endif]--><!-- note --><p>x</p>', ['<!--[if IE]><p>old</p><![endif]-->']]
];
const CRUSHER_HTML_CASES = [
    ['a quote before /> stays', '<img src="a.png"/><img src="b.png" alt="x" />', ['src="a.png"/>', 'src=b.png alt=x />']],
    ['SVG keeps its quotes', '<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>', ['viewBox="0 0 1 1"', 'width="1"']],
    ['whitespace between attributes', '<a\n   href="x"\n   title="a  b">t</a>', ['<a href=x title="a  b">t</a>']],
    ['script text is not searched for comments', '<script>document.write("<!-- not a comment -->")</script>', ['"<!-- not a comment -->"']]
];
const MINIFY_HTML_CASES = [
    ['a template literal holding templates', '<script>const css = `${dark ? `.a { color: #fff; }` : `.a { color: #000; }`}\n  /* kept */  `;</script>',
        ['`${dark ? `.a { color: #fff; }` : `.a { color: #000; }`}\n  /* kept */  `']]
];

async function htmlSuite() {
    section('html');
    // written-out cases first: what must come out
    const crush = html => Crusher.minifyHTML(html, CRUSH);
    const tidy = html => HtmlMinifier.minifyDocument(html, {stripComments: true, collapse: true});
    for (const [what, html, expect] of HTML_CASES) {
        const out = await Crusher.minifyHTML(html, {...CRUSH, attrQuotes: false});
        const missing = expect.filter(e => !out.includes(e));
        check(!missing.length, `The Crusher: ${what}`, `missing ${missing.map(show).join(', ')} in ${show(out)}`);
    }
    for (const [what, html, expect] of CRUSHER_HTML_CASES) {
        const out = await crush(html);
        const missing = expect.filter(e => !out.includes(e));
        check(!missing.length, `The Crusher: ${what}`, `missing ${missing.map(show).join(', ')} in ${show(out)}`);
    }
    for (const [what, html, expect] of [...HTML_CASES, ...MINIFY_HTML_CASES]) {
        const out = tidy(html);
        const missing = expect.filter(e => !out.includes(e));
        check(!missing.length, `minify.html: ${what}`, `missing ${missing.map(show).join(', ')} in ${show(out)}`);
    }

    // every page on the site, drawn as written and as each minifier hands it back
    const pages = pagesOnSite().filter(p => !/http-equiv=["']?refresh/i.test(source(p)));
    const documents = [];
    for (const p of pages) {
        const html = source(p);
        documents.push([p + ' as written', p, html], [p + ' through The Crusher', p, await crush(html)], [p + ' through minify.html', p, tidy(html)]);
    }
    // The judge has to be seen failing: deleting the whitespace between tags, as the old
    // Crusher did, must show on the pages where it fuses words.
    const naive = ['games/breakout.html', 'games/blackjack.html'];
    for (const p of naive) documents.push([p + ' with whitespace between tags deleted', p, source(p).replace(/>\s+</g, '><')]);
    const t0 = Date.now();
    const drawn = await drawnPages(documents, [1280, 390]);
    const at = new Map(drawn.map(d => [d.width + ' ' + d.name, d]));
    for (const width of [1280, 390]) {
        for (const tool of ['The Crusher', 'minify.html']) {
            const broken = pages.map(p => {
                const diff = compareDrawn(at.get(`${width} ${p} as written`), at.get(`${width} ${p} through ${tool}`));
                return diff && `${p}: ${diff}`;
            }).filter(Boolean);
            check(!broken.length, `${tool}: all ${pages.length} pages draw the same at ${width}px`, broken.slice(0, 5).join('\n') + (broken.length > 5 ? `\n… and ${broken.length - 5} more` : ''));
        }
        const caught = naive.filter(p => compareDrawn(at.get(`${width} ${p} as written`), at.get(`${width} ${p} with whitespace between tags deleted`))).length;
        check(caught === naive.length, `the judge catches deleted whitespace on ${caught} of ${naive.length} pages at ${width}px`);
    }
    console.log(`  ${drawn.length} page loads in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

    // minify.html walks JavaScript itself; Terser's printout of the syntax tree is the judge
    if (!terser) return skip('minify.html\'s JavaScript against every inline script', 'npm i --no-save terser@5.16.1');
    const printed = async (code, module) => (await terser.minify(code, {compress: false, mangle: false, module, format: {comments: false}})).code;
    let scripts = 0;
    const changed = [];
    for (const p of pages) {
        for (const m of source(p).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
            const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(m[1]);
            if (/\bsrc\s*=/i.test(m[1]) || !m[2].trim() || (type && !/javascript|module/i.test(type[1]))) continue;
            const module = !!type && /module/i.test(type[1]);
            let before;
            try {
                before = await printed(m[2], module);
            } catch {
                continue;
            }
            scripts++;
            const out = HtmlMinifier.minifyScript(m[2], true, true);
            let after;
            try {
                after = await printed(out, module);
            } catch (e) {
                after = 'syntax error: ' + e.message;
            }
            if (before !== after) changed.push(p);
        }
    }
    check(!changed.length, `minify.html: all ${scripts} inline scripts on the site are the same program minified`, changed.slice(0, 5).join('\n'));
}

// ---------- python ----------
const PY_CASES = [
    ['a # inside a string is text', 'x = "# not a comment"  # a comment\ny = \'#\'\n', 'x = "# not a comment"\ny = \'#\''],
    ['a triple-quoted string keeps its blank lines and trailing spaces', 's = """\n# heading  \n\n\n\nend"""\n\n\n\nprint(s)\n', 's = """\n# heading  \n\n\n\nend"""\n\nprint(s)'],
    ['a verbose regex keeps its # comments', 'import re\nP = re.compile(r"""\n  (?P<a>\\d+)  # digits\n""", re.X)\n', 'import re\nP = re.compile(r"""\n  (?P<a>\\d+)  # digits\n""", re.X)'],
    ['an f-string field may hold quotes', 'v = f"{d[\'#\']} and {\'}\'}"  # c\n', 'v = f"{d[\'#\']} and {\'}\'}"'],
    ['Python 3.12 f-strings may reuse the quote', 'v = f"{d["key"]} # {x!r:>{w}}"  # c\n', 'v = f"{d["key"]} # {x!r:>{w}}"'],
    ['the #! line and the encoding line stay', '#!/usr/bin/env python3\n# -*- coding: latin-1 -*-\n# other\nx = 1\n', '#!/usr/bin/env python3\n# -*- coding: latin-1 -*-\n\nx = 1'],
    ['a string prefix is not the end of a name', 'elif_ = 1\nif elif_: print(rb"\\x00#", br\'#\', Rb"#")  # c\n', 'elif_ = 1\nif elif_: print(rb"\\x00#", br\'#\', Rb"#")'],
    ['a line continuation', 'x = 1 + \\\n    2  # c\n', 'x = 1 + \\\n    2']
];
const OLD_PY = src => src.split('\n').map(l => l.replace(/#.*$/, '').replace(/\s+$/, '')).join('\n');

function pythonSuite() {
    section('python');
    for (const [what, src, expect] of PY_CASES) {
        const out = Crusher.minifyPython(src, {comments: true, whitespace: true});
        check(out === expect, what, `${show(out)}\n  expected ${show(expect)}`);
    }
    const py = spawnSync('python3', ['-c', 'import sys, sysconfig; print(sys.version_info[0] * 100 + sys.version_info[1]); print(sysconfig.get_paths()["stdlib"])'], {encoding: 'utf8'});
    if (py.status !== 0) return skip('the standard library through the Python path', 'python3 not found');
    const [version, stdlib] = py.stdout.trim().split('\n');
    const files = [];
    const walk = dir => {
        for (const f of readdirSync(dir)) {
            const full = join(dir, f);
            let st;
            try {
                st = statSync(full);
            } catch {
                continue;
            }
            if (st.isDirectory() && !/^(site-packages|dist-packages|__pycache__)$/.test(f)) walk(full);
            else if (f.endsWith('.py') && st.size < 2e6) files.push(full);
        }
    };
    walk(stdlib);
    const dir = mkdtempSync(join(tmpdir(), 'crusher-py-'));
    const pairs = [];
    let bytesIn = 0, bytesOut = 0;
    for (const [k, file] of files.entries()) {
        let src;
        try {
            src = readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        for (const [tag, o] of [['both', {comments: true, whitespace: true}], ['comments', {comments: true}], ['blank', {whitespace: true}]]) {
            const out = Crusher.minifyPython(src, o);
            if (tag === 'both') {
                bytesIn += src.length;
                bytesOut += out.length;
            }
            writeFileSync(join(dir, `${k}.${tag}.py`), out);
            pairs.push([file, join(dir, `${k}.${tag}.py`)]);
        }
    }
    // the judge has to be seen failing too: a line-by-line comment stripper
    const bad = PY_CASES.map(([, src], k) => {
        writeFileSync(join(dir, `case${k}.py`), src);
        writeFileSync(join(dir, `case${k}.old.py`), OLD_PY(src));
        return [join(dir, `case${k}.py`), join(dir, `case${k}.old.py`)];
    }).filter((_, k) => k !== 4 || +version >= 312);
    writeFileSync(join(dir, 'pairs.json'), JSON.stringify({pairs, bad}));
    const judge = spawnSync('python3', ['-c', `
import ast, json, sys, warnings
warnings.filterwarnings("ignore")
job = json.load(open(sys.argv[1]))
def tree(path):
    try:
        return ast.dump(ast.parse(open(path, encoding="utf-8").read()))
    except Exception as e:
        return "error: %s" % e
same, differ, skipped = 0, [], 0
for original, minified in job["pairs"]:
    a = tree(original)
    if a.startswith("error"):
        skipped += 1
        continue
    if a == tree(minified): same += 1
    else: differ.append(original)
caught = sum(1 for original, minified in job["bad"] if tree(original) != tree(minified))
print(json.dumps({"same": same, "differ": differ, "skipped": skipped, "caught": caught, "cases": len(job["bad"])}))
`, join(dir, 'pairs.json')], {encoding: 'utf8', maxBuffer: 1 << 26});
    rmSync(dir, {recursive: true, force: true});
    if (judge.status !== 0) return fail('the Python judge ran', judge.stderr);
    const r = JSON.parse(judge.stdout);
    console.log(`  ${files.length} standard library modules of Python ${(version / 100 | 0)}.${version % 100}, minified to ${(bytesOut / bytesIn * 100).toFixed(1)}% of their size`);
    check(!r.differ.length && r.same > 0, `the same program, three ways minified, for every standard library module that parses`,
        [...new Set(r.differ)].slice(0, 5).join('\n'));
    check(r.caught >= 4, `the judge catches a line-by-line comment stripper on ${r.caught} of ${r.cases} cases`);
}

// ---------- sql ----------
const SQL_CASES = [
    ['string contents are data', "SELECT name FROM users WHERE bio = 'likes  two  spaces' -- note\n  AND note = 'it''s -- not a comment';",
        "SELECT name FROM users WHERE bio = 'likes  two  spaces' AND note = 'it''s -- not a comment';"],
    ['a newline inside a value', "INSERT INTO t (a) VALUES ('line1\n    line2');", "INSERT INTO t(a)VALUES('line1\n    line2');"],
    ['a mysqldump: version comments, backslash escapes, a # comment', "/*!40101 SET @OLD=@@CHARACTER_SET_CLIENT */;\n/*!40014 SET FOREIGN_KEY_CHECKS=0 */;\nINSERT INTO `users` VALUES (1,'O\\'Brien','a  b'),(2,'x','y');\n# isn't SQL\nSELECT 1;",
        "/*!40101 SET @OLD=@@CHARACTER_SET_CLIENT */;/*!40014 SET FOREIGN_KEY_CHECKS=0 */;INSERT INTO `users` VALUES(1,'O\\'Brien','a  b'),(2,'x','y');# isn't SQL\nSELECT 1;"],
    ['SQL Server: GO, #temp and [names]', "SELECT * INTO #temp FROM [Order  Details] WHERE note = 'a  b'\nGO\nSELECT   2\nGO 5\n",
        "SELECT * INTO #temp FROM [Order  Details] WHERE note = 'a  b'\nGO\nSELECT 2\nGO 5"],
    ['DELIMITER keeps its line and its space', "DELIMITER $$\nCREATE PROCEDURE p()\nBEGIN\n  SELECT 1;\nEND$$\nDELIMITER ;\nCALL p();",
        "DELIMITER $$\nCREATE PROCEDURE p()BEGIN SELECT 1;END$$\nDELIMITER ;\nCALL p();"],
    ['psql: COPY rows and \\commands', "COPY t (a, b) FROM stdin;\n1\tone  two\n2\tthree\n\\.\n\n\\connect other\nSELECT  1 ;",
        "COPY t(a,b)FROM stdin;\n1\tone  two\n2\tthree\n\\.\n\\connect other\nSELECT 1;"],
    ['a $$ body is kept whole', "CREATE FUNCTION g() RETURNS text AS $body$\nif x:\n    return 'a'\n$body$ LANGUAGE plpython3u;",
        "CREATE FUNCTION g()RETURNS text AS $body$\nif x:\n    return 'a'\n$body$ LANGUAGE plpython3u;"],
    ['PostgreSQL #> is kept to the end of its line', "SELECT data #> '{a,b}' ,  x\nFROM t;", "SELECT data #> '{a,b}' ,  x\nFROM t;"],
    ['SQL*Plus runs a block on a lone slash', "BEGIN\n  NULL;\nEND;\n/\nSELECT 1 FROM dual;", "BEGIN NULL;END;\n/\nSELECT 1 FROM dual;"],
    ['a comment that opens another is kept', "/* a /* b */ c */ SELECT 1;", "/* a /* b */ c */ SELECT 1;"]
];
const SQL_KEPT_COMMENT = ['a kept -- comment keeps its newline', "SELECT a -- note\nFROM t\nWHERE b = 1 /* c */ AND c = 2;", "SELECT a -- note\nFROM t WHERE b = 1 /* c */ AND c = 2;"];

function sqlSuite() {
    section('sql');
    for (const [what, src, expect] of SQL_CASES) {
        const out = Crusher.minifySQL(src, {comments: true, whitespace: true});
        check(out === expect, what, `${show(out)}\n  expected ${show(expect)}`);
        check(Crusher.minifySQL(src, {}) === src, `${what}: with both options off nothing changes`);
    }
    const [what, src, expect] = SQL_KEPT_COMMENT;
    const out = Crusher.minifySQL(src, {whitespace: true});
    check(out === expect, what, `${show(out)}\n  expected ${show(expect)}`);
}

// ---------- php ----------
const PHP_CASE = `<?php
#[Attribute]
class Route { public function __construct(public string $p = '/x') {} }
$html = <<<HTML
  <a href="http://example.com/#top">it's here</a>
    // not a comment
  HTML;
$now = <<<'NOW'
raw $x {$y} # also text
NOW;
$a = ['k' => 'v'];
echo "{$a["k"]}  //  text";  // comment
echo 'single \\' quoted # text'; # comment
$x = new/**/stdClass;
$y = $x?->prop ?? "a  b";
if ($a) { ?>
<pre>   keep   this   </pre>
<?php } // done ?>
<p>after   the   tag</p>
<?php
echo "tail";
__halt_compiler();
DATA  // not code
`;

function phpSuite() {
    section('php');
    const out = Crusher.minifyPHP(PHP_CASE, {comments: true, whitespace: true});
    const keep = ['#[Attribute]', '<<<HTML\n  <a href="http://example.com/#top">it\'s here</a>\n    // not a comment\n  HTML', "<<<'NOW'\nraw $x {$y} # also text\nNOW",
        '"{$a["k"]}  //  text"', "'single \\' quoted # text'", 'new stdClass', '"a  b"', '<pre>   keep   this   </pre>', '<p>after   the   tag</p>', '__halt_compiler();\nDATA  // not code'];
    const missing = keep.filter(k => !out.includes(k));
    check(!missing.length, 'strings, heredocs, attributes, output and halted data are kept', `missing ${missing.map(show).join(', ')}`);
    check(!/\/\/ comment|# comment|\/\/ done/.test(out), 'comments are removed', show(out));
    const php = spawnSync('php', ['-v'], {encoding: 'utf8'});
    if (php.status !== 0) return skip('PHP\'s own tokenizer and interpreter as judges', 'php not found');
    const dir = mkdtempSync(join(tmpdir(), 'crusher-php-'));
    const cases = [['the written-out case', PHP_CASE]];
    for (const [k, [what, src]] of cases.entries()) {
        for (const [tag, o] of [['both', {comments: true, whitespace: true}], ['comments', {comments: true}], ['blank', {whitespace: true}]]) {
            writeFileSync(join(dir, `${k}.php`), src);
            writeFileSync(join(dir, `${k}.${tag}.php`), Crusher.minifyPHP(src, o));
            const judge = spawnSync('php', ['-r', `
function sig($f) { $out = []; foreach (token_get_all(file_get_contents($f)) as $t) {
    if (is_array($t)) { if (in_array($t[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT])) continue; $out[] = token_name($t[0]) . ':' . $t[1]; }
    else $out[] = $t; } return $out; }
exec('php -l ' . escapeshellarg($argv[2]) . ' 2>&1', $lint, $status);
echo json_encode(['same' => sig($argv[1]) === sig($argv[2]) && $status === 0]);
`, join(dir, `${k}.php`), join(dir, `${k}.${tag}.php`)], {encoding: 'utf8'});
            check(judge.status === 0 && JSON.parse(judge.stdout).same, `${what}, ${tag}: lints, and the same tokens to PHP`, judge.stderr || judge.stdout);
            const run = f => spawnSync('php', ['-d', 'error_reporting=0', f], {encoding: 'utf8'}).stdout;
            check(run(join(dir, `${k}.php`)) === run(join(dir, `${k}.${tag}.php`)), `${what}, ${tag}: the same output when run`);
        }
    }
    rmSync(dir, {recursive: true, force: true});
}

// ---------- run ----------
const SUITES = {css: cssSuite, html: htmlSuite, python: pythonSuite, sql: sqlSuite, php: phpSuite};
for (const name of suites) {
    if (!SUITES[name]) {
        console.log(`unknown suite ${name}; have ${ALL.join(', ')}`);
        process.exit(2);
    }
    try {
        await SUITES[name]();
    } catch (e) {
        fail(`${name} suite ran`, e.stack || e);
    }
}
if (browser) await browser.close();
console.log(`\n${passes} passed, ${failures} failed${skips ? `, ${skips} skipped` : ''}`);
process.exit(failures ? 1 : 0);
