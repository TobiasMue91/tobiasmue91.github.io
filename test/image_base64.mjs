#!/usr/bin/env node
// Test suite for tools/image_to_base64_converter.html (Image to Base64 / Base64 to Image).
//
// Runs the page's DOM-free <script id="core"> block in Node. The tool promises that the string it hands over
// is the file, byte for byte, and that what it reads back is the file again. So: the RFC 4648 test vectors,
// every length from 0 to 300 and thousands of random buffers against Node's own Buffer base64 (an encoder the
// core does not share), MIME line wrapping, the messy text people paste into the decoder (data: URIs, quotes,
// url(), line breaks, base64url, missing padding, %3D) and errors that name the character that is wrong; the
// type read from the bytes, not the name, and pixel sizes read from real headers; percent-encoded SVG URIs
// that decode back to the SVG; and the exact strings each copy format produces, including the old page's two.
//
//   node test/image_base64.mjs                 # everything
//   node test/image_base64.mjs vectors decode  # named suites only
//
// Suites: vectors, random, wrap, decode, errors, sniff, dims, svg, formats.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'image_to_base64_converter.html');
const ALL = ['vectors', 'random', 'wrap', 'decode', 'errors', 'sniff', 'dims', 'svg', 'formats'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(got === want, what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, TextEncoder, Uint8Array, Int16Array};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;
const u8 = s => Uint8Array.from(Buffer.from(s, 'latin1'));
const hex = b => Buffer.from(b).toString('hex');
const dec = t => { const r = C.decode(t); return r.ok ? Buffer.from(r.bytes).toString('latin1') : 'ERR'; };

let seed = 20261014;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const randBytes = n => Uint8Array.from({length: n}, () => Math.floor(rnd() * 256));

if (suites.includes('vectors')) {
  section('vectors (RFC 4648 §10)');
  const V = [['', ''], ['f', 'Zg=='], ['fo', 'Zm8='], ['foo', 'Zm9v'], ['foob', 'Zm9vYg=='], ['fooba', 'Zm9vYmE='], ['foobar', 'Zm9vYmFy']];
  for (const [p, b] of V) { eq(C.encode(u8(p)), b, `encode "${p}"`); if (b) eq(dec(b), p, `decode ${b}`); }
  eq(C.encode(Uint8Array.from([0xfb, 0xff, 0xbf])), '+/+/', 'the two high characters are + and /');
  eq(hex(C.decode('-_-_').bytes), 'fbffbf', 'base64url - and _ read as + and /');
}

if (suites.includes('random')) {
  section('random against Buffer');
  for (let n = 0; n <= 300; n++) { const b = randBytes(n); const want = Buffer.from(b).toString('base64'); eq(C.encode(b), want, `length ${n}`); if (n) eq(hex(C.decode(want).bytes), hex(b), `round trip length ${n}`); }
  let bad = 0;
  for (let i = 0; i < 2000; i++) { const b = randBytes(Math.floor(rnd() * 5000)); const s = C.encode(b); if (s !== Buffer.from(b).toString('base64') || hex(C.decode(s).bytes) !== hex(b)) bad++; }
  eq(bad, 0, '2000 random buffers up to 5 KB encode and decode exactly');
  const big = randBytes(3 * 1048576 + 1); let last = 0, mono = true;
  const s = C.encode(big, 0, p => { if (p < last) mono = false; last = p; });
  eq(s, Buffer.from(big).toString('base64'), '3 MB across chunk boundaries'); check(mono && last === 1, 'progress climbs to 1');
  eq(C.b64len(big.length), s.length, 'b64len predicts the length');
}

if (suites.includes('wrap')) {
  section('wrap (RFC 2045, 76 columns)');
  const b = randBytes(1000), flat = Buffer.from(b).toString('base64'), w = C.encode(b, 76);
  const lines = w.split('\r\n');
  check(lines.slice(0, -1).every(l => l.length === 76) && lines.at(-1).length <= 76, 'every line 76, the last no longer');
  eq(lines.join(''), flat, 'wrapping only inserts CRLF');
  eq(C.encode(randBytes(57), 76).includes('\r\n'), false, '57 bytes = exactly one 76-character line, no break');
  eq(hex(C.decode(w).bytes), hex(b), 'wrapped text decodes back');
}

if (suites.includes('decode')) {
  section('decode what people paste');
  const P = 'iVBORw0KGgo=';
  const want = '89504e470d0a1a0a';
  const cases = [
    ['bare', P], ['spaces around', '  ' + P + ' \n'], ['line breaks every 4', P.match(/.{1,4}/g).join('\n')], ['CRLF', P.slice(0, 6) + '\r\n' + P.slice(6)],
    ['tabs', P.slice(0, 3) + '\t' + P.slice(3)], ['no padding', P.replace(/=+$/, '')], ['%3D padding', P.replace('=', '%3D')],
    ['data URI', 'data:image/png;base64,' + P], ['DATA URI upper', 'DATA:image/png;BASE64,' + P],
    ['data URI with params', 'data:image/png;name=x.png;charset=binary;base64,' + P],
    ['double quotes', '"data:image/png;base64,' + P + '"'], ['single quotes', "'" + P + "'"],
    ['css url()', 'url(data:image/png;base64,' + P + ')'], ['css url("") with ;', 'url("data:image/png;base64,' + P + '");'],
    ['shell \\ continuations', P.slice(0, 5) + '\\\n' + P.slice(5)],
  ];
  for (const [what, t] of cases) { const r = C.decode(t); eq(r.ok ? hex(r.bytes) : 'ERR ' + (r.error && r.error.msg), want, what); }
  eq(C.decode('data:image/png;base64,' + P).mime, 'image/png', 'mime from the prefix');
  eq(C.decode('data:IMAGE/PNG;base64,' + P).mime, 'image/png', 'mime lower-cased');
  eq(C.decode(P).mime, null, 'no prefix, no mime');
  const pct = C.decode("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E");
  eq(pct.ok && C.text(pct.bytes), "<svg xmlns='http://www.w3.org/2000/svg'/>", 'a percent-encoded data: URI reads as its text');
  eq(pct.mime, 'image/svg+xml', 'and keeps its type');
  eq(dec('w6k='), '\xc3\xa9', 'non-ASCII bytes (é in UTF-8)');
  eq(C.decode('').empty, true, 'empty is not an error, just empty');
  eq(C.decode('   \n ').empty, true, 'whitespace only is empty');
  eq(C.decode('data:image/png;base64,').ok, false, 'a prefix with nothing after it');
}

if (suites.includes('errors')) {
  section('errors name what is wrong');
  const e = t => { const r = C.decode(t); return r.ok ? null : r.error; };
  let r = e('Zm9v!YmFy'); check(r && /“!”/.test(r.msg) && /character 5/.test(r.msg) && r.before === 'Zm9v' && r.after === 'YmFy' && r.at === 4, 'a stray ! is named with its position', JSON.stringify(r));
  r = e('data:image/png;base64,Zm9v*'); check(r && r.at === 26 && /character 27/.test(r.msg), 'position counts the prefix', JSON.stringify(r));
  r = e('Zm9vY'); check(r && /cut off/.test(r.msg), 'one character too many is called cut off', JSON.stringify(r));
  r = e('Zm9=v'); check(r && /after the = padding/.test(r.msg), 'data after = is refused', JSON.stringify(r));
  r = e('Zg==='); check(r && /at most two/.test(r.msg), 'three = refused', JSON.stringify(r));
  r = e('Zm9vé'); check(r && /“é”/.test(r.msg), 'a non-ASCII letter is named', JSON.stringify(r));
  r = e('data:image/png,%E0%A4%A'); check(r && /%-escapes/.test(r.msg), 'broken percent escapes', JSON.stringify(r));
  check(C.decode('Zm9vYmFyIGJheg').ok, 'two missing = are fine');
}

// Smallest real files of each kind (the 1x1 PNG, GIF and WebP are the ones the old page was measured with).
const PNG1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const GIF1 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const WEBP1 = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
const b = s => C.decode(s).bytes;
// A 3x2 baseline JPEG with an APP0 and a DQT before its SOF0, built here byte by byte.
const seg = (m, body) => [0xff, m, (body.length + 2) >> 8, (body.length + 2) & 255, ...body];
const JPG = Uint8Array.from([0xff, 0xd8, ...seg(0xe0, [...Buffer.from('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0]), ...seg(0xdb, Array(65).fill(1)),
  ...seg(0xc4, Array(20).fill(0)), ...seg(0xc0, [8, 0, 2, 0, 3, 1, 1, 0x11, 0]), 0xff, 0xd9]);
const JPG_PROG = JPG.map((v, i) => i > 2 && JPG[i - 1] === 0xff && v === 0xc0 ? 0xc2 : v);
const bmp = (w, h) => { const a = new Uint8Array(54); a[0] = 0x42; a[1] = 0x4d; const dv = new DataView(a.buffer); dv.setInt32(18, w, true); dv.setInt32(22, h, true); return a; };
const vp8x = Uint8Array.from([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBPVP8X'), 10, 0, 0, 0, 0x10, 0, 0, 0, 0xff, 0x03, 0, 0xc6, 0x02, 0]);
const vp8 = Uint8Array.from([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBPVP8 '), 0, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, 0x40, 0x01, 0xf0, 0x00]);
const avif = Uint8Array.from([0, 0, 0, 0x1c, ...Buffer.from('ftypavif'), 0, 0, 0, 0]);
const utf = s => C.utf8(s);

if (suites.includes('sniff')) {
  section('type from the bytes');
  const k = x => { const r = C.sniff(x); return r ? r.mime : null; };
  eq(k(b(PNG1)), 'image/png', 'PNG'); eq(k(b(GIF1)), 'image/gif', 'GIF'); eq(k(b(WEBP1)), 'image/webp', 'WebP');
  eq(k(JPG), 'image/jpeg', 'JPEG'); eq(k(bmp(2, 2)), 'image/bmp', 'BMP'); eq(k(avif), 'image/avif', 'AVIF');
  eq(k(Uint8Array.from([0, 0, 1, 0, 1, 0])), 'image/x-icon', 'ICO');
  eq(k(utf('<svg xmlns="http://www.w3.org/2000/svg"/>')), 'image/svg+xml', 'SVG');
  eq(k(utf('﻿<?xml version="1.0"?>\n<!-- made by hand -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x">\n<svg>')), 'image/svg+xml', 'SVG with BOM, XML header, comment and doctype');
  eq(k(utf('<?xml version="1.0"?><html>')), null, 'XML that is not SVG');
  eq(k(utf('hello')), null, 'plain text is not an image');
  eq(k(new Uint8Array(0)), null, 'nothing is nothing');
  eq(k(utf('%PDF-1.7')), 'application/pdf', 'PDF (encoded, labelled not an image)');
  eq(C.sniff(utf('%PDF-1.7')).image, false, 'PDF is not an image');
}

if (suites.includes('dims')) {
  section('pixel size from the header');
  const d = x => { const r = C.dims(x); return r ? r.w + 'x' + r.h : null; };
  eq(d(b(PNG1)), '1x1', 'PNG IHDR'); eq(d(b(GIF1)), '1x1', 'GIF screen'); eq(d(b(WEBP1)), '1x1', 'WebP lossless (VP8L)');
  eq(d(vp8), '320x240', 'WebP lossy (VP8)'); eq(d(vp8x), '1024x711', 'WebP extended (VP8X)');
  eq(d(JPG), '3x2', 'JPEG SOF0 after APP0, DQT and DHT'); eq(d(JPG_PROG), '3x2', 'progressive JPEG (SOF2)');
  eq(d(bmp(640, -480)), '640x480', 'top-down BMP has a negative height');
  eq(d(utf('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24px">')), '24x24', 'SVG width/height');
  eq(d(utf('<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">')), '120x80', 'SVG viewBox');
  eq(d(utf('<svg width="100%" height="100%">')), null, 'SVG in percent has no pixel size');
  eq(d(b(PNG1).slice(0, 12)), null, 'a cut-off PNG gives no size rather than a wrong one');
  eq(d(JPG.slice(0, 30)), null, 'a cut-off JPEG gives no size');
  // Same sizes for every PNG size up to 16 bits.
  let bad = 0;
  for (const [w, h] of [[1, 65535], [65536, 2], [4000, 3000]]) { const p = b(PNG1).slice(); new DataView(p.buffer).setUint32(16, w); new DataView(p.buffer).setUint32(20, h); if (d(p) !== w + 'x' + h) bad++; }
  eq(bad, 0, 'large PNG sizes read exactly');
}

if (suites.includes('svg')) {
  section('SVG as a percent-encoded data: URI');
  const svgs = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#0b5cc4" d="M0 0h10v10z"/></svg>',
    '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg">\n  <text x="1" y="9">Grüße &amp; ✓ 100% (ok) {a|b} [c] ^`?</text>\n</svg>',
    '﻿<svg xmlns="http://www.w3.org/2000/svg"><style>a{fill:url(#g)}</style></svg>',
  ];
  for (const s of svgs) {
    const uri = C.svgUri(s), body = uri.slice('data:image/svg+xml,'.length);
    check(uri.startsWith('data:image/svg+xml,'), 'starts with the plain svg prefix');
    check(!/["#<>%\r\n\t\u0080-\uffff]/.test(body.replace(/%[0-9A-F]{2}/g, '')), 'nothing left that breaks a URI or a double-quoted attribute (spaces are fine inside quotes)', body.slice(0, 120));
    const back = decodeURIComponent(body);
    const norm = x => x.replace(/^﻿/, '').replace(/"/g, "'").replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
    eq(back, norm(s), 'decodes back to the same SVG (quotes made single, whitespace between tags dropped)');
    check(uri.length < C.dataUri(C.encode(C.utf8(s)), 'image/svg+xml').length, 'smaller than base64');
  }
  const r = C.decode(C.svgUri(svgs[0])); eq(r.ok && C.sniff(r.bytes).mime, 'image/svg+xml', 'the decoder reads it back as SVG');
}

if (suites.includes('formats')) {
  section('copy formats');
  const o = {uri: 'data:image/gif;base64,' + GIF1, b64: GIF1, alt: 'a "tiny" <dot>', w: 1, h: 1};
  eq(C.format('uri', o), 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'Data URI = the old page\'s Data URL for the same GIF');
  eq(C.format('b64', o), 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'Base64 = the old page\'s Base64 only');
  eq(C.format('html', o), '<img src="' + o.uri + '" alt="a &quot;tiny&quot; &lt;dot>" width="1" height="1">', 'HTML escapes the alt text and gives the size');
  eq(C.format('html', {...o, w: 0, h: 0, alt: ''}), '<img src="' + o.uri + '" alt="">', 'no size when unknown, alt="" kept');
  eq(C.format('css', o), 'background-image: url("' + o.uri + '");', 'CSS');
  eq(C.format('css', {uri: "data:image/svg+xml,<svg a='1' b=\"2\">"}), 'background-image: url("data:image/svg+xml,<svg a=\'1\' b=%222%22>");', 'a " inside CSS url() is escaped');
  eq(C.format('md', {uri: 'data:image/svg+xml,a (b)', alt: 'x [y]'}), '![x \\[y\\]](data:image/svg+xml,a%20%28b%29)'.replace('%28', '('), 'Markdown escapes ] in alt, ) and spaces in the URL');
  eq(C.dataUri(PNG1, 'image/png'), 'data:image/png;base64,' + PNG1, 'data URI');
  eq(C.dataUri('aGVsbG8=', 'text/plain'), 'data:text/plain;base64,aGVsbG8=', 'a text file keeps its own type, as on the old page');
  eq(C.dataUri('', null), 'data:application/octet-stream;base64,', 'unknown type');
  eq(C.altFrom('Screenshot_2026-10-14 at 09.41.27.PNG'), 'Screenshot 2026 10 14 at 09.41.27', 'alt from a file name');
  eq(C.bytesLabel(70), '70 B', 'bytes'); eq(C.bytesLabel(1536), '1.5 KB', 'KB'); eq(C.bytesLabel(12015254), '11 MB', 'MB');
  eq(C.fileName(C.sniff(b(PNG1)), 'decoded'), 'decoded.png', 'download name from the bytes'); eq(C.fileName(null, 'decoded'), 'decoded.bin', 'unknown bytes as .bin');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
