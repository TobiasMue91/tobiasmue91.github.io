#!/usr/bin/env node
// Test suite for tools/air_synth.html.
//
// Runs the page's DOM-free <script id="core"> block in Node and plays it synthetic hands: still, jittering, sweeping,
// vanishing for a few frames, two hands whose left/right labels swap. The page promises that the music stays in time
// and in key whatever the hand does: every note it starts is a tone of the chord playing at that moment and starts on a
// sixteenth of the grid; a dropout shorter than 150 ms never cuts a note, a hand that is really gone does; a still,
// jittering hand on a boundary between two notes does not flutter between them; a sweep never plays more than one note
// per sixteenth; swapped handedness labels do not swap the lead hand; and the filter follows the hand on the next frame,
// not on the next grid point. It also measures (and prints) what the One-Euro filter and the 40 ms prediction buy.
// No browser, no server; well under a second.
//
//   node test/air_synth.mjs        (npm run test:airsynth)

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'tools', 'air_synth.html'), 'utf8');
const Core = vm.runInNewContext(html.match(/<script id="core">([\s\S]*?)<\/script>/)[1] + ';Core', {});

let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m); } else if (process.env.VERBOSE) console.log('ok  ', m); };
const info = m => console.log('      ' + m);
let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.22;

// a hand as MediaPipe returns it, palm at (x, y) in camera space (not mirrored)
function hand(x, y, label = 'Right') {
    const lm = [];
    for (let i = 0; i < 21; i++) lm.push({x: x + (i % 5 - 2) * 0.01, y: y + (i > 0 ? -0.04 : 0.04), z: 0});
    // the five palm points average exactly to (x, y)
    [0, 5, 9, 13, 17].forEach(i => { lm[i] = {x, y, z: 0}; });
    return {landmarks: lm, handed: label};
}

// play a path: path(tMs) -> null | {x, y} (screen space, mirrored) or an array of them; returns events + per-frame states
function play(path, {seconds = 8, fps = 30, jitter = 0, drop = 0, opt = {}} = {}) {
    const m = Core.mapper({bpm: 96, t0: 0, ...opt}), ev = [], frames = [];
    for (let t = 0; t < seconds * 1000; t += 1000 / fps) {
        let p = path(t);
        let hands = null;
        if (p && !(drop && rnd() < drop)) {
            const list = Array.isArray(p) ? p : [p];
            hands = list.map((q, i) => hand(1 - (q.x + jitter * gauss()), q.y + jitter * gauss(), q.label || (i ? 'Left' : 'Right')));
        }
        const r = m.step(hands, t);
        r.events.forEach(e => ev.push({...e, at: t}));
        frames.push({t, ...r.state});
    }
    return {m, ev, frames};
}

const onGrid = (m, t) => Math.abs((t / m.stepMs) - Math.round(t / m.stepMs)) < 1e-6;
const inChord = (m, e) => m.tonesAt(e.t).includes(e.midi);

function harmonyAndGrid(name, r) {
    const ons = r.ev.filter(e => e.type === 'on');
    ok(ons.length > 0, name + ': plays something');
    ok(ons.every(e => inChord(r.m, e)), name + ': every note is a tone of the chord playing when it starts (' + ons.filter(e => !inChord(r.m, e)).length + ' off)');
    ok(r.ev.every(e => onGrid(r.m, e.t)), name + ': every event starts on a sixteenth');
    ok(r.ev.every(e => e.t > e.at), name + ': every event lies in the future when it is scheduled');
    const per = {};
    r.ev.forEach(e => { per[e.t] = (per[e.t] || 0) + 1; });
    ok(Object.values(per).every(c => c === 1), name + ': at most one event per sixteenth');
}

// --- harmony and grid under every kind of motion ---
harmonyAndGrid('slow drift', play(t => ({x: 0.5, y: 0.5 + 0.35 * Math.sin(t / 1400)}), {seconds: 16}));
harmonyAndGrid('fast sweep', play(t => ({x: 0.3 + 0.4 * Math.sin(t / 300), y: 0.5 + 0.42 * Math.sin(t / 170)}), {seconds: 16, jitter: 0.004}));
harmonyAndGrid('15 fps, jitter, 10% dropped frames', play(t => ({x: 0.6, y: 0.5 + 0.3 * Math.sin(t / 600)}), {seconds: 16, fps: 15, jitter: 0.006, drop: 0.1}));
harmonyAndGrid('irregular frames', (() => {
    // camera frames that come late and early, like a busy laptop
    const m = Core.mapper({bpm: 96, t0: 0}), ev = [];
    for (let t = 0; t < 12000; t += 20 + rnd() * 60) {
        const r = m.step([hand(0.5, 0.5 + 0.35 * Math.sin(t / 500))], t); r.events.forEach(e => ev.push({...e, at: t}));
    }
    return {m, ev};
})());

// the chord moves under a held hand: the note follows to the new chord on its downbeat
{
    const r = play(() => ({x: 0.5, y: 0.5}), {seconds: 12});
    const ons = r.ev.filter(e => e.type === 'on');
    const bars = new Set(ons.slice(1).map(e => e.t / r.m.barMs));
    ok(ons.every(e => inChord(r.m, e)), 'held hand over chord changes: stays in the chord');
    ok([...bars].every(b => Math.abs(b - Math.round(b)) < 1e-9), 'held hand: a still hand only re-pitches on a chord change, on its downbeat');
}

// --- dropouts ---
for (const gap of [40, 100, 140]) {
    const r = play(t => (t > 2000 && t < 2000 + gap ? null : {x: 0.5, y: 0.5}), {seconds: 5});
    ok(!r.ev.some(e => e.type === 'off'), 'a ' + gap + ' ms dropout does not cut the note');
}
{
    const r = play(t => (t > 2000 && t < 2600 ? null : {x: 0.5, y: 0.5}), {seconds: 5});
    const off = r.ev.find(e => e.type === 'off');
    ok(off && off.t > 2000 && off.t < 2000 + 220 + 2 * r.m.stepMs + 1, 'a hand gone for 600 ms is released, within the hold plus a sixteenth or two');
    ok(r.ev.some(e => e.type === 'on' && e.t > 2600), 'and it plays again when the hand comes back');
}
{
    // dropout while moving: during the gap the last pose is held, no new note is invented
    const r = play(t => (t > 3000 && t < 3130 ? null : {x: 0.5, y: 0.5 + 0.3 * Math.sin(t / 400)}), {seconds: 5});
    ok(!r.ev.some(e => e.type === 'off'), 'a 130 ms dropout mid-sweep does not cut the note');
    ok(!r.ev.some(e => e.type === 'on' && e.at > 3000 && e.at < 3130 && !e.legato), 'nothing new is started from a hand that is not there');
}

// --- no flutter: a still hand right on a boundary between two chord tones ---
{
    const m0 = Core.mapper({bpm: 96, t0: 0});
    const tones = m0.tonesAt(0);
    // height whose pitch lies exactly between two neighbouring tones
    const mid = (tones[3] + tones[4]) / 2, y = 0.92 - (mid - 55) / 24 * 0.84;
    for (const jitter of [0.003, 0.006, 0.01]) {
        const r = play(() => ({x: 0.5, y}), {seconds: 2.4, jitter});  // inside the first bar (2.5 s at 96 bpm): no chord change
        const ons = r.ev.filter(e => e.type === 'on');
        ok(ons.length <= 2, 'still hand on a note boundary, jitter ' + jitter + ': ' + ons.length + ' note(s) in a bar, not a flutter');
    }
    // without hysteresis the same hand does flutter - so the test above is testing something
    const r = play(() => ({x: 0.5, y}), {seconds: 2.4, jitter: 0.01, opt: {hyst: 0}});
    ok(r.ev.filter(e => e.type === 'on').length > 2, 'control: with hysteresis off the same hand does flutter (' + r.ev.filter(e => e.type === 'on').length + ' notes)');
}

// --- swapped labels ---
{
    // lead hand high on the right, second hand low on the left; labels swap every other frame
    let k = 0;
    const r = play(() => { k++; const s = k % 2 ? ['Left', 'Right'] : ['Right', 'Left']; return [{x: 0.75, y: 0.25, label: s[0]}, {x: 0.25, y: 0.8, label: s[1]}]; }, {seconds: 2.4});
    const ons = r.ev.filter(e => e.type === 'on');
    ok(ons.length === 1 && ons[0].midi > 70, 'swapping left/right labels every frame keeps the lead hand (' + ons.map(e => e.midi) + ')');
    // and the order of the hands in the result list does not matter either
    k = 0;
    const r2 = play(() => { k++; const a = {x: 0.75, y: 0.25}, b = {x: 0.25, y: 0.8}; return k % 2 ? [a, b] : [b, a]; }, {seconds: 2.4});
    ok(r2.ev.filter(e => e.type === 'on').length === 1, 'nor does the order MediaPipe lists them in');
}

// --- continuous parameters follow at once ---
{
    // the hand jumps from left to right at t=1000 ms (just after a grid point); the filter must follow within two frames
    const r = play(t => ({x: t < 1000 ? 0.2 : 0.8, y: 0.5}), {seconds: 2});
    const after = r.frames.filter(f => f.t >= 1000);
    const k = after.findIndex(f => f.cutoff > 0.2 + 0.6 * 0.9);
    ok(k >= 0 && k <= 2, 'filter reaches 90% of a hand jump in ' + k + ' frame(s) (' + (k * 33).toFixed(0) + ' ms), not on the next grid point');
    ok(Math.abs(r.frames.at(-1).cutoff - 0.8) < 0.01, 'and settles on the hand');
}

// --- what the smoothing and the prediction buy, measured ---
{
    // a "true" hand moves; the camera sees it 70 ms late (exposure, transfer, detection) with jitter
    const D = 70, fps = 30;
    const truth = t => 0.5 + 0.3 * Math.sin(t / 250);
    const run = (predictMs, raw) => {
        const m = Core.mapper({bpm: 96, t0: 0, predictMs});
        let e = 0, c = 0, still = [];
        seed = 5;
        for (let t = 0; t < 20000; t += 1000 / fps) {
            const moving = t < 10000;
            const seen = moving ? truth(t - D) : 0.5;
            const y = seen + 0.004 * gauss();
            m.step([hand(0.5, y)], t);
            const est = raw ? y : m.state.py;
            if (moving && t > 500) { e += (est - truth(t)) ** 2; c++; }
            if (!moving && t > 11000) still.push(est);
        }
        const mean = still.reduce((a, b) => a + b, 0) / still.length;
        const sd = Math.sqrt(still.reduce((a, b) => a + (b - mean) ** 2, 0) / still.length);
        return {rms: Math.sqrt(e / c), sd};
    };
    const raw = run(0, true), filt = run(0), pred = run(40), pred60 = run(60);
    info(`tracking error against the true hand (70 ms late camera, 0.004 jitter): raw ${raw.rms.toFixed(4)}, One-Euro ${filt.rms.toFixed(4)}, +40 ms prediction ${pred.rms.toFixed(4)}, +60 ms ${pred60.rms.toFixed(4)}`);
    info(`jitter on a still hand (sd): raw ${raw.sd.toFixed(4)}, One-Euro ${filt.sd.toFixed(4)}, +40 ms ${pred.sd.toFixed(4)}`);
    ok(filt.sd < raw.sd * 0.6, 'the One-Euro filter takes at least 40% of the jitter off a still hand');
    ok(pred.rms < filt.rms, 'prediction brings a moving hand closer to where it really is');
    ok(pred.sd < raw.sd, 'and does not add back more jitter than the filter removed');
}

// --- the visible zones are what plays ---
{
    const m = Core.mapper({bpm: 96, t0: 0});
    const tones = m.tonesAt(0);
    let right = 0;
    tones.forEach(tone => {
        const y = 0.92 - (tone - 55) / 24 * 0.84;      // the height the page draws this tone's line at
        const r = play(() => ({x: 0.5, y}), {seconds: 1});
        if (r.ev[0] && r.ev[0].midi === tone) right++;
    });
    ok(right === tones.length, 'a hand on any drawn line plays that line\'s note (' + right + '/' + tones.length + ')');
}

console.log((fails ? fails + ' of ' : 'all ') + n + ' checks ' + (fails ? 'failed' : 'passed'));
process.exit(fails ? 1 : 0);
