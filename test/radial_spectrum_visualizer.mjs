#!/usr/bin/env node
// Test suite for tools/radial_spectrum_visualizer.html.
//
// The page draws a spectrum, and a picture cannot tell anyone whether the bar at 1 kHz really
// is 1 kHz. So the arithmetic lives in the page's <script id="core"> block (no DOM) and this checks
// it against things that do not come from the page: the AnalyserNode definition in the Web Audio
// spec (Blackman window, alpha 0.16, |X[k]|/N, 20 log10), a direct DFT, Parseval, the RIFF/WAVE
// header layout, and - in the browser suite - Chromium's own AnalyserNode reading the same signal.
//
//   node test/radial_spectrum_visualizer.mjs                  # core suites (plain Node)
//   node test/radial_spectrum_visualizer.mjs browser          # Chromium suites (needs a server, see below)
//   node test/radial_spectrum_visualizer.mjs all              # both
//   VERBOSE=1 node test/radial_spectrum_visualizer.mjs        # print every passing check
//
// Core suites: fft, spectrum, bands, motion, settings, helpers, wav, webm, demo.
// browser: serves nothing itself - start `npx http-server -p 8099` first (or set RSV_URL). It checks
//   the core spectrum against Chromium's AnalyserNode, that a 1 kHz tone played through the page
//   lights the bars at 1 kHz, that the page makes no request carrying audio, and has no console errors.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'radial_spectrum_visualizer.html');
const CORE_SUITES = ['fft', 'spectrum', 'bands', 'motion', 'settings', 'helpers', 'wav', 'webm', 'demo'];
const args = process.argv.slice(2);
let suites = args.length ? args : CORE_SUITES;
if (suites.includes('all')) suites = [...CORE_SUITES, 'browser'];

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const near = (a, b, tol, what) => check(Math.abs(a - b) <= tol, what, `got ${a}, want ${b} ± ${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const coreSrc = (html.match(/<script id="core">([\s\S]*?)<\/script>/) || [])[1];
if (!coreSrc) { console.log('no <script id="core"> in the page'); process.exit(1); }
const sandbox = {Math, Float32Array, Float64Array, ArrayBuffer, DataView, Number, String, Object, Array, Error, JSON};
vm.createContext(sandbox);
vm.runInContext(coreSrc, sandbox);
const C = sandbox.RSV;

function dft(x) { // direct O(N^2) reference
    const N = x.length, re = new Float64Array(N), im = new Float64Array(N);
    for (let k = 0; k < N; k++) {
        let r = 0, i = 0;
        for (let n = 0; n < N; n++) { const a = -2 * Math.PI * k * n / N; r += x[n] * Math.cos(a); i += x[n] * Math.sin(a); }
        re[k] = r; im[k] = i;
    }
    return [re, im];
}
const sine = (N, f, sr, amp = 1, ph = 0) => Float64Array.from({length: N}, (_, n) => amp * Math.sin(2 * Math.PI * f * n / sr + ph));

if (suites.includes('fft')) {
    section('fft');
    const rnd = C.mulberry32(3);
    for (const N of [2, 8, 64, 256]) {
        const x = Float64Array.from({length: N}, () => rnd() * 2 - 1);
        const [rr, ri] = dft(x);
        const re = Float64Array.from(x), im = new Float64Array(N);
        C.fft(re, im);
        let err = 0;
        for (let k = 0; k < N; k++) err = Math.max(err, Math.abs(re[k] - rr[k]), Math.abs(im[k] - ri[k]));
        check(err < 1e-9, `fft matches a direct DFT, N=${N}`, `max error ${err}`);
        // Parseval: sum |x|^2 = (1/N) sum |X|^2
        let e1 = 0, e2 = 0;
        for (let n = 0; n < N; n++) { e1 += x[n] * x[n]; e2 += re[n] * re[n] + im[n] * im[n]; }
        near(e2 / N, e1, 1e-9 * N, `Parseval holds, N=${N}`);
    }
    let threw = false;
    try { C.fft(new Float64Array(6), new Float64Array(6)); } catch (e) { threw = true; }
    check(threw, 'fft refuses a size that is not a power of two');
}

if (suites.includes('spectrum')) {
    section('spectrum');
    const w = C.blackman(8);
    near(w[0], 0.42 - 0.5 + 0.08, 1e-12, 'Blackman w[0] = a0 - a1 + a2 = 0 (spec, alpha 0.16)');
    near(w[4], 0.42 + 0.5 + 0.08, 1e-12, 'Blackman w[N/2] = a0 + a1 + a2 = 1');
    const N = 4096, sr = 48000;
    // a full-scale sine centred on bin k: |X[k]|/N = A * a0 / 2 -> 20 log10(0.21) = -13.556 dB
    const k = 85, f = k * sr / N;
    const db = C.spectrumDb(sine(N, f, sr), 0, N);
    near(db[k], 20 * Math.log10(0.21), 0.01, 'bin-centred full-scale sine reads 20·log10(0.42/2) dB');
    near(db[k + 1], 20 * Math.log10(0.125), 0.01, 'its neighbour reads 20·log10(a1/4) (Blackman main lobe)');
    check(db[k + 5] < -100, 'and five bins away it is below -100 dB (side lobes)', `got ${db[k + 5]}`);
    const half = C.spectrumDb(sine(N, f, sr, 0.5), 0, N);
    near(half[k] - db[k], -6.0206, 0.01, 'half amplitude reads 6.02 dB lower');
    const sil = C.spectrumDb(new Float64Array(N), 0, N);
    check(sil.every(v => v === -Infinity), 'silence reads -Infinity in every bin');
    const short = C.spectrumDb(new Float64Array(10).fill(0.5), 0, 64);
    check(short.length === 32 && short.every(Number.isFinite), 'a buffer shorter than the window counts the rest as silence');
}

if (suites.includes('bands')) {
    section('bands');
    const e = C.logBands(64, 30, 16000);
    near(e[0], 30, 1e-9, 'first edge is 30 Hz');
    near(e[64], 16000, 1e-9, 'last edge is 16 kHz');
    const r = e[1] / e[0];
    let constant = true;
    for (let i = 1; i < 64; i++) if (Math.abs(e[i + 1] / e[i] - r) > 1e-9) constant = false;
    check(constant, 'band edges share one ratio (log scale)');
    const N = 4096, sr = 48000;
    for (const f of [60, 250, 1000, 4000, 12000]) {
        const db = C.spectrumDb(sine(N, f, sr, 0.5), 0, N);
        const lv = C.bandLevels(db, sr, e);
        let arg = 0;
        for (let i = 1; i < 64; i++) if (lv[i] > lv[arg]) arg = i;
        check(e[arg] <= f * 1.06 && e[arg + 1] >= f / 1.06, `a ${f} Hz tone peaks in the band that contains it`,
            `band ${arg}: ${e[arg].toFixed(1)}–${e[arg + 1].toFixed(1)} Hz`);
        if (f >= 1000) near(lv[arg], db[Math.round(f * N / sr)], 3.2, `${f} Hz band reads the tone's level (peak per band)`);
    }
    // bass bands are narrower than a bin: interpolated, so the tone's neighbours fall off smoothly
    const db = C.spectrumDb(sine(N, 60, sr, 0.5), 0, N);
    const lv = C.bandLevels(db, sr, e);
    let steps = 0;
    for (let i = 1; i < 12; i++) if (lv[i] === lv[i - 1]) steps++;
    check(steps === 0, 'no two neighbouring bass bars copy the same bin (interpolated, not stepped)');
    // a 44.1 kHz context: the top band must stay in range
    const db44 = C.spectrumDb(sine(N, 15000, 44100, 0.5), 0, N);
    const lv44 = C.bandLevels(db44, 44100, e);
    check(Array.from(lv44).every(Number.isFinite), 'every band is finite at 44.1 kHz');
    const neg = C.bandLevels(new Float32Array(2048).fill(-Infinity), sr, e);
    check(Array.from(neg).every(v => v === -400), 'silence (-Infinity) reads as -400 dB, not NaN');
    const nan = C.bandLevels(new Float32Array(2048).fill(NaN), sr, e);
    check(Array.from(nan).every(v => v === -400), 'NaN bins read as silence');
    near(C.dbToLevel(-55, -85, -25), 0.5, 1e-12, 'dbToLevel: midpoint of the window is 0.5');
    check(C.dbToLevel(-90, -85, -25) === 0 && C.dbToLevel(-10, -85, -25) === 1, 'dbToLevel clamps to 0..1');
    check(C.dbToLevel(NaN, -85, -25) === 0 && C.dbToLevel(-Infinity, -85, -25) === 0, 'dbToLevel: NaN and -Infinity draw nothing');
    near(C.bassWeight(30, 2), 2, 0.01, 'bass boost 2× is full at 30 Hz');
    near(C.bassWeight(200, 2), 1.5, 1e-9, 'bass boost is half at 200 Hz');
    near(C.bassWeight(2000, 2), 1, 0.001, 'bass boost has no effect at 2 kHz');
    near(C.bassWeight(50, 1), 1, 0, 'bass boost 1 is flat');
    near(C.trebleLiftDb(8000, 3), 9, 1e-9, 'treble lift 3 dB/oct adds 9 dB three octaves above 1 kHz');
    check(C.trebleLiftDb(1000, 3) === 0 && C.trebleLiftDb(100, 3) === 0, 'treble lift leaves 1 kHz and below alone');
    check(C.trebleLiftDb(16000, 0) === 0, 'treble lift 0 is flat');
}

if (suites.includes('motion')) {
    section('motion');
    // the old setting was a per-frame factor at 60 fps; as a time constant, one 60 fps frame decays by s
    for (const s of [0.5, 0.8, 0.95]) {
        const tau = C.smoothingToTau(s);
        near(Math.exp(-(1 / 60) / tau), s, 1e-12, `smoothing ${s} decays by ${s} per 60 fps frame`);
    }
    check(C.smoothingToTau(0) === 0, 'smoothing 0 means no smoothing');
    check(Number.isFinite(C.smoothingToTau(1)), 'smoothing 1 stays finite');
    // frame-rate independence: 1 s at 30 fps and at 144 fps end at the same level
    const run = fps => { let v = 1; for (let i = 0; i < fps; i++) v = C.follow(v, 0, 1 / fps, 0.01, 0.2); return v; };
    near(run(30), run(144), 1e-9, 'a fall takes the same time at 30 and 144 fps');
    near(run(60), Math.exp(-5), 1e-9, 'after one time constant ×5 the level is e^-5');
    check(C.follow(0, 1, 0.05, 0.01, 1) > 0.99, 'a rise uses the fast constant');
    check(C.follow(0.3, 0.8, 0, 0.1, 0.1) === 0.3 || C.follow(0.3, 0.8, 0, 0.1, 0.1) === 0.8, 'dt 0 does not produce NaN');
    check(C.follow(0.3, 0.8, 0.1, 0, 0) === 0.8, 'no smoothing jumps straight to the target');
}

if (suites.includes('settings')) {
    section('settings');
    const d = C.sanitize(null);
    check(d.mode === 'bars' && d.colorMode === 'spectrum' && d.barWidth === 2.5 && d.sensitivity === 1.5 && d.smoothing === 0.8 && d.bassBoost === 1.5,
        'defaults keep the old page’s defaults (bars, spectrum, 2.5, 1.5, 0.8, 1.5)');
    check(C.sanitize({trebleTilt: 9}).trebleTilt === 6 && d.trebleTilt === 3, 'treble lift defaults to 3 and stops at 6 dB/oct');
    check(d.reflection === true && d.showWaveform === true && d.baseColor === '#1db954', 'mirror and waveform on, base colour #1DB954');
    check(C.sanitize({barWidth: 99}).barWidth === 10 && C.sanitize({barWidth: -4}).barWidth === 1, 'numbers are clamped to their range');
    check(C.sanitize({sensitivity: '2,5'}).sensitivity === 2.5, 'a decimal comma is read');
    check(C.sanitize({sensitivity: ' 2.0x '}).sensitivity === 2, 'stray spaces and a unit are read');
    check(C.sanitize({minDecibels: '−90 dB'}).minDecibels === -90, 'a typographic minus and "dB" are read');
    check(C.sanitize({barWidth: 'wide'}).barWidth === 2.5 && C.sanitize({barWidth: NaN}).barWidth === 2.5 && C.sanitize({barWidth: ''}).barWidth === 2.5,
        'nonsense falls back to the default');
    check(C.sanitize({mode: 'spiral', colorMode: 7, format: 'cinema'}).mode === 'bars', 'unknown choices fall back');
    check(C.sanitize({baseColor: '#ABC'}).baseColor === '#aabbcc', 'three-digit colours expand');
    check(C.sanitize({baseColor: 'red'}).baseColor === '#1db954', 'named colours are not taken');
    const eq = C.sanitize({minDecibels: -50, maxDecibels: -50});
    check(eq.maxDecibels - eq.minDecibels >= 10, 'min dB = max dB (which crashed the old page) is pulled apart', JSON.stringify(eq));
    const inv = C.sanitize({minDecibels: -30, maxDecibels: -60});
    check(inv.maxDecibels - inv.minDecibels >= 10 && inv.maxDecibels <= 0 && inv.minDecibels >= -120, 'an inverted dB window is repaired inside the ranges', JSON.stringify(inv));
    check(C.sanitize({title: 'x'.repeat(500)}).title.length === 80, 'titles are capped at 80 characters');
    check(C.sanitize({title: 'Ünïcødé – 曲 🎵'}).title === 'Ünïcødé – 曲 🎵', 'non-ASCII titles survive');
    check(C.sanitize({reflection: 'false'}).reflection === true, 'booleans must be booleans');
    check(C.sanitize({__proto__: {mode: 'particles'}}).mode === 'bars', 'inherited keys are not read as settings');
}

if (suites.includes('helpers')) {
    section('helpers');
    const T = [[0, '0:00'], [59.999, '0:59'], [60, '1:00'], [3599, '59:59'], [3600, '1:00:00'], [7384.5, '2:03:04'],
        [-3, '0:00'], [Infinity, '--:--'], [NaN, '--:--'], [undefined, '--:--']];
    for (const [s, want] of T) check(C.formatTime(s) === want, `formatTime(${s}) = ${want}`, `got ${C.formatTime(s)}`);
    const A = [['song.mp3', 'audio/mpeg', true], ['song.MP3', '', true], ['clip.mp4', 'video/mp4', true], ['voice.m4a', 'audio/x-m4a', true],
        ['take.flac', 'application/octet-stream', true], ['x.ogg', 'application/ogg', true], ['invoice.pdf', 'application/pdf', false],
        ['photo.jpg', 'image/jpeg', false], ['noextension', '', false], ['', '', false], ['track.opus', '', true], ['notes.txt', 'text/plain', false]];
    for (const [n, t, ok] of A) check(C.acceptFile(n, t).ok === ok, `acceptFile(${JSON.stringify(n)}, ${JSON.stringify(t)}) = ${ok}`);
    check(C.safeFileName('My:Song/"mix"?.mp3') === 'My Song mix', 'file names lose characters that no file system takes', C.safeFileName('My:Song/"mix"?.mp3'));
    check(C.safeFileName('.mp3') === 'audio' && C.safeFileName('') === 'audio', 'an empty name becomes "audio"');
    check(C.safeFileName('Café – 曲.wav') === 'Café – 曲', 'non-ASCII names are kept');
    check(C.pickMime(m => m.startsWith('video/webm')) === 'video/webm;codecs=vp9,opus', 'WebM with VP9/Opus when MP4 cannot be written');
    check(C.pickMime(() => true).startsWith('video/mp4'), 'MP4 first where the browser can write it');
    check(C.pickMime(() => { throw new Error('x'); }) === '', 'a throwing isTypeSupported gives the browser default');
    check(C.mimeExt('video/mp4;codecs=avc1') === 'mp4' && C.mimeExt('video/webm') === 'webm' && C.mimeExt('') === 'webm', 'extensions follow the container');
    const L = C.ringLayout(1080, 1920, false);
    check(L.cx === 540 && L.cy === 960 && Math.abs(L.R - 1080 * 0.46) < 1e-9, 'vertical frame: ring centred, sized by the width');
    const Lt = C.ringLayout(1080, 1080, true);
    check(Lt.titleY + 1080 * 0.025 < 1080 && Lt.titleY > Lt.cy + Lt.R, 'with a title, it sits below the ring and inside the frame', JSON.stringify(Lt));
    const m = C.bandAngles(4, true);
    check(m.length === 4 && m.every(p => p.length === 2 && Math.abs(p[0] + p[1]) < 1e-12), 'mirrored bands appear twice, reflected about the vertical');
    check(m[0][0] > 0 && m[0][0] < 0.5 && m[3][0] < Math.PI && m[3][0] > Math.PI - 0.5, 'mirrored: bass at the top, treble at the bottom');
    const f = C.bandAngles(8, false);
    check(f.length === 8 && f.every(p => p.length === 1) && f[7][0] < 2 * Math.PI, 'unmirrored bands go once round');
}

if (suites.includes('wav')) {
    section('wav');
    const L = new Float32Array([0, 1, -1, 0.5, 2, -2, NaN]), R = new Float32Array([0, -1, 1, -0.5, 0, 0, 0]);
    const buf = C.encodeWav([L, R], 44100), v = new DataView(buf);
    const str = (o, n) => String.fromCharCode(...new Uint8Array(buf, o, n));
    check(buf.byteLength === 44 + 7 * 2 * 2, 'size is 44-byte header + samples × channels × 2');
    check(str(0, 4) === 'RIFF' && str(8, 4) === 'WAVE' && str(12, 4) === 'fmt ' && str(36, 4) === 'data', 'RIFF, WAVE, fmt and data chunk ids');
    check(v.getUint32(4, true) === buf.byteLength - 8, 'RIFF size = file size - 8');
    check(v.getUint32(16, true) === 16 && v.getUint16(20, true) === 1, 'PCM fmt chunk (16 bytes, format 1)');
    check(v.getUint16(22, true) === 2 && v.getUint32(24, true) === 44100 && v.getUint32(28, true) === 44100 * 4 && v.getUint16(32, true) === 4 && v.getUint16(34, true) === 16,
        'channels 2, 44100 Hz, byte rate, block align 4, 16 bits');
    check(v.getUint32(40, true) === 7 * 4, 'data size');
    const s = i => v.getInt16(44 + i * 2, true);
    check(s(0) === 0 && s(2) === 32767 && s(3) === -32768 && s(4) === -32768 && s(5) === 32767, 'interleaved L R, full scale maps to ±32767/-32768');
    check(s(8) === 32767 && s(10) === -32768, 'samples beyond ±1 are clipped');
    check(s(12) === 0, 'NaN writes silence');
    check(s(6) === Math.round(0.5 * 32767), '0.5 rounds to 16384');
}

if (suites.includes('webm')) {
    section('webm');
    // a minimal live-stream WebM as MediaRecorder writes it: EBML header, Segment of unknown size,
    // Info with TimecodeScale and no Duration, then a Cluster
    const el = (id, body) => { const n = body.length; return [...id, 0x80 | n, ...body]; }; // sizes < 127
    const ebml = el([0x1A, 0x45, 0xDF, 0xA3], el([0x42, 0x82], [...'webm'].map(c => c.charCodeAt(0))));
    const info = el([0x15, 0x49, 0xA9, 0x66], [...el([0x2A, 0xD7, 0xB1], [0x0F, 0x42, 0x40]), ...el([0x4D, 0x80], [0x43, 0x68])]);
    const cluster = el([0x1F, 0x43, 0xB6, 0x75], el([0xE7], [0]));
    const live = Uint8Array.from([...ebml, 0x18, 0x53, 0x80, 0x67, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ...info, ...cluster]);
    const findDuration = b => { // scan for 0x44 0x89 0x88 and read the float64 after it
        for (let i = 0; i + 11 <= b.length; i++) if (b[i] === 0x44 && b[i + 1] === 0x89 && b[i + 2] === 0x88)
            return new DataView(b.buffer, b.byteOffset + i + 3, 8).getFloat64(0);
        return null;
    };
    const fixed = C.webmSetDuration(live, 12345.6);
    near(findDuration(fixed), 12345.6, 1e-9, 'Duration is written in ms (TimecodeScale 1 000 000)');
    check(fixed.length === live.length + 11 + 7, 'Info grows by the Duration element and an 8-byte size', `${live.length} -> ${fixed.length}`);
    const infoAt = ebml.length + 12;
    const iv = C.readVint(fixed, infoAt + 4);
    check(iv && iv.len === 8 && iv.v === info.length - 5 + 11, 'Info size is rewritten to cover the new element', JSON.stringify(iv));
    check(fixed.slice(-cluster.length).every((v, i) => v === cluster[i]), 'the clusters after Info are untouched');
    const again = C.webmSetDuration(fixed, 500);
    check(again.length === fixed.length && Math.abs(findDuration(again) - 500) < 1e-9, 'a second pass overwrites Duration in place');
    // a scale of 1 000 000 000 ns (1 s) stores seconds
    const info2 = el([0x15, 0x49, 0xA9, 0x66], el([0x2A, 0xD7, 0xB1], [0x3B, 0x9A, 0xCA, 0x00]));
    const live2 = Uint8Array.from([...ebml, 0x18, 0x53, 0x80, 0x67, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ...info2, ...cluster]);
    near(findDuration(C.webmSetDuration(live2, 2500)), 2.5, 1e-9, 'Duration follows the file’s TimecodeScale');
    // a sized Segment grows by the same amount
    const body = [...info, ...cluster];
    const sized = Uint8Array.from([...ebml, 0x18, 0x53, 0x80, 0x67, 0x40, body.length, ...body]);
    const fs = C.webmSetDuration(sized, 1000), sv = C.readVint(fs, ebml.length + 4);
    check(sv.len === 2 && sv.v === body.length + 18, 'a sized Segment has its size raised to match', JSON.stringify(sv));
    const junk = Uint8Array.from([1, 2, 3, 4, 5]);
    check(C.webmSetDuration(junk, 10) === junk, 'bytes that are not WebM come back unchanged');
    check(C.webmSetDuration(new Uint8Array(0), 10).length === 0, 'an empty file comes back unchanged');
}

if (suites.includes('demo')) {
    section('demo');
    const a = C.demoScore(7), b = C.demoScore(7), c = C.demoScore(8);
    check(JSON.stringify(a) === JSON.stringify(b), 'the demo score is the same every time for one seed');
    check(JSON.stringify(a) !== JSON.stringify(c), 'another seed gives another arpeggio');
    near(a.duration, 32, 1e-9, '16 bars at 120 bpm = 32 s');
    check(a.events.every(e => e.t >= 0 && e.t < a.duration), 'every event starts inside the track');
    check(a.events.every((e, i) => !i || a.events[i - 1].t <= e.t), 'events are in time order');
    const kicks = a.events.filter(e => e.type === 'kick');
    check(kicks.length > 40 && kicks.every(k => Math.abs(k.t / 0.5 - Math.round(k.t / 0.5)) < 1e-9), 'kicks fall on the beat');
    check(!kicks.some(k => k.t >= 24 && k.t < 28), 'bars 13-14 are a break without kicks');
    check(a.events.filter(e => e.type === 'bass').every(e => e.freq > 25 && e.freq < 120), 'the bass line stays in the bass');
}

if (suites.includes('browser')) {
    section('browser');
    await browserSuite();
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);

async function browserSuite() {
    let chromium;
    try { ({chromium} = await import('playwright')); } catch (e) {
        const {createRequire} = await import('module');
        ({chromium} = createRequire(import.meta.url)('playwright'));
    }
    const URL = process.env.RSV_URL || 'http://localhost:8099/tools/radial_spectrum_visualizer.html';
    const browser = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
    try {
        const page = await browser.newPage();
        const errors = [], requests = [];
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('pageerror', e => errors.push(String(e)));
        page.on('request', r => requests.push(r.url()));
        try { await page.goto(URL); } catch (e) { fail('page loads', `${URL}: ${e.message} - start npx http-server -p 8099`); return; }
        await page.evaluate(() => window.__rsv.demoReady());

        // 1. the core's spectrum against Chromium's AnalyserNode on the same signal
        const cmp = await page.evaluate(async () => {
            const sr = 48000, N = 4096, ctx = new OfflineAudioContext(1, sr, sr);
            const an = ctx.createAnalyser(); an.fftSize = N; an.smoothingTimeConstant = 0;
            const tones = [[440, 0.5], [3000, 0.2], [9000, 0.05]];
            for (const [f, a] of tones) {
                const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = a;
                o.connect(g); g.connect(an); o.start(0);
            }
            an.connect(ctx.destination);
            const frame = 128 * 200, out = new Float32Array(N / 2);
            ctx.suspend(frame / sr).then(() => { an.getFloatFrequencyData(out); ctx.resume(); });
            const buf = await ctx.startRendering();
            const x = buf.getChannelData(0).slice(frame - N, frame);
            const mine = RSV.spectrumDb(x, 0, N);
            let worst = 0, at = -1;
            for (let k = 1; k < N / 2; k++) {
                if (out[k] < -90) continue;
                const d = Math.abs(out[k] - mine[k]);
                if (d > worst) { worst = d; at = k; }
            }
            const e = RSV.logBands(64);
            const a = RSV.bandLevels(out, sr, e), b = RSV.bandLevels(mine, sr, e);
            let bandWorst = 0;
            for (let i = 0; i < 64; i++) if (a[i] > -90) bandWorst = Math.max(bandWorst, Math.abs(a[i] - b[i]));
            return {worst, at, bandWorst, peak: out[Math.round(440 * N / sr)]};
        });
        check(cmp.worst < 0.5, 'core spectrum = Chromium AnalyserNode within 0.5 dB in every bin above -90 dB', JSON.stringify(cmp));
        check(cmp.bandWorst < 0.5, 'band levels from either spectrum agree within 0.5 dB', JSON.stringify(cmp));

        await page.mouse.click(5, 5); // a gesture: the page starts its AudioContext on the first one
        // 2. a 1 kHz tone played through the page lights the bars at 1 kHz and nothing far from it
        const tone = await page.evaluate(async () => {
            const sr = 44100, n = sr * 3, x = new Float32Array(n);
            for (let i = 0; i < n; i++) x[i] = 0.3 * Math.sin(2 * Math.PI * 1000 * i / sr);
            const url = URL.createObjectURL(new Blob([RSV.encodeWav([x, x], sr)], {type: 'audio/wav'}));
            const m = window.__rsv.media;
            m.src = url; await m.play();
            await new Promise(r => setTimeout(r, 900));
            const s = Array.from(window.__rsv.shown.slice(0, 64)), e = RSV.logBands(64);
            let arg = 0; s.forEach((v, i) => { if (v > s[arg]) arg = i; });
            const far = s.filter((v, i) => Math.abs(i - arg) > 6).reduce((a, v) => Math.max(a, v), 0);
            m.pause();
            return {lo: e[arg], hi: e[arg + 1], peak: s[arg], far};
        });
        check(tone.lo <= 1060 && tone.hi >= 940, 'the 1 kHz tone peaks in the bar that holds 1 kHz', JSON.stringify(tone));
        check(tone.peak > 0.5 && tone.far < 0.05, 'and bars more than six bands away stay dark', JSON.stringify(tone));

        // 3. a real MediaRecorder WebM from this Chromium, with its Duration written, reads back at its length
        const webm = await page.evaluate(async () => {
            const c = document.createElement('canvas'); c.width = 64; c.height = 64;
            const g = c.getContext('2d'), st = c.captureStream(30), mr = new MediaRecorder(st, {mimeType: 'video/webm'});
            const chunks = []; mr.ondataavailable = e => chunks.push(e.data);
            let f = 0; const tick = setInterval(() => { g.fillStyle = `hsl(${f++ * 10},80%,50%)`; g.fillRect(0, 0, 64, 64); }, 33);
            const t0 = performance.now(); mr.start(200);
            await new Promise(r => setTimeout(r, 1500));
            await new Promise(r => { mr.onstop = r; mr.stop(); });
            clearInterval(tick);
            const ms = performance.now() - t0;
            const raw = new Uint8Array(await new Blob(chunks).arrayBuffer());
            const fixed = RSV.webmSetDuration(raw, ms);
            return {ms, grew: fixed.length - raw.length, bytes: Array.from(fixed)};
        });
        check(webm.grew === 18, 'Chromium’s WebM takes the Duration element', `grew by ${webm.grew}`);
        try {
            const {execFileSync} = await import('child_process');
            const {writeFileSync, mkdtempSync} = await import('fs');
            const {tmpdir} = await import('os');
            const f = join(mkdtempSync(join(tmpdir(), 'rsv-')), 'fixed.webm');
            writeFileSync(f, Buffer.from(webm.bytes));
            const d = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
            near(d, webm.ms / 1000, 0.15, 'ffprobe reads the written duration');
        } catch (e) { console.log('  (ffprobe not available, duration read-back skipped)'); }

        // 4. nothing the person loads leaves the browser
        const origin = new globalThis.URL(URL).origin;
        const foreign = requests.filter(u => !u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:'));
        check(foreign.length === 0, 'no request leaves the page’s own origin', foreign.join(', '));
        check(errors.length === 0, 'no console errors', errors.join(' | '));
    } finally {
        await browser.close();
    }
}
