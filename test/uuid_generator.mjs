#!/usr/bin/env node
// Test suite for tools/uuid_generator.html (UUID Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node's vm; no browser, no server. A UUID tool
// promises UUIDs laid out exactly as RFC 9562 says: the right version and variant bits, timestamps in
// the right epoch and unit, v7/v1/v6 batches that sort in creation order, never a repeat, and v3/v5
// equal to every other implementation for the same namespace and name. The RFC's own Appendix A
// examples are checked, and v3/v5 against test/uuid_generator.vectors.json, written by Python's uuid
// module; MD5 and SHA-1 against Node's crypto. It also promises to read what people paste and to say
// plainly what is wrong with what it cannot read, and exports that stay valid JSON/CSV/SQL/XML whatever
// separator was chosen.
//
//   node test/uuid_generator.mjs              # everything
//   node test/uuid_generator.mjs named parse  # named suites only
//
// Suites: hashes, rfc, named, generate, parse, inspect, format, exports, count, and
//   page  (Chromium, needs `npx http-server -p 8099`) the real page on a phone: a v4 on arrival that Copy puts on the
//         clipboard, format changes that keep the same UUIDs, a bad count marking the old list stale, a million made in
//         the worker with progress and the JSON download holding a million distinct values, Cancel, v5 that updates as you
//         type and survives a reload, old-style links (?v=7&n=3), the checker, dark mode, no console errors and no request
//         leaving the page. Skipped when Chromium or the server is missing.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createHash, randomBytes} from 'crypto';
import vm from 'vm';
import {createRequire} from 'module';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = process.env.UUID_PAGE || join(HERE, '..', 'tools', 'uuid_generator.html');
const ALL = ['hashes', 'rfc', 'named', 'generate', 'parse', 'inspect', 'format', 'exports', 'count', 'page'];
const URL_BASE = process.env.UUID_URL || 'http://localhost:8099/tools/uuid_generator.html';
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, TextEncoder, Uint8Array, BigInt, Date, Math, JSON, Array, String, Number, Set};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;
const V = JSON.parse(readFileSync(join(HERE, 'uuid_generator.vectors.json'), 'utf8'));
const rand = n => new Uint8Array(randomBytes(n));
const bytesOf = s => C.parse(s).bytes;
const RE = ver => new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-${ver}[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`);

if (suites.includes('hashes')) {
  section('hashes');
  const hx = b => Buffer.from(b).toString('hex');
  // RFC 1321 appendix A.5 and FIPS 180 examples
  eq(hx(C.md5(C.utf8(''))), 'd41d8cd98f00b204e9800998ecf8427e', 'md5 ""');
  eq(hx(C.md5(C.utf8('abc'))), '900150983cd24fb0d6963f7d28e17f72', 'md5 abc');
  eq(hx(C.md5(C.utf8('12345678901234567890123456789012345678901234567890123456789012345678901234567890'))), '57edf4a22be3c955ac49da2e2107b67a', 'md5 80 digits');
  eq(hx(C.sha1(C.utf8('abc'))), 'a9993e364706816aba3e25717850c26c9cd0d89d', 'sha1 abc');
  eq(hx(C.sha1(C.utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))), '84983e441c3bd26ebaae4aa1f95129e5e54670f1', 'sha1 448 bits');
  // every length across the padding boundaries (55, 56, 63, 64, 119, 120 ...) against Node's crypto
  let bad = 0;
  for (let n = 0; n < 300; n++) {
    const b = rand(n);
    if (hx(C.md5(b)) !== createHash('md5').update(b).digest('hex')) bad++;
    if (hx(C.sha1(b)) !== createHash('sha1').update(b).digest('hex')) bad++;
  }
  eq(bad, 0, 'md5 and sha1 equal Node crypto for every length 0..299');
  const big = rand(1 << 20);
  eq(hx(C.sha1(big)), createHash('sha1').update(big).digest('hex'), 'sha1 of 1 MiB');
}

if (suites.includes('rfc')) {
  section('rfc');
  // RFC 9562 Appendix A examples
  const dns = bytesOf(C.NAMESPACES.dns);
  eq(C.str(C.v3(dns, 'www.example.com')), '5df41881-3aed-3515-88a7-2f4a814cf09e', 'A.2 v3 www.example.com');
  eq(C.str(C.v5(dns, 'www.example.com')), '2ed6657d-e927-568b-95e1-2665a8aea6a2', 'A.4 v5 www.example.com');
  const T = Date.UTC(2022, 1, 22, 19, 22, 22); // Tuesday, February 22, 2022 2:22:22 PM GMT-05:00
  const fixed = () => { let k = 0; const want = [0xb3, 0xc8, 0x9f, 0x6b, 0xde, 0xce, 0xd8, 0x46]; return n => { const out = new Uint8Array(n); for (let i = 0; i < n; i++) out[i] = want[(k++) % 8]; return out; }; };
  let g = new C.Generator(fixed(), () => T);
  // the RFC's node has the multicast bit clear (an example MAC); ours always sets it, so compare time + clock only
  const v1 = C.str(g.v1());
  eq(v1.slice(0, 23), 'c232ab00-9414-11ec-b3c8', 'A.1 v1 time and clock sequence');
  const i1 = C.inspect(bytesOf('C232AB00-9414-11EC-B3C8-9F6BDECED846'));
  eq([i1.version, C.isoTime(i1.ms, i1.ticks), i1.clockSeq, i1.node, i1.nodeRandom], [1, '2022-02-22T19:22:22.0000000Z', 0x33c8, '9f:6b:de:ce:d8:46', true], 'A.1 decoded');
  g = new C.Generator(fixed(), () => T);
  eq(C.str(g.v6()).slice(0, 23), '1ec9414c-232a-6b00-b3c8', 'A.5 v6 time and clock sequence');
  const i6 = C.inspect(bytesOf('1EC9414C-232A-6B00-B3C8-9F6BDECED846'));
  eq([i6.version, C.isoTime(i6.ms, i6.ticks)], [6, '2022-02-22T19:22:22.0000000Z'], 'A.5 decoded');
  const i7 = C.inspect(bytesOf('017F22E2-79B0-7CC3-98C4-DC0C0C07398F'));
  eq([i7.version, C.isoTime(i7.ms)], [7, '2022-02-22T19:22:22.000Z'], 'A.6 v7 decoded');
  g = new C.Generator(rand, () => T);
  eq(C.str(g.v7()).slice(0, 15), '017f22e2-79b0-7', 'A.6 v7 timestamp');
  eq(C.str(C.NIL), '00000000-0000-0000-0000-000000000000', '§5.9 nil');
  eq(C.str(C.MAX), 'ffffffff-ffff-ffff-ffff-ffffffffffff', '§5.10 max');
  eq(C.NAMESPACES, {dns: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', url: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', oid: '6ba7b812-9dad-11d1-80b4-00c04fd430c8', x500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8'}, '§6.6 namespace IDs');
}

if (suites.includes('named')) {
  section('named');
  let bad = 0;
  for (const [ns, name, u3, u5] of V.named) {
    const nb = bytesOf(C.NAMESPACES[ns] || ns);
    const g3 = C.str(C.v3(nb, name)), g5 = C.str(C.v5(nb, name));
    if (g3 !== u3) { bad++; console.log(`  v3 ${ns} ${JSON.stringify(name.slice(0, 40))}: ${g3} != ${u3}`); }
    if (g5 !== u5) { bad++; console.log(`  v5 ${ns} ${JSON.stringify(name.slice(0, 40))}: ${g5} != ${u5}`); }
  }
  eq(bad, 0, `${V.named.length * 2} v3/v5 values equal Python's uuid (empty, non-ASCII, emoji, 1000 chars, trailing space, custom namespace)`);
  const dns = bytesOf(C.NAMESPACES.dns);
  check(RE(5).test(C.str(C.v5(dns, 'x'))) && RE(3).test(C.str(C.v3(dns, 'x'))), 'version and variant digits set');
  check(C.str(C.v5(dns, 'a ')) !== C.str(C.v5(dns, 'a')), 'a trailing space is part of the name');
  check(C.str(C.v5(dns, 'Example.com')) !== C.str(C.v5(dns, 'example.com')), 'names are case-sensitive, as the RFC requires');
}

if (suites.includes('generate')) {
  section('generate');
  const g = new C.Generator(rand);
  for (const [ver, f] of [[4, () => g.v4()], [7, () => g.v7()], [1, () => g.v1()], [6, () => g.v6()]]) {
    const a = Array.from({length: 20000}, () => C.str(f()));
    eq(a.filter(x => !RE(ver).test(x)).length, 0, `v${ver}: 20,000 all have version ${ver} and variant 10xx`);
    eq(new Set(a).size, a.length, `v${ver}: 20,000 without a repeat`);
    if (ver !== 4 && ver !== 1) eq(a.filter((x, i) => i && x <= a[i - 1]).length, 0, `v${ver}: a batch sorts in creation order as text`);
  }
  // v4 bits are uniform: every one of the 122 free bits is set about half the time
  const N = 20000, ones = new Array(128).fill(0);
  for (let i = 0; i < N; i++) { const b = g.v4(); for (let k = 0; k < 128; k++) if (b[k >> 3] >> (7 - (k & 7)) & 1) ones[k]++; }
  const fixedBits = new Set([48, 49, 50, 51, 64, 65]);
  const skew = ones.map((c, k) => fixedBits.has(k) ? 0 : Math.abs(c / N - 0.5)).reduce((m, x) => Math.max(m, x), 0);
  check(skew < 0.02, 'v4: every free bit is set 50 % ± 2 % of the time', `worst ${skew}`);
  // a frozen clock: a million v7 in one millisecond still increase, borrowing the next ms when the counter runs out
  const T = 1700000000000, g7 = new C.Generator(rand, () => T);
  let prev = '', ok = true, last;
  for (let i = 0; i < 200000; i++) { last = C.str(g7.v7()); if (last <= prev) { ok = false; break; } prev = last; }
  check(ok, 'v7: 200,000 in one frozen millisecond stay strictly increasing');
  const lastMs = C.inspect(bytesOf(last)).ms;
  check(lastMs >= T && lastMs < T + 200, 'v7: borrowed time stays close to the clock', `${lastMs - T} ms ahead`);
  // the clock going backwards (NTP step) never breaks the order
  let t = T; const gb = new C.Generator(rand, () => t);
  const before = C.str(gb.v7()); t = T - 5000; const after = C.str(gb.v7());
  check(after > before, 'v7: a clock that steps back still gives a larger UUID');
  const g1 = new C.Generator(rand, () => T), x = C.str(g1.v1()), y = C.str(g1.v1());
  eq(x.slice(19), y.slice(19), 'v1: clock sequence and node stay the same within a session');
  const i1 = C.inspect(g1.v1());
  check(i1.nodeRandom, 'v1: the node is random with the multicast bit set (never a MAC address)');
  eq(i1.ms, T, 'v1: decodes back to the clock');
  const now = Date.now(), live = C.inspect(new C.Generator(rand).v7());
  check(Math.abs(live.ms - now) < 1000, 'v7 from the real clock decodes to now');
  // a timestamp in milliseconds since 1970 written into a v7 survives up to the year 10889 (48 bits)
  const gf = new C.Generator(rand, () => 2 ** 48 - 1);
  eq(C.str(gf.v7()).slice(0, 13), 'ffffffff-ffff', 'v7: the 48-bit maximum time');
  eq(C.str(C.make(g, 'nil')), '00000000-0000-0000-0000-000000000000', 'make nil');
}

if (suites.includes('parse')) {
  section('parse');
  const want = 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6';
  for (const s of [want, want.toUpperCase(), '  ' + want + '\n', '{' + want + '}', '{' + want.toUpperCase() + '}', 'urn:uuid:' + want, 'URN:UUID:' + want,
    want.replace(/-/g, ''), '"' + want + '",', "'" + want + "'", '(' + want + ')', '`' + want + '`', '{ ' + want + ' }'])
    eq(C.parse(s).bytes && C.str(C.parse(s).bytes), want, `reads ${JSON.stringify(s)}`);
  const err = s => C.parse(s).error;
  eq(err(''), 'empty', 'empty');
  eq(err('   '), 'empty', 'whitespace only');
  eq(err(want.slice(0, -1)), 'length', 'one digit short');
  eq(err(want + '0'), 'length', 'one digit too many');
  eq(err(want.replace('a', 'g')), 'char', 'a g');
  eq(err(want.replace('0', 'O')), 'char', 'letter O for a zero');
  eq(err('f81d4fae7dec-11d0-a765-00a0c91e6bf6'), 'hyphens', 'hyphens in the wrong places');
  eq(err('ｆ81d4fae-7dec-11d0-a765-00a0c91e6bf6'), 'char', 'full-width letter');
  eq(err('x'.repeat(100000)), 'char', 'huge junk is refused fast');
  check(/32/.test(C.parse(want.slice(0, -1)).message) && /31/.test(C.parse(want.slice(0, -1)).message), 'length message says how many it has and needs', C.parse(want.slice(0, -1)).message);
  check(/“g”/.test(C.parse(want.replace('a', 'g')).message), 'char message names the bad character', C.parse(want.replace('a', 'g')).message);
  check(/1 hex digit;/.test(C.parse('a').message), 'singular for one digit', C.parse('a').message);
}

if (suites.includes('inspect')) {
  section('inspect');
  const I = s => C.inspect(bytesOf(s));
  eq(I('00000000-0000-0000-0000-000000000000').kind, 'nil', 'nil');
  eq(I('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF').kind, 'max', 'max');
  eq([I('2ed6657d-e927-568b-95e1-2665a8aea6a2').version, I('2ed6657d-e927-568b-95e1-2665a8aea6a2').ms], [5, undefined], 'v5 has no time');
  eq(I('5df41881-3aed-3515-88a7-2f4a814cf09e').version, 3, 'v3');
  eq(I('919108f7-52d1-4320-9bac-f847db4148a8').version, 4, 'v4');
  eq(I('320c3d4d-cc00-875b-8ec9-32d5f69181c0').version, 8, 'v8 (RFC 9562 A.7)');
  eq(I('00000000-0000-9000-8000-000000000000').note, 'Version 9 is reserved; no standard defines it yet.', 'undefined version 9');
  // variants by the first digit of the 4th group
  eq(I('f81d4fae-7dec-11d0-0765-00a0c91e6bf6').variant, 'ncs', 'variant 0-7: NCS');
  eq(I('f81d4fae-7dec-11d0-c765-00a0c91e6bf6').variant, 'microsoft', 'variant c-d: Microsoft');
  eq(I('f81d4fae-7dec-11d0-e765-00a0c91e6bf6').variant, 'future', 'variant e-f: reserved');
  eq(I('f81d4fae-7dec-11d0-e765-00a0c91e6bf6').version, null, 'no version outside the RFC variant');
  // v1 time against Python's uuid: 60-bit count of 100 ns since 1582-10-15
  for (const [s, time, cs, node] of V.v1) {
    const r = I(s);
    const ticks100ns = BigInt(r.ms) * 10000n + BigInt(r.ticks) + 122192928000000000n;
    eq([ticks100ns.toString(), r.clockSeq, r.node.replace(/:/g, '')], [time, cs, node], `v1 ${s}`);
  }
  eq(C.isoTime(I('00000000-0000-1000-8000-000000000000').ms, I('00000000-0000-1000-8000-000000000000').ticks), '1582-10-15T00:00:00.0000000Z', 'v1 time zero is the Gregorian reform');
  const far = I('ffffffff-ffff-1fff-bfff-ffffffffffff');
  eq(C.isoTime(far.ms, far.ticks), '5236-03-31T21:21:00.6846975Z', 'v1 largest time');
  eq(C.isoTime(I('ffffffff-ffff-7fff-bfff-ffffffffffff').ms), '+010889-08-02T05:31:50.655Z', 'v7 largest time');
  eq(C.isoTime(I('00000000-0000-7000-8000-000000000000').ms), '1970-01-01T00:00:00.000Z', 'v7 zero');
  eq(I('f81d4fae-7dec-11d0-a765-00a0c91e6bf6').nodeRandom, false, 'v1 with a real MAC (multicast bit clear)');
}

if (suites.includes('format')) {
  section('format');
  const b = bytesOf('f81d4fae-7dec-11d0-a765-00a0c91e6bf6');
  const F = o => C.format(b, o);
  eq(F(), 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6', 'standard');
  eq(F({upper: true}), 'F81D4FAE-7DEC-11D0-A765-00A0C91E6BF6', 'uppercase');
  eq(F({sep: ''}), 'f81d4fae7dec11d0a76500a0c91e6bf6', 'no hyphens');
  eq(F({wrap: 'braces', upper: true}), '{F81D4FAE-7DEC-11D0-A765-00A0C91E6BF6}', 'braces');
  eq(F({wrap: 'quotes'}), '"f81d4fae-7dec-11d0-a765-00a0c91e6bf6"', 'quotes');
  eq(F({wrap: 'squotes'}), "'f81d4fae-7dec-11d0-a765-00a0c91e6bf6'", 'single quotes, for SQL');
  eq(F({wrap: 'urn'}), 'urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6', 'URN');
  eq(F({wrap: 'urn', upper: true}), 'urn:uuid:F81D4FAE-7DEC-11D0-A765-00A0C91E6BF6', 'URN prefix stays lowercase');
  eq(F({sep: '_'}), 'f81d4fae_7dec_11d0_a765_00a0c91e6bf6', 'custom separator');
  eq(F({sep: 'x', upper: true}), 'F81D4FAExDEC'.replace('xDEC', 'x7DEC') + 'x11D0xA765x00A0C91E6BF6', 'case leaves a custom separator alone');
  eq(F({sep: '$&'}), 'f81d4fae$&7dec$&11d0$&a765$&00a0c91e6bf6', 'separator is literal, never a replace pattern');
  eq(F({sep: '<b>'}), 'f81d4fae<b>7dec<b>11d0<b>a765<b>00a0c91e6bf6', 'separator is text, not markup');
  for (const o of [{}, {upper: true}, {sep: ''}, {wrap: 'braces'}, {wrap: 'urn'}, {wrap: 'quotes', upper: true}, {wrap: 'squotes'}])
    eq(C.str(C.parse(F(o)).bytes), 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6', `every output reads back: ${JSON.stringify(o)}`);
}

if (suites.includes('exports')) {
  section('exports');
  const L = ['a1', "b'2", 'c<3>&"'];
  const E = k => C.EXPORTS[k].f(L);
  eq(E('txt'), "a1\nb'2\nc<3>&\"\n", 'txt');
  eq(JSON.parse(E('json')), L, 'json parses back');
  eq(E('csv'), 'uuid\na1\nb\'2\n"c<3>&"""\n', 'csv header and quoting');
  eq(E('sql').split('\n')[1], "INSERT INTO uuids (uuid) VALUES ('b''2');", 'sql doubles quotes');
  eq(E('xml').includes('<uuid>c&lt;3&gt;&amp;&quot;</uuid>'), true, 'xml escapes');
  eq(vm.runInNewContext(E('js') + 'uuids'), L, 'js runs and gives the array');
  eq(Object.keys(C.EXPORTS).map(k => C.EXPORTS[k].ext), ['txt', 'csv', 'json', 'sql', 'js', 'xml'], 'six formats, as before');
  eq(C.fileName('csv', new Date(2026, 0, 5, 23, 59)), 'uuids_2026-01-05.csv', 'file name uses the local date');
  const big = Array.from({length: 1000000}, (_, i) => String(i));
  const t0 = Date.now(); C.EXPORTS.json.f(big); C.EXPORTS.xml.f(big);
  check(Date.now() - t0 < 3000, 'a million lines export in a few seconds', `${Date.now() - t0} ms`);
}

if (suites.includes('count')) {
  section('count');
  for (const [s, want] of [['1', 1], [' 10 ', 10], ['1,000', 1000], ['1.000', 1000], ['10 000', 10000], ['1’000', 1000], ['1000000', 1000000]])
    eq(C.clampCount(s).value, want, `count ${JSON.stringify(s)}`);
  eq(C.clampCount('2000000'), {error: 'At most 1,000,000 at a time.', value: 1000000}, 'too many: clamps and says so');
  for (const s of ['', '  ', '0', '-5', '1e3', '12x', 'ten', '1.5e2'])
    check(C.clampCount(s).error && !C.clampCount(s).value, `refuses ${JSON.stringify(s)}`, JSON.stringify(C.clampCount(s)));
  const g = new C.Generator(rand), t0 = Date.now(), a = C.batch(g, 7, 100000, {upper: true, wrap: 'braces'});
  check(Date.now() - t0 < 4000, '100,000 v7 formatted in a few seconds', `${Date.now() - t0} ms`);
  eq(a.length, 100000, 'batch length');
  let seen = 0; C.batch(g, 4, 40000, {}, n => { seen = n; });
  eq(seen, 32768, 'batch reports progress');
}

if (suites.includes('page')) {
  section('page');
  let chromium = null;
  try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch (e) { /* not installed */ }
  let up = false;
  try { up = (await fetch(URL_BASE, {method: 'HEAD'})).ok; } catch (e) { /* no server */ }
  if (!chromium || !up) console.log(`  skipped: ${!chromium ? 'Playwright not found' : 'no server at ' + URL_BASE + ' (npx http-server -p 8099)'}`);
  else await pageSuite(chromium);
}

async function pageSuite(chromium) {
  const {readFileSync: rf} = await import('fs');
  const b = await chromium.launch();
  const c = await b.newContext({viewport: {width: 390, height: 844}, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write']});
  const p = await c.newPage(), errs = [], away = [];
  p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(String(e)));
  const origin = new URL(URL_BASE).origin;
  p.on('request', r => { if (!r.url().startsWith(origin) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) away.push(r.url()); });
  await p.goto(URL_BASE); await p.evaluate(() => localStorage.clear()); await p.reload();
  const one = await p.textContent('#uuidOne');
  check(RE(4).test(one), 'a v4 on arrival', one);
  const box = await p.locator('#copy').boundingBox();
  check(box && box.y + box.height < 844, 'Copy is on screen without scrolling');
  await p.click('#copy');
  eq(await p.evaluate(() => navigator.clipboard.readText()), one, 'Copy puts exactly the UUID on the clipboard');
  await p.click('#caseSeg [data-val=upper]'); await p.click('#wrapSeg [data-val=braces]');
  eq(await p.textContent('#uuidOne'), '{' + one.toUpperCase() + '}', 'a format change keeps the same UUID');
  await p.click('#caseSeg [data-val=lower]'); await p.click('#wrapSeg [data-val=none]');
  await p.click('[data-n="10"]');
  const ten = await p.$$eval('#list li button', l => l.map(x => x.textContent));
  check(ten.length === 10 && ten.every(x => RE(4).test(x)) && new Set(ten).size === 10, '10 distinct v4 in the list');
  await p.fill('#count', '12x'); await p.waitForTimeout(250);
  check(/whole number/.test(await p.textContent('#countErr')), 'a bad count says what is accepted');
  check(await p.isVisible('.keptnote') && !(await p.isDisabled('#copy')), 'and the last list stays usable, marked as kept');
  eq(await p.$$eval('#list li button', l => l.map(x => x.textContent)), ten, 'the old list is kept, not lost');
  await p.fill('#count', '1000000');
  await p.waitForSelector('#working:not(.hidden)', {timeout: 5000});
  check(await p.isVisible('#cancel') && await p.isVisible('#list'), 'a million: progress and Cancel while it works, the last list still there');
  await p.waitForSelector('#working', {state: 'hidden', timeout: 60000});
  eq(await p.textContent('#listCount'), '1,000,000 UUIDs', 'a million made');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dlBtn').then(() => p.click('#dlMenu button:has-text("JSON")'))]);
  const arr = JSON.parse(rf(await dl.path(), 'utf8'));
  check(arr.length === 1000000 && new Set(arr).size === 1000000 && arr.every(x => RE(4).test(x)), 'the JSON download holds a million distinct v4');
  check(/^uuids_\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()), 'file name uuids_YYYY-MM-DD.json', dl.suggestedFilename());
  await p.fill('#count', '900000'); await p.waitForSelector('#working:not(.hidden)'); await p.click('#cancel');
  check(await p.isVisible('#multi') && !(await p.isVisible('#working')), 'Cancel goes back to the last list');
  await p.click('[data-v="5"]');
  eq(await p.$eval('#uuidOne', e => e.textContent), '2ed6657d-e927-568b-95e1-2665a8aea6a2', 'v5 opens on the RFC example (DNS, www.example.com)');
  await p.fill('#names', 'a\nuser@example.org ');
  eq(await p.$$eval('#list li button', l => l.map(x => x.textContent)), ['4f3f2898-69e3-5a0d-820a-c4e87987dbce', C.str(C.v5(bytesOf(C.NAMESPACES.dns), 'user@example.org '))], 'v5 per line as you type');
  check(/ends with a space/.test(await p.textContent('#nameErr')), 'a trailing space is pointed out');
  await p.reload();
  eq(await p.inputValue('#names'), 'a\nuser@example.org ', 'names survive a reload');
  await p.goto(URL_BASE + '?v=7&n=3');
  const l7 = await p.$$eval('#list li button', l => l.map(x => x.textContent));
  check(l7.length === 3 && l7.every(x => RE(7).test(x)) && l7[0] < l7[1] && l7[1] < l7[2], '?v=7&n=3 gives three sorted v7');
  await p.fill('#insp', ' {C232AB00-9414-11EC-B3C8-9F6BDECED846}, ');
  const facts = await p.textContent('#facts');
  check(/Version 1/.test(facts) && /2022-02-22T19:22:22\.000Z/.test(facts) && /Read as/.test(facts), 'the checker reads a pasted GUID with braces and a comma', facts);
  await p.fill('#insp', 'f81d4fae-7dec-11d0-a765-00a0c91e6bg6');
  check(/“g”/.test(await p.textContent('#inspErr')), 'and names the bad character');
  const d = await b.newContext({viewport: {width: 390, height: 844}, colorScheme: 'dark'}), dp = await d.newPage();
  await dp.goto(URL_BASE);
  const bg = await dp.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(bg !== 'rgb(246, 246, 243)', 'dark mode', bg);
  eq(errs, [], 'no console errors'); eq(away, [], 'no request leaves the page');
  await b.close();
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
