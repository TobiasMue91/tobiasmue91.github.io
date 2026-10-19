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

// a hand as MediaPipe returns it, palm at (x, y) in camera space (not mirrored), fingers up.
// fingers: which of index..pinky are out; reach: override how far they reach (for threshold tests); pinch: thumb on index.
function hand(x, y, label = 'Right', {fingers = [1, 1, 1, 1], reach = null, pinch = false, jitter = 0} = {}) {
    const lm = [], j = () => jitter * gauss();
    lm[0] = {x, y: y + 0.08};                                  // wrist
    [-0.03, -0.01, 0.01, 0.03].forEach((dx, f) => {
        const b = 5 + f * 4, out = fingers[f];
        lm[b] = {x: x + dx, y: y - 0.02};                      // knuckle
        lm[b + 1] = {x: x + dx, y: y - 0.06};                  // middle joint: 0.14 from the wrist
        // tip: straight up (reach ~1.43) or folded back into the palm (~0.57), or a chosen reach
        const r = reach != null ? reach : out ? 1.43 : 0.57;
        lm[b + 3] = {x: x + dx, y: y + 0.08 - 0.14 * r};
        lm[b + 2] = {x: x + dx, y: (lm[b + 1].y + lm[b + 3].y) / 2};
    });
    lm[1] = {x: x + 0.04, y: y + 0.05}; lm[2] = {x: x + 0.06, y: y + 0.02}; lm[3] = {x: x + 0.07, y: y};
    if (pinch) {
        // a real pinch: the index bends forward to meet the thumb (its tip out in front, its own reach only ~1.05),
        // the thumb tip sits `gap` palm lengths away; the other fingers do whatever `others` says
        const gap = typeof pinch === 'number' ? pinch : 0.2;
        lm[6] = {x: x - 0.01, y: y - 0.07}; lm[8] = {x: x + 0.045, y: y - 0.075}; lm[7] = {x: x + 0.02, y: y - 0.09};
        lm[4] = {x: lm[8].x + gap * 0.1 * 0.8, y: lm[8].y + gap * 0.1 * 0.6};
    } else lm[4] = {x: x + 0.08, y: y - 0.01};
    lm.forEach((p, i) => { lm[i] = {x: p.x + j(), y: p.y + j(), z: 0}; });
    // the five palm points average exactly to (x, y) before jitter
    return {landmarks: lm, handed: label};
}

// play a path: path(tMs) -> null | {x, y} (screen space, mirrored) or an array of them; returns events + per-frame states
function play(path, {seconds = 8, fps = 30, jitter = 0, drop = 0, opt = {}} = {}) {
    const m = Core.mapper({bpm: 96, t0: 0, ...opt}), ev = [], frames = [];
    let next = 1;
    for (let t = 0; t < seconds * 1000; t += 1000 / fps) {
        let p = path(t);
        let hands = null;
        if (p && !(drop && rnd() < drop)) {
            const list = Array.isArray(p) ? p : [p];
            hands = list.map((q, i) => hand(1 - (q.x + jitter * gauss()), q.y + jitter * gauss(), q.label || (i ? 'Left' : 'Right'), q));
        }
        const r = m.step(hands, t);
        r.events.forEach(e => ev.push({...e, at: t}));
        // the scheduler asks for the grid's own notes (the arpeggio) a little ahead, as the page does
        while (m.opt.t0 + next * m.stepMs < t + 100) m.at(next++).forEach(e => ev.push({...e, at: t}));
        frames.push({t, ...r.state, b: {...r.state.b}});
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

// ===== poses =====
{
    const poses = {open: [1, 1, 1, 1], two: [1, 1, 0, 0], one: [1, 0, 0, 0], fist: [0, 0, 0, 0]};
    for (const [name, fingers] of Object.entries(poses)) {
        const g = Core.gestures(); let seen = new Set(), last;
        seed = 3;
        for (let t = 0; t < 3000; t += 33) { last = g.step(hand(0.5, 0.5, 'Right', {fingers, jitter: 0.004}).landmarks, t).pose; if (t > 200) seen.add(last); }
        ok(seen.size === 1 && last === name, 'a jittering ' + name + ' hand reads as ' + name + ', and only that (' + [...seen] + ')');
    }
    // fingers right on the threshold: per-finger hysteresis keeps the pose from flickering
    const g = Core.gestures(); let flips = 0, prev = null;
    seed = 4;
    for (let t = 0; t < 5000; t += 33) {
        const p = g.step(hand(0.5, 0.5, 'Right', {reach: 1.14, jitter: 0.006}).landmarks, t).pose;
        if (prev && p !== prev) flips++; prev = p;
    }
    ok(flips <= 1, 'a hand half open, right on the threshold, changes pose ' + flips + ' time(s) in 5 s');
    // a 60 ms fist (two frames) is noise, a 150 ms one is a fist
    const blip = ms => { const g = Core.gestures(), seen = new Set();
        for (let t = 0; t < 1500; t += 33) seen.add(g.step(hand(0.5, 0.5, 'Right', {fingers: t >= 500 && t < 500 + ms ? [0, 0, 0, 0] : [1, 1, 1, 1]}).landmarks, t).pose);
        return seen.has('fist'); };
    ok(!blip(60) && blip(160), 'a pose must hold about 90 ms before it counts');
    // a vanished hand keeps its pose for the hold, then forgets it
    const g2 = Core.gestures();
    g2.step(hand(0.5, 0.5, 'Right', {fingers: [1, 1, 0, 0]}).landmarks, 0);
    ok(g2.step(null, 150).pose === 'two' && g2.step(null, 400).pose === null, 'a dropout keeps the pose for the hold, not longer');
    // pinch: one event per pinch, none while it is held - however the other fingers are held, at any realistic gap
    const pinchCount = (others, gap, jitter = 0.004) => {
        const g = Core.gestures(); let n = 0, poses = new Set();
        seed = 9;
        for (let t = 0; t < 4000; t += 33) {
            const pin = (t > 500 && t < 1500) || (t > 2500 && t < 3000);
            const r = g.step(hand(0.5, 0.5, 'Right', {pinch: pin ? gap : false, reach: pin ? others : null, jitter}).landmarks, t);
            if (r.pinchOn) n++;
            if (t > 300) poses.add(r.pose);
        }
        return {n, poses: [...poses]};
    };
    for (const [label, others] of [['relaxed', 1.0], ['stretched (an OK sign)', 1.43], ['curled', 0.6]])
        for (const gap of [0.1, 0.2, 0.3]) {
            const r = pinchCount(others, gap);
            ok(r.n === 2, 'two pinches with the other fingers ' + label + ', tips ' + gap + ' palm lengths apart, are two chord changes (' + r.n + ')');
            if (gap === 0.2) ok(r.poses.length === 1 && r.poses[0] === 'open', 'and pinching with them ' + label + ' does not change the pose (' + r.poses + ')');
        }
    // a slow, real pinch: the other fingers relax first, then the tips close over 300 ms, hold, open again
    {
        const g = Core.gestures(); let n = 0; const poses = new Set(); seed = 12;
        for (let t = 0; t < 2600; t += 33) {
            let o;
            if (t < 500) o = {};
            else if (t < 800) o = {reach: 1.43 - (t - 500) / 300 * 0.43, pinch: 0.8};
            else if (t < 1100) o = {reach: 1.0, pinch: 0.8 - (t - 800) / 300 * 0.65};
            else if (t < 1500) o = {reach: 1.0, pinch: 0.15};
            else if (t < 1800) o = {reach: 1.0, pinch: 0.15 + (t - 1500) / 300 * 0.65};
            else o = {};
            const r = g.step(hand(0.5, 0.5, 'Right', {...o, jitter: 0.004}).landmarks, t);
            if (r.pinchOn) n++;
            poses.add(r.pose);
        }
        ok(n === 1, 'a slow pinch - fingers relax, then the tips close - is one chord change (' + n + ')');
        ok(!poses.has('fist'), 'and is never taken for a fist on the way (' + [...poses] + ')');
    }
    // never a pinch: a fist with the thumb on the index, a relaxed open hand, two fingers, the tips 0.6 apart
    const never = (opts, name) => { const g = Core.gestures(); let n = 0; seed = 10;
        for (let t = 0; t < 3000; t += 33) if (g.step(hand(0.5, 0.5, 'Right', {...opts, jitter: 0.004}).landmarks, t).pinchOn) n++;
        ok(n === 0, name + ' is never a pinch (' + n + ')'); };
    {
        // a fist whose thumb lies right on the curled index
        const g = Core.gestures(); let n = 0; seed = 11;
        for (let t = 0; t < 3000; t += 33) {
            const h = hand(0.5, 0.5, 'Right', {fingers: [0, 0, 0, 0], jitter: 0.004});
            h.landmarks[4] = {x: h.landmarks[8].x + 0.01, y: h.landmarks[8].y - 0.01, z: 0};
            if (g.step(h.landmarks, t).pinchOn) n++;
        }
        ok(n === 0, 'a fist with the thumb on the curled index is never a pinch (' + n + ')');
    }
    never({}, 'an open hand');
    never({fingers: [1, 1, 0, 0]}, 'two fingers');
    never({pinch: 0.6, reach: 1.0}, 'thumb and index 0.6 palm lengths apart');
}

// ===== what the poses do =====
{
    // fist: the melody rests on the grid, opening plays again
    const r = play(t => ({x: 0.5, y: 0.5, fingers: t > 1000 && t < 2000 ? [0, 0, 0, 0] : [1, 1, 1, 1]}), {seconds: 2.4});
    const off = r.ev.find(e => e.type === 'off');
    ok(off && off.t > 1000 && off.t < 1000 + 90 + 2 * r.m.stepMs + 1, 'a fist rests the melody on the next sixteenth or two');
    ok(r.ev.some(e => e.type === 'on' && e.t > 2000), 'opening the hand plays again');
    // two fingers: an arpeggio on every sixteenth (eighths while calm), in the chord, on the grid
    const a = play(t => ({x: 0.5, y: 0.5 + 0.1 * Math.sin(t / 300), fingers: [1, 1, 0, 0]}), {seconds: 12});
    const arp = a.ev.filter(e => e.arp);
    harmonyAndGrid('arpeggio', {m: a.m, ev: arp});
    const late = arp.filter(e => e.t > 6000), gaps = late.slice(1).map((e, i) => Math.round((e.t - late[i].t) / a.m.stepMs));
    ok(arp.length > 30 && gaps.every(g => g === 1 || g === 2), 'two fingers play an arpeggio in sixteenths or eighths (' + [...new Set(gaps)] + ')');
    ok(new Set(arp.map(e => e.midi)).size >= 4, 'the arpeggio walks through the chord');
    // the arpeggio follows the frame rate of nothing: the same at 10 fps
    const a10 = play(() => ({x: 0.5, y: 0.5, fingers: [1, 1, 0, 0]}), {seconds: 6, fps: 10});
    ok(a10.ev.filter(e => e.arp && e.t > 3000 && e.t < 5000).length >= 6, 'the arpeggio keeps its rhythm at 10 camera frames a second');
    // the Arp button turns an open hand into the arpeggio (and so the mouse can play it)
    const l = play(() => ({x: 0.5, y: 0.5}), {seconds: 3, opt: {latch: true}});
    ok(l.ev.filter(e => e.arp).length > 8 && !l.ev.some(e => !e.arp && e.type === 'on'), 'with the Arp latch an open hand (or a mouse) plays the arpeggio');
    const l2 = play(() => ({x: 0.5, y: 0.5, fingers: [1, 1, 0, 0]}), {seconds: 3, opt: {latch: true}});
    ok(!l2.ev.some(e => e.arp), 'and two fingers then play the melody');
}
{
    // pinch: the next chord, from the next beat; everything stays in harmony across it
    const r = play(t => ({x: 0.5, y: 0.5 + 0.3 * Math.sin(t / 400), pinch: (t > 1100 && t < 1400) || (t > 5200 && t < 5500), fingers: [1, 1, 1, 1]}), {seconds: 8});
    const skips = r.m.state.chordSkip;
    ok(skips != null && Math.abs(skips / (r.m.stepMs * 4) - Math.round(skips / (r.m.stepMs * 4))) < 1e-9, 'a pinch changes the chord on a beat');
    ok(r.m.chordAt(1100) === 'vi' && r.m.chordAt(1900) === 'IV', 'the pinch moved vi on to IV before the bar line');
    harmonyAndGrid('melody across pinched chord changes', r);
}
{
    // the second hand: its height is space, and it never steals the melody
    const r = play(t => [{x: 0.75, y: 0.4}, {x: 0.2, y: t < 1500 ? 0.8 : 0.15}], {seconds: 3});
    const at = t => r.frames.find(f => f.t >= t);
    ok(at(1400).space < 0.2 && at(2500).space > 0.85, 'raising the second hand opens the space (' + at(1400).space.toFixed(2) + ' -> ' + at(2500).space.toFixed(2) + ')');
    ok(r.ev.filter(e => e.type === 'on').length === 1, 'and the melody stays with the first hand');
    // the lead hand leaves, the other stays: it takes over the melody
    const r2 = play(t => t < 1000 ? [{x: 0.75, y: 0.3}, {x: 0.2, y: 0.8}] : [{x: 0.2, y: 0.8}], {seconds: 2.4});
    const ons = r2.ev.filter(e => e.type === 'on');
    ok(ons.length === 2 && ons[1].midi < ons[0].midi, 'when the lead hand leaves, the other hand leads');
}

// ===== the band =====
function band(path, seconds = 40, fps = 30) {
    const m = Core.mapper({bpm: 96, t0: 0}), a = Core.arranger(m), steps = [];
    let next = 0;
    for (let t = 0; t < seconds * 1000; t += 1000 / fps) {
        while (m.opt.t0 + next * m.stepMs < t + 160) {
            const i = next++, s = m.state, r = a.step(i, {energy: s.energy, rest: s.mode === 'rest', present: s.present});
            steps.push({i, t: i * m.stepMs, level: r.level, mode: r.mode, hits: r.hits, energy: s.energy});
        }
        const p = path(t);
        m.step(p ? (Array.isArray(p) ? p : [p]).map(q => hand(1 - q.x, q.y, 'Right', q)) : null, t);
    }
    return {m, steps};
}
{
    const busy = t => ({x: 0.5 + 0.35 * Math.sin(t / 230), y: 0.5 + 0.4 * Math.sin(t / 170)});
    const calm = () => ({x: 0.5, y: 0.5});
    // 20 s busy, then 25 s calm, then the hand goes
    const b = band(t => t < 20000 ? busy(t) : t < 45000 ? calm() : null, 60);
    const lv = b.steps.map(s => s.level);
    const changes = b.steps.filter((s, k) => k && s.level !== b.steps[k - 1].level);
    ok(changes.every(s => s.i % 16 === 0), 'the band changes level only on a bar line');
    ok(changes.every(s => Math.abs(s.level - b.steps[s.i - 1].level) === 1), 'and by one level at a time');
    ok(Math.max(...lv.slice(0, 200)) === 3, 'a busy player brings the band up to lift within 20 s (' + Math.max(...lv.slice(0, 200)) + ')');
    const at = ms => b.steps.find(s => s.t >= ms).level;
    ok(at(44000) <= 1 && at(44000) >= 1, 'a still hand settles it back to a pulse (' + at(44000) + ')');
    ok(at(59000) === 0, 'and with no hand it falls back to air');
    // a rise gets a fill in the bar before it
    const ups = changes.filter(s => s.level > b.steps[s.i - 1].level);
    ok(ups.every(u => b.steps.slice(u.i - 4, u.i).some(s => s.hits.some(h => h.kind === 'snare' && h.roll))), 'every rise is announced by a fill');
    // bass and pad are always the chord
    const pcsAt = s => Core.pcsOf(0, b.m.chordAt(s.t));
    ok(b.steps.every(s => s.hits.filter(h => h.kind === 'bass').every(h => h.pc === pcsAt(s)[0])), 'the bass always plays the chord\'s root');
    const pads = b.steps.filter(s => s.hits.some(h => h.kind === 'pad'));
    ok(pads.every(s => s.hits.find(h => h.kind === 'pad').midis.every(m => pcsAt(s).includes(m % 12))), 'every pad chord is the chord');
    const moves = pads.slice(1).map((s, k) => { const a = pads[k].hits.find(h => h.kind === 'pad').midis, c = s.hits.find(h => h.kind === 'pad').midis; return Math.max(...c.map((m, j) => Math.abs(m - a[j]))); });
    ok(Math.max(...moves) <= 5, 'the pad moves smoothly: no voice jumps more than a fourth (' + Math.max(...moves) + ')');
    ok(b.steps.every(s => s.hits.filter(h => h.kind === 'kick').length <= 1), 'no step has two kicks');
}
{
    // fist: a fill, a hit, the drums gone; open: a riser and the drop on the next bar line
    const busy = t => ({x: 0.5 + 0.35 * Math.sin(t / 230), y: 0.5 + 0.4 * Math.sin(t / 170)});
    const b = band(t => ({...busy(t), fingers: t > 16000 && t < 24000 ? [0, 0, 0, 0] : [1, 1, 1, 1]}), 32);
    const first = b.steps.find(s => s.mode === 'stopping');
    ok(first && first.t > 16000 && first.t < 16000 + 90 + 4 * b.m.stepMs + 200 && first.i % 4 === 0, 'a fist starts the stop on the next beat');
    const brk = b.steps.find(s => s.mode === 'break');
    ok(brk && brk.i - first.i === 4 && brk.hits.some(h => h.kind === 'crash'), 'after a one-beat fill, with a crash');
    ok(b.steps.slice(first.i, brk.i).every(s => s.hits.some(h => h.kind === 'snare' && h.roll)), 'the fill is a snare roll');
    const during = b.steps.filter(s => s.mode === 'break');
    ok(during.length > 16 && during.slice(1).every(s => !s.hits.some(h => h.kind === 'kick' || h.kind === 'hat' || (h.kind === 'snare' && !h.roll))), 'no drums during the break');
    const drop = b.steps.find(s => s.t > 24000 && s.mode === 'normal');
    ok(drop && drop.i % 16 === 0 && drop.hits.some(h => h.kind === 'crash') && drop.level >= 2, 'opening the hand drops the band back in on a bar line, at least at groove');
    ok(b.steps.some(s => s.mode === 'rising' && s.hits.some(h => h.kind === 'riser')), 'with a riser into it');
}

// ===== the drop, as a player meets it =====
{
    const busy = t => ({x: 0.5 + 0.35 * Math.sin(t / 230), y: 0.5 + 0.4 * Math.sin(t / 170)});
    const fist = [0, 0, 0, 0];
    // a fist from 10 s; the tracker loses it twice for half a second (fists are hard to track); open at 18 s, then hold still
    const path = t => t > 12000 && t < 12500 || t > 15000 && t < 15600 ? null
        : t > 10000 && t < 18000 ? {...busy(t), fingers: fist} : t >= 18000 ? {x: 0.5, y: 0.5} : busy(t);
    const b = band(path, 30);
    const brk = b.steps.filter(s => s.t > 10500 && s.t < 18000);
    ok(brk.length && brk.slice(8).every(s => s.mode === 'break'), 'a fist the tracker loses for 500-600 ms stays a break');
    const rise = b.steps.find(s => s.mode === 'rising'), drop = b.steps.find(s => s.t > 18000 && s.mode === 'normal');
    ok(rise && rise.t - 18000 < 90 + 2 * b.m.stepMs + 200, 'opening the hand starts the build at once (' + (rise && (rise.t - 18000).toFixed(0)) + ' ms)');
    ok(drop && drop.t - 18000 <= 20 * b.m.stepMs + 300 && drop.i % 16 === 0, 'and the drop lands on the next bar line, at most a bar and a beat later (' + (drop && (drop.t - 18000).toFixed(0)) + ' ms)');
    const build = b.steps.filter(s => s.mode === 'rising');
    const sn = build.map(s => s.hits.filter(h => h.kind === 'snare').length);
    ok(build.length >= 4 && sn.slice(-4).every(c => c === 1), 'the build ends in a sixteenth snare roll');
    ok(build.filter(s => s.i % 4 === 0).every(s => s.hits.some(h => h.kind === 'snare')), 'and is audible from its first beat, not only its last');
    ok(drop && drop.level === 3 && drop.hits.some(h => h.kind === 'boom') && drop.hits.some(h => h.kind === 'crash'), 'the drop hits at the top level, with crash and boom');
    ok(b.steps.filter(s => s.i >= drop.i && s.i < drop.i + 32).every(s => s.level === 3), 'and holds it for two bars even under a still hand');
    // closing the fist again during the build goes back to the break
    const b2 = band(t => t > 10000 && t < 18000 || t > 18300 && t < 26000 ? {...busy(t), fingers: fist} : busy(t), 28);
    const back = b2.steps.filter(s => s.t > 19500 && s.t < 26000);
    ok(back.length && back.every(s => s.mode === 'break' || s.mode === 'rising') && back.at(-1).mode === 'break', 'a fist again during the build returns to the break');
}

// ===== the loop =====
{
    const L = Core.looper(64);
    const start = L.press(5);
    ok(start === 16, 'a loop starts recording on the next bar line');
    const played = [];
    for (let i = 0; i < 64 * 3 + 16; i++) {
        const out = L.tick(i);
        out.forEach(n => played.push({i, ...n}));
        if (i >= 16 && i < 80 && (i - 16) % 6 === 0) L.record({type: 'on', midi: 60 + (i % 12), vel: 0.8}, i, 2);
        if (i === 79) L.record({type: 'off'}, i);
    }
    const recorded = 11;   // steps 16, 22, ..., 76
    ok(played.filter(p => p.i >= 80 && p.i < 144).length === recorded && played.filter(p => p.i >= 144 && p.i < 208).length === recorded, 'every recorded note comes back once per loop (' + recorded + ')');
    ok(played.every(p => ((p.i - 16) % 64) % 6 === 0 && p.sound === 2), 'at the step it was played, in the sound it was played with');
    ok(played.filter(p => p.i < 80).length === 0, 'nothing plays back while the first pass records');
    ok(played.filter(p => p.i >= 80 && p.i < 144).every(p => p.steps === 6 || p.steps === 3), 'a held note lasts until the next thing played');
    // overdub
    ok(L.press(100) === 144, 'pressing again layers on the next pass');
    for (let i = 208; i < 64 * 6; i++) { L.tick(i); }
    const L2 = Core.looper(64); L2.press(0);
    for (let i = 0; i < 300; i++) { L2.tick(i); if (i === 20) L2.record({type: 'on', midi: 61, vel: 0.5, gateSteps: 0.6}, i); if (i === 90) L2.press(i); if (i === 150) L2.record({type: 'on', midi: 66, vel: 0.5, gateSteps: 0.6}, i); }
    let ps = []; for (let i = 300; i < 364; i++) L2.tick(i).forEach(n => ps.push(i % 64));
    ok(L2.layers === 2 && ps.length === 2, 'two passes, two layers, both playing (' + ps + ')');
    // played back, notes snap into whatever chord is on now
    ok(Core.snap(61, Core.pcsOf(0, 'vi')) === 60 && Core.snap(66, Core.pcsOf(0, 'vi')) === 64 || Core.snap(66, Core.pcsOf(0, 'vi')) === 69, 'a loop note outside the chord is moved to the nearest chord tone');
    L2.clear(); ok(L2.layers === 0 && L2.tick(400).length === 0, 'clearing empties it');
}

// ===== different playing, different music =====
{
    // Air Synth is meant to sound good whatever you do - and still to be yours. Three players, three pieces.
    const players = {
        drifter: t => ({x: 0.3, y: 0.55 + 0.12 * Math.sin(t / 1600)}),
        dancer: t => ({x: 0.5 + 0.4 * Math.sin(t / 260), y: 0.5 + 0.42 * Math.sin(t / 190)}),
        arpist: t => ({x: 0.8, y: 0.3, fingers: [1, 1, 0, 0]})
    };
    const res = {};
    for (const [name, path] of Object.entries(players)) {
        const r = play(path, {seconds: 30}), b = band(path, 30);
        const ons = r.ev.filter(e => e.type === 'on' && e.t > 10000);
        res[name] = {notes: ons.length / 20, pitch: ons.reduce((a, e) => a + e.midi, 0) / Math.max(1, ons.length), level: b.steps.filter(s => s.t > 15000).reduce((a, s) => a + s.level, 0) / b.steps.filter(s => s.t > 15000).length, cutoff: r.frames.at(-1).cutoff};
    }
    info('notes/s, mean pitch, mean band level, filter: ' + Object.entries(res).map(([k, v]) => `${k} ${v.notes.toFixed(1)} / ${v.pitch.toFixed(0)} / ${v.level.toFixed(1)} / ${v.cutoff.toFixed(2)}`).join(';  '));
    ok(res.drifter.notes < 1.5 && res.dancer.notes > 3 && res.arpist.notes > 4, 'a drifting hand plays few notes, a dancing one and an arpeggio many');
    ok(res.drifter.level < 1.6 && res.dancer.level > 2.4, 'the drifter keeps the band small, the dancer makes it big');
    ok(res.arpist.pitch > res.drifter.pitch + 5, 'a hand held high plays high');
    ok(res.arpist.cutoff > res.drifter.cutoff + 0.4, 'and to the right, bright');
}

console.log((fails ? fails + ' of ' : 'all ') + n + ' checks ' + (fails ? 'failed' : 'passed'));
process.exit(fails ? 1 : 0);
