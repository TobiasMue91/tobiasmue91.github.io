#!/usr/bin/env node
// Test suite for tools/seo_meta_tag_generator.html (SEO Meta Tag Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node. The tool promises that what it prints is valid,
// correctly escaped HTML a person can paste into <head>; that the pasted mess people bring (stray spaces, URLs
// without a scheme, "en_US", "x.com/handle", "7 days", keyword lists with empty items) becomes the clean value or
// a plain error that leaves the tag out; that the Google preview cuts text at a pixel width without splitting
// a character; and that settings stored by the old page under `seoMetaFormData` still load. Expected values are
// written by hand from the HTML spec (escaping), the Open Graph protocol and X card docs, BCP 47 and RFC 3986/WHATWG
// URL parsing, not copied from the page. No browser, no server.
//
//   node test/seo_meta_tag_generator.mjs                 # everything
//   node test/seo_meta_tag_generator.mjs parse build     # named suites only
//
// Suites: parse, build, fit, migrate, edges.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'seo_meta_tag_generator.html');
const ALL = ['parse', 'build', 'fit', 'migrate', 'edges'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const has = (s, sub, what) => check(s.includes(sub), what, `missing ${JSON.stringify(sub)} in\n${s}`);
const not = (s, sub, what) => check(!s.includes(sub), what, `unexpected ${JSON.stringify(sub)} in\n${s}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, URL};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;
const plain = o => JSON.parse(JSON.stringify(o));

if (suites.includes('parse')) {
  section('parse');
  eq(plain(C.parseUrl('https://example.com/a')), {value: 'https://example.com/a', note: ''}, 'full URL kept');
  eq(C.parseUrl('  example.com/page ').value, 'https://example.com/page', 'missing scheme gets https://');
  check(!!C.parseUrl('example.com/page').note, 'scheme added is said out loud');
  eq(C.parseUrl('//cdn.example.com/i.png').value, 'https://cdn.example.com/i.png', 'protocol-relative');
  eq(C.parseUrl('').value, '', 'empty is no URL, no error');
  eq(C.parseUrl('/img/a.png', 'https://ex.com/blog/post').value, 'https://ex.com/img/a.png', 'root-relative resolved against page URL');
  eq(C.parseUrl('img/a.png', 'https://ex.com/blog/post').value, 'https://ex.com/blog/img/a.png', 'relative resolved against page URL');
  eq(C.build({title: 'T', canonical: 'https://ex.com/p', 'og-image': '/s.jpg'}, 'head').v['og-image'], 'https://ex.com/s.jpg', 'og:image resolved in build');
  check(!!C.parseUrl('page').error, 'bare word rejected');
  check(!!C.parseUrl('/images/a.png').error, 'relative path rejected (og:image must be absolute)');
  check(!!C.parseUrl('ftp://example.com/x').error, 'non-http scheme rejected');
  check(!!C.parseUrl('javascript:alert(1)').error, 'javascript: rejected');
  check(!!C.parseUrl('https://exa mple.com').error, 'space inside host rejected');
  eq(C.parseUrl('shop.example.com/img/spring 2026.jpg').value, 'https://shop.example.com/img/spring%202026.jpg', 'space in path encoded');
  eq(C.parseUrl('https://bücher.example/ä').value, 'https://bücher.example/ä', 'IDN kept as typed');
  eq(C.parseLang('en').value, 'en', 'en');
  eq(C.parseLang('en_us').value, 'en-US', 'en_us -> en-US');
  eq(C.parseLang('ZH-hant-tw').value, 'zh-Hant-TW', 'script and region casing');
  eq(C.parseLang('es-419').value, 'es-419', 'numeric region');
  check(!!C.parseLang('english').error, '"english" rejected');
  check(!!C.parseLang('e').error, 'one letter rejected');
  eq(C.parseHandle('ann').value, '@ann', 'bare handle');
  eq(C.parseHandle('@@ann').value, '@ann', 'double @');
  eq(C.parseHandle('https://x.com/ann_b').value, '@ann_b', 'x.com URL');
  eq(C.parseHandle('twitter.com/@Ann').value, '@Ann', 'twitter.com URL');
  check(!!C.parseHandle('@this_is_far_too_long').error, '16+ chars rejected');
  check(!!C.parseHandle('@ann-b').error, 'hyphen rejected');
  eq(C.parseDays('7').value, '7', '7');
  eq(C.parseDays(' 7 days ').value, '7', '"7 days"');
  eq(C.parseDays('1 day').value, '1', '"1 day"');
  eq(C.parseDays('007').value, '7', 'leading zeros');
  check(!!C.parseDays('0').error, '0 rejected');
  check(!!C.parseDays('-3').error, 'negative rejected');
  check(!!C.parseDays('1.5').error, 'fraction rejected');
  check(!!C.parseDays('1,5').error, 'decimal comma rejected');
  eq(C.parseKeywords(' ,seo, ,html,, ').value, 'seo, html', 'stray commas');
  eq(C.parseKeywords('SEO; seo\nMeta  Tags').value, 'SEO, Meta Tags', 'semicolons, newlines, dupes, spaces');
  eq(C.parseKeywords('   ').value, '', 'whitespace only');
}

if (suites.includes('build')) {
  section('build');
  const min = C.build({title: 'My Page', description: 'Hello world'}, 'head').code;
  eq(min, [
    '<title>My Page</title>',
    '<meta name="description" content="Hello world">',
    '',
    '<!-- Open Graph: Facebook, LinkedIn, WhatsApp, Slack -->',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="My Page">',
    '<meta property="og:description" content="Hello world">',
    '',
    '<!-- X (Twitter) -->',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="My Page">',
    '<meta name="twitter:description" content="Hello world">',
    '',
    '<!-- Most pages already have these; keep one of each -->',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    ''].join('\n'), 'minimal head output, exact');
  not(min, '    \n', 'no whitespace-only lines');
  not(min, 'robots', 'index,follow is the default: no robots tag');

  const esc = C.build({title: `Tom & Jerry's "Best" <Show>`, description: 'a<b'}, 'head').code;
  has(esc, `<title>Tom &amp; Jerry's "Best" &lt;Show&gt;</title>`, 'title text escaped as text');
  has(esc, `<meta property="og:title" content="Tom &amp; Jerry's &quot;Best&quot; &lt;Show&gt;">`, 'attribute escaped');
  has(esc, 'content="a&lt;b"', 'description escaped');
  const inj = C.build({title: 'x', description: '"><script>alert(1)</script>'}, 'head').code;
  not(inj, '<script>', 'no tag injection');

  const full = C.build({title: 'T', description: 'D', language: 'en', author: 'Ann', canonical: 'https://x.com/a?b=1&c=2',
    revisit: '7', index: false, follow: false, 'og-type': 'article', 'og-image': 'https://x.com/i.png',
    'twitter-card': 'summary_large_image', 'twitter-site': '@ann', viewport: ''}, 'document').code;
  has(full, '<html lang="en">', 'lang on html');
  not(full, 'name="viewport"', 'no viewport tag when chosen');
  has(full, '  <meta name="author" content="Ann">', 'author');
  has(full, '  <meta name="robots" content="noindex, nofollow">', 'robots both off');
  has(full, '  <link rel="canonical" href="https://x.com/a?b=1&amp;c=2">', 'canonical & escaped');
  has(full, '  <meta name="revisit-after" content="7 days">', 'revisit');
  has(full, '<meta property="og:type" content="article">', 'og:type');
  has(full, '<meta property="og:url" content="https://x.com/a?b=1&amp;c=2">', 'og:url');
  has(full, '<meta property="og:image" content="https://x.com/i.png">', 'og:image');
  has(full, '<meta name="twitter:image" content="https://x.com/i.png">', 'twitter:image');
  has(full, '<meta name="twitter:url" content="https://x.com/a?b=1&amp;c=2">', 'twitter:url');
  has(full, '<meta name="twitter:card" content="summary_large_image">', 'card');
  has(full, '<meta name="twitter:site" content="@ann">', 'site');
  check(full.startsWith('<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n'), 'document starts with doctype, html, head, charset');
  check(full.endsWith('</html>\n'), 'document ends with </html> and newline');
  has(C.build({title: 'T', index: true, follow: false}, 'head').code, 'content="index, nofollow"', 'index, nofollow');
  has(C.build({title: 'T', index: false, follow: true}, 'head').code, 'content="noindex, follow"', 'noindex, follow');
  has(C.build({title: 'T', language: 'en_gb'}, 'head').code, '<meta property="og:locale" content="en_GB">', 'og:locale from language with region');
  not(C.build({title: 'T', language: 'en'}, 'head').code, 'og:locale', 'no og:locale without region');
  has(C.build({title: 'T', language: 'zh-Hant-TW'}, 'head').code, 'content="zh_TW"', 'og:locale skips script');
  has(C.build({title: 'T', language: 'de-AT'}, 'head').code, '<!-- Also set lang="de-AT" on your <html> tag -->', 'head mode names lang');

  const fb = C.build({title: 'Main', description: 'Desc', 'og-title': 'Social'}, 'head').code;
  has(fb, 'og:title" content="Social"', 'own social title');
  has(fb, 'og:description" content="Desc"', 'social description falls back');
  has(C.build({title: 'Main', 'og-title': '   '}, 'head').code, 'og:title" content="Main"', 'whitespace-only social title falls back');

  const bad = C.build({title: 'T', canonical: 'not a url', 'og-image': '/img.png', language: 'english', 'twitter-site': 'a b', revisit: '0'}, 'head');
  for (const k of ['canonical', 'og-image', 'language', 'twitter-site', 'revisit']) check(!!bad.errors[k], `error for bad ${k}`);
  not(bad.code, 'canonical', 'bad canonical left out');
  not(bad.code, 'og:image', 'bad image left out');
  not(bad.code, 'twitter:site', 'bad handle left out');
  not(bad.code, 'revisit', 'bad revisit left out');
  check(!!C.build({title: ''}, 'head').errors.title, 'empty title is an error');
  not(C.build({title: '   '}, 'head').code, '<title>', 'whitespace title emits no <title>');
  check(!!C.build({title: 'T'}, 'head').warnings.description, 'missing description warns');
  eq(C.build({title: 'T', 'og-type': 'evil"'}, 'head').v['og-type'], 'website', 'unknown select value falls back');
  eq(C.build({title: 'T', viewport: 'width=device-width, initial-scale=1.0, user-scalable=no'}, 'head').warnings.viewport ? 1 : 0, 1, 'no-zoom warns');
}

if (suites.includes('fit')) {
  section('fit');
  const m = s => Array.from(s).length * 10; // 10 px per code point
  eq(plain(C.fit('short', 100, m)), {text: 'short', cut: false, width: 50}, 'fits untouched');
  eq(C.fit('aaaaaaaaaa', 100, m).cut, false, 'exactly at the limit is not cut');
  const r = C.fit('one two three four five six', 100, m);
  check(r.cut && m(r.text) <= 100, 'cut result fits', JSON.stringify(r));
  eq(r.text, 'one ...', 'cut at a word boundary with " ..."');
  eq(C.fit('abcdefghijklmnopqrstuvwxyz', 100, m).text, 'abcdef ...', 'no space: cut mid-word');
  const e = C.fit('🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉', 100, m).text;
  check(!/[\ud800-\udbff](?![\udc00-\udfff])/.test(e), 'emoji never split');
  eq(C.fit('', 100, m).text, '', 'empty');
  eq(C.fit('Hello, world and more text', 120, m).text, 'Hello ...', 'trailing comma dropped before ellipsis');
}

if (suites.includes('migrate')) {
  section('migrate');
  const old = '{"title":"Hi","description":"D","index":true,"follow":false,"og-type":"article","twitter-card":"summary","viewport":"width=device-width, initial-scale=1.0","revisit":"7"}';
  const s = C.migrate(old);
  eq([s.title, s.description, s.index, s.follow, s['og-type'], s.revisit, s.viewport], ['Hi', 'D', true, false, 'article', '7', 'width=device-width, initial-scale=1.0'], 'old shape loads');
  eq(C.migrate('{"title":"Hi","index":true,"follow":true}').viewport, '', 'old page dropped viewport for "no tag"');
  eq(C.migrate('{broken').title, '', 'corrupt JSON -> defaults, no throw');
  eq(C.migrate(null).viewport, C.DEFAULTS.viewport, 'nothing stored -> defaults');
  eq(C.migrate('{"title":{"x":1},"revisit":7,"bogus":"y"}').title, '', 'wrong types ignored');
  eq(C.migrate('{"revisit":7,"index":true}').revisit, '7', 'number becomes string');
  eq(C.migrate('{"viewport":"weird","index":true}').viewport, C.DEFAULTS.viewport, 'unknown viewport -> default');
}

if (suites.includes('edges')) {
  section('edges');
  const nu = C.build({title: 'Café – 日本語 🎉', description: 'Ünïcödé'}, 'head').code;
  has(nu, '<title>Café – 日本語 🎉</title>', 'non-ASCII verbatim');
  eq(C.chars('🎉ab'), 3, 'emoji counts as one character');
  has(C.build({title: '  Two\n lines\t here  '}, 'head').code, '<title>Two lines here</title>', 'whitespace collapsed');
  const huge = 'word '.repeat(40000);
  const t0 = Date.now();
  const hb = C.build({title: huge, description: huge, keywords: 'k,'.repeat(20000)}, 'head');
  check(Date.now() - t0 < 1000, 'huge input builds in under a second', `${Date.now() - t0} ms`);
  check(hb.code.length > 400000, 'huge input kept whole in output');
  const t1 = Date.now();
  C.fit(huge, 600, s => s.length * 9);
  check(Date.now() - t1 < 500, 'fit on huge input is fast (binary search)');
  eq(C.displayUrl('https://www.example.com/guides/sour-dough/').crumbs, ' › guides › sour-dough', 'breadcrumbs');
  eq(C.displayUrl('').host, 'example.com', 'no URL -> placeholder host');
  check(!C.build({title: 'a\u0000b\u2028c'}, 'head').code.match(/[\u0000\u2028]/), 'control chars removed');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
