#!/usr/bin/env node
// Test suite for tools/audio_normalizer.html.
//
// The page's promise is a number: normalize to -16 LUFS and a loudness meter reads -16, with
// no peak past -1 dBTP. Nothing on the page can show whether that is true - it grades its own
// output - so this runs the page's core script (the <script id="core"> block, which has no
// DOM) in Node and checks it against things that are certain: the EBU Tech 3341 test signals,
// the K-weighting curve from the coefficients BS.1770 publishes, and analytic true peaks.
// No browser, no server.
//
//   node test/audio_normalizer.mjs                  # everything
//   node test/audio_normalizer.mjs meter limiter    # named suites only
//   node test/audio_normalizer.mjs --page=path.html # run against another copy of the page
//
// Suites: meter, truepeak, limiter, render.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'tools', 'audio_normalizer.html');
const ALL = ['meter', 'truepeak', 'limiter', 'render'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => {
    failures++;
    console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`);
};
const pass = what => {
    passes++;
    if (process.env.VERBOSE) console.log(`  ok    ${what}`);
};
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) {
    console.log('no <script id="core"> block in ' + PAGE);
    process.exit(1);
}
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.Loudness = Loudness;', ctx);
const {integrated, truePeak, limit, render} = ctx.Loudness;

const db = v => 20 * Math.log10(v), CEIL = Math.pow(10, -1 / 20);

function mulberry(a) {
    return () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

const sine = (sr, sec, f, amp, phase = 0) =>
    Float32Array.from({length: Math.round(sr * sec)}, (_, i) => amp * Math.sin(2 * Math.PI * f * i / sr + phase));
const concat = parts => {
    const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) out.set(p, o), o += p.length;
    return out;
};

// Programme material. Speech: syllables of filtered noise in words and phrases, with pauses of
// room tone between phrases and a second talker 8 dB hotter than the first, plus a few plosives.
function speech(sr, sec, seed) {
    const rnd = mulberry(seed), x = new Float32Array(Math.round(sr * sec));
    let i = 0, lp = 0, talker = 0;
    while (i < x.length) {
        const gain = talker++ % 2 ? .5 : .2, words = 3 + Math.floor(rnd() * 8);
        for (let w = 0; w < words && i < x.length; w++) {
            const len = Math.floor(sr * (.12 + rnd() * .3));
            for (let k = 0; k < len && i < x.length; k++, i++) {
                lp += .25 * ((rnd() * 2 - 1) - lp);
                x[i] = gain * Math.sin(Math.PI * k / len) * lp * 3;
            }
            if (rnd() < .3) for (let k = 0; k < sr * .004 && i + k < x.length; k++) x[i + k] += gain * 1.6 * (k % 2 ? 1 : -1);
            i += Math.floor(sr * (.03 + rnd() * .1));
        }
        const pause = Math.floor(sr * (1 + rnd() * 2.5));
        for (let k = 0; k < pause && i < x.length; k++, i++) x[i] = .001 * (rnd() * 2 - 1);
    }
    return x;
}

// Music: a bass line near 50 Hz with harmonics, a kick on every beat and noisy hats between.
function music(sr, sec, seed) {
    const rnd = mulberry(seed), x = new Float32Array(Math.round(sr * sec)), beat = Math.round(sr * .5);
    for (let i = 0; i < x.length; i++) {
        const t = i / sr, b = i % beat, f = [49, 55, 41, 62][Math.floor(i / (beat * 4)) % 4];
        x[i] = .3 * Math.sin(2 * Math.PI * f * t) + .12 * Math.sin(4 * Math.PI * f * t) + .06 * Math.sin(6 * Math.PI * f * t)
            + .5 * Math.exp(-b / (sr * .06)) * Math.sin(2 * Math.PI * 60 * b / sr * (1 + Math.exp(-b / (sr * .02))))
            + (b > beat / 2 ? .05 * Math.exp(-(b - beat / 2) / (sr * .02)) * (rnd() * 2 - 1) : 0);
    }
    return x;
}

// |H(f)| of the K-weighting filter from the 48 kHz coefficients printed in ITU-R BS.1770-4,
// independent of how the page derives its own.
function kGain48(f) {
    const stages = [[[1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, .73248077421585]],
        [[1, -2, 1], [1, -1.99004745483398, .99007225036621]]];
    let g = 1;
    for (const [b, a] of stages) {
        const w = 2 * Math.PI * f / 48000, re = (c, k) => c[0] + c[1] * Math.cos(w) + c[2] * Math.cos(2 * w),
            im = c => -(c[1] * Math.sin(w) + c[2] * Math.sin(2 * w));
        g *= Math.hypot(re(b), im(b)) / Math.hypot(re(a), im(a));
    }
    return g;
}

// The in-between values the plain way, for checking the page's fast version against.
const P0 = [.001708984375, .010986328125, -.0196533203125, .033203125, -.0594482421875, .1373291015625,
    .97216796875, -.102294921875, .047607421875, -.026611328125, .014892578125, -.00830078125];
const P1 = [-.0291748046875, .029296875, -.0517578125, .089111328125, -.16650390625, .465087890625,
    .77978515625, -.2003173828125, .1015625, -.0582275390625, .0330810546875, -.0189208984375];
const PHASES = [P0, P1, P1.slice().reverse(), P0.slice().reverse()];

function slowTruePeak(chans) {
    let pk = 0;
    for (const x of chans) for (let i = 0; i < x.length; i++) {
        pk = Math.max(pk, Math.abs(x[i]));
        if (i >= 6 && i < x.length - 5) for (const f of PHASES) {
            let v = 0;
            for (let t = 0; t < 12; t++) v += f[t] * x[i - 6 + t];
            pk = Math.max(pk, Math.abs(v));
        }
    }
    return pk;
}

if (suites.includes('meter')) {
    section('meter');
    // EBU Tech 3341, minimum requirements 1-5: stereo 1 kHz sine, expected -23 LUFS (-33 for #2), +-0.1 LU
    const EBU = [['1: -23 dBFS for 20 s', [[-23, 20]], -23], ['2: -33 dBFS for 20 s', [[-33, 20]], -33],
        ['3: -36/-23/-36 dBFS', [[-36, 10], [-23, 60], [-36, 10]], -23],
        ['4: -72/-36/-23/-36/-72 dBFS', [[-72, 10], [-36, 10], [-23, 60], [-36, 10], [-72, 10]], -23],
        ['5: -26/-20/-26 dBFS', [[-26, 20], [-20, 20.1], [-26, 20]], -23]];
    for (const sr of [48000, 44100]) for (const [name, segs, want] of EBU) {
        const x = concat(segs.map(([d, s]) => sine(sr, s, 1000, Math.pow(10, d / 20))));
        const got = integrated([x, x], sr);
        check(Math.abs(got - want) <= .1, `EBU Tech 3341 test ${name} at ${sr} Hz`, `read ${got.toFixed(3)}, expected ${want} +-0.1`);
    }
    const cal = integrated([sine(48000, 10, 997, 1)], 48000);
    check(Math.abs(cal + 3.01) <= .05, '997 Hz at 0 dBFS in one channel reads -3.01 LUFS', `read ${cal.toFixed(3)}`);
    // the K-weighting curve, bass included: a stereo sine reads 20 log(amplitude x |H(f)|)
    for (const sr of [48000, 44100]) for (const f of [20, 30, 40, 60, 100, 200, 1000, 3000, 10000]) {
        const amp = .1, x = sine(sr, 6, f, amp), got = integrated([x, x], sr), want = -.691 + 10 * Math.log10(amp * amp * kGain48(f) ** 2);
        check(Math.abs(got - want) <= .05, `K-weighting at ${f} Hz, ${sr} Hz`, `read ${got.toFixed(3)}, BS.1770 coefficients give ${want.toFixed(3)}`);
    }
    // gating: pauses do not count as quiet programme (averaged in, 30 s of silence would take 4 dB
    // off this one; the few blocks straddling the edges are partly tone and rightly cost 0.07)
    const tone = sine(48000, 20, 440, .1), gappy = concat([tone.subarray(0, 480000), new Float32Array(48000 * 30), tone.subarray(480000)]);
    const a = integrated([tone], 48000), b = integrated([gappy], 48000);
    check(Math.abs(a - b) <= .1, '30 s of silence inside the programme changes nothing', `${a.toFixed(3)} alone, ${b.toFixed(3)} with the gap`);
    const quiet = integrated([concat([tone, sine(48000, 20, 440, .01)])], 48000);
    check(Math.abs(quiet - a) <= .1, 'a passage 20 dB down falls under the relative gate', `${quiet.toFixed(3)} against ${a.toFixed(3)}`);
    // channel weights: surrounds count 1.41x, the LFE not at all (Web Audio's 5.1 order L R C LFE SL SR)
    const z = new Float32Array(48000 * 6), s = sine(48000, 6, 1000, .1);
    const front = integrated([s, z, z, z, z, z], 48000), surround = integrated([z, z, z, z, s, z], 48000);
    check(Math.abs(surround - front - 10 * Math.log10(1.41)) <= .01, 'a surround channel counts 1.41x', `+${(surround - front).toFixed(3)} dB`);
    check(integrated([z, z, z, s, z, z], 48000) === -Infinity, 'the LFE is not counted');
    check(integrated([new Float32Array(48000 * 3)], 48000) === -Infinity, 'silence has no loudness');
    check(integrated([sine(48000, .35, 440, .5)], 48000) === -Infinity, 'under 400 ms has no loudness');
    check(integrated([sine(48000, 5, 440, 1e-4)], 48000) === -Infinity, 'everything under -70 LUFS has no loudness');
}

if (suites.includes('truepeak')) {
    section('truepeak');
    const rnd = mulberry(7);
    let worst = 0, where = '';
    for (const n of [1, 5, 11, 12, 13, 17, 255, 256, 257, 300, 511, 1000, 4099]) for (let trial = 0; trial < 12; trial++) {
        const x = Float32Array.from({length: n}, () => (rnd() - .5) * (rnd() < .05 ? 2 : .1));
        const k = Math.floor(rnd() * n);
        if (trial % 3 === 0) for (let i = Math.max(0, k - 3); i < Math.min(n, k + 3); i++) x[i] = (i % 2 ? 1 : -1) * .9;
        const d = Math.abs(truePeak([x]) - slowTruePeak([x]));
        if (d > worst) worst = d, where = `length ${n}, burst at ${k}`;
    }
    check(worst < 1e-6, 'agrees with the plain interpolator everywhere, ends included', `off by ${worst} (${where})`);
    const cases = [['a quarter-rate sine at 45 degrees', sine(48000, 1, 12000, 1, Math.PI / 4), 0, .1],
        ['997 Hz at -6 dBFS', sine(48000, 1, 997, .5), -6.02, .05], ['a sine that hits its peak on a sample', sine(48000, 1, 8000, .8, Math.PI / 6), db(.8), .05]];
    for (const [name, x, want, tol] of cases) {
        const got = db(truePeak([x]));
        check(Math.abs(got - want) <= tol, `${name}: ${want.toFixed(2)} dBTP`, `read ${got.toFixed(3)}`);
    }
    const sp = Math.max(...sine(48000, 1, 12000, 1, Math.PI / 4).map(Math.abs));
    check(db(sp) < -2.9, 'the same quarter-rate sine is 3 dB lower on the samples - the case sample peak misses');
}

if (suites.includes('limiter')) {
    section('limiter');
    for (const [name, make] of [['speech', speech], ['music', music]]) for (const gain of [3, 8, 14, 20]) for (const sr of [44100, 48000]) {
        const x = make(sr, 30, gain * 7 + sr), k = Math.pow(10, gain / 20), y = [x.map(v => v * k)];
        const reduction = limit(y, sr, CEIL), tp = db(truePeak(y));
        check(tp <= -1 + .01, `${name} +${gain} dB at ${sr} Hz stays under -1 dBTP`, `true peak ${tp.toFixed(3)} dBTP after ${reduction.toFixed(1)} dB of limiting`);
    }
    const quiet = [sine(48000, 2, 440, .7)], copy = quiet[0].slice();
    check(limit(quiet, 48000, CEIL) === 0 && quiet[0].every((v, i) => v === copy[i]), 'audio under the ceiling passes through untouched');
    // one spike on a steady level: the gain arrives at exactly what the spike needs, along a 5 ms ramp
    const steady = new Float32Array(48000).fill(.5);
    steady[24000] = 1;
    const out = steady.slice();
    limit([out], 48000, .8);
    const g = Array.from(out, (v, i) => v / steady[i]);
    const start = g.findIndex(v => v < .9999), step = Math.max(...g.slice(1).map((v, i) => Math.abs(v - g[i])));
    check(Math.abs(g[24000] - .8) < 1e-5, 'the spike gets exactly the gain it needs', `gain ${g[24000].toFixed(6)}`);
    check(start >= 24000 - 241 && start <= 24000 - 239, 'the gain starts to fall 5 ms ahead of the spike', `${24000 - start} samples ahead`);
    check(step <= .2 / 240 + 1e-6, 'and falls in a straight ramp, no step', `largest step ${step.toFixed(6)}`);
    // the opening and the end of a file are covered like the middle
    for (const [name, x] of [['a file that starts loud', sine(48000, 1, 440, 20)], ['a file that ends on a burst', concat([sine(48000, 1, 440, .1), sine(48000, .001, 440, 20)])]]) {
        limit([x], 48000, CEIL);
        check(db(truePeak([x])) <= -1 + .01, `${name} stays under -1 dBTP`, `true peak ${db(truePeak([x])).toFixed(3)}`);
    }
}

if (suites.includes('render')) {
    section('render');
    for (const [name, make] of [['speech', speech], ['music', music]]) {
        const sr = 48000, src = [make(sr, 40, 3)], dst = [new Float32Array(src[0].length)], from = integrated(src, sr);
        for (const target of [-23, -16, -14]) {
            const r = await render(src, dst, sr, {gainDb: target - from, ceiling: CEIL, level: ch => integrated(ch, sr), target});
            const got = integrated(dst, sr), tp = db(truePeak(dst));
            check(Math.abs(got - target) <= .1 && tp <= -1 + .01, `${name} to ${target} LUFS lands there under -1 dBTP`,
                `${got.toFixed(3)} LUFS, ${tp.toFixed(2)} dBTP, ${r.reduction.toFixed(1)} dB of limiting`);
        }
        // a target nothing sensible can reach: it stops short instead of piling on gain
        const r = await render(src, dst, sr, {gainDb: -from, ceiling: CEIL, level: ch => integrated(ch, sr), target: 0});
        const extra = r.gainDb + from;
        check(extra <= 15 && db(truePeak(dst)) <= -1 + .01, `${name} to 0 LUFS stops short, still under -1 dBTP`,
            `make-up ${extra.toFixed(1)} dB, reached ${integrated(dst, sr).toFixed(2)} LUFS`);
    }
    const src = [sine(48000, 5, 440, .25)], dst = [new Float32Array(src[0].length)];
    await render(src, dst, 48000, {gainDb: 6, dc: [0], ceiling: 0, level: null, target: 0});
    check(dst[0].every((v, i) => Math.abs(v - src[0][i] * Math.pow(10, 6 / 20)) < 1e-6), 'without a ceiling or a level it is a plain gain');
    const off = [src[0].map(v => v + .1)];
    await render(off, dst, 48000, {gainDb: 0, dc: [.1], ceiling: 0, level: null, target: 0});
    check(dst[0].every((v, i) => Math.abs(v - src[0][i]) < 1e-6), 'a DC offset is taken off before the gain');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
