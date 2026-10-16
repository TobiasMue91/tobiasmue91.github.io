#!/usr/bin/env node
// Test suite for tools/base64_encoder_decoder.html (Base64 Decode and Encode).
//
// Runs the page's DOM-free <script id="core"> block in Node. A Base64 tool promises that its output
// is exactly RFC 4648 (the §10 test vectors), that encode and decode round-trip any bytes (checked
// against Node's own Buffer as an independent implementation), that decoding forgives what people
// paste (whitespace, URL-safe alphabet, missing or extra padding, data: URIs, %-escapes) and refuses
// what cannot be Base64 with the position of the problem. No browser, no server.
//
//   node test/base64_encoder_decoder.mjs            # everything
//   node test/base64_encoder_decoder.mjs rfc edges  # named suites only
//
// Suites: rfc, roundtrip, lenient, errors, text, sniff, detect.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'base64_encoder_decoder.html');
const ALL = ['rfc', 'roundtrip', 'lenient', 'errors', 'text', 'sniff', 'detect'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, TextEncoder, TextDecoder, Uint8Array, Int16Array};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;
const u8 = s => new Uint8Array(Buffer.from(s, 'utf8'));
const enc = (s, o) => C.encode(u8(s), o);
const dec = s => { const r = C.decode(s); return r.error ? 'ERR' : Buffer.from(r.bytes).toString('utf8'); };
const decHex = s => { const r = C.decode(s); return r.error ? 'ERR' : Buffer.from(r.bytes).toString('hex'); };

if (suites.includes('rfc')) {
  section('rfc');
  // RFC 4648 §10
  const V = [['', ''], ['f', 'Zg=='], ['fo', 'Zm8='], ['foo', 'Zm9v'], ['foob', 'Zm9vYg=='], ['fooba', 'Zm9vYmE='], ['foobar', 'Zm9vYmFy']];
  for (const [p, b] of V) { eq(enc(p), b, `encode "${p}"`); eq(dec(b), p, `decode "${b}"`); }
  eq(enc('foob', {pad: false}), 'Zm9vYg', 'no padding');
  eq(C.encode(new Uint8Array([0xfb, 0xff]), {}), '+/8=', 'standard alphabet uses + /');
  eq(C.encode(new Uint8Array([0xfb, 0xff]), {urlSafe: true}), '-_8=', 'URL-safe uses - _ (RFC 4648 §5)');
  eq(C.encode(new Uint8Array([0xfb, 0xff]), {urlSafe: true, pad: false}), '-_8', 'URL-safe without padding');
  eq(enc('Hello, World!'), 'SGVsbG8sIFdvcmxkIQ==', 'Hello, World!');
  eq(enc('héllo €😀'), 'aMOpbGxvIOKCrPCfmIA=', 'UTF-8 multi-byte and astral');
  const long = C.encode(new Uint8Array(100), {wrap: 76});
  eq(long.split('\r\n').map(l => l.length), [76, 60], 'MIME wrap: 76-char lines joined by CRLF');
}

if (suites.includes('roundtrip')) {
  section('roundtrip');
  let seed = 7; const rnd = () => (seed = seed * 1103515245 + 12345 >>> 0) / 4294967296;
  for (let n = 0; n < 300; n++) {
    const len = n < 40 ? n : Math.floor(rnd() * 70000);
    const b = new Uint8Array(len); for (let i = 0; i < len; i++) b[i] = rnd() * 256;
    const want = Buffer.from(b).toString('base64');
    const got = C.encode(b, {});
    if (got !== want) { check(false, `encode ${len} random bytes matches Buffer`); continue; }
    const back = C.decode(got);
    check(!back.error && Buffer.compare(Buffer.from(back.bytes), Buffer.from(b)) === 0, `round-trip ${len} bytes`);
    const url = C.encode(b, {urlSafe: true, pad: false});
    check(url === Buffer.from(b).toString('base64url'), `URL-safe ${len} bytes matches Buffer base64url`);
  }
  const all = new Uint8Array(256).map((_, i) => i);
  eq(Buffer.from(C.decode(C.encode(all, {})).bytes).toString('hex'), Buffer.from(all).toString('hex'), 'all 256 byte values');
}

if (suites.includes('lenient')) {
  section('lenient');
  eq(dec('SGVsbG8='), 'Hello', 'padded'); eq(dec('SGVsbG8'), 'Hello', 'unpadded');
  eq(dec('SGV sbG8=\n'), 'Hello', 'inner space and trailing newline');
  eq(dec('  SGVs\r\n bG8=\t'), 'Hello', 'CRLF, tabs, leading spaces');
  eq(dec('SGVsbG8=='), 'Hello', 'extra padding ignored');
  eq(dec('SGVsbG8%3D'), 'Hello', '%3D from a URL');
  eq(decHex('-_8'), 'fbff', 'URL-safe alphabet'); eq(decHex('+/8='), 'fbff', 'standard alphabet');
  eq(decHex('SGVsbG8-_w'), '48656c6c6f3eff', 'mixed: matches what the old page decoded');
  const d = C.decode('data:image/png;base64,iVBORw0KGgo=');
  eq([d.mime, Buffer.from(d.bytes).toString('hex')], ['image/png', '89504e470d0a1a0a'], 'data: URI prefix stripped, type kept');
  eq(dec('data:text/plain;charset=utf-8;base64,SGk='), 'Hi', 'data: URI with parameters');
  eq(dec('  "attachment": "SGVs\n  bG8=",'), 'Hello', 'a whole JSON line with its key, as copied from an email');
  eq(dec('token = "SGk="'), 'Hi', 'key = "value" from a config file');
  eq(C.decode('SGVsbG8*').index, 7, 'positions unchanged without a wrapper');
  eq(dec('"SGVsbG8=",'), 'Hello', 'quoted and comma, as copied from JSON');
  eq(dec("  'SGVs\n  bG8='"), 'Hello', 'single quotes around a wrapped string');
  eq(decHex('"\\/w=="'), 'ff', 'JSON-escaped slash');
  check(!!C.decode('"SGVs"bG8="').error, 'quotes inside are still an error');
  eq(dec(''), '', 'empty decodes to nothing'); eq(dec('   \n'), '', 'whitespace only decodes to nothing');
  check(C.decode('SGVsbG8').notes.some(n => /padding/.test(n)), 'missing padding is noted');
  check(C.decode('-_8').notes.some(n => /URL-safe/.test(n)), 'URL-safe alphabet is noted');
}

if (suites.includes('errors')) {
  section('errors');
  const e1 = C.decode('!!!'); eq([!!e1.error, e1.index], [true, 0], '"!!!" rejected at first char');
  const e2 = C.decode('SGVs*bG8='); eq(e2.index, 4, 'bad char position'); check(/position 5/.test(e2.error), 'message counts from 1');
  const e3 = C.decode('SGVsbG8=SGk='); check(!!e3.error && /after the "="/.test(e3.error), 'data after padding (two strings run together)');
  const e4 = C.decode('SGVsb'); check(!!e4.error && /groups of 4/.test(e4.error), 'length ≡ 1 mod 4 is impossible');
  const e5 = C.decode('SGVsbG8é'); eq(e5.index, 7, 'non-ASCII character rejected with position');
  const e6 = C.decode('😀AAA'); check(/😀/.test(e6.error), 'astral character shown whole in the message');
  const e7 = C.decode('data:text/plain,hello'); check(!!e7.error && /not Base64/.test(e7.error), 'percent-encoded data: URI is not Base64');
  const big = 'QUJD'.repeat(500000) + '#';
  const e8 = C.decode(big); eq(e8.index, 2000000, 'error found at the end of 2 MB');
}

if (suites.includes('text')) {
  section('text');
  eq(C.bytesToText(new Uint8Array([0xff]), 'utf-8'), null, 'invalid UTF-8 is not text');
  eq(C.bytesToText(new Uint8Array([0xe9]), 'latin1'), 'é', 'Latin-1 byte E9 is é');
  eq(C.bytesToText(new Uint8Array([0x80]), 'latin1'), '\u0080', 'Latin-1 is ISO-8859-1, not windows-1252');
  eq(Buffer.from(C.textToBytes('é', 'latin1').bytes).toString('hex'), 'e9', 'encode é as Latin-1');
  check(!!C.textToBytes('€', 'latin1').error, '€ is not in Latin-1');
  eq(Buffer.from(C.textToBytes('Hi', 'utf-16le').bytes).toString('hex'), '48006900', 'UTF-16LE');
  eq(C.bytesToText(new Uint8Array([0x48, 0, 0x69, 0]), 'utf-16le'), 'Hi', 'UTF-16LE back');
  eq(C.bytesToText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]), 'utf-8'), '﻿A', 'BOM is kept, not swallowed');
  eq(Buffer.from(C.textToBytes('  a\n', 'utf-8').bytes).toString('hex'), '2020610a', 'encode keeps leading/trailing whitespace');
  eq(C.isReadable('line\r\n\ttab'), true, 'newlines and tabs are readable'); eq(C.isReadable('a\u0000b'), false, 'NUL is not');
  eq(C.plural(1, 'byte'), '1 byte', '1 byte, not 1 bytes'); eq(C.plural(1234, 'byte'), '1,234 bytes', 'grouped figures');
}

if (suites.includes('sniff')) {
  section('sniff');
  const s = h => (C.sniff(new Uint8Array(Buffer.from(h, 'hex'))) || {}).ext;
  eq(s('89504e470d0a1a0a'), 'png', 'PNG'); eq(s('ffd8ffe0'), 'jpg', 'JPEG'); eq(s('474946383961'), 'gif', 'GIF');
  eq(s('255044462d'), 'pdf', 'PDF'); eq(s('504b0304'), 'zip', 'ZIP'); eq(s('1f8b08'), 'gz', 'gzip');
  eq(s('524946460000000057454250'), 'webp', 'WebP'); eq(s('48656c6c6f'), undefined, 'text is not sniffed');
  eq(C.extFor('image/svg+xml'), 'svg', 'svg ext'); eq(C.extFor('application/x-foo'), 'xfoo', 'ext from subtype');
  const dump = C.hexdump(new Uint8Array(Buffer.from('Hello>\xff', 'latin1')), 512);
  const full = C.hexdump(new Uint8Array(16), 16);
  check(dump.startsWith('00000000  48 65 6c 6c 6f 3e ff ') && dump.endsWith(' Hello>·'), 'hex dump line', dump);
  eq(dump.indexOf('Hello>'), full.length - 16, 'short last line keeps the ASCII column aligned');
  check(/… 488 more bytes$/.test(C.hexdump(new Uint8Array(1000), 512)), 'hex dump truncation line');
}

if (suites.includes('detect')) {
  section('detect');
  for (const t of ['SGVsbG8sIFdvcmxkIQ==', 'eyJhbGciOiJIUzI1NiJ9', 'data:image/png;base64,iVBORw0KGgo=', 'iVBORw0KGgoAAAANSUhEUg==', 'SGVsbG8s\nIFdvcmxk'])
    eq(C.looksLikeBase64(t), true, `looks like Base64: ${t.slice(0, 24)}`);
  for (const t of ['Hello', 'password', 'HelloWorld', '12345678', 'hello world foo', 'Mississippi', 'AAAAAAAAAAAAAAAA'])
    eq(C.looksLikeBase64(t), false, `not taken for Base64: ${t}`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
