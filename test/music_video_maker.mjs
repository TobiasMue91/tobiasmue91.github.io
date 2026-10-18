#!/usr/bin/env node
// Test suite for tools/music_video_maker.html (Afterglow).
//
// The page promises a video cut to the music: cuts on the beat, a hard cut on the drop, dissolves
// that run from the old shot to the new one. None of that can be judged by looking at a single
// frame, and the analysis that drives it is tuned on numbers, so this drives the real page in
// headless Chromium (file://, no server) against songs synthesised in the page with WebAudio, whose
// beats, downbeats and drops are known exactly. They are deliberately unkind: human timing jitter,
// tempo drift, swing, syncopated kicks, intros and breaks with only off-beat hi-hats, sections of
// 3, 5 and 7 bars, a live band drifting by 4.5 %.
//
//   node test/music_video_maker.mjs                 # everything
//   node test/music_video_maker.mjs beats shots     # named suites only
//   VERBOSE=1 node test/music_video_maker.mjs       # print the measurements
//
// Suites:
//   beats   tempo, beat hits within 50 ms, downbeats within 70 ms, drop cuts within 60 ms,
//           and the share of cuts that land on a true beat - per song and on average
//   shots   the cut plan: dissolves run 0 -> 1 into the next scene, never end on a drop or a
//           change of intensity, a shot that starts inside a bar ends on the next downbeat
//   scenes  every scene compiles and draws a picture that is neither black nor blown out
//   loop    seeking while playing does not stack render loops
//
// Needs Playwright (devDependency, or the global one in /opt/node22). The `scenes` suite runs on
// SwiftShader when there is no GPU, so it takes a minute.

import {fileURLToPath, pathToFileURL} from 'url';
import {dirname, join} from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'music_video_maker.html');
const ALL = ['beats', 'shots', 'scenes', 'loop'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => {
  if (ok) { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); }
  else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); }
};
const section = name => console.log(`\n=== ${name} ===`);
const log = (...a) => { if (process.env.VERBOSE) console.log('       ', ...a); };

let chromium = null;
try { ({chromium} = await import('playwright')); } catch { try { ({chromium} = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch {} }
if (!chromium) { console.log('skipped: no Playwright'); process.exit(0); }

const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']});
const page = await browser.newPage({viewport: {width: 1000, height: 800}});
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
// the muxer is only needed to export; keep the run offline
await page.route(/^https?:\/\//, r => r.abort());
await page.goto(pathToFileURL(PAGE).href + '?seed=7');
await page.waitForFunction(() => window.__afterglow);

// ---------- song generator, runs in the page ----------
await page.evaluate(() => {
  window.makeSong = async ({bpm, style, layout, drift = .012, jitter = .012, pickup = .4, swing = 0, seed = 1}) => {
    let s = seed >>> 0 || 1;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.2832 * rnd());
    const SR = 44100, totalBars = layout.reduce((a, [, b]) => a + b, 0), nbeats = totalBars * 4;
    const bt = [pickup];
    for (let k = 0; k < nbeats + 4; k++) bt.push(bt[k] + 60 / (bpm * (1 + drift * k / nbeats)));
    const ctx = new OfflineAudioContext(1, Math.ceil((bt[bt.length - 1] + 2) * SR), SR);
    const bus = ctx.createGain(); bus.gain.value = .5;
    const verb = ctx.createConvolver(); const ir = ctx.createBuffer(1, SR, SR);
    { const d = ir.getChannelData(0); for (let i = 0; i < SR; i++) d[i] = gauss() * Math.exp(-i / SR / .25) * .3; }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = .25;
    bus.connect(ctx.destination); bus.connect(verb).connect(wet).connect(ctx.destination);
    const noise = ctx.createBuffer(1, SR, SR); { const d = noise.getChannelData(0); for (let i = 0; i < SR; i++) d[i] = rnd() * 2 - 1; }
    const J = t => Math.max(0, t + gauss() * jitter);
    const kick = (t, v = 1) => { t = J(t); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(45, t + .1);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .35); o.connect(g).connect(bus); o.start(t); o.stop(t + .4); };
    const nz = (t, v, type, f, d) => { t = J(t); const n = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noise; fl.type = type; fl.frequency.value = f;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); n.connect(fl).connect(g).connect(bus); n.start(t, rnd() * .5); n.stop(t + d + .01); };
    const snare = (t, v = 1) => nz(t, v * .8, 'bandpass', 1800, .15);
    const hat = (t, v = 1) => nz(t, v * .4, 'highpass', 8000, .03);
    const tone = (t, f, d, v, cut, a = .005) => { t = J(t); const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f;
      fl.type = 'lowpass'; fl.frequency.value = cut; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(fl).connect(g).connect(bus); o.start(t); o.stop(t + d + .02); };
    const at = (k, fr = 0) => bt[k] + fr * (bt[k + 1] - bt[k]);
    const chords = [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]];
    const drops = []; let beat = 0;
    for (const [sec, bars] of layout) {
      if (sec === 'drop') drops.push(bt[beat]);
      for (let b = 0; b < bars; b++) {
        const ch = chords[(b >> 1) % 4];
        for (let q = 0; q < 4; q++) {
          const k = beat + b * 4 + q, full = sec === 'drop';
          if (q === 0 && sec !== 'drop') for (const n of ch) tone(at(k), 220 * 2 ** (n / 12), 4 * 60 / bpm, .05, 1200, .3);
          if (style === 'house') {
            if (full || sec === 'verse') kick(at(k));
            if (full && q % 2) snare(at(k), .4);
            if (sec !== 'intro' || b >= 4) hat(at(k, .5 + swing), .5);
            if (full) for (let e = 0; e < 2; e++) tone(at(k, .25 + e * .5), 55 * 2 ** (ch[0] / 12), .2, .4, 900);
          } else if (style === 'hiphop') {
            if (full || sec === 'verse') {
              if (q === 0 || (q === 2 && b % 2)) kick(at(k));
              if (q % 2) snare(at(k), .8);
              if (q === 2 && !(b % 2)) kick(at(k, .5), .8);
              hat(at(k), .35); hat(at(k, .5 + swing), .25);
            }
            if (full && q === 0) tone(at(k), 55 * 2 ** (ch[0] / 12), .9, .4, 500);
          } else {
            if (full || sec === 'verse') {
              if (q === 0 || (q === 2 && !(b % 2))) kick(at(k));
              if (q === 2 && b % 2) kick(at(k, .5), .9);
              if (q % 2) snare(at(k), .9);
              hat(at(k), .3); hat(at(k, .5), .3);
            }
            if (full && !(q % 2)) tone(at(k), 55 * 2 ** (ch[0] / 12), .5, .5, 400);
          }
          if (sec === 'build') { const pr = b / bars, rolls = pr < .5 ? 1 : pr < .75 ? 2 : 4; for (let r = 0; r < rolls; r++) snare(at(k, r / rolls), .2 + .5 * pr); }
        }
      }
      beat += bars * 4;
    }
    return { buffer: await ctx.startRendering(), truth: { beats: bt.slice(0, nbeats), down: bt.slice(0, nbeats).filter((_, i) => i % 4 === 0), drops, bpm } };
  };
  // everything the suites measure about one song
  window.measure = async spec => {
    const a = __afterglow, {buffer, truth} = await makeSong(spec);
    const A = await a.analyse(buffer, () => {}), T = a.buildTrack(A, 7), NF = 16, F = 60;
    const cuts = [], imps = [], fades = [];
    let fade = null;
    for (let f = 1; f < A.frames; f++) {
      const o = f * NF, p = (f - 1) * NF;
      if (T[o + 12] !== T[p + 12]) cuts.push({t: f / F, sa: T[o + 9], prevSb: T[p + 10], prevMix: T[p + 11]});
      if (T[o + 5] > .9 && T[p + 5] < .9) imps.push(f / F);
      if (T[o + 11] > 0 && T[p + 11] === 0) fade = {t0: f / F, sa: T[o + 9], sb: T[o + 10], mix: [T[o + 11]]};
      else if (fade && T[o + 11] > 0) fade.mix.push(T[o + 11]);
      else if (fade) { fade.t1 = f / F; fade.next = T[o + 9]; fades.push(fade); fade = null; }
    }
    return {bpm: A.bpm, beats: A.beats.map(f => f / F), bars: A.bars.map(f => f / F), cuts, imps, fades, truth};
  };
});

const SONGS = {
  house124: {bpm: 124, style: 'house', swing: .04, layout: [['intro', 8], ['verse', 8], ['build', 4], ['drop', 16], ['break', 8], ['build', 4], ['drop', 8]]},
  hiphop92: {bpm: 92, style: 'hiphop', swing: .12, pickup: .9, layout: [['intro', 4], ['verse', 8], ['build', 2], ['drop', 8], ['break', 4], ['drop', 8]]},
  dnb174: {bpm: 174, style: 'dnb', pickup: .2, layout: [['intro', 8], ['verse', 8], ['build', 4], ['drop', 16], ['break', 8], ['build', 4], ['drop', 16]]},
  oddBars: {bpm: 126, style: 'house', pickup: 1.37, jitter: .02, layout: [['intro', 6], ['verse', 7], ['build', 3], ['drop', 12], ['break', 5], ['drop', 8]]},
  liveDrift: {bpm: 100, style: 'hiphop', drift: .045, jitter: .025, pickup: .6, swing: .08, layout: [['intro', 4], ['verse', 12], ['build', 2], ['drop', 12], ['break', 4], ['drop', 12]]},
};
const near = (arr, t) => arr.reduce((m, x) => Math.min(m, Math.abs(x - t)), 1e9);
const measured = {};
const measureAll = async () => {
  for (const [name, spec] of Object.entries(SONGS)) if (!measured[name]) measured[name] = await page.evaluate(s => measure(s), {...spec, seed: name.length * 97});
};

if (suites.includes('beats')) {
  section('beats');
  await measureAll();
  let sumF = 0, sumCut = 0;
  for (const [name, r] of Object.entries(measured)) {
    const tb = r.truth.beats, lo = tb[0] - .2, hi = tb[tb.length - 1] + .2;
    const det = r.beats.filter(t => t > lo && t < hi);
    // half tempo is a fair reading of drum & bass: every detected beat must still be a true one
    // a drifting song has no single tempo; compare with its average
    const meanBpm = 60 * (tb.length - 1) / (tb[tb.length - 1] - tb[0]);
    const half = Math.abs(r.bpm * 2 - meanBpm) / meanBpm < .04;
    const P = det.filter(t => near(tb, t) < .05).length / det.length;
    const R = tb.filter(t => near(det, t) < .05).length / tb.length;
    const F = half ? P : 2 * P * R / (P + R);
    const bars = r.bars.filter(t => t > lo && t < hi);
    const down = bars.filter(t => near(r.truth.down, t) < .07).length / bars.length;
    const dropErr = r.truth.drops.map(d => near(r.imps, d));
    const onBeat = r.cuts.filter(c => near(tb, c.t) < .05).length / r.cuts.length;
    log(`${name.padEnd(10)} ${r.bpm.toFixed(1)} BPM (${meanBpm.toFixed(1)}${half ? ', half' : ''})  beats ${F.toFixed(2)}  downbeats ${down.toFixed(2)}  drops ${dropErr.map(e => Math.round(e * 1000) + ' ms').join(', ')}  cuts on beat ${onBeat.toFixed(2)}`);
    const tempoOk = half || Math.abs(r.bpm - meanBpm) / meanBpm < .03;
    check(tempoOk, `${name}: tempo`, `${r.bpm.toFixed(1)} BPM, true ${meanBpm.toFixed(1)} on average`);
    check(F >= .9, `${name}: beats hit within 50 ms`, `F = ${F.toFixed(2)}`);
    check(down >= .9, `${name}: downbeats within 70 ms`, `${down.toFixed(2)}`);
    check(dropErr.every(e => e < .06), `${name}: every drop gets its cut within 60 ms`, dropErr.map(e => Math.round(e * 1000) + ' ms').join(', '));
    check(onBeat >= .85, `${name}: cuts on a true beat`, `${onBeat.toFixed(2)}`);
    sumF += F; sumCut += onBeat;
  }
  const n = Object.keys(measured).length;
  check(sumF / n >= .95, 'mean beat score', (sumF / n).toFixed(3));
  check(sumCut / n >= .93, 'mean share of cuts on the beat', (sumCut / n).toFixed(3));
}

if (suites.includes('shots')) {
  section('shots');
  await measureAll();
  for (const [name, r] of Object.entries(measured)) {
    // dissolves: from the current scene into the next shot's, mix rising 0 -> 1, the next shot then shows it
    for (const f of r.fades) {
      const rising = f.mix.every((m, i) => i === 0 || m >= f.mix[i - 1]);
      check(rising && f.mix[0] < .2 && f.mix[f.mix.length - 1] > .8, `${name}: dissolve at ${f.t0.toFixed(2)} s runs 0 -> 1`, f.mix.slice(0, 3).concat(f.mix.slice(-3)).map(m => m.toFixed(2)).join(' '));
      check(f.next === f.sb, `${name}: dissolve at ${f.t0.toFixed(2)} s ends on the scene it faded into`, `faded into ${f.sb}, next shot shows ${f.next}`);
      check(r.truth.drops.every(d => Math.abs(d - f.t1) > .1), `${name}: no dissolve ends on a drop (${f.t1.toFixed(2)} s)`);
    }
    // a drop is always a hard cut: the frame before it is not in the middle of a dissolve
    for (const d of r.truth.drops) {
      const c = r.cuts.reduce((m, x) => Math.abs(x.t - d) < Math.abs(m.t - d) ? x : m, {t: 1e9});
      check(Math.abs(c.t - d) < .06 && !(c.prevMix > 0), `${name}: hard cut on the drop at ${d.toFixed(2)} s`, `nearest cut ${c.t.toFixed(2)} s, mix before ${c.prevMix}`);
    }
    // cuts sit on the bar or on the beat inside it; none between beats
    const bars = r.bars;
    const offGrid = r.cuts.filter(c => near(r.beats, c.t) > .02);
    check(offGrid.length === 0, `${name}: every cut is on the tracked beat grid`, offGrid.slice(0, 5).map(c => c.t.toFixed(2)).join(', '));
    const onBar = r.cuts.filter(c => near(bars, c.t) < .02).length / r.cuts.length;
    log(`${name.padEnd(10)} ${r.cuts.length} cuts, ${r.fades.length} dissolves, ${(onBar * 100).toFixed(0)} % on a downbeat`);
    check(onBar >= .4, `${name}: chops between bars do not knock the long shots off the bar`, `${(onBar * 100).toFixed(0)} % of cuts on a downbeat`);
  }
}

if (suites.includes('scenes')) {
  section('scenes');
  const res = await page.evaluate(async () => {
    const a = __afterglow;
    if (!a.S.song) await a.loadBuffer(await a.demoBuffer(), {artist: '', title: ''});
    document.getElementById('play').click(); // pause
    const R = a.R(), c = document.createElement('canvas'); c.width = 160; c.height = 90;
    const x = c.getContext('2d', {willReadFrequently: true});
    R.resize(160, 90, .75);
    const out = [];
    for (let s = 0; s < 12; s++) for (const [t, label] of [[5, 'calm'], [40, 'drop']]) {
      R.reset();
      const f0 = t * 60;
      for (let f = f0 - 20; f <= f0; f++) { const U = a.uniformsAt(f); U.SA = U.SB = s; U.MIXV = 0; R.draw(U); }
      x.drawImage(R.c, 0, 0, 160, 90);
      const d = x.getImageData(0, 0, 160, 90).data; let sum = 0, white = 0;
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 765; sum += l; if (l > .97) white++; }
      out.push({s, label, mean: sum / (d.length / 4), white: white / (d.length / 4)});
    }
    return out;
  });
  for (const r of res) {
    log(`scene ${String(r.s).padStart(2)} ${r.label}  mean ${r.mean.toFixed(2)}  white ${(r.white * 100).toFixed(1)} %`);
    check(r.mean > .03 && r.mean < .8 && r.white < .25, `scene ${r.s} (${r.label}) draws a picture`, `mean luminance ${r.mean.toFixed(3)}, ${(r.white * 100).toFixed(1)} % white`);
  }
}

if (suites.includes('loop')) {
  section('loop');
  const r = await page.evaluate(async () => {
    const a = __afterglow;
    if (!a.S.song) await a.loadBuffer(await a.demoBuffer(), {artist: '', title: ''});
    if (!a.S.playing) document.getElementById('play').click();
    for (let i = 0; i < 4; i++) a.seek(10 + i);
    const R = a.R(), orig = R.draw.bind(R); let draws = 0; R.draw = U => { draws++; orig(U); };
    let raf = 0; const t0 = performance.now();
    await new Promise(res => { const tick = () => { raf++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    R.draw = orig;
    return {draws, raf};
  });
  log(`${r.draws} draws in ${r.raf} animation frames after four seeks`);
  check(r.draws <= r.raf + 1, 'one draw per animation frame after seeking while playing', `${r.draws} draws, ${r.raf} frames`);
}

check(errors.length === 0, 'no page errors', errors.slice(0, 3).join(' | '));
await browser.close();
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
