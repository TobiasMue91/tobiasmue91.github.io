#!/usr/bin/env node
// Test suite for tools/number_converter.html (Number Base Converter).
//
// Runs the page's DOM-free <script id="core"> block in Node. A base converter promises that the digits it
// shows are the same number: whole numbers of any size are checked against BigInt's own toString/parsing
// (a second implementation the core does not share), fractions against exact rationals - every repeating
// block is expanded back into num/den and must equal the input - and the values people know by heart
// (0.1 is 0.0(0011) in binary, 0xFF at 8 bits is -1). It also checks the input people paste (prefixes,
// grouping marks, a decimal comma, fullwidth digits, a Unicode minus) and that every error names the
// character that is wrong. No browser, no server.
//
//   node test/number_converter.mjs              # everything
//   node test/number_converter.mjs parse frac   # named suites only
//
// Suites: parse, ints, frac, twos, errors, contract, steps.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'number_converter.html');
const ALL = ['parse', 'ints', 'frac', 'twos', 'errors', 'contract', 'steps'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(got === want, what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, BigInt};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;
const conv = (t, from, to, o = {}) => { const v = C.parse(t, from); return v.ok ? C.format(v, to, o).text : 'ERR'; };

// Deterministic PRNG so a failure reproduces.
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const randBig = bits => { let n = 0n; for (let i = 0; i < bits; i++) n = n * 2n + (rnd() < .5 ? 1n : 0n); return n; };

if (suites.includes('parse')) {
  section('parse');
  const val = (t, f) => { const v = C.parse(t, f); return v.ok ? (v.neg ? '-' : '') + v.int + (v.num ? ` ${v.num}/${v.den}` : '') + '@' + v.base : 'ERR'; };
  eq(val('0xFF', 'auto'), '255@16', '0x prefix in auto');
  eq(val('0XfF', 'auto'), '255@16', 'prefix and digits in any case');
  eq(val('#ff', 'auto'), '255@16', '# is hex');
  eq(val('0b1010', 'auto'), '10@2', '0b prefix');
  eq(val('0o17', 'auto'), '15@8', '0o prefix');
  eq(val('  42  ', 'auto'), '42@10', 'stray spaces');
  eq(val('1 000 000', 10), '1000000@10', 'spaces group');
  eq(val("1'000:00", 10), '100000@10', "' and : group (old page)");
  eq(val('1_0000_0001', 2), '257@2', 'underscores group');
  eq(val('1,000', 10), '1000@10', 'thousands comma');
  eq(val('1,234,567', 10), '1234567@10', 'several commas');
  eq(val('3,5', 10), '3 1/2@10', 'decimal comma');
  eq(val('0,625', 'auto'), '0 5/8@10', 'decimal comma before 3 digits but leading 0 → still read as… ');
  eq(val('１２', 10), '12@10', 'fullwidth digits');
  eq(val('−42', 'auto'), '-42@10', 'Unicode minus');
  eq(val('+7', 'auto'), '7@10', 'plus sign');
  eq(val('-0', 2), '0@2', '-0 is 0');
  eq(val('-0.0', 10), '0@10', '-0.0 is 0');
  eq(val('0b1010', 16), '725008@16', 'explicit hex keeps 0b as digits (old page)');
  eq(val('0x1F', 16), '31@16', 'explicit hex strips its own prefix');
  eq(val('.5', 10), '0 1/2@10', 'leading point');
  eq(val('5.', 10), '5@10', 'trailing point');
  eq(val('zz', 36), '1295@36', 'base 36');
  eq(val('Zz', 36), '1295@36', 'base 36 any case');
  eq(val('0012', 8), '10@8', 'leading zeros');
  eq(val('  1010 0001 1111b ', 'auto'), '2591@2', 'trailing b is binary in auto');
  eq(val('1Fh', 'auto'), '31@16', 'trailing h is hex');
  eq(val('0101b', 2), '5@2', 'trailing b in base 2');
  eq(val('1b', 16), '27@16', 'in hex a trailing b is the digit B');
  eq(val('FFb', 'auto'), 'ERR', 'b after non-binary digits is not a suffix');
  eq(C.minBase('12G4'), 17, 'G needs base 17');
  eq(C.minBase('777'), 8, '7 needs base 8');
  eq(C.typedWidth(C.parse('0xFFFFFFD6', 'auto'), '0xFFFFFFD6'), 32, '8 hex digits are 32 bits');
  eq(C.typedWidth(C.parse('0xFFF', 'auto'), '0xFFF'), 0, '3 hex digits are no word');
  eq(String(C.signedValue(C.parse('0xFFFFFFD6', 'auto'), 32)), '-42', '0xFFFFFFD6 signed is -42');
  check(C.parse('', 'auto').empty && C.parse('   ', 10).empty, 'empty and whitespace are empty, not errors');
}

if (suites.includes('ints')) {
  section('ints');
  for (const b of [2, 3, 7, 8, 10, 16, 36]) {
    for (let k = 0; k < 300; k++) {
      const n = randBig(1 + Math.floor(rnd() * 300)), neg = rnd() < .3 && n > 0n;
      const s = (neg ? '-' : '') + n.toString(b);
      for (const t of [2, 8, 10, 16, 36, 5]) {
        const want = (neg ? '-' : '') + n.toString(t).toUpperCase();
        const got = conv(s, b, t);
        if (got !== want) { eq(got, want, `${s} base ${b} → base ${t}`); break; }
        passes++;
      }
    }
  }
  eq(conv('18446744073709551617', 10, 16), '10000000000000001', '2^64+1 to hex');
  eq(conv('10000000000000001', 16, 10), '18446744073709551617', 'and back');
  const huge = '9'.repeat(15000);
  const t0 = Date.now(); const h = conv(huge, 10, 2); const ms = Date.now() - t0;
  check(h !== 'ERR' && BigInt('0b' + h) === BigInt(huge), '15,000 digits convert exactly');
  check(ms < 1500, `15,000 digits in ${ms} ms`);
  eq(C.format(C.parse('255', 10), 2, {sep: '_'}).text, '1111_1111', 'groups of 4 in binary');
  eq(C.format(C.parse('3735928559', 10), 16, {sep: ' '}).text, 'DEAD BEEF', 'groups of 4 in hex');
  eq(C.format(C.parse('1000000', 10), 10, {sep: ','}).text, '1,000,000', 'groups of 3 in decimal');
  eq(C.format(C.parse('-1000000', 10), 10, {sep: ','}).text, '-1,000,000', 'sign outside groups');
  eq(C.format(C.parse('100', 10), 10, {sep: ','}).text, '100', 'no separator in a single group');
}

if (suites.includes('frac')) {
  section('frac');
  eq(conv('0.1', 10, 2), '0.0(0011)', '0.1 in binary repeats 0011');
  eq(conv('0.625', 10, 2), '0.101', '0.625 = 0.101b');
  eq(conv('0.5', 10, 16), '0.8', '0.5 = 0x0.8');
  eq(conv('0.1', 10, 3), '0.(0022)', '0.1 in base 3');
  eq(conv('1/3' === '' ? '' : '0.(3)', 10, 3), 'ERR', 'parentheses are not input');
  eq(conv('0.3333', 10, 10), '0.3333', 'decimal stays as typed');
  eq(conv('0.1', 3, 10), '0.(3)', '1/3 back in decimal');
  eq(conv('0.8', 16, 10), '0.5', 'hex fraction to decimal');
  eq(conv('-12.75', 10, 2), '-1100.11', 'negative fraction');
  eq(conv('0.0(0011)'.replace(/[()]/g, ''), 2, 10), '0.09375', 'copied digits read back as written');
  eq(conv('1.1', 2, 8), '1.4', 'binary to octal');
  // Every repeating expansion must be exactly the input: a.b(c) = (abc - ab) / (base^|b| (base^|c| - 1)).
  for (let k = 0; k < 400; k++) {
    const den = BigInt(2 + Math.floor(rnd() * 200)), num = BigInt(Math.floor(rnd() * Number(den)));
    const base = [2, 3, 7, 10, 12, 16, 36][k % 7];
    const f = C.fracDigits(num, den, base, 10000);
    const B = BigInt(base), D = s => [...s].reduce((a, c) => a * B + BigInt(C.DIGITS.indexOf(c)), 0n);
    let p, q;
    if (f.repeat < 0) { p = D(f.digits); q = B ** BigInt(f.digits.length); }
    else {
      const pre = f.digits.slice(0, f.repeat), all = f.digits;
      p = D(all) - D(pre); q = B ** BigInt(pre.length) * (B ** BigInt(all.length - pre.length) - 1n);
    }
    if (p * den !== num * q) { check(false, `${num}/${den} in base ${base}`, JSON.stringify(f)); break; }
    passes++;
  }
  const long = C.parse('0.1', 10); const cut = C.format(long, 7, {fracLimit: 64});
  check(!cut.cut || cut.text.endsWith('…'), 'a cut-off fraction ends with …');
  const one = C.format(C.parse('1', 97 > 36 ? 10 : 10), 2); eq(one.text, '1', 'one');
  eq(C.format(C.parse('0.1', 10), 2).copy, '0.0001100110011001100110011', 'copy writes whole repeats out to at least 24 digits');
  eq(C.format(C.parse('-0.1', 10), 16).copy, '-0.199999999999999999999999', 'and keeps the sign');
}

if (suites.includes('twos')) {
  section('twos');
  eq(conv('-1', 10, 16, {width: 8}), 'FF', '-1 at 8 bits');
  eq(conv('-1', 10, 2, {width: 16}), '1111111111111111', '-1 at 16 bits, padded');
  eq(conv('-128', 10, 16, {width: 8}), '80', '-128 fits 8 bits');
  eq(conv('-129', 10, 16, {width: 8}), '-81', '-129 does not fit: minus sign kept');
  eq(conv('-42', 10, 16, {width: 32}), 'FFFFFFD6', '-42 at 32 bits');
  eq(conv('-1', 10, 16, {width: 64}), 'FFFFFFFFFFFFFFFF', '-1 at 64 bits');
  eq(conv('-42', 10, 10, {width: 32}), '-42', 'decimal keeps its sign');
  eq(conv('255', 10, 16, {width: 16}), '00FF', 'positive padded to width');
  eq(conv('-1.5', 10, 2, {width: 8}), '-1.1', 'fractions never two\'s complement');
  eq(String(C.signedValue(C.parse('0xFF', 'auto'), 8)), '-1', '0xFF as signed 8-bit');
  eq(String(C.signedValue(C.parse('0x80000000', 'auto'), 32)), '-2147483648', 'INT_MIN');
  eq(C.signedValue(C.parse('0x7F', 'auto'), 8), null, '0x7F is positive');
  eq(C.signedValue(C.parse('0x1FF', 'auto'), 8), null, 'too wide for 8 bits');
  // Round trip: the pattern read as a signed value is the number again.
  for (const w of [8, 16, 32, 64]) for (let k = 0; k < 200; k++) {
    const n = -(randBig(w - 1) + 1n);
    const hex = conv(n.toString(), 10, 16, {width: w});
    const back = C.signedValue(C.parse('0x' + hex, 'auto'), w);
    if (back !== n) { eq(String(back), String(n), `${n} at ${w} bits`); break; }
    passes++;
  }
}

if (suites.includes('errors')) {
  section('errors');
  const err = (t, f) => C.parse(t, f).error || '';
  check(/“2” is not a binary digit/.test(err('1012', 2)) && /0 and 1/.test(err('1012', 2)), 'binary digit named', err('1012', 2));
  check(/“G”/.test(err('1G', 16)) && /A–F/.test(err('1G', 16)), 'hex digit named with the range', err('1G', 16));
  check(/“g”/.test(err('0x1g', 'auto')), 'case kept in the message');
  check(/“é”/.test(err('é', 16)), 'non-ASCII named');
  check(/pick the base/.test(err('FF', 'auto')), 'a decimal error suggests another base');
  check(/one point/.test(err('1.2.3', 10)), 'two points');
  check(/after/.test(err('-', 2)) && /after/.test(err('0x', 'auto')), 'sign or prefix alone');
  check(/fit/.test(err('1'.repeat(C.MAX_LEN + 1), 10)), 'too long is refused, not frozen');
  check(/“e”/.test(err('1e3', 10)), 'exponent notation is named');
}

if (suites.includes('contract')) {
  section('contract');
  // The old page's documented outputs (inventory): everything it accepted means the same here.
  eq(conv('42', 10, 2), '101010', '42 → 101010');
  eq(conv('-42', 10, 16), '-2A', '-42 → -2A');
  eq(conv('0042', 10, 8), '52', '0042 → 52');
  eq(conv('35', 10, 36), 'Z', '35 → Z');
  eq(conv('-0', 10, 2), '0', '-0 → 0');
  eq(conv('0x1F', 16, 10), '31', '0x1F → 31');
  eq(conv('#ff', 16, 10), '255', '#ff → 255');
  eq(conv('-1010', 2, 10), '-10', '-1010b → -10');
  eq(conv('1 0000_0001', 2, 10), '257', 'grouped binary');
  eq(conv('0o17', 8, 10), '15', '0o17 → 15');
  eq(conv('12', 2, 10), 'ERR', '12 is not binary');
  // Deliberate differences: the old page refused these.
  eq(conv('3.5', 10, 2), '11.1', '3.5 now converts (old: error)');
  eq(conv('１２', 10, 10), '12', 'fullwidth now reads (old: error)');
}

if (suites.includes('steps')) {
  section('steps');
  const s1 = C.steps(C.parse('13', 10), 10, 2);
  eq(s1[0], '13 ÷ 2 = 6 remainder 1 → 1', 'first division');
  check(s1[s1.length - 1].endsWith('1101'), 'reads 1101', s1.join(' | '));
  const s2 = C.steps(C.parse('FF', 16), 16, 10);
  eq(s2[0], '15 × 16^1 = 240', 'positional term');
  eq(s2[s2.length - 1], 'sum = 255', 'sum');
  eq(C.steps(C.parse('0', 10), 10, 2)[0], '0 is 0 in every base', 'zero');
  check(C.steps(C.parse('9'.repeat(400), 10), 10, 2).length < 80, 'steps stay short for huge numbers');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
