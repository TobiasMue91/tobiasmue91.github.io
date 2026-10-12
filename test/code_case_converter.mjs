#!/usr/bin/env node
// Test suite for tools/code_case_converter.html (Case Converter).
//
// Runs the page's DOM-free <script id="core"> block in Node. A case converter promises that the
// words it finds are the words a person sees (XMLHttpRequest is xml, http, request), that each
// style joins them the way its convention says, that text styles leave everything but letter case
// alone, and that nothing breaks on empty, huge, non-ASCII or multi-line input. Expected values are
// written by hand from the conventions (Chicago-style title case, PEP 8 / Java / CSS naming), not
// copied from the page. No browser, no server.
//
//   node test/code_case_converter.mjs              # everything
//   node test/code_case_converter.mjs words title  # named suites only
//
// Suites: words, code, title, sentence, text, edges, history.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'code_case_converter.html');
const ALL = ['words', 'code', 'title', 'sentence', 'text', 'edges', 'history'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;
const cv = (id, t) => C.convert(id, t);

if (suites.includes('words')) {
  section('words');
  const W = [
    ['hello world', ['hello', 'world']],
    ['helloWorld', ['hello', 'world']],
    ['HelloWorld', ['hello', 'world']],
    ['HTTPServerError', ['http', 'server', 'error']],
    ['XMLHttpRequest2Fast', ['xml', 'http', 'request2', 'fast']],
    ['getHTTPResponseCode', ['get', 'http', 'response', 'code']],
    ['userID', ['user', 'id']],
    ['IDs', ['ids']],
    ['fetchURLsNow', ['fetch', 'urls', 'now']],
    ['HTTPSConnection', ['https', 'connection']],
    ['snake_case_here', ['snake', 'case', 'here']],
    ['kebab-case-here', ['kebab', 'case', 'here']],
    ['SCREAMING_SNAKE', ['screaming', 'snake']],
    ['path/to.file', ['path', 'to', 'file']],
    ['  multiple   spaces  ', ['multiple', 'spaces']],
    ["don't stop", ['dont', 'stop']],
    ["the user's id", ['the', 'user', 'id']],
    ["James’ car", ['james', 'car']],
    ['version 2.0 release', ['version', '2', '0', 'release']],
    ['base64Encode', ['base64', 'encode']],
    ['Ünïcode straße', ['ünïcode', 'straße']],
    ['ÉcoleNormale', ['école', 'normale']],
    ['Café au lait', ['café', 'au', 'lait']],   // decomposed é is one letter
    ['日本語 テキスト', ['日本語', 'テキスト']],
    ['ΣΊΣΥΦΟΣ', ['ΣΊΣΥΦΟΣ'.toLowerCase()]],
    ['🚀 launch 🚀', ['launch']],
    ['---', []],
    ['', []],
  ];
  for (const [inp, want] of W) eq([...C.words(inp)], want, `words(${JSON.stringify(inp)})`);
}

if (suites.includes('code')) {
  section('code');
  // [input, camel, pascal, snake, constant, kebab, dot, path]
  const T = [
    ['hello world', 'helloWorld', 'HelloWorld', 'hello_world', 'HELLO_WORLD', 'hello-world', 'hello.world', 'hello/world'],
    ['HTTPServerError', 'httpServerError', 'HttpServerError', 'http_server_error', 'HTTP_SERVER_ERROR', 'http-server-error', 'http.server.error', 'http/server/error'],
    ['XMLHttpRequest for user_id 42', 'xmlHttpRequestForUserId42', 'XmlHttpRequestForUserId42', 'xml_http_request_for_user_id_42', 'XML_HTTP_REQUEST_FOR_USER_ID_42', 'xml-http-request-for-user-id-42', 'xml.http.request.for.user.id.42', 'xml/http/request/for/user/id/42'],
    ['  multiple   spaces  ', 'multipleSpaces', 'MultipleSpaces', 'multiple_spaces', 'MULTIPLE_SPACES', 'multiple-spaces', 'multiple.spaces', 'multiple/spaces'],
    ['Ünïcode straße', 'ünïcodeStraße', 'ÜnïcodeStraße', 'ünïcode_straße', 'ÜNÏCODE_STRASSE', 'ünïcode-straße', 'ünïcode.straße', 'ünïcode/straße'],
    ['version 2.0 release', 'version20Release', 'Version20Release', 'version_2_0_release', 'VERSION_2_0_RELEASE', 'version-2-0-release', 'version.2.0.release', 'version/2/0/release'],
    ['a', 'a', 'A', 'a', 'A', 'a', 'a', 'a'],
    ["user's first-name!", 'userFirstName', 'UserFirstName', 'user_first_name', 'USER_FIRST_NAME', 'user-first-name', 'user.first.name', 'user/first/name'],
  ];
  const ids = ['camel', 'pascal', 'snake', 'constant', 'kebab', 'dot', 'path'];
  for (const [inp, ...want] of T) ids.forEach((id, i) => eq(cv(id, inp), want[i], `${id}(${JSON.stringify(inp)})`));
  // idempotence and round trips between identifier styles
  // single-letter words (a-b-c, getX) and a number after a number-free word (user_id_2 -> userId2) cannot survive camelCase: aBC reads back as a, bc
  const names = ['parseHTTPHeader', 'XMLHttpRequest', 'Été chaud', 'base64Encode'];
  for (const n of names) for (const a of ids.slice(0, 7)) for (const b of ids.slice(0, 7)) {
    eq(cv(b, cv(a, cv(b, n))), cv(b, n), `${b}∘${a}∘${b} stable on ${n}`);
  }
  // each line on its own; blank lines stay
  eq(cv('snake', 'first line\nsecond-line\n\nThirdLine'), 'first_line\nsecond_line\n\nthird_line', 'snake per line');
  eq(cv('camel', 'a b\r\nc d'), 'aB\ncD', 'CRLF lines become LF lines');
  eq(cv('kebab', '!!!\nok'), '\nok', 'a line with no words is empty');
}

if (suites.includes('title')) {
  section('title');
  const T = [
    ['hello world', 'Hello World'],
    ['MAX_RETRY_COUNT', 'Max_retry_count'],
    ['the lord of the rings', 'The Lord of the Rings'],
    ['what are you looking at', 'What Are You Looking At'],      // last word always capitalised
    ['a tale of two cities', 'A Tale of Two Cities'],
    ['star wars: a new hope', 'Star Wars: A New Hope'],           // after a colon starts again
    ['up-to-date guide to the API', 'Up-to-Date Guide to the API'],
    ['NASA launches new rocket', 'NASA Launches New Rocket'],      // acronyms kept in mixed text
    ['THE QUICK BROWN FOX', 'The Quick Brown Fox'],                // all caps input is not acronyms
    ['my iPhone and JavaScript', 'My iPhone and JavaScript'],
    ['ebay and eBay', 'Ebay and eBay'],
    ["don't stop believin'", "Don't Stop Believin'"],
    ['  multiple   spaces  ', '  Multiple   Spaces  '],
    ['first line\nthe second line', 'First Line\nThe Second Line'],
    ['élan vital in zürich', 'Élan Vital in Zürich'],
    ['2nd place in the race', '2nd Place in the Race'],
    ['rename user_id to account_id', 'Rename user_id to account_id'],
    ['a', 'A'],
  ];
  for (const [i, w] of T) eq(cv('title', i), w, `title(${JSON.stringify(i)})`);
}

if (suites.includes('sentence')) {
  section('sentence');
  const T = [
    ['hello world', 'Hello world'],
    ['HELLO WORLD. HOW ARE YOU?', 'Hello world. How are you?'],
    ['the NASA team met. it went well! i think so', 'The NASA team met. It went well! I think so'],
    ['Ünïcode straße', 'Ünïcode straße'],
    ['über alles', 'Über alles'],
    ['first line\nsecond line', 'First line\nSecond line'],
    ['"quoted." next one', '"Quoted." Next one'],
    ['  leading space', '  Leading space'],
    ["i'm here and i'll stay", "I'm here and I'll stay"],
    ['This Is Title Case', 'This is title case'],
    ['version 2.0 release', 'Version 2.0 release'],                // a decimal point is not a sentence end
    ['- item one\n- item two', '- Item one\n- Item two'],
  ];
  for (const [i, w] of T) eq(cv('sentence', i), w, `sentence(${JSON.stringify(i)})`);
}

if (suites.includes('text')) {
  section('text');
  eq(cv('upper', 'straße'), 'STRASSE', 'upper ß -> SS (Unicode full mapping)');
  eq(cv('upper', '  a\nb '), '  A\nB ', 'upper keeps whitespace');
  eq(cv('lower', 'İSTANBUL'), 'i̇stanbul', 'lower is locale-independent');
  eq(cv('lower', 'ÀÉÎ'), 'àéî', 'lower accents');
  eq(cv('toggle', 'hello world'), 'hElLo WoRlD', 'toggle alternates letters, not spaces');
  eq(cv('toggle', 'a1b c'), 'a1B c', 'toggle skips digits');
  for (const id of ['upper', 'lower', 'toggle', 'title', 'sentence']) {
    const s = 'Mixed  INPUT,\twith—punctuation…\n\n  and lines. 42 €';
    eq(cv(id, s).toLowerCase(), s.toLowerCase(), `${id} changes only letter case`);
  }
}

if (suites.includes('edges')) {
  section('edges');
  for (const s of C.STYLES) {
    eq(cv(s.id, ''), '', `${s.id} of empty`);
    eq(typeof cv(s.id, '   \n\t'), 'string', `${s.id} of whitespace`);
    eq(cv(s.id, null), '', `${s.id} of null`);
  }
  eq(cv('nope', 'x'), '', 'unknown style is empty');
  const big = ('someVariableName another_one Third-Thing\n').repeat(25000);   // ~1 MB
  for (const s of C.STYLES) {
    const t0 = performance.now();
    const r = cv(s.id, big);
    const ms = performance.now() - t0;
    check(ms < 1500, `${s.id} converts 1 MB in ${ms.toFixed(0)} ms`);
    eq(r.split('\n').length, big.split('\n').length, `${s.id} keeps 25,001 lines`);
  }
  const one = 'x'.repeat(200000) + 'Y';
  eq(cv('snake', one), 'x'.repeat(200000) + '_y', 'one 200k-character word');
  eq(C.stats('héllo wörld\nok'), {chars: 14, words: 3, lines: 2}, 'stats');
  eq(C.stats('🚀🚀 go'), {chars: 5, words: 1, lines: 1}, 'stats counts code points, emoji are not words');
  eq(C.stats(''), {chars: 0, words: 0, lines: 0}, 'stats of empty');
  eq(C.stats('!!! --- ### ok'), {chars: 14, words: 1, lines: 1}, 'punctuation is not a word');
  eq(cv('camel', '𝓪bc def'), '𝓪bcDef', 'astral letters survive');
}

if (suites.includes('history')) {
  section('history');
  const old = JSON.stringify([
    {input: 'hello world', output: 'helloWorld', type: 'camel', time: '10:01:02', fullInput: 'hello world', fullOutput: 'helloWorld'},
    {input: '<img src=x onerror=alert(1)>', output: 'x', type: 'snake', time: 't', fullInput: '<img src=x onerror=alert(1)>', fullOutput: 'img_src_x_onerror_alert_1'},
    {input: 'x', output: 'y', type: 'bogus'},
    null, 5, 'str',
    {input: 'short', output: 'SHORT', type: 'upper', time: 9},
  ]);
  const h = C.cleanHistory(old);
  eq(h.length, 3, 'old history kept, unknown types and junk dropped');
  eq(h[0].fullOutput, 'helloWorld', 'old entry keeps its full output');
  eq(h[2].fullInput, 'short', 'entry without fullInput falls back to input');
  eq(h[2].time, '', 'non-string time dropped');
  eq(C.cleanHistory('not json'), [], 'garbage history');
  eq(C.cleanHistory('{"a":1}'), [], 'non-array history');
  let list = [];
  for (let i = 0; i < 15; i++) list = C.addHistory(list, 'in ' + i, 'snake', 'in_' + i, 't');
  eq(list.length, 10, 'history caps at 10');
  eq(list[0].fullInput, 'in 14', 'newest first');
  list = C.addHistory(list, 'in 3', 'snake', 'in_3', 't');
  eq(list.filter(e => e.fullInput === 'in 3').length, 1, 'same input and style moves to top, no duplicate');
  eq(C.addHistory([], '   ', 'snake', '', 't'), [], 'blank not stored');
  const long = 'z'.repeat(60);
  eq(C.addHistory([], long, 'upper', long.toUpperCase(), 't')[0].input, 'z'.repeat(50) + '...', 'preview clipped as before');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
