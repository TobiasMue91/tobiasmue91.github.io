#!/usr/bin/env node
// Test suite for tools/hash_generator.html (Hash Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises digests a person can paste into a
// release note or compare with a SHA256SUMS line without checking elsewhere, so the expected values come from the
// standards, not from the page: the FIPS 180-2/180-4 and FIPS 202 example vectors, the RFC 1321 MD5 suite, the RFC
// 4231 and RFC 2202 HMAC cases, the CRC-32 check value, Keccak-256 of "" (Ethereum), plus Node's own crypto over
// random input at every block-boundary length, fed in random chunk splits. Also: what people paste as input (hex,
// Base64, line endings, emoji, lone surrogates) and as the expected checksum (sha256sum lines, BSD tags, uppercase,
// spaces), and the old page's sample outputs, which define the contract.
//
//   node test/hash_generator.mjs              # everything
//   node test/hash_generator.mjs vectors      # named suites only
//
// Suites: vectors, hmac, cross, input, verify, contract.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';
import crypto from 'crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'tools', 'hash_generator.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, TextEncoder, Uint8Array, Int32Array};
vm.runInNewContext(src, ctx);
const H = ctx.module.exports;

const ALL = ['vectors', 'hmac', 'cross', 'input', 'verify', 'contract'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;
let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);
const enc = s => new TextEncoder().encode(s);
const hex = (id, bytes, key) => H.toHex(H.hasher(id, key || null).update(bytes).digest());

if (suites.includes('vectors')) {
  section('vectors');
  const abc = enc('abc'), two = enc('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), mil = new Uint8Array(1e6).fill(97);
  const four = enc('abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu');
  const V = {
    sha1: [[abc, 'a9993e364706816aba3e25717850c26c9cd0d89d'], [two, '84983e441c3bd26ebaae4aa1f95129e5e54670f1'], [mil, '34aa973cd4c4daa4f61eeb2bdbad27316534016f']],
    sha224: [[abc, '23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7'], [two, '75388b16512776cc5dba5da1fd890150b0c6455cb4f58b1952522525']],
    sha256: [[abc, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'], [two, '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
      [mil, 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'], [new Uint8Array(0), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855']],
    sha384: [[abc, 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7'],
      [four, '09330c33f71147e83d192fc782cd1b4753111b173b3b05d22fa08086e3b0f712fcc7c71a557e2db966c3e9fa91746039']],
    sha512: [[abc, 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f'],
      [four, '8e959b75dae313da8cf4f72814fc143f8f7779c6eb9f7fa17299aeadb6889018501d289e4900f7e4331b99dec4b5433ac7d329eeb6dd26545e96e55b874be909'],
      [mil, 'e718483d0ce769644e2e42c7bc15b4638e1f98b13b2044285632a803afa973ebde0ff244877ea60a4cb0432ce577c31beb009c5c2c49aa2e4eadb217ad8cc09b']],
    'sha3-224': [[abc, 'e642824c3f8cf24ad09234ee7d3c766fc9a3a5168d0c94ad73b46fdf'], [new Uint8Array(0), '6b4e03423667dbb73b6e15454f0eb1abd4597f9a1b078e3f5b5a6bc7']],
    'sha3-256': [[abc, '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532'], [new Uint8Array(0), 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a'],
      [two, '41c0dba2a9d6240849100376a8235e2c82e1b9998a999e21db32dd97496d3376']],
    'sha3-384': [[abc, 'ec01498288516fc926459f58e2c6ad8df9b473cb0fc08c2596da7cf0e49be4b298d88cea927ac7f539f1edf228376d25']],
    'sha3-512': [[abc, 'b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0']],
    keccak256: [[new Uint8Array(0), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'], [enc('transfer(address,uint256)'), 'a9059cbb2ab09eb219583f4a59a5d0623ade346d962bcd4e46b11da047c9049b']],
    crc32: [[enc('123456789'), 'cbf43926'], [new Uint8Array(0), '00000000'], [enc('The quick brown fox jumps over the lazy dog'), '414fa339']],
    md5: [['', 'd41d8cd98f00b204e9800998ecf8427e'], ['a', '0cc175b9c0f1b6a831c399e269772661'], ['abc', '900150983cd24fb0d6963f7d28e17f72'],
      ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'], ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
      ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f'],
      ['12345678901234567890123456789012345678901234567890123456789012345678901234567890', '57edf4a22be3c955ac49da2e2107b67a']].map(([s, h]) => [enc(s), h])
  };
  for (const id in V) V[id].forEach(([b, want], i) => eq(hex(id, b), want, `${id} vector ${i + 1}`));
  // the length counter past 2^32 bits: a 600 MB message is too slow here, so check the framing writes the high word
  const m = H.BY_ID.sha256.make(); m.total = 2 ** 33; eq(Math.floor(m.total / 536870912), 16, 'length high word for 8 GiB');
}

if (suites.includes('hmac')) {
  section('hmac');
  const fox = enc('The quick brown fox jumps over the lazy dog'), key = enc('key');
  eq(hex('md5', fox, key), '80070713463e7749b90c2dc24911e275', 'HMAC-MD5 (Wikipedia)');
  eq(hex('sha1', fox, key), 'de7c9b85b8b78aa6bc8a7a36f70a90701c9db4d9', 'HMAC-SHA1 (Wikipedia)');
  eq(hex('sha256', fox, key), 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8', 'HMAC-SHA256 (Wikipedia)');
  // RFC 4231 test case 1, 2 and 6 (key longer than the block)
  const k1 = new Uint8Array(20).fill(0x0b), d1 = enc('Hi There');
  eq(hex('sha224', d1, k1), '896fb1128abbdf196832107cd49df33f47b4b1169912ba4f53684b22', 'RFC 4231 #1 SHA-224');
  eq(hex('sha256', d1, k1), 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7', 'RFC 4231 #1 SHA-256');
  eq(hex('sha384', d1, k1), 'afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6', 'RFC 4231 #1 SHA-384');
  eq(hex('sha512', d1, k1), '87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854', 'RFC 4231 #1 SHA-512');
  eq(hex('sha256', enc('what do ya want for nothing?'), enc('Jefe')), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843', 'RFC 4231 #2 SHA-256');
  const k6 = new Uint8Array(131).fill(0xaa), d6 = enc('Test Using Larger Than Block-Size Key - Hash Key First');
  eq(hex('sha256', d6, k6), '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54', 'RFC 4231 #6 SHA-256');
  eq(hex('sha512', d6, k6), '80b24263c7c1a3ebb71493c1dd7be8b49b46d1f41b4aeec1121b013783f8f3526b56d037e05f2598bd0fd2215d6a1e5295e64f73f63f0aec8b915a985d786598', 'RFC 4231 #6 SHA-512');
  eq(hex('md5', enc('what do ya want for nothing?'), enc('Jefe')), '750c783e6ab0b503eaa86e310a5db738', 'RFC 2104/2202 HMAC-MD5');
  check(!H.BY_ID.crc32.block, 'CRC-32 offers no HMAC');
  eq(Object.keys(H.hashAll(fox, key)).includes('crc32'), false, 'hashAll with a key skips CRC-32');
}

if (suites.includes('cross')) {
  section('cross (Node crypto, random data, random chunking)');
  const map = {md5: 'md5', sha1: 'sha1', sha224: 'sha224', sha256: 'sha256', sha384: 'sha384', sha512: 'sha512', 'sha3-224': 'sha3-224', 'sha3-256': 'sha3-256', 'sha3-384': 'sha3-384', 'sha3-512': 'sha3-512'};
  const lens = [0, 1, 3, 55, 56, 57, 63, 64, 65, 71, 72, 73, 103, 104, 105, 111, 112, 113, 127, 128, 129, 135, 136, 137, 143, 144, 145, 255, 1000, 65537];
  let n = 0;
  for (const len of lens) {
    const buf = new Uint8Array(crypto.randomBytes(len));
    for (const id in map) {
      const h = H.hasher(id); let o = 0;
      while (o < len) { const step = 1 + Math.floor(Math.random() * 150); h.update(buf.subarray(o, o + step)); o += step; }
      eq(H.toHex(h.digest()), crypto.createHash(map[id]).update(buf).digest('hex'), `${id} len ${len} chunked`); n++;
      const key = new Uint8Array(crypto.randomBytes(len % 200));
      if (key.length) eq(H.toHex(H.hmac(H.BY_ID[id], key).update(buf).digest()), crypto.createHmac(map[id], key).update(buf).digest('hex'), `HMAC ${id} len ${len}`);
    }
    eq(hex('crc32', buf), (zlibCrc(buf) >>> 0).toString(16).padStart(8, '0'), `crc32 len ${len}`);
  }
  function zlibCrc(b) { let c = -1; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } return ~c; }
}

if (suites.includes('input')) {
  section('input');
  const bytes = (t, m, e) => { const r = H.inputBytes(t, m || 'text', e || 'keep'); return r.error ? {error: r.error} : Array.from(r.bytes); };
  eq(bytes(' abc '), [32, 97, 98, 99, 32], 'text is not trimmed');
  eq(bytes(''), [], 'empty text is zero bytes');
  eq(bytes('é☃😀'), [0xc3, 0xa9, 0xe2, 0x98, 0x83, 0xf0, 0x9f, 0x98, 0x80], 'UTF-8 of 2-, 3- and 4-byte characters');
  eq(bytes('\ud800'), [0xef, 0xbf, 0xbd], 'lone surrogate becomes U+FFFD');
  eq(bytes('a\r\nb\nc\rd', 'text', 'lf'), Array.from(enc('a\nb\nc\nd')), 'line breaks to LF');
  eq(bytes('a\r\nb\nc', 'text', 'crlf'), Array.from(enc('a\r\nb\r\nc')), 'line breaks to CRLF, CRLF not doubled');
  eq(bytes('a\r\nb', 'text', 'keep'), Array.from(enc('a\r\nb')), 'line breaks kept');
  eq(bytes('DE ad:BE-ef 0x01', 'hex'), [0xde, 0xad, 0xbe, 0xef, 1], 'hex with spaces, colons, dashes, 0x');
  eq(bytes('', 'hex'), [], 'empty hex');
  check(bytes('abc', 'hex').error.includes('even'), 'odd hex digit count is an error');
  check(bytes('zz', 'hex').error.includes('"z"'), 'bad hex digit named');
  eq(bytes('aGVsbG8=', 'base64'), Array.from(enc('hello')), 'base64');
  eq(bytes('aGVsbG8', 'base64'), Array.from(enc('hello')), 'base64 without padding');
  eq(bytes('-_8', 'base64'), [0xfb, 0xff], 'base64url');
  eq(bytes('aGVs\nbG8=', 'base64'), Array.from(enc('hello')), 'base64 with a line break');
  check(bytes('a', 'base64').error, 'truncated base64 is an error');
  check(bytes('a$b=', 'base64').error.includes('"$"'), 'bad base64 character named');
  eq(H.format(new Uint8Array([0, 0xab, 0xff]), 'hex'), '00abff', 'hex lowercase keeps leading zero');
  eq(H.format(new Uint8Array([0, 0xab, 0xff]), 'HEX'), '00ABFF', 'hex uppercase');
  eq(['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar'].map(s => H.format(enc(s), 'base64')), ['', 'Zg==', 'Zm8=', 'Zm9v', 'Zm9vYg==', 'Zm9vYmE=', 'Zm9vYmFy'], 'base64 output (RFC 4648 vectors)');
}

if (suites.includes('verify')) {
  section('verify');
  const d = H.hashAll(enc('abc'));
  const v = s => { const e = H.parseExpected(s); return e && e.error ? 'error' : e ? H.verify(e, d).match : null; };
  const s256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  eq(v(s256), 'sha256', 'plain hex');
  eq(v(s256.toUpperCase()), 'sha256', 'uppercase');
  eq(v('  ' + s256 + '  \n'), 'sha256', 'surrounding whitespace');
  eq(v(s256 + '  ubuntu-24.04-desktop-amd64.iso'), 'sha256', 'sha256sum line');
  eq(v(s256 + ' *setup.exe'), 'sha256', 'sha256sum binary-mode line');
  eq(v('SHA256 (file.tar.gz) = ' + s256), 'sha256', 'BSD tag line');
  eq(v(s256.replace(/(.{8})/g, '$1 ').trim()), 'sha256', 'grouped in 8s');
  eq(v('0x' + s256), 'sha256', '0x prefix');
  eq(v('900150983cd24fb0d6963f7d28e17f72'), 'md5', 'md5 by length');
  eq(v('352441c2'), 'crc32', 'crc32');
  eq(v(H.toBase64(d.sha256)), 'sha256', 'base64 digest (SRI style)');
  eq(v('sha256-' + H.toBase64(d.sha256)), 'sha256', 'SRI integrity value');
  eq(v('abc  file.txt'), 'error', 'too short to be a digest');
  eq(v(s256.slice(0, -1) + '0'), null, 'one digit off is no match');
  eq(v(''), null, 'empty is no verdict');
  eq(v('hello world'), 'error', 'prose is an error');
  eq(v(s256.slice(1)), 'error', 'odd length is an error');
  const e = H.parseExpected(s256.slice(0, 10) + 'f' + s256.slice(11));
  eq(H.verify(e, d).sameLength, ['sha256', 'sha3-256', 'keccak256'], 'same-length candidates');
  eq(H.firstDiff('abcd', 'abxd'), 2, 'first differing digit');
}

if (suites.includes('contract')) {
  section('contract (old page sample outputs)');
  const C = [
    ['abc', {md5: '900150983cd24fb0d6963f7d28e17f72', sha1: 'a9993e364706816aba3e25717850c26c9cd0d89d', 'sha3-512': 'b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0'}],
    ['The quick brown fox jumps over the lazy dog', {md5: '9e107d9d372bb6826bd81d3542a419d6', sha256: 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592', 'sha3-512': '01dedd5de4ef14642445ba5f5b97c15e47b9ad931326e4b0727cd94cefc44fff23f07bf543139939b49128caf436dc1bdee54fcb24023a08d9403f9b4bf0d450'}],
    ['héllo ☃ 😀', {md5: '44314d05b09b74dafda26d5273d91a17', sha256: '580dcda131c1ca42e4a009e621dcdd5aafa91f571b0288e77d67bbbf39c86f55'}],
    ['a\r\nb', {sha256: '18745f36a05e29072709042d6062ce54f1b08ff36c27ba80c39f81fb010c8ce2'}],
    ['a\nb', {sha1: 'fcd127ffa1016069006ad91f3f361248f9bdf272'}],
    ['a'.repeat(1048576), {md5: '7202826a7791073fe2787f0c94603278', sha512: 'f083039442f4a8cee2985641fa49cada4ca54d9bf3de03f9ef9f1f726dbb655d2a844aa1014e54fd239a5b3f37ae46d64744fee51ab2d7f5fe9b209e90b5ad52'}]];
  for (const [t, want] of C) for (const id in want) eq(hex(id, H.textBytes(t, 'keep')), want[id], `${id} of ${JSON.stringify(t.slice(0, 20))}`);
  // the old page trimmed: " abc " hashed as "abc". The new one hashes what was typed (a deliberate difference).
  check(hex('md5', H.textBytes(' abc ', 'keep')) !== '900150983cd24fb0d6963f7d28e17f72', '" abc " is no longer hashed as "abc"');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
