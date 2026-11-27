#!/usr/bin/env node
// Test suite for tools/metadata_cleaner.html.
//
// The page promises three things, and none of them can be seen on the page itself:
//   1. what it lists as found is really in the file (GPS read to the right decimal place),
//   2. the clean copy has none of it left - not in a field a viewer shows, and not as stray bytes,
//   3. the picture / sound is untouched: no re-encoding, the same decoded pixels and samples.
// So this runs the page's core (the <script id="core"> block, no DOM) in Node against real files
// made by other software (test/metadata_cleaner.fixtures.json says how), against files built here
// from the specs, and against broken ones. exiftool and ffmpeg, when installed, act as independent
// judges: exiftool must find no privacy tag in a clean copy, ffmpeg must decode it to the same
// md5 as the original. Without them those checks are reported as skipped, not passed.
//
//   node test/metadata_cleaner.mjs                 # everything
//   node test/metadata_cleaner.mjs formats pdf     # named suites only
//   node test/metadata_cleaner.mjs --page=x.html   # another copy of the page
//
// Suites: exif, formats, built, oracle, pdf, broken, page.
// pdf needs pdf-lib, the same version the page loads:  npm i --no-save pdf-lib@1.17.1

import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {tmpdir} from 'os';
import {execFileSync} from 'child_process';
import {createRequire} from 'module';
import zlib from 'zlib';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'tools', 'metadata_cleaner.html');
const ALL = ['exif', 'formats', 'built', 'oracle', 'pdf', 'broken', 'page'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0, skips = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const skip = what => { skips++; console.log(`  skip  ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const coreSrc = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!coreSrc) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({TextDecoder, TextEncoder, Set, Promise});
vm.runInContext(coreSrc[1] + '\nthis.MetaClean = MetaClean;', ctx);
const M = ctx.MetaClean;

const FX = JSON.parse(readFileSync(join(HERE, 'metadata_cleaner.fixtures.json'), 'utf8')).files;
const fx = name => new Uint8Array(Buffer.from(FX[name], 'base64'));
const has = (bytes, s) => Buffer.from(bytes).includes(Buffer.from(s, 'utf8'));
const labels = r => r.removed.map(f => f.label);
const value = (r, label) => (r.removed.find(f => f.label === label) || {}).value;

let PDFLib = null;
try { PDFLib = createRequire(import.meta.url)('pdf-lib'); } catch (e) {}
const deps = {PDFLib};
const tool = name => { try { execFileSync(name, [name === 'exiftool' ? '-ver' : '-version'], {stdio: 'ignore'}); return true; } catch (e) { return false; } };

// ---------- hand-built files (from the specs, not from the page) ----------
const be32 = v => [v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255];
const le32 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255];
const asc = s => [...Buffer.from(s, 'latin1')];
const u8 = (...parts) => new Uint8Array(parts.flat());
function crc32(b) { let c = -1; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ c >>> 1 : c >>> 1; } return (c ^ -1) >>> 0; }
function pngChunk(type, data) { const body = [...asc(type), ...data]; return [...be32(data.length), ...body, ...be32(crc32(body))]; }
function png(chunksBefore, chunksAfter = []) {
    const raw = Buffer.alloc(3 * (1 + 4 * 3)); // 4x3 RGB, filter 0
    for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) raw.set([x * 60, y * 80, 200], y * 13 + 1 + x * 3);
    return u8(137, 80, 78, 71, 13, 10, 26, 10, pngChunk('IHDR', [...be32(4), ...be32(3), 8, 2, 0, 0, 0]), ...chunksBefore,
        pngChunk('IDAT', [...zlib.deflateSync(raw)]), ...chunksAfter, pngChunk('IEND', []));
}
function oggCrc(b) {
    let c = 0;
    for (const x of b) { c ^= x << 24; for (let k = 0; k < 8; k++) c = c & 0x80000000 ? (c << 1) ^ 0x04C11DB7 : c << 1; c >>>= 0; }
    return c >>> 0;
}
function oggPagesOk(b) {
    let p = 0, n = 0, seq = -1;
    while (p < b.length) {
        if (Buffer.from(b.subarray(p, p + 4)).toString('latin1') !== 'OggS') return 'no OggS at ' + p;
        const ns = b[p + 26]; let len = 0; for (let i = 0; i < ns; i++) len += b[p + 27 + i];
        const pg = new Uint8Array(b.subarray(p, p + 27 + ns + len)), want = pg[22] | pg[23] << 8 | pg[24] << 16 | pg[25] << 24;
        pg[22] = pg[23] = pg[24] = pg[25] = 0;
        if ((oggCrc(pg) | 0) !== (want | 0)) return 'bad CRC on page ' + n;
        const s = b[p + 18] | b[p + 19] << 8 | b[p + 20] << 16 | b[p + 21] << 24;
        if (s !== seq + 1) return 'page ' + n + ' has sequence ' + s; seq = s;
        p += 27 + ns + len; n++;
    }
    return n ? '' : 'no pages';
}
const gpsExif = (lat, lon, extra = []) => M.buildTiff([
    {ifd: 'ifd0', tag: 0x010F, type: 2, value: 'Apple'}, {ifd: 'ifd0', tag: 0x0110, type: 2, value: 'iPhone 15'},
    {ifd: 'gps', tag: 1, type: 2, value: lat < 0 ? 'S' : 'N'}, {ifd: 'gps', tag: 2, type: 5, value: dmsOf(Math.abs(lat))},
    {ifd: 'gps', tag: 3, type: 2, value: lon < 0 ? 'W' : 'E'}, {ifd: 'gps', tag: 4, type: 5, value: dmsOf(Math.abs(lon))}, ...extra]);
function dmsOf(d) { const D = Math.floor(d), m = Math.floor((d - D) * 60), s = ((d - D) * 60 - m) * 60; return [D, m, +s.toFixed(4)]; }

// ======================================================================
if (suites.includes('exif')) {
    section('exif - reading what the file says, to the right decimal place');
    // Exif 2.32 sec. 4.6.6: GPSLatitude is three rationals, degrees/minutes/seconds; Ref N/S, E/W.
    // 52 deg 31' 12.63" N = 52.520175 (published conversion: d + m/60 + s/3600).
    const tiff = M.buildTiff([{ifd: 'gps', tag: 1, type: 2, value: 'N'}, {ifd: 'gps', tag: 2, type: 5, value: [52, 31, 12.63]},
        {ifd: 'gps', tag: 3, type: 2, value: 'W'}, {ifd: 'gps', tag: 4, type: 5, value: [0, 7, 39.6]},
        {ifd: 'ifd0', tag: 0x0112, type: 3, value: [8]}, {ifd: 'exif', tag: 0x829A, type: 5, value: [0.004]}, {ifd: 'exif', tag: 0x829D, type: 5, value: [1.8]}]);
    const r = M._.parseTiff(tiff, 0, tiff.length);
    check(Math.abs(r.gps.lat - 52.520175) < 1e-6, 'latitude 52 31 12.63 N = 52.520175', r.gps && r.gps.lat);
    check(Math.abs(r.gps.lon + 0.1276667) < 1e-6, 'longitude 0 07 39.6 W = -0.127667 (west is negative)', r.gps && r.gps.lon);
    check(r.fields[0].value === '52.52018° N, 0.12767° W', 'shown as "52.52018° N, 0.12767° W"', r.fields[0].value);
    check(r.orientation === 8, 'orientation 8 read from IFD0');
    check(r.fields.some(f => f.label === 'Exposure time' && f.value === '1/250 s'), 'exposure 0.004 s shown as 1/250 s');
    check(r.fields.some(f => f.label === 'F-number' && f.value === 'f/1.8'), 'f-number shown as f/1.8');
    // little-endian file with the same content
    const le = [...asc('II'), 42, 0, 8, 0, 0, 0, 1, 0, 0x0F, 0x01, 2, 0, 6, 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0, ...asc('Canon\0')];
    const r2 = M._.parseTiff(new Uint8Array(le), 0, le.length);
    check(r2.fields.length === 1 && r2.fields[0].value === 'Canon', 'little-endian (II) TIFF read', JSON.stringify(r2.fields));
    // a loop: IFD0's next pointer points back at itself
    const loop = [...asc('MM'), 0, 42, 0, 0, 0, 8, 0, 0, 0, 0, 0, 8];
    check(M._.parseTiff(new Uint8Array(loop), 0, loop.length).fields.length === 0, 'IFD pointing to itself does not loop');
    // GPS of 0,0 is a placeholder some phones write when they had no fix: not reported as a position
    const zero = gpsExif(0, 0);
    check(!M._.parseTiff(zero, 0, zero.length).gps, 'GPS 0,0 is not reported as a real position');
    const fiji = gpsExif(-17.7134, 178.065);
    const rf = M._.parseTiff(fiji, 0, fiji.length);
    check(rf.gps && rf.gps.lat < 0 && rf.gps.lon > 0, 'southern / eastern hemisphere signs', JSON.stringify(rf.gps));
}

// ======================================================================
if (suites.includes('formats')) {
    section('formats - real files from other software');
    const cases = {
        'a.jpg': {fmt: 'jpeg', must: ['GPS position', 'Camera model', 'Camera serial number', 'Artist', 'Date taken', 'City', 'Creator', 'Comment', 'By-line (author)'], secrets: ['Jane', 'Pixel 8', 'SN12345', 'Berlin', 'hello COM']},
        'c.png': {fmt: 'png', must: ['Author', 'Comment', 'GPS position', 'Camera serial number'], secrets: ['Jane', 'GIMP', 'Pixel']},
        'd.webp': {fmt: 'webp', must: ['GPS position', 'Creator'], secrets: ['Jane', 'Pixel']},
        'l.gif': {fmt: 'gif', must: ['Comment'], secrets: ['secret comment']},
        'h.avif': {fmt: 'avif', must: ['GPS position', 'Camera make'], secrets: ['Apple', 'Jane']},
        'f.mp3': {fmt: 'mp3', must: ['Title', 'Artist', 'Encoder software'], secrets: ['Jane', 'Lavf', 'TAG']},
        'f.flac': {fmt: 'flac', must: ['Artist', 'Encoder'], secrets: ['Jane', 'Lavf']},
        'f.wav': {fmt: 'wav', must: ['Artist', 'Comment'], secrets: ['Jane', 'Recorded at home', 'Lavf']},
        'f.ogg': {fmt: 'ogg', must: ['Artist'], secrets: ['Jane', 'Lavf', 'ARTIST']},
        'f.opus': {fmt: 'ogg', must: ['Artist'], secrets: ['Jane', 'Lavf']},
        'f.m4a': {fmt: 'm4a', must: ['Title', 'Artist'], secrets: ['Jane', 'Lavf']},
        'v.mp4': {fmt: 'mp4', must: ['Title', 'Location (3GPP)', 'Creator'], secrets: ['Holiday', 'Jane', 'Lavf']},
        'v.mov': {fmt: 'mov', must: ['GPS position', 'Make'], secrets: ['Apple', '52.5163', 'Lavf']},
        'plain.jpg': {fmt: 'jpeg', must: [], secrets: []}
    };
    for (const [name, c] of Object.entries(cases)) {
        const b = fx(name), r = await M.clean(b, name, {}, deps);
        check(r.format === c.fmt, `${name}: detected as ${c.fmt}`, r.format);
        const miss = c.must.filter(l => !labels(r).includes(l));
        check(!miss.length, `${name}: lists ${c.must.join(', ') || 'nothing'}`, 'missing ' + miss.join(', ') + ' / got ' + labels(r).join(', '));
        const leak = c.secrets.filter(s => has(r.output, s));
        check(!leak.length, `${name}: none of ${c.secrets.join(', ') || '-'} left anywhere in the bytes`, 'still there: ' + leak.join(', '));
        check(r.left.length === 0, `${name}: re-reading the clean copy finds nothing`, JSON.stringify(r.left));
        const same = M.sameImage(b, r.output, r.format);
        if (same !== null) check(same, `${name}: image / audio data byte-identical`);
        if (c.fmt === 'ogg') check(oggPagesOk(r.output) === '', `${name}: every Ogg page has a valid CRC and sequence`, oggPagesOk(r.output));
        if (/^(mp4|mov|m4a|avif)$/.test(c.fmt)) check(r.output.length === b.length, `${name}: same length (boxes blanked in place, no offsets moved)`);
        if (name === 'plain.jpg') check(!r.changed && r.removed.length === 0, 'plain.jpg: a file with no metadata comes back byte-identical');
    }
    const a = await M.clean(fx('a.jpg'), 'a.jpg', {}, deps);
    check(value(a, 'GPS position') === '52.52018° N, 13.41000° E', 'a.jpg: GPS read as 52.52018° N, 13.41000° E (Pillow wrote 52 31 12.63, 13 24 36)', value(a, 'GPS position'));
    check(a.kept.some(k => k.label === 'Orientation' && /90° clockwise/.test(k.value)) && !labels(a).includes('Orientation'), 'a.jpg: orientation 6 kept so the photo stays upright, and not listed as removed');
    const a2 = await M.clean(fx('a.jpg'), 'a.jpg', {keepOrientation: false}, deps);
    const after = await M.inspect(a2.output, 'a.jpg', deps);
    check(after.fields.length === 0 && !a2.kept.length, 'keepOrientation off: nothing at all left');
    const mp3 = await M.clean(fx('f.mp3'), 'f.mp3', {}, deps);
    check(mp3.output[0] === 0xFF && (mp3.output[1] & 0xE0) === 0xE0, 'MP3: clean copy starts on an MPEG frame');
    check(M.cleanName('IMG 2041.final.JPG') === 'clean_IMG 2041.final.JPG', 'download name keeps the old "clean_" prefix and the extension');
}

// ======================================================================
if (suites.includes('built')) {
    section('built - structures from the specs');
    // PNG with every kind of text chunk, tIME, eXIf, a private chunk, and the colour chunks that must stay
    const sRGB = pngChunk('sRGB', [0]), gAMA = pngChunk('gAMA', be32(45455)), pHYs = pngChunk('pHYs', [...be32(2835), ...be32(2835), 1]);
    const iccp = pngChunk('iCCP', [...asc('Display P3\0'), 0, ...zlib.deflateSync(Buffer.alloc(200))]);
    const p = png([gAMA, sRGB, iccp, pHYs, pngChunk('tEXt', asc('Author\0Jane Doe')), pngChunk('zTXt', [...asc('Comment\0'), 0, ...zlib.deflateSync(Buffer.from('zipped secret'))]),
        pngChunk('iTXt', [...asc('Description\0'), 0, 0, ...asc('de\0Beschreibung\0'), ...Buffer.from('Grüße aus Köln')]), pngChunk('tIME', [7, 234, 3, 14, 9, 41, 7]),
        pngChunk('eXIf', [...gpsExif(48.8584, 2.2945)]), pngChunk('prVt', asc('private'))]);
    const rp = await M.clean(p, 'x.png', {}, deps);
    check(['Author', 'Comment', 'Description', 'Last modified', 'GPS position', 'Private block “prVt”'].every(l => labels(rp).includes(l)), 'PNG: text, zTXt, iTXt, tIME, eXIf and private chunks found', labels(rp).join(', '));
    check(value(rp, 'Last modified') === '2026-03-14 09:41:07 UTC', 'PNG tIME read as 2026-03-14 09:41:07 UTC', value(rp, 'Last modified'));
    const chunkNames = b => { const o = []; let q = 8; while (q < b.length) { const n = (b[q] << 24 | b[q + 1] << 16 | b[q + 2] << 8 | b[q + 3]) >>> 0; o.push(Buffer.from(b.subarray(q + 4, q + 8)).toString('latin1')); q += 12 + n; } return o.join(' '); };
    check(chunkNames(rp.output) === 'IHDR gAMA sRGB iCCP pHYs IDAT IEND', 'PNG: keeps IHDR gAMA sRGB iCCP pHYs IDAT IEND, in order', chunkNames(rp.output));
    check(rp.kept.some(k => k.value === 'Display P3'), 'PNG: says it kept the Display P3 colour profile');
    const rp2 = await M.clean(p, 'x.png', {keepColor: false}, deps);
    check(!chunkNames(rp2.output).includes('iCCP'), 'PNG keepColor off: iCCP removed');
    // every chunk CRC in the output is right
    let q = 8, crcOk = true; const o = rp.output;
    while (q < o.length) { const n = (o[q] << 24 | o[q + 1] << 16 | o[q + 2] << 8 | o[q + 3]) >>> 0; const want = (o[q + 8 + n] << 24 | o[q + 9 + n] << 16 | o[q + 10 + n] << 8 | o[q + 11 + n]) >>> 0; if (crc32(o.subarray(q + 4, q + 8 + n)) !== want) crcOk = false; q += 12 + n; }
    check(crcOk, 'PNG: every chunk CRC valid');
    // APNG: animation chunks survive
    const apng = png([pngChunk('acTL', [...be32(1), ...be32(0)]), pngChunk('fcTL', [...be32(0), ...be32(4), ...be32(3), ...be32(0), ...be32(0), 0, 1, 0, 100, 0, 0]), pngChunk('tEXt', asc('Software\0x'))]);
    const ra = await M.clean(apng, 'a.png', {}, deps);
    check(chunkNames(ra.output) === 'IHDR acTL fcTL IDAT IEND', 'APNG: acTL and fcTL kept', chunkNames(ra.output));
    const rot = png([pngChunk('eXIf', [...M.buildTiff([{ifd: 'ifd0', tag: 0x0112, type: 3, value: [6]}, {ifd: 'ifd0', tag: 0x013B, type: 2, value: 'Jane'}])])]);
    const rr = await M.clean(rot, 'r.png', {}, deps);
    check(chunkNames(rr.output) === 'IHDR eXIf IDAT IEND' && !has(rr.output, 'Jane'), 'PNG: rotated image keeps a one-tag eXIf before IDAT, artist gone', chunkNames(rr.output));

    // JPEG: motion photo / trailer, APP segments, Adobe APP14 kept, ICC kept
    const base = fx('plain.jpg'), eoi = base.length;
    const icc = u8(0xFF, 0xE2, 0, 16 + 2, ...asc('ICC_PROFILE\0'), 1, 1, 0, 0, 0, 0);
    const adobe = u8(0xFF, 0xEE, 0, 14, ...asc('Adobe'), 0, 100, 0, 0, 0, 0, 1);
    const app12 = u8(0xFF, 0xEC, 0, 10, ...asc('Ducky\0'), 1, 2);
    const withExif = M.addExif(base, [{ifd: 'ifd0', tag: 0x013B, type: 2, value: 'Jane Doe'}]);
    const j = u8(...withExif.subarray(0, 20), ...icc, ...adobe, ...app12, ...withExif.subarray(20), ...asc('\0\0\0\x18ftypmp42'), ...new Array(500).fill(7));
    const rj = await M.clean(j, 'mp.jpg', {}, deps);
    check(labels(rj).includes('Embedded video (motion photo)'), 'JPEG: video appended after the image is found', labels(rj).join(', '));
    check(rj.output.length < j.length - 500 && rj.output[rj.output.length - 2] === 0xFF && rj.output[rj.output.length - 1] === 0xD9, 'JPEG: clean copy ends at the end-of-image marker');
    check(has(rj.output, 'Adobe') && has(rj.output, 'ICC_PROFILE') && !has(rj.output, 'Ducky') && !has(rj.output, 'Jane'), 'JPEG: keeps Adobe colour transform and ICC, drops APP12 and Exif');
    check(M.sameImage(j, rj.output, 'jpeg'), 'JPEG: scan data byte-identical');
    // progressive-style: several scans with restart markers and stuffed bytes, scanned correctly
    const w = M._.walkJpeg(fx('a.jpg'));
    check(w.eoi === fx('a.jpg').length, 'JPEG walker reaches EOI exactly at the end of a real file');

    // WebP: VP8X flags rewritten
    const rw = await M.clean(fx('d.webp'), 'd.webp', {keepOrientation: false}, deps);
    const flags = rw.output[20], riff = rw.output[4] | rw.output[5] << 8 | rw.output[6] << 16 | rw.output[7] << 24;
    check((flags & 0x0C) === 0, 'WebP: EXIF and XMP flags cleared in VP8X', flags.toString(2));
    check(riff === rw.output.length - 8, 'WebP: RIFF size matches the new length');

    // MP3 with APEv2 + Lyrics3 + ID3v1 at the end and two ID3v2 tags at the front
    const audio = M._.mp3Bounds(fx('f.mp3')), frames = fx('f.mp3').subarray(audio.s, audio.e);
    const id3 = (frames2) => { const body = frames2; const n = body.length; return [...asc('ID3'), 3, 0, 0, (n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127, ...body]; };
    const tit2 = [...asc('TIT2'), ...be32(9), 0, 0, 3, ...asc('Bad Song')];
    const ape = (() => { const item = [...le32(8), ...le32(0), ...asc('Artist\0'), ...asc('Jane Doe')]; const foot = (flags) => [...asc('APETAGEX'), ...le32(2000), ...le32(item.length + 32), ...le32(1), ...le32(flags), 0, 0, 0, 0, 0, 0, 0, 0]; return [...foot(0xA0000000), ...item, ...foot(0x80000000)]; })();
    const lyr = [...asc('LYRICSBEGIN'), ...asc('IND00003110'), ...asc('000022LYRICS200')];
    const v1 = [...asc('TAG'), ...asc('Bad Song'.padEnd(30, '\0')), ...asc('Jane Doe'.padEnd(30, '\0')), ...new Array(64).fill(0), 12];
    const m = u8(id3(tit2), id3(tit2), ...frames, ape, lyr, v1);
    const rm = await M.clean(m, 'x.mp3', {}, deps);
    check(Buffer.from(rm.output).equals(Buffer.from(frames)), 'MP3: two ID3v2, APEv2, Lyrics3 and ID3v1 all stripped, audio frames exactly what remains');
    check(labels(rm).includes('Lyrics') && rm.removed.some(f => f.where === 'APEv2' && f.value === 'Jane Doe'), 'MP3: APEv2 artist and Lyrics3 listed', labels(rm).join(', '));

    // Ogg: a comment packet bigger than one page (cover art) forces re-pagination
    const op = fx('f.opus');
    const pages = M._.oggPages(op);
    check(pages.length > 2, 'Opus fixture has several pages');
    const big = 'METADATA_BLOCK_PICTURE=' + 'A'.repeat(70000);
    const tags = u8(...asc('OpusTags'), ...le32(5), ...asc('Lavf!'), ...le32(2), ...le32(big.length), ...asc(big), ...le32(13), ...asc('ARTIST=Jane D'));
    const pagesFor = (pk, seq0, serial) => { const out = []; let i = 0, seq = seq0, cont = 0; const segs = []; let p0 = 0; while (pk.length - p0 >= 255) { segs.push(255); p0 += 255; } segs.push(pk.length - p0);
        let off = 0; while (i < segs.length) { const take = segs.slice(i, i + 255), len = take.reduce((s, x) => s + x, 0);
            const h = u8(...asc('OggS'), 0, cont, 0, 0, 0, 0, 0, 0, 0, 0, ...le32(serial), ...le32(seq++), 0, 0, 0, 0, take.length, ...take), pg = u8(...h, ...pk.subarray(off, off + len));
            const c = oggCrc(pg); pg.set(le32(c), 22); out.push(pg); cont = take[take.length - 1] === 255 ? 1 : 0; off += len; i += take.length; } return out; };
    const serial = op[14] | op[15] << 8 | op[16] << 16 | op[17] << 24;
    const tagPages = pagesFor(tags, 1, serial);
    let rest = []; let seq = 1 + tagPages.length;
    for (let k = 2; k < pages.length; k++) { const pg = new Uint8Array(op.subarray(pages[k].s, pages[k].e)); pg.set(le32(seq++), 18); pg.set([0, 0, 0, 0], 22); pg.set(le32(oggCrc(pg)), 22); rest.push(pg); }
    const bigOgg = u8(...op.subarray(pages[0].s, pages[0].e), ...tagPages.map(x => [...x]).flat(), ...rest.map(x => [...x]).flat());
    check(oggPagesOk(bigOgg) === '', 'built Ogg with 70 KB cover art is itself valid', oggPagesOk(bigOgg));
    const ro = await M.clean(bigOgg, 'big.opus', {}, deps);
    check(oggPagesOk(ro.output) === '' && !has(ro.output, 'Jane') && ro.output.length < 2000, 'Ogg: 70 KB cover art removed, pages renumbered with valid CRCs', oggPagesOk(ro.output) + ' len ' + ro.output.length);
    check(labels(ro).includes('Cover picture') && labels(ro).includes('Artist'), 'Ogg: cover art and artist listed');
    const audioOf = b => { const pg = M._.oggPages(b); return Buffer.concat(pg.slice(2).map(x => Buffer.from(b.subarray(x.d, x.e)))); };
    check(audioOf(ro.output).equals(audioOf(op)), 'Ogg: audio packets byte-identical');

    // FLAC: last-block flag on the final kept block
    const rf = await M.clean(fx('f.flac'), 'f.flac', {}, deps);
    let pp = 4, lastOk = false, types = [];
    while (pp < rf.output.length) { const last = rf.output[pp] & 0x80; types.push(rf.output[pp] & 127); const len = rf.output[pp + 1] << 16 | rf.output[pp + 2] << 8 | rf.output[pp + 3]; pp += 4 + len; if (last) { lastOk = true; break; } }
    check(lastOk && !types.includes(4) && !types.includes(1), 'FLAC: comments and padding gone, last block flagged', types.join(','));

    // HEIF as an iPhone writes it: iinf v0, iloc v1; here the Exif item lives in 'idat' (construction method 1)
    // and the XMP item in 'mdat' (method 0), so both ways of locating an item are exercised.
    const box = (type, ...body) => { const b = body.flat(); return [...be32(8 + b.length), ...asc(type), ...b]; };
    const full = (type, v, ...body) => box(type, v, 0, 0, 0, ...body);
    const exifItem = [0, 0, 0, 6, ...asc('Exif\0\0'), ...gpsExif(35.6586, 139.7454)];
    const xmpItem = asc('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>Taro Yamada</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>');
    const hevc = new Array(40).fill(0x5A);
    const infe = (id, type, ct) => full('infe', 2, (id >> 8) & 255, id & 255, 0, 0, ...asc(type), 0, ...(ct ? asc(ct + '\0') : []));
    const build = (mdatStart) => {
        const iloc = full('iloc', 1, 0x44, 0x00, 0, 3,
            0, 1, 0, 0, 0, 0, 0, 1, ...be32(mdatStart), ...be32(hevc.length),
            0, 2, 0, 1, 0, 0, 0, 1, ...be32(0), ...be32(exifItem.length),
            0, 3, 0, 0, 0, 0, 0, 1, ...be32(mdatStart + hevc.length), ...be32(xmpItem.length));
        const meta = full('meta', 0, full('hdlr', 0, 0, 0, 0, 0, ...asc('pict'), ...new Array(12).fill(0), 0), full('pitm', 0, 0, 1),
            full('iinf', 0, 0, 3, infe(1, 'hvc1'), infe(2, 'Exif'), infe(3, 'mime', 'application/rdf+xml')), iloc, box('idat', exifItem));
        return [...box('ftyp', ...asc('heic'), 0, 0, 0, 0, ...asc('mif1heic')), ...meta];
    };
    const head0 = build(0), heif = u8(build(head0.length + 8), box('mdat', hevc, xmpItem));
    const rh = await M.clean(heif, 'IMG_0001.HEIC', {}, deps);
    check(rh.format === 'heic' && value(rh, 'GPS position') === '35.65860° N, 139.74540° E' && value(rh, 'Creator') === 'Taro Yamada', 'HEIC: Exif in idat and XMP in mdat both found', labels(rh).join(', ') + ' / ' + value(rh, 'GPS position'));
    check(rh.output.length === heif.length && !has(rh.output, 'Taro') && !has(rh.output, 'iPhone') && rh.left.length === 0, 'HEIC: both overwritten in place, same length, nothing left');
    check(Buffer.from(rh.output).includes(Buffer.from(hevc)), 'HEIC: image data untouched');

    // zip for "download all"
    const z = M.zip([{name: 'clean_a.jpg', data: u8(1, 2, 3)}, {name: 'clean_a.jpg', data: u8(4)}, {name: 'Grüße.png', data: u8(5, 6)}]);
    const dir = mkdtempSync(join(tmpdir(), 'mcz-')); writeFileSync(join(dir, 'x.zip'), z);
    try {
        const listing = execFileSync('python3', ['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print("|".join(i.filename for i in z.infolist()))', join(dir, 'x.zip')]).toString().trim().split('\n');
        check(listing[0] === 'None' && listing[1] === 'clean_a.jpg|clean_a (2).jpg|Grüße.png', 'zip: valid, CRCs right, duplicate names numbered, UTF-8 names', listing.join(' / '));
    } catch (e) { skip('zip check needs python3'); }
    rmSync(dir, {recursive: true, force: true});
}

// ======================================================================
if (suites.includes('oracle')) {
    section('oracle - exiftool and ffmpeg judge the clean copies');
    const dir = mkdtempSync(join(tmpdir(), 'mco-'));
    const hasET = tool('exiftool'), hasFF = tool('ffmpeg');
    if (!hasET) skip('exiftool not installed: no independent metadata check');
    if (!hasFF) skip('ffmpeg not installed: no decoded-output comparison');
    for (const name of Object.keys(FX)) {
        // exiftool judges the strictest clean (orientation dropped too); ffmpeg the default one, since it applies orientation
        const b = fx(name), r = await M.clean(b, name, {keepOrientation: false}, deps), rd = await M.clean(b, name, {}, deps);
        const fin = join(dir, 'in_' + name), fout = join(dir, 'out_' + name), fdef = join(dir, 'def_' + name);
        writeFileSync(fin, b); writeFileSync(fout, r.output); writeFileSync(fdef, rd.output);
        if (hasET) {
            const tags = JSON.parse(execFileSync('exiftool', ['-j', '-a', '-G1', fout]).toString())[0];
            const bad = Object.keys(tags).filter(k => /^(IFD0|ExifIFD|GPS|XMP-|IPTC|ID3|Vorbis:(?!Vendor|VorbisVersion|AudioChannels|SampleRate|NominalBitrate|MaxBitrate|MinBitrate)|APE|PNG:(Author|Comment|Software|Description)|RIFF:(Artist|Title|Comment|Software)|ItemList|UserData|Keys|Lyrics3|PDF:(Author|Title|Creator|Producer))/.test(k))
                .filter(k => !(k === 'Vorbis:Vendor' && !tags[k]));
            check(!bad.length, `exiftool finds no metadata in clean ${name}`, bad.map(k => k + '=' + tags[k]).join(', '));
        }
        if (hasFF && !/\.(pdf)$/.test(name)) {
            const md5 = f => { try { return execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-map', '0', '-f', 'md5', '-'], {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim(); } catch (e) { return 'error'; } };
            if (name.endsWith('.mp3')) {
                // ffmpeg decodes a trailing ID3v1 tag as a few ms of noise past the encoder's own end-of-stream
                // marker, so the clean file is expected to be the original's samples minus that tail
                const pcm = f => execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 's16le', '-'], {maxBuffer: 1 << 26});
                const a = pcm(fin), c = pcm(fdef);
                check(c.length > a.length * 0.9 && a.subarray(0, c.length).equals(c), `ffmpeg: clean ${name} decodes to the original samples (${c.length} of ${a.length} bytes; the rest was the ID3v1 tag)`);
                continue;
            }
            const a = md5(fin), c = md5(fdef);
            check(a === c && a !== 'error', `ffmpeg decodes clean ${name} to the same picture / sound`, a + ' vs ' + c);
        }
    }
    rmSync(dir, {recursive: true, force: true});
}

// ======================================================================
if (suites.includes('pdf')) {
    section('pdf - document info, XMP, earlier revisions, photos inside, comment authors');
    if (!PDFLib) skip('pdf-lib not installed (npm i --no-save pdf-lib@1.17.1)');
    else {
        const {PDFDocument, PDFName, PDFString} = PDFLib;
        const doc = await PDFDocument.create({updateMetadata: false});
        const page = doc.addPage([300, 300]);
        doc.setTitle('Secret plan'); doc.setAuthor('Jane Doe'); doc.setKeywords(['budget', 'layoffs']); doc.setCreator('Microsoft Word'); doc.setProducer('macOS Quartz');
        doc.setCreationDate(new Date('2026-03-14T09:41:07Z'));
        doc.getInfoDict().set(PDFName.of('Company'), PDFString.of('ACME Corp'));
        const xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><dc:creator><rdf:Seq><rdf:li>Jane Doe</rdf:li></rdf:Seq></dc:creator><xmp:CreatorTool>Word for Mac</xmp:CreatorTool></rdf:Description></rdf:RDF></x:xmpmeta>';
        const xs = doc.context.stream(xmp, {Type: 'Metadata', Subtype: 'XML'});
        doc.catalog.set(PDFName.of('Metadata'), doc.context.register(xs));
        const jpg = new Uint8Array(M.addExif(fx('plain.jpg'), [{ifd: 'ifd0', tag: 0x0110, type: 2, value: 'iPhone 15'}, {ifd: 'gps', tag: 1, type: 2, value: 'N'}, {ifd: 'gps', tag: 2, type: 5, value: [40, 41, 21]}, {ifd: 'gps', tag: 3, type: 2, value: 'W'}, {ifd: 'gps', tag: 4, type: 5, value: [74, 2, 40]}]));
        const img = await doc.embedJpg(jpg);
        page.drawImage(img, {x: 10, y: 10, width: 64, height: 32});
        const annot = doc.context.obj({Type: 'Annot', Subtype: 'Text', Rect: [20, 20, 40, 40], Contents: PDFString.of('Looks good'), T: PDFString.of('Jane Doe (Legal)'), M: PDFString.of('D:20260314094107Z')});
        page.node.set(PDFName.of('Annots'), doc.context.obj([doc.context.register(annot)]));
        let bytes = await doc.save({useObjectStreams: false});
        // an incremental update, as Acrobat or exiftool would write it: new title, old one left in the file
        const s = Buffer.from(bytes).toString('latin1'), startxref = +/startxref\s+(\d+)/.exec(s.slice(-64))[1];
        const size = +/\/Size (\d+)/.exec(s)[1], root = /\/Root (\d+ 0 R)/.exec(s)[1];
        const objOff = bytes.length + 1;
        const upd = `\n${size} 0 obj\n<< /Title (Secret plan v2) /Author (Jane Doe) /ModDate (D:20260315100000Z) >>\nendobj\n`;
        const xrefOff = bytes.length + upd.length;
        const tail = `xref\n${size} 1\n${String(objOff).padStart(10, '0')} 00000 n \ntrailer\n<< /Size ${size + 1} /Root ${root} /Info ${size} 0 R /Prev ${startxref} /ID [<0123456789ABCDEF0123456789ABCDEF><0123456789ABCDEF0123456789ABCDEF>] >>\nstartxref\n${xrefOff}\n%%EOF\n`;
        bytes = u8(...bytes, ...asc(upd + tail));
        const check0 = await PDFDocument.load(bytes, {updateMetadata: false});
        check(check0.getTitle() === 'Secret plan v2', 'built PDF with an incremental update reads as "Secret plan v2"');
        const r = await M.clean(bytes, 'plan.pdf', {}, deps);
        // the update's info dictionary replaces the first one; Keywords, Producer, Company now live only in the old revision
        for (const l of ['Title', 'Author', 'Date modified', 'Created with', 'Creator', 'Earlier saved versions still inside the file', 'Comment authors and dates', 'Photo metadata inside embedded images', 'Document ID'])
            check(labels(r).includes(l), `PDF: lists ${l}`, labels(r).join(', '));
        check(value(r, 'Title') === 'Secret plan v2', 'PDF: title shown is the file\'s own, not one pdf-lib made up', value(r, 'Title'));
        check(/with GPS/.test(value(r, 'Photo metadata inside embedded images')), 'PDF: notices the GPS position of the photo inside');
        const leaks = ['Secret plan', 'Jane', 'ACME', 'Word', 'Quartz', 'iPhone', 'layoffs', 'pdf-lib', '0123456789ABCDEF'].filter(x => has(r.output, x));
        check(!leaks.length, 'PDF: no trace of title, author, company, tools, photo camera, old revision or ID in the bytes', 'found: ' + leaks.join(', '));
        check(r.left.length === 0, 'PDF: re-reading the clean copy finds nothing', JSON.stringify(r.left));
        const back = await PDFDocument.load(r.output);
        check(back.getPageCount() === 1, 'PDF: still opens, still one page');
        check(has(r.output, 'Looks good'), 'PDF: the comment text itself is kept (it is content), only its author and date go');
        // encrypted
        const enc = u8(...asc('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R /Encrypt << /Filter /Standard /V 2 >> >>\n%%EOF'));
        try { await M.clean(enc, 'locked.pdf', {}, deps); fail('encrypted PDF should be refused'); }
        catch (e) { check(e.userFacing && /password|encrypt/i.test(e.message), 'encrypted PDF: refused with a plain explanation', e.message); }
        // signed
        const sigDoc = await PDFDocument.create(); sigDoc.addPage(); sigDoc.setAuthor('X');
        sigDoc.context.register(sigDoc.context.obj({Type: 'Sig', ByteRange: [0, 1, 2, 3]}));
        const rs = await M.clean(await sigDoc.save(), 's.pdf', {}, deps);
        check(rs.notes.some(n => /signature/i.test(n)), 'signed PDF: warns that the signature will break');
        // a PDF with nothing to remove is returned untouched
        const bare = await PDFDocument.create({updateMetadata: false}); bare.addPage();
        const bb = await bare.save(); const rb = await M.clean(bb, 'b.pdf', {}, deps);
        check(!rb.changed || rb.removed.every(f => f.label === 'Document ID'), 'PDF with no metadata: nothing removed but the ID', labels(rb).join(','));
    }
}

// ======================================================================
if (suites.includes('broken')) {
    section('broken - empty, foreign, cut off, huge');
    const expectErr = async (b, name, re, what) => {
        try { await M.clean(b, name, {}, deps); fail(what + ' should be refused'); }
        catch (e) { check(e.userFacing && re.test(e.message), what, e.message); }
    };
    await expectErr(new Uint8Array(0), 'x.jpg', /empty/, 'empty file: "empty (0 bytes)"');
    await expectErr(u8(...asc('PK\x03\x04'), ...new Array(40).fill(0)), 'report.docx', /Word files are not supported.*JPEG/, '.docx: named, and the supported list given');
    await expectErr(u8(...asc('hello world')), 'notes.txt', /Plain text/, '.txt: explains text has no hidden fields');
    await expectErr(u8(...asc('BM'), ...new Array(60).fill(0)), 'x.bmp', /already clean/, '.bmp: already clean');
    await expectErr(new Uint8Array(1000).map((_, i) => (i * 7919) & 255), 'noise.bin', /not supported/, 'random bytes: not supported');
    // a PNG named .jpg is cleaned as what it is, and says so
    const p = png([pngChunk('tEXt', asc('Author\0Jane'))]);
    const r = await M.clean(p, 'holiday.jpg', {}, deps);
    check(r.format === 'png' && r.notes.some(n => /really a PNG/.test(n)) && !has(r.output, 'Jane'), 'PNG named .jpg: cleaned as PNG, with a note');
    // cut-off files: every prefix either cleans or is refused in plain words; nothing hangs or crashes
    for (const name of ['a.jpg', 'c.png', 'd.webp', 'l.gif', 'h.avif', 'f.mp3', 'f.flac', 'f.wav', 'f.opus', 'v.mp4']) {
        const b = fx(name); let crashes = [], ok = 0;
        for (const cut of [1, 5, 13, 40, 100, 300, Math.floor(b.length / 3), Math.floor(b.length / 2), b.length - 7, b.length - 1]) {
            if (cut >= b.length) continue;
            try { const rr = await M.clean(b.subarray(0, cut), name, {}, deps); ok++; if (rr.output.length > cut + 64) crashes.push(cut + ': grew'); }
            catch (e) { if (!e.userFacing) crashes.push(cut + ': ' + e.message); }
        }
        check(!crashes.length, `${name} cut at 10 points: cleaned (${ok}) or refused in words, never a crash`, crashes.join('; '));
    }
    // flipped bytes in the middle of the metadata
    let crashes = 0;
    for (let seed = 1; seed <= 200; seed++) {
        const name = Object.keys(FX)[seed % Object.keys(FX).length];
        if (/pdf/.test(name)) continue;
        const b = new Uint8Array(fx(name)); let s = seed;
        for (let k = 0; k < 4; k++) { s = (s * 1103515245 + 12345) & 0x7fffffff; b[s % Math.min(b.length, 600)] ^= 0xFF; }
        try { await M.clean(b, name, {}, deps); } catch (e) { if (!e.userFacing) { crashes++; if (crashes < 4) console.log('     ', name, seed, e.message); } }
    }
    check(crashes === 0, '200 files with 4 random bytes flipped in the header area: no unexplained crash', crashes + ' crashes');
    // huge: a 40 MB JPEG (big scan) cleans quickly and keeps its scan intact
    const base = fx('a.jpg'), w = M._.walkJpeg(base), sos = w.segs.find(s => s.m === 0xDA);
    const scan = new Uint8Array(40 * 1048576); for (let i = 0; i < scan.length; i++) scan[i] = (i * 31) & 0xFE;
    const huge = u8(...base.subarray(0, sos.e)); const big = new Uint8Array(huge.length + scan.length + 2);
    big.set(huge); big.set(scan, huge.length); big.set([0xFF, 0xD9], huge.length + scan.length);
    const t0 = Date.now(), rh = await M.clean(big, 'big.jpg', {}, deps), ms = Date.now() - t0;
    check(rh.output.length < big.length && rh.output.length > scan.length && M.sameImage(big, rh.output, 'jpeg'), '40 MB JPEG cleaned, scan data intact');
    check(ms < 4000, `40 MB JPEG cleaned in ${ms} ms (under 4 s)`);
}

// ======================================================================
if (suites.includes('page')) {
    section('page - promises the page makes in its markup');
    check(/<title>[^<]*Metadata[^<]*<\/title>/i.test(HTML), 'title says Metadata');
    check(!/https?:\/\/(?!cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|www\.gptgames\.dev|gptgames\.dev|fonts\.googleapis\.com|fonts\.gstatic\.com)[a-z]/i.test(HTML.replace(/xmlns[^"]*"[^"]*"|ns\.adobe\.com[^'"]*|purl\.org[^'"]*|www\.w3\.org[^'"]*/g, '')), 'no requests to any other host');
    check(!/fetch\(|XMLHttpRequest|sendBeacon/.test(coreSrc[1]), 'core never touches the network');
    check(/pdf-lib@1\.17\.1|pdf-lib\/1\.17\.1/.test(HTML), 'loads pdf-lib 1.17.1, the version this suite tests');
}

console.log(`\n${passes} passed, ${failures} failed, ${skips} skipped`);
process.exit(failures ? 1 : 0);
